import { describe, expect, it } from 'vitest';
import { parseOpenAIRequest, buildOpenAICompletion } from '../src/openai.ts';
import { parseAnthropicRequest, buildAnthropicMessage } from '../src/anthropic.ts';
import { EventAggregator } from '../src/aggregate.ts';
import { cleanGeminiSchema, toGeminiContents, toGeminiTools, geminiChunkToEvents } from '../src/providers/antigravity.ts';
import { resolveModel } from '../src/models.ts';
import type { ProviderEvent } from '../src/types.ts';

describe('parseOpenAIRequest', () => {
  it('collects system messages and parses user/assistant turns', () => {
    const core = parseOpenAIRequest({
      model: 'claude-sonnet-4-5',
      messages: [
        { role: 'system', content: 'be terse' },
        { role: 'user', content: 'hi' },
        { role: 'assistant', content: 'hello' },
        { role: 'user', content: [{ type: 'text', text: 'bye' }] },
      ],
    });
    expect(core.system).toBe('be terse');
    expect(core.messages).toHaveLength(3);
    expect(core.messages[0]).toEqual({ role: 'user', content: [{ type: 'text', text: 'hi' }] });
    expect(core.messages[2]!.content[0]).toEqual({ type: 'text', text: 'bye' });
    expect(core.stream).toBe(false);
  });

  it('parses image data urls', () => {
    const core = parseOpenAIRequest({
      model: 'm',
      messages: [{ role: 'user', content: [{ type: 'image_url', image_url: { url: 'data:image/png;base64,QUJD' } }] }],
    });
    expect(core.messages[0]!.content[0]).toEqual({ type: 'image', mediaType: 'image/png', base64: 'QUJD' });
  });

  it('keeps assistant tool calls and folds tool results into user turns', () => {
    const core = parseOpenAIRequest({
      model: 'm',
      messages: [
        { role: 'user', content: 'weather?' },
        { role: 'assistant', content: null, tool_calls: [{ id: 'c1', function: { name: 'get_weather', arguments: '{"city":"Oslo"}' } }] },
        { role: 'tool', tool_call_id: 'c1', content: '12C' },
      ],
    });
    expect(core.messages[1]!.content[0]).toMatchObject({ type: 'tool_use', id: 'c1', name: 'get_weather', input: { city: 'Oslo' } });
    const last = core.messages[2]!;
    expect(last.role).toBe('user');
    expect(last.content[0]).toMatchObject({ type: 'tool_result', toolUseId: 'c1', content: '12C' });
  });

  it('converts OpenAI tools to core tools', () => {
    const core = parseOpenAIRequest({
      model: 'm',
      messages: [{ role: 'user', content: 'x' }],
      tools: [{ type: 'function', function: { name: 'f', description: 'd', parameters: { type: 'object', properties: { a: { type: 'string' } } } } }],
    });
    expect(core.tools).toEqual([{ name: 'f', description: 'd', parameters: { type: 'object', properties: { a: { type: 'string' } } } }]);
  });

  it('rejects missing messages', () => {
    expect(() => parseOpenAIRequest({ model: 'm' })).toThrow(/messages/);
  });
});

describe('parseAnthropicRequest', () => {
  it('parses system, parts and tools', () => {
    const core = parseAnthropicRequest({
      model: 'claude-sonnet-4-5',
      system: [{ type: 'text', text: 'sys' }],
      messages: [
        { role: 'user', content: [{ type: 'text', text: 'look' }, { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'QUJD' } }] },
      ],
      tools: [{ name: 't', description: 'd', input_schema: { type: 'object' } }],
      max_tokens: 100,
    });
    expect(core.system).toBe('sys');
    expect(core.messages[0]!.content[1]).toEqual({ type: 'image', mediaType: 'image/jpeg', base64: 'QUJD' });
    expect(core.tools![0]!.name).toBe('t');
    expect(core.maxTokens).toBe(100);
  });

  it('parses tool_use and tool_result parts', () => {
    const core = parseAnthropicRequest({
      model: 'm',
      messages: [
        { role: 'assistant', content: [{ type: 'tool_use', id: 't1', name: 'run', input: { cmd: 'ls' } }] },
        { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: 'ok' }] },
      ],
    });
    expect(core.messages[0]!.content[0]).toMatchObject({ type: 'tool_use', id: 't1' });
    expect(core.messages[1]!.content[0]).toMatchObject({ type: 'tool_result', toolUseId: 't1', content: 'ok' });
  });
});

describe('aggregation and rendering', () => {
  const events: ProviderEvent[] = [
    { type: 'text', text: 'Let me check. ' },
    { type: 'tool_start', id: 'call_1', name: 'read_file' },
    { type: 'tool_delta', id: 'call_1', argsDelta: '{"path":"/te' },
    { type: 'tool_delta', id: 'call_1', argsDelta: 'xt.txt"}' },
    { type: 'tool_end', id: 'call_1' },
    { type: 'usage', inputTokens: 12, outputTokens: 34 },
    { type: 'finish', reason: 'tool_use' },
  ];

  it('aggregates text, tool calls and usage', () => {
    const agg = new EventAggregator();
    for (const ev of events) agg.push(ev);
    const result = agg.result();
    expect(result.text).toBe('Let me check. ');
    expect(result.toolCalls).toEqual([{ id: 'call_1', name: 'read_file', argsRaw: '{"path":"/text.txt"}' }]);
    expect(result.usage).toEqual({ inputTokens: 12, outputTokens: 34 });
    expect(result.finish).toBe('tool_use');
  });

  it('renders an OpenAI completion with tool_calls', () => {
    const agg = new EventAggregator();
    for (const ev of events) agg.push(ev);
    const out = buildOpenAICompletion(agg.result(), 'claude-sonnet-4-5', 'chatcmpl-1') as any;
    expect(out.object).toBe('chat.completion');
    expect(out.choices[0].finish_reason).toBe('tool_calls');
    expect(out.choices[0].message.tool_calls[0].function.name).toBe('read_file');
    expect(JSON.parse(out.choices[0].message.tool_calls[0].function.arguments)).toEqual({ path: '/text.txt' });
    expect(out.usage).toEqual({ prompt_tokens: 12, completion_tokens: 34, total_tokens: 46 });
  });

  it('renders an Anthropic message with tool_use', () => {
    const agg = new EventAggregator();
    for (const ev of events) agg.push(ev);
    const out = buildAnthropicMessage(agg.result(), 'claude-sonnet-4-5') as any;
    expect(out.type).toBe('message');
    expect(out.stop_reason).toBe('tool_use');
    expect(out.content[0].type).toBe('text');
    expect(out.content[1]).toMatchObject({ type: 'tool_use', id: 'call_1', name: 'read_file', input: { path: '/text.txt' } });
  });
});

describe('cleanGeminiSchema and toGeminiTools', () => {
  it('handles union type lists such as ["string", "null"] in nested properties', () => {
    const rawSchema = {
      type: 'object',
      title: 'SearchTool',
      additionalProperties: false,
      properties: {
        filters: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              field: { type: 'string' },
              operator: { type: 'string', enum: ['eq', 'neq'] },
              value: { type: ['string', 'null'], description: 'optional filter value' },
            },
            required: ['field', 'operator', 'value', 'nonExistentField'],
          },
        },
      },
      required: ['filters'],
    };

    const cleaned = cleanGeminiSchema(rawSchema);

    expect(cleaned.type).toBe('OBJECT');
    expect((cleaned as any).title).toBeUndefined();
    expect((cleaned as any).additionalProperties).toBeUndefined();

    const filters = (cleaned.properties as any).filters;
    expect(filters.type).toBe('ARRAY');
    expect(filters.items.type).toBe('OBJECT');

    const valProp = filters.items.properties.value;
    expect(valProp.type).toBe('STRING');
    expect(valProp.nullable).toBe(true);
    expect(valProp.description).toBe('optional filter value');

    // nonExistentField must be stripped from required
    expect(filters.items.required).toEqual(['field', 'operator', 'value']);
  });

  it('supplies default items for array if missing', () => {
    const rawSchema = {
      type: 'object',
      properties: {
        tags: { type: 'array' },
      },
    };
    const cleaned = cleanGeminiSchema(rawSchema);
    expect((cleaned.properties as any).tags.items).toEqual({ type: 'STRING' });
  });

  it('normalizes enums to string arrays and const to enum', () => {
    const rawSchema = {
      type: 'object',
      properties: {
        numChoice: { enum: [1, 2, 3] },
        fixedVal: { const: 'exact' },
      },
    };
    const cleaned = cleanGeminiSchema(rawSchema);
    expect((cleaned.properties as any).numChoice.enum).toEqual(['1', '2', '3']);
    expect((cleaned.properties as any).fixedVal.enum).toEqual(['exact']);
  });
});

describe('resolveModel', () => {
  it('resolves direct catalog models and dot/hyphen variants', () => {
    const m1 = resolveModel('kiro/claude-sonnet-4.5');
    expect(m1).toMatchObject({ id: 'kiro/claude-sonnet-4.5', provider: 'kiro', upstream: 'claude-sonnet-4.5' });

    const m2 = resolveModel('kiro/claude-sonnet-4-5');
    expect(m2).toMatchObject({ provider: 'kiro', upstream: 'claude-sonnet-4.5' });

    const m3High = resolveModel('agy/gemini-3.7-flash-high');
    expect(m3High).toMatchObject({ id: 'agy/gemini-3.7-flash', provider: 'antigravity', upstream: 'gemini-3.7-flash-tiered' });

    const m4 = resolveModel('gemini-3.7-flash');
    expect(m4).toMatchObject({ id: 'agy/gemini-3.7-flash', provider: 'antigravity', upstream: 'gemini-3.7-flash-tiered' });

    const m5 = resolveModel('claude-3.7-sonnet');
    expect(m5).toMatchObject({ provider: 'kiro', upstream: 'claude-sonnet-4.5' });
  });

  it('supports explicit provider prefixes and aliases', () => {
    const k = resolveModel('kiro/custom-kiro-model');
    expect(k).toEqual({ id: 'kiro/custom-kiro-model', provider: 'kiro', upstream: 'custom-kiro-model' });

    const a1 = resolveModel('agy/custom-gemini-model');
    expect(a1).toEqual({ id: 'agy/custom-gemini-model', provider: 'antigravity', upstream: 'custom-gemini-model' });

    const a2 = resolveModel('antigravity/gemini-3.7-flash');
    expect(a2).toMatchObject({ id: 'agy/gemini-3.7-flash', provider: 'antigravity', upstream: 'gemini-3.7-flash-tiered' });
  });

  it('infers provider for future uncataloged models', () => {
    const gem = resolveModel('gemini-4.0-flash');
    expect(gem).toEqual({ id: 'agy/gemini-4.0-flash', provider: 'antigravity', upstream: 'gemini-4.0-flash' });

    const cl = resolveModel('claude-6-sonnet');
    expect(cl).toEqual({ id: 'kiro/claude-6-sonnet', provider: 'kiro', upstream: 'claude-6-sonnet' });
  });
});

describe('toGeminiContents', () => {
  it('injects skip_thought_signature_validator for tool_use functionCall parts', () => {
    const messages = [
      { role: 'user' as const, content: [{ type: 'text' as const, text: 'run tool' }] },
      {
        role: 'assistant' as const,
        content: [
          { type: 'tool_use' as const, id: 'call_123', name: 'default_api:my', input: { arg: 1 } },
        ],
      },
      {
        role: 'user' as const,
        content: [
          { type: 'tool_result' as const, toolUseId: 'call_123', content: JSON.stringify({ status: 'success' }) },
        ],
      },
    ];

    const contents = toGeminiContents(messages);

    expect(contents).toHaveLength(3);
    // Model turn
    const modelParts = contents[1]!.parts;
    expect(modelParts[0]!.functionCall).toEqual({
      name: 'default_api:my',
      args: { arg: 1 },
    });
    expect(modelParts[0]!.thoughtSignature).toBe('skip_thought_signature_validator');

    // Tool response turn: ID call_123 must be mapped to function name default_api:my
    const userParts = contents[2]!.parts;
    expect(userParts[0]!.functionResponse).toEqual({
      name: 'default_api:my',
      response: { status: 'success' },
    });
  });

  it('handles empty tools by returning empty object without toolConfig', () => {
    const emptyTools = toGeminiTools([]);
    expect(emptyTools.tools).toBeUndefined();
    expect(emptyTools.toolConfig).toBeUndefined();

    const noTools = toGeminiTools(undefined);
    expect(noTools.tools).toBeUndefined();
    expect(noTools.toolConfig).toBeUndefined();
  });

  it('produces valid tool schema and VALIDATED mode when tools are present', () => {
    const tools = toGeminiTools([
      {
        name: 'get_weather',
        description: 'Get weather for location',
        parameters: {
          type: 'object',
          properties: {
            city: { type: 'string', description: 'City name' },
          },
          required: ['city'],
        },
      },
    ]);
    expect(tools.tools).toBeDefined();
    expect(tools.tools).toHaveLength(1);
    expect(tools.toolConfig).toEqual({ functionCallingConfig: { mode: 'VALIDATED' } });
  });
});

describe('Image Model Support (gemini-3.1-flash-image)', () => {
  it('resolves image model aliases to agy/gemini-3.1-flash-image', () => {
    const direct = resolveModel('agy/gemini-3.1-flash-image');
    expect(direct).toMatchObject({ id: 'agy/gemini-3.1-flash-image', provider: 'antigravity', upstream: 'gemini-3.1-flash-image' });

    const bare = resolveModel('gemini-3.1-flash-image');
    expect(bare).toMatchObject({ id: 'agy/gemini-3.1-flash-image', provider: 'antigravity', upstream: 'gemini-3.1-flash-image' });

    const preview = resolveModel('gemini-3.1-flash-image-preview');
    expect(preview).toMatchObject({ provider: 'antigravity', upstream: 'gemini-3.1-flash-image' });
  });

  it('supports text2img request conversion into Gemini contents', () => {
    const core = parseOpenAIRequest({
      model: 'agy/gemini-3.1-flash-image',
      messages: [{ role: 'user', content: 'Generate an oil painting of a cybernetic tiger' }],
    });

    const contents = toGeminiContents(core.messages);
    expect(contents).toHaveLength(1);
    expect(contents[0]!.role).toBe('user');
    expect(contents[0]!.parts).toEqual([{ text: 'Generate an oil painting of a cybernetic tiger' }]);
  });

  it('supports img2img request conversion with both image and text parts into Gemini contents', () => {
    const core = parseOpenAIRequest({
      model: 'agy/gemini-3.1-flash-image',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Add neon sunglasses to this character' },
            { type: 'image_url', image_url: { url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' } },
          ],
        },
      ],
    });

    const contents = toGeminiContents(core.messages);
    expect(contents).toHaveLength(1);
    expect(contents[0]!.role).toBe('user');
    expect(contents[0]!.parts).toHaveLength(2);
    expect(contents[0]!.parts[0]).toEqual({ text: 'Add neon sunglasses to this character' });
    expect(contents[0]!.parts[1]).toEqual({
      inlineData: {
        mimeType: 'image/png',
        data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      },
    });
  });

  it('parses inlineData from Gemini chunk into image and markdown events', () => {
    const events = geminiChunkToEvents({
      response: {
        candidates: [
          {
            content: {
              parts: [
                {
                  inlineData: {
                    mimeType: 'image/png',
                    data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
                  },
                },
              ],
            },
            finishReason: 'STOP',
          },
        ],
      },
    });

    expect(events.some((e) => e.type === 'image')).toBe(true);
    const imgEv = events.find((e) => e.type === 'image') as { type: 'image'; mediaType: string; base64: string };
    expect(imgEv.mediaType).toBe('image/png');
    expect(imgEv.base64).toContain('iVBORw0KGgoAAAANSU');

    // Also emits markdown image text for chat completions clients
    const textEv = events.find((e) => e.type === 'text') as { type: 'text'; text: string };
    expect(textEv.text).toContain('![Generated Image](data:image/png;base64,');

    // EventAggregator collects both images and text
    const agg = new EventAggregator();
    for (const ev of events) agg.push(ev);
    expect(agg.result().images).toHaveLength(1);
    expect(agg.result().images[0]!.base64).toBe(imgEv.base64);
  });
});


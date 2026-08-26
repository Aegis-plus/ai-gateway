// OpenAI-compatible layer: parses /v1/chat/completions requests into the
// unified CoreRequest and renders provider events back as chat completions
// (plain JSON or SSE chunks).

import { randomUUID } from 'node:crypto';
import type { CoreContent, CoreMessage, CoreRequest, CoreTool, ProviderEvent } from './types.ts';
import type { Aggregated } from './aggregate.ts';

interface OpenAIPart {
  type?: string;
  text?: string;
  image_url?: { url?: string };
}

interface OpenAIToolCall {
  id?: string;
  function?: { name?: string; arguments?: string };
}

interface OpenAIMessage {
  // Widened to string: newer OpenAI clients also send "developer".
  role: string;
  content: string | OpenAIPart[] | null;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
}

export class RequestFormatError extends Error {}

export function parseOpenAIRequest(body: any): CoreRequest {
  if (!body || typeof body !== 'object') throw new RequestFormatError('Request body must be a JSON object.');
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    throw new RequestFormatError('`messages` must be a non-empty array.');
  }

  const systemParts: string[] = [];
  const messages: CoreMessage[] = [];

  for (const msg of body.messages as OpenAIMessage[]) {
    if (msg.role === 'system' || msg.role === 'developer') {
      if (typeof msg.content === 'string') systemParts.push(msg.content);
      continue;
    }
    if (msg.role === 'tool') {
      const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content ?? '');
      const block: CoreContent = { type: 'tool_result', toolUseId: msg.tool_call_id ?? 'unknown', content };
      // Tool results continue the conversation from the user side.
      const last = messages[messages.length - 1];
      if (last && last.role === 'user') last.content.push(block);
      else messages.push({ role: 'user', content: [block] });
      continue;
    }
    if (msg.role !== 'user' && msg.role !== 'assistant') continue;
    const blocks: CoreContent[] = [];
    if (typeof msg.content === 'string') {
      if (msg.content) blocks.push({ type: 'text', text: msg.content });
    } else if (Array.isArray(msg.content)) {
      for (const part of msg.content as OpenAIPart[]) {
        if (part.type === 'text' && part.text) blocks.push({ type: 'text', text: part.text });
        else if ((part.type === 'image_url' || part.type === 'image') && part.image_url?.url) {
          const parsed = parseDataUrl(part.image_url.url);
          if (parsed) blocks.push({ type: 'image', mediaType: parsed.mediaType, base64: parsed.base64 });
        }
      }
    }
    for (const tc of msg.tool_calls ?? []) {
      if (tc.function?.name) {
        blocks.push({
          type: 'tool_use',
          id: tc.id ?? `call_${randomUUID().slice(0, 8)}`,
          name: tc.function.name,
          input: safeParseJson(tc.function.arguments ?? '{}'),
        });
      }
    }
    if (blocks.length > 0) messages.push({ role: msg.role === 'assistant' ? 'assistant' : 'user', content: blocks });
  }

  if (messages.length === 0) throw new RequestFormatError('No usable messages after parsing.');

  const tools: CoreTool[] | undefined = Array.isArray(body.tools)
    ? body.tools
        .filter((t: any) => t?.type === 'function' && t.function?.name)
        .map((t: any) => ({
          name: String(t.function.name),
          description: t.function.description ? String(t.function.description) : undefined,
          parameters: t.function.parameters ?? { type: 'object', properties: {} },
        }))
    : undefined;

  return {
    model: String(body.model ?? ''),
    system: systemParts.length > 0 ? systemParts.join('\n\n') : undefined,
    messages,
    tools: tools && tools.length > 0 ? tools : undefined,
    temperature: num(body.temperature),
    topP: num(body.top_p),
    maxTokens: num(body.max_tokens) ?? num(body.max_completion_tokens),
    stream: body.stream === true,
  };
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function safeParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

export function parseDataUrl(url: string): { mediaType: string; base64: string } | undefined {
  if (!url || typeof url !== 'string') return undefined;
  const trimmed = url.trim();
  const m = /^data:([^;,]+);base64,(.+)$/s.exec(trimmed);
  if (m) return { mediaType: m[1]!, base64: m[2]!.trim() };
  if (/^[A-Za-z0-9+/=]+$/.test(trimmed) && trimmed.length > 50) {
    return { mediaType: 'image/png', base64: trimmed };
  }
  return undefined;
}

// ---- responses ----

export function openaiCompletionId(): string {
  return `chatcmpl-${randomUUID().replace(/-/g, '').slice(0, 24)}`;
}

export function buildOpenAICompletion(agg: Aggregated, model: string, id: string): object {
  const message: Record<string, unknown> = { role: 'assistant', content: agg.text || null };
  if (agg.images && agg.images.length > 0) {
    message.images = agg.images.map((img, i) => ({
      index: i,
      type: 'image_url',
      image_url: { url: `data:${img.mediaType};base64,${img.base64}` },
    }));
  }
  if (agg.toolCalls.length > 0) {
    message.tool_calls = agg.toolCalls.map((c, i) => ({
      id: c.id,
      type: 'function',
      index: i,
      function: { name: c.name, arguments: c.argsRaw || '{}' },
    }));
    if (!agg.text) message.content = null;
  }
  return {
    id,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message,
        finish_reason: agg.finish === 'tool_use' ? 'tool_calls' : agg.finish === 'length' ? 'length' : 'stop',
      },
    ],
    usage: {
      prompt_tokens: agg.usage.inputTokens ?? 0,
      completion_tokens: agg.usage.outputTokens ?? 0,
      total_tokens: (agg.usage.inputTokens ?? 0) + (agg.usage.outputTokens ?? 0),
    },
  };
}

/**
 * Streams provider events as OpenAI SSE chunks.
 * Returns nothing; call `send` per produced chunk. Mid-stream provider errors
 * are re-thrown after being surfaced as an error chunk.
 */
export async function streamOpenAI(
  events: AsyncGenerator<ProviderEvent>,
  model: string,
  id: string,
  send: (obj: object) => void,
  includeUsage: boolean,
): Promise<void> {
  const toolIndex = new Map<string, number>();
  let finishSent = false;
  let usage: { inputTokens?: number; outputTokens?: number } = {};

  const chunk = (delta: Record<string, unknown>, finish: string | null = null) => ({
    id,
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, delta, finish_reason: finish }],
  });

  send(chunk({ role: 'assistant', content: '' }));

  try {
    for await (const ev of events) {
      switch (ev.type) {
        case 'text':
          send(chunk({ content: ev.text }));
          break;
        case 'image':
          send(chunk({ images: [{ type: 'image_url', image_url: { url: `data:${ev.mediaType};base64,${ev.base64}` } }] }));
          break;
        case 'tool_start': {
          const index = toolIndex.size;
          toolIndex.set(ev.id, index);
          send(chunk({ tool_calls: [{ index, id: ev.id, type: 'function', function: { name: ev.name, arguments: '' } }] }));
          break;
        }
        case 'tool_delta': {
          const index = toolIndex.get(ev.id);
          if (index !== undefined && ev.argsDelta) {
            send(chunk({ tool_calls: [{ index, function: { arguments: ev.argsDelta } }] }));
          }
          break;
        }
        case 'tool_end':
          break;
        case 'usage':
          usage = { ...usage, inputTokens: ev.inputTokens ?? usage.inputTokens, outputTokens: ev.outputTokens ?? usage.outputTokens };
          break;
        case 'credits':
          break;
        case 'finish': {
          const finish = ev.reason === 'tool_use' ? 'tool_calls' : ev.reason === 'length' ? 'length' : 'stop';
          send(chunk({}, finish));
          finishSent = true;
          break;
        }
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    send({ error: { message, type: 'upstream_error', code: 'gateway_stream_error' } });
    throw err;
  }

  if (!finishSent) send(chunk({}, 'stop'));
  if (includeUsage) {
    send({
      id,
      object: 'chat.completion.chunk',
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [],
      usage: {
        prompt_tokens: usage.inputTokens ?? 0,
        completion_tokens: usage.outputTokens ?? 0,
        total_tokens: (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0),
      },
    });
  }
}

// Anthropic-compatible layer: parses /v1/messages requests into the unified
// CoreRequest and renders provider events as Anthropic message responses
// (plain JSON or SSE events).

import { randomUUID } from 'node:crypto';
import type { CoreContent, CoreMessage, CoreRequest, CoreTool, ProviderEvent } from './types.ts';
import type { Aggregated } from './aggregate.ts';
import { RequestFormatError } from './openai.ts';

interface AnthropicPart {
  type?: string;
  text?: string;
  source?: { type?: string; media_type?: string; data?: string };
  id?: string;
  name?: string;
  input?: unknown;
  tool_use_id?: string;
  content?: unknown;
}

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string | AnthropicPart[];
}

export function parseAnthropicRequest(body: any): CoreRequest {
  if (!body || typeof body !== 'object') throw new RequestFormatError('Request body must be a JSON object.');
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    throw new RequestFormatError('`messages` must be a non-empty array.');
  }

  let system: string | undefined;
  if (typeof body.system === 'string') system = body.system;
  else if (Array.isArray(body.system)) {
    system = body.system.map((p: any) => p?.text ?? '').filter(Boolean).join('\n\n') || undefined;
  }

  const messages: CoreMessage[] = [];
  for (const msg of body.messages as AnthropicMessage[]) {
    const blocks: CoreContent[] = [];
    if (typeof msg.content === 'string') {
      if (msg.content) blocks.push({ type: 'text', text: msg.content });
    } else if (Array.isArray(msg.content)) {
      for (const part of msg.content as AnthropicPart[]) {
        if (part.type === 'text' && part.text) blocks.push({ type: 'text', text: part.text });
        else if (part.type === 'image' && part.source?.type === 'base64' && part.source.data) {
          blocks.push({ type: 'image', mediaType: part.source.media_type ?? 'image/png', base64: part.source.data });
        } else if (part.type === 'tool_use' && part.name) {
          blocks.push({ type: 'tool_use', id: part.id ?? `call_${randomUUID().slice(0, 8)}`, name: part.name, input: part.input ?? {} });
        } else if (part.type === 'tool_result' && part.tool_use_id) {
          const content =
            typeof part.content === 'string'
              ? part.content
              : Array.isArray(part.content)
                ? part.content.map((c: any) => c?.text ?? '').join('\n')
                : '';
          blocks.push({ type: 'tool_result', toolUseId: part.tool_use_id, content });
        }
      }
    }
    if (blocks.length > 0) messages.push({ role: msg.role, content: blocks });
  }

  if (messages.length === 0) throw new RequestFormatError('No usable messages after parsing.');

  const tools: CoreTool[] | undefined = Array.isArray(body.tools)
    ? body.tools
        .filter((t: any) => t?.name)
        .map((t: any) => ({
          name: String(t.name),
          description: t.description ? String(t.description) : undefined,
          parameters: t.input_schema ?? { type: 'object', properties: {} },
        }))
    : undefined;

  const temperature = typeof body.temperature === 'number' ? body.temperature : undefined;
  const topP = typeof body['top_p'] === 'number' ? body['top_p'] : undefined;
  const maxTokens = typeof body.max_tokens === 'number' ? body.max_tokens : undefined;

  return {
    model: String(body.model ?? ''),
    system,
    messages,
    tools: tools && tools.length > 0 ? tools : undefined,
    temperature,
    topP,
    maxTokens,
    stream: body.stream === true,
  };
}

// ---- responses ----

function stopReasonOf(finish: Aggregated['finish']): string {
  return finish === 'tool_use' ? 'tool_use' : finish === 'length' ? 'max_tokens' : 'end_turn';
}

export function buildAnthropicMessage(agg: Aggregated, model: string): object {
  const content: Record<string, unknown>[] = [];
  if (agg.text) content.push({ type: 'text', text: agg.text });
  for (const call of agg.toolCalls) {
    content.push({
      type: 'tool_use',
      id: call.id,
      name: call.name,
      input: safeParseJson(call.argsRaw || '{}'),
    });
  }
  if (content.length === 0) content.push({ type: 'text', text: '' });
  return {
    id: `msg_${randomUUID().replace(/-/g, '').slice(0, 24)}`,
    type: 'message',
    role: 'assistant',
    content,
    model,
    stop_reason: stopReasonOf(agg.finish),
    stop_sequence: null,
    usage: {
      input_tokens: agg.usage.inputTokens ?? 0,
      output_tokens: agg.usage.outputTokens ?? 0,
    },
  };
}

/** Streams provider events as Anthropic SSE events. */
export async function streamAnthropic(
  events: AsyncGenerator<ProviderEvent>,
  model: string,
  send: (obj: object) => void,
  inputEstimate = 0,
): Promise<void> {
  const msgId = `msg_${randomUUID().replace(/-/g, '').slice(0, 24)}`;
  let usage: { inputTokens?: number; outputTokens?: number } = {};
  let outputChars = 0;

  send({
    type: 'message_start',
    message: { id: msgId, type: 'message', role: 'assistant', content: [], model, usage: { input_tokens: 0, output_tokens: 0 } },
  });
  send({ type: 'ping' });

  const blockIds = new Map<string, number>();
  let blockIndex = 0;
  let openBlockType: 'text' | 'tool_use' | null = null;
  let stopReason = 'end_turn';

  const closeBlock = () => {
    if (openBlockType !== null) {
      send({ type: 'content_block_stop', index: blockIndex });
      blockIndex += 1;
      openBlockType = null;
    }
  };

  try {
    for await (const ev of events) {
      switch (ev.type) {
        case 'text':
          if (openBlockType !== 'text') {
            closeBlock();
            send({ type: 'content_block_start', index: blockIndex, content_block: { type: 'text', text: '' } });
            openBlockType = 'text';
          }
          outputChars += ev.text.length;
          send({ type: 'content_block_delta', index: blockIndex, delta: { type: 'text_delta', text: ev.text } });
          break;
        case 'tool_start': {
          closeBlock();
          blockIds.set(ev.id, blockIndex);
          send({
            type: 'content_block_start',
            index: blockIndex,
            content_block: { type: 'tool_use', id: ev.id, name: ev.name, input: {} },
          });
          openBlockType = 'tool_use';
          stopReason = 'tool_use';
          break;
        }
        case 'tool_delta': {
          const index = blockIds.get(ev.id);
          if (index !== undefined && ev.argsDelta) {
            send({ type: 'content_block_delta', index, delta: { type: 'input_json_delta', partial_json: ev.argsDelta } });
          }
          break;
        }
        case 'tool_end': {
          const index = blockIds.get(ev.id);
          if (index !== undefined && index === blockIndex) closeBlock();
          break;
        }
        case 'usage':
          usage = {
            ...usage,
            inputTokens: ev.inputTokens ?? usage.inputTokens,
            outputTokens: ev.outputTokens ?? usage.outputTokens,
          };
          break;
        case 'credits':
          break;
        case 'finish':
          stopReason = ev.reason === 'tool_use' ? 'tool_use' : ev.reason === 'length' ? 'max_tokens' : stopReason;
          break;
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    closeBlock();
    send({ type: 'error', error: { type: 'api_error', message } });
    throw err;
  }

  closeBlock();
  const outputTokens = usage.outputTokens ?? Math.ceil(outputChars / 4);
  const inputTokens = usage.inputTokens ?? inputEstimate;
  send({ type: 'message_delta', delta: { stop_reason: stopReason, stop_sequence: null }, usage: { output_tokens: outputTokens, input_tokens: inputTokens } });
  send({ type: 'message_stop' });
}

function safeParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

// Kiro provider adapter: converts the unified CoreRequest into Kiro's
// CodeWhisperer generateAssistantResponse "conversationState" format and
// streams the AWS event-stream response back as ProviderEvents.

import { randomUUID } from 'node:crypto';
import type { CoreContent, CoreRequest, KiroCreds, ProviderEvent } from '../types.ts';
import { ProviderError } from '../types.ts';
import { authHeaders, getValidAccessToken } from '../auth/kiro.ts';
import { AwsEventStreamParser } from './eventstream.ts';

const CW_BASES = [
  'https://codewhisperer.us-east-1.amazonaws.com',
  'https://runtime.us-east-1.kiro.dev',
  'https://q.us-east-1.amazonaws.com',
];

export async function* streamKiro(req: CoreRequest, upstreamModel: string, creds: KiroCreds): AsyncGenerator<ProviderEvent> {
  await getValidAccessToken(creds);

  const messages = [...req.messages];
  const current = messages.pop();
  if (!current || current.role !== 'user') {
    throw new ProviderError('upstream', 'The last message must come from the user.');
  }

  const systemPrefix = req.system ? `${req.system}\n\n` : '';
  const body = {
    conversationState: {
      chatTriggerType: 'MANUAL',
      conversationId: randomUUID(),
      currentMessage: {
        userInputMessage: {
          content: systemPrefix + flatten(current.content),
          modelId: upstreamModel,
          origin: 'AI_EDITOR',
          ...kiroImages(current.content),
          ...kiroTools(req.tools),
        },
      },
      history: flattenHistory(messages),
    },
  };

  let res: Response | undefined;
  let lastNetworkError: unknown;
  for (const base of CW_BASES) {
    try {
      res = await fetch(`${base}/generateAssistantResponse`, {
        method: 'POST',
        headers: { ...authHeaders(creds), accept: 'application/vnd.amazon.eventstream' },
        body: JSON.stringify(body),
      });
      break;
    } catch (err) {
      lastNetworkError = err; // network-level failure — try the next base
    }
  }
  if (!res) {
    throw new ProviderError('upstream', `Kiro unreachable: ${lastNetworkError instanceof Error ? lastNetworkError.message : String(lastNetworkError)}`);
  }

  if (!res.ok) {
    const text = await res.text();
    throw classifyKiroError(res.status, text);
  }
  if (!res.body) throw new ProviderError('upstream', 'Kiro returned an empty response body.');

  const parser = new AwsEventStreamParser();
  const reader = res.body.getReader();
  let finished = false;
  let outChars = 0;
  const inChars = body.conversationState.currentMessage.userInputMessage.content.length;
  const seenTools = new Set<string>();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const event of parser.push(Buffer.from(value))) {
        const payload = parseJsonSafe(event.payload.toString('utf8'));
        if (!payload || typeof payload !== 'object') continue;
        for (const ev of kiroPayloadToEvents(payload)) {
          if (ev.type === 'text') outChars += ev.text.length;
          if (ev.type === 'tool_start') seenTools.add(ev.id);
          yield ev;
        }
      }
    }
  } finally {
    void reader.cancel().catch(() => {});
  }

  if (seenTools.size > 0 && !finished) {
    yield { type: 'finish', reason: 'tool_use' };
    finished = true;
  }
  if (!finished) {
    // Kiro does not report token usage; estimate from character counts.
    yield { type: 'usage', inputTokens: Math.ceil(inChars / 4), outputTokens: Math.ceil(outChars / 4) };
    yield { type: 'finish', reason: 'stop' };
  }
}

/** Defensive extraction of stream events from one event-stream payload. */
export function kiroPayloadToEvents(payload: Record<string, any>): ProviderEvent[] {
  const events: ProviderEvent[] = [];

  const toolUse = payload.toolUseEvent ?? payload.toolUsesEvent;
  if (toolUse && typeof toolUse === 'object' && toolUse.toolUseId) {
    const id = String(toolUse.toolUseId);
    events.push({ type: 'tool_start', id, name: String(toolUse.name ?? 'tool') });
    let args = toolUse.input ?? {};
    if (typeof args === 'string') {
      events.push({ type: 'tool_delta', id, argsDelta: args || '{}' });
    } else if (Object.keys(args).length > 0) {
      events.push({ type: 'tool_delta', id, argsDelta: JSON.stringify(args) });
    }
    events.push({ type: 'tool_end', id });
    return events;
  }

  if (payload.errorEvent) {
    const msg = typeof payload.errorEvent === 'string' ? payload.errorEvent : JSON.stringify(payload.errorEvent);
    throw new ProviderError('upstream', `Kiro stream error: ${msg}`);
  }

  const text =
    typeof payload.content === 'string'
      ? payload.content
      : typeof payload.content?.text === 'string'
        ? payload.content.text
        : typeof payload.assistantResponseEvent?.content?.text === 'string'
          ? payload.assistantResponseEvent.content.text
          : undefined;
  if (text) events.push({ type: 'text', text });
  return events;
}

export function classifyKiroError(status: number, body: string): ProviderError {
  const lower = body.toLowerCase();
  if (status === 429) {
    // 429 covers both per-minute throttling and daily/monthly limits.
    const hard = lower.includes('quota') || lower.includes('limit exceeded') || lower.includes('usage limit');
    return new ProviderError(
      hard ? 'quota' : 'rate_limit',
      `Kiro rate limited (429): ${body.slice(0, 300)}`,
      429,
      hard ? undefined : 60_000,
    );
  }
  if (status === 402) {
    return new ProviderError('quota', `Kiro usage limit exhausted (402): ${body.slice(0, 300)}`, 402);
  }
  if (status === 401 || status === 403) {
    if (lower.includes('temporarily_suspended')) {
      return new ProviderError('quota', 'Kiro account temporarily suspended', 403);
    }
    return new ProviderError('auth', `Kiro auth error (${status}): ${body.slice(0, 300)}`, status);
  }
  return new ProviderError('upstream', `Kiro upstream error (${status}): ${body.slice(0, 300)}`, status);
}

// ---- request building helpers ----

function flatten(content: CoreContent[]): string {
  const parts: string[] = [];
  for (const block of content) {
    if (block.type === 'text') parts.push(block.text);
    else if (block.type === 'tool_use') parts.push(`<tool_call name="${block.name}">${JSON.stringify(block.input ?? {})} </tool_call>`);
    else if (block.type === 'tool_result') parts.push(`[Tool result for ${block.toolUseId}]: ${block.content}`);
    // images are handled separately
  }
  return parts.join('\n');
}

function kiroImages(content: CoreContent[]): { images?: { format: string; source: { bytes: string } }[] } {
  const images = content
    .filter((b): b is Extract<CoreContent, { type: 'image' }> => b.type === 'image')
    .map((b) => ({
      format: (b.mediaType.split('/')[1] ?? 'png').replace('jpeg', 'jpg'),
      source: { bytes: b.base64 },
    }));
  return images.length > 0 ? { images } : {};
}

function kiroTools(tools?: CoreRequest['tools']): { userInputMessageContext?: { tools: unknown[] } } {
  if (!tools || tools.length === 0) return {};
  return {
    userInputMessageContext: {
      tools: tools.map((t) => ({
        toolSpecification: {
          name: t.name,
          description: t.description ?? '',
          inputSchema: { json: t.parameters },
        },
      })),
    },
  };
}

/** Kiro history must strictly alternate user → assistant; merge runs. */
function flattenHistory(messages: CoreRequest['messages']): Record<string, unknown>[] {
  const history: { role: 'user' | 'assistant'; text: string }[] = [];
  for (const msg of messages) {
    const text = flatten(msg.content);
    if (!text) continue;
    const last = history[history.length - 1];
    if (last && last.role === msg.role) last.text += `\n${text}`;
    else history.push({ role: msg.role, text });
  }
  // Trim a leading assistant turn — Kiro expects the history to start with user.
  while (history.length > 0 && history[0]!.role === 'assistant') history.shift();
  const pairs: Record<string, unknown>[] = [];
  for (let i = 0; i < history.length; i += 2) {
    const user = history[i]!;
    const assistant = history[i + 1];
    pairs.push({ userInputMessage: { content: user.text, origin: 'AI_EDITOR' } });
    pairs.push({ assistantResponseMessage: { content: assistant?.text ?? 'I understand.' } });
  }
  return pairs;
}

function parseJsonSafe(text: string): any {
  if (!text) return undefined;
  const start = text.indexOf('{');
  if (start < 0) return undefined;
  try {
    return JSON.parse(text.slice(start));
  } catch {
    return undefined;
  }
}

// Antigravity provider adapter: converts the unified CoreRequest into the
// Cloud Code v1internal:streamGenerateContent envelope and parses the
// Gemini-shaped SSE response into ProviderEvents.

import { randomBytes } from 'node:crypto';
import type { Account, CoreContent, CoreRequest, ProviderEvent } from '../types.ts';
import { ProviderError } from '../types.ts';
import { ANTIGRAVITY_BASES, contentHeaders, getValidAccessToken } from '../auth/antigravity.ts';

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
  functionCall?: { name: string; args: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
  thought?: boolean;
}

interface GeminiChunk {
  response?: {
    candidates?: { content?: { parts?: GeminiPart[] }; finishReason?: string }[];
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
  };
  candidates?: { content?: { parts?: GeminiPart[] }; finishReason?: string }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
  remainingCredits?: { creditType: string; creditAmount: number }[];
  error?: { code?: number; status?: string; message?: string };
}

export async function* streamAntigravity(
  req: CoreRequest,
  upstreamModel: string,
  account: Account,
): AsyncGenerator<ProviderEvent> {
  const creds = account.credentials as Extract<Account['credentials'], { kind: 'antigravity' }>;
  const accessToken = await getValidAccessToken(creds);
  const projectId = account.providerData?.projectId;

  const envelope = {
    project: projectId ?? '',
    model: upstreamModel,
    userAgent: 'antigravity',
    requestType: 'agent',
    requestId: `agent/${Date.now()}/${randomBytes(4).toString('hex')}`,
    request: {
      contents: toGeminiContents(req.messages),
      ...(req.system ? { systemInstruction: { parts: [{ text: req.system }] } } : {}),
      generationConfig: {
        ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
        ...(req.topP !== undefined ? { topP: req.topP } : {}),
        ...(req.maxTokens !== undefined ? { maxOutputTokens: req.maxTokens } : {}),
        topK: 40,
      },
      ...toGeminiTools(req.tools),
    },
  };

  let res: Response | undefined;
  let lastError: unknown;
  for (const base of ANTIGRAVITY_BASES) {
    try {
      const candidateRes = await fetch(`${base}/v1internal:streamGenerateContent?alt=sse`, {
        method: 'POST',
        headers: contentHeaders(accessToken),
        body: JSON.stringify(envelope),
      });
      if (candidateRes.ok) {
        res = candidateRes;
        break;
      }
      const text = await candidateRes.text();
      lastError = classifyAntigravityError(candidateRes.status, text);
      // If 429 or 5xx/404, try the next base before giving up
      if (candidateRes.status === 429 || candidateRes.status === 404 || candidateRes.status >= 500) {
        continue;
      }
      // For other client errors (e.g. 400 Bad Request, 401 Unauthorized), stop retrying
      res = candidateRes;
      throw lastError;
    } catch (err) {
      lastError = err;
      if (err instanceof ProviderError && (err.kind === 'auth' || err.kind === 'upstream')) {
        throw err;
      }
    }
  }
  if (!res || !res.ok) {
    if (lastError instanceof ProviderError) throw lastError;
    throw new ProviderError('upstream', `Antigravity unreachable: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
  }
  if (!res.body) throw new ProviderError('upstream', 'Antigravity returned an empty response body.');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let sseBuffer = '';
  let finishReason: 'stop' | 'tool_use' | 'length' = 'stop';
  let sawToolUse = false;
  let finished = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      sseBuffer += decoder.decode(value, { stream: true });
      let newlineIdx: number;
      while ((newlineIdx = sseBuffer.indexOf('\n')) >= 0) {
        const line = sseBuffer.slice(0, newlineIdx).replace(/\r$/, '');
        sseBuffer = sseBuffer.slice(newlineIdx + 1);
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (!data || data === '[DONE]') continue;
        const chunk = parseJsonSafe(data);
        if (!chunk) continue;
        for (const ev of geminiChunkToEvents(chunk)) {
          if (ev.type === 'finish') {
            finishReason = ev.reason === 'tool_use' ? 'tool_use' : ev.reason === 'length' ? 'length' : finishReason;
            if (ev.reason === 'tool_use') sawToolUse = true;
            continue; // finish emitted once at the end
          }
          if (ev.type === 'tool_start') sawToolUse = true;
          yield ev;
        }
      }
    }
  } finally {
    void reader.cancel().catch(() => {});
  }

  if (!finished) {
    yield { type: 'finish', reason: sawToolUse ? 'tool_use' : finishReason };
    finished = true;
  }
}

/** Convert one upstream SSE data chunk into provider events. Throws typed errors for quota conditions. */
export function geminiChunkToEvents(chunk: GeminiChunk): ProviderEvent[] {
  const events: ProviderEvent[] = [];

  for (const credit of chunk.remainingCredits ?? []) {
    events.push({ type: 'credits', creditType: credit.creditType, amount: credit.creditAmount });
  }

  if (chunk.error) {
    const { code, status, message } = chunk.error;
    throw classifyAntigravityError(code ?? 500, JSON.stringify(chunk.error), status);
  }

  const candidate = (chunk.response ?? chunk).candidates?.[0];
  const usage = (chunk.response ?? chunk).usageMetadata;
  if (usage && (usage.promptTokenCount !== undefined || usage.candidatesTokenCount !== undefined)) {
    events.push({
      type: 'usage',
      inputTokens: usage.promptTokenCount,
      outputTokens: usage.candidatesTokenCount,
    });
  }

  let chunkFinish: 'stop' | 'tool_use' | 'length' | undefined;
  if (candidate?.finishReason) {
    chunkFinish =
      candidate.finishReason === 'MAX_TOKENS'
        ? 'length'
        : candidate.content?.parts?.some((p) => p.functionCall)
          ? 'tool_use'
          : 'stop';
  }

  for (const part of candidate?.content?.parts ?? []) {
    if (part.functionCall?.name) {
      const id = `call_${randomBytes(8).toString('hex')}`;
      events.push({ type: 'tool_start', id, name: part.functionCall.name });
      events.push({ type: 'tool_delta', id, argsDelta: JSON.stringify(part.functionCall.args ?? {}) });
      events.push({ type: 'tool_end', id });
    } else if (typeof part.text === 'string' && !part.thought) {
      events.push({ type: 'text', text: part.text });
    }
  }

  if (chunkFinish) events.push({ type: 'finish', reason: chunkFinish });
  return events;
}

export function classifyAntigravityError(status: number, body: string, grpcStatus?: string): ProviderError {
  const lower = body.toLowerCase();
  const quotaExhausted =
    grpcStatus === 'RESOURCE_EXHAUSTED' ||
    lower.includes('resource_exhausted') ||
    lower.includes('resource has been exhausted') ||
    lower.includes('quota exhausted') ||
    lower.includes('quota_exhausted') ||
    lower.includes('enable overages') ||
    lower.includes('individual quota');
  const creditsExhausted =
    lower.includes('insufficient credit') || lower.includes('google_one_ai') || lower.includes('g1_credits');
  if (quotaExhausted || creditsExhausted) {
    // "Resets in XXh" style hints arrive in the message; parse what we can.
    const hoursMatch = /resets? in (\d+)\s*h/i.exec(body);
    const cooldownMs = hoursMatch ? Number(hoursMatch[1]) * 3600_000 : creditsExhausted ? 3600_000 : 15 * 60_000;
    return new ProviderError('quota', `Antigravity quota: ${body.slice(0, 300)}`, status, cooldownMs);
  }
  if (status === 429) {
    return new ProviderError('rate_limit', `Antigravity rate limited: ${body.slice(0, 300)}`, 429, 60_000);
  }
  if (status === 401 || status === 403) {
    return new ProviderError('auth', `Antigravity auth error (${status}): ${body.slice(0, 300)}`, status);
  }
  return new ProviderError('upstream', `Antigravity error (${status}): ${body.slice(0, 300)}`, status);
}

// ---- request building ----

function toGeminiContents(messages: CoreRequest['messages']): { role: 'user' | 'model'; parts: GeminiPart[] }[] {
  const contents: { role: 'user' | 'model'; parts: GeminiPart[] }[] = [];
  for (const msg of messages) {
    const parts: GeminiPart[] = [];
    for (const block of msg.content) {
      if (block.type === 'text') parts.push({ text: block.text });
      else if (block.type === 'image') parts.push({ inlineData: { mimeType: block.mediaType, data: block.base64 } });
      else if (block.type === 'tool_use') parts.push({ functionCall: { name: block.name, args: normalizeArgs(block.input) } });
      else if (block.type === 'tool_result') parts.push({ functionResponse: { name: block.toolUseId, response: { result: block.content } } });
    }
    if (parts.length === 0) parts.push({ text: '' });
    contents.push({ role: msg.role === 'assistant' ? 'model' : 'user', parts });
  }
  return contents;
}

function normalizeArgs(input: unknown): Record<string, unknown> {
  if (input && typeof input === 'object' && !Array.isArray(input)) return input as Record<string, unknown>;
  if (typeof input === 'string') {
    try {
      return JSON.parse(input) as Record<string, unknown>;
    } catch {
      return { value: input };
    }
  }
  return { value: input };
}

function toGeminiTools(tools?: CoreRequest['tools']): { tools?: unknown[]; toolConfig?: unknown } {
  if (!tools || tools.length === 0) return {};
  return {
    tools: [
      {
        functionDeclarations: tools.map((t) => ({
          name: t.name,
          description: t.description ?? '',
          parameters: t.parameters,
        })),
      },
    ],
    toolConfig: { functionCallingConfig: { mode: 'VALIDATED' } },
  };
}

function parseJsonSafe(text: string): GeminiChunk | undefined {
  try {
    return JSON.parse(text) as GeminiChunk;
  } catch {
    return undefined;
  }
}

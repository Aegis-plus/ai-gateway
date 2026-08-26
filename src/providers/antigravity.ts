// Antigravity provider adapter: converts the unified CoreRequest into the
// Cloud Code v1internal:streamGenerateContent envelope and parses the
// Gemini-shaped SSE response into ProviderEvents.

import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Account, CoreContent, CoreRequest, ProviderEvent } from '../types.ts';
import { ProviderError } from '../types.ts';
import { ANTIGRAVITY_BASES, contentHeaders, ensureProject, getValidAccessToken } from '../auth/antigravity.ts';

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
  functionCall?: { name: string; args: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
  thought?: boolean;
  thoughtSignature?: string;
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

function generateStableSessionId(messages: CoreRequest['messages']): string {
  for (const m of messages) {
    if (m.role === 'user') {
      for (const p of m.content) {
        if (p.type === 'text' && p.text && p.text.trim()) {
          const hash = createHash('sha256').update(p.text.trim()).digest();
          const value = hash.readBigInt64BE(0) & 0x7fffffffffffffffn;
          return `-${value.toString()}`;
        }
      }
    }
  }
  const buf = randomBytes(8);
  const n = buf.readBigInt64BE(0) & 0x7fffffffffffffffn;
  return `-${n.toString()}`;
}

export async function* streamAntigravity(
  req: CoreRequest,
  upstreamModel: string,
  account: Account,
): AsyncGenerator<ProviderEvent> {
  const creds = account.credentials as Extract<Account['credentials'], { kind: 'antigravity' }>;
  const accessToken = await getValidAccessToken(creds);
  let projectId = account.providerData?.projectId;

  if (!projectId) {
    try {
      projectId = await ensureProject(accessToken);
      if (projectId) {
        account.providerData = { ...account.providerData, projectId };
      }
    } catch {}
  }

  const isImageModel = upstreamModel.includes('image');
  const isClaude = upstreamModel.toLowerCase().includes('claude');
  const sessionId = isImageModel ? undefined : generateStableSessionId(req.messages);

  const generationConfig: Record<string, unknown> = {
    ...(isClaude ? {} : { topK: 40 }),
    ...(req.temperature !== undefined ? { temperature: req.temperature } : {}),
    ...(req.topP !== undefined ? { topP: req.topP } : {}),
    ...(isImageModel ? { responseModalities: ['TEXT', 'IMAGE'] } : {}),
    ...(req.imageConfig?.aspectRatio || req.imageConfig?.imageSize
      ? {
          imageConfig: {
            ...(req.imageConfig.aspectRatio ? { aspectRatio: req.imageConfig.aspectRatio } : {}),
            ...(req.imageConfig.imageSize ? { imageSize: req.imageConfig.imageSize } : {}),
          },
        }
      : {}),
  };
  // CLIProxyAPI: only include maxOutputTokens for Claude models on Cloud Code Pa
  if (isClaude && req.maxTokens !== undefined) {
    generationConfig.maxOutputTokens = Math.min(req.maxTokens, 64000);
  }

  const toolsData = toGeminiTools(req.tools);
  const hasTools = Boolean(toolsData.tools && toolsData.tools.length > 0);
  const toolConfig = hasTools
    ? (isClaude ? { functionCallingConfig: { mode: 'VALIDATED' } } : toolsData.toolConfig)
    : undefined;

  const systemText = req.system ? req.system.trim() : '';

  const requestPayload: Record<string, unknown> = {
    contents: toGeminiContents(req.messages),
    ...(sessionId ? { sessionId } : {}),
    ...(systemText ? { systemInstruction: { role: 'user', parts: [{ text: systemText }] } } : {}),
    generationConfig,
    ...(toolConfig ? { toolConfig } : {}),
    ...(hasTools ? { tools: toolsData.tools } : {}),
  };

  const envelope: Record<string, unknown> = {
    model: upstreamModel,
    userAgent: 'antigravity',
    requestType: isImageModel ? 'image_gen' : 'agent',
    requestId: isImageModel ? `image_gen/${Date.now()}/${randomUUID()}/12` : `agent-${randomUUID()}`,
    request: requestPayload,
  };

  if (projectId) {
    envelope.project = projectId;
  }

  let res: Response | undefined;
  let lastError: unknown;

  // Build model fallback chain for 404 recovery
  const candidateModels = [upstreamModel];
  if (upstreamModel.includes('claude-sonnet')) {
    candidateModels.push('claude-sonnet-4-6', 'claude-opus-4-6-thinking');
  } else if (upstreamModel.includes('claude-opus')) {
    candidateModels.push('claude-opus-4-6-thinking', 'claude-sonnet-4-6');
  } else if (upstreamModel.startsWith('gemini-3.7')) {
    candidateModels.push('gemini-3.7-flash-tiered', 'gemini-3.6-flash-high', 'gemini-3-flash');
  } else if (upstreamModel.startsWith('gemini-3.6')) {
    candidateModels.push('gemini-3.6-flash-high', 'gemini-3-flash');
  } else if (upstreamModel.startsWith('gemini-3.5')) {
    candidateModels.push('gemini-3.5-flash-low', 'gemini-3-flash');
  } else if (upstreamModel.startsWith('gemini-3.1-pro')) {
    candidateModels.push('gemini-3.1-pro-high', 'gemini-pro-agent');
  }

  const uniqueCandidateModels = Array.from(new Set(candidateModels));

  for (const modelToTry of uniqueCandidateModels) {
    envelope.model = modelToTry;

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

        // If 404, check if re-onboarding project helps
        if (candidateRes.status === 404 && !projectId) {
          try {
            const newPid = await ensureProject(accessToken);
            if (newPid) {
              projectId = newPid;
              account.providerData = { ...account.providerData, projectId: newPid };
              envelope.project = newPid;
            }
          } catch {}
        }

        // Try the next base URL or model candidate on 404, 429, or 5xx
        if (candidateRes.status === 404 || candidateRes.status === 429 || candidateRes.status >= 500) {
          continue;
        }

        res = candidateRes;
        break;
      } catch (err) {
        lastError = err;
      }
    }
    if (res && res.ok) break;
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
    const inlineData = part.inlineData || (part as any).inline_data;
    if (inlineData?.data) {
      const mimeType = inlineData.mimeType || inlineData.mime_type || 'image/png';
      const base64 = String(inlineData.data);
      events.push({ type: 'image', mediaType: mimeType, base64 });
      events.push({ type: 'text', text: `\n\n![Generated Image](data:${mimeType};base64,${base64})\n\n` });
    } else if (part.functionCall?.name) {
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

export function toGeminiContents(messages: CoreRequest['messages']): { role: 'user' | 'model'; parts: GeminiPart[] }[] {
  // Map tool call IDs to function names across the entire conversation
  const toolIdToName = new Map<string, string>();
  for (const msg of messages) {
    for (const block of msg.content) {
      if (block.type === 'tool_use') {
        toolIdToName.set(block.id, block.name);
      }
    }
  }

  const contents: { role: 'user' | 'model'; parts: GeminiPart[] }[] = [];
  for (const msg of messages) {
    const parts: GeminiPart[] = [];
    for (const block of msg.content) {
      if (block.type === 'text') {
        const trimmed = block.text ? block.text.trim() : '';
        if (trimmed) {
          parts.push({ text: block.text });
        }
      } else if (block.type === 'image') {
        parts.push({ inlineData: { mimeType: block.mediaType, data: block.base64 } });
      } else if (block.type === 'tool_use') {
        parts.push({
          functionCall: {
            name: block.name,
            args: normalizeArgs(block.input),
          },
          thoughtSignature: 'skip_thought_signature_validator',
        });
      } else if (block.type === 'tool_result') {
        const functionName = toolIdToName.get(block.toolUseId) || block.toolUseId;
        const responseData = typeof block.content === 'string'
          ? safeParseOrWrap(block.content)
          : { result: block.content };
        parts.push({
          functionResponse: {
            name: functionName,
            response: responseData,
          },
        });
      }
    }
    if (parts.length > 0) {
      contents.push({ role: msg.role === 'assistant' ? 'model' : 'user', parts });
    }
  }

  if (contents.length === 0) {
    contents.push({ role: 'user', parts: [{ text: 'Hello' }] });
  }
  return contents;
}

function safeParseOrWrap(content: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return { result: parsed };
  } catch {
    return { result: content };
  }
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

export function toGeminiTools(tools?: CoreRequest['tools']): { tools?: unknown[]; toolConfig?: unknown } {
  if (!tools || tools.length === 0) return {};
  return {
    tools: [
      {
        functionDeclarations: tools.map((t) => ({
          name: t.name,
          description: t.description ?? '',
          parameters: cleanGeminiSchema(t.parameters),
        })),
      },
    ],
    toolConfig: { functionCallingConfig: { mode: 'VALIDATED' } },
  };
}

/**
 * Sanitizes and normalizes standard JSON Schema (from OpenAI/Anthropic/agent frameworks)
 * into Google Gemini protobuf Schema format.
 *
 * Handles:
 * - Union type lists like `type: ["string", "null"]` -> `type: "STRING", nullable: true`
 * - Unsupported proto fields ($schema, additionalProperties, title, $defs)
 * - Array items requirement (Gemini requires `items` for ARRAY)
 * - Property filtering on `required` (Gemini rejects required keys not present in properties)
 * - Enum stringification
 */
export function cleanGeminiSchema(schema: unknown): Record<string, unknown> {
  if (!schema || typeof schema !== 'object' || Array.isArray(schema)) {
    return { type: 'OBJECT', properties: {} };
  }

  const cleaned = cleanSchemaNode(schema as Record<string, unknown>);
  if (cleaned.type !== 'OBJECT') {
    return { type: 'OBJECT', properties: { input: cleaned } };
  }
  if (!cleaned.properties) {
    cleaned.properties = {};
  }
  return cleaned;
}

function cleanSchemaNode(node: Record<string, unknown>): Record<string, unknown> {
  if (!node || typeof node !== 'object' || Array.isArray(node)) {
    return { type: 'STRING' };
  }

  const out: Record<string, unknown> = {};

  // 1. Resolve type and nullable
  let nullable = node.nullable === true;
  let rawType: unknown = node.type;

  // JSON Schema allows type as array, e.g. ["string", "null"] or ["object", "string"]
  if (Array.isArray(rawType)) {
    const nonNullTypes = rawType.filter((t) => t !== 'null' && typeof t === 'string');
    if (rawType.includes('null')) {
      nullable = true;
    }
    rawType = nonNullTypes[0] ?? 'string';
  }

  let typeStr: string | undefined = typeof rawType === 'string' ? rawType.toUpperCase() : undefined;

  // Infer missing type
  if (!typeStr) {
    if (node.properties && typeof node.properties === 'object') typeStr = 'OBJECT';
    else if (node.items) typeStr = 'ARRAY';
    else if (Array.isArray(node.enum) && node.enum.length > 0) typeStr = 'STRING';
    else if (node.anyOf || node.oneOf) {
      // Type can be inferred from variants
    } else {
      typeStr = 'OBJECT';
    }
  }

  // Normalize typeStr to Gemini Proto Schema Type enum
  if (typeStr) {
    switch (typeStr) {
      case 'STRING':
      case 'NUMBER':
      case 'INTEGER':
      case 'BOOLEAN':
      case 'ARRAY':
      case 'OBJECT':
        out.type = typeStr;
        break;
      case 'INT':
        out.type = 'INTEGER';
        break;
      case 'FLOAT':
      case 'DOUBLE':
        out.type = 'NUMBER';
        break;
      case 'BOOL':
        out.type = 'BOOLEAN';
        break;
      case 'DICT':
      case 'MAP':
        out.type = 'OBJECT';
        break;
      case 'LIST':
        out.type = 'ARRAY';
        break;
      default:
        out.type = 'STRING';
    }
  }

  if (nullable) {
    out.nullable = true;
  }

  if (typeof node.description === 'string' && node.description) {
    out.description = node.description;
  }

  if (typeof node.format === 'string' && node.format) {
    out.format = node.format;
  }

  // 2. Handle enum (Gemini proto requires repeated string)
  if (Array.isArray(node.enum) && node.enum.length > 0) {
    out.enum = node.enum.map((v) => String(v));
    if (!out.type) out.type = 'STRING';
  } else if (node.const !== undefined) {
    out.enum = [String(node.const)];
    if (!out.type) out.type = 'STRING';
  }

  // 3. Handle object properties & required
  if (out.type === 'OBJECT' || node.properties) {
    if (!out.type) out.type = 'OBJECT';
    const props: Record<string, unknown> = {};
    if (node.properties && typeof node.properties === 'object' && !Array.isArray(node.properties)) {
      for (const [key, propSchema] of Object.entries(node.properties as Record<string, unknown>)) {
        if (propSchema && typeof propSchema === 'object') {
          props[key] = cleanSchemaNode(propSchema as Record<string, unknown>);
        }
      }
    }
    out.properties = props;

    // Filter required keys so only defined properties are included (Gemini 400s on unknown required keys)
    if (Array.isArray(node.required) && node.required.length > 0) {
      const validReqs = node.required.filter((k) => typeof k === 'string' && k in props);
      if (validReqs.length > 0) {
        out.required = validReqs;
      }
    }
  }

  // 4. Handle array items (Gemini requires items for ARRAY)
  if (out.type === 'ARRAY' || node.items) {
    if (!out.type) out.type = 'ARRAY';
    if (node.items) {
      if (Array.isArray(node.items)) {
        out.items = node.items.length > 0
          ? cleanSchemaNode(node.items[0] as Record<string, unknown>)
          : { type: 'STRING' };
      } else if (typeof node.items === 'object') {
        out.items = cleanSchemaNode(node.items as Record<string, unknown>);
      } else {
        out.items = { type: 'STRING' };
      }
    } else {
      out.items = { type: 'STRING' };
    }
  }

  // 5. Handle anyOf / oneOf
  const variants = Array.isArray(node.anyOf) ? node.anyOf : Array.isArray(node.oneOf) ? node.oneOf : undefined;
  if (variants && variants.length > 0) {
    const cleanedVariants: Record<string, unknown>[] = [];
    for (const v of variants) {
      if (v && typeof v === 'object') {
        const cleaned = cleanSchemaNode(v as Record<string, unknown>);
        if (cleaned.type === 'STRING' && (v as any).type === 'null') {
          out.nullable = true;
        } else {
          cleanedVariants.push(cleaned);
        }
      }
    }
    if (cleanedVariants.length > 0) {
      out.anyOf = cleanedVariants;
    }
  }

  return out;
}

function parseJsonSafe(text: string): GeminiChunk | undefined {
  try {
    return JSON.parse(text) as GeminiChunk;
  } catch {
    return undefined;
  }
}

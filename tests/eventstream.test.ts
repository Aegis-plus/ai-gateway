import { describe, expect, it } from 'vitest';
import { AwsEventStreamParser, buildFrame } from '../src/providers/eventstream.ts';
import { kiroPayloadToEvents, classifyKiroError } from '../src/providers/kiro.ts';
import { geminiChunkToEvents, classifyAntigravityError } from '../src/providers/antigravity.ts';
import { ProviderError } from '../src/types.ts';

describe('AwsEventStreamParser', () => {
  it('parses a single complete frame', () => {
    const parser = new AwsEventStreamParser();
    const payload = Buffer.from(JSON.stringify({ assistantResponseEvent: { content: { text: 'hello' } } }));
    const events = parser.push(buildFrame(payload, { ':message-type': 'event' }));
    expect(events).toHaveLength(1);
    expect(events[0]!.headers[':message-type']).toBe('event');
    expect(JSON.parse(events[0]!.payload.toString('utf8')).assistantResponseEvent.content.text).toBe('hello');
  });

  it('reassembles frames split across arbitrary chunk boundaries', () => {
    const parser = new AwsEventStreamParser();
    const frames = Buffer.concat([
      buildFrame(Buffer.from('{"content":{"text":"a"}}')),
      buildFrame(Buffer.from('{"content":{"text":"b"}}'), { 'x-custom': 'v' }),
      buildFrame(Buffer.from('{"content":{"text":"c"}}')),
    ]);
    // Feed one byte at a time.
    const collected: string[] = [];
    for (let i = 0; i < frames.length; i++) {
      for (const ev of parser.push(frames.subarray(i, i + 1))) {
        collected.push(JSON.parse(ev.payload.toString('utf8')).content.text);
      }
    }
    expect(collected).toEqual(['a', 'b', 'c']);
  });

  it('rejects bogus framing', () => {
    const parser = new AwsEventStreamParser();
    const bad = Buffer.alloc(16);
    bad.writeUInt32BE(8, 0); // total len below minimum
    expect(() => parser.push(bad)).toThrow();
  });
});

describe('kiroPayloadToEvents', () => {
  it('extracts text from assistantResponseEvent', () => {
    const evs = kiroPayloadToEvents({ assistantResponseEvent: { content: { text: 'hi' } } });
    expect(evs).toEqual([{ type: 'text', text: 'hi' }]);
  });

  it('extracts plain string content', () => {
    expect(kiroPayloadToEvents({ content: 'plain' })).toEqual([{ type: 'text', text: 'plain' }]);
  });

  it('maps toolUseEvent into start/delta/end', () => {
    const evs = kiroPayloadToEvents({ toolUseEvent: { toolUseId: 't1', name: 'read_file', input: { path: '/x' } } });
    expect(evs.map((e) => e.type)).toEqual(['tool_start', 'tool_delta', 'tool_end']);
    const delta = evs[1] as { type: string; argsDelta: string };
    expect(JSON.parse(delta.argsDelta)).toEqual({ path: '/x' });
  });

  it('ignores unrelated events', () => {
    expect(kiroPayloadToEvents({ codeReferenceEvent: {} })).toEqual([]);
  });

  it('throws on errorEvent', () => {
    expect(() => kiroPayloadToEvents({ errorEvent: { message: 'boom' } })).toThrow(/boom/);
  });
});

describe('classifyKiroError', () => {
  it('429 with quota wording is a hard quota error', () => {
    const err = classifyKiroError(429, 'You have exceeded your usage limit');
    expect(err.kind).toBe('quota');
  });
  it('429 plain is a soft rate limit with cooldown', () => {
    const err = classifyKiroError(429, 'too many requests');
    expect(err.kind).toBe('rate_limit');
    expect(err.cooldownMs).toBe(60_000);
  });
  it('402 is quota', () => {
    expect(classifyKiroError(402, 'overage').kind).toBe('quota');
  });
  it('403 is auth', () => {
    expect(classifyKiroError(403, 'denied').kind).toBe('auth');
  });
});

describe('geminiChunkToEvents', () => {
  it('extracts text parts and skips thinking parts', () => {
    const evs = geminiChunkToEvents({
      candidates: [{ content: { parts: [{ text: 'vis' }, { text: 'internal', thought: true }] } }],
    });
    expect(evs).toEqual([{ type: 'text', text: 'vis' }]);
  });

  it('maps functionCall to tool events', () => {
    const evs = geminiChunkToEvents({
      candidates: [{ content: { parts: [{ functionCall: { name: 'get_weather', args: { city: 'Oslo' } } }] }, finishReason: 'STOP' }],
    });
    expect(evs.map((e) => e.type)).toEqual(['tool_start', 'tool_delta', 'tool_end', 'finish']);
    expect(evs[3]).toMatchObject({ type: 'finish', reason: 'tool_use' });
  });

  it('passes through usage and remaining credits', () => {
    const evs = geminiChunkToEvents({
      candidates: [{ content: { parts: [{ text: 'x' }] } }],
      usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 5 },
      remainingCredits: [{ creditType: 'GOOGLE_ONE_AI', creditAmount: 9900 }],
    });
    expect(evs).toContainEqual({ type: 'usage', inputTokens: 10, outputTokens: 5 });
    expect(evs).toContainEqual({ type: 'credits', creditType: 'GOOGLE_ONE_AI', amount: 9900 });
  });

  it('handles the response-wrapped chunk variant', () => {
    const evs = geminiChunkToEvents({
      response: { candidates: [{ content: { parts: [{ text: 'wrapped' }] } }] },
    });
    expect(evs).toEqual([{ type: 'text', text: 'wrapped' }]);
  });

  it('maps MAX_TOKENS to length', () => {
    const evs = geminiChunkToEvents({ candidates: [{ finishReason: 'MAX_TOKENS' }] });
    expect(evs).toContainEqual({ type: 'finish', reason: 'length' });
  });

  it('throws typed quota errors for exhausted buckets', () => {
    expect(() =>
      geminiChunkToEvents({ error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'Quota exhausted. Resets in 2h' } }),
    ).toThrow(ProviderError);
    try {
      geminiChunkToEvents({ error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'Quota exhausted. Resets in 2h' } });
    } catch (err) {
      const pe = err as InstanceType<typeof ProviderError>;
      expect(pe.kind).toBe('quota');
      expect(pe.cooldownMs).toBe(2 * 3600_000);
    }
  });
});

describe('classifyAntigravityError', () => {
  it('classifies credits exhaustion with 1h cooldown', () => {
    const err = classifyAntigravityError(429, 'insufficient GOOGLE_ONE_AI credits');
    expect(err.kind).toBe('quota');
    expect(err.cooldownMs).toBe(3600_000);
  });
  it('plain 429 is a soft rate limit', () => {
    expect(classifyAntigravityError(429, 'slow down').kind).toBe('rate_limit');
  });
});

// Aggregates a provider event stream into a single completion result,
// used by the non-streaming paths of both API formats.

import type { ProviderEvent } from './types.ts';

export interface AggregatedToolCall {
  id: string;
  name: string;
  argsRaw: string;
}

export interface Aggregated {
  text: string;
  toolCalls: AggregatedToolCall[];
  usage: { inputTokens?: number; outputTokens?: number };
  finish: 'stop' | 'tool_use' | 'length';
  credits: { creditType: string; amount: number }[];
}

export class EventAggregator {
  private agg: Aggregated = { text: '', toolCalls: [], usage: {}, finish: 'stop', credits: [] };
  private openTools = new Map<string, AggregatedToolCall>();

  push(ev: ProviderEvent): void {
    switch (ev.type) {
      case 'text':
        this.agg.text += ev.text;
        break;
      case 'tool_start':
        this.agg.toolCalls.push({ id: ev.id, name: ev.name, argsRaw: '' });
        this.openTools.set(ev.id, this.agg.toolCalls[this.agg.toolCalls.length - 1]!);
        this.agg.finish = 'tool_use';
        break;
      case 'tool_delta': {
        const call = this.openTools.get(ev.id);
        if (call) call.argsRaw += ev.argsDelta;
        break;
      }
      case 'tool_end':
        this.openTools.delete(ev.id);
        break;
      case 'usage':
        if (ev.inputTokens !== undefined) this.agg.usage.inputTokens = ev.inputTokens;
        if (ev.outputTokens !== undefined) this.agg.usage.outputTokens = ev.outputTokens;
        break;
      case 'credits':
        this.agg.credits.push({ creditType: ev.creditType, amount: ev.amount });
        break;
      case 'finish':
        // A tool_use finish from tool events wins over the provider's final word.
        if (!(this.agg.finish === 'tool_use' && ev.reason === 'stop')) this.agg.finish = ev.reason;
        break;
    }
  }

  result(): Aggregated {
    return this.agg;
  }
}

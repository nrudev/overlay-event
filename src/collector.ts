import { EventEmitter } from 'node:events';
import type { ChatMessage, CollectorStatus, MatchMode, Participant } from './types.js';

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ');
}

function matches(text: string, keyword: string, mode: MatchMode): boolean {
  const normText = normalize(text);
  const normKeyword = normalize(keyword);
  if (!normKeyword) return false;
  return mode === 'exact' ? normText === normKeyword : normText.includes(normKeyword);
}

export class Collector extends EventEmitter {
  private state: CollectorStatus['state'] = 'idle';
  private keyword: string | null = null;
  private matchMode: MatchMode = 'exact';
  private startedAt: number | null = null;
  private endsAt: number | null = null;
  private participants = new Map<string, Participant>();
  private manualNames: string[] = [];
  private error: string | null = null;
  private timer: NodeJS.Timeout | null = null;

  start(keyword: string, matchMode: MatchMode, durationSeconds: number | null): void {
    this.clearTimer();
    this.state = 'collecting';
    this.keyword = keyword;
    this.matchMode = matchMode;
    this.participants.clear();
    this.error = null;
    this.startedAt = Date.now();
    this.endsAt = durationSeconds ? this.startedAt + durationSeconds * 1000 : null;

    if (durationSeconds) {
      this.timer = setTimeout(() => this.stop(), durationSeconds * 1000);
    }

    this.emitUpdate();
  }

  ingest(messages: ChatMessage[]): void {
    if (this.state !== 'collecting' || !this.keyword) return;

    let changed = false;
    for (const msg of messages) {
      if (!msg.channelId) continue;
      if (this.participants.has(msg.channelId)) continue;
      if (!matches(msg.text, this.keyword, this.matchMode)) continue;

      this.participants.set(msg.channelId, {
        channelId: msg.channelId,
        displayName: msg.displayName,
        matchedAt: Date.now(),
        message: msg.text,
      });
      changed = true;
    }

    if (changed) this.emitUpdate();
  }

  stop(): void {
    if (this.state !== 'collecting') return;
    this.clearTimer();
    this.state = 'collected';
    this.emitUpdate();
  }

  addManualNames(rawNames: string[]): void {
    const collected = new Set(
      [...this.participants.values()].map((p) => normalize(p.displayName))
    );
    const existingManual = new Set(this.manualNames.map(normalize));

    for (const raw of rawNames) {
      const name = raw.trim();
      if (!name) continue;
      const key = normalize(name);
      if (collected.has(key) || existingManual.has(key)) continue;
      this.manualNames.push(name);
      existingManual.add(key);
    }

    this.emitUpdate();
  }

  clearManualNames(): void {
    this.manualNames = [];
    this.emitUpdate();
  }

  setError(message: string): void {
    this.error = message;
    this.emitUpdate();
  }

  reset(): void {
    this.clearTimer();
    this.state = 'idle';
    this.keyword = null;
    this.startedAt = null;
    this.endsAt = null;
    this.participants.clear();
    this.error = null;
    this.emitUpdate();
  }

  getFinalNames(): string[] {
    return [...[...this.participants.values()].map((p) => p.displayName), ...this.manualNames];
  }

  getStatus(): CollectorStatus {
    return {
      state: this.state,
      keyword: this.keyword,
      matchMode: this.matchMode,
      startedAt: this.startedAt,
      endsAt: this.endsAt,
      participants: [...this.participants.values()],
      manualNames: this.manualNames,
      error: this.error,
    };
  }

  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private emitUpdate(): void {
    this.emit('update', this.getStatus());
  }
}

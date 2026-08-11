export type MatchMode = 'exact' | 'contains';

export interface Participant {
  channelId: string;
  displayName: string;
  matchedAt: number;
  message: string;
}

export type CollectorState = 'idle' | 'collecting' | 'collected';

export interface CollectorStatus {
  state: CollectorState;
  keyword: string | null;
  matchMode: MatchMode;
  startedAt: number | null;
  endsAt: number | null;
  participants: Participant[];
  manualNames: string[];
  error: string | null;
}

export interface ChatMessage {
  channelId: string;
  displayName: string;
  text: string;
  publishedAt: string;
}

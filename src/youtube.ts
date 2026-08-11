import type { ChatMessage } from './types.js';

const API_BASE = 'https://www.googleapis.com/youtube/v3';

export function extractVideoId(input: string): string {
  const trimmed = input.trim();

  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtube\.com\/live\/|youtu\.be\/)([a-zA-Z0-9_-]{6,})/,
    /^([a-zA-Z0-9_-]{6,})$/,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match) return match[1];
  }

  throw new Error(`유튜브 영상 URL 또는 videoId를 인식할 수 없습니다: ${input}`);
}

export async function resolveLiveChatId(videoId: string, apiKey: string): Promise<string> {
  const url = new URL(`${API_BASE}/videos`);
  url.searchParams.set('part', 'liveStreamingDetails,snippet');
  url.searchParams.set('id', videoId);
  url.searchParams.set('key', apiKey);

  const res = await fetch(url);
  const body = await res.json();

  if (!res.ok) {
    throw new Error(`YouTube API 오류: ${body?.error?.message ?? res.statusText}`);
  }

  const item = body.items?.[0];
  if (!item) {
    throw new Error('해당 videoId의 영상을 찾을 수 없습니다.');
  }

  const liveChatId = item.liveStreamingDetails?.activeLiveChatId;
  if (!liveChatId) {
    throw new Error('현재 라이브 중이 아니거나 채팅이 활성화되지 않은 영상입니다.');
  }

  return liveChatId;
}

const MIN_POLL_INTERVAL_MS = 2000;

export class LiveChatPoller {
  private apiKey: string;
  private liveChatId: string;
  private nextPageToken: string | undefined;
  private stopped = false;
  private timer: NodeJS.Timeout | null = null;

  constructor(apiKey: string, liveChatId: string) {
    this.apiKey = apiKey;
    this.liveChatId = liveChatId;
  }

  start(onMessages: (messages: ChatMessage[]) => void, onError: (err: Error) => void): void {
    this.stopped = false;
    void this.pollOnce(onMessages, onError);
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
  }

  private async pollOnce(
    onMessages: (messages: ChatMessage[]) => void,
    onError: (err: Error) => void
  ): Promise<void> {
    if (this.stopped) return;

    try {
      const url = new URL(`${API_BASE}/liveChat/messages`);
      url.searchParams.set('liveChatId', this.liveChatId);
      url.searchParams.set('part', 'snippet,authorDetails');
      url.searchParams.set('key', this.apiKey);
      if (this.nextPageToken) url.searchParams.set('pageToken', this.nextPageToken);

      const res = await fetch(url);
      const body = await res.json();

      if (!res.ok) {
        throw new Error(`YouTube API 오류: ${body?.error?.message ?? res.statusText}`);
      }

      this.nextPageToken = body.nextPageToken;

      const messages: ChatMessage[] = (body.items ?? []).map((item: any) => ({
        channelId: item.authorDetails?.channelId ?? '',
        displayName: item.authorDetails?.displayName ?? '(알 수 없음)',
        text: item.snippet?.displayMessage ?? '',
        publishedAt: item.snippet?.publishedAt ?? '',
      }));

      if (messages.length > 0) onMessages(messages);

      const interval = Math.max(body.pollingIntervalMillis ?? MIN_POLL_INTERVAL_MS, MIN_POLL_INTERVAL_MS);
      if (!this.stopped) {
        this.timer = setTimeout(() => void this.pollOnce(onMessages, onError), interval);
      }
    } catch (err) {
      onError(err instanceof Error ? err : new Error(String(err)));
      if (!this.stopped) {
        this.timer = setTimeout(() => void this.pollOnce(onMessages, onError), MIN_POLL_INTERVAL_MS * 2);
      }
    }
  }
}

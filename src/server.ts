import 'dotenv/config';
import express from 'express';
import { createServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { Collector } from './collector.js';
import { RouletteAutomation } from './rouletteAutomation.js';
import { extractVideoId, resolveLiveChatId, LiveChatPoller } from './youtube.js';
import type { MatchMode } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.join(__dirname, '..', '.env');
const PORT = Number(process.env.PORT) || 5175;

// 대시보드 화면에서 붙여넣은 키를 즉시 반영하고 .env 파일에도 저장해서,
// 사용자가 직접 .env 파일을 만들거나 편집하지 않아도 되게 한다.
let apiKey: string | null = process.env.YOUTUBE_API_KEY || null;

function persistApiKeyToEnvFile(key: string): void {
  const existing = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf-8') : '';
  const lines = existing
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '' && !line.startsWith('YOUTUBE_API_KEY='));
  lines.push(`YOUTUBE_API_KEY=${key}`);
  fs.writeFileSync(ENV_PATH, lines.join('\n') + '\n', 'utf-8');
}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });

const collector = new Collector();
const roulette = new RouletteAutomation();

let poller: LiveChatPoller | null = null;
let connection: { videoId: string; liveChatId: string } | null = null;

function broadcast(type: string, payload: unknown): void {
  const data = JSON.stringify({ type, payload });
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(data);
  }
}

collector.on('update', (status) => broadcast('status', status));

wss.on('connection', (socket) => {
  socket.send(JSON.stringify({ type: 'status', payload: collector.getStatus() }));
  socket.send(JSON.stringify({ type: 'connection', payload: connection }));
});

function requireApiKey(res: express.Response): boolean {
  if (!apiKey) {
    res.status(500).json({ error: 'YouTube API 키가 설정되지 않았습니다. 위쪽 "API 키 설정"에서 먼저 저장하세요.' });
    return false;
  }
  return true;
}

app.get('/api/settings', (_req, res) => {
  res.json({ hasApiKey: Boolean(apiKey) });
});

app.post('/api/settings/api-key', (req, res) => {
  const { apiKey: newKey } = req.body as { apiKey: string };
  if (!newKey?.trim()) {
    res.status(400).json({ error: 'API 키를 입력하세요.' });
    return;
  }
  apiKey = newKey.trim();
  try {
    persistApiKeyToEnvFile(apiKey);
  } catch (err) {
    console.warn('.env 파일 저장에 실패했습니다 (이번 실행에는 계속 적용됩니다):', err);
  }
  res.json({ hasApiKey: true });
});

app.post('/api/connect', async (req, res) => {
  if (!requireApiKey(res)) return;
  try {
    const { videoUrl } = req.body as { videoUrl: string };
    const videoId = extractVideoId(videoUrl);
    const liveChatId = await resolveLiveChatId(videoId, apiKey!);

    poller?.stop();
    poller = new LiveChatPoller(apiKey!, liveChatId);
    poller.start(
      (messages) => collector.ingest(messages),
      (err) => collector.setError(err.message)
    );

    connection = { videoId, liveChatId };
    broadcast('connection', connection);
    res.json(connection);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.post('/api/collect/start', (req, res) => {
  if (!connection) {
    res.status(400).json({ error: '먼저 라이브 영상을 연결하세요.' });
    return;
  }
  const { keyword, matchMode, durationSeconds } = req.body as {
    keyword: string;
    matchMode: MatchMode;
    durationSeconds: number | null;
  };
  if (!keyword?.trim()) {
    res.status(400).json({ error: '키워드를 입력하세요.' });
    return;
  }
  collector.start(keyword, matchMode === 'contains' ? 'contains' : 'exact', durationSeconds ?? null);
  res.json(collector.getStatus());
});

app.post('/api/collect/stop', (_req, res) => {
  collector.stop();
  res.json(collector.getStatus());
});

app.post('/api/collect/manual', (req, res) => {
  const { names } = req.body as { names: string[] };
  collector.addManualNames(Array.isArray(names) ? names : []);
  res.json(collector.getStatus());
});

app.post('/api/collect/manual/clear', (_req, res) => {
  collector.clearManualNames();
  res.json(collector.getStatus());
});

app.post('/api/collect/reset', (_req, res) => {
  collector.reset();
  res.json(collector.getStatus());
});

app.post('/api/roulette/inject', async (_req, res) => {
  try {
    const names = collector.getFinalNames();
    await roulette.injectNames(names);
    res.json({ injected: names.length });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.post('/api/roulette/start', async (_req, res) => {
  try {
    await roulette.triggerStart();
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.get('/api/status', (_req, res) => {
  res.json({ status: collector.getStatus(), connection });
});

httpServer.listen(PORT, () => {
  console.log(`대시보드: http://localhost:${PORT}`);
  if (!apiKey) {
    console.warn('안내: YouTube API 키가 아직 없습니다. 대시보드 화면 상단 "API 키 설정"에서 입력하세요.');
  }
});

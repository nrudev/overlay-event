import express from 'express';
import { createServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { URL } from 'node:url';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Collector } from './collector.js';
import { extractVideoId, resolveLiveChatId, LiveChatPoller } from './youtube.js';
import type { MatchMode } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 5175;

const SESSION_HEADER = 'x-session-id';
const SESSION_IDLE_MS = 3 * 60 * 60 * 1000; // 3시간 미사용 세션 정리
const SESSION_SWEEP_INTERVAL_MS = 15 * 60 * 1000;

interface Session {
  collector: Collector;
  poller: LiveChatPoller | null;
  connection: { videoId: string; liveChatId: string } | null;
  sockets: Set<WebSocket>;
  lastActive: number;
}

// 로그인 없이 여러 사용자가 같은 서버를 동시에 쓰므로, 브라우저가 생성한 세션 ID별로
// 수집 상태와 라이브 연결을 완전히 분리해서 보관한다. API 키도 세션에 잠깐 머무를 뿐
// 디스크에는 저장하지 않는다(사용자 브라우저의 localStorage에만 저장됨).
const sessions = new Map<string, Session>();

function getOrCreateSession(sessionId: string): Session {
  let session = sessions.get(sessionId);
  if (!session) {
    session = {
      collector: new Collector(),
      poller: null,
      connection: null,
      sockets: new Set(),
      lastActive: Date.now(),
    };
    session.collector.on('update', (status) => {
      broadcast(session!, 'status', status);
    });
    sessions.set(sessionId, session);
  }
  session.lastActive = Date.now();
  return session;
}

function broadcast(session: Session, type: string, payload: unknown): void {
  const data = JSON.stringify({ type, payload });
  for (const socket of session.sockets) {
    if (socket.readyState === WebSocket.OPEN) socket.send(data);
  }
}

setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.lastActive > SESSION_IDLE_MS) {
      session.poller?.stop();
      for (const socket of session.sockets) socket.close();
      sessions.delete(id);
    }
  }
}, SESSION_SWEEP_INTERVAL_MS).unref();

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (socket, req) => {
  const sessionId = new URL(req.url ?? '', 'http://localhost').searchParams.get('session');
  if (!sessionId) {
    socket.close();
    return;
  }
  const session = getOrCreateSession(sessionId);
  session.sockets.add(socket);
  socket.on('close', () => session.sockets.delete(socket));

  socket.send(JSON.stringify({ type: 'status', payload: session.collector.getStatus() }));
  socket.send(JSON.stringify({ type: 'connection', payload: session.connection }));
});

function requireSession(req: express.Request, res: express.Response): Session | null {
  const sessionId = req.header(SESSION_HEADER);
  if (!sessionId) {
    res.status(400).json({ error: '세션 ID가 없습니다 (X-Session-Id 헤더 필요).' });
    return null;
  }
  return getOrCreateSession(sessionId);
}

app.post('/api/connect', async (req, res) => {
  const session = requireSession(req, res);
  if (!session) return;

  const { videoUrl, apiKey } = req.body as { videoUrl: string; apiKey: string };
  if (!apiKey?.trim()) {
    res.status(400).json({ error: 'YouTube API 키를 먼저 입력하세요.' });
    return;
  }

  try {
    const videoId = extractVideoId(videoUrl);
    const liveChatId = await resolveLiveChatId(videoId, apiKey);

    session.poller?.stop();
    session.poller = new LiveChatPoller(apiKey, liveChatId);
    session.poller.start(
      (messages) => session.collector.ingest(messages),
      (err) => session.collector.setError(err.message)
    );

    session.connection = { videoId, liveChatId };
    broadcast(session, 'connection', session.connection);
    res.json(session.connection);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.post('/api/collect/start', (req, res) => {
  const session = requireSession(req, res);
  if (!session) return;

  if (!session.connection) {
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
  session.collector.start(keyword, matchMode === 'contains' ? 'contains' : 'exact', durationSeconds ?? null);
  res.json(session.collector.getStatus());
});

app.post('/api/collect/stop', (req, res) => {
  const session = requireSession(req, res);
  if (!session) return;
  session.collector.stop();
  res.json(session.collector.getStatus());
});

app.post('/api/collect/manual', (req, res) => {
  const session = requireSession(req, res);
  if (!session) return;
  const { names } = req.body as { names: string[] };
  session.collector.addManualNames(Array.isArray(names) ? names : []);
  res.json(session.collector.getStatus());
});

app.post('/api/collect/manual/clear', (req, res) => {
  const session = requireSession(req, res);
  if (!session) return;
  session.collector.clearManualNames();
  res.json(session.collector.getStatus());
});

app.post('/api/collect/reset', (req, res) => {
  const session = requireSession(req, res);
  if (!session) return;
  session.collector.reset();
  res.json(session.collector.getStatus());
});

app.get('/api/status', (req, res) => {
  const session = requireSession(req, res);
  if (!session) return;
  res.json({ status: session.collector.getStatus(), connection: session.connection });
});

httpServer.listen(PORT, () => {
  console.log(`대시보드: http://localhost:${PORT}`);
});

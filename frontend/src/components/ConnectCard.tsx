import { useState } from 'react';
import { post } from '../lib/api';
import { getApiKey } from '../lib/storage';
import type { ConnectionInfo } from '../types';

export function ConnectCard({
  connection,
  onConnected,
  onError,
}: {
  connection: ConnectionInfo | null;
  onConnected: (connection: ConnectionInfo) => void;
  onError: (message: string) => void;
}) {
  const [videoUrl, setVideoUrl] = useState('');

  async function handleConnect() {
    const trimmed = videoUrl.trim();
    if (!trimmed) return;
    try {
      const data = await post<ConnectionInfo>('/api/connect', { videoUrl: trimmed, apiKey: getApiKey() });
      onConnected(data);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <section className="card">
      <h2>1. 라이브 연결</h2>
      <div className="row">
        <input
          type="text"
          placeholder="유튜브 라이브 URL 또는 videoId"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
        />
        <button onClick={handleConnect}>연결</button>
      </div>
      <p className="hint">{connection ? `연결됨: videoId=${connection.videoId}` : '아직 연결되지 않았습니다.'}</p>
    </section>
  );
}

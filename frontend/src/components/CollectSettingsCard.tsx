import { useEffect, useState } from 'react';
import { post } from '../lib/api';
import type { CollectorStatus, MatchMode } from '../types';

export function CollectSettingsCard({
  status,
  onError,
}: {
  status: CollectorStatus | null;
  onError: (message: string) => void;
}) {
  const [keyword, setKeyword] = useState('');
  const [matchMode, setMatchMode] = useState<MatchMode>('exact');
  const [minutes, setMinutes] = useState('');
  const [seconds, setSeconds] = useState('');

  useEffect(() => {
    if (status?.keyword) {
      setKeyword(status.keyword);
      setMatchMode(status.matchMode);
    }
  }, [status?.keyword, status?.matchMode]);

  async function handleStart() {
    const totalSeconds = (Number(minutes) || 0) * 60 + (Number(seconds) || 0);
    try {
      await post('/api/collect/start', {
        keyword: keyword.trim(),
        matchMode,
        durationSeconds: totalSeconds > 0 ? totalSeconds : null,
      });
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleStop() {
    try {
      await post('/api/collect/stop');
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleReset() {
    try {
      await post('/api/collect/reset');
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <section className="card">
      <h2>2. 수집 설정</h2>
      <div className="row">
        <input type="text" placeholder="예: 참여" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
        <select value={matchMode} onChange={(e) => setMatchMode(e.target.value as MatchMode)}>
          <option value="exact">정확히 일치</option>
          <option value="contains">포함</option>
        </select>
      </div>
      <div className="row">
        <label className="hint" htmlFor="durationMinutes">
          수집 시간
        </label>
        <input
          id="durationMinutes"
          type="number"
          placeholder="분"
          min={0}
          style={{ maxWidth: 80 }}
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
        />
        <input
          type="number"
          placeholder="초"
          min={0}
          max={59}
          style={{ maxWidth: 80 }}
          value={seconds}
          onChange={(e) => setSeconds(e.target.value)}
        />
        <span className="hint">(둘 다 비우면 수동 종료)</span>
      </div>
      <div className="row">
        <button onClick={handleStart}>수집 시작</button>
        <button onClick={handleStop}>수집 종료</button>
        <button className="danger" onClick={handleReset}>
          리셋
        </button>
      </div>
    </section>
  );
}

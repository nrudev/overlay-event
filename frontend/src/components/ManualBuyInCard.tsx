import { useState } from 'react';
import { post } from '../lib/api';
import type { CollectorStatus } from '../types';

export function ManualBuyInCard({
  status,
  onError,
}: {
  status: CollectorStatus | null;
  onError: (message: string) => void;
}) {
  const [names, setNames] = useState('');

  async function handleAdd() {
    const parsed = names
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!parsed.length) return;
    try {
      await post('/api/collect/manual', { names: parsed });
      setNames('');
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleClear() {
    try {
      await post('/api/collect/manual/clear');
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <section className="card">
      <h2>4. 자동 바이인</h2>
      <textarea
        rows={2}
        placeholder="쉼표(,)로 구분해서 추가 인원을 입력하세요"
        value={names}
        onChange={(e) => setNames(e.target.value)}
      />
      <div className="row">
        <button onClick={handleAdd}>추가</button>
        <button className="danger" onClick={handleClear}>
          자동 바이인 초기화
        </button>
      </div>
      <p className="hint">
        현재 자동 바이인 (리셋해도 유지됩니다): {status?.manualNames.length ? status.manualNames.join(', ') : '없음'}
      </p>
    </section>
  );
}

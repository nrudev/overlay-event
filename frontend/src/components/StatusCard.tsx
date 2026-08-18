import { STATE_LABELS } from '../lib/constants';
import type { CollectorStatus } from '../types';

export function StatusCard({ status, error }: { status: CollectorStatus | null; error: string }) {
  const participants = status?.participants ?? [];

  return (
    <section className="card">
      <h2>3. 실시간 현황</h2>
      <p>
        상태: <span className="badge">{status ? STATE_LABELS[status.state] : '-'}</span> · 매칭 인원:{' '}
        <span>{participants.length}</span>명
      </p>
      <p className="error">{error}</p>
      <ul className="list">
        {participants
          .slice()
          .reverse()
          .map((p) => (
            <li key={`${p.channelId}-${p.matchedAt}`}>
              <span>{p.displayName}</span>
              <span className="msg">{p.message}</span>
            </li>
          ))}
      </ul>
    </section>
  );
}

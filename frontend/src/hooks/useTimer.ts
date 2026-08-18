import { useEffect, useState } from 'react';
import { formatClock } from '../lib/format';
import type { CollectorStatus } from '../types';

export function useTimer(status: CollectorStatus | null) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (status?.state !== 'collecting') return;
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [status?.state, status?.endsAt, status?.startedAt]);

  if (!status || status.state !== 'collecting') return null;

  if (status.endsAt) {
    return { label: '남은 시간', display: formatClock((status.endsAt - now) / 1000) };
  }
  if (status.startedAt) {
    return { label: '경과 시간', display: formatClock((now - status.startedAt) / 1000) };
  }
  return null;
}

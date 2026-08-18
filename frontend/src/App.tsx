import { useEffect, useRef, useState } from 'react';
import { useLiveStatus } from './hooks/useLiveStatus';
import { useTimer } from './hooks/useTimer';
import { ALARM_SOUND_URL } from './lib/constants';
import { ApiKeyCard } from './components/ApiKeyCard';
import { ConnectCard } from './components/ConnectCard';
import { CollectSettingsCard } from './components/CollectSettingsCard';
import { TimerBox } from './components/TimerBox';
import { StatusCard } from './components/StatusCard';
import { ManualBuyInCard } from './components/ManualBuyInCard';
import { RouletteCard } from './components/RouletteCard';

export default function App() {
  const { status, connection, setConnection } = useLiveStatus();
  const timer = useTimer(status);
  const [error, setError] = useState('');
  const previousState = useRef(status?.state ?? null);

  useEffect(() => {
    if (status) setError(status.error ?? '');
  }, [status]);

  useEffect(() => {
    if (previousState.current === 'collecting' && status?.state === 'collected') {
      const audio = new Audio(ALARM_SOUND_URL);
      audio.play().catch((err) => console.error('알람 소리 재생 실패', err));
    }
    previousState.current = status?.state ?? null;
  }, [status?.state]);

  return (
    <>
      <h1>라이브 채팅 키워드 추첨 → 룰렛 연동</h1>
      <ApiKeyCard />
      <ConnectCard connection={connection} onConnected={setConnection} onError={setError} />
      <CollectSettingsCard status={status} onError={setError} />
      <TimerBox timer={timer} />
      <StatusCard status={status} error={error} />
      <ManualBuyInCard status={status} onError={setError} />
      <RouletteCard status={status} />
    </>
  );
}

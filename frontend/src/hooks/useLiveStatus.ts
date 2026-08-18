import { useEffect, useRef, useState } from 'react';
import { getSessionId } from '../lib/storage';
import type { CollectorStatus, ConnectionInfo } from '../types';

const RECONNECT_DELAY_MS = 2000;

export function useLiveStatus() {
  const [status, setStatus] = useState<CollectorStatus | null>(null);
  const [connection, setConnection] = useState<ConnectionInfo | null>(null);
  const connectionRef = useRef(connection);
  connectionRef.current = connection;

  useEffect(() => {
    let ws: WebSocket;
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let closedByCleanup = false;

    function connect() {
      ws = new WebSocket(`ws://${location.host}/ws?session=${getSessionId()}`);
      ws.onmessage = (event) => {
        const { type, payload } = JSON.parse(event.data);
        if (type === 'status') setStatus(payload);
        if (type === 'connection' && payload) setConnection(payload);
      };
      ws.onclose = () => {
        if (!closedByCleanup) reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
      };
    }
    connect();

    return () => {
      closedByCleanup = true;
      clearTimeout(reconnectTimer);
      ws.close();
    };
  }, []);

  return { status, connection, setConnection };
}

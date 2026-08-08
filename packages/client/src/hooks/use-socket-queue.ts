import { useEffect, useRef } from 'react';
import { useSocketContext } from '../context/socket-context';

export interface QueueChangePayload {
  reason: string;
  at: string;
}

export function useQueueSocket(onChange: () => void): boolean {
  const { socket, isConnected } = useSocketContext();
  const callbackRef = useRef(onChange);
  callbackRef.current = onChange;

  useEffect(() => {
    if (!socket) {
      return;
    }
    const handler = () => callbackRef.current();
    socket.on('queue:changed', handler);
    return () => {
      socket.off('queue:changed', handler);
    };
  }, [socket]);

  return isConnected;
}

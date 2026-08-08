import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { io, type Socket } from 'socket.io-client';
import { getToken } from '../lib/api-client';
import { useAuthContext } from './auth-context';

interface SocketContextValue {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextValue | undefined>(undefined);

export function SocketProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuthContext();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!isAuthenticated || !token) {
      setSocket(null);
      setIsConnected(false);
      return;
    }

    const instance = io('/', {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    instance.on('connect', () => setIsConnected(true));
    instance.on('disconnect', () => setIsConnected(false));

    setSocket(instance);

    return () => {
      instance.disconnect();
      setSocket(null);
      setIsConnected(false);
    };
  }, [isAuthenticated]);

  const value = useMemo(() => ({ socket, isConnected }), [socket, isConnected]);

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocketContext(): SocketContextValue {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocketContext must be used within a SocketProvider');
  }
  return context;
}

import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

const SOCKET_ORIGINS = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
  : ['http://localhost:5173'];

export type QueueChangeReason =
  | 'visit-registered'
  | 'vitals-updated'
  | 'consultation-updated'
  | 'visit-billed'
  | 'invoice-paid'
  | 'lab-order-created'
  | 'lab-order-resolved';

interface AuthedSocket extends Socket {
  user?: { userId: string; role: string };
}

@WebSocketGateway({ cors: { origin: SOCKET_ORIGINS } })
export class QueueGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(QueueGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private readonly jwtService: JwtService) {}

  async handleConnection(client: AuthedSocket): Promise<void> {
    try {
      const token =
        (client.handshake.auth?.token as string | undefined) ??
        (client.handshake.headers?.authorization as string | undefined)?.replace(/^Bearer\s+/i, '');

      const payload = await this.jwtService.verifyAsync<{ sub: string; role: string }>(token ?? '');
      client.user = { userId: payload.sub, role: payload.role };
    } catch {
      this.logger.warn(`Rejecting socket connection from ${client.id}: invalid token`);
      client.disconnect(true);
    }
  }

  handleDisconnect(): void {
    // no-op
  }

  broadcastQueueChanged(reason: QueueChangeReason): void {
    this.server?.emit('queue:changed', { reason, at: new Date().toISOString() });
  }
}

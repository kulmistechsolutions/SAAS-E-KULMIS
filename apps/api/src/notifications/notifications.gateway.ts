import {
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server } from "socket.io";
import { Injectable, Logger } from "@nestjs/common";

@Injectable()
@WebSocketGateway({ cors: { origin: "*" }, namespace: "/notifications" })
export class NotificationsGateway {
  private readonly logger = new Logger(NotificationsGateway.name);

  @WebSocketServer()
  server!: Server;

  emitToSchool(schoolId: string, event: string, payload: unknown) {
    if (!this.server) return;
    this.server.to(`school:${schoolId}`).emit(event, payload);
    this.logger.debug(`Emitted ${event} to school:${schoolId}`);
  }

  handleConnection(client: { join: (room: string) => void; handshake: { query: Record<string, string> } }) {
    const schoolId = client.handshake.query.schoolId;
    if (schoolId) client.join(`school:${schoolId}`);
  }
}

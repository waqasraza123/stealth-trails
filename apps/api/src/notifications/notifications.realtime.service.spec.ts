import { createServer, type Server } from "node:http";
import { once } from "node:events";
import { WebSocket } from "ws";
import type {
  NotificationFeedItem,
  NotificationUnreadSummary,
} from "@stealth-trails-bank/types";
import { NotificationsRealtimeService } from "./notifications.realtime.service";
import { NotificationsService } from "./notifications.service";

describe("customer notification session revocation", () => {
  let httpServer: Server;
  let realtime: NotificationsRealtimeService;
  let socket: WebSocket;
  let authorized: boolean;
  const recipientKey = "customer:recovery-test";
  const notifications = {
    validateSocketSessionToken: jest.fn(async () => ({
      audience: "customer",
      recipientKey,
      customerId: "recovery-test",
      operatorId: null,
      authTokenVersion: 0,
      latestSequence: 0,
      heartbeatIntervalMs: 5000,
    })),
    isCustomerSocketAuthorizationCurrent: jest.fn(async () => authorized),
    listRealtimeEventsAfterSequence: jest.fn(async () => []),
  };
  beforeEach(async () => {
    authorized = true;
    httpServer = createServer();
    realtime = new NotificationsRealtimeService(
      notifications as unknown as NotificationsService,
    );
    realtime.attach(httpServer);
    httpServer.listen(0, "127.0.0.1");
    await once(httpServer, "listening");
    const address = httpServer.address() as { port: number };
    socket = new WebSocket(
      `ws://127.0.0.1:${address.port}/notifications/ws?session=test-ticket`,
    );
    const [connected] = await once(socket, "message");
    expect(JSON.parse(connected.toString()).type).toBe(
      "notifications.connected",
    );
  });
  afterEach(async () => {
    socket.terminate();
    realtime.onModuleDestroy();
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  });

  it("closes an already-open socket before delivering notifications after auth version revocation", async () => {
    authorized = false;
    const message = jest.fn();
    socket.on("message", message);
    const closed = once(socket, "close");
    realtime.broadcastCreated(
      recipientKey,
      {
        deliverySequence: 1,
        updatedAt: new Date().toISOString(),
      } as NotificationFeedItem,
      { unreadCount: 1 } as NotificationUnreadSummary,
    );
    const [code] = await closed;
    expect(code).toBe(1008);
    expect(message).not.toHaveBeenCalled();
    expect(
      notifications.isCustomerSocketAuthorizationCurrent,
    ).toHaveBeenCalledWith("recovery-test", 0);
  });

  it("rejects replay requests on a connection whose credentials were revoked", async () => {
    authorized = false;
    const closed = once(socket, "close");
    socket.send(
      JSON.stringify({
        type: "notifications.resume",
        data: { lastSeenSequence: 0 },
      }),
    );
    const [code] = await closed;
    expect(code).toBe(1008);
    expect(
      notifications.listRealtimeEventsAfterSequence,
    ).not.toHaveBeenCalled();
  });

  it("continues delivering notifications for a current session", async () => {
    const delivered = once(socket, "message");
    realtime.broadcastCreated(
      recipientKey,
      {
        deliverySequence: 1,
        updatedAt: new Date().toISOString(),
      } as NotificationFeedItem,
      { unreadCount: 1 } as NotificationUnreadSummary,
    );
    const [message] = await delivered;
    expect(JSON.parse(message.toString()).type).toBe(
      "notifications.item.created",
    );
  });
});

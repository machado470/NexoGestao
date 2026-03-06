import { EventEmitter } from "events";

type NotificationCenterEvent = {
  orgId: string;
  type: "created" | "updated";
  notificationId: string;
};

const emitter = new EventEmitter();

export function emitNotificationCenterEvent(event: NotificationCenterEvent) {
  emitter.emit(`notification-center:${event.orgId}`, event);
}

export function subscribeToNotificationCenterEvents(
  orgId: string,
  listener: (event: NotificationCenterEvent) => void
) {
  const channel = `notification-center:${orgId}`;
  emitter.on(channel, listener);

  return () => {
    emitter.off(channel, listener);
  };
}

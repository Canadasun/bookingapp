import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

export function useEvents(
  businessId: string | null | undefined,
  onUpdate: (data: unknown) => void,
  onPlanUpdate?: (data: { plan: string; planExpiresAt: string | null }) => void,
  onNotification?: () => void,
): { connected: boolean } {
  const [connected, setConnected] = useState(false);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!businessId) return;

    // The API lives on a different origin and the access token is in an HttpOnly
    // cookie (unreadable by JS), so we can't authenticate the socket with it
    // directly. Instead fetch a short-lived ticket over the authenticated proxy
    // and present it in the handshake; the gateway verifies it and scopes the
    // connection to our business.
    const apiUrl = process.env.NEXT_PUBLIC_WS_URL || process.env.NEXT_PUBLIC_API_URL || "";
    let socket: Socket | null = null;
    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      fetch("/proxy/events/ws-ticket")
        .then((r) => r.json() as Promise<{ ticket: string }>)
        .then(({ ticket }) => {
          if (cancelled) return;
          // Disable built-in reconnection so we re-fetch a fresh single-use
          // ticket on each reconnect instead of replaying the old one.
          socket = io(apiUrl, { transports: ["websocket"], auth: { ticket }, reconnection: false });

          socket.on("connect", () => {
            setConnected(true);
            socket?.emit("joinBusiness", businessId);
          });

          socket.on("disconnect", () => {
            setConnected(false);
            if (!cancelled) {
              retryTimer.current = setTimeout(connect, 3000);
            }
          });

          socket.on("connect_error", () => {
            socket?.disconnect();
            if (!cancelled) {
              retryTimer.current = setTimeout(connect, 5000);
            }
          });

          socket.on("bookingUpdated", (data: unknown) => onUpdate(data));
          socket.on("messageUpdated", (data: unknown) => onUpdate(data));
          socket.on("planUpdated", (data: { plan: string; planExpiresAt: string | null }) => {
            onPlanUpdate?.(data);
          });
          socket.on("notificationCreated", () => onNotification?.());
        })
        .catch(() => {
          // Not authenticated / ticket unavailable — retry after a delay; the UI
          // still works via normal fetches and the polling fallback.
          if (!cancelled) {
            retryTimer.current = setTimeout(connect, 5000);
          }
        });
    };

    connect();

    return () => {
      cancelled = true;
      if (retryTimer.current) {
        clearTimeout(retryTimer.current);
        retryTimer.current = null;
      }
      setConnected(false);
      if (socket) {
        socket.emit("leaveBusiness", businessId);
        socket.disconnect();
      }
    };
  }, [businessId, onUpdate, onPlanUpdate, onNotification]);

  return { connected };
}

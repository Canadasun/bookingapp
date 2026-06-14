import { useEffect } from "react";
import { io, Socket } from "socket.io-client";

export function useEvents(
  businessId: string | null | undefined,
  onUpdate: (data: unknown) => void,
  onPlanUpdate?: (data: { plan: string; planExpiresAt: string | null }) => void,
) {
  useEffect(() => {
    if (!businessId) return;

    // The API lives on a different origin and the access token is in an HttpOnly
    // cookie (unreadable by JS), so we can't authenticate the socket with it
    // directly. Instead fetch a short-lived ticket over the authenticated proxy
    // and present it in the handshake; the gateway verifies it and scopes the
    // connection to our business.
    const apiUrl = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:3001";
    let socket: Socket | null = null;
    let cancelled = false;

    fetch("/proxy/events/ws-ticket")
      .then((r) => r.json() as Promise<{ ticket: string }>)
      .then(({ ticket }) => {
        if (cancelled) return;
        socket = io(apiUrl, { transports: ["websocket"], auth: { ticket } });

        socket.on("connect", () => {
          socket?.emit("joinBusiness", businessId);
        });
        socket.on("bookingUpdated", (data: unknown) => onUpdate(data));
        socket.on("messageUpdated", (data: unknown) => onUpdate(data));
        socket.on("planUpdated", (data: { plan: string; planExpiresAt: string | null }) => {
          onPlanUpdate?.(data);
        });
      })
      .catch(() => {
        // Not authenticated / ticket unavailable — skip realtime; the UI still
        // works via normal fetches.
      });

    return () => {
      cancelled = true;
      if (socket) {
        socket.emit("leaveBusiness", businessId);
        socket.disconnect();
      }
    };
  }, [businessId, onUpdate, onPlanUpdate]);
}

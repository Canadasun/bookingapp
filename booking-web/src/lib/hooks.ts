import { useState, useEffect } from "react";
import { getUser } from "./auth";
import { api } from "./api";
import { io, Socket } from "socket.io-client";

export function useBusinessId() {
  const [bizId, setBizId] = useState<string>("");

  useEffect(() => {
    const user = getUser();
    if (user?.businessId) {
      setBizId(user.businessId);
    } else {
      // Fallback to env for local dev if not logged in (e.g. initial setup)
      setBizId(process.env.NEXT_PUBLIC_BUSINESS_ID ?? "");
    }
  }, []);

  return bizId;
}

export function useEvents(onUpdate: (data: any) => void) {
  const bizId = useBusinessId();

  useEffect(() => {
    if (!bizId) return;

    // The API lives on a different origin and the access token is in an HttpOnly
    // cookie (unreadable by JS), so we can't authenticate the socket with it
    // directly. Instead fetch a short-lived ticket over the authenticated proxy
    // and present it in the handshake; the gateway verifies it and scopes the
    // connection to our business.
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    let socket: Socket | null = null;
    let cancelled = false;

    api.events
      .wsTicket()
      .then(({ ticket }) => {
        if (cancelled) return;
        socket = io(apiUrl, { transports: ["websocket"], auth: { ticket } });

        socket.on("connect", () => {
          socket?.emit("joinBusiness", bizId);
        });

        socket.on("bookingUpdated", (data) => {
          onUpdate(data);
        });
      })
      .catch(() => {
        // Not authenticated / ticket unavailable — skip realtime; the UI still
        // works via normal fetches.
      });

    return () => {
      cancelled = true;
      if (socket) {
        socket.emit("leaveBusiness", bizId);
        socket.disconnect();
      }
    };
  }, [bizId, onUpdate]);
}

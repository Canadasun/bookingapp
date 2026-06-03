import { useState, useEffect } from "react";
import { getUser } from "./auth";
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

    // Use the base API URL (e.g. http://localhost:3001) for the websocket
    // In production, NEXT_PUBLIC_WEB_URL points to the web app, 
    // but the API usually lives on a different subdomain or port.
    // We'll use a relative path /proxy if we want to pipe through Next.js, 
    // but socket.io often works better directly to the API if CORS allows.
    // For now, let's try the direct API URL if available.
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
    
    const socket: Socket = io(apiUrl, {
      transports: ["websocket"],
    });

    socket.on("connect", () => {
      console.log("WebSocket connected");
      socket.emit("joinBusiness", bizId);
    });

    socket.on("bookingUpdated", (data) => {
      console.log("Real-time update received:", data);
      onUpdate(data);
    });

    return () => {
      socket.emit("leaveBusiness", bizId);
      socket.disconnect();
    };
  }, [bizId, onUpdate]);
}

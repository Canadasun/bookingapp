import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#0f172a",
        }}
      >
        {/* Brand mark — amber square with ECG waveform matching logo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 120,
            height: 120,
            background: "#E9A23C",
            borderRadius: 30,
            marginBottom: 40,
          }}
        >
          <svg width="70" height="70" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M2 12 L6 12 L8 5 L10 19 L12 8 L14 15 L16 12 L22 12"
              stroke="white"
              stroke-width="2.2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </div>

        {/* Wordmark */}
        <div
          style={{
            fontSize: 72,
            fontWeight: 800,
            color: "#ffffff",
            letterSpacing: "-2px",
            marginBottom: 20,
          }}
        >
          Pulse Booking
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 32,
            color: "#94a3b8",
            fontWeight: 400,
            letterSpacing: "-0.5px",
          }}
        >
          Scheduling made simple
        </div>

        {/* Domain */}
        <div
          style={{
            position: "absolute",
            bottom: 48,
            fontSize: 22,
            color: "#475569",
            fontWeight: 500,
          }}
        >
          pulseappointments.com
        </div>
      </div>
    ),
    size,
  );
}

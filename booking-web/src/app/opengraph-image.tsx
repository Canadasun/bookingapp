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
        {/* Brand mark */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 96,
            height: 96,
            background: "#E9A23C",
            borderRadius: 24,
            marginBottom: 40,
          }}
        >
          <span style={{ color: "#fff", fontSize: 56, fontWeight: 800 }}>P</span>
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
          Pulse
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

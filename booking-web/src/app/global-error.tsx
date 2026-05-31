"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Global Error]", error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", background: "#F8F9FA" }}>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: "#fff", borderRadius: 20, border: "1px solid #E5E7EB", padding: 48, maxWidth: 420, width: "100%", textAlign: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#FEF2F2", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "#111827", margin: "0 0 8px" }}>Critical error</h1>
            <p style={{ fontSize: 14, color: "#6B7280", margin: "0 0 24px" }}>
              The application encountered a serious problem. Please reload the page.
            </p>
            <button
              onClick={reset}
              style={{ background: "#7C3AED", color: "#fff", border: "none", padding: "10px 24px", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer", marginRight: 8 }}>
              Try again
            </button>
            <button
              onClick={() => (window.location.href = "/")}
              style={{ background: "#fff", color: "#374151", border: "1px solid #E5E7EB", padding: "10px 24px", borderRadius: 12, fontSize: 14, cursor: "pointer" }}>
              Reload
            </button>
            {error?.digest && (
              <p style={{ fontSize: 11, color: "#D1D5DB", marginTop: 20 }}>ID: {error.digest}</p>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}

import { NextRequest, NextResponse } from "next/server";
import { assertSameOrigin } from "@/lib/same-origin";

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL ?? "support@pulseappointments.com";

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function POST(req: NextRequest) {
  const blocked = assertSameOrigin(req);
  if (blocked) return blocked;

  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const name     = typeof body.name     === "string" ? body.name.slice(0, 100)     : "";
  const email    = typeof body.email    === "string" ? body.email.slice(0, 200)    : "";
  const business = typeof body.business === "string" ? body.business.slice(0, 200) : "";
  const platform = typeof body.platform === "string" ? body.platform.slice(0, 100) : "";
  const message  = typeof body.message  === "string" ? body.message.slice(0, 2000) : "";

  if (!name || !email || !business || !platform) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
  }

  const mailgunDomain = process.env.MAILGUN_DOMAIN;
  const mailgunKey    = process.env.MAILGUN_API_KEY;

  if (mailgunDomain && mailgunKey) {
    const formData = new FormData();
    formData.append("from", `Pulse Website <noreply@${mailgunDomain}>`);
    formData.append("to", SUPPORT_EMAIL);
    formData.append("subject", `Migration request: ${business} (from ${platform})`);
    formData.append("html", `
      <h2>New migration request</h2>
      <table>
        <tr><td><strong>Name</strong></td><td>${escapeHtml(name)}</td></tr>
        <tr><td><strong>Email</strong></td><td>${escapeHtml(email)}</td></tr>
        <tr><td><strong>Business</strong></td><td>${escapeHtml(business)}</td></tr>
        <tr><td><strong>Leaving</strong></td><td>${escapeHtml(platform)}</td></tr>
        <tr><td><strong>Notes</strong></td><td>${escapeHtml(message) || "—"}</td></tr>
      </table>
      <p><a href="mailto:${escapeHtml(email)}">Reply to ${escapeHtml(name)}</a></p>
    `);
    formData.append("text",
      `Migration request\nName: ${name}\nEmail: ${email}\nBusiness: ${business}\nLeaving: ${platform}\nNotes: ${message || "—"}`
    );

    await fetch(`https://api.mailgun.net/v3/${mailgunDomain}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`api:${mailgunKey}`).toString("base64")}`,
      },
      body: formData,
    });
  } else {
    console.log("[migrate-request] No Mailgun config. Request:", { name, email, business, platform, message });
  }

  return NextResponse.json({ ok: true });
}

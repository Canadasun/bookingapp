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

  const name    = typeof body.name    === "string" ? body.name.slice(0, 100)    : "";
  const email   = typeof body.email   === "string" ? body.email.slice(0, 200)   : "";
  const subject = typeof body.subject === "string" ? body.subject.slice(0, 200) : "";
  const message = typeof body.message === "string" ? body.message.slice(0, 5000): "";

  if (!name || !email || !subject || !message) {
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
    formData.append("from", `Pulse Support Form <noreply@${mailgunDomain}>`);
    formData.append("to", SUPPORT_EMAIL);
    formData.append("reply-to", email);
    formData.append("subject", `[Support] ${subject}`);
    formData.append("html", `
      <h2>Support request</h2>
      <table>
        <tr><td><strong>Name</strong></td><td>${escapeHtml(name)}</td></tr>
        <tr><td><strong>Email</strong></td><td>${escapeHtml(email)}</td></tr>
        <tr><td><strong>Subject</strong></td><td>${escapeHtml(subject)}</td></tr>
      </table>
      <hr/>
      <p style="white-space:pre-wrap">${escapeHtml(message)}</p>
      <p><a href="mailto:${escapeHtml(email)}">Reply to ${escapeHtml(name)}</a></p>
    `);
    formData.append("text",
      `Support request\nName: ${name}\nEmail: ${email}\nSubject: ${subject}\n\n${message}`
    );

    await fetch(`https://api.mailgun.net/v3/${mailgunDomain}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`api:${mailgunKey}`).toString("base64")}`,
      },
      body: formData,
    });
  } else {
    console.log("[support-request] No Mailgun config. Request:", { name, email, subject, message });
  }

  return NextResponse.json({ ok: true });
}

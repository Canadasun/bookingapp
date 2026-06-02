import { NextRequest, NextResponse } from "next/server";

const API = process.env.API_INTERNAL_URL ?? "http://localhost:3001";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const res = await fetch(`${API}/api/bookings/${id}`).catch(() => null);
  if (!res || !res.ok) {
    return new NextResponse("Appointment not found", { status: 404 });
  }

  const apt = await res.json();

  const fmt = (d: string) =>
    new Date(d).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z/, "Z");

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Pulse//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${apt.id}@bookingapp`,
    `DTSTAMP:${fmt(new Date().toISOString())}`,
    `DTSTART:${fmt(apt.startsAt)}`,
    `DTEND:${fmt(apt.endsAt)}`,
    `SUMMARY:${apt.service?.name ?? "Appointment"} at ${apt.business?.name ?? "Salon"}`,
    `DESCRIPTION:With ${apt.staff?.user?.name ?? "staff"}. Ref: ${apt.id.slice(-8).toUpperCase()}`,
    `LOCATION:${apt.business?.address ?? apt.business?.name ?? ""}`,
    `STATUS:${apt.status === "CONFIRMED" ? "CONFIRMED" : "TENTATIVE"}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  return new NextResponse(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="booking-${apt.id.slice(-8)}.ics"`,
    },
  });
}

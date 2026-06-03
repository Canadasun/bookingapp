"use client";

import { useState } from "react";
import { CalendarPlus, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  appointmentId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  description?: string;
  location?: string;
}

function googleUrl(p: Props) {
  const fmt = (d: string) =>
    new Date(d).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z/, "Z");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: p.title,
    dates: `${fmt(p.startsAt)}/${fmt(p.endsAt)}`,
    ...(p.description ? { details: p.description } : {}),
    ...(p.location ? { location: p.location } : {}),
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

// Build the .ics entirely client-side from the props we already have — no API
// round-trip (the appointment API now requires a manage token the browser link
// doesn't carry).
function icsDataUri(p: Props) {
  const fmt = (d: string) => new Date(d).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z/, "Z");
  const esc = (s: string) => s.replace(/([\\;,])/g, "\\$1").replace(/\n/g, "\\n");
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Pulse//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${p.appointmentId}@pulseappointments`,
    `DTSTAMP:${fmt(new Date().toISOString())}`,
    `DTSTART:${fmt(p.startsAt)}`,
    `DTEND:${fmt(p.endsAt)}`,
    `SUMMARY:${esc(p.title)}`,
    ...(p.description ? [`DESCRIPTION:${esc(p.description)}`] : []),
    ...(p.location ? [`LOCATION:${esc(p.location)}`] : []),
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}

function outlookUrl(p: Props) {
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: p.title,
    startdt: p.startsAt,
    enddt: p.endsAt,
    ...(p.description ? { body: p.description } : {}),
    ...(p.location ? { location: p.location } : {}),
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

export function AddToCalendar(props: Props) {
  const [open, setOpen] = useState(false);

  const options = [
    {
      label: "Google Calendar",
      icon: "🗓",
      href: googleUrl(props),
      external: true,
    },
    {
      label: "Apple / iCal",
      icon: "📅",
      href: icsDataUri(props),
      external: false,
    },
    {
      label: "Outlook",
      icon: "📆",
      href: outlookUrl(props),
      external: true,
    },
  ];

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-violet-700 border border-violet-200 rounded-xl hover:bg-violet-50 transition-colors">
        <CalendarPlus className="w-4 h-4" />
        Add to Calendar
        <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 mt-1.5 w-52 bg-white rounded-xl border border-gray-100 shadow-lg z-20 overflow-hidden">
            {options.map((o) => (
              <a
                key={o.label}
                href={o.href}
                target={o.external ? "_blank" : undefined}
                rel={o.external ? "noopener noreferrer" : undefined}
                download={!o.external ? true : undefined}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-violet-50 hover:text-violet-700 transition-colors border-b border-gray-50 last:border-0">
                <span className="text-base">{o.icon}</span>
                {o.label}
              </a>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

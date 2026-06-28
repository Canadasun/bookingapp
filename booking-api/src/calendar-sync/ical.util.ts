// Pure iCal generation — no NestJS DI, importable anywhere.

function fmt(d: Date): string {
  return d.toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';
}

function esc(s: string): string {
  return String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
    .replace(/\n/g, '\\n');
}

export interface ICalAppointment {
  id: string;
  startsAt: Date;
  endsAt: Date;
  service: { name: string; durationMinutes: number };
  staff: { user: { name: string } };
  client: { name: string; email?: string | null };
  business: { name: string; timezone?: string | null; address?: string | null; email?: string | null };
  notes?: string | null;
  locationMode?: string | null;
  meetingUrl?: string | null;
  customerAddress?: string | null;
}

// Resolve the calendar event's place, mode-aware: the join link for virtual, the
// client's address for mobile, a phone note, else the business address.
function icalLocation(apt: ICalAppointment): string {
  switch (apt.locationMode) {
    case 'VIRTUAL': return apt.meetingUrl ?? 'Online video call';
    case 'CUSTOMER': return apt.customerAddress ?? '';
    case 'PHONE': return 'Phone call';
    default: return apt.business.address ?? '';
  }
}

/** Single-event iCal for client/owner calendar invite (METHOD:REQUEST). */
export function generateICalEvent(apt: ICalAppointment): string {
  const desc = [
    `Service: ${esc(apt.service.name)} (${apt.service.durationMinutes} min)`,
    `Provider: ${esc(apt.staff.user.name)}`,
    apt.locationMode === 'VIRTUAL' && apt.meetingUrl ? `Join: ${esc(apt.meetingUrl)}` : '',
    apt.notes ? `Notes: ${esc(apt.notes)}` : '',
  ].filter(Boolean).join('\\n');

  const location = icalLocation(apt);
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Pulse//Appointments//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:${apt.id}@pulse.app`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(apt.startsAt)}`,
    `DTEND:${fmt(apt.endsAt)}`,
    `SUMMARY:${esc(`${apt.service.name} at ${apt.business.name}`)}`,
    `DESCRIPTION:${desc}`,
  ];
  if (location) lines.push(`LOCATION:${esc(location)}`);
  if (apt.business.email) lines.push(`ORGANIZER;CN="${esc(apt.business.name)}":mailto:${apt.business.email}`);
  if (apt.client.email) lines.push(`ATTENDEE;CN="${esc(apt.client.name)}";ROLE=REQ-PARTICIPANT;RSVP=TRUE:mailto:${apt.client.email}`);
  lines.push('STATUS:CONFIRMED', 'SEQUENCE:0', 'END:VEVENT', 'END:VCALENDAR');
  return lines.join('\r\n');
}

/** Cancellation iCal (METHOD:CANCEL). */
export function generateICalCancellation(apt: Pick<ICalAppointment, 'id' | 'startsAt' | 'endsAt' | 'service' | 'business'>): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Pulse//Appointments//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:CANCEL',
    'BEGIN:VEVENT',
    `UID:${apt.id}@pulse.app`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(apt.startsAt)}`,
    `DTEND:${fmt(apt.endsAt)}`,
    `SUMMARY:${esc(`CANCELLED: ${apt.service.name} at ${apt.business.name}`)}`,
    'STATUS:CANCELLED',
    'SEQUENCE:1',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

/** Multi-event iCal feed (METHOD:PUBLISH) for calendar subscription URLs. */
export function generateICalFeed(
  apts: Array<{
    id: string;
    startsAt: Date;
    endsAt: Date;
    service: { name: string };
    client: { name: string };
    staff: { user: { name: string } };
    status: string;
  }>,
  calName = 'Pulse Appointments',
): string {
  const events = apts.map((apt) =>
    [
      'BEGIN:VEVENT',
      `UID:${apt.id}@pulse.app`,
      `DTSTAMP:${fmt(new Date())}`,
      `DTSTART:${fmt(apt.startsAt)}`,
      `DTEND:${fmt(apt.endsAt)}`,
      `SUMMARY:${esc(`${apt.service.name} — ${apt.client.name}`)}`,
      `DESCRIPTION:Provider: ${esc(apt.staff.user.name)}`,
      `STATUS:${apt.status === 'CANCELLED' ? 'CANCELLED' : 'CONFIRMED'}`,
      'END:VEVENT',
    ].join('\r\n'),
  );
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Pulse//Feed//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(calName)}`,
    'X-WR-TIMEZONE:UTC',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n');
}

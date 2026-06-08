// Small formatting helpers shared across screens.

export const fmtTime = (value: string | Date) =>
  new Date(value).toLocaleTimeString([], { hour:'numeric', minute:'2-digit', hour12:true });

// Human duration, e.g. 75 → "1h 15m". Shared across the calendar and the service editor.
export function fmtDur(min:number){ const h=Math.floor(min/60), r=min%60; if(h&&r) return `${h}h ${r}m`; return h?`${h}h`:`${min}m`; }

// Client-side phone normalization to E.164 (mirrors the API). North-America-first:
// a bare 10-digit number becomes +1…; already-international (+…) numbers are kept.
// Returns null when the input can't be a complete number so the UI can flag it.
export function normalizePhoneClient(input?: string|null): string|null {
  if (input == null) return null;
  const raw = input.trim();
  if (!raw) return null;
  if (raw.startsWith('+')) {
    const digits = raw.slice(1).replace(/\D/g, '');
    return /^[1-9]\d{7,14}$/.test(digits) ? `+${digits}` : null;
  }
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

// Format an E.164 number for display: +14165550123 → "+1 (416) 555-0123"
export function formatPhoneDisplay(e164?: string | null): string {
  if (!e164) return '';
  const digits = e164.replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1,4)}) ${digits.slice(4,7)}-${digits.slice(7)}`;
  }
  return e164;
}

// Format a phone number as the user types, applying +1 (XXX) XXX-XXXX mask progressively.
export function formatPhoneInput(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length <= 3) return `+1 (${digits}`;
  if (digits.length <= 6) return `+1 (${digits.slice(0,3)}) ${digits.slice(3)}`;
  if (digits.length <= 10) return `+1 (${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
  return `+1 (${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6,10)}`;
}

import { getToken } from "./utils";

const BASE = "/proxy";

let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = fetch("/api/auth/refresh", { method: "POST" })
    .then((r) => r.ok)
    .finally(() => { refreshPromise = null; });
  return refreshPromise;
}

async function req<T>(path: string, init?: RequestInit, token?: string | null): Promise<T> {
  const t = token === null ? null : (token ?? getToken());
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(t ? { Authorization: `Bearer ${t}` } : {}),
      ...(init?.headers ?? {}),
    },
  });

  // Auto-refresh on 401 then retry once
  if (res.status === 401 && token === undefined) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      const newToken = getToken();
      const retry = await fetch(`${BASE}${path}`, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...(newToken ? { Authorization: `Bearer ${newToken}` } : {}),
          ...(init?.headers ?? {}),
        },
      });
      if (retry.ok) {
        if (retry.status === 204) return undefined as T;
        return retry.json() as Promise<T>;
      }
    }
    // Refresh failed — redirect to login
    if (typeof window !== "undefined") {
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
    }
    throw new Error("Session expired");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as Record<string, unknown>;
    const raw = body.message;
    const msg = Array.isArray(raw) ? raw.join(", ") : typeof raw === "string" ? raw : res.statusText;
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ── Types matching exact API response shapes ──────────────────────────────────

export interface Business {
  id: string; name: string; slug: string; timezone: string;
  email: string; phone?: string; address?: string; logoUrl?: string;
  bookingPageSettings: Record<string, unknown>;
  minNoticeMinutes: number; maxAdvanceDays: number;
  cancellationWindowHours: number; requireDeposit: boolean;
  depositPercent: number; noShowFeeCents: number; allowClientReschedule: boolean;
  cancellationPolicy: string;
  plan: "FREE" | "BASIC" | "PRO";
  planExpiresAt?: string;
  createdAt: string; updatedAt: string;
}

export interface ServiceCategory {
  id: string; name: string; description?: string;
  color: string; sortOrder: number; active: boolean;
  businessId: string; createdAt: string; updatedAt: string;
  services?: Service[];
}

export interface Service {
  id: string; name: string; description?: string;
  durationMinutes: number; priceCents: number;
  bufferBeforeMin: number; bufferAfterMin: number;
  color: string; sortOrder: number; active: boolean;
  businessId: string; categoryId?: string | null;
  category?: Pick<ServiceCategory, "id" | "name" | "color" | "sortOrder"> | null;
  createdAt: string; updatedAt: string;
}

export interface StaffService {
  staffId: string; serviceId: string;
  service?: { id: string; name: string; active: boolean };
}

export interface AvailabilityRule {
  id: string; staffId: string; dayOfWeek: number; startTime: string; endTime: string;
}

export interface StaffMember {
  id: string; userId: string; businessId: string;
  bio?: string; avatarUrl?: string; active: boolean;
  createdAt: string; updatedAt: string;
  user: { name: string; email: string; phone?: string };
  staffServices: StaffService[];
  availabilityRules?: AvailabilityRule[];
}

export interface Slot {
  startsAt: string; endsAt: string; startsAtLocal: string; endsAtLocal: string;
}

export interface Client {
  id: string; name: string; email: string; phone?: string; notes?: string;
  businessId: string; createdAt: string; updatedAt: string;
}

export interface ClientWithStats extends Client {
  totalVisits: number; lastVisit?: string; totalSpentCents: number;
}

export interface Appointment {
  id: string; startsAt: string; endsAt: string; status: string;
  notes?: string; cancelReason?: string;
  depositCents?: number; stripePaymentIntentId?: string;
  businessId: string;
  createdAt: string; updatedAt: string;
  client: Client;
  service: Service;
  staff: StaffMember;
  business: Business;
}

export interface TimeOff {
  id: string; staffId: string; startsAt: string; endsAt: string; reason?: string; createdAt: string;
}

// ── API client ────────────────────────────────────────────────────────────────

export const api = {
  auth: {
    login: (email: string, password: string) =>
      req<{ accessToken: string; refreshToken: string; user: { id: string; name: string; email: string; role: string } }>(
        "/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }
      ),
    register: (data: { name: string; email: string; password: string; role?: string; businessId?: string }) =>
      req<{ accessToken: string; refreshToken: string; user: { id: string; name: string; email: string; role: string } }>(
        "/auth/register", { method: "POST", body: JSON.stringify(data) }
      ),
    changePassword: (currentPassword: string, newPassword: string) =>
      req<{ ok: boolean }>("/auth/change-password", { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) }),
  },

  business: {
    get: (id: string) => req<Business>(`/businesses/${id}`),
    getBySlug: (slug: string) => req<Business>(`/businesses/slug/${slug}`),
    update: (id: string, data: Partial<Omit<Business, "id" | "createdAt" | "updatedAt">>) =>
      req<Business>(`/businesses/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  },

  services: {
    list: (businessId: string) => req<Service[]>(`/businesses/${businessId}/services`),
    listAll: (businessId: string) => req<Service[]>(`/businesses/${businessId}/services/all`),
    get: (businessId: string, id: string) => req<Service>(`/businesses/${businessId}/services/${id}`),
    create: (businessId: string, data: Omit<Partial<Service>, "id" | "businessId" | "createdAt" | "updatedAt">) =>
      req<Service>(`/businesses/${businessId}/services`, { method: "POST", body: JSON.stringify(data) }),
    update: (businessId: string, id: string, data: Omit<Partial<Service>, "id" | "businessId" | "createdAt" | "updatedAt">) =>
      req<Service>(`/businesses/${businessId}/services/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    remove: (businessId: string, id: string) =>
      req<void>(`/businesses/${businessId}/services/${id}`, { method: "DELETE" }),
  },

  serviceCategories: {
    list: (businessId: string) => req<ServiceCategory[]>(`/businesses/${businessId}/service-categories`),
    listAll: (businessId: string) => req<ServiceCategory[]>(`/businesses/${businessId}/service-categories/all`),
    create: (businessId: string, data: { name: string; description?: string; color?: string; sortOrder?: number }) =>
      req<ServiceCategory>(`/businesses/${businessId}/service-categories`, { method: "POST", body: JSON.stringify(data) }),
    update: (businessId: string, id: string, data: Partial<{ name: string; description: string; color: string; sortOrder: number; active: boolean }>) =>
      req<ServiceCategory>(`/businesses/${businessId}/service-categories/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    remove: (businessId: string, id: string) =>
      req<void>(`/businesses/${businessId}/service-categories/${id}`, { method: "DELETE" }),
  },

  staff: {
    // Public — booking flow needs these
    list: (businessId: string) => req<StaffMember[]>(`/businesses/${businessId}/staff`),
    get: (businessId: string, id: string) => req<StaffMember>(`/businesses/${businessId}/staff/${id}`),
    getTimeOffs: (businessId: string, staffId: string) =>
      req<TimeOff[]>(`/businesses/${businessId}/staff/${staffId}/time-off`),
    // Protected
    listAll: (businessId: string) => req<StaffMember[]>(`/businesses/${businessId}/staff/all`),
    create: (businessId: string, data: { userId: string; bio?: string; avatarUrl?: string }) =>
      req<StaffMember>(`/businesses/${businessId}/staff`, { method: "POST", body: JSON.stringify(data) }),
    // Owner-only: creates the staff login + returns a one-time temp password.
    invite: (businessId: string, data: { name: string; email: string; bio?: string; serviceIds?: string[] }) =>
      req<{ staff: StaffMember; tempPassword: string }>(`/businesses/${businessId}/staff/invite`, { method: "POST", body: JSON.stringify(data) }),
    update: (businessId: string, id: string, data: { bio?: string; avatarUrl?: string; active?: boolean }) =>
      req<StaffMember>(`/businesses/${businessId}/staff/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    assignServices: (businessId: string, staffId: string, serviceIds: string[]) =>
      req<StaffMember>(`/businesses/${businessId}/staff/${staffId}/services`, { method: "POST", body: JSON.stringify({ serviceIds }) }),
    setAvailability: (businessId: string, staffId: string, rules: { dayOfWeek: number; startTime: string; endTime: string }[]) =>
      req<AvailabilityRule[]>(`/businesses/${businessId}/staff/${staffId}/availability`, { method: "POST", body: JSON.stringify(rules) }),
    addTimeOff: (businessId: string, staffId: string, data: { startsAt: string; endsAt: string; reason?: string }) =>
      req<TimeOff>(`/businesses/${businessId}/staff/${staffId}/time-off`, { method: "POST", body: JSON.stringify(data) }),
    deleteTimeOff: (businessId: string, staffId: string, timeOffId: string) =>
      req<void>(`/businesses/${businessId}/staff/${staffId}/time-off/${timeOffId}`, { method: "DELETE" }),
  },

  availability: {
    getSlots: (params: { staffId: string; serviceId: string; startDate: string; endDate: string; timezone?: string }) => {
      const q = new URLSearchParams(params as Record<string, string>).toString();
      return req<Slot[]>(`/availability/slots?${q}`);
    },
  },

  clients: {
    list: (businessId: string, search?: string, page = 1, limit = 25) => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      params.set("page", String(page));
      params.set("limit", String(limit));
      return req<{ data: ClientWithStats[]; total: number; page: number; pages: number }>(
        `/businesses/${businessId}/clients?${params.toString()}`
      );
    },
    get: (businessId: string, id: string) =>
      req<Client & { appointments: Appointment[]; totalSpentCents: number }>(`/businesses/${businessId}/clients/${id}`),
    lookup: (businessId: string, emailOrPhone: string) => {
      const isPhone = /^\+?[\d\s\-()+]{7,}$/.test(emailOrPhone.trim()) && !emailOrPhone.includes("@");
      const q = isPhone
        ? `phone=${encodeURIComponent(emailOrPhone.trim())}`
        : `email=${encodeURIComponent(emailOrPhone.trim())}`;
      return req<Client & { appointments: Appointment[] }>(`/businesses/${businessId}/clients/lookup?${q}`, undefined, null);
    },
    create: (businessId: string, data: { name: string; email: string; phone?: string; notes?: string }) =>
      req<Client>(`/businesses/${businessId}/clients`, { method: "POST", body: JSON.stringify(data) }),
    update: (businessId: string, id: string, data: { name?: string; email?: string; phone?: string; notes?: string }) =>
      req<Client>(`/businesses/${businessId}/clients/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  },

  appointments: {
    list: (businessId: string, page = 1, limit = 50) =>
      req<{ data: Appointment[]; total: number; page: number; pages: number }>(
        `/businesses/${businessId}/bookings?page=${page}&limit=${limit}`
      ),
    get: (id: string) => req<Appointment>(`/bookings/${id}`),
    create: (businessId: string, data: { staffId: string; serviceId: string; additionalServiceIds?: string[]; clientId: string; startsAt: string; notes?: string }) =>
      req<Appointment>(`/businesses/${businessId}/bookings`, { method: "POST", body: JSON.stringify(data) }),
    confirm: (businessId: string, id: string) =>
      req<Appointment>(`/businesses/${businessId}/bookings/${id}/confirm`, { method: "PATCH" }),
    updateStatus: (businessId: string, id: string, status: string, cancelReason?: string) =>
      req<Appointment>(`/businesses/${businessId}/bookings/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status, ...(cancelReason ? { cancelReason } : {}) }),
      }),
    // Public — used by the client-facing manage page (no auth required)
    publicCancel: (id: string, cancelReason?: string) =>
      req<Appointment>(`/bookings/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "CANCELLED", ...(cancelReason ? { cancelReason } : {}) }),
      }, null),
    publicReschedule: (id: string, startsAt: string) =>
      req<Appointment>(`/bookings/${id}/reschedule`, {
        method: "PATCH",
        body: JSON.stringify({ startsAt }),
      }, null),
  },

  messages: {
    threads: (businessId: string) =>
      req<Array<{ clientId: string; client: { id: string; name: string; email: string }; lastMessage: string; fromClient: boolean; read: boolean; createdAt: string }>>(`/businesses/${businessId}/messages`),
    thread: (businessId: string, clientId: string) =>
      req<Array<{ id: string; content: string; fromClient: boolean; read: boolean; createdAt: string }>>(`/businesses/${businessId}/clients/${clientId}/messages`),
    send: (businessId: string, clientId: string, content: string) =>
      req<unknown>(`/businesses/${businessId}/clients/${clientId}/messages`, { method: "POST", body: JSON.stringify({ content }) }, null),
    reply: (businessId: string, clientId: string, content: string) =>
      req<unknown>(`/businesses/${businessId}/clients/${clientId}/messages/reply`, { method: "POST", body: JSON.stringify({ content }) }),
    markRead: (businessId: string, clientId: string) =>
      req<unknown>(`/businesses/${businessId}/clients/${clientId}/messages/read`, { method: "PATCH" }),
  },

  offers: {
    list: (businessId: string) =>
      req<Array<{ id: string; title: string; description: string; discount?: string; expiresAt?: string; active: boolean }>>(`/businesses/${businessId}/offers`, undefined, null),
    create: (businessId: string, data: unknown) =>
      req<unknown>(`/businesses/${businessId}/offers`, { method: "POST", body: JSON.stringify(data) }),
    update: (businessId: string, id: string, data: unknown) =>
      req<unknown>(`/businesses/${businessId}/offers/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    remove: (businessId: string, id: string) =>
      req<void>(`/businesses/${businessId}/offers/${id}`, { method: "DELETE" }),
  },

  clientPortal: {
    appointments: () => req<Appointment[]>(`/my/appointments`),
    messages: () => req<Array<{ businessId: string; businessName: string; clientId: string; messages: Array<{ id: string; content: string; fromClient: boolean; createdAt: string }> }>>(`/my/messages`),
    offers: () => req<Array<{ id: string; title: string; description: string; discount?: string; expiresAt?: string; business: { id: string; name: string } }>>(`/my/offers`),
  },
};


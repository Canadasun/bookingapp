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
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest", // Enforce custom header for CSRF protection
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });

  // Auto-refresh on 401 then retry once
  if (res.status === 401 && token === undefined) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      const retry = await fetch(`${BASE}${path}`, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
          ...(init?.headers ?? {}),
        },
      });
      if (retry.ok) {
        if (retry.status === 204) return undefined as T;
        return retry.json() as Promise<T>;
      }
    }
    // Refresh failed — clear hint cookie and redirect to login
    if (typeof window !== "undefined") {
      document.cookie = "booking_user=; Max-Age=0; path=/";
      window.location.replace(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    }
    throw new Error("Session expired");
  }

  // The API returns 403 PASSWORD_RESET_REQUIRED when the user has a forced
  // password reset pending. Redirect to /change-password rather than surfacing
  // this as an unhandled error in every page.
  if (res.status === 403) {
    const body = await res.json().catch(() => ({})) as Record<string, unknown>;
    const nested = body.message as Record<string, unknown> | undefined;
    const code = nested?.code ?? body.code;
    if (code === "PASSWORD_RESET_REQUIRED" && typeof window !== "undefined") {
      window.location.replace("/change-password");
      throw new Error("Password reset required");
    }
    const raw = nested?.message ?? body.message;
    const msg = typeof raw === "string" ? raw : res.statusText;
    throw new Error(msg);
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as Record<string, unknown>;
    let raw = body.message;
    // A global exception filter nests the original error as { message: {...} }.
    // Unwrap one level so the real message/code survives instead of falling back
    // to the bare status text.
    if (raw && typeof raw === "object" && !Array.isArray(raw) && typeof (raw as Record<string, unknown>).message !== "undefined") {
      raw = (raw as Record<string, unknown>).message;
    }
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
  websiteUrl?: string; instagramUrl?: string; facebookUrl?: string; tiktokUrl?: string; postVisitMessage?: string;
  bookingPageSettings: Record<string, unknown>;
  notificationSettings?: NotificationSettings;
  minNoticeMinutes: number; maxAdvanceDays: number; maxAdvanceMinutes?: number;
  cancellationWindowHours: number; cancellationWindowMinutes?: number; requireDeposit: boolean;
  depositPercent: number; noShowFeeCents: number; cancellationFeeCents: number; collectCardOnFile: boolean; allowClientReschedule: boolean;
  allowClientCancel: boolean; bookingApprovalMode: "AUTO" | "MANUAL";
  cancellationPolicy: string;
  currency: "CAD" | "USD";
  plan: "FREE" | "BASIC" | "PRO" | "UNLIMITED";
  planExpiresAt?: string;
  suspended?: boolean;
  verificationStatus?: VerificationStatus;
  capabilities?: {
    deposits: boolean; cardOnFile: boolean; memberships: boolean; giftCards: boolean;
    sms: boolean; noShowFees: boolean; cancellationFees: boolean; marketing: boolean;
    multipleLocations: boolean; removeBranding: boolean;
  };
  intakeQuestions?: IntakeQuestion[];
  taxRatePercent?: number;
  taxProvince?: string | null;
  locations?: { id: string; name: string; address?: string | null }[];
  suspectedDuplicateOfId?: string | null;
  stripeConnectOnboarded?: boolean;
  demoSeeded?: boolean;
  onboardingDismissed?: boolean;
  createdAt: string; updatedAt: string;
}

export interface IntakeQuestion { id: string; label: string; required?: boolean }
export interface IntakeAnswer { label: string; answer: string }
export interface NotificationSettings {
  emailConfirmation?: boolean;
  emailReminder72h?: boolean;
  emailReminder24h?: boolean;
  emailFollowUp?: boolean;
  emailCancellation?: boolean;
  emailReschedule?: boolean;
  emailStaffCancellation?: boolean;
  smsConfirmation?: boolean;
  smsReminder2h?: boolean;
}

export interface ServiceCategory {
  id: string; name: string; description?: string;
  color: string; sortOrder: number; active: boolean;
  businessId: string; createdAt: string; updatedAt: string;
  services?: Service[];
}

export interface Resource { id: string; businessId: string; name: string; active: boolean; createdAt: string; updatedAt: string }

export interface Location { id: string; businessId: string; name: string; address?: string | null; phone?: string | null; timezone?: string | null; active: boolean; taxProvince?: string | null; taxRatePercent?: number | null; requireDeposit?: boolean | null; depositPercent?: number | null; createdAt: string; updatedAt: string }

export interface InvoiceLineItem { description: string; quantity: number; unitCents: number; amountCents: number }
export interface Invoice {
  id: string; businessId: string; clientId?: string | null; number: number;
  locationId?: string | null;
  status: "DRAFT" | "SENT" | "PAID" | "VOID"; lineItems: InvoiceLineItem[]; notes?: string | null;
  currency: string; subtotalCents: number; taxRatePercent: number; taxCents: number; totalCents: number;
  discountCents?: number; discountLabel?: string | null;
  paymentTerms?: string | null; poNumber?: string | null; billingAddress?: string | null;
  dueAt?: string | null; createdAt: string; updatedAt: string;
  client?: { id: string; name: string; email: string; phone?: string | null } | null;
  business?: { name: string; email?: string | null; phone?: string | null; address?: string | null; taxNumber?: string | null; currency: string } | null;
}

export type InvoiceCreatePayload = {
  clientId?: string | null; locationId?: string | null; notes?: string | null; dueAt?: string | null;
  lineItems: { description: string; quantity: number; unitCents: number }[];
  taxRatePercent?: number | null; discountCents?: number; discountLabel?: string | null;
  paymentTerms?: string | null; poNumber?: string | null; billingAddress?: string | null;
}

export interface SystemError {
  id: string; businessId?: string | null; category: string; severity: string;
  message: string; stack?: string | null; context: Record<string, unknown>;
  resolved: boolean; resolvedAt?: string | null; createdAt: string;
}

export type ServiceLocationMode = "IN_PERSON" | "VIRTUAL" | "CUSTOMER" | "PHONE";

export interface Service {
  id: string; name: string; description?: string;
  durationMinutes: number; priceCents: number;
  priceType?: "FLAT" | "PER_HOUR" | "STARTING_AT";
  // How the service is delivered. Drives the booking flow + reminders.
  locationMode?: ServiceLocationMode;
  virtualMeetingUrl?: string | null;
  capacity?: number; resourceId?: string | null;
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
  bio?: string; avatarUrl?: string; active: boolean; permissions?: string[]; locationId?: string | null;
  // All branches this provider works at (multi-location). locationId is the primary/home branch.
  staffLocations?: { locationId: string }[];
  createdAt: string; updatedAt: string;
  user: { name: string; email?: string; phone?: string; role?: string };
  staffServices: StaffService[];
  availabilityRules?: AvailabilityRule[];
}

export interface Slot {
  startsAt: string; endsAt: string; startsAtLocal: string; endsAtLocal: string;
}

export interface Client {
  id: string; name: string; email?: string | null; phone?: string; notes?: string; tags?: string[]; birthday?: string;
  businessId: string; createdAt: string; updatedAt: string;
  isBlocked?: boolean; blockedReason?: string | null;
  marketingOptOut?: boolean;
}

export interface ClientWithStats extends Client {
  totalVisits: number; lastVisit?: string; totalSpentCents: number;
}

export interface Appointment {
  id: string; startsAt: string; endsAt: string; status: string;
  notes?: string; cancelReason?: string;
  depositCents?: number; totalPriceCents?: number; stripePaymentIntentId?: string;
  intakeAnswers?: IntakeAnswer[];
  businessId: string;
  createdAt: string; updatedAt: string;
  client: Client;
  service: Service;
  staff: StaffMember;
  business: Business;
  location?: { id: string; name: string; address?: string | null } | null;
  // Delivery mode snapshot + virtual link / mobile address for this appointment.
  locationMode?: ServiceLocationMode | null;
  meetingUrl?: string | null;
  customerAddress?: string | null;
  // HMAC token for the public manage link (present on client-facing responses:
  // booking confirmation, guest lookup, client portal).
  manageToken?: string;
}

export interface TimeOff {
  id: string; staffId: string; startsAt: string; endsAt: string; reason?: string; createdAt: string;
}

export interface Package {
  id: string; businessId: string; name: string;
  serviceId?: string | null; credits: number; priceCents: number;
  active: boolean; createdAt: string;
}
export type PackageStatus = "ACTIVE" | "USED" | "EXPIRED" | "VOID";
export interface ClientPackage {
  id: string; businessId: string; packageId?: string | null; clientId: string;
  name: string; serviceId?: string | null;
  creditsTotal: number; creditsRemaining: number;
  status: PackageStatus; expiresAt?: string | null; createdAt: string;
  client?: { id: string; name: string; email: string };
  redemptions?: { id: string; appointmentId?: string | null; createdAt: string }[];
}

export type GiftCardStatus = "ACTIVE" | "REDEEMED" | "VOID";
export interface GiftCard {
  id: string; businessId: string; code: string;
  initialCents: number; balanceCents: number;
  recipientName?: string | null; recipientEmail?: string | null;
  purchaserName?: string | null; message?: string | null;
  status: GiftCardStatus; createdAt: string; expiresAt?: string | null;
  redemptions?: { id: string; amountCents: number; appointmentId?: string | null; createdAt: string }[];
}

export type CampaignChannel = "EMAIL" | "SMS";
export type CampaignAudience = "ALL" | "RECENT" | "LAPSED";
export interface Campaign {
  id: string; businessId: string; name: string;
  channel: CampaignChannel; audience: CampaignAudience;
  subject?: string | null; body: string;
  status: "DRAFT" | "SENDING" | "SENT";
  recipientCount: number; sentCount: number;
  createdAt: string; sentAt?: string | null;
}

export type VerificationStatus = "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED";

export interface PromoCode {
  id: string; businessId: string; code: string; discountType: "PERCENT" | "FLAT";
  discountValue: number; maxUsages: number | null; usageCount: number;
  expiresAt: string | null; active: boolean; createdAt: string;
}
export interface MembershipPlan {
  id: string; businessId: string; name: string; description?: string | null;
  priceMonthly: number; active: boolean; createdAt: string;
}
export type MembershipStatus = "PENDING" | "ACTIVE" | "CANCELLED" | "EXPIRED" | "PAST_DUE";
export interface MembershipMember {
  id: string; businessId: string; clientId: string; planId: string; status: MembershipStatus;
  currentPeriodEnd?: string | null; cancelAtPeriodEnd?: boolean; cancelledAt?: string | null; createdAt: string;
  client: { id: string; name: string; email?: string | null; phone?: string | null };
  plan: { id: string; name: string; priceMonthly: number };
}
export type PaymentKind = "DEPOSIT" | "NO_SHOW_FEE" | "LATE_CANCEL_FEE" | "IN_PERSON" | "OTHER";
export type PaymentStatus = "PENDING" | "SUCCEEDED" | "FAILED" | "CANCELED" | "REFUNDED" | "PARTIALLY_REFUNDED";

export type MigrationSourcePlatform =
  | "square-appointments"
  | "jane-app"
  | "vagaro"
  | "acuity-scheduling"
  | "calendly"
  | "fresha"
  | "glossgenius"
  | "mindbody"
  | "setmore"
  | "google-contacts"
  | "phone-contacts"
  | "csv"
  | "other"
  | "starting-fresh";
export type MigrationMode = "SELF_SERVICE" | "DONE_FOR_YOU" | "ASSISTED_CALL";
export interface MigrationImportRow {
  id: string;
  rowNumber: number;
  status: "VALID" | "INVALID" | "DUPLICATE" | "IMPORTED" | string;
  raw: Record<string, unknown>;
  normalized: { name?: string; email?: string; phone?: string; notes?: string; tags?: string[] };
  errors: string[];
  warnings: string[];
  duplicateClientId?: string | null;
  importedClientId?: string | null;
  createdAt: string;
}
export interface MigrationImportBatch {
  id: string;
  businessId: string;
  requestId?: string | null;
  sourcePlatform: MigrationSourcePlatform | string;
  fileName?: string | null;
  status: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  importedRows: number;
  confidenceScore: number;
  summary: Record<string, unknown>;
  rows?: MigrationImportRow[];
  createdAt: string;
  importedAt?: string | null;
}
export interface MigrationRequest {
  id: string;
  businessId: string;
  sourcePlatform: MigrationSourcePlatform | string;
  mode: MigrationMode | string;
  status: string;
  approximateSize?: number | null;
  requestedHelp: boolean;
  notes?: string | null;
  batches?: MigrationImportBatch[];
  createdAt: string;
  updatedAt: string;
}
export interface RefundRow {
  id: string; amountCents: number; reason?: string | null; status: string; createdAt: string;
}
export interface Payment {
  id: string; businessId: string; amountCents: number; tipCents?: number; taxCents?: number; currency: string;
  kind: PaymentKind; status: PaymentStatus; refundedCents: number;
  description?: string | null; stripePaymentIntentId?: string | null; receiptUrl?: string | null; createdAt: string;
  client?: { id: string; name: string; email: string } | null;
  appointment?: { id: string; startsAt: string } | null;
  refunds?: RefundRow[];
}

export type NotificationKind = "BOOKING_NEW" | "BOOKING_UPDATE" | "PAYMENT" | "SYSTEM";
export interface NotificationItem {
  id: string; kind: NotificationKind; title: string; body?: string | null;
  linkUrl?: string | null; read: boolean; createdAt: string;
}
export interface NotificationDelivery {
  id: string; businessId?: string | null; userId?: string | null;
  channel: "EMAIL" | "SMS" | "PUSH";
  recipient: string; type: string; status: "SENT" | "FAILED" | "SKIPPED";
  error?: string | null; createdAt: string;
  canRetry?: boolean; retryReason?: string | null;
}

export interface DashboardOverview {
  timezone: string;
  verificationStatus: VerificationStatus;
  setup: { hasService: boolean; stripeConnected: boolean; hasBooking: boolean; isVerified: boolean } | null;
  today: Appointment[];
  upcoming: Appointment[];
  metrics: {
    weekRevenue: number;
    completedThisWeek: number;
    newClientsThisMonth: number;
    pendingBookings: number;
    cancelledThisWeek: number;
    noShowsThisMonth: number;
    topService: string | null;
    unreadNotifications: number;
    unreadMessages: number;
    unreadThreads: number;
    failedPayments: number;
    waitlistCount: number;
    failedDeliveries: number;
  };
}

export type PlanTier = "FREE" | "BASIC" | "PRO" | "UNLIMITED";

export interface AdminOverview {
  generatedAt: string;
  metrics: {
    totalBusinesses: number;
    totalUsers: number;
    totalClients: number;
    pendingVerifications: number;
    activeSubscriptions: number;
    upcomingAppointments: number;
    recentAppointments: number;
    grossRevenueCents: number;
    refundedCents: number;
    netRevenueCents: number;
    successfulPayments: number;
    flaggedDuplicates: number;
    newBusinessesThisPeriod: number;
    newUsersThisPeriod: number;
  };
  trends: {
    revenueTrendPct: number | null;
    bizGrowthPct: number | null;
    userGrowthPct: number | null;
  };
  planCounts: Record<PlanTier, number>;
  verificationCounts: Record<VerificationStatus, number>;
  recentBusinesses: Array<{
    id: string;
    name: string;
    email: string;
    slug: string;
    plan: PlanTier;
    verificationStatus: VerificationStatus;
    suspended: boolean;
    createdAt: string;
    subscription?: {
      status: string;
      currentPeriodEnd?: string | null;
      cancelAtPeriodEnd: boolean;
    } | null;
  }>;
}

export interface AdminBusiness {
  id: string;
  name: string;
  email: string;
  slug: string;
  plan: PlanTier;
  verificationStatus: VerificationStatus;
  suspended: boolean;
  createdAt: string;
  phone: string | null;
  complimentaryPlanExpiresAt?: string | null;
  complimentaryPreviousPlan?: PlanTier | null;
  subscription?: { status: string; currentPeriodEnd?: string | null; cancelAtPeriodEnd: boolean } | null;
  _count: { appointments: number; staff: number; clients: number };
}

export interface AdminBusinessList {
  businesses: AdminBusiness[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface AdminAuditEntry {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  userId: string | null;
  changes: Record<string, unknown> | null;
  createdAt: string;
  user: { id: string; name: string; email: string } | null;
}

export interface AdminAuditLogResult {
  logs: AdminAuditEntry[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}
export interface FlaggedDuplicate {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  slug: string;
  createdAt: string;
  verificationNote: string | null;
  suspectedDuplicateOfId: string | null;
  duplicateOf: { id: string; name: string; email: string; phone: string | null; createdAt: string } | null;
}
export interface DeviceToken {
  id: string; platform: string; enabled: boolean; createdAt: string; updatedAt: string;
}

export interface TaskItem {
  id: string; title: string; notes?: string | null; dueAt?: string | null;
  status: "OPEN" | "DONE"; staffId?: string | null;
  staff?: { user: { name: string } } | null;
  createdAt: string; completedAt?: string | null;
}

export interface ServiceDueItem {
  id: string; clientId: string; serviceId?: string | null;
  cadenceDays?: number | null; dueAt: string; status: "SCHEDULED" | "DUE" | "CANCELLED";
  client: { id: string; name: string; email: string };
  service?: { id: string; name: string } | null;
}

// ── API client ────────────────────────────────────────────────────────────────

export interface SearchHit { type: string; id: string; label: string; sublabel?: string; href: string }
export interface SearchGroup { type: string; label: string; hits: SearchHit[] }

export const api = {
  get: <T>(path: string) => req<T>(path),
  events: {
    // Short-lived ticket for the realtime socket handshake (see useEvents).
    wsTicket: () => req<{ ticket: string }>("/events/ws-ticket"),
  },
  search: {
    // Global dashboard search across the owner's business data.
    global: (q: string) =>
      req<{ query: string; groups: SearchGroup[] }>(`/search?q=${encodeURIComponent(q)}`),
  },
  auth: {
    login: (email: string, password: string) =>
      req<{ accessToken: string; refreshToken: string; user: { id: string; name: string; email: string; role: string } }>(
        "/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }
      ),
    // Public — confirm email from the emailed link.
    verifyEmail: (token: string) =>
      req<{ ok: boolean; role?: string }>("/auth/verify-email", { method: "POST", body: JSON.stringify({ token }) }, null),
    // Authenticated — resend the verification link to the current user.
    resendVerification: () =>
      req<{ ok: boolean; alreadyVerified?: boolean }>("/auth/resend-verification", { method: "POST" }),
    register: (data: {
      name: string;
      email: string;
      password: string;
      role?: string;
      businessId?: string;
      privacyConsentAccepted: true;
      marketingConsent?: boolean;
      trackingConsent?: boolean;
      consentVersion?: string;
    }) =>
      req<{ accessToken: string; refreshToken: string; user: { id: string; name: string; email: string; role: string } }>(
        "/auth/register", { method: "POST", body: JSON.stringify(data) }
      ),
    changePassword: (currentPassword: string, newPassword: string) =>
      req<{ ok: boolean }>("/auth/change-password", { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) }),
    // Turn two-factor sign-in on/off and pick the delivery method. Enabling
    // returns one-time recovery codes (shown once) for lockout recovery.
    setTwoFactor: async (enabled: boolean, method: "EMAIL" | "SMS" | undefined, currentPassword: string) => {
      type TwoFactorResult = { ok: boolean; twoFactorEnabled: boolean; recoveryCodes?: string[]; user?: { id: string; name: string; email: string; role: string; businessId: string | null; staffId: string | null; mustResetPassword: boolean; twoFactorEnabled?: boolean; twoFactorMethod?: "EMAIL" | "SMS" } };
      const doFetch = () => fetch("/proxy/auth/2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
        body: JSON.stringify({ enabled, method, currentPassword }),
      });
      let res = await doFetch();
      if (res.status === 401) {
        const refreshed = await tryRefresh();
        if (refreshed) res = await doFetch();
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(body.message ?? "Could not update two-factor");
      }
      return res.json() as Promise<TwoFactorResult>;
    },
  },

  uploads: {
    // Owner — upload an image (multipart). Returns a same-origin URL the app can
    // render directly (resolves through /proxy to the API's public /uploads/:id).
    upload: async (file: File, kind: "LOGO" | "AVATAR" | "COVER" | "OTHER" = "OTHER"): Promise<{ id: string; url: string }> => {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("kind", kind);
      const res = await fetch("/proxy/uploads", {
        method: "POST",
        body: fd, // let the browser set the multipart boundary
        headers: { "X-Requested-With": "XMLHttpRequest" },
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({})) as { message?: string };
        throw new Error(b.message ?? "Upload failed");
      }
      const data = await res.json() as { id: string; url: string };
      return { id: data.id, url: `/proxy${data.url}` };
    },
  },

  users: {
    // The signed-in user's own profile (account page).
    me: () => req<{ id: string; email: string; name: string; phone?: string | null; role: string; businessId: string | null; avatarUrl?: string | null; locale?: "en" | "fr"; createdAt: string }>("/users/me"),
    updateMe: (data: { name?: string; phone?: string | null; avatarUrl?: string | null; locale?: "en" | "fr" }) =>
      req<{ id: string; email: string; name: string; phone?: string | null; role: string; businessId: string | null; avatarUrl?: string | null; locale?: "en" | "fr" }>("/users/me", { method: "PATCH", body: JSON.stringify(data) }),
  },

  notifications: {
    list: () => req<NotificationItem[]>("/notifications"),
    unreadCount: () => req<{ count: number }>("/notifications/unread-count"),
    deliveries: (filters?: { status?: string; channel?: string; search?: string; limit?: number }) => {
      const params = new URLSearchParams();
      if (filters?.status && filters.status !== "ALL") params.set("status", filters.status);
      if (filters?.channel && filters.channel !== "ALL") params.set("channel", filters.channel);
      if (filters?.search?.trim()) params.set("search", filters.search.trim());
      if (filters?.limit) params.set("limit", String(filters.limit));
      const qs = params.toString();
      return req<NotificationDelivery[]>(`/notifications/deliveries${qs ? `?${qs}` : ""}`);
    },
    markRead: (id: string) => req<{ ok: boolean }>(`/notifications/${id}/read`, { method: "POST" }),
    markAllRead: () => req<{ ok: boolean }>("/notifications/read-all", { method: "POST" }),
    clear: () => req<{ ok: boolean }>("/notifications", { method: "DELETE" }),
  },

  devices: {
    list: () => req<DeviceToken[]>("/users/me/device-tokens"),
    setEnabled: (id: string, enabled: boolean) =>
      req<{ ok: boolean }>("/users/me/device-token", { method: "PATCH", body: JSON.stringify({ id, enabled }) }),
  },

  subscriptions: {
    get: () => req<{ plan: string; status: string | null; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean; hasBilling: boolean }>("/subscriptions"),
    checkout: (plan: "BASIC" | "PRO" | "UNLIMITED", referralCode?: string, billingInterval: "month" | "year" = "month") =>
      req<{ url?: string; updated?: boolean; plan?: string }>("/subscriptions/checkout", { method: "POST", body: JSON.stringify({ plan, billingInterval, ...(referralCode?.trim() ? { referralCode: referralCode.trim() } : {}) }) }),
    confirmCheckout: (sessionId: string) =>
      req<{ confirmed: boolean; plan?: string; status?: string; reason?: string }>("/subscriptions/confirm-checkout", { method: "POST", body: JSON.stringify({ sessionId }) }),
    portal: () => req<{ url: string }>("/subscriptions/portal", { method: "POST" }),
  },
  referrals: {
    // The current business's shareable code + who they've referred.
    get: () => req<{ code: string; referredCount: number; referrals: { business: string; since: string; status: string }[] }>("/referrals"),
  },
  verification: {
    status: (businessId: string) =>
      req<{ verificationStatus: VerificationStatus; verificationDocUrl: string | null; verificationGovernmentIdUrl: string | null; verificationLegalName: string | null; verificationAddress: string | null; verificationPhone: string | null; verificationNote: string | null; verificationSubmittedAt: string | null; verifiedAt: string | null }>(`/businesses/${businessId}/verification`),
    submit: (businessId: string, data: { legalName: string; address: string; phone: string; governmentIdUrl: string; registrationDocUrl: string }) =>
      req<{ verificationStatus: VerificationStatus }>(`/businesses/${businessId}/verification`, { method: "POST", body: JSON.stringify(data) }),
  },
  calendarSync: {
    // Returns the Google OAuth consent URL to connect the owner's calendar.
    connect: () => req<{ url: string }>("/calendar-sync/google/connect"),
    status: () => req<{ connected: boolean; email: string | null; since: string | null; configured: boolean }>("/calendar-sync/google/status"),
    disconnect: () => req<{ ok: boolean }>("/calendar-sync/google/disconnect", { method: "POST" }),
    // iCal feed URL — returns the full URL to download/subscribe to the appointment feed.
    icalFeedUrl: () => `/proxy/calendar-sync/ical/feed`,
  },
  // Platform admin (Role.ADMIN) — review the business-verification queue.
  admin: {
    overview: () => req<AdminOverview>("/admin/overview"),
    suspendBusiness: (id: string) => req<{ suspended: boolean }>(`/admin/businesses/${id}/suspend`, { method: "POST" }),
    unsuspendBusiness: (id: string) => req<{ suspended: boolean }>(`/admin/businesses/${id}/unsuspend`, { method: "POST" }),
    setPlan: (id: string, plan: string) => req<{ id: string; plan: string }>(`/admin/businesses/${id}/plan`, { method: "PATCH", body: JSON.stringify({ plan }) }),
    grantComplimentaryPlan: (id: string, plan: "PRO" | "UNLIMITED", months: number) =>
      req<{ id: string; plan: PlanTier; complimentaryPlanExpiresAt: string; complimentaryPreviousPlan: PlanTier }>(
        `/admin/businesses/${id}/complimentary-plan`,
        { method: "POST", body: JSON.stringify({ plan, months }) },
      ),
    listBusinesses: (params: { page?: number; limit?: number; search?: string; plan?: string; verificationStatus?: string; suspended?: boolean; sortBy?: string; sortDir?: string }) => {
      const q = new URLSearchParams();
      if (params.page) q.set("page", String(params.page));
      if (params.limit) q.set("limit", String(params.limit));
      if (params.search) q.set("search", params.search);
      if (params.plan) q.set("plan", params.plan);
      if (params.verificationStatus) q.set("verificationStatus", params.verificationStatus);
      if (params.suspended !== undefined) q.set("suspended", String(params.suspended));
      if (params.sortBy) q.set("sortBy", params.sortBy);
      if (params.sortDir) q.set("sortDir", params.sortDir);
      return req<AdminBusinessList>(`/admin/businesses?${q.toString()}`);
    },
    auditLog: (params: { page?: number; limit?: number; entityType?: string; action?: string }) => {
      const q = new URLSearchParams();
      if (params.page) q.set("page", String(params.page));
      if (params.limit) q.set("limit", String(params.limit));
      if (params.entityType) q.set("entityType", params.entityType);
      if (params.action) q.set("action", params.action);
      return req<AdminAuditLogResult>(`/admin/audit-log?${q.toString()}`);
    },
    lookupUser: (email: string) => req<{ id: string; email: string; name: string; role: string; createdAt: string; emailVerified: boolean; business: { id: string; name: string; plan: string; suspended: boolean } | null; lockStatus: { locked: boolean; failCount: number; lockTtlSeconds: number } }>("/admin/users/lookup", { method: "POST", body: JSON.stringify({ email }) }),
    unlockUser: (email: string) => req<{ ok: boolean; message: string }>("/admin/users/unlock", { method: "POST", body: JSON.stringify({ email }) }),
    sendPasswordReset: (email: string) => req<{ ok: boolean; message: string }>("/admin/users/send-reset", { method: "POST", body: JSON.stringify({ email }) }),
    onboardingFunnel: () => req<{
      total: number;
      totals: { signedUp: number; addedService: number; addedStaff: number; stripeConnected: number; firstBooking: number; verified: number };
      businesses: { id: string; name: string; plan: string; createdAt: string; signedUp: boolean; addedService: boolean; addedStaff: boolean; stripeConnected: boolean; firstBooking: boolean; verified: boolean }[];
    }>("/admin/onboarding/funnel"),
  },
  adminVerifications: {
    list: () => req<{ id: string; name: string; email: string; slug: string; verificationDocUrl: string | null; verificationGovernmentIdUrl: string | null; verificationLegalName: string | null; verificationAddress: string | null; verificationPhone: string | null; verificationSubmittedAt: string | null }[]>("/admin/verifications"),
    approve: (id: string) => req<{ verificationStatus: VerificationStatus }>(`/admin/verifications/${id}/approve`, { method: "POST" }),
    reject: (id: string, note?: string) => req<{ verificationStatus: VerificationStatus }>(`/admin/verifications/${id}/reject`, { method: "POST", body: JSON.stringify({ note }) }),
    duplicates: () => req<FlaggedDuplicate[]>("/admin/verifications/duplicates"),
    dismissDuplicate: (id: string) => req<{ ok: boolean }>(`/admin/verifications/${id}/duplicate-reviewed`, { method: "POST" }),
  },

  payments: {
    bookingIntent: (appointmentId: string, businessId: string, manageToken: string) =>
      req<{ required: boolean; mode?: "payment" | "setup" | "none"; clientSecret?: string; amountCents?: number; publishableKey?: string; currency?: "CAD" | "USD" }>(
        "/payments/booking-intent", { method: "POST", body: JSON.stringify({ appointmentId, businessId, manageToken }) }, null),
    // Owner — charge the configured no-show fee on the saved card.
    chargeNoShow: (appointmentId: string) =>
      req<{ charged: boolean; feeCents: number; message?: string }>(`/payments/no-show/${appointmentId}`, { method: "POST" }),
    // Owner/Admin — create a PaymentIntent for an in-person / POS charge (used by mobile checkout).
    charge: (amountCents: number, tipCents?: number, description?: string, idempotencyKey?: string) =>
      req<{ paymentIntentId: string; clientSecret: string; amountCents: number; publishableKey: string }>("/payments/charge", {
        method: "POST",
        body: JSON.stringify({ amountCents, ...(tipCents ? { tipCents } : {}), ...(description ? { description } : {}), ...(idempotencyKey ? { idempotencyKey } : {}) }),
      }),
    // Owner — the business payment ledger (deposits, fees, in-person charges + refunds).
    list: () => req<Payment[]>("/payments"),
    // Owner — refund a payment (omit amountCents for a full refund of the remaining balance).
    refund: (paymentId: string, amountCents?: number, reason?: string) =>
      req<{ refundedCents: number; status: PaymentStatus }>(`/payments/${paymentId}/refund`, {
        method: "POST",
        body: JSON.stringify({ ...(amountCents ? { amountCents } : {}), ...(reason ? { reason } : {}) }),
      }),
  },

  connect: {
    // Start or resume Stripe Connect Express onboarding.
    onboard: () => req<{ url: string; accountId: string }>("/payments/connect/onboard", { method: "POST" }),
    // Get Connect account status + balance.
    status: () => req<{ onboarded: boolean; chargesEnabled: boolean; accountId: string | null; available: { amount: number; currency: string }[]; pending: { amount: number; currency: string }[] }>("/payments/connect/status"),
    // Open the Stripe Express dashboard.
    dashboard: () => req<{ url: string }>("/payments/connect/dashboard", { method: "POST" }),
    // Trigger a manual or instant payout.
    payout: (amountCents: number, instant = false, currency?: string, idempotencyKey = crypto.randomUUID()) =>
      req<{ payoutId: string; status: string; amountCents: number; currency: string }>("/payments/connect/payout", {
        method: "POST",
        body: JSON.stringify({ amountCents, instant, idempotencyKey, ...(currency ? { currency } : {}) }),
      }),
  },

  waitlist: {
    // Public — clients join when no slot fits.
    join: (businessId: string, data: { name: string; email: string; phone?: string; serviceId?: string; staffId?: string; locationId?: string; desiredDate?: string; notes?: string; locale?: "en" | "fr" }) =>
      req<{ id: string }>(`/businesses/${businessId}/waitlist`, { method: "POST", body: JSON.stringify(data) }, null),
    list: (businessId: string, locationIds?: string[]) =>
      req<Array<{ id: string; name: string; email: string; phone?: string | null; serviceId?: string | null; desiredDate?: string | null; notes?: string | null; status: "WAITING" | "NOTIFIED" | "CONVERTED" | "CANCELLED"; createdAt: string }>>(`/businesses/${businessId}/waitlist${locationIds?.length ? `?locationIds=${encodeURIComponent(locationIds.join(","))}` : ""}`),
    remove: (businessId: string, id: string) =>
      req<void>(`/businesses/${businessId}/waitlist/${id}`, { method: "DELETE" }),
  },

  reviews: {
    // Public — published reviews + aggregate (booking page social proof).
    list: (businessId: string) =>
      req<{ reviews: Array<{ id: string; clientName: string; rating: number; comment?: string | null; createdAt: string }>; average: number; count: number }>(
        `/businesses/${businessId}/reviews`, undefined, null),
    // Public — submit from the post-visit email link (token proves the link is ours).
    submit: (businessId: string, data: { appointmentId: string; rating: number; comment?: string; token?: string }) =>
      req<{ id: string }>(`/businesses/${businessId}/reviews`, { method: "POST", body: JSON.stringify(data) }, null),
    // Owner — all reviews + moderation.
    ownerList: (businessId: string) =>
      req<Array<{ id: string; clientName: string; rating: number; comment?: string | null; published: boolean; createdAt: string }>>(`/businesses/${businessId}/reviews/all`),
    moderate: (businessId: string, id: string, published: boolean) =>
      req<void>(`/businesses/${businessId}/reviews/${id}`, { method: "PATCH", body: JSON.stringify({ published }) }),
  },

  packages: {
    // Package products (templates)
    list: (businessId: string) =>
      req<Package[]>(`/businesses/${businessId}/packages`),
    create: (businessId: string, data: { name: string; serviceId?: string; credits: number; priceCents: number; active?: boolean }) =>
      req<Package>(`/businesses/${businessId}/packages`, { method: "POST", body: JSON.stringify(data) }),
    update: (businessId: string, id: string, data: Partial<{ name: string; serviceId: string; credits: number; priceCents: number; active: boolean }>) =>
      req<Package>(`/businesses/${businessId}/packages/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    remove: (businessId: string, id: string) =>
      req<void>(`/businesses/${businessId}/packages/${id}`, { method: "DELETE" }),
    // Issued client packages
    listIssued: (businessId: string, clientId?: string) =>
      req<ClientPackage[]>(`/businesses/${businessId}/packages/issued/list${clientId ? `?clientId=${encodeURIComponent(clientId)}` : ""}`),
    issue: (businessId: string, data: { clientId: string; packageId?: string; name?: string; serviceId?: string; credits?: number; expiresAt?: string }) =>
      req<ClientPackage>(`/businesses/${businessId}/packages/issued`, { method: "POST", body: JSON.stringify(data) }),
    redeem: (businessId: string, id: string, appointmentId?: string) =>
      req<{ creditsRemaining: number; status: PackageStatus }>(`/businesses/${businessId}/packages/issued/${id}/redeem`, { method: "POST", body: JSON.stringify({ appointmentId }) }),
    void: (businessId: string, id: string) =>
      req<ClientPackage>(`/businesses/${businessId}/packages/issued/${id}/void`, { method: "POST" }),
  },

  giftCards: {
    list: (businessId: string) =>
      req<GiftCard[]>(`/businesses/${businessId}/gift-cards`),
    issue: (businessId: string, data: { amountCents: number; recipientName?: string; recipientEmail?: string; purchaserName?: string; message?: string; expiresAt?: string; locale?: "en" | "fr" }) =>
      req<GiftCard>(`/businesses/${businessId}/gift-cards`, { method: "POST", body: JSON.stringify(data) }),
    redeem: (businessId: string, data: { code: string; amountCents: number; appointmentId?: string }) =>
      req<{ redeemedCents: number; balanceCents: number; status: GiftCardStatus }>(`/businesses/${businessId}/gift-cards/redeem`, { method: "POST", body: JSON.stringify(data) }),
    void: (businessId: string, id: string) =>
      req<GiftCard>(`/businesses/${businessId}/gift-cards/${id}/void`, { method: "POST" }),
    // Public — client checks a balance by code.
    balance: (businessId: string, code: string) =>
      req<{ code: string; balanceCents: number; status: GiftCardStatus; expiresAt?: string | null }>(`/businesses/${businessId}/gift-cards/balance?code=${encodeURIComponent(code)}`, undefined, null),
  },

  campaigns: {
    list: (businessId: string) =>
      req<Campaign[]>(`/businesses/${businessId}/campaigns`),
    audienceCount: (businessId: string, channel: CampaignChannel, audience: CampaignAudience) => {
      const q = new URLSearchParams({ channel, audience });
      return req<{ count: number }>(`/businesses/${businessId}/campaigns/audience?${q}`);
    },
    create: (businessId: string, data: { name: string; channel: CampaignChannel; audience: CampaignAudience; subject?: string; body: string }) =>
      req<Campaign>(`/businesses/${businessId}/campaigns`, { method: "POST", body: JSON.stringify(data) }),
    send: (businessId: string, id: string) =>
      req<Campaign>(`/businesses/${businessId}/campaigns/${id}/send`, { method: "POST" }),
    remove: (businessId: string, id: string) =>
      req<void>(`/businesses/${businessId}/campaigns/${id}`, { method: "DELETE" }),
  },

  business: {
    get: (id: string) => req<Business>(`/businesses/${id}`),
    dashboardOverview: (id: string, locationId?: string) =>
      req<DashboardOverview>(`/businesses/${id}/dashboard-overview${locationId ? `?locationId=${encodeURIComponent(locationId)}` : ""}`),
    getBySlug: (slug: string) => req<Business>(`/businesses/slug/${slug}`),
    getPublicById: (id: string) => req<Business>(`/businesses/public/${id}`, undefined, null),
    update: (id: string, data: Partial<Omit<Business, "id" | "createdAt" | "updatedAt" | "plan" | "planExpiresAt" | "suspended" | "verificationStatus" | "stripeConnectOnboarded" | "capabilities" | "suspectedDuplicateOfId">>) =>
      req<Business>(`/businesses/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    dismissOnboarding: (id: string) => req<{ ok: boolean }>(`/businesses/${id}/dismiss-onboarding`, { method: "POST" }),
    deactivate: (id: string) => req<Business>(`/businesses/${id}/deactivate`, { method: "POST" }),
    reactivate: (id: string) => req<Business>(`/businesses/${id}/reactivate`, { method: "POST" }),
    remove: (id: string, confirmation: string) =>
      req<{ deleted: boolean }>(`/businesses/${id}`, { method: "DELETE", body: JSON.stringify({ confirmation }) }),
    getHours: (id: string, locationId?: string) =>
      req<{ hours: { id: string; dayOfWeek: number; startTime: string; endTime: string }[]; closures: { id: string; startsAt: string; endsAt: string; reason?: string }[] }>(`/businesses/${id}/hours${locationId ? `?locationId=${encodeURIComponent(locationId)}` : ""}`),
    setHours: (id: string, hours: { dayOfWeek: number; startTime: string; endTime: string }[], locationId?: string) =>
      req<{ hours: { id: string; dayOfWeek: number; startTime: string; endTime: string }[]; closures: { id: string; startsAt: string; endsAt: string; reason?: string }[] }>(`/businesses/${id}/hours${locationId ? `?locationId=${encodeURIComponent(locationId)}` : ""}`, { method: "POST", body: JSON.stringify({ hours }) }),
    addClosure: (id: string, data: { startsAt: string; endsAt: string; reason?: string }, locationId?: string) =>
      req<{ id: string; startsAt: string; endsAt: string; reason?: string }>(`/businesses/${id}/closures${locationId ? `?locationId=${encodeURIComponent(locationId)}` : ""}`, { method: "POST", body: JSON.stringify(data) }),
    removeClosure: (id: string, closureId: string) =>
      req<{ ok: boolean }>(`/businesses/${id}/closures/${closureId}`, { method: "DELETE" }),
  },

  services: {
    list: (businessId: string, locationIds?: string[]) => {
      const q = locationIds?.length ? `?locationIds=${encodeURIComponent(locationIds.join(","))}` : "";
      return req<Service[]>(`/businesses/${businessId}/services${q}`);
    },
    listAll: (businessId: string, locationIds?: string[]) => {
      const q = locationIds?.length ? `?locationIds=${encodeURIComponent(locationIds.join(","))}` : "";
      return req<Service[]>(`/businesses/${businessId}/services/all${q}`);
    },
    get: (businessId: string, id: string) => req<Service>(`/businesses/${businessId}/services/${id}`),
    locationOverrides: (businessId: string, id: string) =>
      req<{ locationId: string; enabled: boolean; priceCents: number | null }[]>(`/businesses/${businessId}/services/${id}/locations`),
    setLocationOverrides: (businessId: string, id: string, overrides: { locationId: string; enabled: boolean; priceCents: number | null }[]) =>
      req<{ locationId: string; enabled: boolean; priceCents: number | null }[]>(`/businesses/${businessId}/services/${id}/locations`, { method: "PUT", body: JSON.stringify({ overrides }) }),
    create: (businessId: string, data: Omit<Partial<Service>, "id" | "businessId" | "createdAt" | "updatedAt">) =>
      req<Service>(`/businesses/${businessId}/services`, { method: "POST", body: JSON.stringify(data) }),
    update: (businessId: string, id: string, data: Omit<Partial<Service>, "id" | "businessId" | "createdAt" | "updatedAt">) =>
      req<Service>(`/businesses/${businessId}/services/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    remove: (businessId: string, id: string) =>
      req<void>(`/businesses/${businessId}/services/${id}`, { method: "DELETE" }),
  },

  resources: {
    list: (businessId: string) => req<Resource[]>(`/businesses/${businessId}/resources`),
    create: (businessId: string, data: { name: string }) =>
      req<Resource>(`/businesses/${businessId}/resources`, { method: "POST", body: JSON.stringify(data) }),
    update: (businessId: string, id: string, data: { name?: string; active?: boolean }) =>
      req<Resource>(`/businesses/${businessId}/resources/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    remove: (businessId: string, id: string) =>
      req<{ ok: boolean }>(`/businesses/${businessId}/resources/${id}`, { method: "DELETE" }),
  },

  locations: {
    list: (businessId: string) => req<Location[]>(`/businesses/${businessId}/locations`),
    create: (businessId: string, data: { name: string; address?: string; phone?: string; timezone?: string; taxProvince?: string | null; taxRatePercent?: number | null; requireDeposit?: boolean | null; depositPercent?: number | null }) =>
      req<Location>(`/businesses/${businessId}/locations`, { method: "POST", body: JSON.stringify(data) }),
    update: (businessId: string, id: string, data: { name?: string; address?: string; phone?: string; timezone?: string; active?: boolean; taxProvince?: string | null; taxRatePercent?: number | null; requireDeposit?: boolean | null; depositPercent?: number | null }) =>
      req<Location>(`/businesses/${businessId}/locations/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    remove: (businessId: string, id: string) =>
      req<{ ok: boolean }>(`/businesses/${businessId}/locations/${id}`, { method: "DELETE" }),
  },

  invoices: {
    list: (businessId: string) => req<Invoice[]>(`/businesses/${businessId}/invoices`),
    get: (businessId: string, id: string) => req<Invoice>(`/businesses/${businessId}/invoices/${id}`),
    create: (businessId: string, data: InvoiceCreatePayload) =>
      req<Invoice>(`/businesses/${businessId}/invoices`, { method: "POST", body: JSON.stringify(data) }),
    update: (businessId: string, id: string, data: Partial<InvoiceCreatePayload>) =>
      req<Invoice>(`/businesses/${businessId}/invoices/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    setStatus: (businessId: string, id: string, status: "DRAFT" | "SENT" | "PAID" | "VOID") =>
      req<Invoice>(`/businesses/${businessId}/invoices/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
    sendByEmail: (businessId: string, id: string) =>
      req<{ ok: boolean; sentTo: string }>(`/businesses/${businessId}/invoices/${id}/send`, { method: "POST" }),
    remove: (businessId: string, id: string) =>
      req<{ ok: boolean }>(`/businesses/${businessId}/invoices/${id}`, { method: "DELETE" }),
  },

  systemErrors: {
    list: (params?: { resolved?: boolean; category?: string; limit?: number; businessId?: string }) => {
      const q = new URLSearchParams();
      if (params?.resolved !== undefined) q.set("resolved", String(params.resolved));
      if (params?.category) q.set("category", params.category);
      if (params?.limit) q.set("limit", String(params.limit));
      if (params?.businessId) q.set("businessId", params.businessId);
      return req<SystemError[]>(`/system-errors${q.toString() ? "?" + q.toString() : ""}`);
    },
    counts: () => req<{ critical: number; error: number; warn: number; total: number }>("/system-errors/counts"),
    resolve: (id: string) => req<{ count: number }>(`/system-errors/${id}/resolve`, { method: "PATCH" }),
    resolveAll: () => req<{ count: number }>("/system-errors/resolve-all", { method: "POST" }),
    patterns: () => req<{ category: string; total: number; critical: number; error: number; warn: number }[]>("/system-errors/patterns"),
    businessHealth: (limit?: number) => req<{ id?: string; name?: string; email?: string; plan?: string; errorCount: number }[]>(`/system-errors/business-health${limit ? "?limit=" + limit : ""}`),
    aiExplain: (category?: string) => req<{ explanation: string | null; reason?: string }>("/system-errors/ai-explain", { method: "POST", body: JSON.stringify({ category }) }),
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
    update: (businessId: string, id: string, data: { bio?: string; avatarUrl?: string; active?: boolean; permissions?: string[]; locationId?: string | null; locationIds?: string[] }) =>
      req<StaffMember>(`/businesses/${businessId}/staff/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    // force=true moves the provider's bookings to the owner, then deletes them.
    remove: (businessId: string, id: string, force?: boolean) =>
      req<{ ok: boolean }>(`/businesses/${businessId}/staff/${id}`, { method: "DELETE", ...(force ? { body: JSON.stringify({ force: true }) } : {}) }),
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
    getSlots: (params: { staffId: string; serviceId: string; additionalServiceIds?: string[]; startDate: string; endDate: string; timezone?: string; enforceNotice?: boolean; locationId?: string }) => {
      const { enforceNotice, additionalServiceIds, locationId, ...rest } = params;
      const q = new URLSearchParams(rest as Record<string, string>);
      if (additionalServiceIds?.length) q.set("additionalServiceIds", additionalServiceIds.join(","));
      if (locationId) q.set("locationId", locationId);
      if (enforceNotice === false) q.set("enforceNotice", "false");
      return req<Slot[]>(`/availability/slots?${q.toString()}`);
    },
  },

  serviceDue: {
    list: (businessId: string) => req<ServiceDueItem[]>(`/businesses/${businessId}/service-due`),
    set: (businessId: string, data: { clientId: string; serviceId?: string | null; cadenceDays?: number | null; dueAt: string }) =>
      req<ServiceDueItem>(`/businesses/${businessId}/service-due`, { method: "POST", body: JSON.stringify(data) }),
    approve: (businessId: string, id: string) =>
      req<ServiceDueItem>(`/businesses/${businessId}/service-due/${id}/approve`, { method: "POST" }),
    reschedule: (businessId: string, id: string, data: { cadenceDays?: number | null; dueAt?: string }) =>
      req<ServiceDueItem>(`/businesses/${businessId}/service-due/${id}/reschedule`, { method: "POST", body: JSON.stringify(data) }),
    cancel: (businessId: string, id: string) =>
      req<ServiceDueItem>(`/businesses/${businessId}/service-due/${id}/cancel`, { method: "POST" }),
    policies: (businessId: string) =>
      req<Array<{ id: string; name: string; serviceId?: string | null; trigger: string; delayDays: number; subject: string; body: string; enabled: boolean; service?: { name: string } | null }>>(`/businesses/${businessId}/service-due/policies`),
    createPolicy: (businessId: string, data: { name: string; serviceId?: string | null; trigger: "COMPLETED" | "MANUAL"; delayDays: number; subject: string; body: string; enabled?: boolean }) =>
      req<unknown>(`/businesses/${businessId}/service-due/policies`, { method: "POST", body: JSON.stringify(data) }),
    deletePolicy: (businessId: string, id: string) =>
      req<unknown>(`/businesses/${businessId}/service-due/policies/${id}`, { method: "DELETE" }),
  },

  tasks: {
    list: (businessId: string) => req<TaskItem[]>(`/businesses/${businessId}/tasks`),
    create: (businessId: string, data: { title: string; staffId?: string | null; notes?: string; dueAt?: string }) =>
      req<TaskItem>(`/businesses/${businessId}/tasks`, { method: "POST", body: JSON.stringify(data) }),
    update: (businessId: string, id: string, data: { title?: string; staffId?: string | null; notes?: string; dueAt?: string | null; status?: "OPEN" | "DONE" }) =>
      req<TaskItem>(`/businesses/${businessId}/tasks/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    remove: (businessId: string, id: string) =>
      req<{ ok: boolean }>(`/businesses/${businessId}/tasks/${id}`, { method: "DELETE" }),
  },

  clients: {
    list: (businessId: string, search?: string, page = 1, limit = 25, locationIds?: string[]) => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      params.set("page", String(page));
      params.set("limit", String(limit));
      if (locationIds?.length) params.set("locationIds", locationIds.join(","));
      return req<{ data: ClientWithStats[]; total: number; page: number; pages: number }>(
        `/businesses/${businessId}/clients?${params.toString()}`
      );
    },
    get: (businessId: string, id: string) =>
      req<Client & { appointments: Appointment[]; totalSpentCents: number }>(`/businesses/${businessId}/clients/${id}`),
    create: (businessId: string, data: { name: string; email?: string; phone?: string; notes?: string; birthday?: string }) =>
      req<{ id: string; businessId: string; matched: boolean; clientToken: string }>(`/businesses/${businessId}/clients`, { method: "POST", body: JSON.stringify(data) }),
    update: (businessId: string, id: string, data: { name?: string; email?: string; phone?: string; notes?: string; tags?: string[]; birthday?: string }) =>
      req<Client>(`/businesses/${businessId}/clients/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    duplicates: (businessId: string) =>
      req<Array<{ clients: Array<{ id: string; name: string; email: string; phone?: string | null; createdAt: string; appointments: number }> }>>(`/businesses/${businessId}/clients/duplicates`),
    merge: (businessId: string, data: { primaryId: string; dupeIds: string[]; name?: string; email?: string; phone?: string | null }) =>
      req<{ ok: boolean; merged: number }>(`/businesses/${businessId}/clients/merge`, { method: "POST", body: JSON.stringify(data) }),
    delete: (businessId: string, id: string) =>
      req<{ ok: boolean; deletedAppointments: number }>(`/businesses/${businessId}/clients/${id}`, { method: "DELETE" }),
    setBlocked: (businessId: string, id: string, isBlocked: boolean, blockedReason?: string) =>
      req<Client>(`/businesses/${businessId}/clients/${id}/block`, { method: "PATCH", body: JSON.stringify({ isBlocked, blockedReason }) }),
    exportCsv: (businessId: string) => `/proxy/businesses/${businessId}/clients/export-csv`,
    importCsv: (businessId: string, rows: unknown[]) =>
      req<{ created: number; updated: number; total: number }>(`/businesses/${businessId}/clients/import-csv`, { method: "POST", body: JSON.stringify({ rows }) }),
  },

  migrations: {
    list: (businessId: string) =>
      req<MigrationRequest[]>(`/businesses/${businessId}/migrations`),
    create: (businessId: string, data: {
      sourcePlatform: MigrationSourcePlatform;
      mode?: MigrationMode;
      approximateSize?: number;
      requestedHelp?: boolean;
      notes?: string;
    }) =>
      req<MigrationRequest>(`/businesses/${businessId}/migrations`, { method: "POST", body: JSON.stringify(data) }),
    get: (businessId: string, id: string) =>
      req<MigrationRequest>(`/businesses/${businessId}/migrations/${id}`),
    stage: (businessId: string, id: string, data: {
      sourcePlatform?: MigrationSourcePlatform;
      fileName?: string;
      rows: Array<Record<string, unknown>>;
    }) =>
      req<MigrationImportBatch>(`/businesses/${businessId}/migrations/${id}/stage`, { method: "POST", body: JSON.stringify(data) }),
    importBatch: (businessId: string, batchId: string, importValidOnly = true) =>
      req<MigrationImportBatch>(`/businesses/${businessId}/migrations/batches/${batchId}/import`, { method: "POST", body: JSON.stringify({ importValidOnly }) }),
  },

  appointments: {
    list: (businessId: string, page = 1, limit = 50) =>
      req<{ data: Appointment[]; total: number; page: number; pages: number }>(
        `/businesses/${businessId}/bookings?page=${page}&limit=${limit}`
      ),
    listRange: (businessId: string, from: string, to: string) =>
      req<{ data: Appointment[]; total: number }>(
        `/businesses/${businessId}/bookings?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
      ),
    // Public-by-id — requires the HMAC manage token from the emailed link.
    // Token in X-Manage-Token header so it never appears in URL logs or Sentry.
    get: (id: string, token?: string) =>
      req<Appointment>(`/bookings/${id}`, token ? { headers: { "X-Manage-Token": token } } : undefined, null),
    // Owner-scoped single appointment (for receipts/detail).
    getOne: (businessId: string, id: string) => req<Appointment>(`/businesses/${businessId}/bookings/${id}`),
    create: (businessId: string, data: { staffId: string; serviceId: string; additionalServiceIds?: string[]; clientToken: string; startsAt: string; notes?: string; intakeAnswers?: IntakeAnswer[]; referralSource?: string; promoCodeId?: string; customerAddress?: string; locationId?: string; locale?: "en" | "fr" }) =>
      req<Appointment>(`/businesses/${businessId}/bookings`, { method: "POST", body: JSON.stringify(data) }),
    // Owner/staff-initiated (dashboard) — authenticated, goes straight to CONFIRMED
    // and sends the client their confirmation immediately (skips approval).
    createManual: (businessId: string, data: { staffId: string; serviceId: string; additionalServiceIds?: string[]; clientId: string; startsAt: string; notes?: string; allowOverride?: boolean; locationId?: string; meetingUrl?: string }) =>
      req<Appointment>(`/businesses/${businessId}/bookings/manual`, { method: "POST", body: JSON.stringify(data) }),
    // Owner-initiated recurring series. Returns the created occurrences + any
    // dates skipped due to conflicts.
    createRecurring: (businessId: string, data: { staffId: string; serviceId: string; additionalServiceIds?: string[]; clientId: string; startsAt: string; notes?: string; allowOverride?: boolean; locationId?: string; meetingUrl?: string; frequency: "WEEKLY" | "BIWEEKLY" | "THREE_WEEKS" | "EIGHT_WEEKS" | "MONTHLY"; count: number }) =>
      req<{ groupId: string; created: { id: string; startsAt: string }[]; skipped: string[] }>(`/businesses/${businessId}/bookings/recurring`, { method: "POST", body: JSON.stringify(data) }),
    confirm: (businessId: string, id: string) =>
      req<Appointment>(`/businesses/${businessId}/bookings/${id}/confirm`, { method: "PATCH" }),
    // Owner reschedule (e.g. drag-and-drop on the calendar).
    reschedule: (businessId: string, id: string, startsAt: string) =>
      req<Appointment>(`/businesses/${businessId}/bookings/${id}/reschedule`, { method: "PATCH", body: JSON.stringify({ startsAt }) }),
    updateStatus: (businessId: string, id: string, status: string, cancelReason?: string, chargeCancellationFee?: boolean) =>
      req<Appointment & { cancelFee?: { charged: boolean; feeCents: number; reason?: string } }>(`/businesses/${businessId}/bookings/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status, ...(cancelReason ? { cancelReason } : {}), ...(chargeCancellationFee ? { chargeCancellationFee: true } : {}) }),
      }),
    update: (businessId: string, id: string, data: { startsAt?: string; clientName?: string; clientEmail?: string; clientPhone?: string; notes?: string; notifyClient?: boolean }) =>
      req<Appointment>(`/businesses/${businessId}/bookings/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    // Public — used by the client-facing manage page (no auth; HMAC token required).
    // Token is sent in the request body so it never appears in URL logs or Sentry.
    publicCancel: (id: string, cancelReason?: string, token?: string) =>
      req<Appointment>(`/bookings/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "CANCELLED", ...(cancelReason ? { cancelReason } : {}), ...(token ? { token } : {}) }),
      }, null),
    publicLateCancelRequest: (id: string, cancelReason?: string, token?: string) =>
      req<{ ok: boolean; code: string; message: string }>(`/bookings/${id}/late-cancel-request`, {
        method: "POST",
        body: JSON.stringify({ ...(cancelReason ? { cancelReason } : {}), ...(token ? { token } : {}) }),
      }, null),
    publicReschedule: (id: string, startsAt: string, token?: string) =>
      req<Appointment>(`/bookings/${id}/reschedule`, {
        method: "PATCH",
        body: JSON.stringify({ startsAt, ...(token ? { token } : {}) }),
      }, null),
  },

  messages: {
    threads: (businessId: string, filters?: { unread?: boolean; archived?: boolean; search?: string; channel?: string; locationIds?: string[] }) => {
      const q = new URLSearchParams();
      if (filters?.unread) q.set("unread", "true");
      if (filters?.archived) q.set("archived", "true");
      if (filters?.search) q.set("search", filters.search);
      if (filters?.channel) q.set("channel", filters.channel);
      if (filters?.locationIds?.length) q.set("locationIds", filters.locationIds.join(","));
      return req<Array<{ clientId: string; client: { id: string; name: string; email?: string | null }; lastMessage: string; fromClient: boolean; read: boolean; unreadCount: number; archived: boolean; createdAt: string }>>(`/businesses/${businessId}/messages?${q.toString()}`);
    },
    thread: (businessId: string, clientId: string, appointmentId?: string, token?: string) => {
      const q = new URLSearchParams();
      if (appointmentId) q.set("appointmentId", appointmentId);
      const qs = q.toString();
      return req<Array<{ id: string; content: string; fromClient: boolean; read: boolean; createdAt: string }>>(
        `/businesses/${businessId}/clients/${clientId}/messages${qs ? `?${qs}` : ""}`,
        token ? { headers: { "X-Manage-Token": token } } : undefined,
        token === undefined ? undefined : null,
      );
    },
    send: (businessId: string, clientId: string, content: string, appointmentId?: string, token?: string) => {
      const q = new URLSearchParams();
      if (appointmentId) q.set("appointmentId", appointmentId);
      const qs = q.toString();
      return req<unknown>(
        `/businesses/${businessId}/clients/${clientId}/messages${qs ? `?${qs}` : ""}`,
        { method: "POST", body: JSON.stringify({ content }), ...(token ? { headers: { "X-Manage-Token": token } } : {}) },
        token === undefined ? undefined : null,
      );
    },
    reply: (businessId: string, clientId: string, content: string) =>
      req<{ id: string; sms?: { sent: boolean; reason?: string } }>(`/businesses/${businessId}/clients/${clientId}/messages/reply`, { method: "POST", body: JSON.stringify({ content }) }),
    markRead: (businessId: string, clientId: string) =>
      req<unknown>(`/businesses/${businessId}/clients/${clientId}/messages/read`, { method: "PATCH" }),
    unreadCount: (businessId: string) =>
      req<{ unreadMessages: number; unreadThreads: number }>(`/businesses/${businessId}/messages/unread-count`),
    archive: (businessId: string, clientId: string, archived = true) =>
      req<unknown>(`/businesses/${businessId}/messages/${clientId}/archive`, { method: "PATCH", body: JSON.stringify({ archived }) }),
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

  promoCodes: {
    list: (businessId: string) => req<PromoCode[]>(`/businesses/${businessId}/promo-codes`),
    validate: (businessId: string, code: string, priceCents: number) =>
      req<{ id: string; code: string; discountType: string; discountValue: number; discountCents: number }>(
        `/businesses/${businessId}/promo-codes/validate?code=${encodeURIComponent(code)}&priceCents=${priceCents}`, undefined, null
      ),
    create: (businessId: string, data: unknown) => req<PromoCode>(`/businesses/${businessId}/promo-codes`, { method: "POST", body: JSON.stringify(data) }),
    update: (businessId: string, id: string, data: unknown) => req<PromoCode>(`/businesses/${businessId}/promo-codes/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    remove: (businessId: string, id: string) => req<void>(`/businesses/${businessId}/promo-codes/${id}`, { method: "DELETE" }),
  },

  memberships: {
    listPlans: (businessId: string) => req<MembershipPlan[]>(`/businesses/${businessId}/memberships/plans`),
    createPlan: (businessId: string, data: unknown) => req<MembershipPlan>(`/businesses/${businessId}/memberships/plans`, { method: "POST", body: JSON.stringify(data) }),
    updatePlan: (businessId: string, id: string, data: unknown) => req<MembershipPlan>(`/businesses/${businessId}/memberships/plans/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    deletePlan: (businessId: string, id: string) => req<void>(`/businesses/${businessId}/memberships/plans/${id}`, { method: "DELETE" }),
    listMembers: (businessId: string) => req<MembershipMember[]>(`/businesses/${businessId}/memberships/members`),
    subscribe: (businessId: string, clientId: string, planId: string) =>
      req<{ url: string; membershipId: string }>(`/businesses/${businessId}/memberships/subscribe`, { method: "POST", body: JSON.stringify({ clientId, planId }) }),
    confirm: (businessId: string, sessionId: string) =>
      req<{ confirmed: boolean; membershipId?: string; status?: MembershipStatus; reason?: string }>(`/businesses/${businessId}/memberships/confirm`, { method: "POST", body: JSON.stringify({ sessionId }) }),
    cancel: (businessId: string, id: string) => req<unknown>(`/businesses/${businessId}/memberships/${id}/cancel`, { method: "PATCH" }),
    clientMemberships: (businessId: string, clientId: string) => req<MembershipMember[]>(`/businesses/${businessId}/memberships/clients/${clientId}`),
  },

  clientPortal: {
    appointments: () => req<Appointment[]>(`/my/appointments`),
    cardStatus: () => req<{ hasCard: boolean }>(`/my/payment-method`),
    removeCard: () => req<{ removed: number }>(`/my/payment-method/remove`, { method: "POST" }),
    messages: () => req<Array<{ businessId: string; businessName: string; clientId: string; messages: Array<{ id: string; content: string; fromClient: boolean; createdAt: string }> }>>(`/my/messages`),
    offers: () => req<Array<{ id: string; title: string; description: string; discount?: string; expiresAt?: string; business: { id: string; name: string } }>>(`/my/offers`),
  },
};

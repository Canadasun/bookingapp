// Shared domain types (mirror the API response shapes).

export interface User { id:string; name:string; email:string; role:string; staffId:string|null; businessId:string|null; mustResetPassword?:boolean; twoFactorEnabled?:boolean; twoFactorMethod?:'EMAIL'|'SMS' }
export interface Appointment { id:string; startsAt:string; endsAt:string; status:string; notes?:string; cancelReason?:string; depositCents?:number; stripePaymentIntentId?:string|null; intakeAnswers?:Record<string,string>|null; service:{id:string;name:string;durationMinutes:number;priceCents:number}; staff:{id:string;user:{name:string}}; client:{id:string;name:string;email:string;phone?:string}; location?:{id:string;name:string}|null }
export interface ServiceCategory { id:string; name:string; color:string; sortOrder:number }
export interface Service { id:string; name:string; durationMinutes:number; priceCents:number; color:string; active:boolean; description?:string; categoryId?:string|null; category?:ServiceCategory|null; capacity?:number; priceType?:'FLAT'|'PER_HOUR'|'STARTING_AT' }
export interface AvailabilityRule { id?:string; staffId?:string; dayOfWeek:number; startTime:string; endTime:string }
export interface Staff { id:string; active?:boolean; user:{name:string; email?:string; role?:string}; staffServices:{serviceId:string}[]; availabilityRules?:AvailabilityRule[]; bio?:string; avatarUrl?:string; locationId?:string|null }
export interface Slot { startsAt:string; endsAt:string; startsAtLocal:string }
export type BookingSlot = Slot & { staffId?:string; staffName?:string };
export interface Client {
  id: string; name: string; email?: string | null; phone?: string;
  totalVisits?: number; lastVisit?: string | null; totalSpentCents?: number;
  tags?: string[]; birthday?: string | null; notes?: string | null;
  isBlocked?: boolean; blockedReason?: string | null;
  marketingOptOut?: boolean; hasCardOnFile?: boolean;
}
export interface LoginEvent { id: string; ipAddress?: string|null; userAgent?: string|null; method: string; createdAt: string }
export interface TodayDashboard {
  appointmentsToday: number; confirmedToday: number; pendingToday: number;
  depositsCollectedCents: number; revenueProtectedCents: number;
  noShowRiskCount: number; rebookingDueCount: number; waitlistCount: number;
  nextAppointment?: { clientName: string; serviceName: string; startsAt: string; hasDeposit: boolean } | null;
}
export interface Message { id:string; content:string; fromClient:boolean; read:boolean; createdAt:string }
export interface NotificationItem { id:string; kind:'BOOKING_NEW'|'BOOKING_UPDATE'|'PAYMENT'|'SYSTEM'; title:string; body?:string|null; linkUrl?:string|null; read:boolean; createdAt:string }
export interface NotificationDelivery { id:string; channel:'EMAIL'|'SMS'|'PUSH'; recipient:string; type:string; status:'SENT'|'FAILED'|'SKIPPED'; error?:string|null; createdAt:string; retryReason?:string|null }
export interface TaskItem { id:string; title:string; notes?:string|null; dueAt?:string|null; status:'OPEN'|'DONE'; staffId?:string|null; staff?:{user:{name:string}}|null }
export interface ServiceDueItem { id:string; status:'SCHEDULED'|'DUE'|'CANCELLED'; dueAt:string; cadenceDays?:number|null; client:{id:string;name:string;email?:string;phone?:string}; service?:{id:string;name:string}|null }
export interface ClientPortalAppointment extends Appointment { business:{id:string;name:string;slug?:string;phone?:string;address?:string}; manageToken?:string }
export interface ClientPortalMessageThread { businessId:string; businessName:string; clientId:string; messages:Message[] }
export interface ClientPortalOffer { id:string; title:string; description?:string; discount?:string; expiresAt?:string; business:{id:string;name:string;slug?:string} }
export interface Resource { id:string; businessId:string; name:string; active:boolean; createdAt:string; updatedAt:string }
export interface Location { id:string; businessId:string; name:string; address?:string|null; phone?:string|null; timezone?:string|null; active:boolean; createdAt:string; updatedAt:string }

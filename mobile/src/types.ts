// Shared domain types (mirror the API response shapes).

export interface User { id:string; name:string; email:string; role:string; staffId:string|null; businessId:string|null; mustResetPassword?:boolean; twoFactorEnabled?:boolean; twoFactorMethod?:'EMAIL'|'SMS' }
export interface Appointment { id:string; startsAt:string; endsAt:string; status:string; notes?:string; cancelReason?:string; service:{id:string;name:string;durationMinutes:number;priceCents:number}; staff:{id:string;user:{name:string}}; client:{id:string;name:string;email:string;phone?:string} }
export interface ServiceCategory { id:string; name:string; color:string; sortOrder:number }
export interface Service { id:string; name:string; durationMinutes:number; priceCents:number; color:string; active:boolean; description?:string; categoryId?:string|null; category?:ServiceCategory|null; capacity?:number }
export interface AvailabilityRule { id?:string; staffId?:string; dayOfWeek:number; startTime:string; endTime:string }
export interface Staff { id:string; active?:boolean; user:{name:string; email?:string; role?:string}; staffServices:{serviceId:string}[]; availabilityRules?:AvailabilityRule[]; bio?:string; avatarUrl?:string }
export interface Slot { startsAt:string; endsAt:string; startsAtLocal:string }
export type BookingSlot = Slot & { staffId?:string; staffName?:string };
export interface Client { id:string; name:string; email:string; phone?:string; totalVisits?:number; lastVisit?:string; tags?:string[] }
export interface Message { id:string; content:string; fromClient:boolean; read:boolean; createdAt:string }
export interface NotificationItem { id:string; kind:'BOOKING_NEW'|'BOOKING_UPDATE'|'PAYMENT'|'SYSTEM'; title:string; body?:string|null; linkUrl?:string|null; read:boolean; createdAt:string }
export interface NotificationDelivery { id:string; channel:'EMAIL'|'SMS'|'PUSH'; recipient:string; type:string; status:'SENT'|'FAILED'|'SKIPPED'; error?:string|null; createdAt:string; retryReason?:string|null }
export interface TaskItem { id:string; title:string; notes?:string|null; dueAt?:string|null; status:'OPEN'|'DONE'; staffId?:string|null; staff?:{id:string;user:{name:string}}|null }
export interface ServiceDueItem { id:string; status:'SCHEDULED'|'DUE'|'SENT'|'CANCELLED'; dueAt:string; cadenceDays?:number|null; client:{id:string;name:string;email?:string;phone?:string}; service?:{id:string;name:string}|null }
export interface ClientPortalAppointment extends Appointment { business:{id:string;name:string;slug?:string;phone?:string;address?:string}; manageToken?:string }
export interface ClientPortalMessageThread { businessId:string; businessName:string; clientId:string; messages:Message[] }
export interface ClientPortalOffer { id:string; title:string; description?:string; discount?:string; expiresAt?:string; business:{id:string;name:string;slug?:string} }

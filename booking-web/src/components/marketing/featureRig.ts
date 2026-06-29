import {
  Globe, Smartphone, Users, ShieldCheck, CreditCard, BarChart3, Clock, MessageSquare, Bell,
  CheckCircle2, History, Search, ClipboardList, FileCheck2, Building2, CalendarDays, MapPin,
  Send, Eye, Star, type LucideIcon,
} from "lucide-react";

// Icons can't live in JSON, so each feature page's badge + 3 card icons are
// registered here by slug and paired (by index) with the dictionary content.
// Keep this in lockstep with featurePages in the dictionaries.
export type FeatureRig = { badgeIcon: LucideIcon; featureIcons: [LucideIcon, LucideIcon, LucideIcon] };

export const featureRig: Record<string, FeatureRig> = {
  "online-booking": { badgeIcon: Globe, featureIcons: [Globe, Smartphone, Users] },
  "deposits": { badgeIcon: ShieldCheck, featureIcons: [ShieldCheck, CreditCard, BarChart3] },
  "no-show-protection": { badgeIcon: ShieldCheck, featureIcons: [ShieldCheck, Clock, BarChart3] },
  "sms-reminders": { badgeIcon: MessageSquare, featureIcons: [MessageSquare, Bell, CheckCircle2] },
  "client-management": { badgeIcon: Search, featureIcons: [History, MessageSquare, Search] },
  "intake-forms": { badgeIcon: ClipboardList, featureIcons: [ClipboardList, FileCheck2, ShieldCheck] },
  "multi-location": { badgeIcon: MapPin, featureIcons: [Building2, CalendarDays, MapPin] },
  "reviews": { badgeIcon: Star, featureIcons: [Send, Eye, Star] },
};

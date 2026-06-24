// Single source of truth for plan prices and feature matrix.
// The pricing page, upgrade prompts, and entitlement helpers all import from here.
// Invariant tested in __tests__/plans.test.ts: prices must be strictly monotonic.

export const PLAN_PRICES = {
  FREE:      0,
  BASIC:    19,
  PRO:      39,
  UNLIMITED: 79,
} as const;

export const PLAN_ORDER = ['FREE', 'BASIC', 'PRO', 'UNLIMITED'] as const;
export type PlanId = (typeof PLAN_ORDER)[number];
export type FeatureValue = boolean | string;

export interface PlanFeatureRow {
  label: string;
  free: FeatureValue;
  basic: FeatureValue;
  pro: FeatureValue;
  unlimited: FeatureValue;
}

export const PLAN_FEATURES: PlanFeatureRow[] = [
  { label: "Online booking page",                  free: true,    basic: true,    pro: true,    unlimited: true  },
  { label: "Unlimited appointments",               free: true,    basic: true,    pro: true,    unlimited: true  },
  { label: "Client management",                    free: true,    basic: true,    pro: true,    unlimited: true  },
  { label: "Booking confirmations (email)",        free: true,    basic: true,    pro: true,    unlimited: true  },
  { label: "In-app client messaging",              free: true,    basic: true,    pro: true,    unlimited: true  },
  { label: "Google Calendar sync",                 free: true,    basic: true,    pro: true,    unlimited: true  },
  { label: "Intake & consent forms",               free: true,    basic: true,    pro: true,    unlimited: true  },
  { label: "Locations",                            free: "1",     basic: "1",     pro: "2",     unlimited: "5"   },
  { label: "Receive & reply to client SMS",        free: false,   basic: true,    pro: true,    unlimited: true  },
  { label: "Initiate SMS to clients",              free: false,   basic: true,    pro: true,    unlimited: true  },
  { label: "Deposits & card on file",              free: false,   basic: true,    pro: true,    unlimited: true  },
  { label: "Cancellation policies",                free: false,   basic: true,    pro: true,    unlimited: true  },
  { label: "Reports & analytics",                  free: false,   basic: true,    pro: true,    unlimited: true  },
  { label: "Automated SMS & email reminders",      free: false,   basic: false,   pro: true,    unlimited: true  },
  { label: "Automatic no-show & late-cancel fees", free: "1/mo",  basic: "1/mo",  pro: true,    unlimited: true  },
  { label: "Packages, gift cards & memberships",   free: false,   basic: false,   pro: true,    unlimited: true  },
  { label: "Reviews & marketing campaigns",        free: false,   basic: false,   pro: true,    unlimited: true  },
];

export const PLAN_DEFS = [
  {
    id: 'FREE' as const,
    name: 'Free',
    price: PLAN_PRICES.FREE,
    period: 'forever' as const,
    desc: 'Everything you need to start taking bookings online.',
    cta: 'Get started free',
    href: '/register',
    highlight: false,
  },
  {
    id: 'BASIC' as const,
    name: 'Basic',
    price: PLAN_PRICES.BASIC,
    period: '/ month' as const,
    desc: 'Accept payments, deposits, and client texts.',
    cta: 'Start with Basic',
    href: '/register?plan=basic',
    highlight: false,
  },
  {
    id: 'PRO' as const,
    name: 'Pro',
    price: PLAN_PRICES.PRO,
    period: '/ month' as const,
    desc: 'Automated reminders, no-show protection, and team tools.',
    cta: 'Start with Pro',
    href: '/register?plan=pro',
    highlight: true,
  },
  {
    id: 'UNLIMITED' as const,
    name: 'Unlimited',
    price: PLAN_PRICES.UNLIMITED,
    period: '/ month' as const,
    desc: 'All Pro features across up to 5 locations.',
    cta: 'Start with Unlimited',
    href: '/register?plan=unlimited',
    highlight: false,
  },
] as const;

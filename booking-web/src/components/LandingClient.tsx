"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LayoutDashboard, CalendarCheck, CreditCard, Link2, Users, ArrowRight, Sparkles, CalendarPlus,
  Star, Gift, Megaphone, Globe, ShoppingBag, Heart, MessageSquare } from "lucide-react";
import { getUser, type SessionUser } from "@/lib/auth";

function homeFor(user: SessionUser | null): string | null {
  if (!user) return null;
  return user.role === "ADMIN" ? "/admin" : user.role === "CLIENT" ? "/my/dashboard" : "/dashboard";
}

type HeroCtaT = { getStarted: string; signIn: string; dashboard: string; book: string };

// Hero CTA: logged-in users see a way into the app instead of sign-in / sign-up.
export function LandingHeroCta({ t }: { t: HeroCtaT }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  useEffect(() => { setUser(getUser()); }, []);
  const home = homeFor(user);
  if (user && home) {
    return (
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <Link href={home} className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-violet-600 text-white text-base font-semibold px-8 py-4 rounded-xl hover:bg-violet-700 transition-colors shadow-xl shadow-violet-200">
          <LayoutDashboard className="w-5 h-5" /> {t.dashboard}
        </Link>
        <Link href="/book" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white/90 text-slate-800 text-base font-semibold px-8 py-4 rounded-xl border border-[#E9DDCB] hover:bg-violet-50 transition-colors">
          <CalendarPlus className="w-4 h-4" /> {t.book}
        </Link>
      </div>
    );
  }
  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      <Link href="/register" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-violet-600 text-white text-base font-semibold px-8 py-4 rounded-xl hover:bg-violet-700 transition-colors shadow-xl shadow-violet-200">
        <Sparkles className="w-5 h-5" /> {t.getStarted}
      </Link>
      <Link href="/login" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white/90 text-slate-800 text-base font-semibold px-8 py-4 rounded-xl border border-[#E9DDCB] hover:bg-violet-50 transition-colors">
        {t.signIn} <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
}

type BottomCtaT = {
  title: string; subtitle: string; getStarted: string; signIn: string;
  welcomeBack: string; welcomeBackPlain: string; pickUp: string; dashboard: string;
};

// Bottom band: prospects get the marketing CTA; logged-in users get a "jump back in".
export function LandingBottomCta({ t }: { t: BottomCtaT }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  useEffect(() => { setUser(getUser()); }, []);
  const home = homeFor(user);
  if (user && home) {
    const first = user.name?.split(" ")[0];
    return (
      <>
        <h2 className="text-3xl font-bold text-white mb-4">{first ? t.welcomeBack.replace("{name}", first) : t.welcomeBackPlain}</h2>
        <p className="text-white/60 mb-8">{t.pickUp}</p>
        <div className="flex justify-center">
          <Link href={home} className="inline-flex items-center gap-2 bg-white text-violet-600 font-semibold px-8 py-4 rounded-xl hover:bg-violet-50 transition-colors">
            <LayoutDashboard className="w-5 h-5" /> {t.dashboard}
          </Link>
        </div>
      </>
    );
  }
  return (
    <>
      <h2 className="text-3xl font-bold text-white mb-4">{t.title}</h2>
      <p className="text-white/60 mb-8">{t.subtitle}</p>
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
        <Link href="/register" className="inline-flex items-center gap-2 bg-white text-violet-600 font-semibold px-8 py-4 rounded-xl hover:bg-violet-50 transition-colors">
          <Sparkles className="w-5 h-5" /> {t.getStarted}
        </Link>
        <Link href="/login" className="inline-flex items-center gap-2 border border-white/20 text-white font-semibold px-8 py-4 rounded-xl hover:bg-white/10 transition-colors">
          {t.signIn} <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </>
  );
}

// Business solutions to "sell" to a signed-in owner: what they already have
// (linking into the app) plus a roadmap of what's coming.
const SOLUTIONS_LIVE = [
  { icon: CalendarCheck, title: "24/7 online booking", desc: "Clients book themselves, day or night.", href: "/dashboard/services" },
  { icon: CreditCard, title: "Deposits & no-show protection", desc: "Take a card at booking, charge no-shows.", href: "/dashboard/settings" },
  { icon: MessageSquare, title: "2-way client messaging", desc: "Chat with booked clients without sharing your number.", href: "/dashboard/messages" },
  { icon: Star, title: "Reviews that build trust", desc: "Collect and showcase 5-star feedback.", href: "/dashboard/reviews" },
  { icon: Gift, title: "Gift cards & packages", desc: "Sell ahead and lock in repeat visits.", href: "/dashboard/gift-cards" },
  { icon: Megaphone, title: "Offers & marketing", desc: "Win-backs and promos to fill your book.", href: "/dashboard/marketing" },
  { icon: Users, title: "Waitlist auto-fill", desc: "A cancellation instantly offers the slot on.", href: "/dashboard/waitlist" },
];
const SOLUTIONS_SOON = [
  { icon: Globe, title: "Your own website", desc: "A booking-ready site for your business in minutes." },
  { icon: ShoppingBag, title: "Online store", desc: "Sell products and bundles right from your page." },
  { icon: Heart, title: "Loyalty & rewards", desc: "Points and perks that keep clients coming back." },
];

// Logged-in owners: a "grow your business" section that sells what's live and
// teases what's next.
export function LandingSolutions() {
  const [user, setUser] = useState<SessionUser | null>(null);
  useEffect(() => { setUser(getUser()); }, []);
  if (!user || user.role === "CLIENT") return null;

  return (
    <section className="py-16 bg-[#19212B]">
      <div className="max-w-6xl mx-auto px-6">
        <h2 className="text-2xl font-bold text-white">Everything to grow your business</h2>
        <p className="text-white/50 mt-1 mb-8">Tools that pay for themselves — already included in Pulse.</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {SOLUTIONS_LIVE.map(({ icon: Icon, title, desc, href }) => (
            <Link key={title} href={href}
              className="group rounded-2xl bg-white/[0.06] border border-white/10 p-5 hover:bg-white/[0.1] transition-colors">
              <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center mb-3">
                <Icon className="w-5 h-5 text-violet-300" />
              </div>
              <h3 className="font-semibold text-white text-sm mb-1">{title}</h3>
              <p className="text-white/50 text-xs leading-relaxed">{desc}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-violet-300 opacity-0 group-hover:opacity-100 transition-opacity">
                Open <ArrowRight className="w-3 h-3" />
              </span>
            </Link>
          ))}
        </div>

        <p className="text-white/50 mt-10 mb-4 text-sm font-semibold uppercase tracking-wide">Coming soon</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {SOLUTIONS_SOON.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-2xl bg-white/[0.03] border border-dashed border-white/15 p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-xl bg-white/[0.06] flex items-center justify-center">
                  <Icon className="w-4 h-4 text-white/60" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wide text-amber-300/80 bg-amber-300/10 rounded-full px-2 py-0.5">Soon</span>
              </div>
              <h3 className="font-semibold text-white/90 text-sm mb-1">{title}</h3>
              <p className="text-white/40 text-xs leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

type FooterT = {
  getStarted: string; signIn: string; dashboard: string; book: string;
  terms: string; privacy: string; industries: string; compare: string; pricing: string;
  demo: string; reviews: string; referrals: string; changelog: string; security: string;
  canadianPrivacy: string; support: string; status: string;
};

// Footer links adapt to the session too.
export function LandingFooterLinks({ t, locale = "en" }: { t: FooterT; locale?: "en" | "fr" }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  useEffect(() => { setUser(getUser()); }, []);
  const home = homeFor(user);
  const legalLinks = (
    <>
      <Link href={locale === "fr" ? "/fr/terms" : "/terms"} className="hover:text-indigo-600 transition-colors">{t.terms}</Link>
      <Link href={locale === "fr" ? "/fr/privacy" : "/privacy"} className="hover:text-indigo-600 transition-colors">{t.privacy}</Link>
    </>
  );
  const publicLinks = (
    <>
      <Link href="/for" className="hover:text-indigo-600 transition-colors">{t.industries}</Link>
      <Link href="/compare" className="hover:text-indigo-600 transition-colors">{t.compare}</Link>
      <Link href={locale === "fr" ? "/fr/pricing" : "/pricing"} className="hover:text-indigo-600 transition-colors">{t.pricing}</Link>
      <Link href="/demo" className="hover:text-indigo-600 transition-colors">{t.demo}</Link>
      <Link href="/reviews" className="hover:text-indigo-600 transition-colors">{t.reviews}</Link>
      <Link href="/referrals" className="hover:text-indigo-600 transition-colors">{t.referrals}</Link>
      <Link href="/changelog" className="hover:text-indigo-600 transition-colors">{t.changelog}</Link>
      <Link href={locale === "fr" ? "/fr/security" : "/security"} className="hover:text-indigo-600 transition-colors">{t.security}</Link>
      <Link href={locale === "fr" ? "/fr/canadian-privacy" : "/canadian-privacy"} className="hover:text-indigo-600 transition-colors">{t.canadianPrivacy}</Link>
      <Link href="/support" className="hover:text-indigo-600 transition-colors">{t.support}</Link>
      <Link href="/status" className="hover:text-indigo-600 transition-colors">{t.status}</Link>
    </>
  );
  if (user && home) {
    return (
      <div className="flex flex-wrap gap-4 text-sm text-slate-500">
        <Link href={home} className="hover:text-indigo-600 transition-colors">{t.dashboard}</Link>
        <Link href="/book" className="hover:text-indigo-600 transition-colors">{t.book}</Link>
        {legalLinks}
        {publicLinks}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-4 text-sm text-slate-500">
      <Link href="/register" className="hover:text-indigo-600 transition-colors">{t.getStarted}</Link>
      <Link href="/login" className="hover:text-indigo-600 transition-colors">{t.signIn}</Link>
      {legalLinks}
      {publicLinks}
    </div>
  );
}

type AuthCtaT = { signIn: string; getStarted: string; greeting: string; dashboard: string };

// Nav CTA that adapts to the session: a logged-in owner/staff/client sees a quick
// link into their dashboard instead of Sign in / Get started.
export function LandingAuthCta({ t }: { t: AuthCtaT }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  useEffect(() => { setUser(getUser()); }, []);

  if (user) {
    const home = homeFor(user) ?? "/dashboard";
    return (
      <div className="flex items-center gap-3">
        <span className="hidden sm:inline text-sm text-slate-600">{t.greeting.replace("{name}", user.name.split(" ")[0])}</span>
        <Link href={home}
          className="inline-flex items-center gap-1.5 text-sm font-medium bg-violet-600 text-white px-4 py-2 rounded-xl hover:bg-violet-700 shadow-md shadow-violet-200 transition-colors">
          <LayoutDashboard className="w-4 h-4" /> {t.dashboard}
        </Link>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3">
      <Link href="/login" className="text-sm font-medium text-slate-700 hover:text-violet-700 transition-colors">{t.signIn}</Link>
      <Link href="/register" className="text-sm font-medium bg-violet-600 text-white px-4 py-2 rounded-xl hover:bg-violet-700 shadow-md shadow-violet-200 transition-colors">{t.getStarted}</Link>
    </div>
  );
}

const RESOURCES = [
  { icon: CalendarCheck, title: "Connect Google Calendar", desc: "Sync confirmed bookings to your calendar automatically.", href: "/dashboard/settings" },
  { icon: CreditCard,    title: "Set up payments with Stripe", desc: "Collect deposits and keep a card on file for no-shows.", href: "/dashboard/settings" },
  { icon: Link2,         title: "Share your booking link", desc: "Put it in your Instagram bio, website or Google profile.", href: "/dashboard/settings" },
  { icon: Users,         title: "Add staff as you grow", desc: "Start solo — add team members only when you need to.", href: "/dashboard/staff" },
];

// Logged-in owners get a "get the most out of Pulse" strip on the landing page,
// linking straight into the relevant dashboard setup.
export function LandingResources() {
  const [user, setUser] = useState<SessionUser | null>(null);
  useEffect(() => { setUser(getUser()); }, []);
  if (!user || user.role === "CLIENT") return null;

  return (
    <section className="py-16 bg-white/60 border-y border-[#E9DDCB]">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex items-end justify-between mb-8 gap-4">
          <div>
            <h2 className="text-2xl font-bold text-ink">Welcome back, {user.name.split(" ")[0]} 👋</h2>
            <p className="text-slate-500 mt-1">A few things to get the most out of Pulse.</p>
          </div>
          <Link href="/dashboard" className="hidden sm:inline-flex items-center gap-1.5 text-sm font-semibold text-violet-700 hover:underline shrink-0">
            Open dashboard <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {RESOURCES.map(({ icon: Icon, title, desc, href }) => (
            <Link key={title} href={href}
              className="group rounded-2xl bg-white border border-[#E9DDCB] p-5 hover:shadow-lg hover:shadow-violet-100 transition-shadow">
              <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center mb-3">
                <Icon className="w-5 h-5 text-violet-700" />
              </div>
              <h3 className="font-semibold text-ink text-sm mb-1">{title}</h3>
              <p className="text-slate-500 text-xs leading-relaxed">{desc}</p>
              <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-violet-700 opacity-0 group-hover:opacity-100 transition-opacity">
                Set up <ArrowRight className="w-3 h-3" />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

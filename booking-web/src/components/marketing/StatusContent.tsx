import Link from "next/link";
import { ExternalLink, CheckCircle2, ArrowRight, AlertCircle } from "lucide-react";
import { StatusRedirect } from "@/app/(en)/status/StatusRedirect";

const STATUS_PAGE_URL =
  process.env.NEXT_PUBLIC_STATUS_PAGE_URL ?? "https://pulse-appointments.betteruptime.com";

// Bilingual system status page. EN at /status, FR at /fr/status.
export function StatusContent({ locale }: { locale: "en" | "fr" }) {
  const fr = locale === "fr";
  const home = fr ? "/fr" : "/";
  const supportHref = fr ? "/fr/support" : "/support";

  const components = fr
    ? [
        { label: "Réservation en ligne", sub: "Vos clients peuvent réserver des rendez-vous 24 h/24, 7 j/7" },
        { label: "Tableau de bord de l’entreprise", sub: "Connectez-vous et gérez votre horaire" },
        { label: "Traitement des paiements", sub: "Dépôts, carte au dossier et versements" },
        { label: "Notifications de rendez-vous", sub: "Rappels par courriel et SMS aux clients" },
        { label: "Application mobile", sub: "iOS et Android pour vous et votre personnel" },
        { label: "Notifications poussées", sub: "Alertes pour les nouvelles réservations et les messages" },
      ]
    : [
        { label: "Online Booking", sub: "Your clients can book appointments 24/7" },
        { label: "Business Dashboard", sub: "Log in and manage your schedule" },
        { label: "Payment Processing", sub: "Deposits, card-on-file, and payouts" },
        { label: "Appointment Notifications", sub: "Email and SMS reminders to clients" },
        { label: "Mobile App", sub: "iOS & Android for you and your staff" },
        { label: "Push Notifications", sub: "Alerts for new bookings and messages" },
      ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <StatusRedirect url={STATUS_PAGE_URL} delayMs={4000} />

      {/* Top nav */}
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href={home} className="inline-flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-icon.png" alt="Pulse" className="w-7 h-7 object-contain" />
            <span className="text-lg font-bold text-gray-900 tracking-tight">Pulse Appointments</span>
          </Link>
          <Link href={supportHref} className="text-sm text-violet-600 font-medium hover:underline">
            {fr ? "Contacter le soutien" : "Contact Support"}
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-12 space-y-8">

        {/* Hero */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-semibold px-4 py-2 rounded-full">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {fr ? "Tous les systèmes sont opérationnels" : "All systems operational"}
          </div>
          <h1 className="text-3xl font-bold text-gray-900">{fr ? "Pulse éprouve-t-il un problème?" : "Is Pulse having an issue?"}</h1>
          <p className="text-gray-500 text-base max-w-lg mx-auto">
            {fr
              ? "Si votre page de réservation, votre tableau de bord ou vos notifications client semblent lents ou indisponibles, vérifiez ici d’abord. Cette page affiche l’état en direct de tout ce dont dépend votre entreprise."
              : "If your booking page, dashboard, or client notifications seem slow or unavailable, check here first. This page shows live status for everything your business relies on."}
          </p>
        </div>

        {/* Auto-redirect notice */}
        <div className="rounded-2xl bg-violet-50 border border-violet-100 p-5 flex items-start gap-4">
          <AlertCircle className="w-5 h-5 text-violet-500 shrink-0 mt-0.5" />
          <div className="space-y-1 flex-1">
            <p className="text-sm font-semibold text-violet-900">
              {fr ? "Redirection vers le tableau de bord en direct dans quelques secondes…" : "Taking you to the live dashboard in a few seconds…"}
            </p>
            <p className="text-xs text-violet-600">
              {fr
                ? "Le tableau de bord en direct affiche la disponibilité en temps réel, les incidents passés et vous permet de vous abonner aux alertes. "
                : "The live dashboard shows real-time uptime, past incidents, and lets you subscribe to alerts. "}
              <a
                href={STATUS_PAGE_URL}
                className="font-semibold underline hover:text-violet-800"
                rel="noopener noreferrer"
              >
                {fr ? "Y aller maintenant →" : "Go now →"}
              </a>
            </p>
          </div>
        </div>

        {/* Component status list */}
        <section className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">{fr ? "Ce que nous surveillons" : "What we monitor"}</h2>
            <p className="text-xs text-gray-400 mt-0.5">{fr ? "Tout ce dont dépend votre entreprise, surveillé 24 h/24, 7 j/7" : "Everything your business depends on, watched 24/7"}</p>
          </div>
          <div className="divide-y divide-gray-50">
            {components.map(({ label, sub }) => (
              <div key={label} className="flex items-center gap-4 px-6 py-4">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800">{label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
                </div>
                <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full shrink-0">
                  {fr ? "Opérationnel" : "Operational"}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Primary CTA */}
        <div className="text-center space-y-3">
          <a
            href={STATUS_PAGE_URL}
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white font-semibold text-sm px-6 py-3 rounded-xl transition-colors"
          >
            {fr ? "Ouvrir le tableau de bord d’état en direct" : "Open Live Status Dashboard"} <ExternalLink className="w-4 h-4" />
          </a>
          <p className="text-xs text-gray-400">
            {fr ? "Abonnez-vous aux alertes d’incident pour être le premier informé." : "Subscribe to incident alerts so you're the first to know."}
          </p>
        </div>

        {/* Still stuck */}
        <div className="rounded-2xl bg-amber-50 border border-amber-100 p-5 flex items-start gap-4">
          <span className="text-xl shrink-0" aria-hidden>🙋</span>
          <div>
            <p className="text-sm font-semibold text-amber-900">{fr ? "Toujours des difficultés?" : "Still having trouble?"}</p>
            <p className="text-xs text-amber-700 mt-0.5">
              {fr
                ? "Si le tableau de bord en direct indique que tout fonctionne, mais que vous éprouvez encore des problèmes, notre équipe de soutien peut vous aider. La plupart des problèmes sont résolus en moins d’une heure."
                : "If the live dashboard shows everything is working but you're still experiencing issues, our support team can help. Most issues are resolved in under an hour."}
            </p>
            <Link
              href={supportHref}
              className="inline-flex items-center gap-1 mt-3 text-xs font-semibold text-amber-800 hover:underline"
            >
              {fr ? "Contacter le soutien" : "Contact support"} <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-white">
        <div className="max-w-3xl mx-auto px-6 py-5 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-gray-400">
          <span>support@pulseappointments.com</span>
          <div className="flex gap-5">
            <Link href={home} className="hover:text-gray-600 transition-colors">{fr ? "Accueil" : "Home"}</Link>
            <Link href={supportHref} className="hover:text-gray-600 transition-colors">{fr ? "Soutien" : "Support"}</Link>
            <a href={STATUS_PAGE_URL} rel="noopener noreferrer" className="hover:text-gray-600 transition-colors">
              {fr ? "État en direct" : "Live Status"}
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

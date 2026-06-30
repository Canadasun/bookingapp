import Link from "next/link";
import { ArrowRight, Bell, CalendarCheck, CreditCard, MessageSquare, Star } from "lucide-react";

const SITE_URL = "https://www.pulseappointments.com";

// Bilingual product-demo page. EN at /demo, FR at /fr/demo.
export function DemoContent({ locale }: { locale: "en" | "fr" }) {
  const fr = locale === "fr";
  const depositsHref = fr ? "/fr/features/deposits" : "/features/deposits";

  const demoSteps = fr
    ? [
        { icon: CalendarCheck, title: "Page de réservation", copy: "Les clients choisissent un service, un prestataire, un emplacement et une heure disponible depuis votre page de réservation publique." },
        { icon: CreditCard, title: "Protection des paiements", copy: "Les acomptes et les cartes enregistrées protègent les rendez-vous de grande valeur contre les annulations de dernière minute." },
        { icon: Bell, title: "Rappels automatisés", copy: "Les messages de confirmation, de rappel et de mise à jour sont envoyés sans autre outil." },
        { icon: Star, title: "Demande d’avis", copy: "Les rendez-vous terminés peuvent déclencher des demandes d’avis signées, afin que la rétroaction publiée soit liée à de vraies visites." },
      ]
    : [
        { icon: CalendarCheck, title: "Booking page", copy: "Clients choose a service, provider, location, and available time from your public booking page." },
        { icon: CreditCard, title: "Payment protection", copy: "Deposits and saved cards protect high-value appointments from last-minute cancellations." },
        { icon: Bell, title: "Automated reminders", copy: "Confirmation, reminder, and update messages are sent without another tool." },
        { icon: Star, title: "Review request", copy: "Completed appointments can trigger signed review requests, so published feedback is tied to real visits." },
      ];

  const productSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Pulse Appointments",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web, iOS, Android",
    url: `${SITE_URL}${fr ? "/fr/demo" : "/demo"}`,
    description: fr
      ? "Logiciel de réservation en ligne pour les entreprises de services canadiennes, avec acomptes, rappels, avis et messagerie client."
      : "Online booking software for Canadian service businesses with deposits, reminders, reviews, and client messaging.",
    offers: { "@type": "Offer", price: "0", priceCurrency: "CAD" },
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: fr ? "Accueil" : "Home", item: `${SITE_URL}${fr ? "/fr" : ""}` },
      { "@type": "ListItem", position: 2, name: fr ? "Démo" : "Demo", item: `${SITE_URL}${fr ? "/fr/demo" : "/demo"}` },
    ],
  };

  const stats: [string, string, string][] = fr
    ? [
        ["Réservations", "8", "3 acomptes perçus"],
        ["Revenus protégés", "175 $", "Carte enregistrée"],
        ["Rappels", "14", "SMS + courriel en file"],
        ["Avis", "2", "Demandes envoyées"],
      ]
    : [
        ["Bookings", "8", "3 deposits collected"],
        ["Revenue protected", "$175", "Card on file"],
        ["Reminders", "14", "SMS + email queued"],
        ["Reviews", "2", "Requests sent"],
      ];

  return (
    <main id="main-content" className="min-h-screen bg-[#F8F5EF] text-slate-900">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([productSchema, breadcrumbSchema]) }} />
      <section className="border-b border-[#E9DDCB] bg-white">
        <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
          <p className="text-xs font-bold uppercase tracking-widest text-violet-600">{fr ? "Démo du produit" : "Product demo"}</p>
          <div className="mt-4 grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <h1 className="text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
                {fr ? "Voyez comment Pulse transforme le trafic de réservation en rendez-vous protégés" : "See how Pulse turns booking traffic into protected appointments"}
              </h1>
              <p className="mt-5 text-lg leading-8 text-slate-600">
                {fr
                  ? "Cette visite montre le flux principal : réservation en ligne, perception d’acomptes, rappels automatisés, messagerie et demandes d’avis pour les entreprises canadiennes sur rendez-vous."
                  : "This tour shows the core workflow: online booking, deposit collection, automated reminders, messaging, and review requests for Canadian appointment-based businesses."}
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href={`/register${fr ? "?lang=fr" : ""}`} className="inline-flex items-center justify-center gap-2 rounded-lg bg-violet-700 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-800">
                  {fr ? "Commencer gratuitement" : "Start free"} <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link href={depositsHref} className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50">
                  {fr ? "Fonction Acomptes" : "Deposit feature"}
                </Link>
              </div>
            </div>
            <div className="rounded-[1.75rem] border border-[#E9DDCB] bg-[#19212B] p-4 shadow-2xl shadow-amber-100">
              <div className="rounded-[1.25rem] bg-white p-4">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{fr ? "Tableau de bord propriétaire" : "Owner dashboard"}</p>
                    <p className="text-lg font-bold text-slate-950">{fr ? "La journée en un coup d’œil" : "Today at a glance"}</p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">{fr ? "Protégé" : "Protected"}</span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {stats.map(([label, value, detail]) => (
                    <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p>
                      <p className="mt-1 text-2xl font-bold text-slate-950">{value}</p>
                      <p className="mt-1 text-xs text-slate-500">{detail}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-xl border border-violet-200 bg-violet-50 p-4">
                  <div className="flex items-start gap-3">
                    <MessageSquare className="mt-0.5 h-5 w-5 text-violet-700" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-semibold text-violet-950">{fr ? "Message client prêt" : "Client message ready"}</p>
                      <p className="mt-1 text-sm leading-6 text-violet-800">{fr ? "Votre rendez-vous est confirmé pour 15 h 15. Votre acompte de 25 $ a été appliqué." : "Your appointment is confirmed for 3:15 PM. Your $25 deposit has been applied."}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-4 md:grid-cols-4">
          {demoSteps.map(({ icon: Icon, title, copy }) => (
            <div key={title} className="rounded-lg border border-[#E9DDCB] bg-white p-5">
              <Icon className="h-5 w-5 text-violet-700" aria-hidden="true" />
              <h2 className="mt-4 text-base font-semibold text-slate-950">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{copy}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

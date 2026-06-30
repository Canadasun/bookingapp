import Image from "next/image";
import Link from "next/link";
import { CheckCircle2, MapPin, ShieldCheck, Sparkles } from "lucide-react";

const SITE_URL = "https://www.pulseappointments.com";

// Bilingual About page. EN renders at /about, FR at /fr/about; copy switches on
// locale so the two stay in sync.
export function AboutContent({ locale }: { locale: "en" | "fr" }) {
  const fr = locale === "fr";
  const home = fr ? "/fr" : "/";

  const aboutSchema = {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    name: fr ? "À propos de Pulse Appointments" : "About Pulse Appointments",
    url: `${SITE_URL}${fr ? "/fr/about" : "/about"}`,
    mainEntity: {
      "@type": "SoftwareApplication",
      name: "Pulse Appointments",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web, iOS",
      offers: { "@type": "Offer", priceCurrency: "CAD", price: "0" },
    },
  };

  const principles = fr
    ? [
        { icon: MapPin, title: "Le Canada d’abord, par défaut", body: "Pulse mise sur les prix en CAD, les attentes canadiennes en matière de vie privée, la facturation prête pour la TPS/TVH et des flux de communication conformes à la LCAP." },
        { icon: ShieldCheck, title: "La confiance avant les promesses de croissance", body: "Nous ne publions pas de faux témoignages. Les signaux de confiance publics doivent provenir de vrais clients, d’entreprises vérifiées, de pages de confidentialité et d’améliorations de produit réellement livrées." },
        { icon: Sparkles, title: "Conçu pour des exploitants pragmatiques", body: "Le produit est conçu pour les équipes sur rendez-vous qui ont besoin de réservation, de rappels, d’acomptes, de calendriers du personnel et de dossiers clients, sans la complexité d’une solution d’entreprise." },
      ]
    : [
        { icon: MapPin, title: "Canada-first by default", body: "Pulse focuses on CAD pricing, Canadian privacy expectations, GST/HST-ready invoicing, and CASL-aware communication workflows." },
        { icon: ShieldCheck, title: "Trust before growth claims", body: "We do not publish fabricated testimonials. Public trust signals should come from real customers, verified businesses, privacy pages, and shipped product improvements." },
        { icon: Sparkles, title: "Built for practical operators", body: "The product is designed for appointment-based teams that need booking, reminders, deposits, staff calendars, and client records without enterprise complexity." },
      ];

  return (
    <main id="main-content" className="min-h-screen bg-[#F8F5EF]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutSchema) }} />

      <nav className="bg-white/80 backdrop-blur-xl border-b border-[#E9DDCB] sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href={home} className="flex items-center gap-2.5">
            <Image src="/logo-icon.png" alt="Pulse" width={32} height={32} className="w-8 h-8 object-contain" />
            <span className="text-base font-bold text-slate-900 tracking-tight">Pulse Booking</span>
          </Link>
          <Link href={`/register${fr ? "?lang=fr" : ""}`} className="text-sm font-medium bg-violet-600 text-white px-4 py-2 rounded-xl hover:bg-violet-700 shadow-md shadow-violet-200 transition-colors">
            {fr ? "Commencer gratuitement" : "Get started free"}
          </Link>
        </div>
      </nav>

      <section className="max-w-3xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-white border border-[#E9DDCB] text-sm font-semibold text-slate-700 px-4 py-1.5 rounded-full mb-8 shadow-sm">
          <CheckCircle2 className="w-4 h-4 text-violet-600" />
          {fr ? "À propos de Pulse" : "About Pulse"}
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight mb-6">
          {fr ? "Logiciel de réservation conçu pour les" : "Booking software built for"}{" "}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 via-orange-400 to-amber-600">
            {fr ? "entreprises de services canadiennes" : "Canadian service businesses"}
          </span>
        </h1>
        <p className="text-lg text-slate-500 max-w-2xl mx-auto leading-relaxed">
          {fr
            ? "Pulse Appointments aide les salons, spas, barbiers, prestataires de mieux-être, consultants et entreprises de services mobiles à prendre des réservations en ligne, à réduire les absences, à percevoir des acomptes et à gérer leurs relations clients au même endroit."
            : "Pulse Appointments helps salons, spas, barbers, wellness providers, consultants, and mobile service businesses take bookings online, reduce no-shows, collect deposits, and manage client relationships from one place."}
        </p>
      </section>

      <section className="py-16 bg-white/60 border-y border-[#E9DDCB]">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-12">{fr ? "Ce qui guide le produit" : "What guides the product"}</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {principles.map(({ icon: Icon, title, body }) => (
              <div key={title} className="bg-white rounded-2xl border border-[#E9DDCB] p-7 shadow-sm">
                <div className="w-11 h-11 rounded-xl bg-violet-50 flex items-center justify-center mb-5">
                  <Icon className="w-5 h-5 text-violet-600" />
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-2">{title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">{fr ? "Une note sur la confiance publique" : "A note on public trust"}</h2>
          <div className="space-y-4 text-slate-600 leading-relaxed">
            {fr ? (
              <>
                <p>Pulse remplace intentionnellement la preuve sociale fictive par des signaux vérifiables : de vrais avis de clients lorsqu’ils sont disponibles, une documentation de sécurité publique, des conseils sur la vie privée au Canada, l’historique du journal des modifications et des pages de produit claires.</p>
                <p>La biographie du fondateur et les témoignages de clients ne devraient être ajoutés que lorsque les détails sont prêts à être publiés avec exactitude. Cela rend le site plus solide pour les utilisateurs, les moteurs de recherche et la confiance envers la marque à long terme.</p>
              </>
            ) : (
              <>
                <p>Pulse is intentionally replacing placeholder social proof with verifiable signals: real customer reviews when available, public security documentation, Canadian privacy guidance, changelog history, and clear product pages.</p>
                <p>Founder biography and customer testimonials should be added only when the details are ready to publish accurately. That keeps the site stronger for users, search engines, and long-term brand trust.</p>
              </>
            )}
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/trust" className="inline-flex items-center justify-center bg-violet-600 text-white font-semibold px-5 py-3 rounded-xl hover:bg-violet-700 transition-colors">
              {fr ? "Voir le centre de confiance" : "View trust center"}
            </Link>
            <Link href="/changelog" className="inline-flex items-center justify-center bg-white border border-[#E9DDCB] text-slate-700 font-semibold px-5 py-3 rounded-xl hover:border-violet-300 transition-colors">
              {fr ? "Voir le journal des modifications" : "View changelog"}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

import Link from "next/link";
import { HelpCircle } from "lucide-react";
import type { ReactNode } from "react";

// Bilingual FAQ page. EN at /faq, FR at /fr/faq.
// Product/sales-oriented Q&A — distinct from the account/booking FAQs on /support.
export function FaqContent({ locale }: { locale: "en" | "fr" }) {
  const fr = locale === "fr";
  const home = fr ? "/fr" : "/";
  const pricingHref = fr ? "/fr/pricing" : "/pricing";
  const supportHref = fr ? "/fr/support" : "/support";
  const contactHref = fr ? "/fr/contact" : "/contact";

  const faqs: { q: string; a: ReactNode }[] = fr
    ? [
        { q: "Pulse est-il offert gratuitement?", a: <>Oui. Vous pouvez commencer avec le forfait gratuit, sans carte de crédit. Consultez la <Link href={pricingHref} className="text-violet-600 hover:underline">page des tarifs</Link> pour comparer les forfaits payants et leurs fonctionnalités.</> },
        { q: "Pulse est-il conçu pour le Canada?", a: <>Absolument. Pulse est une plateforme d’abord canadienne : tarification en dollars canadiens, conformité aux lois canadiennes sur la protection de la vie privée et soutien bilingue anglais-français.</> },
        { q: "Puis-je accepter des acomptes et réduire les absences?", a: <>Oui. Pulse prend en charge les acomptes, les paiements en ligne via Stripe, ainsi que les rappels automatisés par courriel et SMS pour réduire les rendez-vous manqués.</> },
        { q: "Puis-je migrer depuis un autre outil de réservation?", a: <>Oui. Écrivez-nous depuis la <Link href={contactHref} className="text-violet-600 hover:underline">page Nous joindre</Link> et nous vous guiderons pour transférer vos services, votre personnel et vos disponibilités.</> },
        { q: "Pulse est-il offert en français?", a: <>Oui. L’ensemble de l’expérience publique est disponible en anglais et en français. Utilisez le sélecteur de langue pour passer de l’un à l’autre à tout moment.</> },
        { q: "Comment un client annule-t-il ou reporte-t-il un rendez-vous?", a: <>Les clients gèrent leurs réservations depuis le portail client. Pour les détails, consultez notre <Link href={supportHref} className="text-violet-600 hover:underline">centre d’aide</Link>.</> },
      ]
    : [
        { q: "Is Pulse free to use?", a: <>Yes. You can start on the free plan with no credit card required. See the <Link href={pricingHref} className="text-violet-600 hover:underline">pricing page</Link> to compare paid plans and their features.</> },
        { q: "Is Pulse built for Canada?", a: <>Absolutely. Pulse is a Canada-first platform: pricing in Canadian dollars, alignment with Canadian privacy law, and bilingual English-French support.</> },
        { q: "Can I take deposits and cut down on no-shows?", a: <>Yes. Pulse supports deposits, online payments via Stripe, and automated email and SMS reminders to reduce missed appointments.</> },
        { q: "Can I migrate from another booking tool?", a: <>Yes. Reach out from the <Link href={contactHref} className="text-violet-600 hover:underline">contact page</Link> and we&apos;ll help you bring over your services, staff, and availability.</> },
        { q: "Is Pulse available in French?", a: <>Yes. The entire public experience is available in English and French. Use the language toggle to switch at any time.</> },
        { q: "How does a client cancel or reschedule an appointment?", a: <>Clients manage their bookings from the client portal. For step-by-step details, see our <Link href={supportHref} className="text-violet-600 hover:underline">support centre</Link>.</> },
      ];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link href={home} className="inline-flex items-center gap-2 mb-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-icon.png" alt="Pulse" className="w-8 h-8 object-contain" />
          <span className="text-2xl font-bold text-slate-900 tracking-tight">Pulse Booking</span>
        </Link>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-violet-600 px-8 py-10 text-white">
            <h1 className="text-3xl font-bold mb-2">{fr ? "Questions fréquentes" : "Frequently Asked Questions"}</h1>
            <p className="text-violet-100 text-sm">
              {fr
                ? "Les réponses aux questions les plus courantes sur Pulse Appointments."
                : "Answers to the most common questions about Pulse Appointments."}
            </p>
          </div>

          <div className="p-8 md:p-12 space-y-6">
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                  <HelpCircle className="w-5 h-5 text-slate-500" />
                </div>
                <h2 className="text-lg font-bold text-slate-900">{fr ? "Questions générales" : "General Questions"}</h2>
              </div>
              <div className="space-y-3 text-sm text-slate-600">
                {faqs.map(({ q, a }) => (
                  <details key={q} className="rounded-xl border border-slate-100 bg-slate-50 px-5 py-3 group">
                    <summary className="font-semibold text-slate-800 cursor-pointer list-none flex justify-between items-center">
                      {q}
                      <span className="text-slate-400 group-open:rotate-180 transition-transform text-xs">▼</span>
                    </summary>
                    <p className="mt-3 leading-relaxed text-slate-600">{a}</p>
                  </details>
                ))}
              </div>
            </section>

            <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
              <p className="text-xs text-slate-400">
                {fr ? "Vous ne trouvez pas votre réponse?" : "Still can't find your answer?"}
              </p>
              <div className="flex gap-6">
                <Link href={contactHref} className="text-violet-600 font-semibold text-sm hover:underline">{fr ? "Nous joindre" : "Contact us"}</Link>
                <Link href={supportHref} className="text-violet-600 font-semibold text-sm hover:underline">{fr ? "Centre d’aide" : "Support Centre"}</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

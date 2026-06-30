import Link from "next/link";
import { ArrowRight, CheckCircle2, Eye, ShieldCheck, Star } from "lucide-react";

const SITE_URL = "https://www.pulseappointments.com";

// Bilingual reviews marketing page. EN at /reviews, FR at /fr/reviews.
export function ReviewsContent({ locale }: { locale: "en" | "fr" }) {
  const fr = locale === "fr";

  const items = fr
    ? [
        { icon: CheckCircle2, title: "Demandes liées aux rendez-vous", copy: "Les liens d’avis sont envoyés après les rendez-vous terminés, de sorte que la rétroaction est liée à une activité de service réelle." },
        { icon: Eye, title: "Modération par le propriétaire", copy: "Publiez ou masquez les avis depuis le tableau de bord avant qu’ils n’apparaissent sur la page de réservation publique." },
        { icon: ShieldCheck, title: "Aucun témoignage fictif", copy: "Pulse évite les citations inventées et vous donne les outils pour mériter une preuve publiable auprès de vrais clients." },
      ]
    : [
        { icon: CheckCircle2, title: "Appointment-based requests", copy: "Review links are sent after completed appointments, so feedback is connected to real service activity." },
        { icon: Eye, title: "Owner moderation", copy: "Publish or hide reviews from the dashboard before they appear on the public booking page." },
        { icon: ShieldCheck, title: "No placeholder testimonials", copy: "Pulse avoids fabricated quotes and gives you the tools to earn publishable proof from real clients." },
      ];

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: fr
      ? [
          { "@type": "Question", name: "Pulse publie-t-il de faux témoignages?", acceptedAnswer: { "@type": "Answer", text: "Non. Pulse est conçu pour recueillir des avis à partir d’une activité de rendez-vous réelle et laisse les propriétaires décider quels avis sont publics." } },
          { "@type": "Question", name: "Où apparaissent les avis publics?", acceptedAnswer: { "@type": "Answer", text: "Les avis publiés apparaissent sur la page de réservation publique de l’entreprise, où les clients choisissent les services et les heures de rendez-vous." } },
          { "@type": "Question", name: "Puis-je masquer un avis?", acceptedAnswer: { "@type": "Answer", text: "Oui. Les propriétaires peuvent masquer ou publier les avis depuis la section Avis du tableau de bord Pulse." } },
        ]
      : [
          { "@type": "Question", name: "Does Pulse publish fake testimonials?", acceptedAnswer: { "@type": "Answer", text: "No. Pulse is designed to collect reviews from real appointment activity and lets owners decide which reviews are public." } },
          { "@type": "Question", name: "Where do public reviews appear?", acceptedAnswer: { "@type": "Answer", text: "Published reviews appear on the business public booking page where clients choose services and appointment times." } },
          { "@type": "Question", name: "Can I hide a review?", acceptedAnswer: { "@type": "Answer", text: "Yes. Owners can hide or publish reviews from the Reviews area in the Pulse dashboard." } },
        ],
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: fr ? "Accueil" : "Home", item: `${SITE_URL}${fr ? "/fr" : ""}` },
      { "@type": "ListItem", position: 2, name: fr ? "Avis" : "Reviews", item: `${SITE_URL}${fr ? "/fr/reviews" : "/reviews"}` },
    ],
  };

  return (
    <main id="main-content" className="min-h-screen bg-[#F8F5EF] text-slate-900">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([faqSchema, breadcrumbSchema]) }} />
      <section className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-violet-600">{fr ? "De vrais avis" : "Real reviews"}</p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
              {fr ? "Transformez les rendez-vous terminés en confiance publique" : "Turn completed appointments into public trust"}
            </h1>
            <p className="mt-5 text-lg leading-8 text-slate-600">
              {fr
                ? "Pulse aide les entreprises de services à recueillir et à publier des signaux d’avis provenant de vrais clients, au lieu de s’appuyer sur des témoignages fictifs."
                : "Pulse helps service businesses collect and publish review signals from real clients instead of relying on placeholder testimonials."}
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href={`/register${fr ? "?lang=fr" : ""}`} className="inline-flex items-center justify-center gap-2 rounded-lg bg-violet-700 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-800">
                {fr ? "Commencer à recueillir des avis" : "Start collecting reviews"} <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link href={fr ? "/fr/trust" : "/trust"} className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50">
                {fr ? "Centre de confiance" : "Trust center"}
              </Link>
            </div>
          </div>
          <div className="rounded-[1.75rem] border border-[#E9DDCB] bg-white p-5 shadow-xl shadow-amber-100/60">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{fr ? "Note publique" : "Public rating"}</p>
                  <p className="text-3xl font-bold text-slate-950">4,9</p>
                </div>
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star key={n} className="h-5 w-5 fill-amber-400 text-amber-400" aria-hidden="true" />
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                {(fr
                  ? ["Avis publié à partir d’un rendez-vous terminé", "Le propriétaire peut masquer ou publier depuis le tableau de bord", "Le résumé des notes apparaît sur la page de réservation publique"]
                  : ["Published review from a completed appointment", "Owner can hide or publish from dashboard", "Rating summary appears on public booking page"]
                ).map((line) => (
                  <div key={line} className="rounded-xl border border-slate-200 bg-white p-3 text-sm font-medium text-slate-700">
                    {line}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-[#E9DDCB] bg-white">
        <div className="mx-auto grid max-w-6xl gap-4 px-6 py-12 md:grid-cols-3">
          {items.map(({ icon: Icon, title, copy }) => (
            <div key={title} className="rounded-lg border border-slate-200 p-5">
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

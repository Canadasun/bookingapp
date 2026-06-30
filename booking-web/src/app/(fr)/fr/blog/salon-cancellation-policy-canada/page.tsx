import Link from "next/link";
import { buildAlternates } from "@/lib/hreflang";
import Image from "next/image";
import type { Metadata } from "next";

const SITE_URL = "https://www.pulseappointments.com";
const slug = "salon-cancellation-policy-canada";

export const metadata: Metadata = {
  alternates: buildAlternates("/blog/salon-cancellation-policy-canada", "fr"),
  title: "Politique d’annulation de salon au Canada : modèle pratique | Pulse",
  description:
    "Un guide pratique de politique d’annulation pour les salons et entreprises de services canadiens : délais de préavis, acomptes, frais d’absence, rappels et communication avec les clients.",
  openGraph: {
    title: "Politique d’annulation de salon au Canada",
    description: "Un modèle pratique de politique d’annulation et une liste de vérification d’application pour les entreprises de services canadiennes.",
  },
};

const articleSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "Politique d’annulation de salon au Canada : modèle pratique",
  datePublished: "2026-06-25",
  dateModified: "2026-06-25",
  author: { "@type": "Organization", name: "Pulse Appointments" },
  publisher: { "@type": "Organization", name: "Pulse Appointments", url: SITE_URL },
  url: `${SITE_URL}/fr/blog/${slug}`,
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Accueil", item: `${SITE_URL}/fr` },
    { "@type": "ListItem", position: 2, name: "Blogue", item: `${SITE_URL}/fr/blog` },
    { "@type": "ListItem", position: 3, name: "Politique d’annulation de salon au Canada", item: `${SITE_URL}/fr/blog/${slug}` },
  ],
};

export default function SalonCancellationPolicyPostFr() {
  return (
    <main id="main-content" className="min-h-screen bg-[#F8F5EF]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      <nav className="bg-white/80 backdrop-blur-xl border-b border-[#E9DDCB] sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/fr" className="flex items-center gap-2.5">
            <Image src="/logo-icon.png" alt="Pulse" width={32} height={32} className="w-8 h-8 object-contain" />
            <span className="text-base font-bold text-slate-900 tracking-tight">Pulse Booking</span>
          </Link>
          <Link href="/register" className="text-sm font-medium bg-violet-600 text-white px-4 py-2 rounded-xl hover:bg-violet-700 shadow-md shadow-violet-200 transition-colors">
            Commencer gratuitement
          </Link>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-16">
        <Link href="/fr/blog" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-violet-600 transition-colors mb-10">
          ← Retour au blogue
        </Link>

        <header className="mb-10">
          <span className="inline-block text-xs font-bold uppercase tracking-widest text-violet-600 bg-violet-50 px-3 py-1 rounded-full mb-4">
            Politique
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight mb-4">
            Politique d’annulation de salon au Canada : modèle pratique
          </h1>
          <div className="flex items-center gap-3 text-sm text-slate-400">
            <span>25 juin 2026</span>
            <span>·</span>
            <span>8 min de lecture</span>
          </div>
        </header>

        <article className="prose-custom">
          <p className="text-slate-600 leading-relaxed mb-4">
            Une politique d’annulation ne fonctionne que lorsque les clients la voient avant de réserver, la comprennent et savent qu’elle sera appliquée. Le libellé doit être clair, court et uniforme sur votre page de réservation, votre courriel de confirmation et vos rappels.
          </p>

          <h2 className="text-2xl font-bold text-slate-900 mt-10 mb-4">Un modèle de politique simple</h2>
          <blockquote className="border-l-4 border-violet-400 pl-4 text-slate-600 italic my-6">
            Veuillez donner un préavis d’au moins 24 heures pour annuler ou reporter. Les annulations à l’intérieur de 24 heures peuvent être facturées à 50 % du prix du service. Les absences peuvent être facturées au montant total de l’acompte ou aux frais d’absence affichés. Les acomptes sont appliqués à votre solde final.
          </blockquote>

          <h2 className="text-2xl font-bold text-slate-900 mt-10 mb-4">Fixez le bon délai de préavis</h2>
          <p className="text-slate-600 leading-relaxed mb-4">
            Les services courts peuvent souvent utiliser un délai de 24 heures. Les services plus longs, les colorations, les forfaits de spa ou les services nécessitant une préparation peuvent exiger 48 heures. Plus la plage horaire est difficile à combler, plus votre délai d’annulation devrait être hâtif.
          </p>

          <h2 className="text-2xl font-bold text-slate-900 mt-10 mb-4">Affichez la politique à trois endroits</h2>
          <ul className="list-disc list-inside text-slate-600 mb-4 space-y-1">
            <li>Votre page de réservation avant le paiement</li>
            <li>Le courriel de confirmation du client</li>
            <li>Le message de rappel 24 heures à l’avance</li>
          </ul>
          <p className="text-slate-600 leading-relaxed mb-4">
            Si les clients ne voient la politique qu’après avoir manqué le rendez-vous, cela ressemble à une surprise. S’ils la voient avant de réserver, cela ressemble à une règle d’affaires normale.
          </p>

          <h2 className="text-2xl font-bold text-slate-900 mt-10 mb-4">Utilisez des acomptes pour les rendez-vous à risque élevé</h2>
          <p className="text-slate-600 leading-relaxed mb-4">
            Les acomptes sont particulièrement utiles pour les nouveaux clients, les longs services et les rendez-vous en période de pointe. Un petit paiement initial change les comportements et donne un véritable poids à votre politique.
          </p>

          <h2 className="text-2xl font-bold text-slate-900 mt-10 mb-4">Automatisez les rappels avant d’automatiser les frais</h2>
          <p className="text-slate-600 leading-relaxed mb-4">
            Un bon moment d’envoi des rappels réduit les absences accidentelles. Commencez par un courriel de confirmation, un rappel 72 heures à l’avance et un SMS 24 heures à l’avance. Utilisez ensuite les frais d’absence pour le plus petit nombre de clients qui manquent tout de même leur plage horaire.
          </p>
          <p className="text-slate-600 leading-relaxed mb-4">
            Pulse réunit les éléments de politique, d’acompte, de rappel et de carte en dossier. Consultez la <Link href="/fr/features/no-show-protection" className="text-violet-600 hover:underline">protection contre les absences</Link> et les <Link href="/fr/features/sms-reminders" className="text-violet-600 hover:underline">rappels par SMS</Link>.
          </p>

          <p className="text-sm text-slate-500 leading-relaxed mt-8">
            Cet article fournit des conseils opérationnels, et non un avis juridique. Faites réviser votre politique par un professionnel qualifié si votre entreprise offre des services réglementés, a des conditions de remboursement inhabituelles ou est soumise à des exigences propres à une province.
          </p>
        </article>

        <div className="mt-12 rounded-2xl bg-[#19212B] p-8 text-center">
          <h2 className="text-xl font-bold text-white mb-2">Rendez votre politique plus facile à appliquer</h2>
          <p className="text-white/60 mb-6 text-sm">Utilisez les acomptes, les rappels et la carte en dossier dans Pulse.</p>
          <Link href="/register" className="inline-flex items-center gap-2 bg-white text-violet-600 font-semibold px-6 py-3 rounded-xl hover:bg-violet-50 transition-colors">
            Commencer gratuitement avec Pulse →
          </Link>
        </div>
      </div>
    </main>
  );
}

import Link from "next/link";
import { buildAlternates } from "@/lib/hreflang";
import Image from "next/image";
import type { Metadata } from "next";

const SITE_URL = "https://www.pulseappointments.com";
const slug = "how-to-take-appointment-deposits-canada";

export const metadata: Metadata = {
  alternates: buildAlternates("/blog/how-to-take-appointment-deposits-canada", "fr"),
  title: "Comment percevoir des acomptes de rendez-vous au Canada | Pulse",
  description:
    "Un guide pratique pour les salons, spas, barbiers et entreprises de services canadiens qui souhaitent percevoir des acomptes de rendez-vous en ligne et réduire les absences.",
  openGraph: {
    title: "Comment percevoir des acomptes de rendez-vous au Canada",
    description: "Montants d’acompte, libellé de la politique client, gestion des remboursements et bases de la carte en dossier pour les entreprises de services canadiennes.",
  },
};

const articleSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "Comment percevoir des acomptes de rendez-vous au Canada",
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
    { "@type": "ListItem", position: 3, name: "Comment percevoir des acomptes de rendez-vous au Canada", item: `${SITE_URL}/fr/blog/${slug}` },
  ],
};

export default function AppointmentDepositsPostFr() {
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
            Acomptes
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight mb-4">
            Comment percevoir des acomptes de rendez-vous au Canada
          </h1>
          <div className="flex items-center gap-3 text-sm text-slate-400">
            <span>25 juin 2026</span>
            <span>·</span>
            <span>7 min de lecture</span>
          </div>
        </header>

        <article className="prose-custom">
          <p className="text-slate-600 leading-relaxed mb-4">
            Les acomptes de rendez-vous sont l’un des moyens les plus simples de réduire les absences. L’objectif n’est pas de punir les clients. L’objectif est de transformer une réservation occasionnelle en un véritable engagement et de protéger le temps que vous avez réservé.
          </p>

          <h2 className="text-2xl font-bold text-slate-900 mt-10 mb-4">Choisissez une règle d’acompte que les clients peuvent comprendre</h2>
          <p className="text-slate-600 leading-relaxed mb-4">
            Gardez la règle assez simple pour qu’un client puisse la comprendre avant de réserver. Les meilleures options sont un montant fixe pour les services plus courts et un pourcentage pour les services plus longs et à plus forte valeur.
          </p>
          <ul className="list-disc list-inside text-slate-600 mb-4 space-y-1">
            <li>20 $ à 30 $ pour les rendez-vous courts</li>
            <li>25 % pour les services d’environ 60 à 90 minutes</li>
            <li>25 % à 50 % pour la coloration, les extensions, les forfaits de spa ou les longs traitements</li>
            <li>Prépaiement complet pour les réservations à risque élevé ou les événements spéciaux</li>
          </ul>

          <h2 className="text-2xl font-bold text-slate-900 mt-10 mb-4">Affichez la politique avant le paiement</h2>
          <p className="text-slate-600 leading-relaxed mb-4">
            Les clients devraient voir le montant de l’acompte, ce à quoi il s’applique et s’il est remboursable avant de confirmer. Mettez le même libellé sur votre page de réservation, votre courriel de confirmation et vos messages de rappel.
          </p>
          <blockquote className="border-l-4 border-violet-400 pl-4 text-slate-600 italic my-6">
            Un acompte est requis pour réserver ce rendez-vous. Les acomptes sont appliqués à votre solde final. Les acomptes peuvent être perdus en cas d’absence ou d’annulation à l’intérieur du délai d’annulation affiché.
          </blockquote>

          <h2 className="text-2xl font-bold text-slate-900 mt-10 mb-4">Décidez du fonctionnement des remboursements</h2>
          <p className="text-slate-600 leading-relaxed mb-4">
            Une bonne politique distingue les annulations hâtives des annulations de dernière minute. Par exemple : remboursable avec un préavis de 24 ou 48 heures, non remboursable à l’intérieur de ce délai, et examiné manuellement en cas d’urgence.
          </p>
          <p className="text-slate-600 leading-relaxed mb-4">
            Il s’agit de conseils d’affaires, et non d’un avis juridique. Si vous exercez dans un domaine réglementé ou si vous avez des conditions de remboursement inhabituelles, faites réviser votre politique par un professionnel qualifié.
          </p>

          <h2 className="text-2xl font-bold text-slate-900 mt-10 mb-4">Utilisez la carte en dossier pour appliquer le reste de la politique</h2>
          <p className="text-slate-600 leading-relaxed mb-4">
            Les acomptes aident, mais la carte en dossier rend votre politique d’annulation exécutoire. Si un client ne se présente pas, vous pouvez facturer les frais affichés sans facture embarrassante ni suivi manuel.
          </p>
          <p className="text-slate-600 leading-relaxed mb-4">
            Pulse prend en charge les acomptes, la carte en dossier et la protection contre les absences ensemble. Consultez la <Link href="/fr/features/deposits" className="text-violet-600 hover:underline">page complète sur la fonctionnalité d’acompte de réservation</Link>.
          </p>
        </article>

        <div className="mt-12 rounded-2xl bg-[#19212B] p-8 text-center">
          <h2 className="text-xl font-bold text-white mb-2">Percevez des acomptes sans gestion supplémentaire</h2>
          <p className="text-white/60 mb-6 text-sm">Commencez gratuitement et ajoutez des règles d’acompte à vos services quand vous serez prêt.</p>
          <Link href="/register" className="inline-flex items-center gap-2 bg-white text-violet-600 font-semibold px-6 py-3 rounded-xl hover:bg-violet-50 transition-colors">
            Commencer gratuitement avec Pulse →
          </Link>
        </div>
      </div>
    </main>
  );
}

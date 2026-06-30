import type { Metadata } from "next";
import { buildAlternates } from "@/lib/hreflang";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  alternates: buildAlternates("/for", "fr"),
  title: "Pulse pour votre secteur | Logiciel de réservation canadien",
  description: "Pulse Appointments est conçu pour les salons, barbiers, techniciennes de cils, esthéticiennes, massothérapeutes, toiletteurs, consultants, prestataires de mieux-être et services mobiles.",
};

const industries = [
  { href: "/fr/for/salons", emoji: "💇", label: "Salons", desc: "Calendrier multi-employés, acomptes, protection des colorations" },
  { href: "/fr/for/barbers", emoji: "✂️", label: "Barbiers", desc: "Rappels SMS, reprise rapide, automatisation des avis Google" },
  { href: "/fr/for/lash-techs", emoji: "👁️", label: "Techniciennes de cils", desc: "Rappels de remplissage, protection par acompte pour les longs rendez-vous" },
  { href: "/fr/for/estheticians", emoji: "✨", label: "Esthéticiennes", desc: "Formulaires d’admission, forfaits de soins, données de santé conformes à la LPRPDE" },
  { href: "/fr/for/massage-therapists", emoji: "💆", label: "Massothérapeutes", desc: "Admission de santé, cartes-cadeaux, protection par acompte" },
  { href: "/fr/for/pet-groomers", emoji: "🐾", label: "Toiletteurs d’animaux", desc: "Notes sur la race, SMS de ramassage, acompte contre les absences" },
  { href: "/fr/for/consultants", emoji: "💼", label: "Consultants", desc: "Approbation manuelle, acompte, synchronisation Google Agenda" },
  { href: "/fr/for/wellness", emoji: "🧘", label: "Professionnels du mieux-être", desc: "Abonnements, cours de groupe, automatisations de reprise" },
  { href: "/fr/for/mobile-services", emoji: "🚐", label: "Services mobiles", desc: "Saisie de l’adresse, temps de déplacement tampon, protection par acompte" },
  { href: "/fr/for/personal-trainers", emoji: "🏋️", label: "Entraîneurs personnels", desc: "Séances récurrentes, acomptes, synchronisation de calendrier, rappels SMS" },
  { href: "/fr/for/hair-stylists", emoji: "💇‍♀️", label: "Coiffeurs", desc: "Protection des colorations, acomptes, rappels de reprise" },
  { href: "/fr/for/nail-techs", emoji: "💅", label: "Techniciennes d’ongles", desc: "Protection par acompte pour les poses de gel et d’acrylique" },
  { href: "/fr/for/spas", emoji: "🧖", label: "Spas", desc: "Planification multi-thérapeutes, forfaits, cartes-cadeaux" },
  { href: "/fr/for/yoga-studios", emoji: "🧘", label: "Studios de yoga", desc: "Cours de groupe, abonnements, cartes de cours" },
];

const cities = [
  { href: "/fr/for/toronto", label: "Toronto", desc: "Logiciel de réservation pour les entreprises de services de Toronto" },
  { href: "/fr/for/vancouver", label: "Vancouver", desc: "Logiciel de réservation pour salons et mieux-être à Vancouver" },
  { href: "/fr/for/calgary", label: "Calgary", desc: "Logiciel de réservation pour les salons, spas et services mobiles de Calgary" },
  { href: "/fr/for/ottawa", label: "Ottawa", desc: "Logiciel de réservation pour les prestataires de services d’Ottawa" },
  { href: "/fr/for/edmonton", label: "Edmonton", desc: "Réservation de rendez-vous en ligne pour les entreprises d’Edmonton" },
  { href: "/fr/for/winnipeg", label: "Winnipeg", desc: "Logiciel de réservation pour les entreprises de services de Winnipeg" },
  { href: "/fr/for/montreal", label: "Montréal", desc: "Réservation bilingue pour les entreprises de services de Montréal" },
  { href: "/fr/for/quebec-city", label: "Québec", desc: "Réservation en français pour les entreprises de la ville de Québec" },
  { href: "/fr/for/laval", label: "Laval", desc: "Logiciel de réservation en ligne pour les entreprises de Laval" },
  { href: "/fr/for/gatineau", label: "Gatineau", desc: "Réservation bilingue pour les entreprises de Gatineau" },
];

export default function ForPageFr() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <Link href="/fr" className="inline-flex items-center gap-2 mb-10">
          <Image src="/logo-icon.png" alt="Pulse" width={32} height={32} className="w-8 h-8 object-contain" />
          <span className="text-2xl font-bold text-slate-900 tracking-tight">Pulse Appointments</span>
        </Link>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Conçu pour votre secteur</h1>
        <p className="text-slate-500 mb-8">Pulse fonctionne pour toute entreprise de services canadienne. Voyez comment il s’adapte à la vôtre.</p>
        <div className="grid sm:grid-cols-2 gap-3">
          {industries.map((i) => (
            <Link key={i.href} href={i.href} className="flex items-start gap-3 bg-white rounded-2xl border border-slate-200 p-4 hover:border-violet-300 hover:shadow-sm transition-all group">
              <span className="text-2xl" aria-hidden="true">{i.emoji}</span>
              <div>
                <p className="text-sm font-semibold text-slate-900 group-hover:text-violet-700">{i.label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{i.desc}</p>
              </div>
            </Link>
          ))}
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mt-14 mb-2">Conçu pour les villes canadiennes</h2>
        <p className="text-slate-500 mb-6">Pages locales pour les recherches à forte intention par ville.</p>
        <div className="grid sm:grid-cols-2 gap-3">
          {cities.map((city) => (
            <Link key={city.href} href={city.href} className="block bg-white rounded-2xl border border-slate-200 p-4 hover:border-violet-300 hover:shadow-sm transition-all group">
              <p className="text-sm font-semibold text-slate-900 group-hover:text-violet-700">{city.label}</p>
              <p className="text-xs text-slate-500 mt-0.5">{city.desc}</p>
            </Link>
          ))}
        </div>
        <div className="mt-8 text-center">
          <Link href="/register" className="inline-block bg-violet-600 text-white font-semibold text-sm rounded-xl px-6 py-3 hover:bg-violet-700 transition-colors">
            Commencer gratuitement — tous les secteurs →
          </Link>
        </div>
      </div>
    </div>
  );
}

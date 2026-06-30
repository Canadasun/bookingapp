import Link from "next/link";
import { buildAlternates } from "@/lib/hreflang";
import Image from "next/image";
import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: buildAlternates("/blog", "fr"),
  title: "Blogue | Pulse Appointments",
  description: "Conseils, guides et idées pour les entreprises de services canadiennes — réservation, absences, acomptes et croissance de vos rendez-vous.",
};

const posts = [
  {
    slug: "how-to-reduce-no-shows-canadian-service-businesses",
    category: "Absences",
    title: "Comment réduire les absences pour les entreprises de services canadiennes",
    excerpt: "Les absences coûtent des milliers de dollars par année aux entreprises de services canadiennes. Voici un système pratique et éprouvé pour les réduire de 80 % ou plus.",
    date: "25 juin 2026",
    readTime: "8 min de lecture",
  },
  {
    slug: "best-appointment-booking-software-canada-2026",
    category: "Comparaison",
    title: "Meilleur logiciel de réservation de rendez-vous au Canada 2026 : comparatif complet",
    excerpt: "Nous avons comparé les principales plateformes de réservation pour les entreprises de services canadiennes selon le prix, les fonctionnalités, la prise en charge du CAD et la protection contre les absences.",
    date: "25 juin 2026",
    readTime: "12 min de lecture",
  },
  {
    slug: "how-to-take-appointment-deposits-canada",
    category: "Acomptes",
    title: "Comment percevoir des acomptes de rendez-vous au Canada",
    excerpt: "Un guide pratique sur les montants d’acompte, le libellé de votre politique de réservation, les remboursements et les bases de la carte en dossier pour les entreprises de services canadiennes.",
    date: "25 juin 2026",
    readTime: "7 min de lecture",
  },
  {
    slug: "salon-cancellation-policy-canada",
    category: "Politique",
    title: "Politique d’annulation de salon au Canada : modèle pratique",
    excerpt: "Un modèle clair de politique d’annulation avec délais de préavis, gestion des acomptes, rappels et conseils d’application pour les salons canadiens.",
    date: "25 juin 2026",
    readTime: "8 min de lecture",
  },
];

const blogSchema = {
  "@context": "https://schema.org",
  "@type": "Blog",
  name: "Blogue Pulse Appointments",
  url: "https://www.pulseappointments.com/fr/blog",
  description: "Conseils et guides pour les entreprises de services canadiennes",
};

export default function BlogIndexPageFr() {
  return (
    <main id="main-content" className="min-h-screen bg-[#F8F5EF]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(blogSchema) }} />

      {/* Nav */}
      <nav className="bg-white/80 backdrop-blur-xl border-b border-[#E9DDCB] sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/fr" className="flex items-center gap-2.5">
            <Image src="/logo-icon.png" alt="Pulse" width={32} height={32} className="w-8 h-8 object-contain" />
            <span className="text-base font-bold text-slate-900 tracking-tight">Pulse Booking</span>
          </Link>
          <Link
            href="/register?lang=fr"
            className="text-sm font-medium bg-violet-600 text-white px-4 py-2 rounded-xl hover:bg-violet-700 shadow-md shadow-violet-200 transition-colors"
          >
            Commencer gratuitement
          </Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-16">
        {/* Hero */}
        <div className="mb-14">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight mb-4">
            Le blogue Pulse
          </h1>
          <p className="text-lg text-slate-500 max-w-xl">
            Conseils de réservation, guides sur les absences et stratégies de croissance pour les entreprises de services canadiennes.
          </p>
        </div>

        {/* Post grid */}
        <div className="grid sm:grid-cols-2 gap-6">
          {posts.map((post) => (
            <article key={post.slug} className="rounded-2xl border border-[#E9DDCB] bg-white p-7 flex flex-col hover:shadow-md transition-shadow">
              <span className="inline-block text-xs font-bold uppercase tracking-widest text-violet-600 bg-violet-50 px-3 py-1 rounded-full mb-4 self-start">
                {post.category}
              </span>
              <h2 className="text-lg font-bold text-slate-900 mb-3 leading-snug">
                {post.title}
              </h2>
              <p className="text-sm text-slate-500 leading-relaxed mb-5 flex-1">
                {post.excerpt}
              </p>
              <div className="flex items-center justify-between">
                <div className="text-xs text-slate-400">
                  <span>{post.date}</span>
                  <span className="mx-2">·</span>
                  <span>{post.readTime}</span>
                </div>
                <Link
                  href={`/fr/blog/${post.slug}`}
                  className="text-sm font-semibold text-violet-600 hover:underline"
                >
                  Lire la suite →
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-[#E9DDCB] bg-white/80 py-8 mt-16">
        <div className="max-w-4xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-sm text-slate-400">© {new Date().getFullYear()} Pulse Appointments</span>
          <div className="flex gap-6 text-sm text-slate-500">
            <Link href="/fr" className="hover:text-violet-600 transition-colors">Accueil</Link>
            <Link href="/fr/pricing" className="hover:text-violet-600 transition-colors">Tarifs</Link>
            <Link href="/fr/terms" className="hover:text-violet-600 transition-colors">Conditions</Link>
            <Link href="/fr/privacy" className="hover:text-violet-600 transition-colors">Confidentialité</Link>
            <Link href="/fr/support" className="hover:text-violet-600 transition-colors">Soutien</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

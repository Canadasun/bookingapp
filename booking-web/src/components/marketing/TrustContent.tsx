import Image from "next/image";
import Link from "next/link";
import { BadgeCheck, FileCheck2, LockKeyhole, ShieldCheck } from "lucide-react";

// Bilingual trust center. EN at /trust, FR at /fr/trust.
export function TrustContent({ locale }: { locale: "en" | "fr" }) {
  const fr = locale === "fr";
  const home = fr ? "/fr" : "/";

  const trustItems = fr
    ? [
        { icon: LockKeyhole, title: "Documentation de sécurité", body: "Page de sécurité publique couvrant la sécurité du transport, la gestion des mots de passe, la surveillance et la protection des comptes.", href: "/fr/security", label: "Sécurité" },
        { icon: ShieldCheck, title: "Orientations sur la vie privée au Canada", body: "LPRPDE, vie privée provinciale, LCAP, résidence des données et considérations relatives aux renseignements sur la santé pour les entreprises canadiennes.", href: "/fr/canadian-privacy", label: "Confidentialité (Canada)" },
        { icon: BadgeCheck, title: "Badges d’entreprise vérifiée", body: "Pulse peut afficher un badge de vérification sur les pages de réservation après l’approbation des vérifications d’identité de l’entreprise.", href: "/book", label: "Pages de réservation" },
        { icon: FileCheck2, title: "Historique des produits livrés", body: "Les nouveautés offrent aux prospects un registre public du développement et de l’entretien continus.", href: "/fr/changelog", label: "Nouveautés" },
      ]
    : [
        { icon: LockKeyhole, title: "Security documentation", body: "Public security page covering transport security, password handling, monitoring, and account protection.", href: "/security", label: "Security" },
        { icon: ShieldCheck, title: "Canadian privacy guidance", body: "PIPEDA, provincial privacy, CASL, data residency, and health-information considerations for Canadian businesses.", href: "/canadian-privacy", label: "Canadian Privacy" },
        { icon: BadgeCheck, title: "Verified business badges", body: "Pulse can show a verified badge on booking pages after business identity checks are approved.", href: "/book", label: "Booking pages" },
        { icon: FileCheck2, title: "Shipped product history", body: "The changelog gives prospects a public record of ongoing development and maintenance.", href: "/changelog", label: "Changelog" },
      ];

  return (
    <main id="main-content" className="min-h-screen bg-[#F8F5EF]">
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
        <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight mb-6">
          {fr ? "Centre de confiance Pulse" : "Pulse trust center"}
        </h1>
        <p className="text-lg text-slate-500 max-w-2xl mx-auto leading-relaxed">
          {fr
            ? "La confiance doit être vérifiable. Pulse s’appuie sur une documentation publique, des processus d’entreprise vérifiée, de véritables demandes d’avis clients et un historique de produit transparent plutôt que sur des témoignages fictifs."
            : "Trust should be verifiable. Pulse uses public documentation, verified-business workflows, real client review requests, and transparent product history instead of placeholder testimonials."}
        </p>
      </section>

      <section className="pb-20">
        <div className="max-w-5xl mx-auto px-6 grid md:grid-cols-2 gap-6">
          {trustItems.map(({ icon: Icon, title, body, href, label }) => (
            <Link key={href} href={href} className="bg-white rounded-2xl border border-[#E9DDCB] p-7 shadow-sm hover:border-violet-300 hover:shadow-md transition-all">
              <div className="w-11 h-11 rounded-xl bg-violet-50 flex items-center justify-center mb-5">
                <Icon className="w-5 h-5 text-violet-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 mb-2">{title}</h2>
              <p className="text-sm text-slate-500 leading-relaxed mb-4">{body}</p>
              <span className="text-sm font-semibold text-violet-600">{label} →</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

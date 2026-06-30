import Link from "next/link";

const SOURCES = {
  cai: "https://www.cai.gouv.qc.ca/protection-renseignements-personnels/sujets-et-domaines-dinteret/principaux-changements-loi-25",
  privateSector: "https://www.cai.gouv.qc.ca/protection-renseignements-personnels/information-entreprises-privees",
  french: "https://www.quebec.ca/gouvernement/politiques-orientations/langue-francaise/proteger-langue",
  oqlf: "https://www.oqlf.gouv.qc.ca/francisation/entreprises/memo-assistant-francisation/publications/fiche-medias-sociaux-sites-web-doc-publicitaires.pdf",
};

export function QuebecComplianceContent({ locale }: { locale: "en" | "fr" }) {
  const fr = locale === "fr";
  const home = fr ? "/fr" : "/";
  const privacy = fr ? "/fr/privacy" : "/privacy";
  const canadianPrivacy = fr ? "/fr/canadian-privacy" : "/canadian-privacy";

  return (
    <main id="main-content" className="min-h-screen bg-[#F8F5EF] px-6 py-16 text-slate-800">
      <article className="mx-auto max-w-4xl">
        <Link href={home} className="text-sm font-semibold text-violet-700 hover:underline">
          ← {fr ? "Retour à Pulse" : "Back to Pulse"}
        </Link>

        <header className="mt-8 rounded-3xl border border-[#E9DDCB] bg-white p-8 shadow-sm sm:p-12">
          <p className="text-xs font-bold uppercase tracking-widest text-violet-700">
            {fr ? "Guide de préparation — Québec" : "Quebec readiness guide"}
          </p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-slate-950">
            {fr ? "Langue française et protection des renseignements personnels" : "French-language and privacy readiness"}
          </h1>
          <p className="mt-5 text-lg leading-8 text-slate-600">
            {fr
              ? "Pulse offre une expérience de réservation bilingue et des outils de protection des renseignements personnels. Cette page explique comment ces fonctions peuvent soutenir votre propre démarche de conformité."
              : "Pulse provides a bilingual booking experience and privacy controls. This page explains how those capabilities can support your organization’s own compliance work."}
          </p>
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
            {fr
              ? "Cette page est de l’information générale, et non un avis juridique ni une certification de conformité. Les obligations dépendent de vos activités, de vos effectifs et de votre utilisation de Pulse. Faites valider votre démarche par un conseiller juridique qualifié au Québec."
              : "This page is general information, not legal advice or a compliance certification. Obligations depend on your operations, workforce, and use of Pulse. Have your approach reviewed by qualified Quebec counsel."}
          </div>
        </header>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <section className="rounded-3xl border border-[#E9DDCB] bg-white p-7">
            <h2 className="text-xl font-bold text-slate-950">{fr ? "Loi 25 et vie privée" : "Law 25 and privacy"}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              {fr
                ? "La Commission d’accès à l’information décrit notamment des exigences de gouvernance, de transparence, de gestion des incidents, d’évaluation des facteurs relatifs à la vie privée et de portabilité."
                : "Quebec’s privacy regulator describes requirements involving governance, transparency, incident handling, privacy impact assessments, and data portability."}
            </p>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700">
              <li>{fr ? "Désignez et publiez les coordonnées de votre responsable de la protection des renseignements personnels." : "Designate and publish contact details for your privacy officer."}</li>
              <li>{fr ? "Documentez la collecte, l’utilisation, la conservation, la destruction et le traitement des plaintes." : "Document collection, use, retention, destruction, and complaint handling."}</li>
              <li>{fr ? "Évaluez vos propres configurations, intégrations et fournisseurs avant le déploiement." : "Assess your own configurations, integrations, and vendors before deployment."}</li>
            </ul>
            <div className="mt-5 flex flex-col gap-2 text-sm font-semibold text-violet-700">
              <a href={SOURCES.cai} target="_blank" rel="noreferrer" className="hover:underline">{fr ? "Changements apportés par la Loi 25 — CAI" : "Law 25 changes — CAI"}</a>
              <a href={SOURCES.privateSector} target="_blank" rel="noreferrer" className="hover:underline">{fr ? "Guide pour les entreprises privées — CAI" : "Private-sector guidance — CAI"}</a>
            </div>
          </section>

          <section className="rounded-3xl border border-[#E9DDCB] bg-white p-7">
            <h2 className="text-xl font-bold text-slate-950">{fr ? "Charte de la langue française" : "Charter of the French Language"}</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              {fr
                ? "Le gouvernement du Québec présente le français comme la seule langue officielle et commune du Québec. L’OQLF indique que le site Web d’une entreprise qui fait des affaires au Québec doit être accessible en français."
                : "The Quebec government identifies French as Quebec’s sole official and common language. OQLF guidance states that a business operating in Quebec must make its website available in French."}
            </p>
            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-700">
              <li>{fr ? "Configurez les titres et introductions français de votre page de réservation." : "Configure French booking-page headlines and introductions."}</li>
              <li>{fr ? "Testez le parcours client et les communications transactionnelles en français." : "Test the client journey and transactional communications in French."}</li>
              <li>{fr ? "Faites réviser vos contenus, contrats et affichages par vos conseillers." : "Have counsel review your content, contracts, and commercial displays."}</li>
            </ul>
            <div className="mt-5 flex flex-col gap-2 text-sm font-semibold text-violet-700">
              <a href={SOURCES.french} target="_blank" rel="noreferrer" className="hover:underline">{fr ? "Protection du français — Québec.ca" : "Protection of French — Quebec.ca"}</a>
              <a href={SOURCES.oqlf} target="_blank" rel="noreferrer" className="hover:underline">{fr ? "Sites Web et documents publicitaires — OQLF" : "Websites and advertising — OQLF"}</a>
            </div>
          </section>
        </div>

        <section className="mt-6 rounded-3xl border border-[#E9DDCB] bg-white p-7">
          <h2 className="text-xl font-bold text-slate-950">{fr ? "Ce que Pulse fournit aujourd’hui" : "What Pulse provides today"}</h2>
          <ul className="mt-4 grid gap-3 text-sm leading-6 text-slate-700 sm:grid-cols-2">
            <li>✓ {fr ? "Interface de réservation client en français et en anglais" : "French and English client booking interface"}</li>
            <li>✓ {fr ? "Confirmations et rappels selon la langue du rendez-vous" : "Confirmations and reminders using the appointment language"}</li>
            <li>✓ {fr ? "Consentement, exportation et suppression de données" : "Consent, data export, and deletion workflows"}</li>
            <li>✓ {fr ? "Contrôles d’accès et journalisation opérationnelle" : "Access controls and operational logging"}</li>
          </ul>
          <p className="mt-5 text-sm leading-6 text-slate-500">
            {fr
              ? "Ces fonctions peuvent soutenir votre programme, mais ne rendent pas automatiquement votre entreprise conforme."
              : "These capabilities can support your program, but do not automatically make your organization compliant."}
          </p>
          <div className="mt-5 flex flex-wrap gap-4 text-sm font-semibold text-violet-700">
            <Link href={privacy} className="hover:underline">{fr ? "Politique de confidentialité" : "Privacy policy"}</Link>
            <Link href={canadianPrivacy} className="hover:underline">{fr ? "Confidentialité au Canada" : "Canadian privacy"}</Link>
          </div>
        </section>

        <p className="mt-8 text-xs text-slate-500">
          {fr ? "Dernière révision : 30 juin 2026." : "Last reviewed: June 30, 2026."}
        </p>
      </article>
    </main>
  );
}

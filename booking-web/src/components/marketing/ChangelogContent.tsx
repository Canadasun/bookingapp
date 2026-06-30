import Link from "next/link";

// Bilingual changelog. EN at /changelog, FR at /fr/changelog.
type Tag = "new" | "improvement" | "security";

const tagStyles: Record<Tag, string> = {
  new: "bg-violet-100 text-violet-700",
  improvement: "bg-blue-100 text-blue-700",
  security: "bg-green-100 text-green-700",
};

const tagLabels: Record<"en" | "fr", Record<Tag, string>> = {
  en: { new: "New", improvement: "Improvement", security: "Security" },
  fr: { new: "Nouveau", improvement: "Amélioration", security: "Sécurité" },
};

type Entry = {
  date: { en: string; fr: string };
  tag: Tag;
  title: { en: string; fr: string };
  body: { en: string; fr: string };
};

const entries: Entry[] = [
  {
    date: { en: "June 2026", fr: "Juin 2026" },
    tag: "new",
    title: { en: "Google & Apple Sign-In", fr: "Connexion Google et Apple" },
    body: {
      en: "Clients and business owners can now sign in and create accounts with a single click using Google or Apple. Works on web and mobile. GDPR/CASL consent is captured automatically.",
      fr: "Les clients et les propriétaires d’entreprise peuvent maintenant se connecter et créer un compte en un seul clic avec Google ou Apple. Fonctionne sur le web et le mobile. Le consentement RGPD/LCAP est recueilli automatiquement.",
    },
  },
  {
    date: { en: "June 2026", fr: "Juin 2026" },
    tag: "new",
    title: { en: "WebSocket real-time dashboard", fr: "Tableau de bord en temps réel par WebSocket" },
    body: {
      en: "The appointment calendar and inbox now update in real time when staff take actions — no more manual refreshes. Built on a hardened WebSocket layer with per-business channel isolation.",
      fr: "Le calendrier des rendez-vous et la boîte de réception se mettent maintenant à jour en temps réel lorsque le personnel agit — fini les rafraîchissements manuels. Bâti sur une couche WebSocket renforcée avec isolation des canaux par entreprise.",
    },
  },
  {
    date: { en: "June 2026", fr: "Juin 2026" },
    tag: "improvement",
    title: { en: "Booking approval mode", fr: "Mode d’approbation des réservations" },
    body: {
      en: "Businesses can now switch between Manual approval (bookings land as Pending until you confirm) and Auto-confirm (clients get an instant confirmation). Set it in Settings → Booking Policies.",
      fr: "Les entreprises peuvent maintenant basculer entre l’approbation manuelle (les réservations restent En attente jusqu’à votre confirmation) et la confirmation automatique (les clients reçoivent une confirmation instantanée). À régler dans Paramètres → Politiques de réservation.",
    },
  },
  {
    date: { en: "June 2026", fr: "Juin 2026" },
    tag: "new",
    title: { en: "Revenue Protected dashboard metric", fr: "Indicateur « Revenus protégés » au tableau de bord" },
    body: {
      en: "The Reports page now shows a Revenue Protected card — the total of deposits collected, no-show fees, and late-cancellation fees. See exactly how much money Pulse has protected for your business.",
      fr: "La page Rapports affiche maintenant une carte Revenus protégés — le total des dépôts perçus, des frais de non-présentation et des frais d’annulation tardive. Voyez exactement combien d’argent Pulse a protégé pour votre entreprise.",
    },
  },
  {
    date: { en: "June 2026", fr: "Juin 2026" },
    tag: "new",
    title: { en: "Client self-cancel toggle", fr: "Option d’auto-annulation par le client" },
    body: {
      en: "Business owners can now disable client self-cancel from Settings → Booking Policies. When off, clients see a neutral message directing them to contact the business.",
      fr: "Les propriétaires d’entreprise peuvent maintenant désactiver l’auto-annulation par le client dans Paramètres → Politiques de réservation. Une fois désactivée, les clients voient un message neutre les invitant à communiquer avec l’entreprise.",
    },
  },
  {
    date: { en: "June 2026", fr: "Juin 2026" },
    tag: "improvement",
    title: { en: "Client blocklist", fr: "Liste de blocage des clients" },
    body: {
      en: "Staff can now block a client from their profile page. Blocked clients cannot complete new bookings online. The reason is visible only to staff — clients see a neutral slot-unavailable message.",
      fr: "Le personnel peut maintenant bloquer un client depuis sa page de profil. Les clients bloqués ne peuvent pas effectuer de nouvelles réservations en ligne. La raison n’est visible que par le personnel — les clients voient un message neutre indiquant que la plage est indisponible.",
    },
  },
  {
    date: { en: "May 2026", fr: "Mai 2026" },
    tag: "new",
    title: { en: "Memberships and recurring billing", fr: "Abonnements et facturation récurrente" },
    body: {
      en: "Sell monthly memberships with Stripe billing. Members get discounted rates or free services included per billing period. Full member portal with usage tracking.",
      fr: "Vendez des abonnements mensuels avec la facturation Stripe. Les membres bénéficient de tarifs réduits ou de services gratuits inclus à chaque période de facturation. Portail des membres complet avec suivi de l’utilisation.",
    },
  },
  {
    date: { en: "May 2026", fr: "Mai 2026" },
    tag: "new",
    title: { en: "Gift cards", fr: "Cartes-cadeaux" },
    body: {
      en: "Sell digital gift cards directly from your booking page. Clients receive a code by email and can redeem it at checkout.",
      fr: "Vendez des cartes-cadeaux numériques directement depuis votre page de réservation. Les clients reçoivent un code par courriel et peuvent l’utiliser au moment du paiement.",
    },
  },
  {
    date: { en: "May 2026", fr: "Mai 2026" },
    tag: "new",
    title: { en: "Packages (pre-paid credit bundles)", fr: "Forfaits (blocs de crédits prépayés)" },
    body: {
      en: "Sell 5-visit, 10-visit, or custom credit bundles. Clients redeem credits when they book. Track usage per client.",
      fr: "Vendez des blocs de 5 visites, 10 visites ou des forfaits personnalisés. Les clients utilisent leurs crédits au moment de réserver. Suivez l’utilisation par client.",
    },
  },
  {
    date: { en: "April 2026", fr: "Avril 2026" },
    tag: "improvement",
    title: { en: "Multi-location support", fr: "Prise en charge de plusieurs établissements" },
    body: {
      en: "Unlimited plan businesses can now add multiple locations. Staff are assigned to locations, clients see location details at booking, and the calendar filters by location.",
      fr: "Les entreprises au forfait Illimité peuvent maintenant ajouter plusieurs établissements. Le personnel est affecté aux établissements, les clients voient les détails de l’établissement au moment de réserver et le calendrier se filtre par établissement.",
    },
  },
  {
    date: { en: "April 2026", fr: "Avril 2026" },
    tag: "new",
    title: { en: "Google Calendar two-way sync", fr: "Synchronisation bidirectionnelle Google Agenda" },
    body: {
      en: "Connect your Google Calendar and appointments sync automatically in both directions. Busy blocks from your personal calendar appear as unavailable in your booking page.",
      fr: "Connectez votre Google Agenda et vos rendez-vous se synchronisent automatiquement dans les deux sens. Les plages occupées de votre agenda personnel apparaissent comme indisponibles sur votre page de réservation.",
    },
  },
  {
    date: { en: "March 2026", fr: "Mars 2026" },
    tag: "security",
    title: { en: "Two-factor authentication", fr: "Authentification à deux facteurs" },
    body: {
      en: "2FA is now available via email or SMS for all accounts. Recovery codes provided at enrollment. Trusted device memory for 30 days.",
      fr: "L’authentification à deux facteurs est maintenant offerte par courriel ou SMS pour tous les comptes. Des codes de récupération sont fournis à l’inscription. Mémorisation des appareils de confiance pendant 30 jours.",
    },
  },
  {
    date: { en: "March 2026", fr: "Mars 2026" },
    tag: "new",
    title: { en: "No-show fee auto-charge", fr: "Frais de non-présentation prélevés automatiquement" },
    body: {
      en: "Set a no-show fee and Pulse automatically charges the saved card when you mark a client as no-show. Works with card-on-file and deposit flows.",
      fr: "Définissez des frais de non-présentation et Pulse prélève automatiquement la carte enregistrée lorsque vous marquez un client comme absent. Fonctionne avec les parcours carte au dossier et dépôt.",
    },
  },
];

export function ChangelogContent({ locale }: { locale: "en" | "fr" }) {
  const fr = locale === "fr";
  const home = fr ? "/fr" : "/";
  const supportHref = fr ? "/fr/support" : "/support";

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <Link href={home} className="inline-flex items-center gap-2 mb-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-icon.png" alt="Pulse" className="w-8 h-8 object-contain" />
          <span className="text-2xl font-bold text-slate-900 tracking-tight">Pulse Appointments</span>
        </Link>

        <div className="mb-10">
          <h1 className="text-4xl font-bold text-slate-900 mb-2">{fr ? "Nouveautés" : "What's New"}</h1>
          <p className="text-slate-500">{fr ? "Lancements de fonctionnalités, améliorations et correctifs — du plus récent au plus ancien." : "Feature releases, improvements, and fixes — newest first."}</p>
        </div>

        <div className="space-y-6">
          {entries.map((e, i) => (
            <div key={i} className="bg-white rounded-2xl border border-slate-200 p-6">
              <div className="flex items-center gap-3 mb-3">
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${tagStyles[e.tag]}`}>{tagLabels[locale][e.tag]}</span>
                <span className="text-xs text-slate-400">{e.date[locale]}</span>
              </div>
              <h2 className="text-base font-semibold text-slate-900 mb-1.5">{e.title[locale]}</h2>
              <p className="text-sm text-slate-600 leading-relaxed">{e.body[locale]}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-sm text-slate-500 mb-4">{fr ? "Une suggestion de fonctionnalité ou un bogue à signaler?" : "Have a feature request or found a bug?"}</p>
          <Link href={supportHref} className="inline-block bg-violet-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-violet-700 transition-colors">
            {fr ? "Contacter le soutien" : "Contact support"}
          </Link>
        </div>
      </div>
    </div>
  );
}

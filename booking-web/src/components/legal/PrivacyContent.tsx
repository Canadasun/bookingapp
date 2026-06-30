import Link from "next/link";
import { Database, Eye, Lock, Mail, Scale, Share2, ShieldCheck, Trash2 } from "lucide-react";

// Bilingual Privacy Policy. Section copy switches on locale so /privacy and
// /fr/privacy stay aligned section-for-section.
export function PrivacyContent({ locale }: { locale: "en" | "fr" }) {
  const fr = locale === "fr";
  const home = fr ? "/fr" : "/";
  const termsHref = fr ? "/fr/terms" : "/terms";

  const sections = fr ? [
    {
      icon: Eye,
      title: "1. Renseignements que nous recueillons",
      content: (
        <div className="space-y-3">
          <p><strong>Renseignements sur le compte et l’entreprise :</strong> noms, coordonnées de l’entreprise, adresses courriel, numéros de téléphone, emplacements, profils du personnel, paramètres de connexion et de sécurité.</p>
          <p><strong>Renseignements sur les réservations et les clients :</strong> détails des rendez-vous, services, notes, réponses aux formulaires d’admission, coordonnées, préférences, messages, avis, factures et références de transactions saisis par une entreprise ou un client.</p>
          <p><strong>Renseignements techniques :</strong> adresse IP, type de navigateur ou d’application, renseignements sur l’appareil, fuseau horaire, événements de connexion, témoins, diagnostics et journaux de sécurité.</p>
          <p><strong>Renseignements de paiement :</strong> Stripe recueille directement les détails de carte et bancaires. Pulse reçoit des identifiants limités, l’état, le montant et les registres de transactions, mais ne conserve pas les numéros de carte complets ni les codes de sécurité.</p>
        </div>
      ),
    },
    {
      icon: Database,
      title: "2. Comment nous utilisons les renseignements",
      content: (
        <ul className="list-disc space-y-2 pl-5">
          <li>Fournir les comptes, la réservation en ligne, la planification, les rappels, la messagerie, les paiements, les rapports, le soutien et les fonctions connexes de la plateforme.</li>
          <li>Authentifier les utilisateurs, prévenir la fraude et les abus, enquêter sur les incidents et protéger la plateforme.</li>
          <li>Traiter les abonnements et les transactions, tenir des registres financiers et respecter les obligations légales.</li>
          <li>Améliorer la fiabilité et la convivialité à l’aide de diagnostics et de renseignements agrégés.</li>
          <li>Envoyer des communications liées au service. Les courriels ou SMS de marketing ne sont envoyés que lorsque la législation canadienne anti-pourriel le permet et comprennent une méthode de désabonnement lorsque cela est requis.</li>
        </ul>
      ),
    },
    {
      icon: Scale,
      title: "3. Responsabilités de l’entreprise et de la plateforme",
      content: (
        <div className="space-y-3">
          <p>Pulse exerce ses activités depuis l’Alberta et traite les renseignements personnels conformément aux lois canadiennes applicables sur la protection de la vie privée, y compris la <em>Personal Information Protection Act</em> (PIPA) de l’Alberta et, le cas échéant, la <em>Loi sur la protection des renseignements personnels et les documents électroniques</em> (LPRPDE) fédérale.</p>
          <p>Les entreprises qui utilisent Pulse décident des renseignements clients à recueillir et de leurs fins. Chaque entreprise est responsable de ses avis, consentements, utilisation licite, accès du personnel, exigences de conservation et de toute obligation propre à son secteur. Pulse traite ces renseignements pour fournir les services demandés par l’entreprise.</p>
          <p>Pulse n’est pas dépositaire de renseignements sur la santé du simple fait qu’une entreprise saisit des renseignements de rendez-vous ou d’admission. Les fournisseurs réglementés demeurent responsables de déterminer si les lois du secteur de la santé s’appliquent et de conclure toute entente de gestion des renseignements requise.</p>
        </div>
      ),
    },
    {
      icon: Share2,
      title: "4. Fournisseurs de services et divulgation",
      content: (
        <div className="space-y-3">
          <p>Nous ne vendons pas de renseignements personnels. Nous ne divulguons des renseignements que dans la mesure nécessaire pour exploiter Pulse, donner suite à une demande d’un utilisateur, protéger les droits et la sécurité, réaliser une transaction commerciale ou nous conformer à la loi.</p>
          <p>Les fournisseurs peuvent comprendre Stripe pour les paiements, Twilio pour les SMS, Resend pour le courriel, Expo et les services des plateformes d’appareils pour les notifications poussées, Railway et d’autres fournisseurs d’infrastructure pour l’hébergement, Sentry pour la surveillance des erreurs, ainsi que des fournisseurs d’analyse ou d’IA soigneusement limités lorsqu’ils sont activés. Ces fournisseurs peuvent traiter des renseignements à l’extérieur de l’Alberta ou du Canada, où ils peuvent être assujettis à des lois étrangères.</p>
          <p>Les entreprises et leur personnel autorisé peuvent accéder à leurs propres dossiers clients. Les clients doivent d’abord communiquer avec l’entreprise concernée au sujet des dossiers contrôlés par celle-ci.</p>
        </div>
      ),
    },
    {
      icon: Lock,
      title: "5. Sécurité",
      content: (
        <div className="space-y-3">
          <p>Nous utilisons des mesures de protection administratives, techniques et physiques adaptées à la sensibilité des renseignements, notamment des connexions réseau chiffrées, le hachage des mots de passe, des contrôles d’accès, la surveillance, des sauvegardes et l’authentification à deux facteurs facultative.</p>
          <p>Aucun service Internet ne peut garantir une sécurité absolue. Les utilisateurs doivent protéger leurs identifiants, activer l’authentification à deux facteurs, restreindre l’accès du personnel et nous aviser rapidement de toute utilisation non autorisée soupçonnée.</p>
          <p>Lorsqu’une atteinte à la vie privée crée un risque réel de préjudice grave ou exige autrement un avis, nous enquêterons, conserverons les registres requis et aviserons les personnes touchées et les organismes de réglementation, conformément à la loi applicable.</p>
        </div>
      ),
    },
    {
      icon: Trash2,
      title: "6. Conservation, accès et suppression",
      content: (
        <div className="space-y-3">
          <p>Nous ne conservons les renseignements que le temps raisonnablement nécessaire aux fins décrites ici, à un compte actif, aux cycles de sauvegarde et de différends, à la prévention de la fraude et aux exigences légales, fiscales, comptables ou réglementaires. Les périodes de conservation varient selon le type de dossier.</p>
          <p>Vous pouvez demander à accéder aux renseignements personnels détenus par Pulse ou à les corriger, retirer votre consentement lorsque le traitement en dépend, ou demander la suppression. Certains renseignements ne peuvent être supprimés immédiatement lorsque la conservation est exigée par la loi, nécessaire pour réaliser une transaction, protéger des droits légaux ou contenue dans des sauvegardes sécurisées en attente de suppression normale.</p>
          <p>Les demandes peuvent exiger une vérification d’identité. Nous visons à répondre dans le délai requis par la loi applicable. Les demandes relatives aux dossiers clients peuvent être renvoyées à l’entreprise qui contrôle ces dossiers.</p>
        </div>
      ),
    },
    {
      icon: Mail,
      title: "7. Témoins, communications et choix",
      content: (
        <div className="space-y-3">
          <p>Pulse utilise des témoins nécessaires pour l’authentification, la sécurité, les préférences et le fonctionnement de base. Les analyses facultatives sont utilisées selon les choix de consentement présentés sur le site.</p>
          <p>Les confirmations de rendez-vous, les reçus, les alertes de sécurité et les avis de compte sont des messages de service. Vous pouvez modifier les notifications d’entreprise facultatives dans les paramètres, utiliser le lien de désabonnement dans les messages de marketing ou communiquer avec l’expéditeur. Les notifications poussées de l’appareil peuvent être désactivées dans les paramètres de l’appareil.</p>
        </div>
      ),
    },
  ] : [
    {
      icon: Eye,
      title: "1. Information we collect",
      content: (
        <div className="space-y-3">
          <p><strong>Account and business information:</strong> names, business details, email addresses, phone numbers, locations, staff profiles, login and security settings.</p>
          <p><strong>Booking and client information:</strong> appointment details, services, notes, intake answers, contact details, preferences, messages, reviews, invoices, and transaction references entered by a business or client.</p>
          <p><strong>Technical information:</strong> IP address, browser or app type, device information, timezone, login events, cookies, diagnostics, and security logs.</p>
          <p><strong>Payment information:</strong> Stripe collects card and banking details directly. Pulse receives limited identifiers, status, amount, and transaction records, but does not store complete card numbers or security codes.</p>
        </div>
      ),
    },
    {
      icon: Database,
      title: "2. How we use information",
      content: (
        <ul className="list-disc space-y-2 pl-5">
          <li>Provide accounts, online booking, scheduling, reminders, messaging, payments, reporting, support, and related platform functions.</li>
          <li>Authenticate users, prevent fraud and abuse, investigate incidents, and protect the platform.</li>
          <li>Process subscriptions and transactions, maintain financial records, and meet legal obligations.</li>
          <li>Improve reliability and usability using diagnostics and aggregated information.</li>
          <li>Send service communications. Marketing email or SMS is sent only where permitted by Canada&apos;s anti-spam legislation, and includes an unsubscribe method where required.</li>
        </ul>
      ),
    },
    {
      icon: Scale,
      title: "3. Business and platform responsibilities",
      content: (
        <div className="space-y-3">
          <p>Pulse operates from Alberta and handles personal information under applicable Canadian privacy laws, including Alberta&apos;s <em>Personal Information Protection Act</em> (PIPA) and, where applicable, the federal <em>Personal Information Protection and Electronic Documents Act</em> (PIPEDA).</p>
          <p>Businesses using Pulse decide what client information to collect and why. Each business is responsible for its notices, consents, lawful use, staff access, retention requirements, and any industry-specific obligations. Pulse processes that information to provide the services requested by the business.</p>
          <p>Pulse is not a health-information custodian merely because a business enters appointment or intake information. Regulated providers remain responsible for determining whether health-sector laws apply and for entering any required information-management agreement.</p>
        </div>
      ),
    },
    {
      icon: Share2,
      title: "4. Service providers and disclosure",
      content: (
        <div className="space-y-3">
          <p>We do not sell personal information. We disclose information only as needed to operate Pulse, complete a user&apos;s request, protect rights and safety, complete a business transaction, or comply with law.</p>
          <p>Providers may include Stripe for payments, Twilio for SMS, Resend for email, Expo and device-platform services for push notifications, Railway and other infrastructure providers for hosting, Sentry for error monitoring, and carefully limited analytics or AI providers where enabled. These providers may process information outside Alberta or Canada, where it may be subject to foreign law.</p>
          <p>Businesses and their authorized staff can access their own client records. Clients should contact the relevant business first about records controlled by that business.</p>
        </div>
      ),
    },
    {
      icon: Lock,
      title: "5. Security",
      content: (
        <div className="space-y-3">
          <p>We use administrative, technical, and physical safeguards appropriate to the sensitivity of the information, including encrypted network connections, password hashing, access controls, monitoring, backups, and optional two-factor authentication.</p>
          <p>No internet service can guarantee absolute security. Users must protect credentials, enable two-factor authentication, restrict staff access, and notify us promptly of suspected unauthorized use.</p>
          <p>Where a privacy breach creates a real risk of significant harm or otherwise requires notice, we will investigate, keep required records, and notify affected people and regulators as required by applicable law.</p>
        </div>
      ),
    },
    {
      icon: Trash2,
      title: "6. Retention, access, and deletion",
      content: (
        <div className="space-y-3">
          <p>We retain information only as long as reasonably needed for the purposes described here, an active account, backup and dispute cycles, fraud prevention, and legal, tax, accounting, or regulatory requirements. Retention periods vary by record type.</p>
          <p>You may ask to access or correct personal information held by Pulse, withdraw consent where processing depends on consent, or request deletion. Some information cannot be deleted immediately where retention is legally required, needed to complete a transaction, protect legal rights, or contained in secured backups pending normal deletion.</p>
          <p>Requests may require identity verification. We aim to respond within the period required by applicable law. Client-record requests may be referred to the business that controls those records.</p>
        </div>
      ),
    },
    {
      icon: Mail,
      title: "7. Cookies, communications, and choices",
      content: (
        <div className="space-y-3">
          <p>Pulse uses necessary cookies for authentication, security, preferences, and core operation. Optional analytics are used according to the consent choices presented on the site.</p>
          <p>Appointment confirmations, receipts, security alerts, and account notices are service messages. You can change optional business notifications in settings, use the unsubscribe link in marketing messages, or contact the sender. Device push notifications can be disabled in device settings.</p>
        </div>
      ),
    },
  ];

  return (
    <main className="min-h-screen bg-[#F8F5EF] px-5 py-12 sm:py-16">
      <div className="mx-auto max-w-4xl">
        <Link href={home} className="mb-8 inline-flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-icon.png" alt="Pulse Appointments" className="h-9 w-9 object-contain" />
          <span className="text-xl font-bold tracking-tight text-slate-950">Pulse Appointments</span>
        </Link>

        <article className="overflow-hidden rounded-[2rem] border border-amber-900/10 bg-white shadow-xl shadow-amber-950/5">
          <header className="bg-slate-950 px-7 py-10 text-white sm:px-12">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">{fr ? "Mentions légales" : "Legal"}</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{fr ? "Politique de confidentialité" : "Privacy Policy"}</h1>
            <p className="mt-3 text-sm text-slate-300">{fr ? "En vigueur le 13 juin 2026 · Calgary, Alberta, Canada" : "Effective June 13, 2026 · Calgary, Alberta, Canada"}</p>
          </header>

          <div className="space-y-10 px-7 py-9 text-sm leading-7 text-slate-600 sm:px-12 sm:py-12">
            <div className="flex gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
              <ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-amber-700" />
              {fr ? (
                <p>Pulse Appointments est exploité par <strong>Idowu Ayeni</strong>. La présente politique explique comment Pulse recueille, utilise, divulgue, protège et conserve les renseignements personnels lorsque les entreprises et les clients utilisent notre site Web, nos applications mobiles, nos pages de réservation et nos services connexes.</p>
              ) : (
                <p>Pulse Appointments is operated by <strong>Idowu Ayeni</strong>. This policy explains how Pulse collects, uses, discloses, protects, and retains personal information when businesses and clients use our website, mobile applications, booking pages, and related services.</p>
              )}
            </div>

            {sections.map(({ icon: Icon, title, content }) => (
              <section key={title}>
                <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-950"><Icon className="h-5 w-5 text-amber-600" />{title}</h2>
                {content}
              </section>
            ))}

            <section>
              <h2 className="mb-4 text-lg font-bold text-slate-950">{fr ? "8. Enfants et utilisateurs internationaux" : "8. Children and international users"}</h2>
              <div className="space-y-3">
                {fr ? (
                  <>
                    <p>Les comptes d’entreprise ne sont pas destinés aux personnes de moins de 18 ans. Une entreprise peut accepter des réservations pour un mineur lorsque le parent, le tuteur ou l’entreprise détient l’autorité et le consentement requis par la loi.</p>
                    <p>Les utilisateurs à l’extérieur du Canada comprennent que les renseignements peuvent être traités au Canada et dans d’autres pays où nos fournisseurs exercent leurs activités. Des droits locaux peuvent également s’appliquer.</p>
                  </>
                ) : (
                  <>
                    <p>Business accounts are not intended for anyone under 18. A business may accept bookings for a minor where the parent, guardian, or business has the authority and consent required by law.</p>
                    <p>Users outside Canada understand that information may be processed in Canada and other countries where our providers operate. Local rights may also apply.</p>
                  </>
                )}
              </div>
            </section>

            <section>
              <h2 className="mb-4 text-lg font-bold text-slate-950">{fr ? "9. Modifications et coordonnées" : "9. Changes and contact"}</h2>
              <div className="space-y-3">
                {fr ? (
                  <p>Nous pouvons mettre à jour la présente politique à mesure que Pulse, nos fournisseurs ou les exigences légales évoluent. Les changements importants seront communiqués par l’entremise du service ou par courriel s’il y a lieu. La date d’entrée en vigueur ci-dessus indique la version actuelle.</p>
                ) : (
                  <p>We may update this policy as Pulse, our providers, or legal requirements change. Material changes will be communicated through the service or by email where appropriate. The effective date above identifies the current version.</p>
                )}
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm">
                  <p className="font-bold text-slate-900">{fr ? "Responsable de la protection de la vie privée : Idowu Ayeni" : "Privacy Officer: Idowu Ayeni"}</p>
                  <p>Pulse Appointments</p>
                  <p>3 St. SE, Calgary, Alberta T2G 0T9, Canada</p>
                  <p>{fr ? "Courriel" : "Email"}: <a className="font-semibold text-amber-700 hover:underline" href="mailto:support@pulseappointments.com">support@pulseappointments.com</a></p>
                </div>
                {fr ? (
                  <p>Si nous ne pouvons pas résoudre une préoccupation relative à la vie privée, vous pouvez communiquer avec le Commissariat à l’information et à la protection de la vie privée de l’Alberta ou le Commissariat à la protection de la vie privée du Canada, selon le cas.</p>
                ) : (
                  <p>If we cannot resolve a privacy concern, you may contact the Office of the Information and Privacy Commissioner of Alberta or the Office of the Privacy Commissioner of Canada, as applicable.</p>
                )}
              </div>
            </section>

            <footer className="flex flex-col gap-4 border-t border-slate-100 pt-7 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-400">Pulse Appointments · Calgary, Alberta</p>
              <div className="flex gap-5 font-semibold text-amber-700"><Link href={termsHref} className="hover:underline">{fr ? "Conditions d’utilisation" : "Terms of Service"}</Link><Link href={home} className="hover:underline">{fr ? "Accueil" : "Home"}</Link></div>
            </footer>
          </div>
        </article>
      </div>
    </main>
  );
}

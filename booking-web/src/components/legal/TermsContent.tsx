import Link from "next/link";
import { AlertTriangle, CalendarCheck, CreditCard, FileText, Scale, ShieldCheck, Users } from "lucide-react";

// Bilingual Terms of Service. Structure lives here once; copy switches on locale
// so the English (/terms) and French (/fr/terms) routes stay in lockstep.
export function TermsContent({ locale }: { locale: "en" | "fr" }) {
  const fr = locale === "fr";
  const home = fr ? "/fr" : "/";
  const privacyHref = fr ? "/fr/privacy" : "/privacy";
  return (
    <main className="min-h-screen bg-[#F8F5EF] px-5 py-12 sm:py-16">
      <div className="mx-auto max-w-4xl">
        <Link href={home} className="mb-8 inline-flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-icon.png" alt="Pulse Appointments" className="h-9 w-9 object-contain" />
          <span className="text-xl font-bold tracking-tight text-slate-950">Pulse Appointments</span>
        </Link>

        <article className="overflow-hidden rounded-[2rem] border border-amber-900/10 bg-white shadow-xl shadow-amber-950/5">
          <header className="bg-amber-600 px-7 py-10 text-white sm:px-12">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-100">{fr ? "Entente" : "Agreement"}</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{fr ? "Conditions d’utilisation" : "Terms of Service"}</h1>
            <p className="mt-3 text-sm text-amber-100">{fr ? "En vigueur le 13 juin 2026 · Calgary, Alberta, Canada" : "Effective June 13, 2026 · Calgary, Alberta, Canada"}</p>
          </header>

          <div className="space-y-10 px-7 py-9 text-sm leading-7 text-slate-600 sm:px-12 sm:py-12">
            <div className="flex gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 text-slate-800">
              <FileText className="mt-0.5 h-6 w-6 shrink-0 text-amber-600" />
              {fr ? (
                <p>Les présentes Conditions forment une entente exécutoire entre vous et <strong>Idowu Ayeni, exploitant Pulse Appointments</strong> (« Pulse », « nous » ou « notre »). En créant un compte, en réservant par l’entremise de Pulse ou en utilisant autrement le service, vous acceptez les présentes Conditions et notre <Link href={privacyHref} className="font-semibold text-amber-700 hover:underline">politique de confidentialité</Link>.</p>
              ) : (
                <p>These Terms form a binding agreement between you and <strong>Idowu Ayeni, operating Pulse Appointments</strong> (&quot;Pulse,&quot; &quot;we,&quot; or &quot;us&quot;). By creating an account, booking through Pulse, or otherwise using the service, you agree to these Terms and our <Link href={privacyHref} className="font-semibold text-amber-700 hover:underline">Privacy Policy</Link>.</p>
              )}
            </div>

            <section>
              <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-950"><Users className="h-5 w-5 text-amber-600" />{fr ? "1. Admissibilité et comptes" : "1. Eligibility and accounts"}</h2>
              <div className="space-y-3">
                {fr ? (
                  <>
                    <p>Les titulaires de comptes d’entreprise doivent être âgés d’au moins 18 ans, avoir le pouvoir de lier l’entreprise qu’ils représentent et fournir des renseignements exacts. Vous êtes responsable des utilisateurs du personnel, des identifiants, des autorisations et de toute activité dans votre compte.</p>
                    <p>Gardez les mots de passe et les codes de récupération confidentiels, activez l’authentification à deux facteurs et signalez rapidement toute compromission soupçonnée. Pulse peut exiger une vérification d’identité, d’entreprise ou de paiement et peut refuser ou suspendre des comptes lorsque les renseignements sont inexacts ou que le risque est inacceptable.</p>
                  </>
                ) : (
                  <>
                    <p>Business account holders must be at least 18, have authority to bind the business they represent, and provide accurate information. You are responsible for staff users, credentials, permissions, and all activity under your account.</p>
                    <p>Keep passwords and recovery codes confidential, enable two-factor authentication, and promptly report suspected compromise. Pulse may require identity, business, or payment verification and may refuse or suspend accounts where information is inaccurate or risk is unacceptable.</p>
                  </>
                )}
              </div>
            </section>

            <section>
              <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-950"><CalendarCheck className="h-5 w-5 text-amber-600" />{fr ? "2. Rôle de la plateforme et responsabilités de l’entreprise" : "2. Platform role and business responsibilities"}</h2>
              <div className="space-y-3">
                {fr ? (
                  <>
                    <p>Pulse fournit des logiciels de planification, de réservation, de messagerie, de soutien aux paiements et de gestion d’entreprise. Chaque entreprise inscrite est indépendante et est seule responsable de ses services, de son personnel, de ses licences, de ses prix, de ses taxes, de ses disponibilités, de la sécurité, de la relation client, de sa politique d’annulation, des remboursements et du respect des lois qui lui sont applicables.</p>
                    <p>Pulse n’est pas partie au contrat de service entre une entreprise et son client, n’emploie pas les prestataires de services et ne garantit aucune entreprise, aucun client, aucun rendez-vous, aucun résultat ni la qualité d’un service. Les entreprises doivent présenter des descriptions exactes et obtenir tous les consentements requis pour recueillir les renseignements des clients et envoyer des communications.</p>
                    <p>Les utilisateurs ne doivent pas utiliser Pulse à des fins illégales, frauduleuses, trompeuses, abusives, discriminatoires, contrefaisantes, dangereuses ou non sollicitées; introduire du code malveillant; sonder la sécurité; extraire ou revendre la plateforme; ni accéder à des renseignements sans autorisation.</p>
                  </>
                ) : (
                  <>
                    <p>Pulse supplies scheduling, booking, messaging, payment-support, and business-management software. Each listed business is independent and is solely responsible for its services, staff, licences, prices, taxes, availability, safety, client relationship, cancellation policy, refunds, and compliance with laws that apply to it.</p>
                    <p>Pulse is not a party to the service contract between a business and its client, does not employ service providers, and does not guarantee a business, client, appointment, result, or service quality. Businesses must present accurate descriptions and obtain all consents needed to collect client information and send communications.</p>
                    <p>Users must not use Pulse for unlawful, fraudulent, misleading, abusive, discriminatory, infringing, unsafe, or unsolicited activity; introduce malicious code; probe security; scrape or resell the platform; or access information without authorization.</p>
                  </>
                )}
              </div>
            </section>

            <section>
              <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-950"><CreditCard className="h-5 w-5 text-amber-600" />{fr ? "3. Réservations, frais aux clients et différends" : "3. Bookings, client charges, and disputes"}</h2>
              <div className="space-y-3">
                {fr ? (
                  <>
                    <p>Une entreprise peut exiger un acompte, une carte enregistrée, des frais d’absence ou des frais d’annulation tardive. L’entreprise doit divulguer sa politique et facturer avant la confirmation. En confirmant une réservation et en soumettant un mode de paiement, le client autorise les frais divulgués par l’entremise de Stripe.</p>
                    <p>Stripe et l’entreprise connectée traitent les paiements. Pulse ne détient pas les fonds des clients et n’établit pas la politique d’annulation ou de remboursement d’une entreprise. Les clients doivent d’abord communiquer avec l’entreprise au sujet de la qualité d’un rendez-vous, des remboursements ou des frais contestés, puis communiquer avec l’émetteur de leur carte ou le soutien de Pulse au besoin.</p>
                    <p>Les rétrofacturations, annulations, remboursements, taxes, soldes négatifs et frais de traitement peuvent être imputés à l’entreprise responsable lorsque cela est permis. Pulse peut retarder ou restreindre les fonctions de paiement afin de gérer les risques de fraude, juridiques ou liés au processeur.</p>
                  </>
                ) : (
                  <>
                    <p>A business may require a deposit, card on file, no-show fee, or late-cancellation fee. The business must disclose its policy and charge before confirmation. By confirming a booking and submitting a payment method, the client authorizes the disclosed charges through Stripe.</p>
                    <p>Stripe and the connected business process payments. Pulse does not hold client funds and does not set a business&apos;s cancellation or refund policy. Clients should first contact the business about appointment quality, refunds, or disputed charges, then contact their card issuer or Pulse support if needed.</p>
                    <p>Chargebacks, reversals, refunds, taxes, negative balances, and processor fees may be passed to the responsible business where permitted. Pulse may delay or restrict payment features to manage fraud, legal, or processor risk.</p>
                  </>
                )}
              </div>
            </section>

            <section>
              <h2 className="mb-4 text-lg font-bold text-slate-950">{fr ? "4. Forfaits d’abonnement et facturation" : "4. Subscription plans and billing"}</h2>
              <div className="space-y-3">
                {fr ? (
                  <>
                    <p>Les fonctionnalités et les prix des forfaits sont affichés avant le paiement. Sauf indication contraire, les forfaits payants se renouvellent automatiquement à chaque période de facturation jusqu’à leur annulation. Les prix sont dans la devise affichée et excluent les taxes de vente applicables. Les frais de traitement Stripe ou les frais de transaction sont distincts lorsqu’ils sont divulgués.</p>
                    <p>Vous autorisez les frais récurrents sur le mode de paiement enregistré. Vous pouvez annuler dans <strong>Paramètres → Facturation</strong>; l’annulation prend normalement effet à la fin de la période payée. Les frais déjà facturés ne sont pas remboursables, sauf si la loi l’exige ou si Pulse confirme une erreur de facturation. Communiquez rapidement avec <strong>support@pulseappointments.com</strong> en cas d’erreur de facturation.</p>
                    <p>Nous pouvons modifier les prix futurs ou les fonctionnalités des forfaits avec un préavis raisonnable. Un changement de prix s’applique au plus tôt au renouvellement suivant la date d’entrée en vigueur indiquée. L’utilisation continue après cette date constitue une acceptation; vous pouvez annuler avant le renouvellement.</p>
                  </>
                ) : (
                  <>
                    <p>Plan features and prices are shown before checkout. Unless stated otherwise, paid plans renew automatically each billing period until cancelled. Prices are in the displayed currency and exclude applicable sales taxes. Stripe processing fees or transaction fees are separate where disclosed.</p>
                    <p>You authorize recurring charges to the payment method on file. You may cancel through <strong>Settings → Billing</strong>; cancellation normally takes effect at the end of the paid period. Fees already billed are non-refundable except where required by law or where Pulse confirms a billing error. Contact <strong>support@pulseappointments.com</strong> promptly about billing errors.</p>
                    <p>We may change future prices or plan features with reasonable advance notice. A price change applies no earlier than the next renewal after the stated effective date. Continued use after that date constitutes acceptance; you may cancel before renewal.</p>
                  </>
                )}
              </div>
            </section>

            <section>
              <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-950"><ShieldCheck className="h-5 w-5 text-amber-600" />{fr ? "5. Confidentialité, communications et contenu" : "5. Privacy, communications, and content"}</h2>
              <div className="space-y-3">
                {fr ? (
                  <>
                    <p>Notre traitement des renseignements personnels est décrit dans la politique de confidentialité. Les entreprises demeurent responsables des avis à leurs clients, de leur autorité légale, du consentement, de la conservation et des réponses aux demandes des clients. Ne téléversez pas de renseignements qui ne sont pas nécessaires à la planification ou que vous n’êtes pas autorisé à traiter.</p>
                    <p>Des messages transactionnels peuvent être envoyés pour gérer les rendez-vous et les comptes. Les entreprises qui utilisent des outils de marketing doivent se conformer à la législation canadienne anti-pourriel, notamment aux exigences relatives au consentement, à l’identification de l’expéditeur, aux registres et au désabonnement.</p>
                    <p>Vous conservez la propriété du contenu que vous soumettez. Vous accordez à Pulse une licence non exclusive pour héberger, copier, traiter, transmettre et afficher ce contenu uniquement dans la mesure raisonnablement nécessaire pour exploiter, sécuriser, soutenir et améliorer le service. Vous déclarez détenir les droits requis pour le fournir.</p>
                  </>
                ) : (
                  <>
                    <p>Our handling of personal information is described in the Privacy Policy. Businesses remain responsible for their client notices, lawful authority, consent, retention, and responses to client requests. Do not upload information that is unnecessary for scheduling or that you are not authorized to process.</p>
                    <p>Transactional messages may be sent to operate appointments and accounts. Businesses using marketing tools must comply with Canada&apos;s anti-spam legislation, including consent, sender identification, records, and unsubscribe requirements.</p>
                    <p>You retain ownership of content you submit. You grant Pulse a non-exclusive licence to host, copy, process, transmit, and display that content only as reasonably needed to operate, secure, support, and improve the service. You represent that you have the rights required to provide it.</p>
                  </>
                )}
              </div>
            </section>

            <section>
              <h2 className="mb-4 text-lg font-bold text-slate-950">{fr ? "6. Propriété intellectuelle et rétroaction" : "6. Intellectual property and feedback"}</h2>
              {fr ? (
                <p>Pulse, ses logiciels, sa conception, son image de marque, sa documentation et sa technologie sous-jacente appartiennent à l’exploitant ou à ses concédants et sont protégés par les lois applicables sur la propriété intellectuelle. Les présentes Conditions n’accordent qu’un droit limité, révocable et non transférable d’utiliser le service. La rétroaction peut être utilisée sans restriction ni compensation, à condition que nous ne vous identifiions pas publiquement sans permission.</p>
              ) : (
                <p>Pulse, its software, design, branding, documentation, and underlying technology are owned by the operator or licensors and are protected by applicable intellectual-property laws. These Terms grant only a limited, revocable, non-transferable right to use the service. Feedback may be used without restriction or compensation, provided we do not identify you publicly without permission.</p>
              )}
            </section>

            <section>
              <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-950"><AlertTriangle className="h-5 w-5 text-amber-600" />{fr ? "7. Disponibilité, exclusions et responsabilité" : "7. Availability, disclaimers, and liability"}</h2>
              <div className="space-y-3">
                {fr ? (
                  <>
                    <p>Pulse est fourni « tel quel » et « selon la disponibilité ». Dans la mesure permise par la loi, nous déclinons les garanties implicites de qualité marchande, d’adéquation à un usage particulier, d’absence de contrefaçon et de fonctionnement ininterrompu ou sans erreur. Les services tiers, les réseaux et les processeurs de paiement peuvent être indisponibles ou changer indépendamment de Pulse.</p>
                    <p>Dans la mesure maximale permise par la loi, Pulse n’est pas responsable des dommages indirects, accessoires, spéciaux, consécutifs, exemplaires ou punitifs; de la perte de profits, de revenus, d’achalandage, de données, de rendez-vous ou d’interruption des activités; ni de la conduite d’une entreprise, d’un client, d’un membre du personnel ou d’un tiers.</p>
                    <p>La responsabilité globale totale de Pulse découlant du service n’excédera pas le plus élevé de 100 $ CA ou des frais d’abonnement que vous avez payés à Pulse au cours des trois mois précédant l’événement à l’origine de la réclamation. Ces exclusions ne s’appliquent pas lorsque la loi l’interdit, y compris la responsabilité qui ne peut être limitée légalement.</p>
                  </>
                ) : (
                  <>
                    <p>Pulse is provided on an &quot;as is&quot; and &quot;as available&quot; basis. To the extent permitted by law, we disclaim implied warranties of merchantability, fitness for a particular purpose, non-infringement, and uninterrupted or error-free operation. Third-party services, networks, and payment processors may be unavailable or change independently of Pulse.</p>
                    <p>To the maximum extent permitted by law, Pulse is not liable for indirect, incidental, special, consequential, exemplary, or punitive damages; lost profits, revenue, goodwill, data, appointments, or business interruption; or conduct of a business, client, staff member, or third party.</p>
                    <p>Pulse&apos;s total aggregate liability arising from the service will not exceed the greater of CAD $100 or the subscription fees you paid Pulse in the three months before the event giving rise to the claim. These exclusions do not apply where prohibited by law, including liability that cannot legally be limited.</p>
                  </>
                )}
              </div>
            </section>

            <section>
              <h2 className="mb-4 text-lg font-bold text-slate-950">{fr ? "8. Indemnisation" : "8. Indemnity"}</h2>
              {fr ? (
                <p>Dans la mesure permise par la loi, une entreprise utilisatrice défendra, indemnisera et tiendra Pulse et son exploitant à couvert des réclamations de tiers, des pertes et des coûts raisonnables découlant des services, du contenu, du personnel, de la relation client, des pratiques de confidentialité ou de messagerie, des taxes de cette entreprise, d’un manquement aux présentes Conditions ou d’une violation de la loi. Pulse fournira un avis et une collaboration raisonnables, et l’entreprise ne peut régler une réclamation d’une manière qui admet la responsabilité de Pulse sans son consentement.</p>
              ) : (
                <p>To the extent permitted by law, a business user will defend, indemnify, and hold Pulse and its operator harmless from third-party claims, losses, and reasonable costs arising from that business&apos;s services, content, staff, client relationship, privacy or messaging practices, taxes, breach of these Terms, or violation of law. Pulse will provide reasonable notice and cooperation, and the business may not settle a claim in a way that admits liability for Pulse without consent.</p>
              )}
            </section>

            <section>
              <h2 className="mb-4 text-lg font-bold text-slate-950">{fr ? "9. Suspension, résiliation et données" : "9. Suspension, termination, and data"}</h2>
              <div className="space-y-3">
                {fr ? (
                  <>
                    <p>Vous pouvez cesser d’utiliser Pulse ou annuler un abonnement à tout moment. Nous pouvons suspendre ou résilier l’accès en cas de non-paiement, de risque pour la sécurité, de fraude, de conduite illégale, de manquement important, d’exigences du processeur ou de risque pour les utilisateurs ou la plateforme. Lorsque cela est raisonnable, nous fournirons un avis et une occasion de corriger le problème.</p>
                    <p>Après la résiliation, l’accès peut prendre fin immédiatement. Les données sont conservées et supprimées conformément à la politique de confidentialité, aux cycles de sauvegarde et aux obligations légales. Demandez une exportation avant de fermer un compte; la disponibilité de l’exportation dépend des outils alors offerts et de l’état du compte.</p>
                  </>
                ) : (
                  <>
                    <p>You may stop using Pulse or cancel a subscription at any time. We may suspend or terminate access for non-payment, security risk, fraud, unlawful conduct, material breach, processor requirements, or risk to users or the platform. Where reasonable, we will provide notice and an opportunity to correct the issue.</p>
                    <p>After termination, access may end immediately. Data is retained and deleted according to the Privacy Policy, backup cycles, and legal obligations. Request an export before closing an account; export availability depends on the tools then offered and account standing.</p>
                  </>
                )}
              </div>
            </section>

            <section>
              <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-950"><Scale className="h-5 w-5 text-amber-600" />{fr ? "10. Droit applicable et différends" : "10. Governing law and disputes"}</h2>
              <div className="space-y-3">
                {fr ? (
                  <>
                    <p>Les présentes Conditions sont régies par le droit de l’Alberta et les lois fédérales du Canada qui y sont applicables, sans égard aux règles de conflit de lois. Sous réserve de tout droit obligatoire du consommateur, les tribunaux situés à Calgary, en Alberta, ont compétence exclusive.</p>
                    <p>Avant d’entamer une réclamation, communiquez avec <strong>support@pulseappointments.com</strong> et accordez-nous 30 jours pour tenter une résolution informelle. Rien dans les présentes Conditions n’empêche l’une ou l’autre des parties de demander une injonction urgente ou d’utiliser une procédure de petites créances lorsqu’elle y est admissible.</p>
                  </>
                ) : (
                  <>
                    <p>These Terms are governed by Alberta law and the federal laws of Canada applicable there, without regard to conflict-of-law rules. Subject to any mandatory consumer right, the courts located in Calgary, Alberta have exclusive jurisdiction.</p>
                    <p>Before starting a claim, contact <strong>support@pulseappointments.com</strong> and give us 30 days to attempt an informal resolution. Nothing in these Terms prevents either party from seeking urgent injunctive relief or using a small-claims process where eligible.</p>
                  </>
                )}
              </div>
            </section>

            <section>
              <h2 className="mb-4 text-lg font-bold text-slate-950">{fr ? "11. Dispositions générales et modifications" : "11. General terms and changes"}</h2>
              {fr ? (
                <p>Les présentes Conditions et les politiques qui y sont incorporées constituent l’entente intégrale concernant Pulse. Si une disposition est inapplicable, elle sera limitée ou retirée sans affecter le reste. Le défaut de faire respecter une condition n’en constitue pas une renonciation. Vous ne pouvez pas céder la présente entente sans consentement; Pulse peut la céder dans le cadre d’une réorganisation, d’un financement ou d’un transfert du service. Nous pouvons mettre à jour les présentes Conditions avec un préavis raisonnable des changements importants. L’utilisation continue après la date d’entrée en vigueur signifie l’acceptation.</p>
              ) : (
                <p>These Terms and incorporated policies are the entire agreement about Pulse. If a provision is unenforceable, it will be limited or removed without affecting the rest. Failure to enforce a term is not a waiver. You may not assign this agreement without consent; Pulse may assign it as part of a reorganization, financing, or transfer of the service. We may update these Terms with reasonable notice of material changes. Continued use after the effective date means acceptance.</p>
              )}
            </section>

            <section>
              <h2 className="mb-4 text-lg font-bold text-slate-950">{fr ? "12. Coordonnées" : "12. Contact"}</h2>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="font-bold text-slate-900">Idowu Ayeni, {fr ? "exploitant Pulse Appointments" : "operating Pulse Appointments"}</p>
                <p>3 St. SE, Calgary, Alberta T2G 0T9, Canada</p>
                <p>{fr ? "Courriel" : "Email"}: <a className="font-semibold text-amber-700 hover:underline" href="mailto:support@pulseappointments.com">support@pulseappointments.com</a></p>
              </div>
            </section>

            <footer className="flex flex-col gap-4 border-t border-slate-100 pt-7 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-slate-400">© 2026 Pulse Appointments</p>
              <div className="flex gap-5 font-semibold text-amber-700"><Link href={privacyHref} className="hover:underline">{fr ? "Politique de confidentialité" : "Privacy Policy"}</Link><Link href={home} className="hover:underline">{fr ? "Accueil" : "Home"}</Link></div>
            </footer>
          </div>
        </article>
      </div>
    </main>
  );
}

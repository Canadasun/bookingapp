import Link from "next/link";
import { ShieldCheck, Bell, Database, FileText, Globe, Users } from "lucide-react";

// Bilingual "Canadian Privacy" explainer (PIPEDA / Alberta PIPA / CASL).
export function CanadianPrivacyContent({ locale }: { locale: "en" | "fr" }) {
  const fr = locale === "fr";
  const home = fr ? "/fr" : "/";
  const securityHref = fr ? "/fr/security" : "/security";
  const privacyHref = fr ? "/fr/privacy" : "/privacy";
  const termsHref = fr ? "/fr/terms" : "/terms";
  const quebecHref = fr ? "/fr/quebec-compliance" : "/quebec-compliance";

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link href={home} className="inline-flex items-center gap-2 mb-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-icon.png" alt="Pulse" className="w-8 h-8 object-contain" />
          <span className="text-2xl font-bold text-slate-900 tracking-tight">Pulse Appointments</span>
        </Link>

        <div className="mb-10">
          <div className="inline-flex items-center gap-2 bg-red-50 border border-red-200 rounded-full px-3 py-1 text-xs font-medium text-red-700 mb-4">
            <span>🇨🇦</span> {fr ? "Le Canada d’abord" : "Canada-first"}
          </div>
          <h1 className="text-4xl font-bold text-slate-900 mb-3">{fr ? "Vie privée au Canada" : "Canadian Privacy"}</h1>
          <p className="text-lg text-slate-600 leading-relaxed">
            {fr
              ? "Pulse est conçu pour les entreprises de services canadiennes. Cette page explique comment nous traitons les données en vertu des lois fédérales et provinciales canadiennes sur la vie privée, nos obligations en matière de LCAP et ce que vous devez savoir si votre pratique traite des renseignements sur la santé."
              : "Pulse is built for Canadian service businesses. This page explains how we handle data under Canada's federal and provincial privacy laws, our CASL obligations, and what you should know if your practice handles health information."}
          </p>
          <Link href={quebecHref} className="mt-4 inline-flex text-sm font-semibold text-violet-700 hover:underline">
            {fr ? "Consulter le guide de préparation pour le Québec →" : "View the Quebec readiness guide →"}
          </Link>
        </div>

        <div className="space-y-6">

          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900 mb-2">{fr ? "LPRPDE (loi fédérale sur la vie privée dans le secteur privé)" : "PIPEDA (Federal — Private Sector Privacy Act)"}</h2>
                {fr ? (
                  <>
                    <p className="text-sm text-slate-600 leading-relaxed mb-3">
                      La <em>Loi sur la protection des renseignements personnels et les documents électroniques</em> (LPRPDE) s’applique aux organisations sous réglementation fédérale et aux organisations provinciales qui recueillent, utilisent ou divulguent des renseignements personnels dans le cadre d’une activité commerciale.
                    </p>
                    <p className="text-sm text-slate-600 leading-relaxed mb-3">
                      Pulse est conçu autour des 10 principes d’équité en matière de renseignements de l’annexe 1 de la LPRPDE :
                    </p>
                    <ol className="list-decimal list-inside space-y-1 text-sm text-slate-600 mb-3">
                      <li><strong>Responsabilité</strong> — Pulse désigne un responsable de la protection de la vie privée chargé de la conformité.</li>
                      <li><strong>Détermination des fins</strong> — Nous recueillons des données uniquement à des fins déterminées et précises.</li>
                      <li><strong>Consentement</strong> — Nous obtenons et consignons un consentement exprès ou implicite avant de recueillir des renseignements personnels.</li>
                      <li><strong>Limitation de la collecte</strong> — Nous ne recueillons que ce qui est nécessaire à la fin visée.</li>
                      <li><strong>Limitation de l’utilisation, de la communication et de la conservation</strong> — Les données ne sont pas vendues. Les périodes de conservation sont documentées.</li>
                      <li><strong>Exactitude</strong> — Les entreprises et les clients peuvent corriger leurs renseignements en tout temps.</li>
                      <li><strong>Mesures de sécurité</strong> — Chiffrement, contrôles d’accès, journaux d’audit et surveillance des atteintes. Consultez notre <Link href={securityHref} className="text-violet-600 hover:underline">page Sécurité</Link>.</li>
                      <li><strong>Transparence</strong> — Nos politiques sont accessibles au public.</li>
                      <li><strong>Accès individuel</strong> — Les utilisateurs peuvent consulter, corriger ou demander la suppression de leurs données.</li>
                      <li><strong>Possibilité de porter plainte</strong> — Communiquez avec nous à <Link href="mailto:privacy@pulseappointments.com" className="text-violet-600 hover:underline">privacy@pulseappointments.com</Link> pour toute préoccupation.</li>
                    </ol>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-slate-600 leading-relaxed mb-3">
                      The <em>Personal Information Protection and Electronic Documents Act</em> (PIPEDA) applies to
                      federally regulated organizations and to provincial organizations that collect, use, or disclose
                      personal information in the course of commercial activity.
                    </p>
                    <p className="text-sm text-slate-600 leading-relaxed mb-3">
                      Pulse is designed around the 10 fair information principles in PIPEDA Schedule 1:
                    </p>
                    <ol className="list-decimal list-inside space-y-1 text-sm text-slate-600 mb-3">
                      <li><strong>Accountability</strong> — Pulse designates a Privacy Officer responsible for compliance.</li>
                      <li><strong>Identifying Purposes</strong> — We collect data only for stated, specific purposes.</li>
                      <li><strong>Consent</strong> — We obtain and record express or implied consent before collecting personal information.</li>
                      <li><strong>Limiting Collection</strong> — We collect only what is necessary for the purpose.</li>
                      <li><strong>Limiting Use, Disclosure, and Retention</strong> — Data is not sold. Retention periods are documented.</li>
                      <li><strong>Accuracy</strong> — Businesses and clients can correct their information at any time.</li>
                      <li><strong>Safeguards</strong> — Encryption, access controls, audit logs, and breach monitoring. See our <Link href={securityHref} className="text-violet-600 hover:underline">Security page</Link>.</li>
                      <li><strong>Openness</strong> — Our policies are publicly available.</li>
                      <li><strong>Individual Access</strong> — Users can access, correct, or request deletion of their data.</li>
                      <li><strong>Challenging Compliance</strong> — Contact us at <Link href="mailto:privacy@pulseappointments.com" className="text-violet-600 hover:underline">privacy@pulseappointments.com</Link> with any concerns.</li>
                    </ol>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                <FileText className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900 mb-2">{fr ? "PIPA de l’Alberta" : "Alberta PIPA"}</h2>
                {fr ? (
                  <p className="text-sm text-slate-600 leading-relaxed mb-3">
                    La <em>Personal Information Protection Act</em> (PIPA) s’applique aux organisations du secteur privé exerçant leurs activités en Alberta. La PIPA de l’Alberta est essentiellement semblable à la LPRPDE. Pulse se conforme aux obligations de la PIPA pour les entreprises établies en Alberta qui utilisent notre plateforme, y compris l’obligation d’aviser le Commissariat à l’information et à la protection de la vie privée de l’Alberta des atteintes entraînant un préjudice important.
                  </p>
                ) : (
                  <p className="text-sm text-slate-600 leading-relaxed mb-3">
                    The <em>Personal Information Protection Act</em> (PIPA) applies to private-sector organizations operating in Alberta.
                    Alberta&apos;s PIPA is substantially similar to PIPEDA. Pulse complies with PIPA obligations for Alberta-based businesses
                    using our platform, including the requirement to notify the Office of the Information and Privacy Commissioner of Alberta
                    of breaches involving significant harm.
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                <Bell className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900 mb-2">{fr ? "LCAP (loi canadienne anti-pourriel)" : "CASL (Canada's Anti-Spam Legislation)"}</h2>
                {fr ? (
                  <>
                    <p className="text-sm text-slate-600 leading-relaxed mb-3">
                      La LCAP exige un consentement exprès ou implicite avant l’envoi de messages électroniques commerciaux (MEC). Pulse soutient la conformité à la LCAP des façons suivantes :
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-sm text-slate-600 mb-3">
                      <li>Les courriels et SMS de marketing exigent le consentement du client. Pulse consigne si un client a accepté de recevoir des messages de marketing.</li>
                      <li>Chaque message de marketing comprend un lien de désabonnement en un clic. Les demandes de désabonnement sont traitées immédiatement.</li>
                      <li>Les messages transactionnels (confirmations de réservation, rappels, reçus) sont exemptés de la LCAP, car ils se rapportent directement à une relation commerciale existante.</li>
                      <li>Les registres de consentement comprennent la date, la méthode et l’adresse IP du consentement — disponibles dans votre tableau de bord à des fins de vérification.</li>
                      <li>Le consentement implicite s’applique aux clients existants pendant 2 ans après leur dernière transaction (LCAP, alinéa 10(9)a)).</li>
                    </ul>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      Les entreprises sont responsables de veiller à ce que leurs propres campagnes de marketing envoyées par l’entremise de Pulse soient conformes à la LCAP.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-slate-600 leading-relaxed mb-3">
                      CASL requires express or implied consent before sending commercial electronic messages (CEM).
                      Pulse supports CASL compliance in the following ways:
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-sm text-slate-600 mb-3">
                      <li>Marketing emails and SMS require client consent. Pulse records whether a client has opted in to marketing messages.</li>
                      <li>Every marketing message includes a one-click unsubscribe link. Unsubscribe requests are processed immediately.</li>
                      <li>Transactional messages (booking confirmations, reminders, receipts) are CASL-exempt as they directly relate to an existing commercial relationship.</li>
                      <li>Consent records include the date, method, and IP address of consent — available in your dashboard for audit purposes.</li>
                      <li>Implied consent applies for existing clients for 2 years after their last transaction (CASL Section 10(9)(a)).</li>
                    </ul>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      Businesses are responsible for ensuring their own marketing campaigns sent through Pulse comply with CASL.
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                <Globe className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900 mb-2">{fr ? "Résidence des données et transferts transfrontaliers" : "Data residency and cross-border transfers"}</h2>
                {fr ? (
                  <>
                    <p className="text-sm text-slate-600 leading-relaxed mb-3">
                      Les serveurs de Pulse sont hébergés sur l’infrastructure de Railway, qui peut être située aux États-Unis. Les transferts de données transfrontaliers sont permis en vertu du principe 7 de l’annexe 1 de la LPRPDE lorsque des protections équivalentes sont en place. Railway est un fournisseur certifié SOC 2 Type II.
                    </p>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      Si votre entreprise exige la résidence des données au Canada (p. ex. pour des professions de la santé réglementées), veuillez communiquer avec nous à
                      {" "}<Link href="mailto:privacy@pulseappointments.com" className="text-violet-600 hover:underline">privacy@pulseappointments.com</Link>{" "}
                      pour discuter de vos exigences.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-slate-600 leading-relaxed mb-3">
                      Pulse&apos;s servers are hosted on Railway&apos;s infrastructure, which may be located in the United States.
                      Cross-border data transfers are permitted under PIPEDA Schedule 1 Principle 7 when equivalent protections are in place.
                      Railway is a SOC 2 Type II certified provider.
                    </p>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      If your business requires Canadian data residency (e.g., for regulated health professions), please contact us at
                      {" "}<Link href="mailto:privacy@pulseappointments.com" className="text-violet-600 hover:underline">privacy@pulseappointments.com</Link>{" "}
                      to discuss your requirements.
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900 mb-2">{fr ? "Renseignements sur la santé (massothérapeutes, esthéticiennes et professionnels du secteur de la santé)" : "Health information (massage therapists, estheticians, and health-adjacent professionals)"}</h2>
                {fr ? (
                  <>
                    <p className="text-sm text-slate-600 leading-relaxed mb-3">
                      La LPRPDE s’applique aux renseignements sur la santé recueillis par des organisations du secteur privé dans les provinces sans loi essentiellement semblable. Si votre entreprise recueille des renseignements sur la santé (p. ex. affections cutanées, antécédents médicaux, allergies) au moyen de formulaires d’admission ou de notes sur les clients, vous avez des obligations supplémentaires :
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-sm text-slate-600 mb-3">
                      <li>Obtenir un consentement éclairé avant de recueillir des renseignements sur la santé.</li>
                      <li>Utiliser les renseignements sur la santé uniquement aux fins déclarées (p. ex. la prestation du service).</li>
                      <li>Ne pas utiliser les renseignements sur la santé des clients à des fins de marketing sans un consentement exprès distinct.</li>
                      <li>Les renseignements sur la santé ne doivent être conservés que le temps nécessaire et supprimés de façon sécuritaire lorsqu’ils ne sont plus requis.</li>
                    </ul>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      <strong>Remarque pour les professionnels de la santé réglementés :</strong> Si votre pratique est réglementée par une loi provinciale sur la santé (p. ex. les massothérapeutes réglementés en Ontario en vertu de la LPSR), une loi sectorielle peut s’appliquer en plus de la LPRPDE. Pulse ne constitue pas un système de dossiers de santé électroniques (DSE) et n’est pas destiné à être utilisé dans des contextes cliniques hautement réglementés.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-slate-600 leading-relaxed mb-3">
                      PIPEDA applies to health information collected by private-sector organizations in provinces without substantially similar
                      legislation. If your business collects health information (e.g., skin conditions, medical history, allergy information) via
                      intake forms or client notes, you have additional obligations:
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-sm text-slate-600 mb-3">
                      <li>Obtain informed consent before collecting health information.</li>
                      <li>Use health information only for the stated purpose (e.g., service delivery).</li>
                      <li>Do not use client health information for marketing without separate, express consent.</li>
                      <li>Health information must be retained only as long as necessary and securely deleted when no longer needed.</li>
                    </ul>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      <strong>Note for regulated health professionals:</strong> If your practice is regulated under provincial health legislation
                      (e.g., regulated massage therapists in Ontario under RHPA), sector-specific legislation may apply in addition to PIPEDA.
                      Pulse does not constitute an Electronic Health Records (EHR) system and is not intended for use in highly regulated clinical settings.
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                <Database className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900 mb-2">{fr ? "Vos droits en tant que personne au Canada" : "Your rights as a Canadian individual"}</h2>
                {fr ? (
                  <>
                    <p className="text-sm text-slate-600 leading-relaxed mb-3">
                      En vertu de la LPRPDE, les personnes ont le droit de :
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-sm text-slate-600 mb-3">
                      <li>Savoir qu’une organisation détient des renseignements à leur sujet et comment ils sont utilisés.</li>
                      <li>Accéder à leurs renseignements personnels (dans les 30 jours suivant une demande écrite).</li>
                      <li>Corriger des renseignements inexacts.</li>
                      <li>Retirer leur consentement à l’utilisation de leurs renseignements (sous réserve d’obligations légales et commerciales).</li>
                      <li>Porter plainte auprès du Commissariat à la protection de la vie privée du Canada (CPVP) s’ils estiment que leurs droits ont été violés.</li>
                    </ul>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      Pour exercer l’un de ces droits, écrivez à{" "}
                      <Link href="mailto:privacy@pulseappointments.com" className="text-violet-600 hover:underline">privacy@pulseappointments.com</Link>.
                      Les comptes clients peuvent aussi soumettre une demande de suppression de données depuis le portail client, sous Paramètres.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-slate-600 leading-relaxed mb-3">
                      Under PIPEDA, individuals have the right to:
                    </p>
                    <ul className="list-disc list-inside space-y-1 text-sm text-slate-600 mb-3">
                      <li>Know that an organization holds information about them and how it is used.</li>
                      <li>Access their personal information (within 30 days of a written request).</li>
                      <li>Correct inaccurate information.</li>
                      <li>Withdraw consent for use of their information (subject to legal and business obligations).</li>
                      <li>Complain to the Office of the Privacy Commissioner of Canada (OPC) if they believe their rights have been violated.</li>
                    </ul>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      To exercise any of these rights, email{" "}
                      <Link href="mailto:privacy@pulseappointments.com" className="text-violet-600 hover:underline">privacy@pulseappointments.com</Link>.
                      Client accounts can also submit a data deletion request from the client portal under Settings.
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>

        </div>

        <div className="mt-10 rounded-2xl border border-violet-200 bg-violet-50 p-6">
          <h2 className="text-base font-semibold text-violet-900 mb-2">{fr ? "Des questions sur la conformité à la vie privée au Canada?" : "Questions about Canadian privacy compliance?"}</h2>
          <p className="text-sm text-violet-800 mb-3">
            {fr
              ? "Nous nous ferons un plaisir de discuter de nos pratiques de protection de la vie privée avec les propriétaires d’entreprise, les responsables de la vie privée ou les conseillers juridiques."
              : "We are happy to speak with business owners, privacy officers, or legal counsel about our privacy practices."}
          </p>
          <Link href="mailto:privacy@pulseappointments.com" className="text-sm font-semibold text-violet-700 hover:text-violet-800 underline">
            privacy@pulseappointments.com
          </Link>
        </div>

        <p className="text-xs text-slate-400 mt-8 text-center">
          {fr ? "Dernière révision : juin 2026" : "Last reviewed: June 2026"} ·{" "}
          <Link href={privacyHref} className="hover:underline">{fr ? "Politique de confidentialité" : "Privacy Policy"}</Link>{" "}·{" "}
          <Link href={securityHref} className="hover:underline">{fr ? "Sécurité" : "Security"}</Link>{" "}·{" "}
          <Link href={termsHref} className="hover:underline">{fr ? "Conditions d’utilisation" : "Terms of Service"}</Link>
        </p>
      </div>
    </div>
  );
}

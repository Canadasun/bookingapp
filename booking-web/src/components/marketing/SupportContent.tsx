import Link from "next/link";
import { MessageCircle, Building2, Mail, ExternalLink, Clock, HelpCircle, PenLine } from "lucide-react";
import { SupportForm } from "@/app/(en)/support/SupportForm";

// Bilingual support page body. EN at /support, FR at /fr/support.
export function SupportContent({ locale }: { locale: "en" | "fr" }) {
  const fr = locale === "fr";
  const home = fr ? "/fr" : "/";
  const privacyHref = fr ? "/fr/privacy" : "/privacy";
  const termsHref = fr ? "/fr/terms" : "/terms";

  const faqs = fr
    ? [
        { q: "Comment annuler ou reporter un rendez-vous?", a: <>Connectez-vous au <Link href="/my/login" className="text-violet-600 hover:underline">portail client</Link>, sélectionnez le rendez-vous parmi vos réservations à venir ou passées, puis choisissez Annuler ou Reporter. Les annulations sont assujetties à la politique d’annulation propre à chaque entreprise.</> },
        { q: "On m’a facturé, mais mon rendez-vous a été annulé — comment obtenir un remboursement?", a: <>Les remboursements sont émis par l’entreprise qui a pris votre réservation. Communiquez d’abord directement avec elle. Si vous croyez qu’un montant a été facturé par erreur et que l’entreprise ne répond pas, écrivez à support@pulseappointments.com avec votre numéro de rendez-vous.</> },
        { q: "Comment supprimer mon compte ou mes données?", a: <>Écrivez à <strong>support@pulseappointments.com</strong> avec l’objet « Demande de suppression de données ». Nous la traiterons dans un délai de 30 jours, conformément à notre <Link href={privacyHref} className="text-violet-600 hover:underline">politique de confidentialité</Link>.</> },
      ]
    : [
        { q: "How do I cancel or reschedule an appointment?", a: <>Log in at <Link href="/my/login" className="text-violet-600 hover:underline">the client portal</Link>, select the appointment from your upcoming or past bookings, and choose Cancel or Reschedule. Cancellations are subject to the individual business&apos;s cancellation policy.</> },
        { q: "I was charged but my appointment was cancelled — how do I get a refund?", a: <>Refunds are issued by the business that took your booking. Contact the business directly first. If you believe a charge was made in error and the business is unresponsive, email support@pulseappointments.com with your appointment ID.</> },
        { q: "How do I delete my account or data?", a: <>Email <strong>support@pulseappointments.com</strong> with the subject line &quot;Data Deletion Request.&quot; We will process it within 30 days per our <Link href={privacyHref} className="text-violet-600 hover:underline">Privacy Policy</Link>.</> },
      ];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Link href={home} className="inline-flex items-center gap-2 mb-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-icon.png" alt="Pulse" className="w-8 h-8 object-contain" />
          <span className="text-2xl font-bold text-slate-900 tracking-tight">Pulse Booking</span>
        </Link>

        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="bg-violet-600 px-8 py-10 text-white">
            <h1 className="text-3xl font-bold mb-2">{fr ? "Centre d’aide" : "Support Centre"}</h1>
            <p className="text-violet-100 text-sm">{fr ? "Nous répondons généralement dans un délai d’un jour ouvrable." : "We typically respond within one business day."}</p>
          </div>

          <div className="p-8 md:p-12 space-y-10">
            {/* Client booking inquiries */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                  <MessageCircle className="w-5 h-5 text-violet-600" />
                </div>
                <h2 className="text-lg font-bold text-slate-900">{fr ? "Aide à la réservation pour les clients" : "Client Booking Help"}</h2>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed mb-6">
                {fr
                  ? "Besoin d’aide avec un rendez-vous existant, une annulation, un remboursement ou l’accès à votre historique de réservations? Écrivez-nous et nous vous aiderons directement."
                  : "Need help with an existing appointment, a cancellation, a refund, or accessing your booking history? Reach out and we'll assist you directly."}
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 border border-slate-100 p-5 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <Mail className="w-4 h-4 text-violet-500" /> {fr ? "Soutien par courriel" : "Email Support"}
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    {fr ? "Écrivez-nous à tout moment et nous répondrons dans un délai d’un jour ouvrable." : "Send us a message at any time and we'll reply within one business day."}
                  </p>
                  <a
                    href="mailto:support@pulseappointments.com"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-600 hover:underline mt-1"
                  >
                    support@pulseappointments.com <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                <div className="rounded-2xl bg-slate-50 border border-slate-100 p-5 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <Clock className="w-4 h-4 text-violet-500" /> {fr ? "Délais de réponse" : "Response Times"}
                  </div>
                  <ul className="text-xs text-slate-500 space-y-1 leading-relaxed">
                    {(fr
                      ? ["Lun.–ven. : nous visons une réponse dans un délai d’un jour ouvrable", "Fins de semaine : jour ouvrable suivant", "Questions de facturation : réponse prioritaire"]
                      : ["Mon–Fri: we aim to respond within 1 business day", "Weekends: next business day", "Billing questions: prioritized response"]
                    ).map((li) => <li key={li}>{li}</li>)}
                  </ul>
                </div>
              </div>
            </section>

            {/* Merchant / Business Owner escalation */}
            <section>
              <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                    <Building2 className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-amber-700 uppercase tracking-widest">{fr ? "Soutien aux marchands et propriétaires" : "Merchant & Business Owner Support"}</p>
                    <h2 className="text-lg font-bold text-slate-900 leading-tight">{fr ? "Escalade compte et facturation" : "Account & Billing Escalation"}</h2>
                  </div>
                </div>
                <p className="text-sm text-slate-700 leading-relaxed">
                  {fr
                    ? <>Pour les problèmes critiques touchant votre entreprise — échecs de facturation d’abonnement, blocages de versement Stripe Connect, verrouillages d’accès au compte ou préoccupations relatives aux données — écrivez-nous directement avec <strong>« ESCALADE MARCHAND »</strong> dans l’objet. Ces demandes sont triées immédiatement et traitées séparément des demandes générales.</>
                    : <>For critical issues affecting your business — subscription billing failures, Stripe Connect payout holds, account access lockouts, or data concerns — email us directly with <strong>&quot;MERCHANT ESCALATION&quot;</strong> in the subject line. These tickets are triaged immediately and handled separately from general inquiries.</>}
                </p>
                <a
                  href={`mailto:support@pulseappointments.com?subject=${fr ? "ESCALADE%20MARCHAND%20—%20" : "MERCHANT%20ESCALATION%20—%20"}`}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-600 text-white text-sm font-semibold rounded-xl hover:bg-amber-700 transition-colors"
                >
                  <Mail className="w-4 h-4" /> {fr ? "Écrire au soutien marchand" : "Email Merchant Support"}
                </a>
                <p className="text-xs text-slate-500">
                  {fr
                    ? "Incluez le nom de votre entreprise et le courriel de compte avec lequel vous vous êtes inscrit. Pour les problèmes de versement, incluez votre identifiant de compte Stripe Connect si disponible."
                    : "Include your business name and the Railway/account email you registered with. For payout issues, include your Stripe Connect account ID if available."}
                </p>
              </div>
            </section>

            {/* Contact form */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                  <PenLine className="w-5 h-5 text-violet-600" />
                </div>
                <h2 className="text-lg font-bold text-slate-900">{fr ? "Écrivez-nous" : "Send us a message"}</h2>
              </div>
              <p className="text-sm text-slate-500 mb-5">
                {fr ? "Vous ne pouvez pas utiliser le courriel? Remplissez le formulaire ci-dessous et nous vous répondrons dans un délai d’un jour ouvrable." : "Can't use email? Fill out the form below and we'll get back to you within one business day."}
              </p>
              <SupportForm locale={locale} />
            </section>

            {/* FAQ */}
            <section>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                  <HelpCircle className="w-5 h-5 text-slate-500" />
                </div>
                <h2 className="text-lg font-bold text-slate-900">{fr ? "Questions fréquentes" : "Common Questions"}</h2>
              </div>
              <div className="space-y-3 text-sm text-slate-600">
                {faqs.map(({ q, a }) => (
                  <details key={q} className="rounded-xl border border-slate-100 bg-slate-50 px-5 py-3 group">
                    <summary className="font-semibold text-slate-800 cursor-pointer list-none flex justify-between items-center">
                      {q}
                      <span className="text-slate-400 group-open:rotate-180 transition-transform text-xs">▼</span>
                    </summary>
                    <p className="mt-3 leading-relaxed text-slate-600">{a}</p>
                  </details>
                ))}
              </div>
            </section>

            <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
              <p className="text-xs text-slate-400">support@pulseappointments.com</p>
              <div className="flex gap-6">
                <Link href={privacyHref} className="text-violet-600 font-semibold text-sm hover:underline">{fr ? "Politique de confidentialité" : "Privacy Policy"}</Link>
                <Link href={termsHref} className="text-violet-600 font-semibold text-sm hover:underline">{fr ? "Conditions d’utilisation" : "Terms of Service"}</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

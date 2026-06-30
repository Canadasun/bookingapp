import Link from "next/link";
import { Mail, Building2, LifeBuoy, HelpCircle, Clock, ExternalLink } from "lucide-react";

// Bilingual contact hub. EN at /contact, FR at /fr/contact.
// Distinct from /support (help desk + form): this page is a directory of the
// ways to reach Pulse, routing each audience to the right channel.
export function ContactContent({ locale }: { locale: "en" | "fr" }) {
  const fr = locale === "fr";
  const home = fr ? "/fr" : "/";
  const supportHref = fr ? "/fr/support" : "/support";
  const faqHref = fr ? "/fr/faq" : "/faq";

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
            <h1 className="text-3xl font-bold mb-2">{fr ? "Nous joindre" : "Contact Us"}</h1>
            <p className="text-violet-100 text-sm">
              {fr
                ? "Choisissez le bon canal ci-dessous — nous répondons généralement dans un délai d’un jour ouvrable."
                : "Pick the right channel below — we typically respond within one business day."}
            </p>
          </div>

          <div className="p-8 md:p-12 space-y-6">
            {/* Sales / general inquiries */}
            <section className="rounded-2xl bg-slate-50 border border-slate-100 p-6 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5 text-violet-600" />
                </div>
                <h2 className="text-lg font-bold text-slate-900">{fr ? "Ventes et questions générales" : "Sales & General Inquiries"}</h2>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                {fr
                  ? "Vous évaluez Pulse pour votre entreprise ou avez une question avant de vous inscrire? Écrivez-nous et nous vous répondrons directement."
                  : "Evaluating Pulse for your business or have a question before signing up? Send us a note and we'll reply directly."}
              </p>
              <a
                href="mailto:hello@pulseappointments.com"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-violet-600 hover:underline"
              >
                hello@pulseappointments.com <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </section>

            {/* Existing customer support */}
            <section className="rounded-2xl bg-slate-50 border border-slate-100 p-6 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
                  <LifeBuoy className="w-5 h-5 text-violet-600" />
                </div>
                <h2 className="text-lg font-bold text-slate-900">{fr ? "Soutien aux clients" : "Customer Support"}</h2>
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                {fr
                  ? <>Déjà client, ou besoin d’aide avec un rendez-vous, une annulation ou un remboursement? Notre <Link href={supportHref} className="text-violet-600 hover:underline">centre d’aide</Link> propose un formulaire de contact et des réponses aux questions courantes.</>
                  : <>Already a customer, or need help with an appointment, cancellation, or refund? Our <Link href={supportHref} className="text-violet-600 hover:underline">support centre</Link> has a contact form and answers to common questions.</>}
              </p>
              <a
                href="mailto:support@pulseappointments.com"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-violet-600 hover:underline"
              >
                support@pulseappointments.com <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </section>

            {/* Merchant escalation */}
            <section className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-6 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5 text-amber-600" />
                </div>
                <h2 className="text-lg font-bold text-slate-900">{fr ? "Escalade marchand (urgent)" : "Merchant Escalation (Urgent)"}</h2>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">
                {fr
                  ? <>Problème critique touchant votre entreprise — échec de facturation, blocage de versement Stripe Connect ou verrouillage de compte? Écrivez-nous avec <strong>« ESCALADE MARCHAND »</strong> dans l’objet pour un triage immédiat.</>
                  : <>Critical issue affecting your business — a billing failure, a Stripe Connect payout hold, or an account lockout? Email us with <strong>&quot;MERCHANT ESCALATION&quot;</strong> in the subject line for immediate triage.</>}
              </p>
              <a
                href={`mailto:support@pulseappointments.com?subject=${fr ? "ESCALADE%20MARCHAND%20—%20" : "MERCHANT%20ESCALATION%20—%20"}`}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-600 text-white text-sm font-semibold rounded-xl hover:bg-amber-700 transition-colors"
              >
                <Mail className="w-4 h-4" /> {fr ? "Écrire au soutien marchand" : "Email Merchant Support"}
              </a>
            </section>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 border border-slate-100 p-5 space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <Clock className="w-4 h-4 text-violet-500" /> {fr ? "Délais de réponse" : "Response Times"}
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {fr
                    ? "Du lundi au vendredi, nous visons une réponse dans un délai d’un jour ouvrable. Les questions de facturation sont priorisées."
                    : "Monday to Friday, we aim to respond within one business day. Billing questions are prioritized."}
                </p>
              </div>
              <div className="rounded-2xl bg-slate-50 border border-slate-100 p-5 space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                  <HelpCircle className="w-4 h-4 text-violet-500" /> {fr ? "Réponses rapides" : "Quick Answers"}
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {fr
                    ? <>Beaucoup de questions trouvent réponse sur notre page <Link href={faqHref} className="text-violet-600 hover:underline">FAQ</Link>.</>
                    : <>Many questions are answered on our <Link href={faqHref} className="text-violet-600 hover:underline">FAQ page</Link>.</>}
                </p>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
              <p className="text-xs text-slate-400">hello@pulseappointments.com</p>
              <div className="flex gap-6">
                <Link href={supportHref} className="text-violet-600 font-semibold text-sm hover:underline">{fr ? "Centre d’aide" : "Support Centre"}</Link>
                <Link href={faqHref} className="text-violet-600 font-semibold text-sm hover:underline">{fr ? "FAQ" : "FAQ"}</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BadgeDollarSign, Gift, Link2, Sparkles } from "lucide-react";

// Bilingual referral program page. EN at /referrals, FR at /fr/referrals.
export function ReferralsContent({ locale }: { locale: "en" | "fr" }) {
  const fr = locale === "fr";
  const home = fr ? "/fr" : "/";
  const pricingHref = fr ? "/fr/pricing" : "/pricing";
  const baseUrl = "https://www.pulseappointments.com";
  const pageUrl = fr ? `${baseUrl}/fr/referrals` : `${baseUrl}/referrals`;
  const homeUrl = fr ? `${baseUrl}/fr` : baseUrl;

  const steps = fr
    ? [
        { icon: Link2, title: "Copiez votre lien", body: "Les propriétaires peuvent copier leur lien de parrainage depuis Facturation et forfait dans le tableau de bord Pulse." },
        { icon: Gift, title: "Elle s’abonne", body: "L’entreprise parrainée s’inscrit avec votre code et l’applique avant de passer à un forfait payant." },
        { icon: BadgeDollarSign, title: "Le crédit est appliqué", body: "Au début de son abonnement, Pulse enregistre le parrainage et applique le crédit de compte configuré à votre prochaine facture Pulse." },
      ]
    : [
        { icon: Link2, title: "Copy your link", body: "Owners can copy their referral link from Billing & plan in the Pulse dashboard." },
        { icon: Gift, title: "They subscribe", body: "The referred business signs up with your code and applies it before upgrading." },
        { icon: BadgeDollarSign, title: "Credit is applied", body: "When their subscription starts, Pulse records the referral and applies the configured account credit to your next Pulse invoice." },
      ];

  const faqs = fr
    ? [
        { name: "Comment obtenir mon code de parrainage Pulse?", text: "Connectez-vous à Pulse, ouvrez Paramètres, puis Facturation et forfait. Votre lien de parrainage apparaît dans la section parrainage." },
        { name: "Quand la récompense de parrainage est-elle appliquée?", text: "Pulse enregistre le parrainage lorsque l’entreprise parrainée utilise un code valide au moment du paiement. Le crédit de compte du parrain est appliqué une fois que l’entreprise parrainée démarre un abonnement payant." },
        { name: "Une entreprise peut-elle utiliser son propre code de parrainage?", text: "Non. Pulse ignore les codes de parrainage qui appartiennent au même compte d’entreprise." },
      ]
    : [
        { name: "How do I get my Pulse referral code?", text: "Sign in to Pulse, open Settings, then Billing & plan. Your referral link appears in the referral section." },
        { name: "When is the referral reward applied?", text: "Pulse records the referral when the referred business uses a valid code during checkout. The referrer account credit is applied after the referred business starts a paid subscription." },
        { name: "Can a business use its own referral code?", text: "No. Pulse ignores referral codes that belong to the same business account." },
      ];

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map(({ name, text }) => ({
      "@type": "Question",
      name,
      acceptedAnswer: { "@type": "Answer", text },
    })),
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: fr ? "Accueil" : "Home", item: homeUrl },
      { "@type": "ListItem", position: 2, name: fr ? "Programme de parrainage" : "Referral Program", item: pageUrl },
    ],
  };

  return (
    <main id="main-content" className="min-h-screen bg-[#F8F5EF] text-slate-900">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([faqSchema, breadcrumbSchema]) }} />
      <section className="border-b border-[#E9DDCB] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href={home} className="flex items-center gap-2.5">
            <Image src="/logo-icon.png" alt="Pulse" width={32} height={32} className="h-8 w-8 object-contain" />
            <span className="text-base font-bold tracking-tight">Pulse Appointments</span>
          </Link>
          <Link href="/register" className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
            {fr ? "Commencer gratuitement" : "Start free"} <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <div className="max-w-3xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            {fr ? "Programme de parrainage" : "Referral program"}
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">
            {fr ? "Partagez Pulse avec une autre entreprise de services canadienne" : "Share Pulse with another Canadian service business"}
          </h1>
          <p className="mt-5 text-lg leading-8 text-slate-600">
            {fr
              ? "Pulse intègre des codes de parrainage à l’inscription, à la facturation et au paiement Stripe. Envoyez votre lien à un autre propriétaire, et les récompenses admissibles sont suivies automatiquement lorsqu’il devient un client payant."
              : "Pulse has referral codes built into signup, billing, and Stripe checkout. Send your link to another owner, and eligible rewards are tracked automatically when they become a paying customer."}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/dashboard/settings?section=billing" className="inline-flex items-center justify-center gap-2 rounded-lg bg-violet-700 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-800">
              {fr ? "Copier mon lien de parrainage" : "Copy my referral link"} <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link href={pricingHref} className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50">
              {fr ? "Voir les forfaits" : "View plans"}
            </Link>
          </div>
        </div>
      </section>

      <section className="border-y border-[#E9DDCB] bg-white">
        <div className="mx-auto grid max-w-6xl gap-4 px-6 py-12 md:grid-cols-3">
          {steps.map((step) => (
            <div key={step.title} className="rounded-lg border border-slate-200 p-5">
              <step.icon className="h-5 w-5 text-violet-700" aria-hidden="true" />
              <h2 className="mt-4 text-base font-semibold text-slate-950">{step.title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-4 md:grid-cols-3">
          {faqs.map((item) => (
            <div key={item.name} className="rounded-lg border border-[#E9DDCB] bg-white p-5">
              <h2 className="text-sm font-semibold text-slate-950">{item.name}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{item.text}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

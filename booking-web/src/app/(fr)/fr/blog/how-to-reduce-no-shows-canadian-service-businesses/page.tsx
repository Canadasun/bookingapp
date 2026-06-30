import Link from "next/link";
import { buildAlternates } from "@/lib/hreflang";
import Image from "next/image";
import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: buildAlternates("/blog/how-to-reduce-no-shows-canadian-service-businesses", "fr"),
  title: "Comment réduire les absences pour les entreprises de services canadiennes | Pulse",
  description:
    "Les absences coûtent des milliers de dollars par année aux entreprises de services canadiennes. Découvrez le système éprouvé acompte + rappels qui réduit les absences de 80 % — utilisé par les salons, spas et barbiers partout au Canada.",
  openGraph: {
    title: "Comment réduire les absences pour les entreprises de services canadiennes",
    description:
      "Le système acompte + rappels qui réduit les absences de 80 %. Guide pratique pour les salons, spas et entreprises de services canadiens.",
  },
};

const articleSchema = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "Comment réduire les absences pour les entreprises de services canadiennes",
  datePublished: "2026-06-25",
  dateModified: "2026-06-25",
  author: { "@type": "Organization", name: "Pulse Appointments" },
  publisher: { "@type": "Organization", name: "Pulse Appointments", url: "https://www.pulseappointments.com" },
  url: "https://www.pulseappointments.com/fr/blog/how-to-reduce-no-shows-canadian-service-businesses",
};

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Accueil", item: "https://www.pulseappointments.com/fr" },
    { "@type": "ListItem", position: 2, name: "Blogue", item: "https://www.pulseappointments.com/fr/blog" },
    { "@type": "ListItem", position: 3, name: "Comment réduire les absences pour les entreprises de services canadiennes", item: "https://www.pulseappointments.com/fr/blog/how-to-reduce-no-shows-canadian-service-businesses" },
  ],
};

export default function NoShowsPostFr() {
  return (
    <main id="main-content" className="min-h-screen bg-[#F8F5EF]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

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

      <div className="max-w-2xl mx-auto px-6 py-16">
        {/* Back link */}
        <Link href="/fr/blog" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-violet-600 transition-colors mb-10">
          ← Retour au blogue
        </Link>

        {/* Article header */}
        <div className="mb-10">
          <span className="inline-block text-xs font-bold uppercase tracking-widest text-violet-600 bg-violet-50 px-3 py-1 rounded-full mb-4">
            Absences
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight mb-4">
            Comment réduire les absences pour les entreprises de services canadiennes
          </h1>
          <div className="flex items-center gap-3 text-sm text-slate-400">
            <span>25 juin 2026</span>
            <span>·</span>
            <span>8 min de lecture</span>
          </div>
        </div>

        {/* Article body */}
        <article className="prose-custom">

          <h2 className="text-2xl font-bold text-slate-900 mt-10 mb-4">Le véritable coût d’une absence</h2>
          <p className="text-slate-600 leading-relaxed mb-4">Une absence n’est pas qu’une plage vide. C’est :</p>
          <ul className="list-disc list-inside text-slate-600 mb-4 space-y-1">
            <li>Le revenu de ce rendez-vous — perdu</li>
            <li>Le temps que vous aviez réservé — perdu</li>
            <li>Vos fournitures ou votre préparation — gaspillées</li>
            <li>Une plage qu’un autre client aurait pu prendre — perdue</li>
          </ul>
          <p className="text-slate-600 leading-relaxed mb-4">
            Pour un salon qui facture 120 $ pour une coloration, 3 absences par semaine = 360 $/semaine = <strong className="text-slate-800">18 720 $ par année</strong> de revenus perdus. Ce n’est pas un inconvénient mineur. C’est le coût d’un employé à temps partiel.
          </p>

          <hr className="border-[#E9DDCB] my-8" />

          <h2 className="text-2xl font-bold text-slate-900 mt-10 mb-4">Pourquoi les clients ne se présentent pas (et pourquoi ce n’est pas toujours malveillant)</h2>
          <p className="text-slate-600 leading-relaxed mb-4">La plupart des absences ne sont pas délibérées. Elles surviennent parce que :</p>
          <ul className="list-disc list-inside text-slate-600 mb-4 space-y-1">
            <li>Les clients oublient (surtout pour les réservations faites des semaines à l’avance)</li>
            <li>La vie change et ils ne prennent pas la peine d’annuler parce que cela « semble gênant »</li>
            <li>Il n’y a aucune conséquence financière à ne pas se présenter</li>
            <li>Le processus de reprise de rendez-vous est peu pratique, alors ils disparaissent tout simplement</li>
          </ul>
          <p className="text-slate-600 leading-relaxed mb-4">La solution s’attaque directement à chacune de ces causes.</p>

          <hr className="border-[#E9DDCB] my-8" />

          <h2 className="text-2xl font-bold text-slate-900 mt-10 mb-4">Le système en 3 parties qui réduit les absences de 80 %</h2>

          <h3 className="text-lg font-semibold text-slate-800 mt-6 mb-2">Partie 1 : Exigez un acompte au moment de la réservation</h3>
          <p className="text-slate-600 leading-relaxed mb-4">
            C’est la chose la plus efficace que vous puissiez faire. Lorsqu’un client verse de l’argent, il a quelque chose à perdre. Les réservations sans acompte sont faciles à abandonner. Les réservations avec acompte sont des engagements.
          </p>
          <p className="text-slate-600 leading-relaxed mb-2"><strong className="text-slate-800">Quoi facturer :</strong></p>
          <ul className="list-disc list-inside text-slate-600 mb-4 space-y-1">
            <li>Pour les rendez-vous de moins de 60 min : acompte fixe de 20 $ à 30 $</li>
            <li>Pour les rendez-vous de 60 à 90 min : 25 % du prix du service</li>
            <li>Pour les colorations ou les longs traitements : 25 % à 50 %</li>
            <li>Pour les nouveaux clients (risque d’absence plus élevé) : prix complet du service à l’avance</li>
          </ul>
          <p className="text-slate-600 leading-relaxed mb-4">
            <strong className="text-slate-800">La psychologie :</strong> Lorsqu’un client a payé 35 $ pour un rendez-vous de coloration à 140 $, il réfléchit à deux fois avant de faire la grasse matinée. L’acompte n’est pas punitif — c’est un mécanisme d’engagement.
          </p>
          <p className="text-slate-600 leading-relaxed mb-4">
            <strong className="text-slate-800">Gérer l’objection :</strong> Certains clients vont protester. Ce n’est pas grave. Les clients qui refusent de payer un acompte sont souvent ceux qui risquent le plus de ne pas se présenter. L’acompte filtre votre liste de clients vers ceux qui respectent votre temps.
          </p>

          <h3 className="text-lg font-semibold text-slate-800 mt-6 mb-2">Partie 2 : Des rappels automatisés aux bons intervalles</h3>
          <p className="text-slate-600 leading-relaxed mb-4">La plupart des absences surviennent parce que les clients oublient. La solution est simple : rappelez-le-leur.</p>
          <p className="text-slate-600 leading-relaxed mb-2"><strong className="text-slate-800">L’horaire de rappels qui fonctionne :</strong></p>
          <ul className="list-disc list-inside text-slate-600 mb-4 space-y-1">
            <li><strong className="text-slate-700">72 heures avant :</strong> rappel par courriel avec les détails du rendez-vous et votre politique d’annulation</li>
            <li><strong className="text-slate-700">24 heures avant :</strong> rappel par courriel + SMS (« Votre rendez-vous est demain à 14 h — répondez ANNULER si vous devez le reporter »)</li>
            <li><strong className="text-slate-700">2 heures avant :</strong> SMS pour les rendez-vous le jour même seulement</li>
          </ul>
          <p className="text-slate-600 leading-relaxed mb-4">
            Le rappel 24 heures à l’avance est le plus important. Il donne aux clients un préavis suffisant pour annuler (afin que vous puissiez recombler la plage) tout en créant un sentiment d’urgence. Le SMS à 24 h est celui qui est réellement lu.
          </p>
          <p className="text-slate-600 leading-relaxed mb-2"><strong className="text-slate-800">Quoi inclure dans les rappels :</strong></p>
          <ul className="list-disc list-inside text-slate-600 mb-4 space-y-1">
            <li>Date, heure et service</li>
            <li>Votre adresse ou un lien vers les détails de leur réservation</li>
            <li>Votre politique d’annulation (en langage clair)</li>
            <li>Un moyen de reporter (lien vers votre page de réservation)</li>
          </ul>

          <h3 className="text-lg font-semibold text-slate-800 mt-6 mb-2">Partie 3 : Une véritable politique d’annulation — appliquée automatiquement</h3>
          <p className="text-slate-600 leading-relaxed mb-4">
            Avoir une politique d’annulation écrite quelque part est inutile si vous ne l’appliquez pas. La plupart des prestataires de services ont une politique mais ne la facturent jamais parce que la conversation est gênante.
          </p>
          <blockquote className="border-l-4 border-violet-400 pl-4 text-slate-600 italic my-6">
            Les annulations effectuées moins de 24 heures avant votre rendez-vous seront facturées à 50 % du prix du service. Les absences seront facturées au montant total de l’acompte (ou à 100 % du prix du service si aucun acompte n’a été perçu).
          </blockquote>
          <p className="text-slate-600 leading-relaxed mb-4">
            Affichez ceci sur votre page de réservation, dans votre courriel de confirmation et dans votre rappel 24 h à l’avance. Lorsque c’est écrit clairement dès le départ, l’appliquer n’est pas une confrontation — c’est simplement suivre la politique que le client a acceptée au moment de réserver.
          </p>
          <p className="text-slate-600 leading-relaxed mb-4">
            <strong className="text-slate-800">Automatisez la facturation :</strong> Avec la carte en dossier, vous n’avez pas à envoyer une facture embarrassante ni à avoir une conversation téléphonique. La facturation se fait automatiquement. Le client reçoit un reçu. La conversation gênante n’a jamais lieu.
          </p>

          <hr className="border-[#E9DDCB] my-8" />

          <h2 className="text-2xl font-bold text-slate-900 mt-10 mb-4">Quoi faire lorsqu’un client conteste les frais</h2>
          <p className="text-slate-600 leading-relaxed mb-4">Cela arrive rarement lorsque la politique est communiquée clairement dès le départ. Lorsque cela se produit :</p>
          <ol className="list-decimal list-inside text-slate-600 mb-4 space-y-1">
            <li>Faites référence à la politique qu’il a acceptée à la réservation (votre courriel de confirmation de réservation)</li>
            <li>Offrez de créditer les frais sur un rendez-vous futur (geste de bonne volonté qui fonctionne habituellement)</li>
            <li>Si la contestation persiste, déterminez si ce client vaut la peine d’être conservé</li>
          </ol>
          <p className="text-slate-600 leading-relaxed mb-4">
            La plupart des clients, lorsqu’on leur rappelle une politique qu’ils ont acceptée, l’acceptent. Ceux qui ne l’acceptent pas sont souvent ceux dont vous êtes mieux sans.
          </p>

          <hr className="border-[#E9DDCB] my-8" />

          <h2 className="text-2xl font-bold text-slate-900 mt-10 mb-4">Gérer les annulations de dernière minute pour recombler les plages</h2>
          <p className="text-slate-600 leading-relaxed mb-4">Même avec des acomptes et des rappels, certaines annulations surviendront. L’objectif est de combler ces plages rapidement.</p>
          <p className="text-slate-600 leading-relaxed mb-2"><strong className="text-slate-800">Tactiques :</strong></p>
          <ul className="list-disc list-inside text-slate-600 mb-4 space-y-1">
            <li>Tenez une liste d’attente pour les plages horaires populaires. Lorsqu’une annulation arrive, contactez immédiatement la prochaine personne sur la liste.</li>
            <li>Publiez votre plage libre dans vos stories Instagram. « Plage libérée à 15 h aujourd’hui — écrivez-nous en privé pour réserver » comble les plages plus vite que vous ne le pensez.</li>
            <li>Fixez des frais d’annulation le jour même plus élevés que les frais standards. Les clients qui annulent avec un préavis de 2 heures sont plus difficiles à remplacer.</li>
          </ul>

          <hr className="border-[#E9DDCB] my-8" />

          <h2 className="text-2xl font-bold text-slate-900 mt-10 mb-4">Les résultats auxquels vous pouvez vous attendre</h2>
          <p className="text-slate-600 leading-relaxed mb-4">D’après les entreprises de services qui utilisent acomptes + rappels automatisés :</p>
          <div className="overflow-x-auto rounded-xl border border-[#E9DDCB] mb-6">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-[#E9DDCB] bg-slate-50">
                  <th className="text-left px-5 py-3 font-semibold text-slate-700">Avant</th>
                  <th className="text-left px-5 py-3 font-semibold text-slate-700">Après</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["4 à 5 absences par semaine", "0 à 1 absence par semaine"],
                  ["0 % de couverture par acompte", "25 à 100 % du service prépayé"],
                  ["Appels de rappel manuels", "Automatisés — aucun temps consacré"],
                  ["Conversations gênantes sur les frais", "Facturation automatique — aucune conversation"],
                ].map(([before, after]) => (
                  <tr key={before} className="border-b border-[#E9DDCB] last:border-0">
                    <td className="px-5 py-3 text-slate-600">{before}</td>
                    <td className="px-5 py-3 text-slate-600">{after}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-slate-600 leading-relaxed mb-4">
            L’entreprise de services moyenne qui met en place un système complet de politique d’acompte + rappels + annulation réduit les absences de 75 à 85 % au cours du premier mois.
          </p>

          <hr className="border-[#E9DDCB] my-8" />

          <h2 className="text-2xl font-bold text-slate-900 mt-10 mb-4">Mettre cela en place dans Pulse</h2>
          <p className="text-slate-600 leading-relaxed mb-4">Dans Pulse, vous pouvez activer les trois parties de ce système en moins de 10 minutes :</p>
          <ol className="list-decimal list-inside text-slate-600 mb-4 space-y-2">
            <li><strong className="text-slate-700">Acomptes :</strong> Allez à Services → modifiez n’importe quel service → activez « Exiger un acompte » et fixez le montant</li>
            <li><strong className="text-slate-700">Rappels :</strong> Paramètres → Notifications → activez les rappels par courriel et SMS à 72 h, 24 h et 2 h</li>
            <li><strong className="text-slate-700">Politique d’annulation :</strong> Paramètres → Réservation → fixez votre délai d’annulation et votre pourcentage de frais. Avec la carte en dossier activée, les facturations se font automatiquement.</li>
          </ol>
          <p className="text-slate-600 leading-relaxed mb-4">
            Une fois en place, vous n’y touchez plus. Le système fonctionne en arrière-plan et protège vos revenus automatiquement.
          </p>
        </article>

        {/* CTA box */}
        <div className="mt-12 rounded-2xl bg-[#19212B] p-8 text-center">
          <h2 className="text-xl font-bold text-white mb-2">Prêt à protéger vos rendez-vous?</h2>
          <p className="text-white/60 mb-6 text-sm">Commencez gratuitement — acomptes, rappels et frais d’annulation configurés en 10 minutes.</p>
          <Link
            href="/register?lang=fr"
            className="inline-flex items-center gap-2 bg-white text-violet-600 font-semibold px-6 py-3 rounded-xl hover:bg-violet-50 transition-colors"
          >
            Commencer gratuitement avec Pulse →
          </Link>
        </div>

        <div className="mt-8">
          <Link href="/fr/blog" className="text-sm text-slate-500 hover:text-violet-600 transition-colors">
            ← Retour au blogue
          </Link>
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

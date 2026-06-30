import Link from "next/link";
import { Accessibility, Keyboard, Eye, Volume2, RefreshCw, Mail, CheckCircle2 } from "lucide-react";

// Bilingual accessibility statement. EN at /accessibility, FR at /fr/accessibility.
export function AccessibilityContent({ locale }: { locale: "en" | "fr" }) {
  const fr = locale === "fr";
  const home = fr ? "/fr" : "/";
  const privacyHref = fr ? "/fr/privacy" : "/privacy";
  const supportHref = fr ? "/fr/support" : "/support";

  const pour = fr
    ? [
        { label: "Perceptible", desc: "Le contenu est présenté de façons que tous les utilisateurs peuvent percevoir, y compris un contraste de couleurs adéquat (ratio minimal de 4,5:1) et des équivalents textuels pertinents." },
        { label: "Utilisable", desc: "Tous les composants d’interface et la navigation sont utilisables au clavier seul, sans interactions limitées dans le temps qui ne peuvent être prolongées." },
        { label: "Compréhensible", desc: "Le texte est lisible et prévisible. Les formulaires comportent des étiquettes descriptives et des messages d’erreur clairs." },
        { label: "Robuste", desc: "Le contenu est compatible avec les technologies d’assistance actuelles et futures, y compris les lecteurs d’écran et les API d’accessibilité des navigateurs." },
      ]
    : [
        { label: "Perceivable", desc: "Content is presentable in ways all users can perceive, including adequate colour contrast (minimum 4.5:1 ratio) and meaningful text alternatives." },
        { label: "Operable", desc: "All interface components and navigation are operable by keyboard alone, with no time-limited interactions that cannot be extended." },
        { label: "Understandable", desc: "Text is readable and predictable. Forms include descriptive labels and clear error messages." },
        { label: "Robust", desc: "Content is compatible with current and future assistive technologies including screen readers and browser accessibility APIs." },
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
          <div className="bg-emerald-600 px-8 py-10 text-white">
            <h1 className="text-3xl font-bold mb-2">{fr ? "Déclaration d’accessibilité" : "Accessibility Statement"}</h1>
            <p className="text-emerald-100 text-sm">{fr ? "Dernière révision : 12 juin 2026 · Pulse Appointments Inc." : "Last reviewed: June 12, 2026 · Pulse Appointments Inc."}</p>
          </div>

          <div className="p-8 md:p-12 space-y-10 text-sm text-slate-600 leading-relaxed">
            <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-6 flex gap-4 text-slate-700">
              <Accessibility className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
              <p>
                {fr
                  ? "Pulse Appointments s’engage à rendre sa plateforme web et son application mobile accessibles à tous, y compris aux personnes en situation de handicap. Nous croyons que l’égalité d’accès au numérique est une question de dignité humaine — non pas une fonctionnalité, mais un droit."
                  : "Pulse Appointments is committed to ensuring that our web platform and mobile application are accessible to everyone, including people with disabilities. We believe that equal digital access is a matter of human dignity — not a feature, but a right."}
              </p>
            </div>

            {/* Our Commitment */}
            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-500" /> {fr ? "Notre engagement" : "Our Commitment"}
              </h2>
              <div className="space-y-3">
                <p>
                  {fr
                    ? <>Pulse Appointments conçoit activement son tableau de bord web (<strong>www.pulseappointments.com</strong>) et son portail de réservation client pour qu’ils soient conformes aux <strong>Règles pour l’accessibilité des contenus Web (WCAG) 2.2, niveau AA</strong>. Ces règles sont publiées par le World Wide Web Consortium (W3C) et constituent la norme internationalement reconnue en matière d’accessibilité numérique.</>
                    : <>Pulse Appointments actively engineers its web dashboard (<strong>www.pulseappointments.com</strong>) and client booking portal to conform to the <strong>Web Content Accessibility Guidelines (WCAG) 2.2, Level AA</strong>. These guidelines are published by the World Wide Web Consortium (W3C) and represent the internationally recognized standard for digital accessibility.</>}
                </p>
                <p>
                  {fr
                    ? "Notre équipe d’ingénierie effectue des examens d’accessibilité ciblés, alignés sur les quatre principes directeurs POUR :"
                    : "Our engineering team conducts targeted accessibility reviews aligned with the four POUR governing principles:"}
                </p>
                <div className="grid sm:grid-cols-2 gap-3 mt-2">
                  {pour.map(({ label, desc }) => (
                    <div key={label} className="rounded-xl bg-slate-50 border border-slate-100 p-4 space-y-1">
                      <p className="font-semibold text-slate-800 text-xs uppercase tracking-wide">{label}</p>
                      <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Ongoing Actions */}
            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-emerald-500" /> {fr ? "Actions continues" : "Ongoing Actions"}
              </h2>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center shrink-0 mt-0.5">
                    <Keyboard className="w-4 h-4 text-violet-500" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 mb-1">{fr ? "Navigation complète au clavier" : "Full Keyboard Navigation"}</p>
                    <p className="text-slate-500">{fr ? "Tous les éléments interactifs — fenêtres modales, tiroirs, menus déroulants, sélecteurs de date et champs de formulaire — sont entièrement utilisables sans souris. La touche Échap ferme toutes les superpositions. Le focus est maintenu dans les boîtes de dialogue ouvertes et restauré à la fermeture. Un lien d’évitement « aller au contenu » visible est offert en haut de chaque page." : "All interactive elements — modals, drawers, dropdown menus, date pickers, and form controls — are fully operable without a mouse. Escape key closes all overlays. Focus is trapped within open dialogs and restored on close. A visible skip-to-content link is available at the top of every page."}</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center shrink-0 mt-0.5">
                    <Volume2 className="w-4 h-4 text-violet-500" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 mb-1">{fr ? "Compatibilité avec les lecteurs d’écran" : "Screen Reader Compatibility"}</p>
                    <p className="text-slate-500">{fr
                      ? <>Nous utilisons des repères sémantiques HTML5 (<code className="text-xs bg-slate-100 px-1 py-0.5 rounded">main</code>, <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">nav</code>, <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">header</code>) et des rôles ARIA (<code className="text-xs bg-slate-100 px-1 py-0.5 rounded">role=&quot;dialog&quot;</code>, <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">aria-modal</code>, <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">aria-labelledby</code>) dans toute la plateforme. Des annonces de régions actives sont émises lors des changements d’état asynchrones. Tous les contrôles interactifs portent un attribut <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">aria-label</code> descriptif.</>
                      : <>We use semantic HTML5 landmarks (<code className="text-xs bg-slate-100 px-1 py-0.5 rounded">main</code>, <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">nav</code>, <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">header</code>) and ARIA roles (<code className="text-xs bg-slate-100 px-1 py-0.5 rounded">role=&quot;dialog&quot;</code>, <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">aria-modal</code>, <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">aria-labelledby</code>) throughout the platform. Live-region announcements are issued for async state changes. All interactive controls carry descriptive <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">aria-label</code> attributes.</>}</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center shrink-0 mt-0.5">
                    <Eye className="w-4 h-4 text-violet-500" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 mb-1">{fr ? "Contraste des couleurs et clarté visuelle" : "Colour Contrast & Visual Clarity"}</p>
                    <p className="text-slate-500">{fr ? "Le texte et les éléments interactifs sont testés pour respecter le ratio de contraste minimal WCAG 2.2 AA de 4,5:1 pour le texte normal et de 3:1 pour le grand texte. La couleur n’est jamais le seul moyen de transmettre une information." : "Text and interactive elements are tested to meet the WCAG 2.2 AA minimum contrast ratio of 4.5:1 for normal text and 3:1 for large text. Colour is never the only means of conveying information."}</p>
                  </div>
                </div>
              </div>
            </section>

            {/* Known Limitations */}
            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-3">{fr ? "Limites connues" : "Known Limitations"}</h2>
              <p className="text-slate-600">
                {fr
                  ? "Bien que nous visions une conformité complète au niveau WCAG 2.2 AA, certains composants intégrés de tiers (comme l’élément de paiement Stripe) échappent à notre contrôle direct et peuvent ne pas être pleinement conformes. Nous collaborons avec ces fournisseurs pour favoriser une conception accessible et offrir d’autres parcours lorsque possible."
                  : "While we strive for full WCAG 2.2 AA conformance, some third-party embedded components (such as the Stripe payment element) are outside our direct control and may not fully conform. We work with these vendors to encourage accessible design and provide alternative paths where possible."}
              </p>
            </section>

            {/* Feedback and Assistance Channel */}
            <section>
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Mail className="w-5 h-5 text-emerald-500" /> {fr ? "Canal de rétroaction et d’assistance" : "Feedback & Assistance Channel"}
              </h2>
              <p className="text-slate-600 mb-4">
                {fr
                  ? "Si vous rencontrez un obstacle à l’accessibilité sur une page ou une fonctionnalité de Pulse, nous voulons le savoir. Vos commentaires orientent directement nos priorités de correction."
                  : "If you encounter an accessibility barrier on any Pulse page or feature, we want to hear about it. Your feedback directly informs our remediation priorities."}
              </p>
              <div className="rounded-2xl bg-slate-50 border border-slate-100 p-6 space-y-3">
                <p className="text-sm font-semibold text-slate-800">{fr ? "Signaler un obstacle à l’accessibilité" : "Report an Accessibility Barrier"}</p>
                <ul className="text-sm text-slate-600 space-y-1.5">
                  <li><strong>{fr ? "Courriel :" : "Email:"}</strong> <a href="mailto:support@pulseappointments.com?subject=Accessibility%20Feedback" className="text-violet-600 hover:underline">support@pulseappointments.com</a></li>
                  <li><strong>{fr ? "Objet :" : "Subject line:"}</strong> {fr ? "Rétroaction sur l’accessibilité" : "Accessibility Feedback"}</li>
                  <li><strong>{fr ? "À inclure :" : "Include:"}</strong> {fr ? "l’adresse de la page, la technologie d’assistance que vous utilisez et une description de l’obstacle" : "The page URL, the assistive technology you use, and a description of the barrier"}</li>
                  <li><strong>{fr ? "Délai de réponse :" : "Response time:"}</strong> {fr ? "nous visons à répondre dans un délai de 2 jours ouvrables et à corriger les obstacles confirmés dans un délai de 30 jours" : "We aim to respond within 2 business days and to remediate confirmed barriers within 30 days"}</li>
                </ul>
              </div>
              <p className="text-xs text-slate-400 mt-4">
                {fr
                  ? "Si vous avez besoin de contenu dans un format de rechange ou d’aide pour accomplir une tâche sur notre plateforme, écrivez-nous à l’adresse ci-dessus et nous offrirons des mesures d’adaptation raisonnables."
                  : "If you require content in an alternative format or need assistance completing a task on our platform, contact us at the address above and we will provide reasonable accommodation."}
              </p>
            </section>

            <div className="pt-8 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
              <p className="text-xs text-slate-400">{fr ? "Des questions? support@pulseappointments.com" : "Questions? support@pulseappointments.com"}</p>
              <div className="flex gap-6">
                <Link href={privacyHref} className="text-violet-600 font-semibold text-sm hover:underline">{fr ? "Politique de confidentialité" : "Privacy Policy"}</Link>
                <Link href={supportHref} className="text-violet-600 font-semibold text-sm hover:underline">{fr ? "Soutien" : "Support"}</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, ChevronLeft, Sparkles, X } from "lucide-react";
import { api, type FeatureTourProgress } from "@/lib/api";
import { trackEvent } from "@/lib/analytics";
import { cn } from "@/lib/utils";

type Copy = { en: string; fr: string };
type TourStep = { target: string; title: Copy; body: Copy; href?: string };
type Tour = { key: string; version: number; title: Copy; summary: Copy; steps: TourStep[] };

const TOURS: Tour[] = [
  {
    key: "revenue-protection",
    version: 1,
    title: { en: "Protect every booking", fr: "Protégez chaque réservation" },
    summary: { en: "Use deposits, card-on-file, and no-show fees to reduce lost revenue.", fr: "Utilisez les dépôts, les cartes au dossier et les frais d’absence pour réduire les pertes." },
    steps: [
      {
        target: "/dashboard/payments",
        title: { en: "Your revenue controls live here", fr: "Vos contrôles de revenus sont ici" },
        body: { en: "Payments brings checkout, transactions, invoices, deposits, and fees into one workflow.", fr: "Paiements regroupe l’encaissement, les transactions, les factures, les dépôts et les frais." },
      },
      {
        target: "/dashboard/settings?tab=payments",
        title: { en: "Collect commitment upfront", fr: "Obtenez un engagement à l’avance" },
        body: { en: "Set a deposit percentage, require a card on file, and define cancellation or no-show fees.", fr: "Définissez un pourcentage de dépôt, exigez une carte au dossier et configurez les frais d’annulation ou d’absence." },
        href: "/dashboard/settings?tab=payments",
      },
      {
        target: "/dashboard/checkout",
        title: { en: "Close the payment loop", fr: "Finalisez le parcours de paiement" },
        body: { en: "Use Checkout for remaining balances and add-ons, with every payment tied to the client record.", fr: "Utilisez l’encaissement pour les soldes et suppléments; chaque paiement reste lié au dossier client." },
        href: "/dashboard/checkout",
      },
    ],
  },
  {
    key: "recurring-revenue",
    version: 1,
    title: { en: "Build recurring revenue", fr: "Créez des revenus récurrents" },
    summary: { en: "Package services and sell memberships that improve retention.", fr: "Regroupez vos services et vendez des abonnements qui renforcent la fidélité." },
    steps: [
      { target: "/dashboard/marketing", title: { en: "Revenue products", fr: "Produits générateurs de revenus" }, body: { en: "Packages and memberships are grouped under Marketing so they can support retention campaigns.", fr: "Les forfaits et abonnements sont regroupés sous Marketing pour soutenir vos campagnes de fidélisation." } },
      { target: "/dashboard/packages", title: { en: "Pre-sell service packages", fr: "Pré-vendez des forfaits" }, body: { en: "Bundle visits or credits, set expiry rules, and track redemption.", fr: "Regroupez des visites ou crédits, fixez les échéances et suivez leur utilisation." }, href: "/dashboard/packages" },
      { target: "/dashboard/memberships", title: { en: "Create predictable revenue", fr: "Créez des revenus prévisibles" }, body: { en: "Offer recurring benefits that keep your best clients coming back.", fr: "Offrez des avantages récurrents qui fidélisent vos meilleurs clients." }, href: "/dashboard/memberships" },
    ],
  },
  {
    key: "gift-cards",
    version: 1,
    title: { en: "Sell gift cards", fr: "Vendez des cartes-cadeaux" },
    summary: { en: "Generate prepaid revenue and turn buyers into new clients.", fr: "Générez des revenus prépayés et transformez les acheteurs en nouveaux clients." },
    steps: [
      { target: "/dashboard/marketing", title: { en: "A simple acquisition channel", fr: "Un canal d’acquisition simple" }, body: { en: "Gift cards sit alongside your other client-growth tools.", fr: "Les cartes-cadeaux se trouvent avec vos autres outils de croissance." } },
      { target: "/dashboard/gift-cards", title: { en: "Issue and manage balances", fr: "Émettez et gérez les soldes" }, body: { en: "Create a card, email it to the recipient, and track every redemption.", fr: "Créez une carte, envoyez-la au destinataire et suivez chaque utilisation." }, href: "/dashboard/gift-cards" },
    ],
  },
  {
    key: "client-reactivation",
    version: 1,
    title: { en: "Reactivate past clients", fr: "Réactivez vos anciens clients" },
    summary: { en: "Use targeted campaigns, offers, and promo codes to fill open capacity.", fr: "Utilisez des campagnes, offres et codes promo ciblés pour remplir vos disponibilités." },
    steps: [
      { target: "/dashboard/marketing", title: { en: "Your growth workspace", fr: "Votre espace de croissance" }, body: { en: "Campaigns, offers, and promotions are organized in one place.", fr: "Les campagnes, offres et promotions sont organisées au même endroit." } },
      { target: "/dashboard/marketing/campaigns", title: { en: "Reach the right audience", fr: "Joignez le bon public" }, body: { en: "Target existing clients with timely email or SMS campaigns and measurable calls to action.", fr: "Ciblez vos clients avec des campagnes courriel ou SMS opportunes et des appels à l’action mesurables." }, href: "/dashboard/marketing/campaigns" },
    ],
  },
];

function text(copy: Copy, french: boolean) {
  return french ? copy.fr : copy.en;
}

function findTarget(target: string) {
  return [...document.querySelectorAll<HTMLElement>("[data-tour-target]")]
    .find((element) => element.dataset.tourTarget === target) ?? null;
}

export function FeatureDiscoveryTours({
  enabled,
  autoStart,
  french,
  catalogOpen,
  onCatalogClose,
}: {
  enabled: boolean;
  autoStart: boolean;
  french: boolean;
  catalogOpen: boolean;
  onCatalogClose: () => void;
}) {
  const router = useRouter();
  const [progress, setProgress] = useState<FeatureTourProgress[]>([]);
  const [tour, setTour] = useState<Tour | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [loaded, setLoaded] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled) return;
    api.users.featureTours()
      .then(setProgress)
      .catch(() => setProgress([]))
      .finally(() => setLoaded(true));
  }, [enabled]);

  const persist = useCallback((active: Tour, status: FeatureTourProgress["status"], currentStep: number) => {
    const row = { tourKey: active.key, version: active.version, status, currentStep };
    setProgress((current) => [
      { ...row, updatedAt: new Date().toISOString() },
      ...current.filter((item) => !(item.tourKey === active.key && item.version === active.version)),
    ]);
    api.users.updateFeatureTour(row).catch(() => {});
  }, []);

  const start = useCallback((nextTour: Tour, requestedStep = 0) => {
    const saved = progress.find((item) => item.tourKey === nextTour.key && item.version === nextTour.version);
    const nextStep = Math.min(requestedStep || (saved?.status === "IN_PROGRESS" ? saved.currentStep : 0), nextTour.steps.length - 1);
    setTour(nextTour);
    setStepIndex(nextStep);
    onCatalogClose();
    persist(nextTour, "IN_PROGRESS", nextStep);
    trackEvent("feature_tour_started", { tour_key: nextTour.key, tour_version: nextTour.version, replay: !!saved });
  }, [onCatalogClose, persist, progress]);

  // Auto-offer only the first, highest-value tour. Other tours remain available
  // from Help, avoiding a sequence of unsolicited overlays.
  useEffect(() => {
    if (!enabled || !autoStart || !loaded || tour || catalogOpen) return;
    const first = TOURS[0];
    const saved = progress.find((item) => item.tourKey === first.key && item.version === first.version);
    if (saved?.status === "COMPLETED" || saved?.status === "DISMISSED") return;
    if (saved && Date.now() - new Date(saved.updatedAt).getTime() < 7 * 24 * 60 * 60 * 1000) return;
    const timer = window.setTimeout(() => start(first), 1800);
    return () => window.clearTimeout(timer);
  }, [autoStart, catalogOpen, enabled, loaded, progress, start, tour]);

  const locate = useCallback(() => {
    if (!tour) return;
    const target = tour.steps[stepIndex].target;
    window.dispatchEvent(new CustomEvent("pulse:tour-target", { detail: target }));
    window.setTimeout(() => {
      const element = findTarget(target);
      setTargetRect(element?.getBoundingClientRect() ?? null);
      element?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, 50);
  }, [stepIndex, tour]);

  useLayoutEffect(() => {
    locate();
    window.addEventListener("resize", locate);
    window.addEventListener("scroll", locate, true);
    return () => {
      window.removeEventListener("resize", locate);
      window.removeEventListener("scroll", locate, true);
    };
  }, [locate]);

  useEffect(() => {
    if (!tour) return;
    panelRef.current?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        dismiss();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = [...panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      )];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", keyboard);
    return () => document.removeEventListener("keydown", keyboard);
    // dismiss is intentionally resolved against current tour/step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIndex, tour]);

  function dismiss() {
    if (!tour) return;
    persist(tour, "DISMISSED", stepIndex);
    trackEvent("feature_tour_dismissed", { tour_key: tour.key, tour_version: tour.version, step: stepIndex + 1 });
    setTour(null);
  }

  function later() {
    if (!tour) return;
    persist(tour, "IN_PROGRESS", stepIndex);
    trackEvent("feature_tour_snoozed", { tour_key: tour.key, tour_version: tour.version, step: stepIndex + 1 });
    setTour(null);
  }

  function advance() {
    if (!tour) return;
    if (stepIndex === tour.steps.length - 1) {
      persist(tour, "COMPLETED", stepIndex);
      trackEvent("feature_tour_completed", { tour_key: tour.key, tour_version: tour.version });
      setTour(null);
      return;
    }
    const next = stepIndex + 1;
    setStepIndex(next);
    persist(tour, "IN_PROGRESS", next);
    trackEvent("feature_tour_advanced", { tour_key: tour.key, tour_version: tour.version, step: next + 1 });
  }

  function visit() {
    if (!tour) return;
    const step = tour.steps[stepIndex];
    if (!step.href) return;
    trackEvent("feature_tour_cta_clicked", { tour_key: tour.key, tour_version: tour.version, step: stepIndex + 1 });
    persist(tour, "COMPLETED", stepIndex);
    setTour(null);
    router.push(step.href);
  }

  if (!enabled) return null;

  const completed = (candidate: Tour) =>
    progress.some((item) => item.tourKey === candidate.key && item.version === candidate.version && item.status === "COMPLETED");

  return (
    <>
      {catalogOpen && !tour && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/35 p-4" onMouseDown={onCatalogClose}>
          <div role="dialog" aria-modal="true" aria-labelledby="tour-catalog-title" className="w-full max-w-xl rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 id="tour-catalog-title" className="text-lg font-bold text-gray-900">{french ? "Visites guidées" : "Product tours"}</h2>
                <p className="mt-1 text-sm text-gray-500">{french ? "Découvrez les outils qui protègent et augmentent vos revenus." : "Learn the tools that protect and grow your revenue."}</p>
              </div>
              <button onClick={onCatalogClose} aria-label={french ? "Fermer" : "Close"} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-2">
              {TOURS.map((candidate) => (
                <button key={candidate.key} onClick={() => start(candidate)}
                  className="flex w-full items-center gap-3 rounded-xl border border-gray-200 p-4 text-left transition-colors hover:border-violet-300 hover:bg-violet-50">
                  <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", completed(candidate) ? "bg-emerald-100 text-emerald-700" : "bg-violet-100 text-violet-700")}>
                    {completed(candidate) ? <Check className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-gray-900">{text(candidate.title, french)}</span>
                    <span className="mt-0.5 block text-xs text-gray-500">{text(candidate.summary, french)}</span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-gray-400" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {tour && (() => {
        const step = tour.steps[stepIndex];
        const desktopRight = targetRect && targetRect.right + 340 < window.innerWidth;
        const style = targetRect && window.innerWidth >= 768
          ? {
              top: Math.max(16, Math.min(targetRect.top, window.innerHeight - 330)),
              left: desktopRight ? targetRect.right + 16 : Math.max(16, targetRect.left - 336),
            }
          : undefined;
        return (
          <div className="fixed inset-0 z-[80] bg-black/35">
            {targetRect && (
              <div aria-hidden="true" className="pointer-events-none fixed rounded-xl ring-4 ring-violet-400 ring-offset-4 ring-offset-white"
                style={{ top: targetRect.top, left: targetRect.left, width: targetRect.width, height: targetRect.height }} />
            )}
            <div ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="feature-tour-title"
              className={cn("fixed w-[calc(100%-2rem)] max-w-xs rounded-2xl border border-violet-100 bg-white p-5 shadow-2xl outline-none", !style && "bottom-4 left-4")}
              style={style}>
              <div className="mb-4 flex items-start justify-between gap-3">
                <span className="text-xs font-bold uppercase tracking-wide text-violet-600">
                  {french ? `Étape ${stepIndex + 1} sur ${tour.steps.length}` : `Step ${stepIndex + 1} of ${tour.steps.length}`}
                </span>
                <button onClick={dismiss} aria-label={french ? "Fermer la visite" : "Close tour"} className="-mr-1 -mt-1 rounded-lg p-1.5 text-gray-500 hover:bg-gray-100"><X className="h-4 w-4" /></button>
              </div>
              <h2 id="feature-tour-title" className="text-base font-bold text-gray-900">{text(step.title, french)}</h2>
              <p className="mt-2 text-sm leading-6 text-gray-600">{text(step.body, french)}</p>
              <div className="mt-5 flex items-center justify-between gap-2">
                {stepIndex === 0 ? (
                  <button onClick={later} className="rounded-lg px-2 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">
                    {french ? "Plus tard" : "Later"}
                  </button>
                ) : (
                  <button onClick={() => { const previous = stepIndex - 1; setStepIndex(previous); persist(tour, "IN_PROGRESS", previous); }}
                    className="inline-flex items-center gap-1 rounded-lg px-2 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">
                    <ChevronLeft className="h-4 w-4" />{french ? "Retour" : "Back"}
                  </button>
                )}
                <div className="flex gap-2">
                  {step.href && (
                    <button onClick={visit} className="rounded-lg border border-violet-200 px-3 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-50">
                      {french ? "Essayer" : "Try it"}
                    </button>
                  )}
                  <button onClick={advance} className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-700">
                    {stepIndex === tour.steps.length - 1 ? (french ? "Terminer" : "Finish") : (french ? "Suivant" : "Next")}
                    {stepIndex < tour.steps.length - 1 && <ArrowRight className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}

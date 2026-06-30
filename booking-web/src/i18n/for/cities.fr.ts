// French content for the /fr/for/<city> landing pages, rendered through the
// locale-aware CityLandingPage component. Keep slugs in sync with the English
// /for/<city> pages. `primaryAudience` is a lowercase noun phrase that follows
// "Pulse aide …"; `city` is the display name (e.g. Québec, Montréal).
export interface CityContentFr {
  city: string;
  province: string;
  titleKeyword: string;
  primaryAudience: string;
  localAngle: string;
  breadcrumbName: string;
  meta: { title: string; description: string; ogTitle: string; ogDescription: string };
}

export const cityContentFr: Record<string, CityContentFr> = {
  toronto: {
    city: "Toronto",
    province: "ON",
    titleKeyword: "Logiciel de réservation en ligne",
    primaryAudience: "les salons, spas, barbiers, artistes de cils, massothérapeutes et professionnels du mieux-être",
    localAngle: "Des studios du centre-ville aux boutiques de quartier, Pulse s’adapte à toute entreprise de services sur rendez-vous à Toronto — réservation, acompte, rappel et dossier client réunis.",
    breadcrumbName: "Logiciel de réservation pour Toronto",
    meta: {
      title: "Logiciel de réservation de rendez-vous pour les entreprises de services de Toronto | Pulse",
      description: "Pulse est le logiciel de réservation en ligne le plus simple pour les salons, spas, barbiers et entreprises de mieux-être de Toronto. Prix en CAD, protection contre les absences, gratuit pour commencer.",
      ogTitle: "Logiciel de réservation de rendez-vous Toronto | Pulse Appointments",
      ogDescription: "Réservation en ligne pour les salons, spas et entreprises de services de Toronto. Prix en CAD, gratuit pour commencer.",
    },
  },
  vancouver: {
    city: "Vancouver",
    province: "BC",
    titleKeyword: "Logiciel de réservation en ligne",
    primaryAudience: "les salons, spas, barbiers, massothérapeutes et professionnels du mieux-être",
    localAngle: "Des studios du centre-ville aux boutiques de quartier, Pulse convient à toute entreprise de services sur rendez-vous à Vancouver.",
    breadcrumbName: "Logiciel de réservation pour Vancouver",
    meta: {
      title: "Logiciel de réservation de rendez-vous pour les entreprises de services de Vancouver | Pulse",
      description: "Pulse est le logiciel de réservation en ligne le plus simple pour les salons, spas, barbiers et entreprises de mieux-être de Vancouver. Prix en CAD, protection contre les absences, gratuit pour commencer.",
      ogTitle: "Logiciel de réservation de rendez-vous Vancouver | Pulse Appointments",
      ogDescription: "Réservation en ligne pour les salons, spas et entreprises de services de Vancouver. Prix en CAD, gratuit pour commencer.",
    },
  },
  calgary: {
    city: "Calgary",
    province: "AB",
    titleKeyword: "Logiciel de réservation",
    primaryAudience: "les salons, spas, barbiers, massothérapeutes et prestataires de services mobiles",
    localAngle: "Les entreprises de Calgary ont besoin d’une réservation qui fonctionne autant pour les studios individuels, les boutiques de quartier que les services mobiles. Pulse garde le flux simple : service, heure, acompte, rappel et dossier client.",
    breadcrumbName: "Logiciel de réservation pour Calgary",
    meta: {
      title: "Logiciel de réservation Calgary | Pulse Appointments",
      description: "Logiciel de réservation en ligne pour les salons, spas, barbiers, prestataires de mieux-être et entreprises de services de Calgary. Prix en CAD, acomptes, rappels SMS et protection contre les absences.",
      ogTitle: "Logiciel de réservation Calgary | Pulse Appointments",
      ogDescription: "Réservation en ligne pour les entreprises de services de Calgary. Prix en CAD, gratuit pour commencer.",
    },
  },
  ottawa: {
    city: "Ottawa",
    province: "ON",
    titleKeyword: "Logiciel de réservation de rendez-vous",
    primaryAudience: "les salons, prestataires de mieux-être, consultants, spas et équipes de services mobiles",
    localAngle: "Les entreprises d’Ottawa ont besoin d’une expérience de réservation professionnelle qui sert la clientèle dans les deux langues officielles, protège les longs rendez-vous et garde les opérations organisées sans grande réception.",
    breadcrumbName: "Logiciel de réservation pour Ottawa",
    meta: {
      title: "Logiciel de réservation Ottawa | Pulse Appointments",
      description: "Logiciel de réservation en ligne pour les salons, spas, prestataires de mieux-être, consultants et entreprises de services sur rendez-vous d’Ottawa. Prix en CAD et protection contre les absences.",
      ogTitle: "Logiciel de réservation Ottawa | Pulse Appointments",
      ogDescription: "Réservation en ligne pour les entreprises de services d’Ottawa. Prix en CAD, gratuit pour commencer.",
    },
  },
  edmonton: {
    city: "Edmonton",
    province: "AB",
    titleKeyword: "Réservation de rendez-vous en ligne",
    primaryAudience: "les barbiers, salons, esthéticiennes, massothérapeutes, consultants et services mobiles",
    localAngle: "Les entreprises de services d’Edmonton ont besoin d’une réservation fiable, de politiques de rendez-vous claires et de rappels qui réduisent les trous dans le calendrier. Pulse réunit ces éléments dans une seule plateforme pensée pour le Canada.",
    breadcrumbName: "Logiciel de réservation pour Edmonton",
    meta: {
      title: "Logiciel de réservation Edmonton | Pulse Appointments",
      description: "Logiciel de réservation de rendez-vous en ligne pour les salons, barbiers, spas, prestataires de mieux-être et entreprises de services d’Edmonton. Prix en CAD, acomptes et rappels.",
      ogTitle: "Logiciel de réservation Edmonton | Pulse Appointments",
      ogDescription: "Réservation en ligne pour les entreprises d’Edmonton. Prix en CAD, gratuit pour commencer.",
    },
  },
  winnipeg: {
    city: "Winnipeg",
    province: "MB",
    titleKeyword: "Logiciel de réservation de rendez-vous",
    primaryAudience: "les salons, spas, toiletteurs pour animaux, prestataires de mieux-être et équipes sur rendez-vous",
    localAngle: "Les entreprises de Winnipeg peuvent utiliser Pulse pour remplacer la prise de rendez-vous par messages privés, protéger leurs revenus avec des acomptes et offrir aux clients un flux de réservation mobile clair à partir de n’importe quel lien.",
    breadcrumbName: "Logiciel de réservation pour Winnipeg",
    meta: {
      title: "Logiciel de réservation Winnipeg | Pulse Appointments",
      description: "Logiciel de réservation en ligne pour les salons, spas, toiletteurs, prestataires de mieux-être et entreprises de services sur rendez-vous de Winnipeg. Prix en CAD et protection contre les absences.",
      ogTitle: "Logiciel de réservation Winnipeg | Pulse Appointments",
      ogDescription: "Réservation en ligne pour les entreprises de services de Winnipeg. Prix en CAD, gratuit pour commencer.",
    },
  },
  montreal: {
    city: "Montréal",
    province: "QC",
    titleKeyword: "Logiciel de réservation de rendez-vous",
    primaryAudience: "les salons, spas, prestataires de mieux-être et professionnels indépendants",
    localAngle: "Les entreprises de Montréal servent leur clientèle en français et en anglais. Pulse prend en charge un parcours de réservation bilingue tout en réunissant la planification, les acomptes et les rappels au même endroit.",
    breadcrumbName: "Logiciel de réservation pour Montréal",
    meta: {
      title: "Logiciel de réservation Montréal | Pulse Appointments",
      description: "Logiciel de réservation en ligne pour les salons, spas, prestataires de mieux-être et entreprises sur rendez-vous de Montréal, avec prix en CAD et réservation client bilingue.",
      ogTitle: "Logiciel de réservation Montréal | Pulse Appointments",
      ogDescription: "Réservation en ligne pour les salons, spas et entreprises de services de Montréal. Prix en CAD, réservation bilingue.",
    },
  },
  "quebec-city": {
    city: "Québec",
    province: "QC",
    titleKeyword: "Logiciel de réservation de rendez-vous",
    primaryAudience: "les salons, spas, cliniques, prestataires de mieux-être et professionnels indépendants",
    localAngle: "Les entreprises de la ville de Québec ont besoin d’une expérience client en français appuyée par des outils pratiques de planification, d’acomptes et de rappels.",
    breadcrumbName: "Logiciel de réservation pour Québec",
    meta: {
      title: "Logiciel de réservation Québec | Pulse Appointments",
      description: "Logiciel de réservation en ligne pour les entreprises sur rendez-vous de la ville de Québec, avec prix en CAD, réservation client en français, rappels et protection contre les absences.",
      ogTitle: "Logiciel de réservation Québec | Pulse Appointments",
      ogDescription: "Réservation en ligne pour les entreprises de services de la ville de Québec. Prix en CAD, réservation en français.",
    },
  },
  laval: {
    city: "Laval",
    province: "QC",
    titleKeyword: "Logiciel de réservation de rendez-vous",
    primaryAudience: "les salons, spas, prestataires de mieux-être et entreprises de services mobiles",
    localAngle: "Les entreprises de Laval peuvent offrir une réservation en ligne conviviale en français, réduire les rendez-vous manqués et gérer des horaires en croissance sans alourdir le travail de réception.",
    breadcrumbName: "Logiciel de réservation pour Laval",
    meta: {
      title: "Logiciel de réservation Laval | Pulse Appointments",
      description: "Logiciel de réservation en ligne pour les salons, spas, prestataires de mieux-être et entreprises de services sur rendez-vous de Laval.",
      ogTitle: "Logiciel de réservation Laval | Pulse Appointments",
      ogDescription: "Réservation en ligne pour les entreprises de services de Laval. Prix en CAD, réservation en français.",
    },
  },
  gatineau: {
    city: "Gatineau",
    province: "QC",
    titleKeyword: "Logiciel de réservation de rendez-vous",
    primaryAudience: "les salons, prestataires de mieux-être, consultants, spas et professionnels indépendants",
    localAngle: "Les entreprises de Gatineau évoluent dans un marché régional bilingue. Pulse offre un flux de réservation unique pour la clientèle francophone et anglophone.",
    breadcrumbName: "Logiciel de réservation pour Gatineau",
    meta: {
      title: "Logiciel de réservation Gatineau | Pulse Appointments",
      description: "Logiciel de réservation en ligne pour les salons, spas, prestataires de mieux-être, consultants et entreprises sur rendez-vous de Gatineau.",
      ogTitle: "Logiciel de réservation Gatineau | Pulse Appointments",
      ogDescription: "Réservation en ligne pour les entreprises de services de Gatineau. Prix en CAD, réservation bilingue.",
    },
  },
};

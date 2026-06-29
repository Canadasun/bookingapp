"use client";

import { createContext, useContext } from "react";
import { dashboardEn } from "@/i18n/dashboard/en";
import { dashboardFr } from "@/i18n/dashboard/fr";

export type DashboardLocale = "en" | "fr";

export const DashboardLocaleContext = createContext<DashboardLocale>("en");

export function useDashboardLocale() {
  const locale = useContext(DashboardLocaleContext);
  return {
    locale,
    french: locale === "fr",
    dictionary: locale === "fr" ? dashboardFr : dashboardEn,
    formatCurrency(cents: number, currency: "CAD" | "USD" = "CAD") {
      return new Intl.NumberFormat(locale === "fr" ? "fr-CA" : "en-CA", {
        style: "currency",
        currency,
        currencyDisplay: "narrowSymbol",
      }).format(cents / 100);
    },
    formatDate(value: string | Date, options?: Intl.DateTimeFormatOptions) {
      return new Intl.DateTimeFormat(locale === "fr" ? "fr-CA" : "en-CA", options).format(new Date(value));
    },
  };
}

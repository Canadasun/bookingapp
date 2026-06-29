"use client";

import { createContext, useContext } from "react";
import type { Location } from "@/lib/api";

export interface LocationScopeValue {
  locations: Location[];
  selectedIds: string[];
  setSelectedIds: (ids: string[]) => void;
  loading: boolean;
}

export const LocationScopeContext = createContext<LocationScopeValue>({
  locations: [],
  selectedIds: [],
  setSelectedIds: () => {},
  loading: true,
});

export const LOCATIONS_CHANGED_EVENT = "pulse:locations-changed";

export function notifyLocationsChanged() {
  window.dispatchEvent(new Event(LOCATIONS_CHANGED_EVENT));
}

export function useLocationScope() {
  return useContext(LocationScopeContext);
}

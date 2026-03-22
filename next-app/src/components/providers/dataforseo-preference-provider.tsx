"use client";

import * as React from "react";
import {
  getDataforseoApiEnabled,
  setDataforseoApiEnabled,
  DATAFORSEO_PREF_KEY,
} from "@/lib/dataforseo-preference";

type DataforseoPreferenceContextValue = {
  dataforseoApiEnabled: boolean;
  setDataforseoApiEnabled: (enabled: boolean) => void;
};

const DataforseoPreferenceContext = React.createContext<DataforseoPreferenceContextValue | null>(null);

export function DataforseoPreferenceProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabled] = React.useState(() => {
    if (typeof window === "undefined") return true;
    return getDataforseoApiEnabled();
  });

  React.useEffect(() => {
    setEnabled(getDataforseoApiEnabled());
  }, []);

  React.useEffect(() => {
    function handleStorage(e: StorageEvent) {
      if (e.key === DATAFORSEO_PREF_KEY && e.newValue !== null) {
        setEnabled(e.newValue === "1" || e.newValue === "true");
      }
    }
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const setter = React.useCallback((value: boolean) => {
    setDataforseoApiEnabled(value);
    setEnabled(value);
  }, []);

  const value = React.useMemo(
    () => ({ dataforseoApiEnabled: enabled, setDataforseoApiEnabled: setter }),
    [enabled, setter]
  );

  return (
    <DataforseoPreferenceContext.Provider value={value}>
      {children}
    </DataforseoPreferenceContext.Provider>
  );
}

export function useDataforseoPreference() {
  const ctx = React.useContext(DataforseoPreferenceContext);
  if (!ctx) {
    return {
      dataforseoApiEnabled: true,
      setDataforseoApiEnabled: () => {},
    };
  }
  return ctx;
}

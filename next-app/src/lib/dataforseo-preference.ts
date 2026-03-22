/** localStorage key for DataForSEO API enabled preference. */
export const DATAFORSEO_PREF_KEY = "crawlit-dataforseo-api-enabled";

/** Returns true if DataForSEO API requests are enabled. Default true. */
export function getDataforseoApiEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const v = localStorage.getItem(DATAFORSEO_PREF_KEY);
    if (v === null) return true;
    return v === "1" || v === "true";
  } catch {
    return true;
  }
}

export function setDataforseoApiEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DATAFORSEO_PREF_KEY, enabled ? "1" : "0");
  } catch {
    // ignore
  }
}

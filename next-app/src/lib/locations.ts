/**
 * DataForSEO/Google Ads location codes (country-level) for keyword and ranking data.
 * Used when creating a project so the API returns country-specific volumes and metrics.
 * @see https://docs.dataforseo.com/v3/keywords-data-se-locations/
 */
export const COUNTRY_LOCATIONS: { locationCode: number; locationName: string; countryIso: string }[] = [
  { locationCode: 2840, locationName: "United States", countryIso: "US" },
  { locationCode: 1023192, locationName: "Puerto Rico", countryIso: "PR" },
  { locationCode: 2826, locationName: "United Kingdom", countryIso: "GB" },
  { locationCode: 2124, locationName: "Canada", countryIso: "CA" },
  { locationCode: 2036, locationName: "Australia", countryIso: "AU" },
  { locationCode: 2752, locationName: "Mexico", countryIso: "MX" },
  { locationCode: 2724, locationName: "Spain", countryIso: "ES" },
  { locationCode: 2276, locationName: "Germany", countryIso: "DE" },
  { locationCode: 2250, locationName: "France", countryIso: "FR" },
  { locationCode: 2380, locationName: "Italy", countryIso: "IT" },
  { locationCode: 2528, locationName: "Netherlands", countryIso: "NL" },
  { locationCode: 2076, locationName: "Brazil", countryIso: "BR" },
  { locationCode: 2256, locationName: "India", countryIso: "IN" },
  { locationCode: 2392, locationName: "Japan", countryIso: "JP" },
  { locationCode: 2156, locationName: "Indonesia", countryIso: "ID" },
  { locationCode: 2032, locationName: "Argentina", countryIso: "AR" },
  { locationCode: 2170, locationName: "Colombia", countryIso: "CO" },
  { locationCode: 2152, locationName: "Chile", countryIso: "CL" },
  { locationCode: 2604, locationName: "Peru", countryIso: "PE" },
  { locationCode: 2004, locationName: "Austria", countryIso: "AT" },
  { locationCode: 2056, locationName: "Belgium", countryIso: "BE" },
  { locationCode: 2756, locationName: "Portugal", countryIso: "PT" },
  { locationCode: 616, locationName: "Poland", countryIso: "PL" },
  { locationCode: 752, locationName: "Sweden", countryIso: "SE" },
  { locationCode: 792, locationName: "Turkey", countryIso: "TR" },
  { locationCode: 410, locationName: "South Korea", countryIso: "KR" },
];

/** Default location when none is set (United States). */
export const DEFAULT_LOCATION_CODE = 2840;

/** Returns a flag emoji for a given ISO 3166-1 alpha-2 country code (e.g. "US" -> 🇺🇸). */
export function getCountryFlagEmoji(iso: string): string {
  const code = iso.toUpperCase();
  if (code.length !== 2) return "";
  return code
    .split("")
    .map((c) => String.fromCodePoint(0x1f1e6 - 65 + c.charCodeAt(0)))
    .join("");
}

export type Project = {
  id: string;
  domain: string;
  name: string;
  /** DataForSEO location_code for country (e.g. 2840 = United States). Used for volumes and rankings. */
  locationCode?: number;
  /** Display name for the selected country (e.g. "United States"). */
  locationName?: string;
  /** GA4 property id (numbers only) selected for this project. */
  ga4PropertyId?: string;
  /** Optional GA4 property display name. */
  ga4PropertyName?: string;
  createdAt: string;
};

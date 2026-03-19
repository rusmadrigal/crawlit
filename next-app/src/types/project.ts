/** Note attached to a date on the Performance chart. Content is HTML (rich text). */
export type PerformanceNote = {
  id: string;
  /** Date in YYYY-MM-DD (or YYYY-MM-01 for month-only). */
  date: string;
  /** Rich text content (HTML). */
  content: string;
  /** Optional resource link URL. */
  resourceUrl?: string;
  createdAt?: string;
};

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
  /** Notes on the Performance chart by date. */
  performanceNotes?: PerformanceNote[];
  createdAt: string;
};

export type Intent = "Informational" | "Commercial" | "Transactional";

export interface KeywordRow {
  id: string;
  keyword: string;
  volume: number;
  kd: number;
  cpc: number;
  intent: Intent;
  trend: number[];
}

export interface SerpResult {
  position: number;
  url: string;
  title: string;
  domain: string;
}

const intents: Intent[] = ["Informational", "Commercial", "Transactional"];

function randomIntent(): Intent {
  return intents[Math.floor(Math.random() * intents.length)];
}

function randomTrend(length: number): number[] {
  let base = 50 + Math.random() * 50;
  return Array.from({ length }, () => {
    base = Math.max(20, Math.min(100, base + (Math.random() - 0.5) * 30));
    return Math.round(base);
  });
}

export const MOCK_KEYWORDS: KeywordRow[] = [
  { id: "1", keyword: "best running shoes 2024", volume: 33100, kd: 42, cpc: 2.85, intent: "Commercial", trend: randomTrend(12) },
  { id: "2", keyword: "how to start a blog", volume: 40500, kd: 18, cpc: 1.20, intent: "Informational", trend: randomTrend(12) },
  { id: "3", keyword: "buy iphone 15 pro", volume: 82300, kd: 78, cpc: 8.50, intent: "Transactional", trend: randomTrend(12) },
  { id: "4", keyword: "seo tools comparison", volume: 12100, kd: 55, cpc: 12.30, intent: "Commercial", trend: randomTrend(12) },
  { id: "5", keyword: "what is keyword research", volume: 6600, kd: 12, cpc: 0.95, intent: "Informational", trend: randomTrend(12) },
  { id: "6", keyword: "best crm software", volume: 27100, kd: 62, cpc: 15.80, intent: "Commercial", trend: randomTrend(12) },
  { id: "7", keyword: "order food delivery near me", volume: 49500, kd: 35, cpc: 3.20, intent: "Transactional", trend: randomTrend(12) },
  { id: "8", keyword: "content marketing strategy", volume: 22200, kd: 48, cpc: 4.10, intent: "Informational", trend: randomTrend(12) },
  { id: "9", keyword: "cheap flight tickets", volume: 135000, kd: 88, cpc: 6.75, intent: "Transactional", trend: randomTrend(12) },
  { id: "10", keyword: "backlink building techniques", volume: 2900, kd: 38, cpc: 5.40, intent: "Informational", trend: randomTrend(12) },
  { id: "11", keyword: "saaS pricing models", volume: 4800, kd: 28, cpc: 18.20, intent: "Commercial", trend: randomTrend(12) },
  { id: "12", keyword: "sign up for netflix", volume: 74000, kd: 72, cpc: 2.10, intent: "Transactional", trend: randomTrend(12) },
  { id: "13", keyword: "how does google rank websites", volume: 3600, kd: 22, cpc: 1.85, intent: "Informational", trend: randomTrend(12) },
  { id: "14", keyword: "best project management tools", volume: 20100, kd: 58, cpc: 11.50, intent: "Commercial", trend: randomTrend(12) },
  { id: "15", keyword: "book hotel online", volume: 67300, kd: 82, cpc: 4.90, intent: "Transactional", trend: randomTrend(12) },
];

export const MOCK_SERP: Record<string, SerpResult[]> = {
  "1": [
    { position: 1, url: "https://example.com/running-shoes-2024", title: "Best Running Shoes 2024 - Top Picks Reviewed", domain: "example.com" },
    { position: 2, url: "https://runnerworld.com/best-shoes", title: "The 15 Best Running Shoes of 2024", domain: "runnerworld.com" },
    { position: 3, url: "https://gears.com/running/best", title: "Best Running Shoes for Every Type of Runner", domain: "gears.com" },
    { position: 4, url: "https://nike.com/running-shoes", title: "Running Shoes - Nike.com", domain: "nike.com" },
    { position: 5, url: "https://amazon.com/best-running-shoes", title: "Amazon.com: Best Running Shoes 2024", domain: "amazon.com" },
  ],
};

export function getSerpForKeyword(keywordId: string): SerpResult[] {
  return (
    MOCK_SERP[keywordId] ??
    Array.from({ length: 5 }, (_, i) => ({
      position: i + 1,
      url: `https://example-${keywordId}.com/result-${i + 1}`,
      title: `Top result ${i + 1} for keyword`,
      domain: `example-${keywordId}.com`,
    }))
  );
}

export const COUNTRIES = [
  { value: "us", label: "United States" },
  { value: "uk", label: "United Kingdom" },
  { value: "de", label: "Germany" },
  { value: "fr", label: "France" },
  { value: "es", label: "Spain" },
  { value: "mx", label: "Mexico" },
  { value: "br", label: "Brazil" },
];

export const DEVICES = [
  { value: "desktop", label: "Desktop" },
  { value: "mobile", label: "Mobile" },
];

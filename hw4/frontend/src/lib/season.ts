/**
 * What the home page leads with right now: a campaign picked from the Yale calendar,
 * the countdown to The Game, and today's New Haven weather.
 * `?season=<key>` in the URL previews any campaign.
 */

export type CampaignKey = "fall" | "gameweek" | "holiday" | "winter" | "spring" | "commencement" | "summer" | "movein";

export interface Campaign {
  key: CampaignKey;
  eyebrow: string;
  title: [string, string];
  lede: string;
  cta: { label: string; to: string };
  secondary: { label: string; to: string };
  spotlight: string[];
  ambient: "leaves" | "snow" | null;
}

const FALL_PICKS = [
  "champion-reverse-weave-hoodie-1",
  "district-vit-crewneck-vintage-bulldog",
  "poly-twill-crewneck-arched-yale",
  "brooks-brothers-bomber-jacket-yale",
  "the-forest-school-hoodie",
  "champion-reverse-weave-crewneck",
];

export function campaignFor(now: Date, override?: string | null): Campaign {
  const year = now.getFullYear();
  const game = theGameDate(year);
  const daysToGame = Math.ceil((game.getTime() - now.getTime()) / 86_400_000);
  const m = now.getMonth();
  const d = now.getDate();

  let key: CampaignKey;
  if (daysToGame >= 0 && daysToGame <= 7) key = "gameweek";
  else if (m >= 8 && m <= 10) key = "fall";
  else if (m === 11 && d <= 24) key = "holiday";
  else if (m === 11 || m <= 1) key = "winter";
  else if (m <= 3) key = "spring";
  else if (m === 4) key = "commencement";
  else if (m <= 6) key = "summer";
  else key = "movein";

  if (override && override in CAMPAIGNS) key = override as CampaignKey;
  return CAMPAIGNS[key](year);
}

const CAMPAIGNS: Record<CampaignKey, (year: number) => Campaign> = {
  fall: (year) => ({
    key: "fall",
    eyebrow: `Fall ${year} · New Haven`,
    title: ["Sweater weather", "is back."],
    lede: "The elms on Old Campus are turning and the mornings are crisp. Heavyweight hoodies, heritage crewnecks, and our warmest fleece are in — printed on Broadway since 1975.",
    cta: { label: "Shop fall layers", to: "/products?category=Hoodies" },
    secondary: { label: "Game day gear", to: "/products?q=football" },
    spotlight: FALL_PICKS,
    ambient: "leaves",
  }),
  gameweek: () => ({
    key: "gameweek",
    eyebrow: "Game week · Yale vs. Harvard",
    title: ["Beat Harvard.", "Wear it loud."],
    lede: "The Game is days away. Suit up in Bulldog Blue for the tailgate — rivalry-ready tees, game day hoods, and layers for a cold November kickoff.",
    cta: { label: "Shop game day", to: "/products?q=football" },
    secondary: { label: "Warm layers", to: "/products?category=Jackets%20%26%20Fleece" },
    spotlight: [
      "ua-gameday-double-knit-hood",
      "champion-reverse-weave-hoodie-1",
      "yale-bowl-t-shirt",
      "football-left-chest-t-shirt",
      "brooks-brothers-bomber-jacket-yale",
      "basic-hoodie-big-yale",
    ],
    ambient: "leaves",
  }),
  holiday: () => ({
    key: "holiday",
    eyebrow: "The holiday edit",
    title: ["Gift the", "Bulldog Blue."],
    lede: "For the Yalie who has everything except enough Yale. Premium labels, family pieces for Mom and Dad, and cozy fleece — wrapped up in New Haven.",
    cta: { label: "Shop gifts", to: "/products?sort=price_desc" },
    secondary: { label: "For the family", to: "/products?q=yale%20mom" },
    spotlight: [
      "brooks-brothers-double-knit-full-zip-hoodie-yale",
      "brooks-brothers-bomber-jacket-yale",
      "yale-maplehouse-diana-mockneck",
      "yale-mom-crewneck",
      "champion-full-zip-hood",
      "yale-dad-hoodie",
    ],
    ambient: "snow",
  }),
  winter: () => ({
    key: "winter",
    eyebrow: "Winter in New Haven",
    title: ["Bundle up,", "Bulldogs."],
    lede: "Cross Old Campus in January and you learn fast: layers win. Full-zips, fleece jackets, and our heaviest crewnecks keep the cold on the outside.",
    cta: { label: "Shop warm layers", to: "/products?category=Jackets%20%26%20Fleece" },
    secondary: { label: "Quarter-zips", to: "/products?category=Quarter-Zips" },
    spotlight: [
      "brooks-brothers-bomber-jacket-yale",
      "champion-full-zip-hood",
      "saybrook-sweater-fleece-jacket",
      "super-heavyweight-crewneck-arched-yale-crest",
      "brooks-brothers-double-knit-full-zip-hoodie-yale",
      "champion-reverse-weave-hoodie-1",
    ],
    ambient: "snow",
  }),
  spring: () => ({
    key: "spring",
    eyebrow: "Spring on Old Campus",
    title: ["Lighter layers,", "brighter days."],
    lede: "Magnolias on Cross Campus and the first afternoon on the lawn. Quarter-zips, mocknecks, and heritage tees for the in-between season.",
    cta: { label: "Shop spring", to: "/products?category=Quarter-Zips" },
    secondary: { label: "Tees & tops", to: "/products?category=Tees%20%26%20Tops" },
    spotlight: [
      "yale-maplehouse-diana-mockneck",
      "poly-twill-crewneck-arched-yale",
      "big-yale-tri-blend-t-shirt",
      "yale-law-school-1-4-zip",
      "t-felt-y-heavyweight",
      "champion-reverse-weave-crewneck",
    ],
    ambient: null,
  }),
  commencement: (year) => ({
    key: "commencement",
    eyebrow: `Commencement ${year}`,
    title: ["Congratulations,", "graduates."],
    lede: "Four bright college years deserve a souvenir. School crests for the graduate, and proud-family pieces for everyone cheering on Old Campus.",
    cta: { label: "Shop graduation", to: "/products?q=school" },
    secondary: { label: "Proud family", to: "/products?q=yale%20mom" },
    spotlight: [
      "super-heavyweight-crewneck-arched-yale-crest",
      "yale-law-school-1-4-zip",
      "yale-mom-crewneck",
      "school-of-management-crest-t-shirt",
      "champion-reverse-weave-hoodie-1",
      "yale-dad-hoodie",
    ],
    ambient: null,
  }),
  summer: () => ({
    key: "summer",
    eyebrow: "Summer in New Haven",
    title: ["Tee weather,", "Yale style."],
    lede: "Soft tri-blends and heritage tees for pizza on Wooster Street, a walk up East Rock, or a campus visit with the family.",
    cta: { label: "Shop tees", to: "/products?category=Tees%20%26%20Tops" },
    secondary: { label: "All classics", to: "/products" },
    spotlight: [
      "big-yale-tri-blend-t-shirt",
      "t-felt-y-heavyweight",
      "boola-boola-t-shirt",
      "yale-bowl-t-shirt",
      "district-tri-blend-t-shirt-vintage-shield",
      "poly-twill-crewneck-arched-yale",
    ],
    ambient: null,
  }),
  movein: (year) => ({
    key: "movein",
    eyebrow: `Move-in ${year}`,
    title: ["Welcome to", "New Haven."],
    lede: "New room, new friends, new hoodie. Everything a first-year needs to look like they have always belonged here — and a little something for the parents.",
    cta: { label: "Shop the essentials", to: "/products" },
    secondary: { label: "Your college", to: "/products?q=college" },
    spotlight: [
      "basic-hoodie-big-yale",
      "champion-reverse-weave-crewneck",
      "district-vit-crewneck-vintage-bulldog",
      "t-felt-y-heavyweight",
      "yale-mom-crewneck",
      "the-forest-school-hoodie",
    ],
    ambient: null,
  }),
};

/** The Game is played the Saturday before Thanksgiving (the fourth Thursday of November). */
export function theGameDate(year: number): Date {
  const firstOfNov = new Date(year, 10, 1).getDay();
  const firstThursday = 1 + ((4 - firstOfNov + 7) % 7);
  const thanksgiving = firstThursday + 21;
  return new Date(year, 10, thanksgiving - 5, 12, 0, 0);
}

/** The next Game that has not been played yet (its day still counts until midnight). */
export function nextGame(now: Date): Date {
  const thisYear = theGameDate(now.getFullYear());
  const endOfGameDay = new Date(thisYear);
  endOfGameDay.setHours(23, 59, 59);
  return now <= endOfGameDay ? thisYear : theGameDate(now.getFullYear() + 1);
}

/* ------------------------------------------------------------------ Weather */

export interface Weather {
  tempF: number;
  condition: string;
  live: boolean;
}

export type WeatherBand = "cold" | "cool" | "mild" | "warm";

/** Typical New Haven daytime highs (°F) by month, used when the live forecast is unavailable. */
const TYPICAL_F = [37, 40, 48, 60, 70, 79, 84, 82, 75, 64, 53, 42];

const WEATHER_KEY = "cc-weather";
const WEATHER_TTL = 30 * 60 * 1000;

function describe(code: number): string {
  if (code === 0) return "Clear skies";
  if (code <= 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code <= 48) return "Foggy";
  if (code <= 57) return "Drizzle";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Showers";
  if (code <= 86) return "Snow showers";
  return "Thunderstorms";
}

export function typicalWeather(now: Date): Weather {
  return { tempF: TYPICAL_F[now.getMonth()], condition: "", live: false };
}

export async function loadWeather(now: Date): Promise<Weather> {
  try {
    const cached = JSON.parse(sessionStorage.getItem(WEATHER_KEY) ?? "null") as (Weather & { at: number }) | null;
    if (cached && Date.now() - cached.at < WEATHER_TTL) return cached;
  } catch {
    /* ignore a corrupt cache */
  }
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=41.3083&longitude=-72.9279&current=temperature_2m,weather_code&temperature_unit=fahrenheit&timezone=America%2FNew_York",
      { signal: ctrl.signal },
    );
    clearTimeout(timer);
    if (!res.ok) throw new Error(String(res.status));
    const data = (await res.json()) as { current?: { temperature_2m?: number; weather_code?: number } };
    const t = data.current?.temperature_2m;
    if (typeof t !== "number") throw new Error("no temperature");
    const weather: Weather = { tempF: Math.round(t), condition: describe(data.current?.weather_code ?? 1), live: true };
    sessionStorage.setItem(WEATHER_KEY, JSON.stringify({ ...weather, at: Date.now() }));
    return weather;
  } catch {
    return typicalWeather(now);
  }
}

export function bandFor(tempF: number): WeatherBand {
  if (tempF <= 45) return "cold";
  if (tempF <= 60) return "cool";
  if (tempF <= 72) return "mild";
  return "warm";
}

export interface WeatherEdit {
  label: string;
  tip: string;
  ids: string[];
  shop: { label: string; to: string };
}

export const WEATHER_EDITS: Record<WeatherBand, WeatherEdit> = {
  cold: {
    label: "Coat weather",
    tip: "Below 45° the wind off the Sound bites. Start with a fleece or a lined jacket and layer a crewneck underneath.",
    ids: [
      "brooks-brothers-bomber-jacket-yale",
      "champion-full-zip-hood",
      "saybrook-sweater-fleece-jacket",
      "brooks-brothers-double-knit-full-zip-hoodie-yale",
    ],
    shop: { label: "Shop jackets & fleece", to: "/products?category=Jackets%20%26%20Fleece" },
  },
  cool: {
    label: "Hoodie weather",
    tip: "Crisp morning, mild afternoon. A heavyweight hoodie or a quarter-zip is the whole outfit — no coat required.",
    ids: [
      "champion-reverse-weave-hoodie-1",
      "yale-law-school-1-4-zip",
      "district-vit-hoodie-vintage-bulldog",
      "super-heavyweight-crewneck-arched-yale-crest",
    ],
    shop: { label: "Shop hoodies", to: "/products?category=Hoodies" },
  },
  mild: {
    label: "Crewneck weather",
    tip: "Too warm for a hood, too cool for a tee. A classic crewneck or a light long-sleeve is exactly right.",
    ids: [
      "champion-reverse-weave-crewneck",
      "poly-twill-crewneck-arched-yale",
      "yale-maplehouse-diana-mockneck",
      "ua-mens-tech-l-s-2-0",
    ],
    shop: { label: "Shop crewnecks", to: "/products?category=Crewnecks" },
  },
  warm: {
    label: "Tee weather",
    tip: "Sun on Cross Campus. Soft tri-blend and heritage tees keep it cool and still unmistakably Yale.",
    ids: ["big-yale-tri-blend-t-shirt", "t-felt-y-heavyweight", "boola-boola-t-shirt", "yale-bowl-t-shirt"],
    shop: { label: "Shop tees", to: "/products?category=Tees%20%26%20Tops" },
  },
};

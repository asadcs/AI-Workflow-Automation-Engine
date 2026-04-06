import { schedules } from "@trigger.dev/sdk";

// US cities to rotate through when searching for dental leads
const CITIES = [
  "New York, NY",
  "Los Angeles, CA",
  "Chicago, IL",
  "Houston, TX",
  "Phoenix, AZ",
  "Philadelphia, PA",
  "San Antonio, TX",
  "San Diego, CA",
  "Dallas, TX",
  "Jacksonville, FL",
  "Austin, TX",
  "Columbus, OH",
  "Charlotte, NC",
  "Indianapolis, IN",
  "Denver, CO",
  "Memphis, TN",
  "Louisville, KY",
  "Baltimore, MD",
  "Milwaukee, WI",
  "Albuquerque, NM",
];

interface SerpApiResult {
  place_id: string;
  title: string;
  address?: string;
  phone?: string;
  rating?: number;
  reviews?: number;
  website?: string;
  serpapi_place_link?: string;
}

interface SerpApiResponse {
  local_results?: SerpApiResult[];
}

async function searchDentistsInCity(
  city: string,
  serpApiKey: string
): Promise<SerpApiResult[]> {
  const params = new URLSearchParams({
    engine: "google_maps",
    q: "dental practice",
    location: city,
    type: "search",
    z: "14",
    api_key: serpApiKey,
  });

  const response = await fetch(`https://serpapi.com/search.json?${params}`);
  if (!response.ok) {
    console.error(`SerpAPI error for ${city}: ${response.status} ${response.statusText}`);
    return [];
  }

  const data = (await response.json()) as SerpApiResponse;
  return data.local_results ?? [];
}

async function createClickUpTask(
  listId: string,
  token: string,
  lead: SerpApiResult,
  city: string
): Promise<void> {
  const website = lead.website ?? "No website found";
  const address = lead.address ?? "Address not available";
  const phone = lead.phone ?? "Phone not available";
  const rating = lead.rating != null ? `${lead.rating}` : "N/A";
  const reviews = lead.reviews != null ? `${lead.reviews} reviews` : "N/A";
  const yelpLink = lead.serpapi_place_link ?? "N/A";

  const description =
    `📍 Address: ${address}\n` +
    `📞 Phone: ${phone}\n` +
    `⭐ Rating: ${rating} (${reviews})\n` +
    `🌐 Website: ${website}\n` +
    `🔗 Google Maps: ${yelpLink}`;

  const body = {
    name: `${lead.title} — ${city}`,
    description,
    status: "to do",
  };

  const response = await fetch(
    `https://api.clickup.com/api/v2/list/${listId}/task`,
    {
      method: "POST",
      headers: {
        Authorization: token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`ClickUp task creation failed for "${lead.title}": ${err}`);
  }
}

export const findDentalLeads = schedules.task({
  id: "find-dental-leads",
  cron: "0 9 * * 1", // Every Monday at 9am UTC

  run: async () => {
    const serpApiKey = process.env.SERPAPI_API_KEY;
    if (!serpApiKey) throw new Error("SERPAPI_API_KEY is not set");

    const clickUpToken = process.env.CLICKUP_API_TOKEN;
    if (!clickUpToken) throw new Error("CLICKUP_API_TOKEN is not set");

    const clickUpListId = process.env.CLICKUP_LIST_ID;
    if (!clickUpListId) throw new Error("CLICKUP_LIST_ID is not set");

    const TARGET_LEADS = 25;
    const leads: Array<{ result: SerpApiResult; city: string }> = [];

    console.log(`Searching for dental leads across US cities...`);

    for (const city of CITIES) {
      if (leads.length >= TARGET_LEADS) break;

      console.log(`Searching in ${city}...`);
      const results = await searchDentistsInCity(city, serpApiKey);

      for (const result of results) {
        if (leads.length >= TARGET_LEADS) break;

        // Target small/new practices with low review counts — prime candidates for a new website
        const reviewCount = result.reviews ?? 0;
        if (reviewCount < 20) {
          leads.push({ result, city });
        }
      }

      // Small delay between API calls to be a good citizen
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    console.log(`Found ${leads.length} qualifying leads. Creating ClickUp tasks...`);

    let posted = 0;
    for (const { result, city } of leads) {
      await createClickUpTask(clickUpListId, clickUpToken, result, city);
      console.log(`Created task: ${result.title} — ${city}`);
      posted++;
    }

    console.log(`Done. Posted ${posted} leads to ClickUp.`);
    return { leadsPosted: posted };
  },
});

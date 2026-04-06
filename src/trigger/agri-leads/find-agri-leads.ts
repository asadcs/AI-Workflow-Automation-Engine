import { schedules } from "@trigger.dev/sdk";

// ─── Search definitions ────────────────────────────────────────────────────

interface SearchDef {
  query: string;
  location: string;
  country: string;
  category: "Direct" | "Indirect";
  type: string;
}

const SEARCHES: SearchDef[] = [
  // Direct — farmers, vineyards, crop producers
  { query: "vineyard quinta",          location: "Elvas, Portugal",      country: "Portugal", category: "Direct",   type: "Vineyard" },
  { query: "vineyard quinta",          location: "Évora, Portugal",      country: "Portugal", category: "Direct",   type: "Vineyard" },
  { query: "vineyard quinta",          location: "Beja, Portugal",       country: "Portugal", category: "Direct",   type: "Vineyard" },
  { query: "vineyard quinta",          location: "Badajoz, Spain",       country: "Spain",    category: "Direct",   type: "Vineyard" },
  { query: "herdade agrícola",         location: "Portalegre, Portugal", country: "Portugal", category: "Direct",   type: "Farm / Herdade" },
  { query: "herdade agrícola",         location: "Évora, Portugal",      country: "Portugal", category: "Direct",   type: "Farm / Herdade" },
  { query: "farm crop production",     location: "Elvas, Portugal",      country: "Portugal", category: "Direct",   type: "Crop Farm" },
  { query: "farm crop production",     location: "Badajoz, Spain",       country: "Spain",    category: "Direct",   type: "Crop Farm" },
  { query: "farm crop production",     location: "Cáceres, Spain",       country: "Spain",    category: "Direct",   type: "Crop Farm" },

  // Indirect — cooperatives, consultants, agri-tech, suppliers, associations
  { query: "cooperativa agrícola",           location: "Elvas, Portugal",       country: "Portugal", category: "Indirect", type: "Agricultural Cooperative" },
  { query: "cooperativa agrícola",           location: "Évora, Portugal",       country: "Portugal", category: "Indirect", type: "Agricultural Cooperative" },
  { query: "cooperativa agrícola",           location: "Portalegre, Portugal",  country: "Portugal", category: "Indirect", type: "Agricultural Cooperative" },
  { query: "cooperativa agrícola",           location: "Badajoz, Spain",        country: "Spain",    category: "Indirect", type: "Agricultural Cooperative" },
  { query: "agronomist consultant",          location: "Évora, Portugal",       country: "Portugal", category: "Indirect", type: "Agronomy Consultant" },
  { query: "agronomist consultant",          location: "Extremadura, Spain",    country: "Spain",    category: "Indirect", type: "Agronomy Consultant" },
  { query: "agri-tech company",             location: "Lisbon, Portugal",       country: "Portugal", category: "Indirect", type: "Agri-Tech Company" },
  { query: "agri-tech company",             location: "Madrid, Spain",          country: "Spain",    category: "Indirect", type: "Agri-Tech Company" },
  { query: "agri-tech company",             location: "Seville, Spain",         country: "Spain",    category: "Indirect", type: "Agri-Tech Company" },
  { query: "pesticide supplier agriculture", location: "Portugal",              country: "Portugal", category: "Indirect", type: "Pesticide / Agrochemical Supplier" },
  { query: "pesticide supplier agriculture", location: "Spain",                 country: "Spain",    category: "Indirect", type: "Pesticide / Agrochemical Supplier" },
  { query: "agricultural association",       location: "Alentejo, Portugal",    country: "Portugal", category: "Indirect", type: "Farming Association" },
  { query: "agricultural association",       location: "Extremadura, Spain",    country: "Spain",    category: "Indirect", type: "Farming Association" },
];

// ─── Types ─────────────────────────────────────────────────────────────────

interface SerpResult {
  place_id?: string;
  title: string;
  address?: string;
  phone?: string;
  rating?: number;
  reviews?: number;
  website?: string;
  serpapi_place_link?: string;
}

interface SerpResponse {
  local_results?: SerpResult[];
  error?: string;
}

interface ScrapedContact {
  email: string;
  facebook: string;
  instagram: string;
  linkedin: string;
}

interface Lead {
  name: string;
  type: string;
  country: string;
  location: string;
  website: string;
  phone: string;
  email: string;
  facebook: string;
  instagram: string;
  linkedin: string;
  rating: string;
  reviews: string;
  mapsLink: string;
  category: "Direct" | "Indirect";
  whyRelevant: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function buildWhyRelevant(result: SerpResult, search: SearchDef): string {
  const website = result.website ? "has a website" : "no website found";
  const size = result.reviews != null
    ? result.reviews < 20 ? "small operation" : result.reviews < 100 ? "mid-sized operation" : "established operation"
    : "size unknown";
  return (
    `${search.type} in ${search.location} — ${website}, ${size}. ` +
    `Identified via "${search.query}" search. ` +
    `Potential iCount Pest ${search.category === "Direct" ? "customer (pest monitoring)" : "partner (distribution/promotion)"}.`
  );
}

/** Scrape email, Facebook, Instagram, LinkedIn from a business website */
async function scrapeContactInfo(websiteUrl: string): Promise<ScrapedContact> {
  const empty: ScrapedContact = { email: "Not found", facebook: "Not found", instagram: "Not found", linkedin: "Not found" };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(websiteUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; LeadBot/1.0)" },
    });
    clearTimeout(timeout);

    if (!res.ok) return empty;

    const html = await res.text();

    // Email — mailto: links or bare addresses
    const emailMatch = html.match(/mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/i)
      ?? html.match(/\b([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})\b/);
    const email = emailMatch ? emailMatch[1] : "Not found";

    // Facebook
    const fbMatch = html.match(/https?:\/\/(?:www\.)?facebook\.com\/[A-Za-z0-9._%-]+/i);
    const facebook = fbMatch ? fbMatch[0].split('"')[0] : "Not found";

    // Instagram
    const igMatch = html.match(/https?:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9._%-]+/i);
    const instagram = igMatch ? igMatch[0].split('"')[0] : "Not found";

    // LinkedIn
    const liMatch = html.match(/https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[A-Za-z0-9._%-]+/i);
    const linkedin = liMatch ? liMatch[0].split('"')[0] : "Not found";

    return { email, facebook, instagram, linkedin };
  } catch {
    return empty;
  }
}

/** Search LinkedIn via SerpAPI Google search */
async function searchLinkedIn(businessName: string, serpApiKey: string): Promise<string> {
  try {
    const params = new URLSearchParams({
      engine: "google",
      q: `site:linkedin.com/company "${businessName}"`,
      num: "1",
      api_key: serpApiKey,
    });

    const res = await fetch(`https://serpapi.com/search.json?${params}`);
    if (!res.ok) return "Not found";

    const data = await res.json() as { organic_results?: { link: string }[] };
    const first = data.organic_results?.[0]?.link;
    return first?.includes("linkedin.com") ? first : "Not found";
  } catch {
    return "Not found";
  }
}

async function searchMaps(search: SearchDef, serpApiKey: string): Promise<SerpResult[]> {
  const params = new URLSearchParams({
    engine: "google_maps",
    q: search.query,
    location: search.location,
    type: "search",
    z: "12",
    api_key: serpApiKey,
  });

  const response = await fetch(`https://serpapi.com/search.json?${params}`);
  if (!response.ok) {
    console.log(`SerpAPI maps error [${search.query} / ${search.location}]: ${response.status}`);
    return [];
  }

  const data = (await response.json()) as SerpResponse;
  if (data.error) {
    console.log(`SerpAPI maps error [${search.query} / ${search.location}]: ${data.error}`);
    return [];
  }

  return data.local_results ?? [];
}

async function postToClickUp(listId: string, token: string, lead: Lead): Promise<void> {
  const description =
    `🌍 Country: ${lead.country}\n` +
    `🏷️ Type: ${lead.type}\n` +
    `📍 Location: ${lead.location}\n` +
    `⭐ Rating: ${lead.rating} (${lead.reviews} reviews)\n` +
    `🌐 Website: ${lead.website}\n` +
    `📧 Email: ${lead.email}\n` +
    `📞 Phone: ${lead.phone}\n` +
    `💼 LinkedIn: ${lead.linkedin}\n` +
    `👥 Facebook: ${lead.facebook}\n` +
    `📸 Instagram: ${lead.instagram}\n` +
    `🔗 Google Maps: ${lead.mapsLink}\n` +
    `📝 Why relevant: ${lead.whyRelevant}\n` +
    `🏷️ Category: ${lead.category}`;

  const body = {
    name: `[${lead.category}] ${lead.name} — ${lead.location}`,
    description,
    status: "to do",
    tags: ["enriched"],
  };

  const response = await fetch(`https://api.clickup.com/api/v2/list/${listId}/task`, {
    method: "POST",
    headers: { Authorization: token, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`ClickUp error for "${lead.name}": ${err}`);
  }
}

// ─── Main Task ─────────────────────────────────────────────────────────────

export const findAgriLeads = schedules.task({
  id: "find-agri-leads",
  cron: "0 9 * * 2", // Every Tuesday at 9am UTC

  run: async () => {
    const serpApiKey = process.env.SERPAPI_API_KEY;
    if (!serpApiKey) throw new Error("SERPAPI_API_KEY is not set");

    const clickUpToken = process.env.CLICKUP_API_TOKEN;
    if (!clickUpToken) throw new Error("CLICKUP_API_TOKEN is not set");

    const clickUpListId = process.env.CLICKUP_AGRI_LIST_ID;
    if (!clickUpListId) throw new Error("CLICKUP_AGRI_LIST_ID is not set");

    const seen = new Set<string>();
    const rawLeads: Array<{ result: SerpResult; search: SearchDef }> = [];

    console.log(`Starting iCount Pest lead search across ${SEARCHES.length} queries...`);

    // Phase 1 — collect all leads from Google Maps
    for (const search of SEARCHES) {
      console.log(`Searching: "${search.query}" in ${search.location} [${search.category}]`);
      const results = await searchMaps(search, serpApiKey);
      console.log(`  → ${results.length} results`);

      for (const result of results) {
        if (rawLeads.length >= 60) break; // cap per run to stay within time budget
        const dedupKey = `${result.title}|${result.address ?? search.location}`.toLowerCase();
        if (seen.has(dedupKey)) continue;
        seen.add(dedupKey);
        rawLeads.push({ result, search });
      }
      if (rawLeads.length >= 60) break;

      await new Promise((resolve) => setTimeout(resolve, 600));
    }

    console.log(`\nCollected ${rawLeads.length} unique leads. Enriching with contact info...`);

    // Phase 2 — enrich each lead with scraped email/social + LinkedIn search
    const leads: Lead[] = [];

    for (const { result, search } of rawLeads) {
      let scraped: ScrapedContact = { email: "Not found", facebook: "Not found", instagram: "Not found", linkedin: "Not found" };

      if (result.website) {
        console.log(`  Scraping ${result.website} for contacts...`);
        scraped = await scrapeContactInfo(result.website);
      }

      // Use LinkedIn from scrape if found, otherwise do a Google search for it
      let linkedin = scraped.linkedin;
      if (linkedin === "Not found") {
        linkedin = await searchLinkedIn(result.title, serpApiKey);
        await new Promise((resolve) => setTimeout(resolve, 400)); // rate limit
      }

      leads.push({
        name: result.title,
        type: search.type,
        country: search.country,
        location: result.address ?? search.location,
        website: result.website ?? "Not found",
        phone: result.phone ?? "Not found",
        email: scraped.email,
        facebook: scraped.facebook,
        instagram: scraped.instagram,
        linkedin,
        rating: result.rating != null ? String(result.rating) : "N/A",
        reviews: result.reviews != null ? String(result.reviews) : "N/A",
        mapsLink: result.serpapi_place_link ?? "Not available",
        category: search.category,
        whyRelevant: buildWhyRelevant(result, search),
      });
    }

    const directLeads = leads.filter((l) => l.category === "Direct");
    const indirectLeads = leads.filter((l) => l.category === "Indirect");

    console.log(`\nEnriched ${leads.length} leads (${directLeads.length} Direct, ${indirectLeads.length} Indirect)`);

    if (leads.length < 50) {
      console.log(`⚠️ Warning: Found only ${leads.length} leads (target: 50–60). Returning partial results.`);
    }

    console.log(`\nPosting to ClickUp...`);
    let posted = 0;

    for (const lead of leads) {
      try {
        await postToClickUp(clickUpListId, clickUpToken, lead);
        console.log(`✓ [${lead.category}] ${lead.name} — ${lead.country}`);
        posted++;
      } catch (err) {
        console.log(`⚠️ Skipped "${lead.name}": ${err instanceof Error ? err.message : err}`);
      }
    }

    console.log(`\nDone. Posted ${posted} leads to ClickUp "iCount Pest Leads".`);
    return { direct: directLeads.length, indirect: indirectLeads.length, total: posted };
  },
});

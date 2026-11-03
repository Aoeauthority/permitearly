// Supabase Edge Function: pull-permits
// Schedule: "0 11 * * *" (7 AM ET = 11 AM UTC)
// Fetches last 24h of Orlando building permits, tags trades, upserts to DB,
// then triggers send-digest for matching contractors.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SOCRATA_URL =
  "https://data.cityoforlando.net/resource/ryhf-m453.json";

// Orlando neighborhood → ZIP code lookup
// City of Orlando permits only cover the city limits; many 32819 addresses
// (Dr. Phillips, Bay Hill) are unincorporated Orange County and won't appear here.
const NEIGHBORHOOD_TO_ZIP: Record<string, string> = {
  "33rd St. Industrial": "32839",
  "Airport North": "32827",
  "Audubon Park": "32803",
  "Baldwin Park": "32814",
  "Bel Air": "32811",
  "Boggy Creek": "32824",
  "Bryn Mawr": "32808",
  "Callahan": "32808",
  "Carver Shores": "32808",
  "Catalina": "32807",
  "Central Business District": "32801",
  "Clear Lake": "32803",
  "College Park": "32804",
  "Colonial Town Center": "32803",
  "Colonialtown North": "32803",
  "Colonialtown South": "32803",
  "Coytown": "32811",
  "Crescent Park": "32806",
  "Delaney Park": "32806",
  "Dixie Belle": "32809",
  "Dover Estates": "32807",
  "Dover Manor": "32807",
  "Dover Shores East": "32807",
  "Dover Shores West": "32807",
  "East Park": "32832",
  "Engelwood Park": "32808",
  "Florida Center": "32819",
  "Florida Center North": "32819",
  "Holden Heights": "32839",
  "Holden/Parramore": "32805",
  "Johnson Village": "32808",
  "Kirkman North": "32811",
  "Kirkman South": "32811",
  "Lake Cherokee": "32801",
  "Lake Como": "32803",
  "Lake Davis/Greenwood": "32806",
  "Lake Eola Heights": "32801",
  "Lake Fairview": "32804",
  "Lake Formosa": "32804",
  "Lake Fredrica": "32812",
  "Lake Holden": "32839",
  "Lake Mann Gardens": "32839",
  "Lake Nona Central": "32827",
  "Lake Nona Estates": "32827",
  "Lake Nona South": "32827",
  "Lake Richmond": "32812",
  "Lake Terrace": "32804",
  "Lake Weldona": "32804",
  "Lake Whippoorwill": "32836",
  "Lancaster Park": "32806",
  "LaVina": "32811",
  "Lawsona/Fern Creek": "32803",
  "Lorna Doone": "32808",
  "Malibu Groves": "32809",
  "Mariners Village": "32809",
  "Mercy Drive": "32839",
  "Meridian Park": "32824",
  "Metro West": "32811",
  "Milk District": "32803",
  "Millenia": "32839",
  "Monterey": "32807",
  "North Orange": "32804",
  "North Quarter": "32801",
  "Northlake Park at Lake Nona": "32827",
  "Orlando Executive Airport": "32803",
  "ORLANDO INTERNATIONAL AIRPORT": "32827",
  "Orwin Manor": "32804",
  "Palomar": "32807",
  "Park Lake/Highland": "32803",
  "Pineloch": "32809",
  "Princeton/Silver Star": "32808",
  "Randal Park": "32832",
  "Richmond Estates": "32806",
  "Richmond Heights": "32806",
  "Rock Lake": "32803",
  "Rose Isle": "32804",
  "Rosemont": "32808",
  "Rosemont North": "32808",
  "Rowena Gardens": "32806",
  "Seaboard Industrial": "32808",
  "Signal Hill": "32811",
  "South Division": "32805",
  "South Eola": "32801",
  "South Orange": "32801",
  "South Semoran": "32822",
  "Southeastern Oaks": "32829",
  "Southern Oaks": "32809",
  "Southport": "32809",
  "Spring Lake": "32804",
  "Storey Park": "32824",
  "Sunbridge/ICP": "32832",
  "The Dovers": "32807",
  "The Willows": "32811",
  "Thornton Park": "32801",
  "Ventura": "32807",
  "Vista East": "32832",
  "Vista Park": "32832",
  "Wadeview Park": "32806",
  "Washington Shores": "32808",
  "Wedgewood Groves": "32808",
  "Westfield": "32804",
  "Windhover": "32811",
};

// Trade tagging rules — case-insensitive substring matching
const TRADE_RULES: Array<{ trade: string; keywords: string[] }> = [
  {
    trade: "fence",
    keywords: ["pool", "fence", "fencing", "enclosure"],
  },
  { trade: "pool", keywords: ["pool", "swimming"] },
  {
    trade: "landscaping",
    keywords: ["landscap", "irrigation", "sprinkler", "sod"],
  },
  { trade: "gutters", keywords: ["gutter", "downspout", "fascia"] },
  {
    trade: "hurricane_shutters",
    keywords: ["shutter", "impact window", "hurricane", "storm panel"],
  },
  {
    trade: "solar",
    keywords: ["solar", "photovoltaic", "pv"],
  },
  {
    trade: "hvac",
    keywords: ["hvac", "air condition", "ac", "mechanical", "ductwork"],
  },
  {
    trade: "pest_control",
    keywords: ["termite", "pest", "treatment", "fumigation"],
  },
  {
    trade: "roofing",
    keywords: ["roof", "shingle", "tile roof"],
  },
  { trade: "electrical", keywords: ["electrical"] },
  { trade: "plumbing", keywords: ["plumbing"] },
  {
    trade: "new_construction",
    keywords: ["new construction", "new home", "new single family"],
  },
];

interface SocrataPermit {
  permit_number?: string;
  permit_address?: string;
  neighborhood?: string;
  application_type?: string;
  worktype?: string;
  estimated_cost?: string;
  contractor_name?: string;
  contractor_phone_number?: string;
  issue_permit_date?: string;
  application_status?: string;
  geocoded_column?: { coordinates?: [number, number] };
  [key: string]: unknown;
}

function tagTrades(permit: SocrataPermit): string[] {
  const haystack =
    [permit.worktype ?? "", permit.application_type ?? ""]
      .join(" ")
      .toLowerCase();

  const tagged: string[] = [];
  for (const rule of TRADE_RULES) {
    if (rule.keywords.some((kw) => haystack.includes(kw.toLowerCase()))) {
      tagged.push(rule.trade);
    }
  }
  return tagged;
}

function extractZip(address: string | undefined, neighborhood: string | undefined): string | null {
  // Primary: look up ZIP from neighborhood name (most reliable for City of Orlando data)
  if (neighborhood) {
    const zip = NEIGHBORHOOD_TO_ZIP[neighborhood];
    if (zip) return zip;
  }
  // Fallback: try to extract a 5-digit ZIP embedded in the address string
  if (!address) return null;
  const m = address.match(/\b(\d{5})\b/g);
  // Only trust it if it looks like a real FL ZIP (3xxxx) not a street number
  const candidates = (m ?? []).filter((z) => z.startsWith("3"));
  return candidates.length > 0 ? candidates[candidates.length - 1] : null;
}

Deno.serve(async (req: Request) => {
  // Allow manual POST trigger or scheduled invocation
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // ── 1. Calculate yesterday's date ───────────────────────────
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0]; // YYYY-MM-DD

  // Use 7-day window so a single missed day doesn't silence all alerts
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0];

  const socrataWhere = encodeURIComponent(`issue_permit_date >= '${sevenDaysAgoStr}'`);
  const fetchUrl = `${SOCRATA_URL}?$where=${socrataWhere}&$limit=1000&$order=issue_permit_date%20DESC`;

  console.log(`Fetching permits issued since ${sevenDaysAgoStr} (url: ${fetchUrl})...`);
  const resp = await fetch(fetchUrl, {
    headers: { Accept: "application/json" },
  });

  if (!resp.ok) {
    const body = await resp.text();
    console.error("Socrata fetch error:", resp.status, body);
    return new Response(JSON.stringify({ error: "Socrata fetch failed", body }), {
      status: 502,
    });
  }

  const rawText = await resp.text();
  console.log(`Socrata response (first 300 chars): ${rawText.slice(0, 300)}`);
  const rawPermits: SocrataPermit[] = JSON.parse(rawText);
  console.log(`Fetched ${rawPermits.length} permits from Socrata.`);

  // Log 5 samples for debugging
  console.log("Sample permits (first 5):");
  rawPermits.slice(0, 5).forEach((p, i) => {
    console.log(`  [${i}] permit_number=${p.permit_number} address=${p.permit_address} worktype=${p.worktype} app_type=${p.application_type}`);
  });

  // ── 3. Transform + tag ───────────────────────────────────────
  const rows = rawPermits.map((p) => ({
    permit_number: p.permit_number ?? null,
    permit_address: p.permit_address ?? null,
    neighborhood: p.neighborhood ?? null,
    zip_code: extractZip(p.permit_address, p.neighborhood),
    application_type: p.application_type ?? null,
    worktype: p.worktype ?? null,
    estimated_cost: p.estimated_cost ? parseFloat(p.estimated_cost) : null,
    contractor_name: p.contractor_name ?? null,
    contractor_phone: p.contractor_phone_number ?? null,
    issue_permit_date: p.issue_permit_date
      ? p.issue_permit_date.split("T")[0]
      : null,
    application_status: p.application_status ?? null,
    trades_tagged: tagTrades(p),
    raw_data: p,
  }));

  // ── 4. Upsert into permits table ─────────────────────────────
  const { error: upsertError, count } = await supabase
    .from("permits")
    .upsert(rows, { onConflict: "permit_number", count: "exact" });

  if (upsertError) {
    console.error("Upsert error:", upsertError);
    return new Response(JSON.stringify({ error: upsertError.message }), {
      status: 500,
    });
  }

  console.log(`Upserted ${count ?? rows.length} permits.`);

  // ── 5. Send digest to matching contractors ───────────────────
  const { data: contractors, error: contractorError } = await supabase
    .from("contractors")
    .select("*")
    .in("subscription_status", ["active", "trial"]);

  if (contractorError) {
    console.error("Contractor fetch error:", contractorError);
    return new Response(
      JSON.stringify({ error: contractorError.message }),
      { status: 500 }
    );
  }

  console.log(`Found ${contractors?.length ?? 0} active/trial contractors.`);

  let digestsSent = 0;

  for (const contractor of contractors ?? []) {
    // Check trial expiry
    if (
      contractor.subscription_status === "trial" &&
      contractor.trial_ends_at &&
      new Date(contractor.trial_ends_at) < new Date()
    ) {
      console.log(`Skipping contractor ${contractor.email} — trial expired.`);
      continue;
    }

    // Find matching permits: trade in trades_tagged AND zip in contractor.zip_codes
    const { data: matchingPermits } = await supabase
      .from("permits")
      .select("*")
      .contains("trades_tagged", [contractor.trade])
      .overlaps("zip_code", contractor.zip_codes) // zip_code is text, not array; handle below
      .gte("issue_permit_date", sevenDaysAgoStr)
      .order("issue_permit_date", { ascending: false });

    // zip_code is a single text field — filter in JS since overlaps expects arrays
    const filtered = (matchingPermits ?? []).filter((permit) =>
      contractor.zip_codes.includes(permit.zip_code)
    );

    if (filtered.length === 0) continue;

    // Call send-digest edge function
    const digestResp = await fetch(
      `${supabaseUrl}/functions/v1/send-digest`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          contractor,
          permits: filtered,
          date: new Date().toLocaleDateString("en-US", {
            month: "long",
            day: "numeric",
            year: "numeric",
          }),
        }),
      }
    );

    if (digestResp.ok) {
      digestsSent++;

      // Log to digest_log
      await supabase.from("digest_log").insert({
        contractor_id: contractor.id,
        permits_sent: filtered.length,
        permit_ids: filtered.map((p) => p.id),
      });
    } else {
      const errText = await digestResp.text();
      console.error(`Digest failed for ${contractor.email}:`, errText);
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      permits_fetched: rawPermits.length,
      permits_upserted: count ?? rows.length,
      digests_sent: digestsSent,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
});

// GET /api/permits
//
// Mode 1 — lookup by email (contractor profile):
//   ?email=contractor@example.com
//   Headers: x-contractor-email + x-stripe-customer-id  (auth)
//   Looks up contractor's trade + zip_codes, returns matching permits from last 7 days.
//
// Mode 2 — explicit trade + zip:
//   ?trade=roofing&zip=32801,32803
//   Same auth headers required.

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { getCorsHeaders, corsOptions } from "@/lib/cors";

export async function OPTIONS(req: NextRequest) {
  return corsOptions(req.headers.get("origin"));
}

export async function GET(req: NextRequest) {
  const cors = getCorsHeaders(req.headers.get("origin"));
  const { searchParams } = req.nextUrl;
  const emailParam = searchParams.get("email");
  const tradeParam = searchParams.get("trade");
  const zipParam = searchParams.get("zip");

  // Auth: contractor must pass their email + stripe_customer_id
  const authEmail = req.headers.get("x-contractor-email");
  const customerId = req.headers.get("x-stripe-customer-id");

  if (!authEmail || !customerId) {
    return NextResponse.json(
      { error: "x-contractor-email and x-stripe-customer-id headers required" },
      { status: 401, headers: cors }
    );
  }

  const supabase = createServiceClient();

  // Verify contractor is active/trial
  const { data: contractor, error: ctErr } = await supabase
    .from("contractors")
    .select("id, trade, zip_codes, subscription_status, trial_ends_at")
    .eq("email", authEmail)
    .eq("stripe_customer_id", customerId)
    .single();

  if (ctErr || !contractor) {
    return NextResponse.json({ error: "Contractor not found" }, { status: 401, headers: cors });
  }

  const isActive = ["active", "trial"].includes(contractor.subscription_status);
  const trialExpired =
    contractor.subscription_status === "trial" &&
    contractor.trial_ends_at &&
    new Date(contractor.trial_ends_at) < new Date();

  if (!isActive || trialExpired) {
    return NextResponse.json({ error: "Subscription not active" }, { status: 403, headers: cors });
  }

  // ── Resolve trade + zips ─────────────────────────────────────
  let trade: string;
  let zips: string[];

  if (emailParam) {
    // Mode 1: look up by ?email= — fetch the named contractor's profile
    if (emailParam !== authEmail) {
      return NextResponse.json(
        { error: "email param must match authenticated contractor" },
        { status: 403, headers: cors }
      );
    }
    trade = contractor.trade;
    zips = contractor.zip_codes;
  } else if (tradeParam && zipParam) {
    // Mode 2: explicit trade + zip
    trade = tradeParam;
    zips = zipParam.split(",").map((z) => z.trim());
  } else {
    return NextResponse.json(
      { error: "Provide either ?email= or both ?trade= and ?zip= query params" },
      { status: 400, headers: cors }
    );
  }

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sinceDate = sevenDaysAgo.toISOString().split("T")[0];

  const { data: permits, error } = await supabase
    .from("permits")
    .select(
      "id, permit_address, neighborhood, zip_code, worktype, application_type, estimated_cost, contractor_name, issue_permit_date, application_status, trades_tagged"
    )
    .contains("trades_tagged", [trade])
    .gte("issue_permit_date", sinceDate)
    .order("issue_permit_date", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: cors });
  }

  // Filter by zip (zip_code is a text column, not an array)
  const filtered = (permits ?? []).filter((p) => zips.includes(p.zip_code));

  return NextResponse.json({ permits: filtered, total: filtered.length }, { headers: cors });
}

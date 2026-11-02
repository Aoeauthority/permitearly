// POST /api/signup
// Creates a Stripe customer + checkout session (3-day trial, then $99/mo)
// and upserts a contractor record.

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase";
import { getCorsHeaders, corsOptions } from "@/lib/cors";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function OPTIONS(req: NextRequest) {
  return corsOptions(req.headers.get("origin"));
}

export async function POST(req: NextRequest) {
  const cors = getCorsHeaders(req.headers.get("origin"));
  const body = await req.json();
  const { email, company_name, trade, zip_codes } = body as {
    email: string;
    company_name?: string;
    trade: string;
    zip_codes: string[];
  };

  if (!email || !trade || !zip_codes?.length) {
    return NextResponse.json(
      { error: "email, trade, and zip_codes are required" },
      { status: 400, headers: cors }
    );
  }

  const supabase = createServiceClient();

  // 1. Create Stripe customer
  const customer = await stripe.customers.create({
    email,
    name: company_name,
    metadata: { trade, zip_codes: zip_codes.join(",") },
  });

  // 2. Create checkout session with 3-day trial
  const session = await stripe.checkout.sessions.create({
    customer: customer.id,
    payment_method_types: ["card"],
    mode: "subscription",
    line_items: [
      {
        price: process.env.STRIPE_PRICE_ID!,
        quantity: 1,
      },
    ],
    subscription_data: {
      trial_period_days: 3,
    },
    automatic_tax: { enabled: true },
    tax_id_collection: { enabled: true },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/`,
    metadata: { email, trade, zip_codes: zip_codes.join(",") },
  });

  // 3. Upsert contractor record (trial status until Stripe confirms)
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 3);

  const { error } = await supabase.from("contractors").upsert(
    {
      email,
      company_name: company_name ?? null,
      trade,
      zip_codes,
      stripe_customer_id: customer.id,
      subscription_status: "trial",
      trial_ends_at: trialEndsAt.toISOString(),
    },
    { onConflict: "email" }
  );

  if (error) {
    console.error("Supabase upsert error:", error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: cors });
  }

  return NextResponse.json({ checkout_url: session.url }, { headers: cors });
}

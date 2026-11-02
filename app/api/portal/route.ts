// POST /api/portal
// Creates a Stripe Customer Portal session and returns the URL.
// Body: { email: string, stripe_customer_id: string }

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
  const { email, stripe_customer_id } = await req.json() as {
    email: string;
    stripe_customer_id: string;
  };

  if (!email || !stripe_customer_id) {
    return NextResponse.json(
      { error: "email and stripe_customer_id are required" },
      { status: 400, headers: cors }
    );
  }

  // Verify contractor
  const supabase = createServiceClient();
  const { data: contractor, error } = await supabase
    .from("contractors")
    .select("id")
    .eq("email", email)
    .eq("stripe_customer_id", stripe_customer_id)
    .single();

  if (error || !contractor) {
    return NextResponse.json({ error: "Contractor not found" }, { status: 401, headers: cors });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/account`,
  });

  return NextResponse.json({ portal_url: session.url }, { headers: cors });
}

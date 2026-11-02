// POST /api/unsubscribe
// Cancels the Stripe subscription and marks contractor as cancelled.
// Body: { email: string }  OR query param ?email=... for one-click links

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  let email: string | null = null;

  // Support both JSON body and URL query param (for email link unsubscribes)
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = await req.json();
    email = body.email ?? null;
  }

  if (!email) {
    email = req.nextUrl.searchParams.get("email");
  }

  if (!email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: contractor, error } = await supabase
    .from("contractors")
    .select("stripe_subscription_id, subscription_status")
    .eq("email", email)
    .single();

  if (error || !contractor) {
    return NextResponse.json({ error: "Contractor not found" }, { status: 404 });
  }

  if (contractor.stripe_subscription_id) {
    try {
      await stripe.subscriptions.cancel(contractor.stripe_subscription_id);
    } catch (stripeErr) {
      console.error("Stripe cancel error:", stripeErr);
      // Continue to update DB even if Stripe cancel fails (may already be cancelled)
    }
  }

  await supabase
    .from("contractors")
    .update({ subscription_status: "cancelled" })
    .eq("email", email);

  return NextResponse.json({ ok: true, message: "Unsubscribed successfully." });
}

// Also handle GET for one-click email unsubscribe links
export async function GET(req: NextRequest) {
  return POST(req);
}

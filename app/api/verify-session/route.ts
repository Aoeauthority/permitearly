// GET /api/verify-session?session_id=cs_xxx
// Returns { verified: true } only if the Stripe checkout session exists
// and has a subscription in trial or active state.

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getCorsHeaders, corsOptions } from "@/lib/cors";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function OPTIONS(req: NextRequest) {
  return corsOptions(req.headers.get("origin"));
}

export async function GET(req: NextRequest) {
  const cors = getCorsHeaders(req.headers.get("origin"));
  const sessionId = req.nextUrl.searchParams.get("session_id");

  if (!sessionId) {
    return NextResponse.json({ verified: false }, { headers: cors });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const verified = session.status === "complete";
    return NextResponse.json({ verified }, { headers: cors });
  } catch {
    return NextResponse.json({ verified: false }, { headers: cors });
  }
}

// POST /api/trigger-pull
// Manual trigger for pull-permits edge function.
// Protected by X-Trigger-Secret header.

import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders, corsOptions } from "@/lib/cors";

export async function OPTIONS(req: NextRequest) {
  return corsOptions(req.headers.get("origin"));
}

export async function POST(req: NextRequest) {
  const cors = getCorsHeaders(req.headers.get("origin"));
  const secret = req.headers.get("x-trigger-secret");
  if (!secret || secret !== process.env.TRIGGER_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: cors });
  }

  const supabaseUrl = process.env.SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const resp = await fetch(`${supabaseUrl}/functions/v1/pull-permits`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
    },
  });

  const data = await resp.json();

  if (!resp.ok) {
    return NextResponse.json(
      { error: "Edge function error", detail: data },
      { status: 502, headers: cors }
    );
  }

  return NextResponse.json({ ok: true, result: data }, { headers: cors });
}

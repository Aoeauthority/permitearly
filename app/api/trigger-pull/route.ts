// POST /api/trigger-pull
// Manual trigger for pull-permits edge function.
// Protected by X-Trigger-Secret header.

import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-trigger-secret");
  if (!secret || secret !== process.env.TRIGGER_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, result: data });
}

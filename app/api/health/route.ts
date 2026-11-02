// GET /api/health
import { NextRequest, NextResponse } from "next/server";
import { getCorsHeaders, corsOptions } from "@/lib/cors";

export async function OPTIONS(req: NextRequest) {
  return corsOptions(req.headers.get("origin"));
}

export async function GET(req: NextRequest) {
  return NextResponse.json(
    { status: "OK", ts: new Date().toISOString() },
    { headers: getCorsHeaders(req.headers.get("origin")) }
  );
}

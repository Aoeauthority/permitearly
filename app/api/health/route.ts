// GET /api/health
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ status: "OK", ts: new Date().toISOString() });
}

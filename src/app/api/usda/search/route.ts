import { NextRequest, NextResponse } from "next/server";
import { supabaseForRequest } from "@/lib/supabase/server";
import { searchUsdaFoods } from "@/lib/usda";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!await supabaseForRequest()) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const query = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 2 || query.length > 100) {
    return NextResponse.json({ error: "Search with 2 to 100 characters." }, { status: 400 });
  }

  const apiKey = process.env.USDA_FDC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Food search is not configured yet." }, { status: 503 });
  }

  try {
    return NextResponse.json({ foods: await searchUsdaFoods(query, apiKey) });
  } catch {
    return NextResponse.json({ error: "USDA search is unavailable. Try again shortly." }, { status: 502 });
  }
}

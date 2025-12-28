import { NextResponse } from "next/server";
import { getHistoricalTrends } from "@/lib/db/queries/stats-optimized";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 60; // Cache for 1 minute

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") as "24h" | "7d" | "30d" | null;

    // Validate period
    if (!period || !["24h", "7d", "30d"].includes(period)) {
      return NextResponse.json(
        { error: "Invalid period. Must be one of: 24h, 7d, 30d" },
        { status: 400 }
      );
    }

    const trends = await getHistoricalTrends(period);

    return NextResponse.json(
      {
        success: true,
        data: trends,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      }
    );
  } catch (error) {
    console.error("Error fetching trends:", error);
    return NextResponse.json(
      { error: "Failed to fetch trends" },
      { status: 500 }
    );
  }
}

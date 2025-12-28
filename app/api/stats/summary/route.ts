import { NextResponse } from "next/server";
import { getNetworkSummary } from "@/lib/db/queries/stats";

// Use Node.js runtime for database operations
export const runtime = "nodejs";

// Cache for 30 seconds, revalidate in background
export const revalidate = 30;

export async function GET() {
  try {
    const summary = await getNetworkSummary();

    return NextResponse.json(
      {
        success: true,
        data: summary,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        },
      }
    );
  } catch (error) {
    console.error("Error fetching network summary:", error);
    return NextResponse.json(
      { error: "Failed to fetch network summary" },
      { status: 500 }
    );
  }
}

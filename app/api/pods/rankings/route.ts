import { NextResponse } from "next/server";
import { getPodRankings } from "@/lib/db/queries/stats-optimized";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 45; // Cache for 45 seconds

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const metric = searchParams.get("metric") as
      | "storage_committed"
      | "storage_used"
      | "uptime"
      | "version"
      | null;
    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 100);

    // Validate metric
    if (
      !metric ||
      !["storage_committed", "storage_used", "uptime", "version"].includes(
        metric
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid metric. Must be one of: storage_committed, storage_used, uptime, version",
        },
        { status: 400 }
      );
    }

    const rankings = await getPodRankings(metric, limit);

    return NextResponse.json(
      {
        success: true,
        data: rankings,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=45, stale-while-revalidate=90",
        },
      }
    );
  } catch (error) {
    console.error("Error fetching rankings:", error);
    return NextResponse.json(
      { error: "Failed to fetch rankings" },
      { status: 500 }
    );
  }
}

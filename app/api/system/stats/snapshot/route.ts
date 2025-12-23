import { NextResponse } from "next/server";
import { APIStatsResponse } from "@/types/stats";
import { saveSystemMetrics } from "@/lib/db/queries/system-metrics";

export async function POST(request: Request) {
  // Check authentication
  const authHeader = request.headers.get("authorization");
  const expectedSecret = process.env.SNAPSHOT_SECRET;

  if (!expectedSecret) {
    return NextResponse.json(
      { error: "SNAPSHOT_SECRET not configured" },
      { status: 500 }
    );
  }

  if (!authHeader || authHeader !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Call the existing /api/system/stats endpoint
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";
    const response = await fetch(`${baseUrl}/api/system/stats`, {
      method: "POST",
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch system stats data" },
        { status: response.status }
      );
    }

    const data: APIStatsResponse = await response.json();

    // Check if we have valid data
    if (!data.stats || !data.stats.result) {
      console.error("Invalid response structure:", data);
      return NextResponse.json(data);
    }

    // Save to database
    try {
      await saveSystemMetrics(data.stats.result);
    } catch (dbError) {
      console.error("Failed to save system metrics:", dbError);
      // Continue even if DB save fails
    }

    return NextResponse.json(data);
  } catch (e) {
    console.error("System stats snapshot error:", e);
    return NextResponse.json(
      {
        error: "SERVER FAILED",
        msg: e instanceof Error ? e.message : String(e),
      },
      { status: 500 }
    );
  }
}

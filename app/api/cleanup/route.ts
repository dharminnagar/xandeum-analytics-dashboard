import { NextResponse } from "next/server";
import {
  cleanupOldSystemMetrics,
  cleanupOldPodMetrics,
} from "@/lib/db/queries";

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
    // Cleanup old system metrics
    const systemMetricsResult = await cleanupOldSystemMetrics();

    // Cleanup old pod metrics
    const podMetricsResult = await cleanupOldPodMetrics();

    return NextResponse.json({
      success: true,
      deleted: {
        systemMetrics: systemMetricsResult.count,
        podMetrics: podMetricsResult.count,
      },
      message: "Successfully cleaned up data older than 90 days",
    });
  } catch (error) {
    console.error("Error during data cleanup:", error);
    return NextResponse.json(
      { error: "Failed to cleanup old data" },
      { status: 500 }
    );
  }
}

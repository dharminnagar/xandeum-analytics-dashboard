import { NextResponse } from "next/server";
import {
  cleanupOldSystemMetrics,
  cleanupOldPodMetrics,
} from "@/lib/db/queries";

export async function POST() {
  try {
    console.log("Starting data cleanup (90-day retention)...");

    // Cleanup old system metrics
    const systemMetricsResult = await cleanupOldSystemMetrics();
    console.log(`Deleted ${systemMetricsResult.count} old system metrics`);

    // Cleanup old pod metrics
    const podMetricsResult = await cleanupOldPodMetrics();
    console.log(`Deleted ${podMetricsResult.count} old pod metrics`);

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

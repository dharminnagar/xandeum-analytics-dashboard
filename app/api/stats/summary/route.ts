import { NextResponse } from "next/server";
import { getNetworkSummary } from "@/lib/db/queries/stats";

export async function GET() {
  try {
    const summary = await getNetworkSummary();

    return NextResponse.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error("Error fetching network summary:", error);
    return NextResponse.json(
      { error: "Failed to fetch network summary" },
      { status: 500 }
    );
  }
}

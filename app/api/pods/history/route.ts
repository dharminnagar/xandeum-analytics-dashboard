import { NextResponse } from "next/server";
import { getPodMetricsHistory } from "@/lib/db/queries/pods";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse query parameters
    const pubkey = searchParams.get("pubkey") || undefined;
    const address = searchParams.get("address") || undefined;
    const fromParam = searchParams.get("from");
    const toParam = searchParams.get("to");
    const limitParam = searchParams.get("limit");

    if (!pubkey && !address) {
      return NextResponse.json(
        { error: "Either 'pubkey' or 'address' parameter is required" },
        { status: 400 }
      );
    }

    const from = fromParam ? new Date(fromParam) : undefined;
    const to = toParam ? new Date(toParam) : undefined;
    const limit = limitParam ? parseInt(limitParam, 10) : 1000;

    // Validate dates
    if (from && isNaN(from.getTime())) {
      return NextResponse.json(
        { error: "Invalid 'from' date format" },
        { status: 400 }
      );
    }

    if (to && isNaN(to.getTime())) {
      return NextResponse.json(
        { error: "Invalid 'to' date format" },
        { status: 400 }
      );
    }

    // Fetch history from database
    const metrics = await getPodMetricsHistory({
      pubkey,
      address,
      from,
      to,
      limit,
    });

    return NextResponse.json({
      success: true,
      count: metrics.length,
      data: metrics,
    });
  } catch (error) {
    console.error("Error fetching pod metrics history:", error);
    return NextResponse.json(
      { error: "Failed to fetch pod metrics history" },
      { status: 500 }
    );
  }
}

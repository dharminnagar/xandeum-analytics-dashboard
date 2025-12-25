import { NextRequest, NextResponse } from "next/server";
import { ipGeolocationService } from "@/lib/ip-geolocation.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/node/:id/geolocation
 * Returns geolocation data for a specific node's IP addresses with history
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "Node ID (pubkey or address) is required" },
        { status: 400 }
      );
    }

    const result = await ipGeolocationService.getNodeLocationsWithHistory(id);

    const mapLocations = result.locations.map((loc) => ({
      ip: loc.ip,
      lat: loc.lat,
      lng: loc.lon, // Use lng for consistency with map components
      city: loc.city,
      region: loc.region,
      country: loc.country,
      countryCode: loc.countryCode,
      isp: loc.isp,
      org: loc.org,
      firstSeen: loc.firstSeen,
      lastSeen: loc.lastSeen,
      snapshotCount: loc.snapshotCount,
    }));

    return NextResponse.json({
      pubkey: id,
      locations: mapLocations,
      total: mapLocations.length,
    });
  } catch (error) {
    console.error("Failed to get node geolocation:", error);

    return NextResponse.json(
      {
        error: "Failed to fetch node geolocation data",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

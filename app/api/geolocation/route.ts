import { NextResponse } from "next/server";
import { ipGeolocationService } from "@/lib/ip-geolocation.service";

export const runtime = "nodejs";
export const revalidate = 60; // Cache for 60 seconds

/**
 * GET /api/geolocation
 * Returns all stored geolocation data for the global map
 */
export async function GET() {
  try {
    const result = await ipGeolocationService.getAllNodesWithGeolocation();

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
      nodeCount: loc.nodeCount,
      pubkeys: loc.pubkeys,
      firstSeen: loc.firstSeen,
      lastSeen: loc.lastSeen,
    }));

    return NextResponse.json(
      {
        locations: mapLocations,
        totalNodes: result.totalNodes,
        totalLocations: result.totalLocations,
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      }
    );
  } catch (error) {
    console.error("Failed to get all geolocations:", error);

    return NextResponse.json(
      {
        error: "Failed to fetch geolocation data",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

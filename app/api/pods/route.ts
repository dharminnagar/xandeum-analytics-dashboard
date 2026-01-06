import { NextResponse } from "next/server";
import { XANDEUM_ENDPOINTS } from "@/config/endpoints";
import { sendRequest } from "@/lib/sendRequest";
import { APINodesWithStatsResponse } from "@/types/nodes";

// Use Node.js runtime
export const runtime = "nodejs";

// Cache for 20 seconds
export const revalidate = 20;

export async function POST() {
  for (let i = 0; i < XANDEUM_ENDPOINTS.length; i++) {
    const endpoint = XANDEUM_ENDPOINTS[i];

    try {
      const request = {
        jsonrpc: "2.0",
        method: "get-pods-with-stats",
        params: [],
        id: 1,
      };
      const response: string | null = await sendRequest(
        `${endpoint}/rpc`,
        JSON.stringify(request)
      );

      if (response) {
        const data: APINodesWithStatsResponse = JSON.parse(response);
        return NextResponse.json(data);
      }
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      // Silent fail, continue to next endpoint
    }
  }

  return NextResponse.json({ error: "All endpoints failed" }, { status: 503 });
}

import { NextResponse } from "next/server";
import { XANDEUM_ENDPOINTS } from "@/config/endpoints";
import { sendRequest } from "@/lib/sendRequest";
import { PodResponse } from "@/types/stats";

export async function POST() {
  console.log("System Stats API: Starting request");

  for (const endpoint of XANDEUM_ENDPOINTS) {
    console.log(`System Stats API: Endpoint ${endpoint}`);

    try {
      const request = {
        jsonrpc: "2.0",
        method: "get-stats",
        params: [],
        id: 1,
      };
      const response: string | null = await sendRequest(
        endpoint,
        JSON.stringify(request)
      );

      if (response) {
        const data: PodResponse = JSON.parse(response);
        return NextResponse.json(data);
      }
    } catch (e) {
      return NextResponse.json({
        error: "SERVER FAILED",
        msg: e,
        endpoint: endpoint,
      });
    }
  }

  return NextResponse.json({ error: "All endpoints failed" }, { status: 503 });
}

import { NextResponse } from "next/server";
import { XANDEUM_ENDPOINTS } from "@/config/endpoints";
import { sendRequest } from "@/lib/sendRequest";
import { Stats } from "@/types/nodes";

export async function POST() {
  for (const endpoint of XANDEUM_ENDPOINTS) {
    try {
      const request = {
        jsonrpc: "2.0",
        method: "get-pods-with-stats",
        params: [],
        id: 1,
      };
      const response: string | null = await sendRequest(
        endpoint,
        JSON.stringify(request)
      );

      if (response) {
        const data: Stats = JSON.parse(response);
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

import { APINodesWithStatsResponse, Stats } from "@/types/nodes";
import * as undici from "undici";

export async function sendRequest(
  endpoint: string,
  requestBody: string,
  timeoutMs: number = 5000
): Promise<APINodesWithStatsResponse | null> {
  try {
    const { statusCode, body } = await undici.request(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: requestBody,
      bodyTimeout: timeoutMs,
      headersTimeout: timeoutMs,
    });

    const data: Stats = (await body.json()) as Stats;

    if (data) {
      return {
        statusCode,
        stats: data,
      };
    }

    return null;
  } catch (error) {
    console.log(`✗ Request to ${endpoint} failed:`, error);
    return null;
  }
}

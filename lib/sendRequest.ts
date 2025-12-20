import * as undici from "undici";
import fs from "fs";

export async function sendRequest(endpoint: string, requestBody: string) {
  console.log("requesting endpoint", endpoint);
  const { statusCode, body } = await undici.request(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: requestBody,
  });

  const data: unknown = await body.json();

  if (data) {
    fs.writeFileSync(
      "api_stats_response.json",
      JSON.stringify({
        statusCode,
        stats: data,
      })
    );
    return JSON.stringify({
      statusCode,
      stats: data,
    });
  }

  return null;
}

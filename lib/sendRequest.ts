import * as undici from "undici";

export async function sendRequest(
  endpoint: string,
  requestBody: string,
  timeoutMs: number = 5000
) {
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

    const data: unknown = await body.json();

    if (data) {
      return JSON.stringify({
        statusCode,
        stats: data,
      });
    }

    return null;
  } catch (error) {
    // Don't log every failed request - just return null
    return null;
  }
}

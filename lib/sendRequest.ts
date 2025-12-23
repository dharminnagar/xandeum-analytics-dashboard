import * as undici from "undici";

export async function sendRequest(endpoint: string, requestBody: string) {
  const { statusCode, body } = await undici.request(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: requestBody,
  });

  const data: unknown = await body.json();

  if (data) {
    return JSON.stringify({
      statusCode,
      stats: data,
    });
  }

  return null;
}

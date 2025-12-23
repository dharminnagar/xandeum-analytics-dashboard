import { NextResponse } from "next/server";
import { APINodesWithStatsResponse } from "@/types/nodes";
import { upsertPod, savePodMetrics } from "@/lib/db/queries/pods";

export async function POST() {
  const logs: string[] = [];
  logs.push("Pods Snapshot API: Starting request");

  try {
    // Call the existing /api/pods endpoint
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000";
    logs.push(`Fetching from: ${baseUrl}/api/pods`);

    const response = await fetch(`${baseUrl}/api/pods`, {
      method: "POST",
      cache: "no-store",
    });

    logs.push(`Response status: ${response.status}`);

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch pods data", logs },
        { status: response.status }
      );
    }

    const data: APINodesWithStatsResponse = await response.json();
    logs.push(`Received ${data.stats?.result?.pods?.length || 0} pods`);

    // Check if we have valid data
    if (!data.stats || !data.stats.result || !data.stats.result.pods) {
      console.error("Invalid response structure:", data);
      return NextResponse.json({ ...data, logs });
    }

    // Save all pods and their metrics to database
    logs.push(
      `Attempting to save ${data.stats.result.pods.length} pods to database`
    );
    try {
      let savedCount = 0;
      const errors: string[] = [];
      for (const pod of data.stats.result.pods) {
        try {
          // Upsert the pod
          const upsertedPod = await upsertPod(pod);
          logs.push(
            `Upserted pod ${upsertedPod.id}: ${pod.pubkey || pod.address}`
          );

          // Save metrics history
          await savePodMetrics(upsertedPod.id, pod);
          savedCount++;
        } catch (podError) {
          const errorMsg = `Failed to save pod ${pod.pubkey || pod.address}: ${podError instanceof Error ? podError.message : String(podError)}`;
          logs.push(errorMsg);
          errors.push(errorMsg);
        }
      }
      logs.push(
        `Successfully saved ${savedCount}/${data.stats.result.pods.length} pods to database`
      );

      return NextResponse.json({
        ...data,
        dbSave: { savedCount, errors, logs },
      });
    } catch (dbError) {
      const errorMsg = `Failed to save pods: ${dbError instanceof Error ? dbError.message : String(dbError)}`;
      logs.push(errorMsg);
      return NextResponse.json({ ...data, dbSave: { error: errorMsg, logs } });
    }
  } catch (e) {
    logs.push(`Error: ${e instanceof Error ? e.message : String(e)}`);
    return NextResponse.json(
      {
        error: "SERVER FAILED",
        msg: e instanceof Error ? e.message : String(e),
        logs,
      },
      { status: 500 }
    );
  }
}

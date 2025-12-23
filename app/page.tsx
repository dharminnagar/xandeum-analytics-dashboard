import { APINodesWithStatsResponse, Stats } from "@/types/nodes";
import { PodResponse } from "@/types/stats";
import { Pod } from "@/types/nodes";

// Get base URL - works in both development and production
const getBaseUrl = () => {
  if (typeof window !== "undefined") return ""; // Client-side: use relative URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`; // Vercel
  return "http://localhost:3000"; // Development
};

async function getPods() {
  try {
    const res = await fetch(`${getBaseUrl()}/api/pods`, {
      method: "POST",
      cache: "no-store",
    });
    if (!res.ok) {
      console.log("pods fetch failed:", res.status, res.statusText);
      return null;
    }
    const data: APINodesWithStatsResponse = await res.json();
    console.log("pods fetch response:", JSON.stringify(data, null, 2));
    console.log("pods result pods:", data.stats.result.pods.length);
    return data.stats as Stats;
  } catch (error) {
    console.error("pods fetch error:", error);
    return null;
  }
}

async function getStats() {
  try {
    const res = await fetch(`${getBaseUrl()}/api/system/stats`, {
      method: "POST",
      cache: "no-store",
    });
    if (!res.ok) {
      console.log("stats fetch failed:", res.status, res.statusText);
      return null;
    }
    const data = await res.json();
    console.log("Stats fetch response:", JSON.stringify(data, null, 2));
    console.log("stats result:", data?.result);
    return data.stats as PodResponse;
  } catch (error) {
    console.error("stats fetch error:", error);
    return null;
  }
}

function formatBytes(bytes: number | null): string {
  if (bytes === null) return "N/A";
  const gb = bytes / 1024 ** 3;
  return `${gb.toFixed(2)} GB`;
}

function formatPercent(value: number | null): string {
  if (value === null) return "N/A";
  return `${value.toFixed(1)}%`;
}

export default async function Home() {
  const [podsData, statsData] = await Promise.all([getPods(), getStats()]);

  if (!podsData && !statsData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">⚠️ All endpoints are down</h1>
          <p className="text-gray-600">Unable to fetch Xandeum data</p>
        </div>
      </div>
    );
  }

  // Access nested structure: response has { stats: { result: {...} } }
  const pods: Pod[] = podsData?.result.pods || [];
  const overallStats = statsData?.result;

  return (
    <div className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">Xandeum Analytics Dashboard</h1>

        {/* Overall Network Stats */}
        {overallStats && (
          <div className="mb-8">
            <h2 className="text-2xl font-semibold mb-4">Network Statistics</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {overallStats.uptime != null && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">
                    Uptime
                  </h3>
                  <p className="text-3xl font-bold">
                    {overallStats.uptime.toLocaleString()}s
                  </p>
                </div>
              )}
              {overallStats.cpu_percent != null && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">
                    CPU Usage
                  </h3>
                  <p className="text-3xl font-bold">
                    {formatPercent(overallStats.cpu_percent)}
                  </p>
                </div>
              )}
              {(overallStats.ram_used != null ||
                overallStats.ram_total != null) && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">
                    RAM Used
                  </h3>
                  <p className="text-3xl font-bold">
                    {formatBytes(overallStats.ram_used)}
                  </p>
                  <p className="text-xs text-gray-500">
                    of {formatBytes(overallStats.ram_total)}
                  </p>
                </div>
              )}
              {overallStats.active_streams != null && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">
                    Active Streams
                  </h3>
                  <p className="text-3xl font-bold">
                    {overallStats.active_streams}
                  </p>
                </div>
              )}
              {overallStats.packets_sent != null && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">
                    Packets Sent
                  </h3>
                  <p className="text-2xl font-bold">
                    {overallStats.packets_sent.toLocaleString()}
                  </p>
                </div>
              )}
              {overallStats.packets_received != null && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">
                    Packets Received
                  </h3>
                  <p className="text-2xl font-bold">
                    {overallStats.packets_received.toLocaleString()}
                  </p>
                </div>
              )}
              {overallStats.total_bytes != null && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">
                    Total Data
                  </h3>
                  <p className="text-2xl font-bold">
                    {formatBytes(overallStats.total_bytes)}
                  </p>
                </div>
              )}
              {overallStats.file_size != null && (
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-sm font-medium text-gray-500 mb-2">
                    File Size
                  </h3>
                  <p className="text-2xl font-bold">
                    {formatBytes(overallStats.file_size)}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Pods Section */}
        {pods.length > 0 && (
          <div>
            <h2 className="text-2xl font-semibold mb-4">
              pNodes ({pods.length})
            </h2>
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Address
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Public
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Version
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Public Key
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        RPC Port
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Storage Used
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Storage Committed
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Usage %
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Last Seen
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Uptime
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {pods.map((pod: Pod, i: number) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm text-gray-900 font-mono">
                          {pod.address}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {pod.is_public !== null && (
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                pod.is_public
                                  ? "bg-green-100 text-green-800"
                                  : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {pod.is_public ? "✓ Public" : "Private"}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {pod.version}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 font-mono truncate max-w-xs">
                          {pod.pubkey || "N/A"}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {pod.rpc_port || "N/A"}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {formatBytes(pod.storage_used)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {formatBytes(pod.storage_committed)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {formatPercent(pod.storage_usage_percent)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                          {new Date(
                            pod.last_seen_timestamp * 1000
                          ).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {pod.uptime
                            ? `${pod.uptime.toLocaleString()}s`
                            : "N/A"}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <a
                            href={`/api/pods/${encodeURIComponent(pod.address)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                          >
                            View Details
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {!overallStats && pods.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No data available</p>
          </div>
        )}
      </div>
    </div>
  );
}

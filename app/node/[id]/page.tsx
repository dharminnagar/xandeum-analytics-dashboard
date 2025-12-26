"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { WorldMap } from "@/components/ui/world-map";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { NodeMapLocation } from "@/types/geolocation";
import { getCSSColor } from "@/lib/colors";
import Image from "next/image";

type PodAddress = {
  address: string;
  rpcPort: number | null;
  version: string;
  isPublic: boolean | null;
  uptime: number;
  storageUsed: string;
  storageCommitted: string;
  lastSeen: string;
  isPrimary: boolean;
};

type HistoricalMetric = {
  timestamp: string;
  storageUsed: string;
  storageCommitted: string;
  uptime: number;
};

type NodeDetails = {
  pubkey: string;
  addresses: PodAddress[];
  currentVersion: string;
  lastSeen: string;
  isActive: boolean;
  historical: HistoricalMetric[];
};

type PodSummary = {
  pubkey: string;
  address: string;
  storageUsed: string;
  uptime: number;
};

function formatBytes(bytes: string | number): string {
  const num = typeof bytes === "string" ? parseFloat(bytes) : bytes;
  if (num === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(num) / Math.log(k));
  return `${(num / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function NodePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [nodeData, setNodeData] = useState<NodeDetails | null>(null);
  const [geoData, setGeoData] = useState<NodeMapLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [geoLoading, setGeoLoading] = useState(true);
  const [period, setPeriod] = useState<"24h" | "7d" | "30d">("24h");
  const [selectedLocation, setSelectedLocation] =
    useState<NodeMapLocation | null>(null);
  const [networkStats, setNetworkStats] = useState<{
    avgStorage: number;
    avgUptime: number;
    totalNodes: number;
  } | null>(null);

  useEffect(() => {
    const fetchNodeData = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `/api/node/${encodeURIComponent(id)}?period=${period}`
        );
        if (!response.ok) throw new Error("Failed to fetch node data");
        const data = await response.json();
        setNodeData(data.data || data);
      } catch (error) {
        console.error("Error fetching node data:", error);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchNodeData();
    }
  }, [id, period]);

  useEffect(() => {
    const fetchGeolocation = async () => {
      setGeoLoading(true);
      try {
        const response = await fetch(
          `/api/node/${encodeURIComponent(id)}/geolocation`
        );
        if (response.ok) {
          const data = await response.json();
          setGeoData(data.locations || []);
        }
      } catch (error) {
        console.error("Error fetching geolocation:", error);
      } finally {
        setGeoLoading(false);
      }
    };

    if (id) {
      fetchGeolocation();
    }
  }, [id]);

  // Fetch network statistics for comparison
  useEffect(() => {
    const fetchNetworkStats = async () => {
      try {
        const response = await fetch("/api/stats");
        if (!response.ok) throw new Error("Failed to fetch network stats");
        const data = await response.json();

        // Calculate network averages
        const pods = (data.summary?.pods || []) as PodSummary[];
        if (pods.length > 0) {
          const avgStorage =
            pods.reduce(
              (sum: number, p: PodSummary) =>
                sum + (Number(p.storageUsed) || 0),
              0
            ) / pods.length;
          const avgUptime =
            pods.reduce(
              (sum: number, p: PodSummary) => sum + (p.uptime || 0),
              0
            ) / pods.length;

          setNetworkStats({
            avgStorage,
            avgUptime,
            totalNodes: pods.length,
          });
        }
      } catch (error) {
        console.error("Error fetching network stats:", error);
      }
    };

    fetchNetworkStats();
  }, []);

  // Format locations for WorldMap
  const mapLocations = useMemo(() => {
    return geoData.map((loc) => ({
      lat: loc.lat,
      lng: loc.lng,
      ip: loc.ip,
      city: loc.city,
      country: loc.country,
      label: `${[loc.city, loc.region, loc.country].filter(Boolean).join(", ") || "Unknown"} - ${loc.snapshotCount} ${loc.snapshotCount === 1 ? "snapshot" : "snapshots"}`,
    }));
  }, [geoData]);

  const primaryAddress = nodeData?.addresses.find((a) => a.isPrimary);

  const chartData = useMemo(() => {
    return (
      nodeData?.historical.map((h) => ({
        timestamp: h.timestamp,
        storageUsed: Number(h.storageUsed) / 1024 ** 4,
        storageCommitted: Number(h.storageCommitted) / 1024 ** 4,
        uptime: h.uptime,
      })) || []
    );
  }, [nodeData]);

  // Calculate advanced metrics
  const advancedMetrics = useMemo(() => {
    if (!chartData || chartData.length < 2) {
      return {
        storageUtilization: 0,
        storageGrowthRate: 0,
        uptimeConsistency: 0,
        avgUptime: 0,
        daysUntilCapacity: null,
        dataCollectionRate: 0,
      };
    }

    // Sort by timestamp
    const sortedData = [...chartData].sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Storage utilization (latest)
    const latest = sortedData[sortedData.length - 1];
    const storageUtilization =
      latest.storageCommitted > 0
        ? (latest.storageUsed / latest.storageCommitted) * 100
        : 0;

    // Storage growth rate (TB per day)
    const oldest = sortedData[0];
    const timeSpanMs =
      new Date(latest.timestamp).getTime() -
      new Date(oldest.timestamp).getTime();
    const timeSpanDays = timeSpanMs / (1000 * 60 * 60 * 24);
    const storageGrowth = latest.storageUsed - oldest.storageUsed;
    const storageGrowthRate =
      timeSpanDays > 0 ? storageGrowth / timeSpanDays : 0;

    // Days until capacity (if growth is positive)
    const remainingCapacity = latest.storageCommitted - latest.storageUsed;
    const daysUntilCapacity =
      storageGrowthRate > 0
        ? Math.ceil(remainingCapacity / storageGrowthRate)
        : null;

    // Uptime consistency (standard deviation / mean)
    const uptimes = sortedData.map((d) => d.uptime);
    const avgUptime = uptimes.reduce((a, b) => a + b, 0) / uptimes.length;
    const variance =
      uptimes.reduce((sum, val) => sum + Math.pow(val - avgUptime, 2), 0) /
      uptimes.length;
    const stdDev = Math.sqrt(variance);
    const uptimeConsistency =
      avgUptime > 0 ? Math.max(0, 100 - (stdDev / avgUptime) * 100) : 0;

    // Data collection rate (expected vs actual data points)
    const expectedDataPoints = Math.floor(timeSpanMs / (5 * 60 * 1000)); // 5-minute intervals
    const dataCollectionRate =
      expectedDataPoints > 0
        ? Math.min(100, (sortedData.length / expectedDataPoints) * 100)
        : 100;

    return {
      storageUtilization,
      storageGrowthRate,
      uptimeConsistency,
      avgUptime,
      daysUntilCapacity,
      dataCollectionRate,
    };
  }, [chartData]);

  // Calculate network position metrics
  const networkPosition = useMemo(() => {
    if (!networkStats || !primaryAddress) {
      return {
        storagePercentile: 0,
        uptimePercentile: 0,
        vsAvgStorage: 0,
        vsAvgUptime: 0,
      };
    }

    const currentStorage = Number(primaryAddress.storageUsed);
    const currentUptime = primaryAddress.uptime;

    // Compare to network averages
    const vsAvgStorage =
      networkStats.avgStorage > 0
        ? ((currentStorage - networkStats.avgStorage) /
            networkStats.avgStorage) *
          100
        : 0;

    const vsAvgUptime =
      networkStats.avgUptime > 0
        ? ((currentUptime - networkStats.avgUptime) / networkStats.avgUptime) *
          100
        : 0;

    // Estimate percentile (simplified - actual rank would require all nodes data)
    const storagePercentile =
      vsAvgStorage > 50
        ? 85
        : vsAvgStorage > 20
          ? 70
          : vsAvgStorage > 0
            ? 55
            : 40;
    const uptimePercentile =
      vsAvgUptime > 50 ? 85 : vsAvgUptime > 20 ? 70 : vsAvgUptime > 0 ? 55 : 40;

    return {
      storagePercentile,
      uptimePercentile,
      vsAvgStorage,
      vsAvgUptime,
    };
  }, [networkStats, primaryAddress]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/")}
            className="mb-6"
          >
            ← Back
          </Button>
          <Skeleton className="h-10 w-64 mb-4" />
          <Skeleton className="h-6 w-48 mb-8" />
          <div className="space-y-6">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!nodeData) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/")}
            className="mb-6"
          >
            ← Back
          </Button>
          <h1 className="text-2xl font-bold mb-4">Node not found</h1>
          <p className="text-muted-foreground">
            The node you&apos;re looking for doesn&apos;t exist or has been
            removed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/")}
          className="mb-6"
        >
          ← Back
        </Button>

        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold">
              Node {nodeData.pubkey.slice(0, 8)}...{nodeData.pubkey.slice(-8)}
            </h1>
            <Badge variant={nodeData.isActive ? "default" : "secondary"}>
              {nodeData.isActive ? "Active" : "Inactive"}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Current version {nodeData.currentVersion} · Last seen{" "}
            {formatDate(nodeData.lastSeen)}
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground mb-1">
                Total Addresses
              </div>
              <div className="text-2xl font-bold">
                {nodeData.addresses.length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground mb-1">
                Storage Committed
              </div>
              <div className="text-2xl font-bold">
                {primaryAddress
                  ? formatBytes(primaryAddress.storageCommitted)
                  : "N/A"}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground mb-1">
                Storage Used
              </div>
              <div className="text-2xl font-bold">
                {primaryAddress
                  ? formatBytes(primaryAddress.storageUsed)
                  : "N/A"}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground mb-1">
                Avg Uptime
              </div>
              <div className="text-2xl font-bold">
                {primaryAddress
                  ? `${primaryAddress.uptime.toLocaleString()}s`
                  : "N/A"}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Performance & Health */}
        <div className="grid gap-6 lg:grid-cols-2 mb-8">
          {/* Storage Growth Rate */}
          <Card>
            <CardHeader>
              <CardTitle>Storage Growth Rate</CardTitle>
              <p className="text-sm text-muted-foreground">
                Rate of storage usage increase
              </p>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData.map((d, i, arr) => {
                      if (i === 0) {
                        return {
                          timestamp: d.timestamp,
                          growthRate: 0,
                        };
                      }
                      const prevData = arr[i - 1];
                      const timeDiff =
                        (new Date(d.timestamp).getTime() -
                          new Date(prevData.timestamp).getTime()) /
                        (1000 * 60 * 60 * 24); // days
                      const storageGrowth =
                        d.storageUsed - prevData.storageUsed;
                      const growthRate =
                        timeDiff > 0 ? storageGrowth / timeDiff : 0;
                      return {
                        timestamp: d.timestamp,
                        growthRate: growthRate * 1024, // Convert to GB/day
                      };
                    })}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={getCSSColor("--border")}
                    />
                    <XAxis
                      dataKey="timestamp"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => {
                        const date = new Date(value);
                        return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${date.getMinutes().toString().padStart(2, "0")}`;
                      }}
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => `${value.toFixed(1)} GB/d`}
                    />
                    <Tooltip
                      contentStyle={{
                        fontSize: 12,
                        backgroundColor: getCSSColor("--popover"),
                        border: `1px solid ${getCSSColor("--border")}`,
                        color: getCSSColor("--popover-foreground"),
                      }}
                      labelFormatter={(value: string | number) =>
                        formatDate(String(value))
                      }
                      formatter={(
                        value: number | string | (string | number)[] | undefined
                      ) => [
                        `${(Number(value) || 0).toFixed(2)} GB/day`,
                        "Growth Rate",
                      ]}
                    />
                    <Line
                      type="monotone"
                      dataKey="growthRate"
                      stroke={getCSSColor("--chart-2")}
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 text-sm">
                <span className="font-medium">Average: </span>
                {advancedMetrics.storageGrowthRate >= 1
                  ? `${advancedMetrics.storageGrowthRate.toFixed(2)} TB/day`
                  : `${(advancedMetrics.storageGrowthRate * 1024).toFixed(2)} GB/day`}
                {advancedMetrics.daysUntilCapacity !== null && (
                  <span className="ml-4">
                    <span className="font-medium">Capacity in: </span>
                    {advancedMetrics.daysUntilCapacity > 365
                      ? ">1 year"
                      : `${advancedMetrics.daysUntilCapacity} days`}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Uptime Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Uptime Timeline</CardTitle>
              <p className="text-sm text-muted-foreground">
                Node availability over time
              </p>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData.map((d, i, arr) => {
                      // Calculate if node was likely up based on uptime increase
                      const isUp =
                        i === 0 || d.uptime > (arr[i - 1]?.uptime || 0);
                      return {
                        timestamp: d.timestamp,
                        status: isUp ? 1 : 0,
                        uptimeHours: d.uptime / 3600,
                      };
                    })}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={getCSSColor("--border")}
                    />
                    <XAxis
                      dataKey="timestamp"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => {
                        const date = new Date(value);
                        return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${date.getMinutes().toString().padStart(2, "0")}`;
                      }}
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      domain={[0, 1]}
                      ticks={[0, 1]}
                      tickFormatter={(value) => (value ? "Up" : "Down")}
                    />
                    <Tooltip
                      contentStyle={{
                        fontSize: 12,
                        backgroundColor: getCSSColor("--popover"),
                        border: `1px solid ${getCSSColor("--border")}`,
                        color: getCSSColor("--popover-foreground"),
                      }}
                      labelFormatter={(value: string | number) =>
                        formatDate(String(value))
                      }
                      formatter={(
                        value:
                          | number
                          | string
                          | (string | number)[]
                          | undefined,
                        name: string | undefined
                      ) => {
                        if (name === "status") {
                          return [Number(value) ? "Up" : "Down", "Status"];
                        }
                        return [
                          `${(Number(value) || 0).toFixed(1)}h`,
                          "Total Uptime",
                        ];
                      }}
                    />
                    <Line
                      type="stepAfter"
                      dataKey="status"
                      stroke={getCSSColor("--chart-3")}
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 text-sm">
                <span className="font-medium">Consistency: </span>
                <span
                  className={
                    advancedMetrics.uptimeConsistency > 95
                      ? "text-green-500"
                      : advancedMetrics.uptimeConsistency > 85
                        ? "text-yellow-500"
                        : "text-red-500"
                  }
                >
                  {advancedMetrics.uptimeConsistency.toFixed(1)}%
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Storage Utilization Over Time */}
          <Card>
            <CardHeader>
              <CardTitle>Storage Utilization</CardTitle>
              <p className="text-sm text-muted-foreground">
                Percentage of committed storage used over time
              </p>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData.map((d) => ({
                      timestamp: d.timestamp,
                      utilization:
                        d.storageCommitted > 0
                          ? (d.storageUsed / d.storageCommitted) * 100
                          : 0,
                    }))}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={getCSSColor("--border")}
                    />
                    <XAxis
                      dataKey="timestamp"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => {
                        const date = new Date(value);
                        return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${date.getMinutes().toString().padStart(2, "0")}`;
                      }}
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      domain={[0, 100]}
                      tickFormatter={(value) => `${value}%`}
                    />
                    <Tooltip
                      contentStyle={{
                        fontSize: 12,
                        backgroundColor: getCSSColor("--popover"),
                        border: `1px solid ${getCSSColor("--border")}`,
                        color: getCSSColor("--popover-foreground"),
                      }}
                      labelFormatter={(value: string | number) =>
                        formatDate(String(value))
                      }
                      formatter={(
                        value: number | string | (string | number)[] | undefined
                      ) => [
                        `${(Number(value) || 0).toFixed(2)}%`,
                        "Utilization",
                      ]}
                    />
                    <Line
                      type="monotone"
                      dataKey="utilization"
                      stroke={getCSSColor("--chart-1")}
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 text-sm">
                <span className="font-medium">Current: </span>
                <span
                  className={
                    advancedMetrics.storageUtilization > 90
                      ? "text-red-500"
                      : advancedMetrics.storageUtilization > 75
                        ? "text-yellow-500"
                        : "text-green-500"
                  }
                >
                  {advancedMetrics.storageUtilization.toFixed(2)}%
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Data Collection Quality */}
          <Card>
            <CardHeader>
              <CardTitle>Data Collection Timeline</CardTitle>
              <p className="text-sm text-muted-foreground">
                Monitoring data availability
              </p>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData.map((d, i, arr) => {
                      if (i === 0) {
                        return {
                          timestamp: d.timestamp,
                          gapMinutes: 0,
                        };
                      }
                      const prevData = arr[i - 1];
                      const timeDiff =
                        (new Date(d.timestamp).getTime() -
                          new Date(prevData.timestamp).getTime()) /
                        (1000 * 60); // minutes
                      return {
                        timestamp: d.timestamp,
                        gapMinutes: timeDiff,
                      };
                    })}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={getCSSColor("--border")}
                    />
                    <XAxis
                      dataKey="timestamp"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => {
                        const date = new Date(value);
                        return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${date.getMinutes().toString().padStart(2, "0")}`;
                      }}
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => `${value}m`}
                    />
                    <Tooltip
                      contentStyle={{
                        fontSize: 12,
                        backgroundColor: getCSSColor("--popover"),
                        border: `1px solid ${getCSSColor("--border")}`,
                        color: getCSSColor("--popover-foreground"),
                      }}
                      labelFormatter={(value: string | number) =>
                        formatDate(String(value))
                      }
                      formatter={(
                        value: number | string | (string | number)[] | undefined
                      ) => [
                        `${(Number(value) || 0).toFixed(1)} min`,
                        "Gap from previous",
                      ]}
                    />
                    <Line
                      type="monotone"
                      dataKey="gapMinutes"
                      stroke={getCSSColor("--chart-4")}
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 text-sm">
                <span className="font-medium">Collection Rate: </span>
                <span
                  className={
                    advancedMetrics.dataCollectionRate > 95
                      ? "text-green-500"
                      : advancedMetrics.dataCollectionRate > 80
                        ? "text-yellow-500"
                        : "text-red-500"
                  }
                >
                  {advancedMetrics.dataCollectionRate.toFixed(1)}%
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Network Position */}
        {networkStats && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Network Position</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">
                    Total Network Nodes
                  </div>
                  <div className="text-2xl font-bold">
                    {networkStats.totalNodes}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Active pods
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">
                    Storage Percentile
                  </div>
                  <div className="text-2xl font-bold">
                    Top {(100 - networkPosition.storagePercentile).toFixed(0)}%
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {networkPosition.vsAvgStorage > 0
                      ? `${networkPosition.vsAvgStorage.toFixed(0)}% above avg`
                      : `${Math.abs(networkPosition.vsAvgStorage).toFixed(0)}% below avg`}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">
                    Uptime Percentile
                  </div>
                  <div className="text-2xl font-bold">
                    Top {(100 - networkPosition.uptimePercentile).toFixed(0)}%
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {networkPosition.vsAvgUptime > 0
                      ? `${networkPosition.vsAvgUptime.toFixed(0)}% above avg`
                      : `${Math.abs(networkPosition.vsAvgUptime).toFixed(0)}% below avg`}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">
                    Network Avg Storage
                  </div>
                  <div className="text-2xl font-bold">
                    {formatBytes(networkStats.avgStorage)}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Avg uptime: {(networkStats.avgUptime / 3600).toFixed(1)}h
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Historical Chart */}
        <Card className="mb-8">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Historical Metrics</CardTitle>
            <div className="flex gap-2">
              {["24h", "7d", "30d"].map((p) => (
                <Button
                  key={p}
                  variant={p === period ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setPeriod(p as "24h" | "7d" | "30d")}
                >
                  {p}
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={getCSSColor("--border")}
                  />
                  <XAxis
                    dataKey="timestamp"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => {
                      const date = new Date(value);
                      return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${date.getMinutes().toString().padStart(2, "0")}`;
                    }}
                  />
                  <YAxis yAxisId="left" tick={{ fontSize: 12 }} width={70} />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 12 }}
                    width={70}
                  />
                  <Tooltip
                    contentStyle={{
                      fontSize: 12,
                      backgroundColor: getCSSColor("--popover"),
                      border: `1px solid ${getCSSColor("--border")}`,
                      color: getCSSColor("--popover-foreground"),
                    }}
                    labelFormatter={(value: string | number) =>
                      formatDate(String(value))
                    }
                    formatter={(
                      value: number | string | (string | number)[] | undefined,
                      name: string | undefined
                    ) => [
                      name?.includes("Uptime")
                        ? `${(Number(value) || 0).toLocaleString()}s`
                        : `${(Number(value) || 0).toFixed(2)} TB`,
                      name || "",
                    ]}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line
                    type="monotone"
                    dataKey="storageCommitted"
                    name="Committed (TB)"
                    stroke={getCSSColor("--chart-1")}
                    strokeWidth={2}
                    dot={false}
                    yAxisId="left"
                  />
                  <Line
                    type="monotone"
                    dataKey="storageUsed"
                    name="Used (TB)"
                    stroke={getCSSColor("--chart-2")}
                    strokeWidth={2}
                    dot={false}
                    yAxisId="left"
                  />
                  <Line
                    type="monotone"
                    dataKey="uptime"
                    name="Uptime (s)"
                    stroke={getCSSColor("--chart-3")}
                    strokeWidth={2}
                    dot={false}
                    yAxisId="right"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Identity Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Identity</CardTitle>
            <p className="text-sm text-muted-foreground">
              Public key and addresses
            </p>
          </CardHeader>
          <CardContent>
            <div className="mb-6">
              <div className="text-xs text-muted-foreground mb-2">
                Public Key
              </div>
              <div className="font-mono text-sm bg-muted px-3 py-2 rounded-md break-all">
                {nodeData.pubkey}
              </div>
            </div>

            <div>
              <div className="text-xs text-muted-foreground mb-3">
                Addresses ({nodeData.addresses.length})
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {nodeData.addresses.map((addr) => (
                  <Card key={addr.address}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="font-mono text-sm break-all flex-1">
                          {addr.address}
                          {addr.rpcPort && `:${addr.rpcPort}`}
                        </div>
                        {addr.isPrimary && (
                          <Badge variant="outline" className="ml-2">
                            Primary
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="secondary">{addr.version}</Badge>
                        {addr.isPublic !== null && (
                          <Badge variant="outline">
                            {addr.isPublic ? "Public" : "Private"}
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div>Uptime: {addr.uptime.toLocaleString()}s</div>
                        <div>Used: {formatBytes(addr.storageUsed)}</div>
                        <div>
                          Committed: {formatBytes(addr.storageCommitted)}
                        </div>
                        <div>Last seen: {formatDate(addr.lastSeen)}</div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Geographic Locations */}
        {!geoLoading && geoData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Geographic Distribution</CardTitle>
              <p className="text-sm text-muted-foreground">
                Node locations across the globe
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Globe Visualization */}
                <div className="relative flex items-center justify-center h-100 lg:h-125 bg-muted/20 rounded-lg overflow-hidden">
                  <WorldMap
                    locations={mapLocations}
                    height="100%"
                    selectedLocation={selectedLocation}
                    onLocationClick={(loc) => {
                      const matchingLocation = geoData.find(
                        (g) => g.lat === loc.lat && g.lng === loc.lng
                      );
                      setSelectedLocation(matchingLocation || null);
                    }}
                  />
                </div>

                {/* Location Details */}
                <div className="space-y-3">
                  <div className="text-sm font-medium mb-4">
                    {geoData.length}{" "}
                    {geoData.length === 1 ? "Location" : "Locations"}
                  </div>
                  <div className="space-y-3 max-h-112.5 overflow-y-auto pr-2">
                    {geoData.map((loc) => (
                      <Card
                        key={loc.ip}
                        className={`cursor-pointer hover:bg-accent transition-colors ${
                          selectedLocation?.lat === loc.lat &&
                          selectedLocation?.lng === loc.lng
                            ? "ring-2 ring-primary"
                            : ""
                        }`}
                        onClick={() => setSelectedLocation(loc)}
                      >
                        <CardContent className="pt-4">
                          <div className="font-mono text-sm mb-2 break-all">
                            {loc.ip}
                          </div>
                          <div className="text-sm space-y-1">
                            <div>
                              <span className="font-medium">Location:</span>{" "}
                              {[loc.city, loc.region, loc.country]
                                .filter(Boolean)
                                .join(", ") || "Unknown"}
                            </div>
                            {loc.isp && (
                              <div className="text-xs text-muted-foreground">
                                ISP: {loc.isp}
                              </div>
                            )}
                            <div className="text-xs text-muted-foreground">
                              Coordinates: {loc.lat.toFixed(4)},{" "}
                              {loc.lng.toFixed(4)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Snapshots: {loc.snapshotCount}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <footer className="mt-12 border-t border-border pt-8 pb-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Image
                src="/xandeum-logo.png"
                alt="Xandeum"
                width={32}
                height={32}
                className="h-8 w-8"
              />
              <div className="text-sm text-muted-foreground">
                <p className="mb-1 font-medium">Xandeum Analytics Dashboard</p>
                <p className="text-xs">
                  Built for the Xandeum ecosystem by{" "}
                  <a
                    href="https://x.com/dharminnagar"
                    className="underline underline-offset-2"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    @dharminnagar
                  </a>
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
              <a
                href="https://github.com/dharminnagar/xandeum-analytics-dashboard"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
              >
                <svg
                  className="h-4 w-4"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    fillRule="evenodd"
                    d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                    clipRule="evenodd"
                  />
                </svg>
                GitHub
              </a>
              <a
                href="https://github.com/dharminnagar/xandeum-cron-bot"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
              >
                <svg
                  className="h-4 w-4"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    fillRule="evenodd"
                    d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                    clipRule="evenodd"
                  />
                </svg>
                Cron Repository
              </a>
              <a
                href="https://docs.xandeum.network/api/pnode-rpc-prpc-reference"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                Xandeum Docs
              </a>
              <a
                href="https://discord.gg/uqRSmmM5m"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
              >
                <svg
                  className="h-4 w-4"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                </svg>
                Discord
              </a>
              <a
                href="https://earn.superteam.fun/listing/build-analytics-platform-for-xandeum-pnodes"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Bounty
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

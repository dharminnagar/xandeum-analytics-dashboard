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
        console.error("Error fetching geolocation data:", error);
      } finally {
        setGeoLoading(false);
      }
    };

    if (id) {
      fetchGeolocation();
    }
  }, [id]);

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

  const primaryAddress = nodeData.addresses.find((a) => a.isPrimary);
  const chartData = nodeData.historical.map((h) => ({
    timestamp: h.timestamp,
    storageUsed: Number(h.storageUsed) / 1024 ** 4,
    storageCommitted: Number(h.storageCommitted) / 1024 ** 4,
    uptime: h.uptime,
  }));

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
                    labelFormatter={(value) => formatDate(String(value))}
                    formatter={(
                      value: number | undefined,
                      name: string | undefined
                    ) => [
                      name?.includes("Uptime")
                        ? `${(value || 0).toLocaleString()}s`
                        : `${(value || 0).toFixed(2)} TB`,
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
      </div>
    </div>
  );
}

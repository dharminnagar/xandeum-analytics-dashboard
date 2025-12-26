"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  BarChart,
  Bar,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { WorldMap } from "@/components/ui/world-map";
import type { GlobalMapLocation } from "@/types/geolocation";
import { getCSSColor } from "@/lib/colors";

type Summary = {
  totalPods: number;
  uniquePubkeys: number;
  activePods: number;
  publicPods: number;
  privatePods: number;
  totalStorageCommitted: string;
  totalStorageUsed: string;
  storageUtilization: number;
  avgUptime: number;
  versions: Record<string, number>;
};

type TrendPoint = {
  timestamp: string;
  podCount: number;
  totalStorage: string;
  usedStorage: string;
  storageUtilization: number;
  avgUptime: number;
  systemCpu?: number;
  systemRam?: number;
};

type TrendApiResponse = {
  period: TrendPeriod;
  startDate: string;
  endDate: string;
  dataPoints: TrendPoint[];
};

type RankingItem = {
  rank: number;
  pubkey: string | null;
  address: string;
  isPublic: boolean | null;
  version: string;
  storageCommitted: string;
  storageUsed: string;
  uptime: number;
  lastSeen: string;
};

type RankingResponse = {
  metric: "storage_committed" | "storage_used" | "uptime" | "version";
  rankings: RankingItem[];
};

type FilteredPod = {
  id: number;
  pubkey: string | null;
  address: string;
  isPublic: boolean | null;
  rpcPort: number | null;
  version: string;
  storageCommitted: string;
  storageUsed: string;
  storageUsagePercent: string;
  uptime: number;
  lastSeen: string;
};

type FilterResponse = {
  pods: FilteredPod[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type CompareMetricPoint = {
  timestamp: string;
  storageUsed: string;
  storageUsagePercent: string;
  uptime: number;
};

type ComparePod = {
  pubkey: string | null;
  address: string;
  isPublic: boolean | null;
  rpcPort: number | null;
  current: {
    version: string;
    storageCommitted: string;
    storageUsed: string;
    storageUsagePercent: string;
    uptime: number;
    lastSeen: string;
  } | null;
  history: CompareMetricPoint[];
};

type CompareResponse = {
  pods: ComparePod[];
  statistics: {
    totalPods: number;
    avgStorageCommitted: string;
    avgStorageUsed: string;
    avgUptime: number;
    publicCount: number;
    versions: string[];
  };
};

type TrendPeriod = "24h" | "7d" | "30d";
type RankingMetric =
  | "storage_committed"
  | "storage_used"
  | "uptime"
  | "version";
type WithData<T> = { data: T };
type FilterResponseLike = WithData<FilterResponse> | FilterResponse | null;
type CompareResponseLike = WithData<CompareResponse> | CompareResponse | null;

type CompareChartRow = {
  timestamp: string;
} & Record<string, number | string>;

const formatBytes = (value: string | number | null) => {
  if (!value && value !== 0) return "N/A";
  const num = typeof value === "string" ? Number(value) : value;
  const tb = num / 1024 ** 4;
  if (tb >= 1) return `${tb.toFixed(2)} TB`;
  const gb = num / 1024 ** 3;
  return `${gb.toFixed(2)} GB`;
};

const formatPercent = (value: number | string | null) => {
  if (!value && value !== 0) return "N/A";
  const num = typeof value === "string" ? Number(value) : value;
  return `${num.toFixed(1)}%`;
};

const formatNumericValue = (value: number | string) => {
  if (typeof value !== "number") return value;
  if (Number.isInteger(value)) return value;
  return Number(value.toFixed(4));
};

const formatStorageFromTb = (value: number | string) => {
  const num = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(num)) return value;
  if (num >= 1) return `${num.toFixed(4)} TB`;
  return `${(num * 1024).toFixed(4)} GB`;
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

async function fetchJSON<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    return data.data ?? data;
  } catch (err) {
    console.error("fetch error", url, err);
    return null;
  }
}

// async function fetchJSONWithInit<T>(
//   url: string,
//   init?: RequestInit
// ): Promise<T | null> {
//   try {
//     const res = await fetch(url, { cache: "no-store", ...init });
//     if (!res.ok) return null;
//     const data = await res.json();
//     return data.data ?? data;
//   } catch (err) {
//     console.error("fetch error", url, err);
//     return null;
//   }
// }

function extractData<T>(value: WithData<T> | T | null): T | null {
  if (value && typeof value === "object" && "data" in value) {
    return (value as WithData<T>).data;
  }
  return value as T | null;
}

export default function Home() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [trends, setTrends] = useState<TrendPoint[]>([]);
  const [trendPeriod, setTrendPeriod] = useState<TrendPeriod>("24h");
  const [rankings, setRankings] = useState<RankingResponse | null>(null);
  const [rankingMetric, setRankingMetric] =
    useState<RankingMetric>("storage_committed");
  const [allPods, setAllPods] = useState<FilteredPod[]>([]);
  const [filterPage, setFilterPage] = useState(1);
  const [filterSearch, setFilterSearch] = useState("");
  const [filterVersion, setFilterVersion] = useState("");
  const [filterIsPublic, setFilterIsPublic] = useState("");
  const [filterMinStorage, setFilterMinStorage] = useState("");
  const [filterMaxStorage, setFilterMaxStorage] = useState("");
  const [filterMinUptime, setFilterMinUptime] = useState("");
  const itemsPerPage = 50;
  const [selectedPods, setSelectedPods] = useState<string[]>([]);
  const [compareSearch, setCompareSearch] = useState("");
  const [showCompareList, setShowCompareList] = useState(false);
  const [compareData, setCompareData] = useState<CompareResponse | null>(null);
  const [compareMetric, setCompareMetric] = useState<
    "used" | "committed" | "percent" | "uptime"
  >("used");
  const [loading, setLoading] = useState(true);
  const [trendsLoading, setTrendsLoading] = useState(false);
  const [rankingsLoading, setRankingsLoading] = useState(false);
  const [filterLoading, setFilterLoading] = useState(false);
  const [compareLoading, setCompareLoading] = useState(false);
  const [geoLocations, setGeoLocations] = useState<GlobalMapLocation[]>([]);
  const [geoLoading, setGeoLoading] = useState(false);
  const [selectedLocation, setSelectedLocation] =
    useState<GlobalMapLocation | null>(null);
  const [isLive, setIsLive] = useState(true);

  // Get theme-aware chart colors
  const chartColors = useMemo(
    () => ({
      primary: getCSSColor("--chart-1"),
      secondary: getCSSColor("--chart-2"),
      tertiary: getCSSColor("--chart-3"),
    }),
    []
  );

  const trendData = useMemo(
    () => (Array.isArray(trends) ? trends : []),
    [trends]
  );

  // Polling for live data updates
  useEffect(() => {
    const loadData = async () => {
      try {
        const [summaryResp, geoResp] = await Promise.all([
          fetchJSON<Summary>("/api/stats/summary"),
          fetch("/api/geolocation", { cache: "no-store" }).then((res) =>
            res.ok ? res.json() : null
          ),
        ]);

        if (summaryResp) {
          setSummary(summaryResp);
          setIsLive(true);
        } else {
          setIsLive(false);
        }

        if (geoResp?.locations) {
          setGeoLocations(geoResp.locations);
        }

        setLoading(false);
        setGeoLoading(false);
      } catch (error) {
        console.error("Error fetching data:", error);
        setIsLive(false);
        setLoading(false);
        setGeoLoading(false);
      }
    };

    // Initial load
    loadData();

    // Poll every 7 seconds
    const pollInterval = setInterval(loadData, 30000);

    return () => clearInterval(pollInterval);
  }, []);

  // Format locations for WorldMap
  const mapLocations = useMemo(() => {
    return geoLocations.map((loc) => ({
      lat: loc.lat,
      lng: loc.lng,
      ip: loc.ip,
      city: loc.city,
      country: loc.country,
      nodeCount: loc.nodeCount,
      label: `${[loc.city, loc.country].filter(Boolean).join(", ") || "Unknown"} - ${loc.nodeCount} ${loc.nodeCount === 1 ? "node" : "nodes"}`,
      pubkeys: loc.pubkeys,
    }));
  }, [geoLocations]);

  // Group locations by city+country to avoid duplicates in the list
  const groupedLocations = useMemo(() => {
    const locationMap = new Map<
      string,
      (typeof geoLocations)[0] & {
        ips: string[];
        versions: Record<string, number>;
        totalStorageCommitted: number;
        totalStorageUsed: number;
        avgUptime: number;
        publicCount: number;
        privateCount: number;
        lastSeenTimestamp: string;
      }
    >();

    geoLocations.forEach((loc) => {
      const key = `${loc.city || "Unknown"}-${loc.country || "Unknown"}`;
      const existing = locationMap.get(key);

      // Find pods at this location
      const podsAtLocation = allPods.filter((pod) =>
        loc.pubkeys.includes(pod.pubkey || "")
      );

      // Aggregate metrics
      const versions: Record<string, number> = {};
      let totalCommitted = 0;
      let totalUsed = 0;
      let totalUptime = 0;
      let publicCount = 0;
      let privateCount = 0;

      podsAtLocation.forEach((pod) => {
        versions[pod.version] = (versions[pod.version] || 0) + 1;
        totalCommitted += Number(pod.storageCommitted) || 0;
        totalUsed += Number(pod.storageUsed) || 0;
        totalUptime += pod.uptime || 0;
        if (pod.isPublic) publicCount++;
        else privateCount++;
      });

      const avgUptime =
        podsAtLocation.length > 0 ? totalUptime / podsAtLocation.length : 0;

      if (existing) {
        existing.nodeCount += loc.nodeCount;
        existing.ips.push(loc.ip);
        existing.pubkeys = [...new Set([...existing.pubkeys, ...loc.pubkeys])];

        // Merge versions
        Object.entries(versions).forEach(([ver, count]) => {
          existing.versions[ver] = (existing.versions[ver] || 0) + count;
        });
        existing.totalStorageCommitted += totalCommitted;
        existing.totalStorageUsed += totalUsed;
        existing.avgUptime = (existing.avgUptime + avgUptime) / 2;
        existing.publicCount += publicCount;
        existing.privateCount += privateCount;
        if (loc.lastSeen > existing.lastSeenTimestamp) {
          existing.lastSeenTimestamp = loc.lastSeen;
        }
      } else {
        locationMap.set(key, {
          ...loc,
          ips: [loc.ip],
          versions,
          totalStorageCommitted: totalCommitted,
          totalStorageUsed: totalUsed,
          avgUptime,
          publicCount,
          privateCount,
          lastSeenTimestamp: loc.lastSeen,
        });
      }
    });

    return Array.from(locationMap.values()).sort(
      (a, b) => b.nodeCount - a.nodeCount
    );
  }, [geoLocations, allPods]);

  useEffect(() => {
    const loadTrends = async () => {
      setTrendsLoading(true);
      const trendResp = await fetchJSON<TrendApiResponse | TrendPoint[]>(
        `/api/stats/trends?period=${trendPeriod}`
      );
      if (trendResp) {
        if (Array.isArray(trendResp)) {
          setTrends(trendResp);
        } else {
          setTrends(
            Array.isArray(trendResp.dataPoints) ? trendResp.dataPoints : []
          );
        }
      }
      setTrendsLoading(false);
    };
    loadTrends();
  }, [trendPeriod]);

  useEffect(() => {
    const loadRankings = async () => {
      setRankingsLoading(true);
      const rankingResp = await fetchJSON<RankingResponse>(
        `/api/pods/rankings?metric=${rankingMetric}&limit=10`
      );
      if (rankingResp) setRankings(rankingResp);
      setRankingsLoading(false);
    };
    loadRankings();
  }, [rankingMetric]);

  useEffect(() => {
    const loadFilter = async () => {
      setFilterLoading(true);
      const params = new URLSearchParams();
      if (filterSearch) params.set("search", filterSearch);
      if (filterVersion) params.set("version", filterVersion);
      if (filterIsPublic) params.set("isPublic", filterIsPublic);
      if (filterMinStorage) params.set("minStorage", filterMinStorage);
      if (filterMaxStorage) params.set("maxStorage", filterMaxStorage);
      if (filterMinUptime) params.set("minUptime", filterMinUptime);

      const resp: FilterResponseLike = await fetchJSON<
        WithData<FilterResponse> | FilterResponse
      >(`/api/pods/filter?${params.toString()}`);
      const parsed = extractData(resp);
      if (parsed) {
        setAllPods(parsed.pods);
        setFilterPage(1); // Reset to first page on filter change
      }
      setFilterLoading(false);
    };
    loadFilter();
  }, [
    filterSearch,
    filterVersion,
    filterIsPublic,
    filterMinStorage,
    filterMaxStorage,
    filterMinUptime,
  ]);

  // Client-side pagination
  const filterData = useMemo(() => {
    const startIdx = (filterPage - 1) * itemsPerPage;
    const endIdx = startIdx + itemsPerPage;
    const paginatedPods = allPods.slice(startIdx, endIdx);
    const totalPages = Math.ceil(allPods.length / itemsPerPage);

    return {
      pods: paginatedPods,
      pagination: {
        page: filterPage,
        limit: itemsPerPage,
        total: allPods.length,
        totalPages,
      },
    };
  }, [allPods, filterPage, itemsPerPage]);

  const handleCompare = async () => {
    if (selectedPods.length === 0) return;
    setCompareLoading(true);
    const resp: CompareResponseLike = await fetchJSON<
      WithData<CompareResponse> | CompareResponse
    >(`/api/pods/compare?pods=${encodeURIComponent(selectedPods.join(","))}`);
    const parsed = extractData(resp);
    if (parsed) setCompareData(parsed);
    setCompareLoading(false);
  };

  const togglePodSelection = (identifier: string) => {
    setSelectedPods((prev) => {
      if (prev.includes(identifier)) {
        return prev.filter((p) => p !== identifier);
      } else if (prev.length < 3) {
        return [...prev, identifier];
      }
      return prev;
    });
  };

  const filteredPodsForCompare = useMemo(() => {
    if (!compareSearch) return allPods.slice(0, 20);
    const search = compareSearch.toLowerCase();
    return allPods
      .filter(
        (pod) =>
          (pod.pubkey && pod.pubkey.toLowerCase().includes(search)) ||
          pod.address.toLowerCase().includes(search) ||
          pod.version.toLowerCase().includes(search)
      )
      .slice(0, 20);
  }, [allPods, compareSearch]);

  const versionOptions = useMemo(() => {
    if (!summary) return [] as string[];
    return Object.keys(summary.versions).sort();
  }, [summary]);

  const rankingData = useMemo(() => {
    if (!rankings?.rankings) return [] as RankingItem[];
    return [...rankings.rankings].sort((a, b) => a.rank - b.rank);
  }, [rankings]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="mx-auto max-w-7xl px-6 py-10">
          <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
            <div>
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-9 w-64" />
            </div>
            <div className="flex items-center gap-4">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-9 w-9 rounded-md" />
            </div>
          </header>

          <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardContent className="pt-6">
                  <Skeleton className="h-4 w-32 mb-2" />
                  <Skeleton className="h-8 w-20 mb-4" />
                  <Skeleton className="h-3 w-24 mb-1" />
                  <Skeleton className="h-3 w-16" />
                </CardContent>
              </Card>
            ))}
          </section>

          <section className="mb-8">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <Skeleton className="h-6 w-32 mb-1" />
                <Skeleton className="h-4 w-48" />
              </div>
              <div className="flex gap-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-9 w-16" />
                ))}
              </div>
            </div>
            <Card>
              <CardContent className="pt-6">
                <Skeleton className="h-72 w-full" />
              </CardContent>
            </Card>
          </section>

          <section className="mb-8 grid gap-6 lg:grid-cols-2">
            {[1, 2].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-32" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-64 w-full" />
                </CardContent>
              </Card>
            ))}
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Image
              src="/xandeum-logo.png"
              alt="Xandeum"
              width={40}
              height={40}
              className="h-10 w-10"
            />
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Xandeum
              </p>
              <h1 className="text-3xl font-semibold">Analytics Dashboard</h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span
                className={`h-2 w-2 rounded-full ${
                  isLive ? "bg-emerald-500 animate-pulse" : "bg-red-500"
                }`}
                aria-hidden
              />
              {isLive ? "Live metrics" : "Recent Metrics"}
            </div>
            <ModeToggle />
          </div>
        </header>

        {summary && (
          <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Total Pod Addresses"
              value={summary.totalPods.toLocaleString()}
              helper="Unique Pubkeys"
              helperValue={summary.uniquePubkeys.toLocaleString()}
            />
            <StatCard
              label="Active Pods"
              value={summary.activePods.toLocaleString()}
            />
            <StatCard
              label="Storage Used"
              value={formatBytes(summary.totalStorageUsed)}
              helper="of committed"
              helperValue={formatBytes(summary.totalStorageCommitted)}
            />
            <StatCard
              label="Avg Uptime"
              value={`${summary.avgUptime.toLocaleString()}s`}
              helper="Utilization"
              helperValue={formatPercent(summary.storageUtilization)}
            />
          </section>
        )}

        {/* Global Node Distribution */}
        {!geoLoading && geoLocations.length > 0 && (
          <section className="mb-8">
            <Card>
              <CardHeader>
                <CardTitle>Global Node Distribution</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {geoLocations.length} locations ·{" "}
                  {geoLocations.reduce((sum, loc) => sum + loc.nodeCount, 0)}{" "}
                  nodes worldwide
                </p>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
                  {/* Globe Visualization */}
                  <div className="relative flex items-center justify-center h-100 lg:h-125 bg-muted/20 rounded-lg overflow-hidden">
                    <WorldMap
                      locations={mapLocations}
                      height="100%"
                      selectedLocation={selectedLocation}
                      onLocationClick={(loc) => {
                        const matchingLocation = geoLocations.find(
                          (g) => g.lat === loc.lat && g.lng === loc.lng
                        );
                        setSelectedLocation(matchingLocation || null);
                      }}
                    />
                  </div>

                  {/* Location Info Panel */}
                  <div className="space-y-4">
                    <div className="text-sm font-medium">Top Locations</div>
                    <div className="space-y-3 max-h-112.5 overflow-y-auto pr-2">
                      {groupedLocations.slice(0, 10).map((loc, idx) => (
                        <Card
                          key={`${loc.city}-${loc.country}-${idx}`}
                          className={`cursor-pointer hover:bg-accent transition-colors ${
                            selectedLocation?.lat === loc.lat &&
                            selectedLocation?.lng === loc.lng
                              ? "ring-2 ring-primary"
                              : ""
                          }`}
                          onClick={() => setSelectedLocation(loc)}
                        >
                          <CardContent className="pt-4">
                            <div className="flex items-start justify-between mb-2">
                              <div className="text-sm font-medium">
                                {[loc.city, loc.country]
                                  .filter(Boolean)
                                  .join(", ") || "Unknown"}
                              </div>
                              <Badge variant="secondary">
                                {loc.nodeCount}{" "}
                                {loc.nodeCount === 1 ? "node" : "nodes"}
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span>IPs:</span>
                                <span className="font-medium">
                                  {loc.ips?.length || 1}
                                </span>
                              </div>

                              {loc.isp && (
                                <div className="flex items-center justify-between">
                                  <span>ISP:</span>
                                  <span
                                    className="font-medium truncate max-w-45"
                                    title={loc.isp}
                                  >
                                    {loc.isp}
                                  </span>
                                </div>
                              )}

                              {loc.totalStorageCommitted > 0 && (
                                <div className="pt-1 border-t border-border/50">
                                  <div className="flex items-center justify-between">
                                    <span>Total Storage:</span>
                                    <span className="font-medium">
                                      {formatBytes(loc.totalStorageCommitted)}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span>Used:</span>
                                    <span className="font-medium">
                                      {formatBytes(loc.totalStorageUsed)}
                                    </span>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <span>Utilization:</span>
                                    <span className="font-medium">
                                      {(
                                        (loc.totalStorageUsed /
                                          loc.totalStorageCommitted) *
                                        100
                                      ).toFixed(1)}
                                      %
                                    </span>
                                  </div>
                                </div>
                              )}

                              {loc.avgUptime > 0 && (
                                <div className="flex items-center justify-between pt-1 border-t border-border/50">
                                  <span>Avg Uptime:</span>
                                  <span className="font-medium">
                                    {loc.avgUptime.toLocaleString(undefined, {
                                      maximumFractionDigits: 0,
                                    })}
                                    s
                                  </span>
                                </div>
                              )}

                              {Object.keys(loc.versions || {}).length > 0 && (
                                <div className="pt-1 border-t border-border/50">
                                  <div className="font-medium mb-1">
                                    Versions:
                                  </div>
                                  <div className="flex flex-wrap gap-1">
                                    {Object.entries(loc.versions).map(
                                      ([version, count]) => (
                                        <Badge
                                          key={version}
                                          variant="outline"
                                          className="text-xs px-1.5 py-0"
                                        >
                                          {count}x {version}
                                        </Badge>
                                      )
                                    )}
                                  </div>
                                </div>
                              )}

                              {(loc.publicCount > 0 ||
                                loc.privateCount > 0) && (
                                <div className="flex items-center gap-2 pt-1 border-t border-border/50">
                                  <Badge
                                    variant="default"
                                    className="text-xs px-1.5 py-0"
                                  >
                                    {loc.publicCount} Public
                                  </Badge>
                                  <Badge
                                    variant="secondary"
                                    className="text-xs px-1.5 py-0"
                                  >
                                    {loc.privateCount} Private
                                  </Badge>
                                </div>
                              )}

                              <div className="flex items-center justify-between pt-1 border-t border-border/50">
                                <span>Last Seen:</span>
                                <span className="font-medium">
                                  {
                                    formatDate(loc.lastSeenTimestamp).split(
                                      ","
                                    )[0]
                                  }
                                </span>
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
          </section>
        )}

        <section className="mb-8">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Trends</h2>
              <p className="text-sm text-muted-foreground">
                Storage and uptime over time
              </p>
            </div>
            <div className="flex gap-2 text-sm">
              {["24h", "7d", "30d"].map((p) => (
                <Button
                  key={p}
                  variant={p === trendPeriod ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setTrendPeriod(p as TrendPeriod)}
                >
                  {p}
                </Button>
              ))}
            </div>
          </div>
          <Card>
            <CardContent className="pt-6">
              {trendsLoading ? (
                <div className="h-72 flex items-center justify-center">
                  <Skeleton className="h-full w-full" />
                </div>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={trendData}
                      margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid
                        stroke={getCSSColor("--border")}
                        strokeDasharray="3 3"
                      />
                      <XAxis dataKey="timestamp" tick={{ fontSize: 12 }} hide />
                      <YAxis
                        tick={{ fontSize: 12, fill: "#94a3b8" }}
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
                        formatter={(value, name) =>
                          String(name)?.includes("Uptime")
                            ? [
                                formatNumericValue(value as number | string),
                                name,
                              ]
                            : [
                                formatStorageFromTb(value as number | string),
                                name,
                              ]
                        }
                      />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Line
                        type="monotone"
                        dataKey={(p) => Number(p.usedStorage) / 1024 ** 4}
                        name="Used (TB)"
                        stroke={chartColors.primary}
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey={(p) => Number(p.totalStorage) / 1024 ** 4}
                        name="Committed (TB)"
                        stroke={chartColors.secondary}
                        strokeWidth={1.5}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="avgUptime"
                        name="Avg Uptime (s)"
                        stroke={chartColors.tertiary}
                        strokeWidth={1.5}
                        dot={false}
                        yAxisId={1}
                      />
                      <YAxis
                        yAxisId={1}
                        orientation="right"
                        tick={{ fontSize: 12, fill: "#94a3b8" }}
                        width={60}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="mb-8 grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-lg">Top Pods</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Ranking by metric
                </p>
              </div>
              <div className="flex gap-2 text-sm">
                {["storage_committed", "storage_used", "uptime", "version"].map(
                  (m) => (
                    <Button
                      key={m}
                      variant={m === rankingMetric ? "default" : "ghost"}
                      size="sm"
                      onClick={() => setRankingMetric(m as RankingMetric)}
                    >
                      {m.replace("_", " ")}
                    </Button>
                  )
                )}
              </div>
            </CardHeader>
            <CardContent>
              {rankingsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-14">#</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead>Version</TableHead>
                      <TableHead>Storage Used</TableHead>
                      <TableHead>Committed</TableHead>
                      <TableHead>Uptime</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rankingData.map((item) => (
                      <TableRow
                        key={item.rank}
                        className="hover:bg-muted/50 cursor-pointer"
                        onClick={() => {
                          const identifier = item.pubkey || item.address;
                          window.location.href = `/node/${encodeURIComponent(identifier)}`;
                        }}
                      >
                        <TableCell className="font-medium">
                          {item.rank}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {item.address}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{item.version}</Badge>
                        </TableCell>
                        <TableCell>{formatBytes(item.storageUsed)}</TableCell>
                        <TableCell>
                          {formatBytes(item.storageCommitted)}
                        </TableCell>
                        <TableCell>{item.uptime.toLocaleString()}s</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Rankings (bar)</CardTitle>
            </CardHeader>
            <CardContent className="pl-0 pr-4 pt-4">
              {rankingsLoading ? (
                <div className="h-72 w-full flex items-center justify-center">
                  <Skeleton className="h-full w-full" />
                </div>
              ) : (
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={rankingData}
                      layout="vertical"
                      margin={{ left: 0, right: 16 }}
                    >
                      <CartesianGrid
                        stroke={getCSSColor("--border")}
                        strokeDasharray="3 3"
                      />
                      <XAxis
                        type="number"
                        tick={{
                          fontSize: 12,
                          fill: getCSSColor("--foreground"),
                        }}
                      />
                      <YAxis
                        dataKey="address"
                        type="category"
                        tick={{
                          fontSize: 12,
                          fill: getCSSColor("--foreground"),
                        }}
                        width={220}
                        tickFormatter={(addr) => {
                          const item = rankingData.find(
                            (r) => r.address === addr
                          );
                          return item ? `#${item.rank}: ${addr}` : addr;
                        }}
                      />
                      <Tooltip
                        contentStyle={{
                          fontSize: 12,
                          backgroundColor: getCSSColor("--popover"),
                          border: `1px solid ${getCSSColor("--border")}`,
                          color: getCSSColor("--popover-foreground"),
                        }}
                        formatter={(value, name) => [
                          formatStorageFromTb(value as number | string),
                          name,
                        ]}
                      />
                      <Bar
                        dataKey={(d) => Number(d.storageUsed) / 1024 ** 4}
                        name="Used (TB)"
                        fill={chartColors.primary}
                        barSize={18}
                        radius={4}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Compare Pods</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Select up to 3 pods to compare their metrics and history
                  </p>
                </div>
                <Button
                  onClick={handleCompare}
                  disabled={compareLoading || selectedPods.length === 0}
                  size="sm"
                >
                  {compareLoading
                    ? "Comparing..."
                    : `Compare ${selectedPods.length > 0 ? `(${selectedPods.length})` : ""}`}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Selected Pods */}
              {selectedPods.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Selected ({selectedPods.length}/3)
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {selectedPods.map((podId) => {
                      const pod = allPods.find(
                        (p) =>
                          (p.pubkey && p.pubkey === podId) ||
                          p.address === podId
                      );
                      return (
                        <Badge
                          key={podId}
                          variant="secondary"
                          className="pl-2 pr-1 py-1 flex items-center gap-1.5"
                        >
                          <span className="font-mono text-xs max-w-40 truncate">
                            {pod?.pubkey || pod?.address || podId}
                          </span>
                          <button
                            onClick={() => togglePodSelection(podId)}
                            className="ml-1 rounded-sm hover:bg-muted"
                          >
                            <span className="text-xs">×</span>
                          </button>
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Search and Pod List */}
              <Accordion
                type="single"
                collapsible
                value={showCompareList ? "select" : ""}
              >
                <AccordionItem
                  value="select"
                  className="border rounded-lg px-4"
                >
                  <AccordionTrigger
                    className="hover:no-underline"
                    onClick={() => setShowCompareList(!showCompareList)}
                  >
                    <span className="text-sm font-semibold">
                      {showCompareList ? "Hide" : "Select"} Pods from List
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-3 pt-2">
                      <input
                        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:border-ring focus:outline-none"
                        placeholder="Search by address, pubkey, or version..."
                        value={compareSearch}
                        onChange={(e) => setCompareSearch(e.target.value)}
                      />
                      <div className="max-h-80 overflow-y-auto space-y-2">
                        {filteredPodsForCompare.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            No pods found
                          </p>
                        ) : (
                          filteredPodsForCompare.map((pod) => {
                            const identifier = pod.pubkey || pod.address;
                            const isSelected =
                              selectedPods.includes(identifier);
                            return (
                              <div
                                key={pod.id}
                                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                                  isSelected
                                    ? "border-primary bg-primary/5"
                                    : "border-border hover:bg-accent"
                                }`}
                                onClick={() => togglePodSelection(identifier)}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() =>
                                    togglePodSelection(identifier)
                                  }
                                  className="h-4 w-4 rounded border-input"
                                  disabled={
                                    !isSelected && selectedPods.length >= 3
                                  }
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="font-mono text-xs truncate">
                                      {pod.pubkey || "N/A"}
                                    </span>
                                    <Badge
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      {pod.version}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                    <span>Address: {pod.address}</span>
                                    <span>
                                      Storage: {formatBytes(pod.storageUsed)}
                                    </span>
                                    <span>
                                      Uptime: {pod.uptime.toLocaleString()}s
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                      {filteredPodsForCompare.length > 0 && (
                        <p className="text-xs text-muted-foreground text-center">
                          Showing {filteredPodsForCompare.length} of{" "}
                          {allPods.length} pods
                        </p>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>

          {compareData && (
            <Card className="mt-2">
              <CardContent className="pt-4">
                <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Pods</p>
                    <p className="font-semibold">
                      {compareData.statistics.totalPods}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Avg Committed</p>
                    <p className="font-semibold">
                      {formatBytes(compareData.statistics.avgStorageCommitted)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Avg Used</p>
                    <p className="font-semibold">
                      {formatBytes(compareData.statistics.avgStorageUsed)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Avg Uptime</p>
                    <p className="font-semibold">
                      {compareData.statistics.avgUptime.toLocaleString()}s
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Address</TableHead>
                        <TableHead>Version</TableHead>
                        <TableHead>Committed</TableHead>
                        <TableHead>Used</TableHead>
                        <TableHead>Uptime</TableHead>
                        <TableHead>Last Seen</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {compareData.pods.map((pod) => (
                        <TableRow
                          key={pod.address}
                          className="hover:bg-muted/50"
                        >
                          <TableCell className="font-mono text-xs">
                            {pod.address}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {pod.current?.version ?? "-"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {pod.current
                              ? formatBytes(pod.current.storageCommitted)
                              : "-"}
                          </TableCell>
                          <TableCell>
                            {pod.current
                              ? formatBytes(pod.current.storageUsed)
                              : "-"}
                          </TableCell>
                          <TableCell>
                            {pod.current ? `${pod.current.uptime}s` : "-"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {pod.current
                              ? formatDate(pod.current.lastSeen)
                              : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="mt-6">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold">
                      {compareMetric === "used" && "Storage Used Over Time"}
                      {compareMetric === "committed" &&
                        "Storage Committed Over Time"}
                      {compareMetric === "percent" &&
                        "Storage Usage Percentage Over Time"}
                      {compareMetric === "uptime" && "Uptime Over Time"}
                    </h3>
                    <div className="flex gap-2 text-sm">
                      {[
                        { value: "used" as const, label: "Used" },
                        { value: "committed" as const, label: "Committed" },
                        { value: "percent" as const, label: "Usage %" },
                        { value: "uptime" as const, label: "Uptime" },
                      ].map((m) => (
                        <Button
                          key={m.value}
                          variant={
                            m.value === compareMetric ? "default" : "ghost"
                          }
                          size="sm"
                          onClick={() => setCompareMetric(m.value)}
                        >
                          {m.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={mergeCompareHistory(
                          compareData.pods,
                          compareMetric
                        )}
                        margin={{ left: 10, right: 20 }}
                      >
                        <CartesianGrid
                          stroke={getCSSColor("--border")}
                          strokeDasharray="3 3"
                        />
                        <XAxis
                          dataKey="timestamp"
                          tick={{ fontSize: 12 }}
                          hide
                        />
                        <YAxis
                          tick={{ fontSize: 12, fill: "#94a3b8" }}
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
                          formatter={(value, name) => {
                            if (compareMetric === "percent") {
                              return [`${Number(value).toFixed(2)}%`, name];
                            } else if (compareMetric === "uptime") {
                              return [
                                `${Number(value).toLocaleString()}s`,
                                name,
                              ];
                            } else {
                              return [
                                formatStorageFromTb(value as number | string),
                                name,
                              ];
                            }
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        {compareData.pods.map((pod, idx) => {
                          const color =
                            idx === 0
                              ? chartColors.primary
                              : idx === 1
                                ? chartColors.secondary
                                : chartColors.tertiary;
                          return (
                            <Line
                              key={pod.address}
                              type="monotone"
                              dataKey={pod.address}
                              stroke={color}
                              strokeWidth={2}
                              dot={false}
                            />
                          );
                        })}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </section>

        <hr className="my-8" />

        <section className="my-4">
          <div className="mb-4">
            <h2 className="text-lg font-semibold mb-1">All Pods</h2>
            <p className="text-sm text-muted-foreground">
              View and filter all pods in the network
            </p>
          </div>

          <Accordion type="single" collapsible className="mb-3">
            <AccordionItem value="filters" className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <span className="text-base font-semibold">Filters</span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 pt-2">
                  <div className="lg:col-span-2">
                    <span className="text-base font-semibold">Filters</span>
                  </div>
                </div>
              </AccordionContent>
              <AccordionContent>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 pt-2">
                  <div className="lg:col-span-2">
                    <label className="text-xs text-muted-foreground mb-1.5 block">
                      Search
                    </label>
                    <input
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:border-ring focus:outline-none"
                      placeholder="Address or pubkey..."
                      value={filterSearch}
                      onChange={(e) => {
                        setFilterPage(1);
                        setFilterSearch(e.target.value);
                      }}
                    />
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">
                      Visibility
                    </label>
                    <select
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={filterIsPublic}
                      onChange={(e) => {
                        setFilterPage(1);
                        setFilterIsPublic(e.target.value);
                      }}
                    >
                      <option value="">All</option>
                      <option value="true">Public</option>
                      <option value="false">Private</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">
                      Version
                    </label>
                    <select
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={filterVersion}
                      onChange={(e) => {
                        setFilterPage(1);
                        setFilterVersion(e.target.value);
                      }}
                    >
                      <option value="">All</option>
                      {versionOptions.map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">
                      Min Storage (GB)
                    </label>
                    <input
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                      placeholder="0"
                      type="number"
                      value={filterMinStorage}
                      onChange={(e) => {
                        setFilterPage(1);
                        setFilterMinStorage(e.target.value);
                      }}
                    />
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">
                      Max Storage (GB)
                    </label>
                    <input
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                      placeholder="∞"
                      type="number"
                      value={filterMaxStorage}
                      onChange={(e) => {
                        setFilterPage(1);
                        setFilterMaxStorage(e.target.value);
                      }}
                    />
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">
                      Min Uptime (s)
                    </label>
                    <input
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                      placeholder="0"
                      type="number"
                      value={filterMinUptime}
                      onChange={(e) => {
                        setFilterPage(1);
                        setFilterMinUptime(e.target.value);
                      }}
                    />
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <Card>
            <CardContent className="pt-4">
              {filterLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Public Key</TableHead>
                        <TableHead>Addresses</TableHead>
                        <TableHead>Version</TableHead>
                        <TableHead>Public</TableHead>
                        <TableHead>Storage Used</TableHead>
                        <TableHead>Committed</TableHead>
                        <TableHead>Uptime</TableHead>
                        <TableHead>Last Seen</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        if (!filterData) return null;

                        // Group pods by pubkey
                        const grouped = new Map<string, FilteredPod[]>();
                        filterData.pods.forEach((pod) => {
                          const key = pod.pubkey || `no-pubkey-${pod.id}`;
                          if (!grouped.has(key)) {
                            grouped.set(key, []);
                          }
                          grouped.get(key)!.push(pod);
                        });

                        return Array.from(grouped.entries()).map(
                          ([pubkey, pods]) => {
                            // Use the most recent pod for display metrics
                            const latestPod = pods.reduce((latest, current) =>
                              new Date(current.lastSeen) >
                              new Date(latest.lastSeen)
                                ? current
                                : latest
                            );

                            return (
                              <TableRow
                                key={pubkey}
                                className="hover:bg-muted/50 cursor-pointer"
                                onClick={() => {
                                  const validPubkey = pubkey.startsWith(
                                    "no-pubkey-"
                                  )
                                    ? latestPod.address
                                    : pubkey;
                                  window.location.href = `/node/${encodeURIComponent(validPubkey)}`;
                                }}
                              >
                                <TableCell className="font-mono text-xs">
                                  {pubkey.startsWith("no-pubkey-")
                                    ? "N/A"
                                    : pubkey}
                                </TableCell>
                                <TableCell className="font-mono text-xs">
                                  <div className="flex flex-col gap-0.5">
                                    {pods.map((pod) => (
                                      <div key={pod.id}>{pod.address}</div>
                                    ))}
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="secondary">
                                    {latestPod.version}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <Badge variant="outline">
                                    {latestPod.isPublic ? "Public" : "Private"}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {formatBytes(latestPod.storageUsed)}
                                </TableCell>
                                <TableCell>
                                  {formatBytes(latestPod.storageCommitted)}
                                </TableCell>
                                <TableCell>
                                  {latestPod.uptime.toLocaleString()}s
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  {formatDate(latestPod.lastSeen)}
                                </TableCell>
                              </TableRow>
                            );
                          }
                        );
                      })()}
                    </TableBody>
                  </Table>
                  <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
                    <span>
                      Page {filterData?.pagination.page} /{" "}
                      {filterData?.pagination.totalPages || 1}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={filterPage <= 1}
                        onClick={() => setFilterPage((p) => Math.max(1, p - 1))}
                      >
                        Prev
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={
                          !!filterData &&
                          filterPage >= filterData.pagination.totalPages
                        }
                        onClick={() => setFilterPage((p) => p + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

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

function StatCard({
  label,
  value,
  helper,
  helperValue,
}: {
  label: string;
  value: string;
  helper?: string;
  helperValue?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold">{value}</p>
        {helper && helperValue && (
          <p className="mt-1 text-xs text-muted-foreground">
            {helper}: <span className="font-medium">{helperValue}</span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function mergeCompareHistory(
  pods: ComparePod[],
  metric: "used" | "committed" | "percent" | "uptime" = "used"
) {
  const map = new Map<string, CompareChartRow>();
  pods.forEach((pod) => {
    pod.history.forEach((point) => {
      const key = point.timestamp;
      if (!map.has(key)) map.set(key, { timestamp: key });
      const entry = map.get(key)!;

      if (metric === "used") {
        entry[pod.address] = Number(point.storageUsed) / 1024 ** 4;
      } else if (metric === "committed") {
        // Committed might not be in history, use current value
        entry[pod.address] = pod.current
          ? Number(pod.current.storageCommitted) / 1024 ** 4
          : 0;
      } else if (metric === "percent") {
        entry[pod.address] = Number(point.storageUsagePercent);
      } else if (metric === "uptime") {
        entry[pod.address] = point.uptime;
      }
    });
  });
  return Array.from(map.values()).sort((a, b) =>
    a.timestamp.localeCompare(b.timestamp)
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
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

// Helper to get computed CSS color values
const getCSSColor = (variable: string): string => {
  if (typeof window === "undefined") return "#3b82f6";
  const root = document.documentElement;
  const value = getComputedStyle(root).getPropertyValue(variable).trim();
  // If it's an oklch value, convert it to a usable format
  if (value.startsWith("oklch")) {
    return value.replace(/^oklch\((.*)\)$/, "oklch($1)");
  }
  return value || "#3b82f6";
};

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
  const [compareInput, setCompareInput] = useState("");
  const [compareData, setCompareData] = useState<CompareResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [trendsLoading, setTrendsLoading] = useState(false);
  const [rankingsLoading, setRankingsLoading] = useState(false);
  const [filterLoading, setFilterLoading] = useState(false);
  const [compareLoading, setCompareLoading] = useState(false);

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

  useEffect(() => {
    const loadInitial = async () => {
      const summaryResp = await fetchJSON<Summary>("/api/stats/summary");
      if (summaryResp) setSummary(summaryResp);
      setLoading(false);
    };
    loadInitial();
  }, []);

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
    if (!compareInput.trim()) return;
    setCompareLoading(true);
    const ids = compareInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 10);
    const resp: CompareResponseLike = await fetchJSON<
      WithData<CompareResponse> | CompareResponse
    >(`/api/pods/compare?pods=${encodeURIComponent(ids.join(","))}`);
    const parsed = extractData(resp);
    if (parsed) setCompareData(parsed);
    setCompareLoading(false);
  };

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
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Xandeum
            </p>
            <h1 className="text-3xl font-semibold">Analytics Dashboard</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span
                className="h-2 w-2 rounded-full bg-emerald-500"
                aria-hidden
              />
              Live metrics
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
                      <TableRow key={item.rank} className="hover:bg-muted/50">
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

        <section className="mb-8">
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
                                className="hover:bg-muted/50"
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

        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Compare Pods</h2>
              <p className="text-sm text-muted-foreground">
                Comma-separated addresses or pubkeys (up to 10)
              </p>
            </div>
            <div className="flex gap-2">
              <input
                className="h-9 min-w-70 rounded-md border border-input bg-background px-3 text-sm focus:border-ring focus:outline-none"
                placeholder="podA,podB,podC"
                value={compareInput}
                onChange={(e) => setCompareInput(e.target.value)}
              />
              <Button
                size="sm"
                onClick={handleCompare}
                disabled={compareLoading}
              >
                {compareLoading ? "Comparing..." : "Compare"}
              </Button>
            </div>
          </div>

          {compareData && (
            <Card>
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
                  <h3 className="mb-2 text-sm font-semibold">
                    Storage Used (GB)
                  </h3>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={mergeCompareHistory(compareData.pods)}
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
                          formatter={(value, name) => [
                            formatStorageFromTb(value as number | string),
                            name,
                          ]}
                        />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        {compareData.pods.map((pod, idx) => (
                          <Line
                            key={pod.address}
                            type="monotone"
                            dataKey={pod.address}
                            stroke={
                              idx === 0
                                ? chartColors.primary
                                : chartColors.tertiary
                            }
                            strokeWidth={idx === 0 ? 2 : 1.5}
                            dot={false}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </section>
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

function mergeCompareHistory(pods: ComparePod[]) {
  const map = new Map<string, CompareChartRow>();
  pods.forEach((pod) => {
    pod.history.forEach((point) => {
      const key = point.timestamp;
      if (!map.has(key)) map.set(key, { timestamp: key });
      const entry = map.get(key)!;
      entry[pod.address] = Number(point.storageUsed) / 1024 ** 4;
    });
  });
  return Array.from(map.values()).sort((a, b) =>
    a.timestamp.localeCompare(b.timestamp)
  );
}

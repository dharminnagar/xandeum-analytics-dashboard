export interface APIStatsResponse {
  stats: PodResponse;
  statusCode: number;
}

export interface PodResponse {
  error: null;
  id: number;
  jsonrpc: string;
  result: OverallStats;
}

export interface OverallStats {
  active_streams: number;
  cpu_percent: number;
  current_index: number;
  file_size: number;
  last_updated: number;
  packets_received: number;
  packets_sent: number;
  ram_total: number;
  ram_used: number;
  total_bytes: number;
  total_pages: number;
  uptime: number;
}

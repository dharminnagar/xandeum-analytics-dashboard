export interface APINodesWithStatsResponse {
  stats: Stats;
  statusCode: number;
}

export interface Stats {
  error: null;
  id: number;
  jsonrpc: string;
  result: Result;
}

export interface Result {
  pods: Pod[];
  total_count: number;
}

export interface Pod {
  address: string;
  is_public: boolean | null;
  last_seen_timestamp: number;
  pubkey: null | string;
  rpc_port: number | null;
  storage_committed: number | null;
  storage_usage_percent: number | null;
  storage_used: number | null;
  uptime: number | null;
  version: Version;
}

export enum Version {
  The071 = "0.7.1",
  The073 = "0.7.3",
  The080 = "0.8.0",
  The080Trynet202512121836009Eea72E = "0.8.0-trynet.20251212183600.9eea72e",
  The080Trynet202512171115037A5B024 = "0.8.0-trynet.20251217111503.7a5b024",
  The100 = "1.0.0",
  Unknown = "unknown",
}

// IP Geolocation types

export interface IpApiResponse {
  status: "success" | "fail";
  message?: string; // Only present when status is "fail"
  country?: string;
  countryCode?: string;
  region?: string;
  regionName?: string;
  city?: string;
  zip?: string;
  lat?: number;
  lon?: number;
  timezone?: string;
  isp?: string;
  org?: string;
  as?: string;
  query: string; // The IP address that was queried
}

export interface GeolocationData {
  ip: string;
  status: string;
  country?: string | null;
  countryCode?: string | null;
  region?: string | null;
  regionName?: string | null;
  city?: string | null;
  zip?: string | null;
  lat?: number | null;
  lon?: number | null;
  timezone?: string | null;
  isp?: string | null;
  org?: string | null;
  asInfo?: string | null;
}

export interface NodeMapLocation {
  ip: string;
  lat: number;
  lng: number;
  city: string | null;
  region: string | null;
  country: string | null;
  countryCode: string | null;
  isp: string | null;
  org: string | null;
  firstSeen: string;
  lastSeen: string;
  snapshotCount: number;
}

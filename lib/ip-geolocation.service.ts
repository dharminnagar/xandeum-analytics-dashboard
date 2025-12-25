import { prisma } from "@/lib/db";
import type { GeolocationData, IpApiResponse } from "@/types/geolocation";

const IP_API_BATCH_URL = "http://ip-api.com/batch";
const MAX_IPS_PER_BATCH = 100;
const MAX_REQUESTS_PER_MINUTE = 45;
const MIN_DELAY_BETWEEN_REQUESTS_MS = Math.ceil(
  60000 / MAX_REQUESTS_PER_MINUTE
); // ~1334ms

export class IpGeolocationService {
  private requestTimestamps: number[] = []; // Track API calls for rate limiting

  /**
   * Extract IP address from "IP:PORT" format
   */
  extractIp(address: string): string | null {
    const parts = address.split(":");
    if (parts.length < 2) return null;
    return parts[0] || null;
  }

  /**
   * Extract unique IPs from a list of addresses
   */
  extractUniqueIps(addresses: string[]): string[] {
    const ipSet = new Set<string>();
    for (const address of addresses) {
      const ip = this.extractIp(address);
      if (ip && this.isValidIp(ip)) {
        ipSet.add(ip);
      }
    }
    return Array.from(ipSet);
  }

  /**
   * Basic IP validation
   */
  isValidIp(ip: string): boolean {
    // IPv4 regex
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    // IPv6 regex (simplified)
    const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;

    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
  }

  /**
   * Get IPs that don't have geolocation data yet
   */
  async getNewIps(ips: string[]): Promise<string[]> {
    if (ips.length === 0) return [];

    try {
      const existing = await prisma.ipGeolocation.findMany({
        where: {
          ip: {
            in: ips,
          },
        },
        select: {
          ip: true,
        },
      });

      const existingIps = new Set(existing.map((r) => r.ip));
      const newIps = ips.filter((ip) => !existingIps.has(ip));

      console.log("Checked for new IPs:", {
        total: ips.length,
        existing: existingIps.size,
        new: newIps.length,
      });

      return newIps;
    } catch (error) {
      console.error("Failed to get new IPs:", error);
      return [];
    }
  }

  /**
   * Wait for rate limit if needed
   */
  private async waitForRateLimit(): Promise<boolean> {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;

    // Clean up old timestamps
    this.requestTimestamps = this.requestTimestamps.filter(
      (ts) => ts > oneMinuteAgo
    );

    const requestsInLastMinute = this.requestTimestamps.length;

    if (requestsInLastMinute >= MAX_REQUESTS_PER_MINUTE) {
      // Calculate wait time
      const oldestRequest = Math.min(...this.requestTimestamps);
      const waitTime = oneMinuteAgo - oldestRequest + 100; // Add 100ms buffer

      if (waitTime > 0) {
        console.log("Rate limit reached, waiting", { waitTime });
        await this.delay(waitTime);
        // Clean up again after waiting
        this.requestTimestamps = this.requestTimestamps.filter(
          (ts) => ts > oneMinuteAgo
        );
      }
    }

    return true;
  }

  /**
   * Record a request timestamp
   */
  private recordRequest(): void {
    const now = Date.now();
    this.requestTimestamps.push(now);
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Chunk array into smaller arrays
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Fetch geolocation for a single batch of IPs
   */
  private async fetchSingleBatch(ips: string[]): Promise<IpApiResponse[]> {
    await this.waitForRateLimit();

    try {
      const response = await fetch(IP_API_BATCH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(ips),
      });

      this.recordRequest();

      if (response.status === 429) {
        console.warn("Rate limit exceeded, stopping batch processing");
        return [];
      }

      if (!response.ok) {
        console.error("IP API request failed:", {
          status: response.status,
          statusText: response.statusText,
        });
        return [];
      }

      const data: IpApiResponse[] = await response.json();
      return data;
    } catch (error) {
      console.error("Failed to fetch geolocation batch:", error);
      return [];
    }
  }

  /**
   * Store geolocation data in database
   */
  async storeGeolocation(data: IpApiResponse[]): Promise<number> {
    if (data.length === 0) return 0;

    try {
      // Batch check which IPs already exist
      const ipsToCheck = data.map((item) => item.query);
      const existingIps = await prisma.ipGeolocation.findMany({
        where: {
          ip: {
            in: ipsToCheck,
          },
        },
        select: {
          ip: true,
        },
      });

      const existingIpSet = new Set(existingIps.map((r) => r.ip));

      // Filter to only new IPs
      const newItems = data.filter((item) => !existingIpSet.has(item.query));

      if (newItems.length === 0) {
        return 0;
      }

      // Batch insert new items
      const valuesToInsert = newItems.map((item) => {
        if (item.status !== "success") {
          return {
            ip: item.query,
            status: item.status,
          };
        }

        return {
          ip: item.query,
          status: item.status,
          country: item.country,
          countryCode: item.countryCode,
          region: item.region,
          regionName: item.regionName,
          city: item.city,
          zip: item.zip,
          lat: item.lat,
          lon: item.lon,
          timezone: item.timezone,
          isp: item.isp,
          org: item.org,
          asInfo: item.as,
        };
      });

      await prisma.ipGeolocation.createMany({
        data: valuesToInsert,
        skipDuplicates: true,
      });

      return newItems.length;
    } catch (error) {
      console.error("Failed to store geolocation:", error);
      throw error;
    }
  }

  /**
   * Process new IPs: extract, check for new ones, fetch, and store
   */
  async processNewIps(addresses: string[]): Promise<{
    newIpsCount: number;
    storedCount: number;
    batchesProcessed: number;
  }> {
    try {
      const uniqueIps = this.extractUniqueIps(addresses);
      if (uniqueIps.length === 0) {
        console.log("No unique IPs found in addresses");
        return { newIpsCount: 0, storedCount: 0, batchesProcessed: 0 };
      }

      console.log("Checking for new IPs:", {
        totalAddresses: addresses.length,
        uniqueIps: uniqueIps.length,
      });

      const newIps = await this.getNewIps(uniqueIps);
      if (newIps.length === 0) {
        console.log(
          "No new IPs to process - all IPs already have geolocation data"
        );
        return { newIpsCount: 0, storedCount: 0, batchesProcessed: 0 };
      }

      console.log("Processing new IPs:", {
        newIpsCount: newIps.length,
        batchesNeeded: Math.ceil(newIps.length / MAX_IPS_PER_BATCH),
      });

      const chunks = this.chunkArray(newIps, MAX_IPS_PER_BATCH);
      let storedCount = 0;
      let batchesProcessed = 0;

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        console.log(`Processing batch ${i + 1}/${chunks.length}`, {
          batchSize: chunk.length,
        });

        const results = await this.fetchSingleBatch(chunk);
        if (results.length > 0) {
          const stored = await this.storeGeolocation(results);
          storedCount += stored;
          batchesProcessed++;

          console.log(`Batch ${i + 1} completed`, {
            fetched: results.length,
            stored,
          });
        }

        // Add delay between batches (except for the last one)
        if (i < chunks.length - 1) {
          await this.delay(MIN_DELAY_BETWEEN_REQUESTS_MS);
        }
      }

      console.log("Finished processing new IPs:", {
        newIpsCount: newIps.length,
        storedCount,
        batchesProcessed,
      });

      return {
        newIpsCount: newIps.length,
        storedCount,
        batchesProcessed,
      };
    } catch (error) {
      console.error("Failed to process new IPs:", error);
      return { newIpsCount: 0, storedCount: 0, batchesProcessed: 0 };
    }
  }

  /**
   * Get geolocation for multiple IPs
   */
  async getGeolocationBatch(
    ips: string[]
  ): Promise<Map<string, GeolocationData>> {
    if (ips.length === 0) return new Map();

    try {
      const results = await prisma.ipGeolocation.findMany({
        where: {
          ip: {
            in: ips,
          },
        },
      });

      const geoMap = new Map<string, GeolocationData>();

      for (const record of results) {
        geoMap.set(record.ip, {
          ip: record.ip,
          status: record.status,
          country: record.country,
          countryCode: record.countryCode,
          region: record.region,
          regionName: record.regionName,
          city: record.city,
          zip: record.zip,
          lat: record.lat ? Number(record.lat) : null,
          lon: record.lon ? Number(record.lon) : null,
          timezone: record.timezone,
          isp: record.isp,
          org: record.org,
          asInfo: record.asInfo,
        });
      }

      return geoMap;
    } catch (error) {
      console.error("Failed to get geolocation batch:", error);
      return new Map();
    }
  }

  /**
   * Get geolocation data for a specific pubkey with historical timestamps
   */
  async getNodeLocationsWithHistory(pubkey: string): Promise<{
    locations: Array<{
      ip: string;
      lat: number;
      lon: number;
      city: string | null;
      region: string | null;
      country: string | null;
      countryCode: string | null;
      isp: string | null;
      org: string | null;
      firstSeen: Date;
      lastSeen: Date;
      snapshotCount: number;
    }>;
  }> {
    try {
      // Get all pods for this pubkey
      const pods = await prisma.pod.findMany({
        where: {
          pubkey: pubkey,
        },
        select: {
          id: true,
          address: true,
        },
      });

      if (pods.length === 0) {
        return { locations: [] };
      }

      const podIds = pods.map((p) => p.id);

      // Get metrics history for these pods
      const metricsHistory = await prisma.podMetricsHistory.findMany({
        where: {
          podId: {
            in: podIds,
          },
        },
        select: {
          podId: true,
          timestamp: true,
          pod: {
            select: {
              address: true,
            },
          },
        },
        orderBy: {
          timestamp: "asc",
        },
      });

      // Group by address
      const addressData = new Map<
        string,
        {
          address: string;
          firstSeen: Date;
          lastSeen: Date;
          snapshotCount: number;
        }
      >();

      for (const metric of metricsHistory) {
        const address = metric.pod.address;
        const existing = addressData.get(address);

        if (existing) {
          if (metric.timestamp < existing.firstSeen) {
            existing.firstSeen = metric.timestamp;
          }
          if (metric.timestamp > existing.lastSeen) {
            existing.lastSeen = metric.timestamp;
          }
          existing.snapshotCount++;
        } else {
          addressData.set(address, {
            address,
            firstSeen: metric.timestamp,
            lastSeen: metric.timestamp,
            snapshotCount: 1,
          });
        }
      }

      // Get geolocations for all IPs
      const ips = Array.from(addressData.values())
        .map((a) => this.extractIp(a.address))
        .filter((ip) => ip && this.isValidIp(ip)) as string[];

      const geoMap = await this.getGeolocationBatch(ips);

      // Aggregate by IP to handle multiple addresses with same IP (different ports)
      const ipAggregation = new Map<
        string,
        {
          ip: string;
          lat: number;
          lon: number;
          city: string | null;
          region: string | null;
          country: string | null;
          countryCode: string | null;
          isp: string | null;
          org: string | null;
          firstSeen: Date;
          lastSeen: Date;
          snapshotCount: number;
        }
      >();

      for (const addr of addressData.values()) {
        const ip = this.extractIp(addr.address);
        if (!ip) continue;

        const geo = geoMap.get(ip);
        if (!geo || geo.status !== "success" || !geo.lat || !geo.lon) continue;

        const existing = ipAggregation.get(ip);
        if (existing) {
          // Merge: earliest firstSeen, latest lastSeen, sum snapshotCount
          if (addr.firstSeen < existing.firstSeen) {
            existing.firstSeen = addr.firstSeen;
          }
          if (addr.lastSeen > existing.lastSeen) {
            existing.lastSeen = addr.lastSeen;
          }
          existing.snapshotCount += addr.snapshotCount;
        } else {
          ipAggregation.set(ip, {
            ip,
            lat: geo.lat,
            lon: geo.lon,
            city: geo.city ?? null,
            region: geo.regionName ?? null,
            country: geo.country ?? null,
            countryCode: geo.countryCode ?? null,
            isp: geo.isp ?? null,
            org: geo.org ?? null,
            firstSeen: addr.firstSeen,
            lastSeen: addr.lastSeen,
            snapshotCount: addr.snapshotCount,
          });
        }
      }

      const locations = Array.from(ipAggregation.values());

      return { locations };
    } catch (error) {
      console.error("Failed to get node locations with history:", {
        pubkey,
        error,
      });
      throw error;
    }
  }
}

// Export singleton instance
export const ipGeolocationService = new IpGeolocationService();

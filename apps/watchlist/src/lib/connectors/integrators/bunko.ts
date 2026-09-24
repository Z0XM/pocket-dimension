/**
 * Fetch + paginate Bunko public Movies API.
 * Sequential pages; honors 429 + Retry-After.
 */

import type { BunkoMovieRow } from "./bunko-map";

export type BunkoFetchOptions = {
  baseUrl?: string;
  pageSize?: number;
  statusFilter?: string | null;
  /** Max pages safety valve (default 50). */
  maxPages?: number;
  fetchImpl?: typeof fetch;
};

export type BunkoPageEnvelope = {
  table?: string;
  columns?: string[];
  data?: BunkoMovieRow[];
  count?: number;
  total?: number;
  limit?: number;
  offset?: number;
  filters?: unknown;
};

const DEFAULT_BASE = "https://bunko.byimti.tools";
const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clampPageSize(n: number | undefined): number {
  const size = Number.isFinite(n) && n && n > 0 ? Math.floor(n) : DEFAULT_PAGE_SIZE;
  return Math.min(MAX_PAGE_SIZE, Math.max(1, size));
}

async function fetchPage(
  url: URL,
  fetchImpl: typeof fetch,
  attempt = 0
): Promise<BunkoPageEnvelope> {
  const res = await fetchImpl(url.toString(), {
    headers: { Accept: "application/json" },
  });

  if (res.status === 429 && attempt < 5) {
    const retryAfter = Number(res.headers.get("Retry-After") ?? "2");
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2000 * (attempt + 1);
    await sleep(waitMs);
    return fetchPage(url, fetchImpl, attempt + 1);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Bunko API ${res.status}: ${body.slice(0, 200) || res.statusText}`);
  }

  return (await res.json()) as BunkoPageEnvelope;
}

/**
 * Page through the full Movies catalog (or status-filtered subset).
 */
export async function fetchAllBunkoMovies(options: BunkoFetchOptions = {}): Promise<{
  rows: BunkoMovieRow[];
  total: number;
  pages: number;
}> {
  const baseUrl = (options.baseUrl || Bun.env.BUNKO_BASE_URL || DEFAULT_BASE).replace(/\/$/, "");
  const pageSize = clampPageSize(options.pageSize ?? Number(Bun.env.BUNKO_PAGE_SIZE || DEFAULT_PAGE_SIZE));
  const statusFilter = options.statusFilter ?? Bun.env.BUNKO_STATUS_FILTER ?? "";
  const maxPages = options.maxPages ?? 50;
  const fetchImpl = options.fetchImpl ?? fetch;

  const rows: BunkoMovieRow[] = [];
  let offset = 0;
  let total = Infinity;
  let pages = 0;

  while (offset < total && pages < maxPages) {
    const url = new URL(`${baseUrl}/api/public/movies`);
    url.searchParams.set("limit", String(pageSize));
    url.searchParams.set("offset", String(offset));
    if (statusFilter.trim()) {
      url.searchParams.set("status", statusFilter.trim());
    }

    const page = await fetchPage(url, fetchImpl);
    const data = Array.isArray(page.data) ? page.data : [];
    const count = typeof page.count === "number" ? page.count : data.length;
    total = typeof page.total === "number" ? page.total : offset + count;

    rows.push(...data);
    pages++;
    offset += count;

    if (count === 0) break;
  }

  return { rows, total: Number.isFinite(total) ? total : rows.length, pages };
}

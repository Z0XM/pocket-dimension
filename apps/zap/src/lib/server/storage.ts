/**
 * Cloudflare R2 / S3-compatible storage helper (Bun.S3Client, SigV4).
 *
 * Correct R2 env (path-style — recommended):
 *   S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
 *   S3_ACCESS_KEY=<R2 Access Key ID>          # or S3_ACCESS_KEY_ID
 *   S3_SECRET_KEY=<R2 Secret Access Key>      # or S3_SECRET_ACCESS_KEY
 *   S3_BUCKET=zap-media
 *   S3_REGION=auto
 *
 * Virtual-hosted style (also supported):
 *   S3_ENDPOINT=https://<BUCKET>.<ACCOUNT_ID>.r2.cloudflarestorage.com
 *   S3_BUCKET=<BUCKET>   # optional if already in the host
 *   (virtualHostedStyle is inferred automatically)
 */

export type StorageConfig = {
  endpoint: string;
  accessKey: string;
  secretKey: string;
  bucket: string;
  region: string;
  virtualHostedStyle: boolean;
};

function stripEnvValue(raw: string | undefined | null): string {
  if (raw == null) return "";
  let v = raw.trim();
  // Strip wrapping quotes from .env paste mistakes: "secret" or 'secret'
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1).trim();
  }
  // Secrets sometimes pick up a trailing newline when pasted
  return v.replace(/[\r\n]+/g, "").trim();
}

function firstEnv(...keys: string[]): string {
  for (const key of keys) {
    const v = stripEnvValue(Bun.env[key]);
    if (v) return v;
  }
  return "";
}

/** Normalize endpoint/bucket and detect path-style vs virtual-hosted R2/S3. */
export function normalizeStorageEndpoint(endpointRaw: string, bucketRaw: string): { endpoint: string; bucket: string; virtualHostedStyle: boolean } {
  let endpoint = stripEnvValue(endpointRaw).replace(/\/+$/, "");
  let bucket = stripEnvValue(bucketRaw);
  let virtualHostedStyle = false;

  // Accidental path on account endpoint: https://<acct>.r2.cloudflarestorage.com/my-bucket
  try {
    const url = new URL(endpoint);
    const host = url.hostname;
    const pathParts = url.pathname.split("/").filter(Boolean);

    const r2Virtual = host.match(/^([^.]+)\.([a-f0-9]+)\.r2\.cloudflarestorage\.com$/i);
    const r2Account = host.match(/^([a-f0-9]+)\.r2\.cloudflarestorage\.com$/i);
    // Jurisdiction: <acct>.<jurisdiction>.r2.cloudflarestorage.com
    const r2Jurisdiction = host.match(/^([a-f0-9]+)\.([a-z0-9-]+)\.r2\.cloudflarestorage\.com$/i);

    if (r2Virtual) {
      // https://bucket.accountid.r2.cloudflarestorage.com
      virtualHostedStyle = true;
      const hostBucket = r2Virtual[1];
      if (!bucket) bucket = hostBucket;
      // Keep full virtual-hosted origin; Bun ignores separate bucket when VHS is true
      endpoint = `${url.protocol}//${host}`;
    } else if (r2Account || r2Jurisdiction) {
      virtualHostedStyle = false;
      endpoint = `${url.protocol}//${host}`;
      if (!bucket && pathParts[0]) {
        bucket = pathParts[0];
      }
    } else {
      // Generic S3-compatible: strip path bucket segment if present
      endpoint = `${url.protocol}//${host}${url.port && url.port !== "443" && url.port !== "80" ? `:${url.port}` : ""}`;
      if (!bucket && pathParts[0]) {
        bucket = pathParts[0];
      }
      // Heuristic: host starts with bucket.
      if (bucket && host.startsWith(`${bucket}.`)) {
        virtualHostedStyle = true;
      }
    }
  } catch {
    // leave stripped endpoint as-is
  }

  return { endpoint, bucket, virtualHostedStyle };
}

export function getStorageConfig(env: Record<string, string | undefined> = Bun.env): StorageConfig | null {
  // Prefer Bun/AWS-standard names, fall back to shorter aliases used in Zap .env.example
  const accessKey = stripEnvValue(env.S3_ACCESS_KEY_ID) || stripEnvValue(env.S3_ACCESS_KEY) || stripEnvValue(env.AWS_ACCESS_KEY_ID);
  const secretKey = stripEnvValue(env.S3_SECRET_ACCESS_KEY) || stripEnvValue(env.S3_SECRET_KEY) || stripEnvValue(env.AWS_SECRET_ACCESS_KEY);
  const endpointRaw = stripEnvValue(env.S3_ENDPOINT) || stripEnvValue(env.AWS_ENDPOINT);
  const bucketRaw = stripEnvValue(env.S3_BUCKET) || stripEnvValue(env.AWS_BUCKET);
  const region = stripEnvValue(env.S3_REGION) || stripEnvValue(env.AWS_REGION) || "auto";

  if (!endpointRaw || !accessKey || !secretKey) {
    return null;
  }

  if (endpointRaw.includes("<") || endpointRaw.includes("accountid") || endpointRaw.includes("ACCOUNT_ID")) {
    return null;
  }

  const { endpoint, bucket, virtualHostedStyle } = normalizeStorageEndpoint(endpointRaw, bucketRaw);
  if (!bucket) {
    return null;
  }

  return { endpoint, accessKey, secretKey, bucket, region: region || "auto", virtualHostedStyle };
}

export function isStorageConfigured() {
  return getStorageConfig() !== null;
}

/** Object key for a catalogue asset — never overwritten for a given identity. */
export function mediaObjectKey(identityKey: string, ext = "m4a") {
  const safe = identityKey.replace(/[^a-zA-Z0-9:_-]+/g, "_");
  return `media/${safe}.${ext}`;
}

function createS3Client(config: StorageConfig) {
  return new Bun.S3Client({
    accessKeyId: config.accessKey,
    secretAccessKey: config.secretKey,
    bucket: config.bucket,
    endpoint: config.endpoint,
    // R2 uses "auto"; Bun maps *.r2.cloudflarestorage.com → auto when omitted
    region: config.region || "auto",
    virtualHostedStyle: config.virtualHostedStyle,
  });
}

function formatStorageError(err: unknown, config: StorageConfig): Error {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();

  if (lower.includes("signature") || lower.includes("does not match")) {
    return new Error(
      [
        "R2 signature mismatch.",
        "Use account-level endpoint https://<ACCOUNT_ID>.r2.cloudflarestorage.com (no bucket in the URL),",
        "R2 S3 API token access key + secret (not a Cloudflare global API token),",
        "S3_REGION=auto, and no quotes/spaces around keys.",
        `Resolved endpoint=${config.endpoint} bucket=${config.bucket} vhs=${config.virtualHostedStyle} region=${config.region}.`,
        `Upstream: ${raw}`,
      ].join(" ")
    );
  }

  if (lower.includes("invalidaccesskeyid") || lower.includes("access key")) {
    return new Error(
      `R2 rejected the access key. Create S3 API credentials under R2 → Manage R2 API Tokens (not Account API Tokens). Upstream: ${raw}`
    );
  }

  return err instanceof Error ? err : new Error(raw);
}

/** Upload bytes to R2/S3. Uses Bun's built-in S3 client (SigV4). */
export async function putMediaObject(input: {
  identityKey: string;
  body: Uint8Array | Blob;
  contentType: string;
  ext?: string;
  onUploadPercent?: (percent: number) => void;
}): Promise<{ storageKey: string }> {
  const config = getStorageConfig();
  if (!config) {
    throw new Error(
      "Object storage is not configured. Set S3_ENDPOINT (https://<ACCOUNT_ID>.r2.cloudflarestorage.com), S3_ACCESS_KEY / S3_ACCESS_KEY_ID, S3_SECRET_KEY / S3_SECRET_ACCESS_KEY, and S3_BUCKET."
    );
  }

  const storageKey = mediaObjectKey(input.identityKey, input.ext);
  const client = createS3Client(config);

  const bytes = input.body instanceof Uint8Array ? input.body : new Uint8Array(await (input.body as Blob).arrayBuffer());
  let lastEmit = -1;
  const emit = (n: number) => {
    const pct = Math.max(0, Math.min(100, Math.round(n)));
    if (pct === lastEmit) return;
    lastEmit = pct;
    input.onUploadPercent?.(pct);
  };
  emit(0);

  // Bun's S3 write doesn't expose byte-level upload progress; pulse while the PUT is in flight.
  let pulse = 5;
  const pulseTimer = setInterval(() => {
    pulse = Math.min(90, pulse + 5);
    emit(pulse);
  }, 200);

  try {
    await client.write(storageKey, bytes, {
      type: input.contentType || "application/octet-stream",
    });
    emit(100);
  } catch (err) {
    throw formatStorageError(err, config);
  } finally {
    clearInterval(pulseTimer);
  }
  return { storageKey };
}

export async function getPresignedGetUrl(storageKey: string, expiresInSeconds = 3600): Promise<string> {
  const config = getStorageConfig();
  if (!config) {
    throw new Error("Object storage is not configured.");
  }
  const client = createS3Client(config);
  try {
    return client.presign(storageKey, { expiresIn: expiresInSeconds, method: "GET" });
  } catch (err) {
    throw formatStorageError(err, config);
  }
}

/** Lightweight connectivity check — HEAD/exists via a tiny write+delete is too invasive; just validate config shape. */
export function describeStorageConfig(): {
  configured: boolean;
  endpoint?: string;
  bucket?: string;
  region?: string;
  virtualHostedStyle?: boolean;
  accessKeyPreview?: string;
} {
  const config = getStorageConfig();
  if (!config) return { configured: false };
  const key = config.accessKey;
  return {
    configured: true,
    endpoint: config.endpoint,
    bucket: config.bucket,
    region: config.region,
    virtualHostedStyle: config.virtualHostedStyle,
    accessKeyPreview: key.length <= 8 ? "(short)" : `${key.slice(0, 4)}…${key.slice(-4)}`,
  };
}

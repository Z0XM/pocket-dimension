/**
 * Thin S3/R2 storage helper. Phase 1: interface + env wiring.
 * Real upload/signed-URL calls use the AWS SDK-compatible API when credentials are set.
 */

export type StorageConfig = {
  endpoint: string;
  accessKey: string;
  secretKey: string;
  bucket: string;
  region: string;
};

export function getStorageConfig(): StorageConfig | null {
  const endpoint = Bun.env.S3_ENDPOINT?.trim();
  const accessKey = Bun.env.S3_ACCESS_KEY?.trim();
  const secretKey = Bun.env.S3_SECRET_KEY?.trim();
  const bucket = Bun.env.S3_BUCKET?.trim();
  const region = Bun.env.S3_REGION?.trim() || "auto";

  if (!endpoint || !accessKey || !secretKey || !bucket) {
    return null;
  }

  return { endpoint, accessKey, secretKey, bucket, region };
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
    region: config.region,
  });
}

/** Upload bytes to R2/S3. Uses Bun's built-in S3 client. */
export async function putMediaObject(input: {
  identityKey: string;
  body: Uint8Array | Blob;
  contentType: string;
  ext?: string;
}): Promise<{ storageKey: string }> {
  const config = getStorageConfig();
  if (!config) {
    throw new Error("Object storage is not configured. Set S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, and S3_BUCKET.");
  }

  const storageKey = mediaObjectKey(input.identityKey, input.ext);
  const client = createS3Client(config);
  await client.write(storageKey, input.body, { type: input.contentType });
  return { storageKey };
}

export async function getPresignedGetUrl(storageKey: string, expiresInSeconds = 3600): Promise<string> {
  const config = getStorageConfig();
  if (!config) {
    throw new Error("Object storage is not configured.");
  }
  const client = createS3Client(config);
  return client.presign(storageKey, { expiresIn: expiresInSeconds, method: "GET" });
}

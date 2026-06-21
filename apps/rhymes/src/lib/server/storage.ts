import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const LOCAL_UPLOAD_DIR = path.join(process.cwd(), "static", "uploads", "rhymes");

function assetDriver(): "local" | "s3" {
  // Local disk is kept for development only; title art uploads are gated by TITLE_ART_ENABLED.
  return process.env.RHYMES_ASSET_DRIVER === "s3" ? "s3" : "local";
}

function s3Client(): S3Client {
  const endpoint = process.env.RHYMES_S3_ENDPOINT;
  return new S3Client({
    region: process.env.RHYMES_S3_REGION ?? "auto",
    endpoint: endpoint || undefined,
    forcePathStyle: Boolean(endpoint),
    credentials:
      process.env.RHYMES_S3_ACCESS_KEY_ID && process.env.RHYMES_S3_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.RHYMES_S3_ACCESS_KEY_ID,
            secretAccessKey: process.env.RHYMES_S3_SECRET_ACCESS_KEY,
          }
        : undefined,
  });
}

function s3ObjectKey(storageKey: string): string {
  const prefix = process.env.RHYMES_S3_PREFIX?.replace(/\/$/, "") ?? "rhymes";
  return `${prefix}/${storageKey}`;
}

export function getAssetPublicUrl(storageKey: string): string {
  const cdnBase = process.env.RHYMES_ASSET_PUBLIC_BASE_URL?.replace(/\/$/, "");
  if (cdnBase) {
    return `${cdnBase}/${storageKey}`;
  }

  return `/uploads/rhymes/${storageKey}`;
}

export async function uploadTitleArt(storageKey: string, buffer: Buffer, mimeType: string): Promise<void> {
  if (assetDriver() === "s3") {
    const bucket = process.env.RHYMES_S3_BUCKET;
    if (!bucket) {
      throw new Error("RHYMES_S3_BUCKET is required when RHYMES_ASSET_DRIVER=s3");
    }

    await s3Client().send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: s3ObjectKey(storageKey),
        Body: buffer,
        ContentType: mimeType,
      })
    );
    return;
  }

  await mkdir(LOCAL_UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(LOCAL_UPLOAD_DIR, storageKey), buffer);
}

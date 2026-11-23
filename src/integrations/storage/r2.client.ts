
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand
} from "@aws-sdk/client-s3";

import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { env } from "../../config/env.js";

function getStorageConfig() {
  const {
    STORAGE_ENDPOINT,
    STORAGE_REGION,
    STORAGE_BUCKET,
    STORAGE_ACCESS_KEY,
    STORAGE_SECRET_KEY,
    STORAGE_PUBLIC_URL,
  } = env;

  if (
    !STORAGE_ENDPOINT ||
    !STORAGE_REGION ||
    !STORAGE_BUCKET ||
    !STORAGE_ACCESS_KEY ||
    !STORAGE_SECRET_KEY ||
    !STORAGE_PUBLIC_URL
  ) {
    throw new Error("Cloudflare R2 configuration is incomplete");
  }

  return {
    endpoint: STORAGE_ENDPOINT,
    region: STORAGE_REGION,
    bucket: STORAGE_BUCKET,
    accessKeyId: STORAGE_ACCESS_KEY,
    secretAccessKey: STORAGE_SECRET_KEY,
    publicUrl: STORAGE_PUBLIC_URL.replace(/\/+$/, ""),
  };
}

const config = getStorageConfig();

export const r2Client = new S3Client({
  region: config.region,
  endpoint: config.endpoint,
  credentials: {
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
  },
});

export function getPublicObjectUrl(key: string) {
  return `${config.publicUrl}/${key}`;
}

export async function createUploadUrl(
  key: string,
  contentType: string,
) {
  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(
    r2Client,
    command,
    { expiresIn: 300 },
  );

  return {
    uploadUrl,
    expiresIn: 300,
  };
}

export async function getObjectMetadata(key: string) {
  return r2Client.send(
    new HeadObjectCommand({
      Bucket: config.bucket,
      Key: key,
    }),
  );
}

export async function deleteObject(key: string) {
  return r2Client.send(
    new DeleteObjectCommand({
      Bucket: config.bucket,
      Key: key,
    }),
  );
}

export function getStorageBucket() {
  return config.bucket;
}



export function getObjectKeyFromPublicUrl(fileUrl: string) {
  const publicBase = new URL(config.publicUrl);
  const objectUrl = new URL(fileUrl);

  const basePath = publicBase.pathname.replace(/\/+$/, "");
  const objectPath = objectUrl.pathname;

  if (
    objectUrl.origin !== publicBase.origin ||
    !objectPath.startsWith(`${basePath}/`)
  ) {
    throw new Error("Invalid R2 public URL");
  }

  return decodeURIComponent(
    objectPath.slice(basePath.length + 1),
  );
}


export async function createDownloadUrl(key: string) {
  const command = new GetObjectCommand({
    Bucket: config.bucket,
    Key: key,
  });

  return getSignedUrl(r2Client, command, {
    expiresIn: 300,
  });
}

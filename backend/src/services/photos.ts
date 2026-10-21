// backend/src/services/photos.ts — sharp re-encode (1600px + 400px thumb,
// EXIF stripped by default [D-17]) then store in S3 or local disk.
// Keys are `reports/{uuid}.webp` — generated before the report row exists
// (#54), so they no longer carry the report id.
import { copyFile, mkdir, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { S3Client, PutObjectCommand, CopyObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { config, s3Enabled } from '../config.js';

const s3 = s3Enabled
  ? new S3Client({
      region: config.s3.region,
      endpoint: config.s3.endpoint,
      credentials: { accessKeyId: config.s3.accessKeyId, secretAccessKey: config.s3.secretAccessKey },
    })
  : null;

let warnedLocal = false;

export function photoUrl(key: string): string {
  if (s3Enabled && config.s3.publicBaseUrl) return `${config.s3.publicBaseUrl.replace(/\/$/, '')}/${key}`;
  // absolute — the PWA is usually on a different origin than the API
  return `${config.apiPublicUrl.replace(/\/$/, '')}/uploads/${key}`;
}

export interface ProcessedPhoto {
  storage_key: string;
  thumb_key: string;
  content_type: 'image/webp';
  width: number;
  height: number;
  bytes: number;
}

const isMissing = (e: unknown): boolean => {
  const err = e as { code?: string; name?: string; $metadata?: { httpStatusCode?: number } };
  return err.code === 'ENOENT' || err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404;
};

async function store(key: string, buf: Buffer): Promise<void> {
  if (s3) {
    await s3.send(new PutObjectCommand({ Bucket: config.s3.bucket, Key: key, Body: buf, ContentType: 'image/webp' }));
    return;
  }
  if (!warnedLocal) {
    warnedLocal = true;
    console.warn(`[photos] S3_* not configured — storing under ${config.uploadDir}. Railway disks are ephemeral; set S3_* in production.`);
  }
  const dest = join(config.uploadDir, key);
  await mkdir(join(dest, '..'), { recursive: true });
  await writeFile(dest, buf);
}

/** Best-effort delete of stored objects. Never throws — callers log and
 *  move on; a leaked orphan is better than masking the real error (#54). */
export async function removeKeys(keys: string[]): Promise<void> {
  for (const key of keys) {
    try {
      if (s3) {
        await s3.send(new DeleteObjectCommand({ Bucket: config.s3.bucket, Key: key }));
      } else {
        await unlink(join(config.uploadDir, key));
      }
    } catch (e) {
      if (!isMissing(e)) console.warn(`[photos] could not delete orphan ${key}:`, e);
    }
  }
}

/** Copy a stored object to a fresh unguessable key, same folder/extension.
 *  Used when a photo is hidden — its old URL may already be in browser
 *  history or caches, so hiding must kill that URL, not just filter it out
 *  of API responses (#52). This only copies; the caller updates the DB row
 *  to the new keys first and deletes the old objects afterwards, so a
 *  mid-sequence failure can't leave the row pointing at moved files (#57).
 *  Missing source files just keep the old key. */
export async function copyToFreshKey(key: string): Promise<string> {
  const dir = key.slice(0, key.lastIndexOf('/') + 1);
  const file = key.slice(dir.length);
  const thumb = file.endsWith('_t.webp');
  const fresh = `${dir}${randomUUID()}${thumb ? '_t' : ''}.webp`;
  try {
    if (s3) {
      await s3.send(new CopyObjectCommand({
        Bucket: config.s3.bucket, Key: fresh,
        CopySource: `${config.s3.bucket}/${encodeURIComponent(key)}`,
      }));
    } else {
      await copyFile(join(config.uploadDir, key), join(config.uploadDir, fresh));
    }
    return fresh;
  } catch (e) {
    if (isMissing(e)) {
      console.warn(`[photos] ${key} not found while hiding — leaving key unchanged`);
      return key;
    }
    throw e;
  }
}

/** Re-encode to webp at 1600px + 400px thumb. EXIF is dropped by default.
 *  Throws on undecodable input — callers map that to 415. */
export async function processPhoto(buf: Buffer): Promise<ProcessedPhoto> {
  const base = `reports/${randomUUID()}`;
  const img = sharp(buf).rotate(); // .rotate() applies EXIF orientation, then EXIF is stripped
  const [full, thumb] = await Promise.all([
    img.clone().resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer({ resolveWithObject: true }),
    img.clone().resize({ width: 400, withoutEnlargement: true }).webp({ quality: 70 }).toBuffer(),
  ]);
  const storage_key = `${base}.webp`;
  const thumb_key = `${base}_t.webp`;
  await store(storage_key, full.data);
  try {
    await store(thumb_key, thumb);
  } catch (e) {
    // Caller only registers keys after we return — clean up the stored
    // full-size object ourselves so a thumb failure doesn't orphan it (#57).
    await removeKeys([storage_key]);
    throw e;
  }
  return { storage_key, thumb_key, content_type: 'image/webp', width: full.info.width, height: full.info.height, bytes: full.data.length };
}

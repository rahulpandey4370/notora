'use server';

import { put, get } from '@vercel/blob';
import type { AppData } from '@/lib/types';

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

const getBlobKey = (username: string) => `notora-data-${username.toLowerCase()}.json`;

export async function getAppData(username: string): Promise<AppData | null> {
  if (!BLOB_TOKEN) {
    console.warn("BLOB_READ_WRITE_TOKEN is not set. Data will not be persisted.");
    return null;
  }

  const key = getBlobKey(username);
  try {
    const blob = await get(key, { token: BLOB_TOKEN });
    return await blob.json();
  } catch (error: any) {
    if (error.status === 404) {
      console.log(`No data found for user ${username}, returning null.`);
      return null;
    }
    console.error("Failed to fetch app data from Vercel Blob:", error);
    return null;
  }
}

export async function saveAppData(username: string, data: AppData): Promise<void> {
  if (!BLOB_TOKEN) return;

  const key = getBlobKey(username);
  try {
    await put(key, JSON.stringify(data), {
      access: 'public',
      token: BLOB_TOKEN,
    });
  } catch (error) {
    console.error("Failed to save app data to Vercel Blob:", error);
    // In a real app, you might want to throw this error or handle it differently
  }
}

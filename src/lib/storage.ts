'use server';

import { put, list, del } from '@vercel/blob';
import type { AppData } from '@/lib/types';

const BLOB_TOKEN = process.env.NEXT_PUBLIC_BLOB_READ_WRITE_TOKEN;

const getBlobKey = (username: string) => `notora-data-${username.toLowerCase()}.json`;

export async function getAppData(username: string): Promise<AppData | null> {
  if (!BLOB_TOKEN) {
    console.warn("NEXT_PUBLIC_BLOB_READ_WRITE_TOKEN is not set. Data will not be persisted.");
    return null;
  }

  const key = getBlobKey(username);
  try {
    const { blobs } = await list({
      prefix: key,
      limit: 1,
      token: BLOB_TOKEN
    });

    if (blobs.length === 0) {
      console.log(`No data found for user ${username}, returning null.`);
      return null;
    }
    
    const response = await fetch(blobs[0].url);
    if (!response.ok) {
        throw new Error(`Failed to fetch blob: ${response.statusText}`);
    }
    
    // Check for empty response body before parsing
    const text = await response.text();
    if (!text) {
        console.log(`Blob for user ${username} is empty, returning null.`);
        // Optionally delete the empty blob
        await del(blobs[0].url, { token: BLOB_TOKEN });
        return null;
    }

    return JSON.parse(text);

  } catch (error: any) {
    if (error.name === 'SyntaxError') {
      console.error(`Failed to parse JSON for user ${username}. Data might be corrupted.`, error);
    } else {
      console.error(`Failed to fetch app data for user ${username} from Vercel Blob:`, error);
    }
    return null;
  }
}

export async function saveAppData(username: string, data: AppData): Promise<void> {
  if (!BLOB_TOKEN) {
    console.warn("NEXT_PUBLIC_BLOB_READ_WRITE_TOKEN is not set. Data will not be persisted.");
    return;
  }

  const key = getBlobKey(username);
  try {
    await put(key, JSON.stringify(data), {
      access: 'public',
      token: BLOB_TOKEN,
      addRandomSuffix: false, // Important to overwrite the same file
    });
  } catch (error) {
    console.error("Failed to save app data to Vercel Blob:", error);
    throw error; // Re-throw to let the caller know something went wrong
  }
}

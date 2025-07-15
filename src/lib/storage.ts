'use server';

import { BlobServiceClient } from '@azure/storage-blob';
import type { AppData } from '@/lib/types';

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
const containerName = 'notora-data';

const getBlobClient = (username: string) => {
  if (!connectionString) {
    throw new Error("Azure Storage connection string is not configured. Please set the AZURE_STORAGE_CONNECTION_STRING environment variable.");
  }
  const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  const containerClient = blobServiceClient.getContainerClient(containerName);
  const blobName = `notora-data-${username.toLowerCase()}.json`;
  return containerClient.getBlockBlobClient(blobName);
};

export async function getAppData(username: string): Promise<AppData | null> {
  if (!connectionString) {
    console.warn("AZURE_STORAGE_CONNECTION_STRING is not set. Data will not be persisted.");
    return null;
  }
  
  try {
    const blockBlobClient = getBlobClient(username);

    // Ensure container exists before trying to read from it
    const containerClient = blockBlobClient.getContainerClient();
    await containerClient.createIfNotExists({ access: 'blob' });

    const downloadBlockBlobResponse = await blockBlobClient.download(0);
    if (!downloadBlockBlobResponse.readableStreamBody) {
      console.log(`Blob for user ${username} is empty or does not exist, returning null.`);
      return null;
    }
    
    const downloaded = await streamToBuffer(downloadBlockBlobResponse.readableStreamBody);
    const data = downloaded.toString();
    
    if (!data) {
        return null;
    }

    return JSON.parse(data);

  } catch (error: any) {
    if (error.statusCode === 404) {
      console.log(`No data found for user ${username}, returning null.`);
      return null;
    }
    console.error(`Failed to fetch app data for user ${username} from Azure Blob Storage:`, error);
    return null;
  }
}

export async function saveAppData(username: string, data: AppData): Promise<void> {
   if (!connectionString) {
    console.warn("AZURE_STORAGE_CONNECTION_STRING is not set. Data will not be persisted.");
    return;
  }
  
  try {
    const blockBlobClient = getBlobClient(username);
    
    // Ensure container exists and is public before upload
    const containerClient = blockBlobClient.getContainerClient();
    await containerClient.createIfNotExists({ access: 'blob' });

    const dataString = JSON.stringify(data);
    await blockBlobClient.upload(dataString, dataString.length, {
        blobHTTPHeaders: { blobContentType: 'application/json' }
    });
  } catch (error) {
    console.error("Failed to save app data to Azure Blob Storage:", error);
    throw error;
  }
}

async function streamToBuffer(readableStream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    readableStream.on('data', (data) => {
      chunks.push(data instanceof Buffer ? data : Buffer.from(data));
    });
    readableStream.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    readableStream.on('error', reject);
  });
}
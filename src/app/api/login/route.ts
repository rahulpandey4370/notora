import { NextResponse } from 'next/server';
import { BlobServiceClient } from '@azure/storage-blob';
import { createHash } from 'crypto';
import { users as defaultUsers } from '@/lib/users';

const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
const containerName = 'to-do-notes';
const blobName = 'users.json';

type StoredUser = {
  username: string;
  email: string;
  passwordHash: string;
  avatarUrl: string;
};

async function getUsers(): Promise<StoredUser[]> {
  if (!connectionString) {
    console.warn("AZURE_STORAGE_CONNECTION_STRING not set, using default users.");
    return defaultUsers;
  }

  try {
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);

    // Ensure container exists
    await containerClient.createIfNotExists();

    // Check if blob exists
    const exists = await blockBlobClient.exists();
    if (!exists) {
      // If blob doesn't exist, create it with default users
      await blockBlobClient.upload(JSON.stringify(defaultUsers, null, 2), Buffer.byteLength(JSON.stringify(defaultUsers, null, 2)));
      return defaultUsers;
    }

    const downloadBlockBlobResponse = await blockBlobClient.download(0);
    const downloaded = await streamToBuffer(downloadBlockBlobResponse.readableStreamBody!);
    return JSON.parse(downloaded.toString());
  } catch (error) {
    console.error("Error fetching users from Azure Blob Storage:", error);
    // Fallback to default users in case of error
    return defaultUsers;
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

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const allUsers = await getUsers();

    const user = allUsers.find(u => u.email.toLowerCase() === email.toLowerCase());

    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const sha256 = createHash('sha256');
    sha256.update(password);
    const inputPasswordHash = sha256.digest('hex');
    
    if (inputPasswordHash === user.passwordHash) {
      // Password matches. Return user data without the password hash.
      const { passwordHash, ...userToReturn } = user;
      return NextResponse.json(userToReturn);
    } else {
      // Password does not match
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

  } catch (error) {
    console.error('Login API error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

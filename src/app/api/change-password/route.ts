
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
    throw new Error("AZURE_STORAGE_CONNECTION_STRING not set.");
  }

  const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  const containerClient = blobServiceClient.getContainerClient(containerName);
  const blockBlobClient = containerClient.getBlockBlobClient(blobName);

  if (!(await blockBlobClient.exists())) {
    await blockBlobClient.upload(JSON.stringify(defaultUsers, null, 2), Buffer.byteLength(JSON.stringify(defaultUsers, null, 2)));
    return defaultUsers;
  }

  const downloadBlockBlobResponse = await blockBlobClient.download(0);
  const downloaded = await streamToBuffer(downloadBlockBlobResponse.readableStreamBody!);
  return JSON.parse(downloaded.toString());
}

async function saveUsers(users: StoredUser[]): Promise<void> {
    if (!connectionString) {
        throw new Error("AZURE_STORAGE_CONNECTION_STRING not set.");
    }
    const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    const containerClient = blobServiceClient.getContainerClient(containerName);
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    const data = JSON.stringify(users, null, 2);
    await blockBlobClient.upload(data, Buffer.byteLength(data));
}


async function streamToBuffer(readableStream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    readableStream.on('data', (data) => chunks.push(data instanceof Buffer ? data : Buffer.from(data)));
    readableStream.on('end', () => resolve(Buffer.concat(chunks)));
    readableStream.on('error', reject);
  });
}

function hashPassword(password: string): string {
    const sha256 = createHash('sha256');
    sha256.update(password);
    return sha256.digest('hex');
}

export async function POST(request: Request) {
  try {
    const { email, currentPassword, newPassword } = await request.json();

    if (!email || !currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Email, current password, and new password are required' }, { status: 400 });
    }

    const allUsers = await getUsers();
    const userIndex = allUsers.findIndex(u => u.email.toLowerCase() === email.toLowerCase());

    if (userIndex === -1) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    const user = allUsers[userIndex];
    const currentPasswordHash = hashPassword(currentPassword);

    if (currentPasswordHash !== user.passwordHash) {
      return NextResponse.json({ error: 'Invalid current password' }, { status: 401 });
    }

    // Update password
    allUsers[userIndex].passwordHash = hashPassword(newPassword);
    
    await saveUsers(allUsers);

    return NextResponse.json({ message: 'Password updated successfully' });

  } catch (error) {
    console.error('Change Password API error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

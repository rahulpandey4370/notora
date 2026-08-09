import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getSupabase } from '@/lib/supabase';
import { users as defaultUsers } from '@/lib/users';

type StoredUser = {
  username: string;
  email: string;
  passwordHash: string;
  avatarUrl: string;
};

function fromRow(row: any): StoredUser {
  return { username: row.username, email: row.email, passwordHash: row.password_hash, avatarUrl: row.avatar_url };
}

async function getUsers(): Promise<StoredUser[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('users').select('*');
  if (error) throw new Error(error.message);

  if (!data || data.length === 0) {
    const { error: seedError } = await supabase.from('users').upsert(
      defaultUsers.map(u => ({ username: u.username, email: u.email, password_hash: u.passwordHash, avatar_url: u.avatarUrl }))
    );
    if (seedError) throw new Error(seedError.message);
    return defaultUsers;
  }
  return data.map(fromRow);
}

async function updateUserPassword(username: string, newPasswordHash: string): Promise<void> {
  const supabase = getSupabase();
  const { error } = await supabase.from('users').update({ password_hash: newPasswordHash }).eq('username', username);
  if (error) throw new Error(error.message);
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
    const user = allUsers.find(u => u.email.toLowerCase() === email.toLowerCase());

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const currentPasswordHash = hashPassword(currentPassword);

    if (currentPasswordHash !== user.passwordHash) {
      return NextResponse.json({ error: 'Invalid current password' }, { status: 401 });
    }

    await updateUserPassword(user.username, hashPassword(newPassword));

    return NextResponse.json({ message: 'Password updated successfully' });

  } catch (error) {
    console.error('Change Password API error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

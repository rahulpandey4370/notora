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
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('users').select('*');
    if (error) throw error;

    if (!data || data.length === 0) {
      // Table empty -> seed with defaults, mirroring the old "create blob with
      // defaults if missing" behavior.
      const { error: seedError } = await supabase.from('users').upsert(
        defaultUsers.map(u => ({ username: u.username, email: u.email, password_hash: u.passwordHash, avatar_url: u.avatarUrl }))
      );
      if (seedError) console.error('Failed to seed default users:', seedError.message);
      return defaultUsers;
    }
    return data.map(fromRow);
  } catch (error) {
    console.error('Error fetching users from Supabase:', error);
    return defaultUsers;
  }
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

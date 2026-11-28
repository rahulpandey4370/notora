'use client';

import { createContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { clearDeviceCache } from '@/lib/device-cache';
import { useRouter } from 'next/navigation';
import type { User } from '@/lib/types';
import { loginResult, type LoginResult } from '@/lib/auth-result';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<LoginResult>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let stored: User | null = null;
    try {
      const raw = localStorage.getItem('notora-user');
      if (raw) stored = JSON.parse(raw);
    } catch (error) {
      console.error("Failed to parse user from localStorage", error);
      localStorage.removeItem('notora-user');
    }
    if (!stored) { setLoading(false); return; }
    // Show the app straight away; the session is checked in the background
    // (the server only trusts the httpOnly cookie, so a dead session can't see
    // anything, and is signed out here as soon as the check answers).
    const s = stored;
    setUser(prev => prev ?? s);
    setLoading(false);
    fetch('/api/session', { method: 'GET', cache: 'no-store' })
      .then(async (r) => {
        if (r.status === 401) throw new Error('signed-out');
        if (r.ok) {
          const { username } = await r.json();
          if (username !== stored!.username.toLowerCase()) throw new Error('signed-out');
        }
        setUser(prev => (prev?.username === stored!.username ? prev : stored));
      })
      .catch((e) => {
        if (e?.message === 'signed-out') { localStorage.removeItem('notora-user'); clearDeviceCache(); setUser(null); }
        // offline: keep the local session, saves will report errors
      });
  }, []);

  const login = async (email: string, pass: string): Promise<LoginResult> => {
    // No reply at all (offline, server unreachable) is a failure to sign in, not a wrong password.
    const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass }),
    }).catch(() => null);
    const result = loginResult(response ? response.status : null);

    if (response && result.ok) {
        const userData: Omit<User, 'email'> & { email: string } = await response.json();
        const userToStore: User = { 
            username: userData.username, 
            avatarUrl: userData.avatarUrl,
            email: userData.email,
        };
        setUser(userToStore);
        localStorage.setItem('notora-user', JSON.stringify(userToStore));
    }

    return result;
  };

  const logout = useCallback(() => {
    void fetch('/api/session', { method: 'DELETE' }).catch(() => {});
    setUser(null);
    localStorage.removeItem('notora-user');
    clearDeviceCache();
    router.push('/login');
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

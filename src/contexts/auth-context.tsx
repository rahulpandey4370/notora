'use client';

import { createContext, useState, useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@/lib/types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, pass: string) => Promise<boolean>;
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
    // The server only trusts the httpOnly session cookie. A device signed in
    // before that cookie existed (or whose cookie expired) must sign in again
    // rather than be shown an empty workspace.
    fetch('/api/session')
      .then(async (r) => {
        if (r.status === 401) throw new Error('signed-out');
        if (r.ok) {
          const { username } = await r.json();
          if (username !== stored!.username.toLowerCase()) throw new Error('signed-out');
        }
        setUser(stored);
      })
      .catch((e) => {
        if (e?.message === 'signed-out') localStorage.removeItem('notora-user');
        else setUser(stored); // offline: keep the local session, saves will report errors
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, pass: string): Promise<boolean> => {
    const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: pass }),
    });

    if (response.ok) {
        const userData: Omit<User, 'email'> & { email: string } = await response.json();
        const userToStore: User = { 
            username: userData.username, 
            avatarUrl: userData.avatarUrl,
            email: userData.email,
        };
        setUser(userToStore);
        localStorage.setItem('notora-user', JSON.stringify(userToStore));
        return true;
    }

    return false;
  };

  const logout = () => {
    void fetch('/api/session', { method: 'DELETE' }).catch(() => {});
    setUser(null);
    localStorage.removeItem('notora-user');
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

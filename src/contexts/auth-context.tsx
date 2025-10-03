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
    try {
      const storedUser = localStorage.getItem('notora-user');
      if (storedUser) {
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
        console.error("Failed to parse user from localStorage", error);
        localStorage.removeItem('notora-user');
    }
    setLoading(false);
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

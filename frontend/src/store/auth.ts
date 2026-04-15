'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Permission { name: string; description?: string; }
export interface Role { id: number; name: string; permissions: Permission[]; }
export interface User {
  id: number;
  email: string;
  full_name: string | null;
  is_active: boolean;
  role: Role;
  tenant_id: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
  hasPermission: (perm: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,

      setAuth: (user, accessToken) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('access_token', accessToken);
        }
        set({ user, accessToken, isAuthenticated: true });
      },

      logout: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('access_token');
        }
        set({ user: null, accessToken: null, isAuthenticated: false });
      },

      hasPermission: (perm) => {
        const { user } = get();
        if (!user) return false;
        return user.role.permissions.some((p) => p.name === perm);
      },
    }),
    {
      name: 'hotel-auth-store',
      partialize: (s) => ({
        user: s.user,
        accessToken: s.accessToken,
        isAuthenticated: s.isAuthenticated,
      }),
    }
  )
);

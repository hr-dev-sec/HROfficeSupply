import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { User, UserRole } from '../types';
import { useSupplyHub } from './SupplyHubContext';

interface LockoutState {
  attempts: number;
  lockedUntil: number | null;
}

interface AuthContextValue {
  user: User | null;
  login: (
    identifier: string,
    password: string,
    rememberMe: boolean
  ) => { ok: boolean; error?: string };
  loginAsDemo: (username: string) => void;
  logout: () => void;
  verifyPassword: (password: string) => boolean;
  lockoutRemainingSeconds: number;
  failedAttempts: number;
  canEditOperational: boolean;
  canApproveSM: boolean;
  canApproveDM: boolean;
  isSuperAdmin: boolean;
  hasRole: (roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const SESSION_KEY = 'hr_supplyhub_session_user_id';
const LOCKOUT_KEY = 'hr_supplyhub_login_lockout';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { store, logAction } = useSupplyHub();

  const [userId, setUserId] = useState<string | null>(() => {
    return localStorage.getItem(SESSION_KEY) || sessionStorage.getItem(SESSION_KEY);
  });

  const [lockout, setLockout] = useState<LockoutState>(() => {
    try {
      const raw = localStorage.getItem(LOCKOUT_KEY);
      if (!raw) return { attempts: 0, lockedUntil: null };
      return JSON.parse(raw) as LockoutState;
    } catch {
      return { attempts: 0, lockedUntil: null };
    }
  });

  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  useEffect(() => {
    if (!lockout.lockedUntil || lockout.lockedUntil <= Date.now()) return;
    const timer = setInterval(() => {
      const curr = Date.now();
      setNowMs(curr);
      if (lockout.lockedUntil && curr >= lockout.lockedUntil) {
        const cleared = { attempts: 0, lockedUntil: null };
        setLockout(cleared);
        localStorage.setItem(LOCKOUT_KEY, JSON.stringify(cleared));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [lockout.lockedUntil]);

  const user = store.users.find((u) => u.id === userId && u.active) || null;

  const lockoutRemainingSeconds =
    lockout.lockedUntil && lockout.lockedUntil > nowMs
      ? Math.ceil((lockout.lockedUntil - nowMs) / 1000)
      : 0;

  const login = useCallback(
    (identifier: string, password: string, rememberMe: boolean): { ok: boolean; error?: string } => {
      const curr = Date.now();
      if (lockout.lockedUntil && lockout.lockedUntil > curr) {
        const mins = Math.ceil((lockout.lockedUntil - curr) / 60000);
        return {
          ok: false,
          error: `Akun terkunci sementara karena 5 kali percobaan gagal. Coba lagi dalam ${mins} menit.`,
        };
      }

      const norm = identifier.trim().toLowerCase();
      const found = store.users.find(
        (u) =>
          u.active &&
          (u.username.toLowerCase() === norm || u.email.toLowerCase() === norm) &&
          u.password === password
      );

      if (!found) {
        const nextAttempts = lockout.attempts + 1;
        const nextLockout: LockoutState =
          nextAttempts >= 5
            ? { attempts: nextAttempts, lockedUntil: curr + 5 * 60 * 1000 }
            : { attempts: nextAttempts, lockedUntil: null };
        setLockout(nextLockout);
        localStorage.setItem(LOCKOUT_KEY, JSON.stringify(nextLockout));
        setNowMs(curr);

        if (nextAttempts >= 5) {
          return {
            ok: false,
            error: 'Terlalu banyak percobaan gagal (5x). Login dikunci selama 5 menit.',
          };
        }
        return {
          ok: false,
          error: `Username/email atau kata sandi salah. Sisa percobaan: ${5 - nextAttempts}x.`,
        };
      }

      const cleared = { attempts: 0, lockedUntil: null };
      setLockout(cleared);
      localStorage.setItem(LOCKOUT_KEY, JSON.stringify(cleared));

      setUserId(found.id);
      if (rememberMe) {
        localStorage.setItem(SESSION_KEY, found.id);
        sessionStorage.removeItem(SESSION_KEY);
      } else {
        sessionStorage.setItem(SESSION_KEY, found.id);
        localStorage.removeItem(SESSION_KEY);
      }

      logAction({
        userId: found.id,
        userName: found.name,
        userRole: found.role,
        action: 'LOGIN',
        objectType: 'Sesi Autentikasi',
        objectLabel: `${found.username} masuk ke sistem`,
      });

      return { ok: true };
    },
    [lockout, logAction, store.users]
  );

  const loginAsDemo = useCallback(
    (username: string) => {
      const found = store.users.find((u) => u.username === username && u.active);
      if (!found) return;
      const cleared = { attempts: 0, lockedUntil: null };
      setLockout(cleared);
      localStorage.setItem(LOCKOUT_KEY, JSON.stringify(cleared));
      setUserId(found.id);
      localStorage.setItem(SESSION_KEY, found.id);
      logAction({
        userId: found.id,
        userName: found.name,
        userRole: found.role,
        action: 'LOGIN',
        objectType: 'Login Demo 1-Klik',
        objectLabel: `${found.name} (${found.jabatan})`,
      });
    },
    [logAction, store.users]
  );

  const logout = useCallback(() => {
    setUserId(null);
    localStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);
  }, []);

  const verifyPassword = useCallback(
    (password: string) => {
      if (!user) return false;
      return user.password === password;
    },
    [user]
  );

  const role = user?.role;
  const isSuperAdmin = role === 'SUPER_ADMIN';
  const canEditOperational = role === 'SUPER_ADMIN' || role === 'STAFF';
  const canApproveSM = role === 'SUPER_ADMIN' || role === 'SECTION_MANAGER';
  const canApproveDM = role === 'SUPER_ADMIN' || role === 'DEPT_MANAGER';

  const hasRole = useCallback(
    (roles: UserRole[]) => Boolean(user && roles.includes(user.role)),
    [user]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        loginAsDemo,
        logout,
        verifyPassword,
        lockoutRemainingSeconds,
        failedAttempts: lockout.attempts,
        canEditOperational,
        canApproveSM,
        canApproveDM,
        isSuperAdmin,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth harus digunakan di dalam AuthProvider');
  return ctx;
}

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { User, UserRole } from '../types';
import { useSupplyHub } from './SupplyHubContext';

export const SESSION_TIMEOUT_OPTIONS = [5, 10, 15, 30, 60] as const;
export type SessionTimeoutMinutes = (typeof SESSION_TIMEOUT_OPTIONS)[number];
export type SessionExpiredReason = 'TIMEOUT' | null;

interface LockoutState {
  attempts: number;
  lockedUntil: number | null;
}

interface AuthContextValue {
  user: User | null;
  login: (
    identifier: string,
    password: string,
    rememberMe?: boolean
  ) => { ok: boolean; error?: string };
  loginAsDemo: (username: string) => void;
  logout: (reason?: 'MANUAL' | 'TIMEOUT') => void;
  verifyPassword: (password: string) => boolean;
  lockoutRemainingSeconds: number;
  failedAttempts: number;
  sessionTimeoutMinutes: SessionTimeoutMinutes;
  setSessionTimeoutMinutes: (minutes: SessionTimeoutMinutes) => void;
  remainingTimeoutSeconds: number;
  isTimeoutWarningOpen: boolean;
  extendSession: () => void;
  sessionExpiredReason: SessionExpiredReason;
  clearSessionExpiredReason: () => void;
  canEditOperational: boolean;
  canApproveSM: boolean;
  canApproveDM: boolean;
  isSuperAdmin: boolean;
  hasRole: (roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const SESSION_KEY = 'hr_supplyhub_session_user_id';
const LAST_ACTIVITY_KEY = 'hr_supplyhub_last_activity';
const TIMEOUT_PREF_KEY = 'hr_supplyhub_session_timeout_min';
const LOCKOUT_KEY = 'hr_supplyhub_login_lockout';

const DEFAULT_TIMEOUT_MINUTES: SessionTimeoutMinutes = 15;
const WARNING_THRESHOLD_SECONDS = 60;

function readValidatedTimeoutMinutes(): SessionTimeoutMinutes {
  try {
    const raw = localStorage.getItem(TIMEOUT_PREF_KEY);
    if (!raw) return DEFAULT_TIMEOUT_MINUTES;
    const parsed = Number(raw);
    if ((SESSION_TIMEOUT_OPTIONS as readonly number[]).includes(parsed)) {
      return parsed as SessionTimeoutMinutes;
    }
  } catch {
    // Ignore storage read error
  }
  return DEFAULT_TIMEOUT_MINUTES;
}

function readInitialSessionUserId(timeoutMinutes: SessionTimeoutMinutes): {
  userId: string | null;
  expiredOnBoot: boolean;
} {
  try {
    // Pastikan tidak ada sesi lama tersisa di localStorage agar tutup tab selalu kembali ke login
    localStorage.removeItem(SESSION_KEY);

    const savedId = sessionStorage.getItem(SESSION_KEY);
    if (!savedId) return { userId: null, expiredOnBoot: false };

    const lastActivityRaw = sessionStorage.getItem(LAST_ACTIVITY_KEY);
    const lastActivity = lastActivityRaw ? Number(lastActivityRaw) : Date.now();
    const timeoutMs = timeoutMinutes * 60 * 1000;

    if (!Number.isFinite(lastActivity) || Date.now() - lastActivity >= timeoutMs) {
      sessionStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(LAST_ACTIVITY_KEY);
      return { userId: null, expiredOnBoot: true };
    }

    return { userId: savedId, expiredOnBoot: false };
  } catch {
    return { userId: null, expiredOnBoot: false };
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { store, logAction } = useSupplyHub();

  const [sessionTimeoutMinutes, setSessionTimeoutMinutesState] = useState<SessionTimeoutMinutes>(
    () => readValidatedTimeoutMinutes()
  );

  const initialSessionRef = useRef<{ userId: string | null; expiredOnBoot: boolean } | null>(null);
  if (initialSessionRef.current === null) {
    initialSessionRef.current = readInitialSessionUserId(sessionTimeoutMinutes);
  }

  const [userId, setUserId] = useState<string | null>(initialSessionRef.current.userId);
  const [sessionExpiredReason, setSessionExpiredReason] = useState<SessionExpiredReason>(
    initialSessionRef.current.expiredOnBoot ? 'TIMEOUT' : null
  );

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
  const [remainingTimeoutSeconds, setRemainingTimeoutSeconds] = useState<number>(
    () => sessionTimeoutMinutes * 60
  );

  const lastActivityRef = useRef<number>((() => {
    try {
      const raw = sessionStorage.getItem(LAST_ACTIVITY_KEY);
      const parsed = raw ? Number(raw) : NaN;
      return Number.isFinite(parsed) ? parsed : Date.now();
    } catch {
      return Date.now();
    }
  })());
  const lastThrottleWriteRef = useRef<number>(0);

  const user = store.users.find((u) => u.id === userId && u.active) || null;
  const userRef = useRef<User | null>(user);
  userRef.current = user;

  const isTimeoutWarningOpen = Boolean(
    user && remainingTimeoutSeconds > 0 && remainingTimeoutSeconds <= WARNING_THRESHOLD_SECONDS
  );
  const isWarningOpenRef = useRef<boolean>(isTimeoutWarningOpen);
  isWarningOpenRef.current = isTimeoutWarningOpen;

  const setSessionTimeoutMinutes = useCallback((minutes: SessionTimeoutMinutes) => {
    if (!(SESSION_TIMEOUT_OPTIONS as readonly number[]).includes(minutes)) return;
    setSessionTimeoutMinutesState(minutes);
    try {
      localStorage.setItem(TIMEOUT_PREF_KEY, String(minutes));
    } catch {
      // Ignore storage error
    }
    const now = Date.now();
    lastActivityRef.current = now;
    try {
      if (sessionStorage.getItem(SESSION_KEY)) {
        sessionStorage.setItem(LAST_ACTIVITY_KEY, String(now));
      }
    } catch {
      // Ignore storage error
    }
    setRemainingTimeoutSeconds(minutes * 60);
  }, []);

  const logout = useCallback(
    (reason: 'MANUAL' | 'TIMEOUT' = 'MANUAL') => {
      const activeUser = userRef.current;
      if (activeUser && reason === 'TIMEOUT') {
        logAction({
          userId: activeUser.id,
          userName: activeUser.name,
          userRole: activeUser.role,
          action: 'LOGIN',
          objectType: 'Sesi Autentikasi',
          objectLabel: `${activeUser.username} keluar otomatis (session timeout)`,
        });
      }
      setUserId(null);
      setSessionExpiredReason(reason === 'TIMEOUT' ? 'TIMEOUT' : null);
      try {
        localStorage.removeItem(SESSION_KEY);
        sessionStorage.removeItem(SESSION_KEY);
        sessionStorage.removeItem(LAST_ACTIVITY_KEY);
      } catch {
        // Ignore storage error
      }
    },
    [logAction]
  );

  const extendSession = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;
    lastThrottleWriteRef.current = now;
    try {
      if (sessionStorage.getItem(SESSION_KEY)) {
        sessionStorage.setItem(LAST_ACTIVITY_KEY, String(now));
      }
    } catch {
      // Ignore storage error
    }
    setRemainingTimeoutSeconds(sessionTimeoutMinutes * 60);
  }, [sessionTimeoutMinutes]);

  const clearSessionExpiredReason = useCallback(() => {
    setSessionExpiredReason(null);
  }, []);

  // Lockout countdown timer
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

  // Idle session timeout & tab visibility watcher
  useEffect(() => {
    if (!user) return;

    const timeoutMs = sessionTimeoutMinutes * 60 * 1000;

    const syncRemaining = () => {
      const elapsed = Date.now() - lastActivityRef.current;
      const remainingSec = Math.max(0, Math.ceil((timeoutMs - elapsed) / 1000));
      setRemainingTimeoutSeconds(remainingSec);
      if (remainingSec <= 0) {
        logout('TIMEOUT');
      }
    };

    const handleActivity = () => {
      // Saat modal peringatan 60 detik sudah muncul, minta konfirmasi klik tombol "Tetap Masuk"
      if (isWarningOpenRef.current) return;
      const now = Date.now();
      if (now - lastThrottleWriteRef.current < 1000) return;
      lastActivityRef.current = now;
      lastThrottleWriteRef.current = now;
      try {
        sessionStorage.setItem(LAST_ACTIVITY_KEY, String(now));
      } catch {
        // Ignore storage error
      }
      setRemainingTimeoutSeconds(sessionTimeoutMinutes * 60);
    };

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        syncRemaining();
      }
    };

    syncRemaining();

    const activityEvents: Array<keyof WindowEventMap> = [
      'mousedown',
      'mousemove',
      'keydown',
      'scroll',
      'touchstart',
      'pointerdown',
      'click',
    ];
    activityEvents.forEach((evt) =>
      window.addEventListener(evt, handleActivity, { passive: true })
    );
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    const intervalId = window.setInterval(syncRemaining, 1000);

    return () => {
      activityEvents.forEach((evt) => window.removeEventListener(evt, handleActivity));
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      window.clearInterval(intervalId);
    };
  }, [user, sessionTimeoutMinutes, logout]);

  const lockoutRemainingSeconds =
    lockout.lockedUntil && lockout.lockedUntil > nowMs
      ? Math.ceil((lockout.lockedUntil - nowMs) / 1000)
      : 0;

  const login = useCallback(
    (identifier: string, password: string): { ok: boolean; error?: string } => {
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

      const now = Date.now();
      lastActivityRef.current = now;
      lastThrottleWriteRef.current = now;
      setSessionExpiredReason(null);
      setRemainingTimeoutSeconds(sessionTimeoutMinutes * 60);
      setUserId(found.id);

      // Simpan sesi HANYA di sessionStorage agar otomatis logout saat tab browser ditutup
      localStorage.removeItem(SESSION_KEY);
      sessionStorage.setItem(SESSION_KEY, found.id);
      sessionStorage.setItem(LAST_ACTIVITY_KEY, String(now));

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
    [lockout, logAction, sessionTimeoutMinutes, store.users]
  );

  const loginAsDemo = useCallback(
    (username: string) => {
      const found = store.users.find((u) => u.username === username && u.active);
      if (!found) return;
      const cleared = { attempts: 0, lockedUntil: null };
      setLockout(cleared);
      localStorage.setItem(LOCKOUT_KEY, JSON.stringify(cleared));

      const now = Date.now();
      lastActivityRef.current = now;
      lastThrottleWriteRef.current = now;
      setSessionExpiredReason(null);
      setRemainingTimeoutSeconds(sessionTimeoutMinutes * 60);
      setUserId(found.id);

      // Simpan sesi HANYA di sessionStorage agar otomatis logout saat tab browser ditutup
      localStorage.removeItem(SESSION_KEY);
      sessionStorage.setItem(SESSION_KEY, found.id);
      sessionStorage.setItem(LAST_ACTIVITY_KEY, String(now));

      logAction({
        userId: found.id,
        userName: found.name,
        userRole: found.role,
        action: 'LOGIN',
        objectType: 'Login Demo 1-Klik',
        objectLabel: `${found.name} (${found.jabatan})`,
      });
    },
    [logAction, sessionTimeoutMinutes, store.users]
  );

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
        sessionTimeoutMinutes,
        setSessionTimeoutMinutes,
        remainingTimeoutSeconds,
        isTimeoutWarningOpen,
        extendSession,
        sessionExpiredReason,
        clearSessionExpiredReason,
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

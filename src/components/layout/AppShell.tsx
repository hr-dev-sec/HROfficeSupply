import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeftRight,
  Bell,
  Bot,
  Box,
  CalendarRange,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  FileSpreadsheet,
  FolderUp,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  PenTool,
  RotateCcw,
  Search,
  Settings,
  User as UserIcon,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../context/LanguageContext';
import { useSupplyHub } from '../../context/SupplyHubContext';
import { useTheme } from '../../context/ThemeContext';
import { useToast } from '../../context/ToastContext';
import type { UserRole } from '../../types';
import { formatDateTimeIndo, getRoleLabel } from '../../utils/format';
import { AppearanceControls } from '../common/AppearanceControls';
import { AjiuLogoBadge, HseLogoBadge } from '../common/BrandEmblems';

interface NavEntry {
  to: string;
  label: string;
  labelEn: string;
  icon: React.FC<{ className?: string }>;
  roles?: UserRole[];
}

const NAV_ITEMS: NavEntry[] = [
  { to: '/app/dashboard', label: 'Dashboard', labelEn: 'Dashboard', icon: LayoutDashboard },
  {
    to: '/app/items',
    label: 'Master Item',
    labelEn: 'Item Master',
    icon: Package,
    roles: ['SUPER_ADMIN', 'STAFF', 'SECTION_MANAGER', 'DEPT_MANAGER'],
  },
  {
    to: '/app/transactions',
    label: 'Transaksi',
    labelEn: 'Transactions',
    icon: ArrowLeftRight,
    roles: ['SUPER_ADMIN', 'STAFF', 'SECTION_MANAGER', 'DEPT_MANAGER'],
  },
  {
    to: '/app/opname',
    label: 'Stock Opname',
    labelEn: 'Stock Opname',
    icon: ClipboardCheck,
    roles: ['SUPER_ADMIN', 'STAFF', 'SECTION_MANAGER', 'DEPT_MANAGER'],
  },
  { to: '/app/reports', label: 'Laporan Bulanan', labelEn: 'Monthly Reports', icon: FileSpreadsheet },
  {
    to: '/app/documents',
    label: 'Arsip Dokumen',
    labelEn: 'Document Archive',
    icon: FolderUp,
    roles: ['SUPER_ADMIN', 'STAFF', 'SECTION_MANAGER', 'DEPT_MANAGER'],
  },
  {
    to: '/app/signatures',
    label: 'Tanda Tangan Digital',
    labelEn: 'Digital Signatures',
    icon: PenTool,
    roles: ['SUPER_ADMIN', 'STAFF', 'SECTION_MANAGER', 'DEPT_MANAGER'],
  },
  {
    to: '/app/inventory',
    label: 'Inventaris Overhead',
    labelEn: 'Overhead Inventory',
    icon: Box,
    roles: ['SUPER_ADMIN', 'STAFF', 'SECTION_MANAGER', 'DEPT_MANAGER'],
  },
  {
    to: '/app/requests',
    label: 'Pengambilan & Approval',
    labelEn: 'Requests & Approval',
    icon: ClipboardList,
    roles: ['SUPER_ADMIN', 'STAFF', 'SECTION_MANAGER', 'DEPT_MANAGER'],
  },
  {
    to: '/app/forecast',
    label: 'Rolling Forecast GA',
    labelEn: 'GA Rolling Forecast',
    icon: CalendarRange,
    roles: ['SUPER_ADMIN', 'STAFF', 'SECTION_MANAGER', 'DEPT_MANAGER'],
  },
  {
    to: '/app/assistant',
    label: 'HR Assistant',
    labelEn: 'HR Assistant',
    icon: Bot,
    roles: ['SUPER_ADMIN', 'STAFF', 'SECTION_MANAGER', 'DEPT_MANAGER'],
  },
  {
    to: '/app/audit',
    label: 'Audit Log',
    labelEn: 'Audit Log',
    icon: History,
    roles: ['SUPER_ADMIN', 'SECTION_MANAGER', 'DEPT_MANAGER'],
  },
  {
    to: '/app/settings',
    label: 'Pengaturan',
    labelEn: 'Settings',
    icon: Settings,
    roles: ['SUPER_ADMIN', 'STAFF', 'SECTION_MANAGER', 'DEPT_MANAGER'],
  },
];

export const AppShell: React.FC = () => {
  const { user, logout } = useAuth();
  const { store, markNotificationRead, markAllNotificationsRead, resetDemoData } = useSupplyHub();
  const { activePreset } = useTheme();
  const { tr } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  // Redirect if not logged in
  useEffect(() => {
    if (!user) {
      navigate('/login', { replace: true });
    }
  }, [user, navigate]);

  // Ctrl+K global shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setNotifOpen(false);
        setProfileOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const visibleNav = useMemo(() => {
    if (!user) return [];
    return NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(user.role));
  }, [user]);

  const userNotifications = useMemo(() => {
    if (!user) return [];
    return store.notifications.filter(
      (n) =>
        (!n.targetUserId && !n.targetRoles) ||
        n.targetUserId === user.id ||
        (n.targetRoles && n.targetRoles.includes(user.role))
    );
  }, [store.notifications, user]);

  const unreadCount = userNotifications.filter((n) => !n.read).length;

  const globalResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return {
        items: store.items.filter((i) => !i.archived).slice(0, 4),
        reports: store.reports.slice(0, 3),
        inventories: store.inventories.slice(0, 3),
      };
    }
    return {
      items: store.items
        .filter(
          (i) =>
            !i.archived &&
            (i.itemName.toLowerCase().includes(q) ||
              i.codeItem.toLowerCase().includes(q) ||
              i.kategori.toLowerCase().includes(q) ||
              i.location.toLowerCase().includes(q))
        )
        .slice(0, 6),
      reports: store.reports
        .filter(
          (r) =>
            r.title.toLowerCase().includes(q) ||
            r.documentId.toLowerCase().includes(q) ||
            r.periodLabel.toLowerCase().includes(q)
        )
        .slice(0, 4),
      inventories: store.inventories
        .filter(
          (inv) =>
            inv.itemName.toLowerCase().includes(q) ||
            inv.partId.toLowerCase().includes(q)
        )
        .slice(0, 4),
    };
  }, [searchQuery, store.inventories, store.items, store.reports]);

  if (!user) return null;

  const activeNav = NAV_ITEMS.find((n) => location.pathname.startsWith(n.to));

  const handleResetDemo = () => {
    resetDemoData(user);
    setProfileOpen(false);
    toast(
      tr('Data demo berhasil dipulihkan', 'Demo data restored'),
      'success',
      tr(
        'Seluruh data kembali ke kondisi awal PDF September 2026.',
        'All records have been reset to the initial September 2026 baseline.'
      )
    );
  };

  return (
    <div className="min-h-screen flex bg-theme-canvas text-[#1F2328] dark:text-[#F1F3F5] transition-colors duration-300">
      {/* Mobile / Zoomed-in Drawer Backdrop */}
      {mobileOpen && (
        <div
          className="no-print fixed inset-0 z-40 bg-black/50 xl:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`no-print fixed xl:sticky top-0 left-0 z-50 h-screen flex flex-col border-r border-neutral-200/80 dark:border-neutral-800 bg-white/95 dark:bg-[#171A1F]/95 backdrop-blur-md transition-all duration-200 shrink-0 ${
          collapsed ? 'w-[76px]' : 'w-[252px]'
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full xl:translate-x-0'}`}
      >
        <div className="h-16 px-4 flex items-center justify-between border-b border-neutral-200/70 dark:border-neutral-800 shrink-0">
          <button
            type="button"
            onClick={() => navigate('/app/dashboard')}
            className="flex items-center gap-2.5 min-w-0 text-left"
          >
            <img
              src={store.settings.logoUrl}
              alt="Logo Ajinomoto"
              className="h-8 w-8 object-contain shrink-0 rounded-lg bg-white p-0.5"
            />
            {!collapsed && (
              <span className="font-display font-bold text-base tracking-tight truncate">
                HR SupplyHub
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="hidden xl:inline-flex p-1.5 rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            aria-label={collapsed ? 'Perluas sidebar' : 'Ciutkan sidebar'}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="xl:hidden p-1.5 rounded-lg text-neutral-500"
            aria-label="Tutup menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const navLabel = tr(item.label, item.labelEn);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                title={collapsed ? navLabel : undefined}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-theme-primary text-white shadow-sm'
                      : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800/80'
                  } ${collapsed ? 'justify-center px-2' : ''}`
                }
              >
                <Icon className="w-[18px] h-[18px] shrink-0" />
                {!collapsed && <span className="truncate">{navLabel}</span>}
              </NavLink>
            );
          })}
        </nav>

        <div className="p-3 border-t border-neutral-200/70 dark:border-neutral-800">
          <div
            className={`flex items-center gap-2.5 p-2 rounded-xl bg-neutral-100/80 dark:bg-neutral-800/60 ${
              collapsed ? 'justify-center' : ''
            }`}
          >
            <div
              className="w-8 h-8 rounded-lg text-white flex items-center justify-center text-xs font-bold shrink-0"
              style={{ backgroundColor: activePreset.primary }}
            >
              {user.avatarInitials}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold truncate">{user.name}</p>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                  {user.jabatan}
                </p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-clip">
        {/* Topbar */}
        <header className="no-print sticky top-0 z-30 h-16 px-3 sm:px-6 border-b border-neutral-200/80 dark:border-neutral-800 glass-surface flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="xl:hidden p-2 rounded-xl border border-neutral-200 dark:border-neutral-700 shrink-0"
              aria-label="Buka navigasi"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <div className="text-[11px] text-neutral-500 dark:text-neutral-400 hidden sm:block truncate">
                HR Dept. · PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory
              </div>
              <h1 className="text-sm sm:text-base font-bold truncate font-display">
                {activeNav ? tr(activeNav.label, activeNav.labelEn) : 'HR SupplyHub'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
            <div className="hidden 2xl:flex items-center gap-1.5 pr-1">
              <AjiuLogoBadge size="sm" />
              <HseLogoBadge size="sm" />
            </div>

            {/* Global Search Trigger */}
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#171A1F] text-xs text-neutral-500 hover:border-neutral-300 dark:hover:border-neutral-600 transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Search className="w-4 h-4 text-neutral-400" />
              <span className="hidden lg:inline">
                {tr('Cari item, kode, laporan...', 'Search items, codes, reports...')}
              </span>
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-[10px] font-mono-num">
                Ctrl+K
              </kbd>
            </button>

            {/* Theme Palette, Language & Dark Mode Controls */}
            <AppearanceControls compact />

            {/* Notifications */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setNotifOpen((v) => !v);
                  setProfileOpen(false);
                }}
                aria-label={tr('Notifikasi', 'Notifications')}
                className="relative p-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#171A1F] text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span
                    className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-white text-[10px] font-bold flex items-center justify-center tabular-nums"
                    style={{ backgroundColor: activePreset.primary }}
                  >
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 max-w-[calc(100vw-1.5rem)] rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#171A1F] shadow-xl overflow-hidden z-50">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-neutral-800">
                    <span className="text-sm font-bold">
                      {tr(`Notifikasi (${unreadCount} baru)`, `Notifications (${unreadCount} new)`)}
                    </span>
                    <button
                      type="button"
                      onClick={() => markAllNotificationsRead()}
                      className="inline-flex items-center gap-1 text-xs font-medium text-theme-primary hover:underline cursor-pointer"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      {tr('Tandai dibaca', 'Mark all read')}
                    </button>
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800">
                    {userNotifications.length === 0 ? (
                      <div className="p-6 text-center text-xs text-neutral-500">
                        {tr('Belum ada notifikasi.', 'No notifications yet.')}
                      </div>
                    ) : (
                      userNotifications.slice(0, 12).map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => {
                            markNotificationRead(n.id);
                            setNotifOpen(false);
                            navigate(n.linkTo);
                          }}
                          style={
                            !n.read
                              ? { backgroundColor: 'rgba(var(--brand-primary-rgb), 0.045)' }
                              : undefined
                          }
                          className="w-full text-left px-4 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/60 transition-colors cursor-pointer"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold text-[#1F2328] dark:text-neutral-100">
                              {n.title}
                            </span>
                            <span className="text-[10px] text-neutral-400">
                              {formatDateTimeIndo(n.createdAt)}
                            </span>
                          </div>
                          <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1 line-clamp-2">
                            {n.message}
                          </p>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profile Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setProfileOpen((v) => !v);
                  setNotifOpen(false);
                }}
                className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-[#171A1F] hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                <div
                  className="w-7 h-7 rounded-lg text-white text-xs font-bold flex items-center justify-center"
                  style={{ backgroundColor: activePreset.primary }}
                >
                  {user.avatarInitials}
                </div>
                <div className="hidden sm:block text-left">
                  <div className="text-xs font-semibold leading-tight max-w-[120px] truncate">
                    {user.name}
                  </div>
                  <div className="text-[10px] text-neutral-500 dark:text-neutral-400 leading-tight">
                    {getRoleLabel(user.role)}
                  </div>
                </div>
              </button>

              {profileOpen && (
                <div className="absolute right-0 mt-2 w-64 max-w-[calc(100vw-1.5rem)] rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#171A1F] shadow-xl p-2 z-50">
                  <div className="px-3 py-2 border-b border-neutral-100 dark:border-neutral-800 mb-1">
                    <div className="text-xs font-bold">{user.name}</div>
                    <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                      {user.jabatan} · {user.seksi}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false);
                      navigate('/app/settings');
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
                  >
                    <UserIcon className="w-4 h-4 text-neutral-500" />
                    {tr('Profil & Pengaturan', 'Profile & Settings')}
                  </button>
                  <button
                    type="button"
                    onClick={handleResetDemo}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    {tr('Reset Data Demo', 'Reset Demo Data')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      logout();
                      navigate('/login');
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    {tr('Keluar dari Sistem', 'Sign Out')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Body */}
        <main className="flex-1 p-3 sm:p-5 lg:p-6 xl:p-7 max-w-[1920px] w-full mx-auto min-w-0">
          <Outlet />
        </main>
      </div>

      {/* Global Search Ctrl+K Modal */}
      {searchOpen && (
        <div
          className="no-print fixed inset-0 z-[70] flex items-start justify-center pt-16 px-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setSearchOpen(false)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#171A1F] shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-neutral-200 dark:border-neutral-800">
              <Search className="w-5 h-5 text-neutral-400" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={tr(
                  'Ketik nama item, kode barang, Part_Id, atau ID laporan...',
                  'Type item name, code, Part_Id, or report ID...'
                )}
                className="flex-1 bg-transparent text-sm focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="px-2 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-[11px] font-mono-num"
              >
                ESC
              </button>
            </div>
            <div className="max-h-[420px] overflow-y-auto p-3 space-y-4">
              <div>
                <div className="px-2 text-[11px] font-semibold text-neutral-400 mb-1.5">
                  {tr('Master Item', 'Item Master')} ({globalResults.items.length})
                </div>
                <div className="space-y-1">
                  {globalResults.items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setSearchOpen(false);
                        navigate('/app/items');
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 text-left text-xs"
                    >
                      <div>
                        <span className="font-mono-num text-neutral-500 mr-2">
                          {item.codeItem || '-'}
                        </span>
                        <span className="font-semibold">{item.itemName}</span>
                        <span className="text-neutral-500 ml-2">· {item.location}</span>
                      </div>
                      <span className="font-mono-num font-semibold">
                        {item.currentStock} {item.uom}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="px-2 text-[11px] font-semibold text-neutral-400 mb-1.5">
                  {tr('Laporan Bulanan', 'Monthly Reports')} ({globalResults.reports.length})
                </div>
                <div className="space-y-1">
                  {globalResults.reports.map((rep) => (
                    <button
                      key={rep.id}
                      type="button"
                      onClick={() => {
                        setSearchOpen(false);
                        navigate('/app/reports');
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 text-left text-xs"
                    >
                      <div>
                        <span className="font-mono-num text-neutral-500 mr-2">
                          {rep.documentId}
                        </span>
                        <span className="font-semibold">{rep.title}</span>
                      </div>
                      <span className="text-neutral-500">
                        {rep.periodLabel} · {rep.status}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="px-2 text-[11px] font-semibold text-neutral-400 mb-1.5">
                  {tr('Inventaris Overhead', 'Overhead Inventory')} ({globalResults.inventories.length})
                </div>
                <div className="space-y-1">
                  {globalResults.inventories.map((inv) => (
                    <button
                      key={inv.id}
                      type="button"
                      onClick={() => {
                        setSearchOpen(false);
                        navigate('/app/inventory');
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-neutral-100 dark:hover:bg-neutral-800 text-left text-xs"
                    >
                      <div>
                        <span className="font-mono-num font-semibold text-theme-primary mr-2">
                          {inv.partId}
                        </span>
                        <span className="font-semibold">{inv.itemName}</span>
                      </div>
                      <span className="font-mono-num">
                        {inv.qty} {inv.uom} ·{' '}
                        {inv.condition === 'BAGUS' ? tr('Bagus', 'Good') : tr('Rusak', 'Damaged')}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

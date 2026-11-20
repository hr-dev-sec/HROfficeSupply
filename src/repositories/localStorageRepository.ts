import { buildSeedStore } from '../data/seedData';
import { buildRollingForecastSeed } from '../data/forecastSeed';
import type { SupplyHubStore } from '../types';
import type { ISupplyHubRepository } from './types';

const STORAGE_KEY = 'hr_supplyhub_ajinomoto_v1';

function normalizeStore(parsed: SupplyHubStore): SupplyHubStore {
  const next: SupplyHubStore = { ...parsed };
  if (!next.rollingForecast || !Array.isArray(next.rollingForecast.rows)) {
    next.rollingForecast = buildRollingForecastSeed();
  }
  if (!Array.isArray(next.documents)) {
    next.documents = [];
  }
  // Remove legacy PPC user / VIEWER role from cached storage
  if (Array.isArray(next.users)) {
    next.users = next.users.filter(
      (u) => u.id !== 'usr-ppc' && (u.role as string) !== 'VIEWER' && u.username !== 'ppc'
    );
  }
  // Clean legacy PPC Dept wording & refresh companyName from cached settings
  if (next.settings) {
    next.settings = {
      ...next.settings,
      companyName:
        next.settings.companyName === 'PT Ajinomoto Indonesia'
          ? 'PT Ajinomoto Indonesia - PT Ajinex International'
          : next.settings.companyName,
      instructionsCheck: Array.isArray(next.settings.instructionsCheck)
        ? next.settings.instructionsCheck.map((line) =>
            /ppc/i.test(line)
              ? 'Laporan dibuat setiap awal bulan dan sign oleh PIC + dicheck oleh SM dan diketahui oleh DM, untuk selanjutnya diarsipkan di HR Dept'
              : line
          )
        : [],
    };
  }
  // Clean legacy PPC Dept notifications / VIEWER targetRoles
  if (Array.isArray(next.notifications)) {
    next.notifications = next.notifications.map((n) => ({
      ...n,
      message: /ppc/i.test(n.message)
        ? n.message.replace(/dan siap diunduh PPC Dept\.?/i, 'dan terkunci sebagai arsip resmi HR Dept.')
        : n.message,
      targetRoles: n.targetRoles
        ? n.targetRoles.filter((r) => (r as string) !== 'VIEWER')
        : undefined,
    }));
  }
  return next;
}

export class LocalStorageSupplyHubRepository implements ISupplyHubRepository {
  loadStore(): SupplyHubStore {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        const seed = buildSeedStore();
        this.saveStore(seed);
        return seed;
      }
      const parsed = JSON.parse(raw) as SupplyHubStore;
      if (!parsed || !Array.isArray(parsed.items) || !Array.isArray(parsed.users)) {
        const seed = buildSeedStore();
        this.saveStore(seed);
        return seed;
      }
      const normalized = normalizeStore(parsed);
      if (normalized !== parsed) {
        this.saveStore(normalized);
      }
      return normalized;
    } catch {
      const seed = buildSeedStore();
      this.saveStore(seed);
      return seed;
    }
  }

  saveStore(store: SupplyHubStore): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    } catch (err) {
      console.error('Gagal menyimpan data ke localStorage:', err);
    }
  }

  resetDemoData(): SupplyHubStore {
    const fresh = buildSeedStore();
    this.saveStore(fresh);
    return fresh;
  }

  exportJson(): string {
    const store = this.loadStore();
    return JSON.stringify(store, null, 2);
  }

  importJson(rawJson: string): SupplyHubStore {
    const parsed = JSON.parse(rawJson) as SupplyHubStore;
    if (
      !parsed ||
      !Array.isArray(parsed.users) ||
      !Array.isArray(parsed.items) ||
      !Array.isArray(parsed.reports)
    ) {
      throw new Error('Format berkas backup JSON HR SupplyHub tidak valid.');
    }
    const normalized = normalizeStore(parsed);
    this.saveStore(normalized);
    return normalized;
  }
}

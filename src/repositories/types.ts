import type { SupplyHubStore } from '../types';

export interface ISupplyHubRepository {
  loadStore(): SupplyHubStore;
  saveStore(store: SupplyHubStore): void;
  resetDemoData(): SupplyHubStore;
  exportJson(): string;
  importJson(rawJson: string): SupplyHubStore;
  isRemoteEnabled?(): boolean;
  hydrateFromRemote?(): Promise<SupplyHubStore | null>;
  syncStoreDelta?(prev: SupplyHubStore, next: SupplyHubStore): Promise<void>;
  pushFullStoreToRemote?(store: SupplyHubStore): Promise<{ ok: boolean; error?: string }>;
}

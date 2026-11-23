import type { SupplyHubStore } from '../types';

export interface SyncResult {
  ok: boolean;
  error?: string;
}

export interface ISupplyHubRepository {
  loadStore(): SupplyHubStore;
  saveStore(store: SupplyHubStore): void;
  resetDemoData(): SupplyHubStore;
  exportJson(): string;
  importJson(rawJson: string): SupplyHubStore;
  isRemoteEnabled?(): boolean;
  hydrateFromRemote?(): Promise<SupplyHubStore | null>;
  syncStoreDelta?(prev: SupplyHubStore, next: SupplyHubStore): Promise<SyncResult>;
  pushFullStoreToRemote?(store: SupplyHubStore): Promise<SyncResult>;
  replaceFullStoreOnRemote?(store: SupplyHubStore): Promise<SyncResult>;
  subscribeToRemoteChanges?(onChange: (table: string) => void): () => void;
}

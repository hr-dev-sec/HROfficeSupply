import type { SupplyHubStore } from '../types';

export interface SyncResult {
  ok: boolean;
  error?: string;
}

export interface TableCheckResult {
  table: string;
  ok: boolean;
  remoteCount: number;
  localCount: number;
  error?: string;
}

export interface BucketCheckResult {
  bucket: string;
  ok: boolean;
  error?: string;
}

export interface DatabaseHealthReport {
  checkedAt: string;
  connected: boolean;
  projectHost: string;
  latencyMs: number;
  canWrite: boolean;
  writeError?: string;
  tables: TableCheckResult[];
  buckets: BucketCheckResult[];
  summary: {
    tablesOk: number;
    tablesTotal: number;
    bucketsOk: number;
    bucketsTotal: number;
  };
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
  testConnection?(localStore: SupplyHubStore): Promise<DatabaseHealthReport>;
  subscribeToRemoteChanges?(onChange: (table: string) => void): () => void;
}

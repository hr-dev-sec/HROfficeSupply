export type UserRole =
  | 'SUPER_ADMIN'
  | 'STAFF'
  | 'SECTION_MANAGER'
  | 'DEPT_MANAGER';

export interface User {
  id: string;
  username: string;
  email: string;
  password: string;
  name: string;
  role: UserRole;
  jabatan: string;
  seksi: string;
  avatarInitials: string;
  savedSignatureDataUrl?: string;
  active: boolean;
}

export type SupplyType = 'OFFICE_SUPPLIES' | 'OVERHEAD_GOODS';

export type ReportType = 'OFFICE_SUPPLIES' | 'OVERHEAD_GOODS' | 'INVENTARIS_OVERHEAD';

export interface SupplyItem {
  id: string;
  jenis: SupplyType;
  kategori: string;
  codeItem: string;
  itemName: string;
  uom: string;
  minStock: number;
  currentStock: number;
  location: string;
  notes: string;
  photoUrl?: string;
  archived: boolean;
  sortOrder?: number;
  createdAt: string;
  updatedAt: string;
}

export type TransactionType = 'TERIMA' | 'PAKAI' | 'OPNAME_ADJ';

export interface StockTransaction {
  id: string;
  itemId: string;
  jenis: SupplyType;
  codeItem: string;
  itemName: string;
  uom: string;
  type: TransactionType;
  qty: number;
  date: string; // YYYY-MM-DD
  period: string; // YYYY-MM
  recordedByUserId: string;
  recordedByName: string;
  note: string;
  referenceNo?: string;
  createdAt: string;
}

export interface OpnameLine {
  itemId: string;
  kategori: string;
  codeItem: string;
  itemName: string;
  uom: string;
  stokAwal: number;
  terima: number;
  pakai: number;
  systemStock: number;
  physicalStock: number;
  diff: number;
  reason: string;
  balanced: boolean;
}

export type OpnameStatus = 'DRAFT' | 'MENUNGGU_SM' | 'DISETUJUI' | 'DITOLAK';

export interface OpnameSession {
  id: string;
  period: string;
  jenis: SupplyType;
  createdAt: string;
  createdByUserId: string;
  createdByName: string;
  status: OpnameStatus;
  approvedByUserId?: string;
  approvedByName?: string;
  approvedAt?: string;
  rejectionNote?: string;
  lines: OpnameLine[];
}

export type WorkflowStage = 'DRAFT' | 'DILAPORKAN' | 'DICHECK' | 'MENGETAHUI' | 'FINAL';

export interface SignatureSlot {
  id: string;
  name: string;
  jabatan: string;
  allowedUserId: string;
  order: number;
  status: 'PENDING' | 'SIGNED' | 'REJECTED';
  signedByUserId?: string;
  signedByName?: string;
  signedAt?: string;
  signatureImageUrl?: string;
}

export interface SignatureGroup {
  id: string;
  label: string;
  stage: 'MENGETAHUI' | 'DICHECK' | 'DILAPORKAN';
  order: number;
  slots: SignatureSlot[];
}

export interface SignatureTemplate {
  id: string;
  name: string;
  jenis: ReportType;
  isDefault: boolean;
  groups: Array<{
    id: string;
    label: string;
    stage: 'MENGETAHUI' | 'DICHECK' | 'DILAPORKAN';
    order: number;
    slots: Array<{
      id: string;
      name: string;
      jabatan: string;
      allowedUserId: string;
      order: number;
    }>;
  }>;
}

export interface ReportCheckRow {
  itemId: string;
  kategori: string;
  codeItem: string;
  itemName: string;
  uom: string;
  stokAwal: number;
  terima: number;
  pakai: number;
  stockAkhir: number;
  minStock: number;
  location: string;
  notes: string;
}

export interface ReportInventoryRow {
  inventoryId: string;
  kategori: string;
  partId: string;
  itemName: string;
  qty: number;
  uom: string;
  location: string;
  condition: 'BAGUS' | 'RUSAK';
  notes: string;
}

export interface MonthlyReport {
  id: string;
  documentId: string;
  docHash: string;
  jenis: ReportType;
  title: string;
  period: string; // YYYY-MM
  periodLabel: string; // e.g., Sep-26 or September 2026
  department: string;
  section: string;
  placeDateText: string; // e.g., Mojokerto, 08 Oktober 2026
  status: WorkflowStage;
  checkRows?: ReportCheckRow[];
  inventoryRows?: ReportInventoryRow[];
  signatureGroups: SignatureGroup[];
  templateId: string;
  locked: boolean;
  version: number;
  versions: Array<{
    version: number;
    savedAt: string;
    savedBy: string;
    note: string;
  }>;
  rejectionHistory: Array<{
    at: string;
    byName: string;
    stage: string;
    note: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export type PartPrefix = 'MCH' | 'ELC' | 'ATK';

export interface OverheadInventoryMutation {
  id: string;
  date: string;
  type: 'IN' | 'OUT' | 'KONDISI';
  qty: number;
  note: string;
  byName: string;
}

export interface OverheadInventoryItem {
  id: string;
  partId: string;
  prefix: PartPrefix;
  kategori: string;
  itemName: string;
  qty: number;
  uom: string;
  location: string;
  condition: 'BAGUS' | 'RUSAK';
  notes: string;
  photoUrl?: string;
  mutations: OverheadInventoryMutation[];
  createdAt: string;
  updatedAt: string;
}

export const HR_SECTIONS = [
  'HR Development',
  'Administration & Operation',
] as const;

export type HrSection = (typeof HR_SECTIONS)[number];

export interface HrEmployee {
  id: string;
  nik: string;
  name: string;
  section: HrSection;
  jabatan: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ItemRequest {
  id: string;
  employeeId?: string;
  requesterNik?: string;
  requesterName: string;
  requesterSection: string;
  requestDate: string;
  status: 'MENUNGGU' | 'DISETUJUI' | 'DITOLAK';
  items: Array<{
    itemId: string;
    itemName: string;
    jenis?: SupplyType;
    uom: string;
    qty: number;
  }>;
  note: string;
  source?: 'PORTAL_DEPAN' | 'ADMIN';
  rejectionNote?: string;
  processedByName?: string;
  processedAt?: string;
}

export const FORECAST_MONTH_KEYS = [
  'Apr-26',
  'May-26',
  'Jun-26',
  'Jul-26',
  'Aug-26',
  'Sep-26',
  'Oct-26',
  'Nov-26',
  'Dec-26',
  'Jan-27',
  'Feb-27',
  'Mar-27',
] as const;

export type ForecastMonthKey = (typeof FORECAST_MONTH_KEYS)[number];

export interface RollingForecastRow {
  id: string;
  jenisNo: number;
  jenis: string;
  itemNo: number;
  codeItem: string;
  itemName: string;
  itemDescription: string;
  uom: string;
  rmStock: number | null;
  months: Partial<Record<ForecastMonthKey, number>>;
  estPemakaian: string;
  keterangan: string;
  updatedAt?: string;
}

export interface RollingForecastSubmission {
  id: string;
  month: ForecastMonthKey;
  submittedAt: string;
  submittedByName: string;
  totalItemsRequested: number;
  totalUnitsRequested: number;
  note: string;
}

export interface RollingForecastData {
  fiscalYearLabel: string;
  periodRangeLabel: string;
  department: string;
  section: string;
  activeMonth: ForecastMonthKey;
  rows: RollingForecastRow[];
  submissions: RollingForecastSubmission[];
  lastUpdatedAt: string;
  lastUpdatedBy: string;
}

export type DocumentCategory =
  | 'LAPORAN_OFFICE_SUPPLIES'
  | 'LAPORAN_OVERHEAD_GOODS'
  | 'LAPORAN_INVENTARIS'
  | 'ROLLING_FORECAST_GA'
  | 'STOCK_OPNAME'
  | 'BUKTI_SERAH_TERIMA'
  | 'SOP_MEMO';

export type DocumentLinkedModule =
  | 'REPORTS'
  | 'FORECAST'
  | 'OPNAME'
  | 'TRANSACTIONS'
  | 'INVENTORY'
  | 'GENERAL';

export interface SystemDocument {
  id: string;
  title: string;
  category: DocumentCategory;
  period: string; // Format YYYY-MM
  linkedModule: DocumentLinkedModule;
  linkedReportId?: string;
  fileName: string;
  fileType: string; // MIME type
  fileSize: number; // Bytes
  fileUrl: string; // Supabase Storage public URL atau DataURL lokal
  storagePath?: string; // Path objek di bucket supplyhub-documents
  notes: string;
  uploadedByUserId: string;
  uploadedByName: string;
  uploadedAt: string;
  updatedAt: string;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'STOK_KRITIS' | 'TANDA_TANGAN' | 'OPNAME' | 'LAPORAN' | 'PENGINGAT';
  targetUserId?: string;
  targetRoles?: UserRole[];
  linkTo: string;
  read: boolean;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action:
    | 'LOGIN'
    | 'CREATE'
    | 'UPDATE'
    | 'DELETE'
    | 'ARCHIVE'
    | 'RESTORE'
    | 'SIGN'
    | 'REJECT'
    | 'APPROVE'
    | 'EXPORT'
    | 'IMPORT'
    | 'RESET';
  objectType: string;
  objectLabel: string;
  oldValue?: string;
  newValue?: string;
}

export interface CompanySettings {
  companyName: string;
  factoryName: string;
  department: string;
  section: string;
  locationCity: string;
  logoUrl: string;
  instructionsCheck: string[];
  instructionsInventory: string[];
  reminderEarlyMonthDay: number;
  reminderOpnameDay: number;
  language: 'id' | 'en';
}

export interface MasterData {
  categoriesOffice: string[];
  categoriesOverhead: string[];
  uoms: string[];
  locations: string[];
}

export interface SupplyHubStore {
  users: User[];
  employees: HrEmployee[];
  items: SupplyItem[];
  transactions: StockTransaction[];
  opnames: OpnameSession[];
  templates: SignatureTemplate[];
  reports: MonthlyReport[];
  inventories: OverheadInventoryItem[];
  itemRequests: ItemRequest[];
  rollingForecast: RollingForecastData;
  documents: SystemDocument[];
  notifications: AppNotification[];
  auditLogs: AuditLogEntry[];
  masterData: MasterData;
  settings: CompanySettings;
}

export interface AssistantVisualData {
  title: string;
  kind: 'BAR' | 'TABLE';
  items: Array<{ label: string; value: number; secondary?: string }>;
}

export interface AssistantActionProposal {
  type: 'RECORD_PAKAI' | 'UPDATE_ROLLING_FORECAST' | 'CREATE_DRAFT_REPORT' | 'SEND_REMINDER';
  title: string;
  description: string;
  payloadJson: string;
  executed?: boolean;
}

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  visualData?: AssistantVisualData | null;
  actionProposal?: AssistantActionProposal | null;
}

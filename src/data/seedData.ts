import type {
  AppNotification,
  AuditLogEntry,
  CompanySettings,
  ItemRequest,
  MasterData,
  MonthlyReport,
  OpnameSession,
  OverheadInventoryItem,
  ReportCheckRow,
  ReportInventoryRow,
  SignatureGroup,
  SignatureTemplate,
  StockTransaction,
  SupplyHubStore,
  SupplyItem,
  User,
} from '../types';
import { computeDocHash, createDemoSignatureSvg } from '../utils/format';
import { buildRollingForecastSeed } from './forecastSeed';

export const SEED_USERS: User[] = [
  {
    id: 'usr-admin',
    username: 'admin',
    email: 'admin.hr@ajinomoto.co.id',
    password: 'demo123',
    name: 'Administrator HR',
    role: 'SUPER_ADMIN',
    jabatan: 'Super Admin HR Systems',
    seksi: 'HR Adm. & Operation',
    avatarInitials: 'AD',
    savedSignatureDataUrl: createDemoSignatureSvg('Administrator HR', '#111827'),
    active: true,
  },
  {
    id: 'usr-mahmud',
    username: 'mahmud',
    email: 'mahmud.nurdiansyah@ajinomoto.co.id',
    password: 'demo123',
    name: 'Mahmud Nurdiansyah',
    role: 'STAFF',
    jabatan: 'Staff HR Development',
    seksi: 'HR Development',
    avatarInitials: 'MN',
    savedSignatureDataUrl: createDemoSignatureSvg('Mahmud Nurdiansyah', '#0f172a'),
    active: true,
  },
  {
    id: 'usr-arya',
    username: 'arya',
    email: 'arya.rizkyndra@ajinomoto.co.id',
    password: 'demo123',
    name: 'Arya Rizkyndra H. D',
    role: 'SECTION_MANAGER',
    jabatan: 'Sect. Manager HR Development',
    seksi: 'HR Development',
    avatarInitials: 'AR',
    savedSignatureDataUrl: createDemoSignatureSvg('Arya Rizkyndra', '#1e293b'),
    active: true,
  },
  {
    id: 'usr-era',
    username: 'era',
    email: 'era.setyawati@ajinomoto.co.id',
    password: 'demo123',
    name: 'Era Setyawati',
    role: 'SECTION_MANAGER',
    jabatan: 'Sect. Manager HR Adm. & Operation',
    seksi: 'HR Adm. & Operation',
    avatarInitials: 'ES',
    savedSignatureDataUrl: createDemoSignatureSvg('Era Setyawati', '#1e293b'),
    active: true,
  },
  {
    id: 'usr-mujibur',
    username: 'mujibur',
    email: 'mujibur.rokhman@ajinomoto.co.id',
    password: 'demo123',
    name: 'Mujibur Rokhman',
    role: 'DEPT_MANAGER',
    jabatan: 'Dept. Manager HR',
    seksi: 'Human Resources',
    avatarInitials: 'MR',
    savedSignatureDataUrl: createDemoSignatureSvg('Mujibur Rokhman', '#111827'),
    active: true,
  },
];

export const SEED_SETTINGS: CompanySettings = {
  companyName: 'PT Ajinomoto Indonesia - PT Ajinex International',
  factoryName: 'Mojokerto Factory',
  department: 'Human Resources',
  section: 'HR Development & HR Adm. & Operation',
  locationCity: 'Mojokerto',
  logoUrl: '/logo-ajinomoto.png',
  instructionsCheck: [
    'List pengecheckan barang harus diisi rutin setiap bulan (1 periode bulan)',
    'Stock awal bulan diisi sesuai hasil stock opname akhir bulan sebelumnya',
    'Setiap kedatangan/ terima barang harus dicatat sesuai jumlah terima (ada buku log)',
    'Setiap pemakaian/ ambil barang juga harus dicatat (ada buku log)',
    'Lakukan stock opname setiap akhir bulan, stock harus balance (stock awal + terima - pakai = stock akhir)',
    'Stock minimum dikontrol tidak berlebihan, secukupnya saja ± 120% kebutuhan sebulan',
    'Laporan dibuat setiap awal bulan dan sign oleh PIC + dicheck oleh SM dan diketahui oleh DM, untuk selanjutnya diarsipkan di HR Dept',
  ],
  instructionsInventory: [
    'List barang inventaris harus diupdate jika ada perubahan data (in/out barang)',
    'Setiap barang harus diberi identitas jelas (Part_Id) dan dikontrol dengan baik',
    'Lakukan stock opname setiap akhir bulan, check barang (jumlah & kondisi fisik)',
    'Buat laporan check barang inventaris seksi rutin setiap bulan dan sign oleh PIC + dicheck oleh SM dan diketahui oleh DM',
  ],
  reminderEarlyMonthDay: 5,
  reminderOpnameDay: 28,
  language: 'id',
};

// Exact Office Supplies items (65 items across 31 categories)
// Tuple: [kategori, codeItem, itemName, uom, sepAwal, sepTerima, sepPakai, minStock, location]
type RawCheckSeed = [string, string, string, string, number, number, number, number, string];

const RAW_OFFICE_SUPPLIES: RawCheckSeed[] = [
  ['Cutter', '20355', 'Cutter A-300 Kenko', 'PC', 0, 0, 0, 1, 'Lemari 6 Baris 2'],
  ['Cutter', '20359', 'Cutter L-500 Kenko', 'PC', 2, 0, 0, 1, 'Lemari 6 Baris 2'],
  ['Double Tape', '10023', 'Double Tape Foam 1', 'PC', 2, 0, 0, 1, 'Lemari 6 Baris 2'],
  ['Double Tape', '20387', 'Double Tape 1 NACHI', 'PC', 3, 0, 3, 1, 'Lemari 6 Baris 2'],
  ['Double Tape', '20389', 'Double Tape 2 inch', 'PC', 2, 0, 0, 2, 'Lemari 6 Baris 2'],
  ['Double Tape', '20391', 'Double Tape Nachi 1/2', 'PC', 0, 0, 0, 1, 'Lemari 6 Baris 2'],
  ['Lakban', '20693', 'Lakban Daimaru Coklat', 'ROL', 1, 0, 0, 1, 'Lemari 6 Baris 2'],
  ['Lakban', '20697', 'Lakban Hitam Nachi 2 inch', 'ROL', 2, 2, 0, 2, 'Lemari 6 Baris 2'],
  ['Lakban', '20700', 'Lakban Kuning 2 inch', 'ROL', 5, 0, 1, 2, 'Lemari 6 Baris 2'],
  ['Amplop', '20017', 'Amplop coklat A4 (POLOS)', 'PAC', 3, 0, 0, 1, 'Lemari 6 Baris 1'],
  ['Amplop', '20039', 'Amplop Paperline 104 = 95x152mm', 'PAC', 3, 0, 0, 1, 'Lemari 6 Baris 1'],
  ['Amplop', '20040', 'Amplop Paperline 90 = 110x230mm', 'PAC', 2, 0, 0, 1, 'Lemari 6 Baris 1'],
  ['Ballpoint', '20088', 'Ballpoint Snowman V-5 (Biru)', 'PAC', 1, 0, 0, 2, 'Lemari 6 Baris 2'],
  ['Ballpoint', '20089', 'Ballpoint Snowman V-5 (Hitam)', 'PAC', 1, 0, 1, 2, 'Lemari 6 Baris 2'],
  ['Refill/isi Pensil', '10076', 'Refill/isi Pensil', 'EA', 3, 0, 1, 1, 'Lemari 6 Baris 2'],
  ['Pensil Pilot 0.5 H 1010', '20856', 'Pensil Pilot 0.5 H 1010', 'PC', 2, 0, 0, 1, 'Lemari 6 Baris 2'],
  ['Baterai', '20112', 'Energyzer A2', 'PAC', 3, 0, 2, 3, 'Lemari 6 Baris 2'],
  ['Baterai', '20113', 'Energyzer + Alkaline A3', 'PAC', 5, 0, 0, 1, 'Lemari 6 Baris 2'],
  ['Binder Clip', '20160', 'Binder Clip 111=25 mm Q-Biz 96 pc', 'PAC', 2, 0, 0, 1, 'Lemari 6 Baris 1'],
  ['Binder Clip', '20169', 'Binder Clip No.200 (hrg/12 pcs)', 'EA', 2, 0, 0, 1, 'Lemari 6 Baris 1'],
  ['Binder Clip', '20170', 'Binder Clip No.260 (hrg/12 pcs)', 'EA', 2, 0, 0, 1, 'Lemari 6 Baris 1'],
  ['Binder Clip', '20172', 'Binder Clips No.105', 'PAC', 2, 0, 0, 1, 'Lemari 6 Baris 1'],
  ['Clear sheet Bantex', '20320', 'Clear Sheet Bantex F4 = 100 pcs 2035', 'PAC', 6, 0, 0, 1, 'Lemari 5 Baris 1'],
  ['Correction Pen', '20343', 'Correction Pen ZL62-W (Blue)', 'PC', 2, 0, 0, 2, 'Lemari 6 Baris 2'],
  ['Pita penghapus', '20881', 'Correction tape Joyko CT-507 size 5mm 8m', 'PC', 2, 0, 1, 1, 'Lemari 6 Baris 2'],
  ['Ordner Bantex', '20797', 'Ordner Bantex F4 tipe 1465', 'PC', 21, 0, 0, 10, 'Lemari 7 Baris 1'],
  ['File Spring F4 Seagull', '20428', 'File Spring F4 Seagull', 'PC', 53, 0, 0, 10, 'Lemari 7 Baris 2'],
  ['Gunting', '20480', 'Gunting besar KS-848N KENKO', 'PC', 0, 0, 0, 1, 'Lemari 6 Baris 1'],
  ['Isi Cutter', '20521', 'Isi Cutter Kecil', 'PC', 1, 0, 0, 1, 'Lemari 6 Baris 2'],
  ['Isi Cutter', '20522', 'Isi cutter L-150 KENKO', 'DZ', 1, 0, 0, 1, 'Lemari 6 Baris 2'],
  ['Isi Staples', '20527', 'Isi Staples no. 10 Max HD=20 pak kecil', 'PAC', 3, 0, 0, 1, 'Lemari 6 Baris 1'],
  ['Isolasi Bening', '20535', 'Isolasi bening 1x72 yards Panfix', 'ROL', 2, 0, 2, 1, 'Lemari 6 Baris 1'],
  ['Isolasi Bening', '20541', 'Isolasi Panfix 1/2 Inch X 72 YDS X 12 Roll', 'CAN', 3, 0, 0, 1, 'Lemari 6 Baris 2'],
  ['Isolasi Bening', '20688', 'Lakban / Isolasi Bening 2 inch NACHI', 'ROL', 3, 0, 0, 3, 'Lemari 6 Baris 2'],
  ['Kertas', '20603', 'Kertas A3, 70gr', 'PAC', 1, 0, 0, 1, 'Lemari 5 Baris 2'],
  ['Kertas', '20624', 'Kertas F4 70g Putih', 'PAC', 9, 0, 0, 2, 'Lemari 5 Baris 2'],
  ['Kertas', '20662', 'Kop Surat PT. Nex A4', 'PC', 3, 0, 0, 1, 'Lemari 5 Baris 2'],
  ['Kertas', '20664', 'Kop Surat PTA A4', 'PC', 6, 0, 0, 1, 'Lemari 5 Baris 2'],
  ['Lem', '20721', 'Lem UHU Stick 40 g', 'PC', 6, 0, 0, 1, 'Lemari 6 Baris 2'],
  ['Penggaris', '', 'Penggaris Butterfly 30 cm', 'PC', 3, 0, 0, 1, 'Lemari 6 Baris 2'],
  ['Penghapus White Board', '20854', 'Penghapus White Board JOYCO', 'PC', 1, 0, 0, 1, 'Lemari 6 Baris 2'],
  ['Penghapus Pensil', '20853', 'Penghapus Pensil 526 B40 (kecil)', 'PC', 4, 0, 0, 1, 'Lemari 6 Baris 2'],
  ['Plastik Laminating', '20900', 'Plastik Laminating A4', 'PAC', 1, 0, 0, 1, 'Lemari 5 Baris 1'],
  ['Plastik Laminating', '20901', 'Plastik Laminating F4 Joyco', 'PAC', 3, 0, 0, 1, 'Lemari 5 Baris 1'],
  ['Plastik Laminating', '20903', 'Plastik Laminating Sakurai A3', 'PAC', 3, 0, 0, 1, 'Lemari 5 Baris 1'],
  ['Post It', '20935', 'Post IT Pronto Page Mark PSN15', 'PAC', 3, 0, 1, 2, 'Lemari 6 Baris 2'],
  ['Post It', '20940', 'Post IT No. 654 (76x76mm)', 'PAC', 6, 0, 4, 1, 'Lemari 6 Baris 2'],
  ['Post It', '20942', 'Post IT SIGN HERE @12 Pad', 'PAC', 4, 0, 0, 1, 'Lemari 6 Baris 2'],
  ['Tissue', '21294', 'Tissue Kotak Paseo Facial 280', 'PAC', 4, 0, 3, 3, 'Lemari 5 Baris 1'],
  ['Spidol Board Marker', '21120', 'Spidol Board Marker Biru', 'PC', 36, 0, 0, 2, 'Lemari 6 Baris 2'],
  ['Spidol Board Marker', '21121', 'Spidol Board Marker Hijau', 'PC', 38, 0, 0, 2, 'Lemari 6 Baris 2'],
  ['Spidol Board Marker', '21122', 'Spidol Board Marker Hitam', 'PC', 7, 0, 0, 3, 'Lemari 6 Baris 2'],
  ['Spidol Board Marker', '21123', 'Spidol Board Marker Merah', 'PC', 8, 0, 0, 2, 'Lemari 6 Baris 2'],
  ['Stabilo', '', 'Kuning', 'PC', 2, 0, 0, 1, 'Lemari 6 Baris 2'],
  ['Stabilo', '', 'Hijau', 'PC', 2, 0, 0, 1, 'Lemari 6 Baris 2'],
  ['Stabilo', '', 'Merah Muda', 'PC', 4, 0, 0, 1, 'Lemari 6 Baris 2'],
  ['Tinta Spidol Permanent', '21271', '(refill) Warna Hijau', 'DZ', 2, 0, 0, 1, 'Lemari 6 Baris 1'],
  ['Tinta Spidol Permanent', '21272', '(refill) Warna Hitam', 'DZ', 2, 0, 0, 1, 'Lemari 6 Baris 1'],
  ['Tinta Trodat', '21284', 'Tinta Trodat Biru', 'PC', 2, 0, 0, 1, 'Lemari 6 Baris 2'],
  ['Tinta Trodat', '21287', 'Tinta Trodat Merah', 'BTL', 2, 0, 0, 1, 'Lemari 6 Baris 2'],
  ['Tinta Printer', '', 'Epson Hitam', 'PC', 5, 0, 0, 2, 'Lemari 6 Baris 1'],
  ['Tinta Printer', '', 'Epson Biru', 'PC', 3, 0, 0, 2, 'Lemari 6 Baris 1'],
  ['Tinta Printer', '', 'Epson Kuning', 'PC', 3, 0, 0, 2, 'Lemari 6 Baris 1'],
  ['Tinta Printer', '', 'Epson Merah Muda', 'PC', 2, 0, 0, 2, 'Lemari 6 Baris 1'],
  ['Trigonal Clips', '21313', 'Trigonal Clips No.3', 'PAC', 2, 0, 0, 1, 'Lemari 6 Baris 1'],
];

// Exact Overhead Goods items from PDF Page 2 (23 items)
const RAW_OVERHEAD_GOODS: RawCheckSeed[] = [
  ['OVERHEAD GOODS', '', 'Totebag AJIU - Hijau', 'PC', 1, 0, 0, 1, 'Cabinet 5 Baris 1'],
  ['OVERHEAD GOODS', '', 'Totebag AJIU - Orange', 'PC', 0, 0, 0, 1, 'Cabinet 5 Baris 1'],
  ['OVERHEAD GOODS', '', 'Totebag AJIU - Biru', 'PC', 0, 0, 0, 1, 'Cabinet 5 Baris 1'],
  ['OVERHEAD GOODS', '', 'Totebag AJIU - Hitam putih', 'PC', 1, 0, 0, 1, 'Cabinet 5 Baris 1'],
  ['OVERHEAD GOODS', '', 'Totebag AJIU - Merah', 'PC', 0, 0, 0, 1, 'Cabinet 5 Baris 1'],
  ['OVERHEAD GOODS', '', 'Notebook AJIU', 'PC', 19, 0, 0, 1, 'Cabinet 5 Baris 1'],
  ['OVERHEAD GOODS', '', 'Bulpoin AJIU', 'PC', 10, 0, 0, 1, 'Cabinet 5 Baris 1'],
  ['OVERHEAD GOODS', '', 'Botol AJIU', 'PC', 2, 0, 0, 1, 'Cabinet 5 Baris 1'],
  ['OVERHEAD GOODS', '', 'Totebag Hitam', 'PC', 4, 0, 0, 1, 'Cabinet 5 Baris 1'],
  ['OVERHEAD GOODS', '', 'Box Training Kit AJIU', 'PC', 16, 0, 0, 5, 'Lemari 7 Baris 3-4'],
  ['OVERHEAD GOODS', '', 'Doorprize - Tas Bucheri', 'PC', 1, 0, 0, 1, 'Cabinet 5 Baris 1'],
  ['OVERHEAD GOODS', '', 'Doorprize - Raket', 'PC', 3, 0, 0, 1, 'Cabinet 5 Baris 1'],
  ['OVERHEAD GOODS', '', 'Doorprize - Handuk', 'PC', 3, 0, 0, 1, 'Cabinet 5 Baris 2'],
  ['OVERHEAD GOODS', '', 'Doorprize - Hairdryer', 'PC', 2, 0, 0, 1, 'Cabinet 5 Baris 2'],
  ['OVERHEAD GOODS', '', 'Doorprize - Alat Tes Darah', 'PC', 3, 0, 0, 1, 'Cabinet 5 Baris 2'],
  ['OVERHEAD GOODS', '', 'Doorprize - Alat Tensi', 'PC', 6, 0, 0, 1, 'Cabinet 5 Baris 2'],
  ['OVERHEAD GOODS', '', 'Doorprize - Kipas Angin', 'PC', 4, 0, 0, 1, 'Lemari 7 Baris 2'],
  ['OVERHEAD GOODS', '', 'Stop Kontak', 'PC', 3, 0, 0, 1, 'Cabinet 6 Baris 2'],
  ['OVERHEAD GOODS', '', 'Keyboard', 'PC', 6, 0, 0, 1, 'Cabinet 6 Baris 2'],
  ['OVERHEAD GOODS', '', 'Tripod', 'PC', 1, 0, 0, 1, 'NOB 1'],
  ['OVERHEAD GOODS', '', 'Webcam', 'PC', 1, 0, 0, 1, 'NOB 1'],
  ['OVERHEAD GOODS', '', 'Stick E-Toll', 'PC', 5, 0, 0, 1, 'Cabinet 5 Baris 1'],
  ['OVERHEAD GOODS', '', 'Akrilik', 'PC', 10, 5, 0, 1, 'Cabinet 5 Baris 1'],
];

// Inventaris Overhead from PDF Page 3 (all 23 items matching MCH-01..13, ELC-01..08, ATK-01..02)
const RAW_INVENTORIES: Array<{
  partId: string;
  prefix: 'MCH' | 'ELC' | 'ATK';
  itemName: string;
  qty: number;
  location: string;
}> = [
  { partId: 'MCH-01', prefix: 'MCH', itemName: 'Totebag AJIU - Hijau', qty: 1, location: 'Cabinet 5 Baris 1' },
  { partId: 'MCH-02', prefix: 'MCH', itemName: 'Totebag AJIU - Orange', qty: 0, location: 'Cabinet 5 Baris 1' },
  { partId: 'MCH-03', prefix: 'MCH', itemName: 'Totebag AJIU - Biru', qty: 0, location: 'Cabinet 5 Baris 1' },
  { partId: 'MCH-04', prefix: 'MCH', itemName: 'Totebag AJIU - Hitam putih', qty: 1, location: 'Cabinet 5 Baris 1' },
  { partId: 'MCH-05', prefix: 'MCH', itemName: 'Totebag AJIU - Merah', qty: 0, location: 'Cabinet 5 Baris 1' },
  { partId: 'MCH-06', prefix: 'MCH', itemName: 'Notebook AJIU', qty: 19, location: 'Cabinet 5 Baris 1' },
  { partId: 'MCH-07', prefix: 'MCH', itemName: 'Bulpoin AJIU', qty: 10, location: 'Cabinet 5 Baris 1' },
  { partId: 'MCH-08', prefix: 'MCH', itemName: 'Botol AJIU', qty: 2, location: 'Cabinet 5 Baris 1' },
  { partId: 'MCH-09', prefix: 'MCH', itemName: 'Totebag Hitam', qty: 4, location: 'Cabinet 5 Baris 1' },
  { partId: 'MCH-10', prefix: 'MCH', itemName: 'Box Training Kit AJIU', qty: 16, location: 'Lemari 7 Baris 3-4' },
  { partId: 'MCH-11', prefix: 'MCH', itemName: 'Doorprize - Tas Bucheri', qty: 1, location: 'Cabinet 5 Baris 1' },
  { partId: 'MCH-12', prefix: 'MCH', itemName: 'Doorprize - Raket', qty: 3, location: 'Cabinet 5 Baris 1' },
  { partId: 'MCH-13', prefix: 'MCH', itemName: 'Doorprize - Handuk', qty: 3, location: 'Cabinet 5 Baris 2' },
  { partId: 'ELC-01', prefix: 'ELC', itemName: 'Doorprize - Hairdryer', qty: 2, location: 'Cabinet 5 Baris 2' },
  { partId: 'ELC-02', prefix: 'ELC', itemName: 'Doorprize - Alat Tes Darah', qty: 3, location: 'Cabinet 5 Baris 2' },
  { partId: 'ELC-03', prefix: 'ELC', itemName: 'Doorprize - Alat Tensi', qty: 6, location: 'Cabinet 5 Baris 2' },
  { partId: 'ELC-04', prefix: 'ELC', itemName: 'Doorprize - Kipas Angin', qty: 4, location: 'Cabinet 5 Baris 2' },
  { partId: 'ELC-05', prefix: 'ELC', itemName: 'Stop Kontak', qty: 3, location: 'Cabinet 6 Baris 2' },
  { partId: 'ELC-06', prefix: 'ELC', itemName: 'Keyboard', qty: 6, location: 'Cabinet 6 Baris 2' },
  { partId: 'ELC-07', prefix: 'ELC', itemName: 'Tripod', qty: 1, location: 'File Room NOB 1' },
  { partId: 'ELC-08', prefix: 'ELC', itemName: 'Webcam', qty: 1, location: 'File Room NOB 1' },
  { partId: 'ATK-01', prefix: 'ATK', itemName: 'Stick E-Toll', qty: 5, location: 'Cabinet 5 Baris 1' },
  { partId: 'ATK-02', prefix: 'ATK', itemName: 'Akrilik', qty: 15, location: 'Cabinet 5 Baris 1' },
];

export function buildSeedStore(): SupplyHubStore {
  const nowIso = '2026-10-14T08:30:00.000Z';

  // 1. Items
  const officeItems: SupplyItem[] = RAW_OFFICE_SUPPLIES.map((row, idx) => {
    const [kategori, codeItem, itemName, uom, sepAwal, sepTerima, sepPakai, minStock, location] = row;
    const sepAkhir = sepAwal + sepTerima - sepPakai;
    return {
      id: `item-os-${String(idx + 1).padStart(3, '0')}`,
      jenis: 'OFFICE_SUPPLIES',
      kategori,
      codeItem,
      itemName,
      uom,
      minStock,
      currentStock: sepAkhir,
      location,
      notes: sepAkhir <= minStock ? 'Perlu pengisian ulang stok' : '',
      archived: false,
      sortOrder: idx + 1,
      createdAt: '2025-10-01T08:00:00.000Z',
      updatedAt: nowIso,
    };
  });

  const overheadItems: SupplyItem[] = RAW_OVERHEAD_GOODS.map((row, idx) => {
    const [kategori, codeItem, itemName, uom, sepAwal, sepTerima, sepPakai, minStock, location] = row;
    const sepAkhir = sepAwal + sepTerima - sepPakai;
    return {
      id: `item-oh-${String(idx + 1).padStart(3, '0')}`,
      jenis: 'OVERHEAD_GOODS',
      kategori,
      codeItem,
      itemName,
      uom,
      minStock,
      currentStock: sepAkhir,
      location,
      notes: sepAkhir === 0 ? 'Stok habis' : '',
      archived: false,
      sortOrder: idx + 1,
      createdAt: '2025-10-01T08:00:00.000Z',
      updatedAt: nowIso,
    };
  });

  const items = [...officeItems, ...overheadItems];

  // 2. MasterData
  const officeCategories = Array.from(new Set(RAW_OFFICE_SUPPLIES.map((r) => r[0])));
  const masterData: MasterData = {
    categoriesOffice: officeCategories,
    categoriesOverhead: ['OVERHEAD GOODS', 'Overhead'],
    uoms: ['PC', 'PAC', 'ROL', 'CAN', 'EA', 'DZ', 'BTL', 'UNT', 'SET'],
    locations: [
      'Lemari 5 Baris 1',
      'Lemari 5 Baris 2',
      'Lemari 6 Baris 1',
      'Lemari 6 Baris 2',
      'Lemari 7 Baris 1',
      'Lemari 7 Baris 2',
      'Lemari 7 Baris 3-4',
      'Cabinet 5 Baris 1',
      'Cabinet 5 Baris 2',
      'Cabinet 6 Baris 2',
      'File Room NOB 1',
      'NOB 1',
    ],
  };

  // 3. Signature Templates
  const templates: SignatureTemplate[] = [
    {
      id: 'tpl-office',
      name: 'Standar HR Office Supplies (3 Grup)',
      jenis: 'OFFICE_SUPPLIES',
      isDefault: true,
      groups: [
        {
          id: 'grp-mengetahui',
          label: 'Mengetahui,',
          stage: 'MENGETAHUI',
          order: 1,
          slots: [
            {
              id: 'slot-dm',
              name: 'Mujibur Rokhman',
              jabatan: 'Dept. Manager HR',
              allowedUserId: 'usr-mujibur',
              order: 1,
            },
          ],
        },
        {
          id: 'grp-dicheck',
          label: 'Dicheck oleh,',
          stage: 'DICHECK',
          order: 2,
          slots: [
            {
              id: 'slot-sm-1',
              name: 'Arya Rizkyndra H. D',
              jabatan: 'Sect. Manager HR Development',
              allowedUserId: 'usr-arya',
              order: 1,
            },
            {
              id: 'slot-sm-2',
              name: 'Era Setyawati',
              jabatan: 'Sect. Manager HR Adm. & Operation',
              allowedUserId: 'usr-era',
              order: 2,
            },
          ],
        },
        {
          id: 'grp-dilaporkan',
          label: 'Dilaporkan oleh,',
          stage: 'DILAPORKAN',
          order: 3,
          slots: [
            {
              id: 'slot-pic',
              name: 'Mahmud Nurdiansyah',
              jabatan: 'Staff HR Development',
              allowedUserId: 'usr-mahmud',
              order: 1,
            },
          ],
        },
      ],
    },
    {
      id: 'tpl-overhead',
      name: 'Standar HR Overhead Goods (3 Grup)',
      jenis: 'OVERHEAD_GOODS',
      isDefault: true,
      groups: [
        {
          id: 'grp-mengetahui',
          label: 'Mengetahui,',
          stage: 'MENGETAHUI',
          order: 1,
          slots: [
            {
              id: 'slot-dm',
              name: 'Mujibur Rokhman',
              jabatan: 'Dept. Manager HR',
              allowedUserId: 'usr-mujibur',
              order: 1,
            },
          ],
        },
        {
          id: 'grp-dicheck',
          label: 'Dicheck oleh,',
          stage: 'DICHECK',
          order: 2,
          slots: [
            {
              id: 'slot-sm-1',
              name: 'Arya Rizkyndra H. D',
              jabatan: 'Sect. Manager HR Development',
              allowedUserId: 'usr-arya',
              order: 1,
            },
            {
              id: 'slot-sm-2',
              name: 'Era Setyawati',
              jabatan: 'Sect. Manager HR Adm. & Operation',
              allowedUserId: 'usr-era',
              order: 2,
            },
          ],
        },
        {
          id: 'grp-dilaporkan',
          label: 'Dilaporkan oleh,',
          stage: 'DILAPORKAN',
          order: 3,
          slots: [
            {
              id: 'slot-pic',
              name: 'Mahmud Nurdiansyah',
              jabatan: 'Staff HR Development',
              allowedUserId: 'usr-mahmud',
              order: 1,
            },
          ],
        },
      ],
    },
    {
      id: 'tpl-inventaris',
      name: 'Standar HR Inventaris Overhead (3 Grup)',
      jenis: 'INVENTARIS_OVERHEAD',
      isDefault: true,
      groups: [
        {
          id: 'grp-mengetahui',
          label: 'Mengetahui,',
          stage: 'MENGETAHUI',
          order: 1,
          slots: [
            {
              id: 'slot-dm',
              name: 'Mujibur Rokhman',
              jabatan: 'Dept. Manager HR',
              allowedUserId: 'usr-mujibur',
              order: 1,
            },
          ],
        },
        {
          id: 'grp-dicheck',
          label: 'Dicheck oleh,',
          stage: 'DICHECK',
          order: 2,
          slots: [
            {
              id: 'slot-sm-1',
              name: 'Arya Rizkyndra H. D',
              jabatan: 'Sect. Manager HR Development',
              allowedUserId: 'usr-arya',
              order: 1,
            },
            {
              id: 'slot-sm-2',
              name: 'Era Setyawati',
              jabatan: 'Sect. Manager HR Adm. & Operation',
              allowedUserId: 'usr-era',
              order: 2,
            },
          ],
        },
        {
          id: 'grp-dilaporkan',
          label: 'Dilaporkan oleh,',
          stage: 'DILAPORKAN',
          order: 3,
          slots: [
            {
              id: 'slot-pic',
              name: 'Mahmud Nurdiansyah',
              jabatan: 'Staff HR Development',
              allowedUserId: 'usr-mahmud',
              order: 1,
            },
          ],
        },
      ],
    },
  ];

  // 4. Transactions (12 months history + exact Sep 2026 & Aug 2026 events)
  const transactions: StockTransaction[] = [];
  let txSeq = 1;
  const pushTx = (
    item: SupplyItem,
    type: 'TERIMA' | 'PAKAI',
    qty: number,
    date: string,
    note: string,
    user = SEED_USERS[1]
  ) => {
    transactions.push({
      id: `tx-${String(txSeq++).padStart(4, '0')}`,
      itemId: item.id,
      jenis: item.jenis,
      codeItem: item.codeItem,
      itemName: item.itemName,
      uom: item.uom,
      type,
      qty,
      date,
      period: date.slice(0, 7),
      recordedByUserId: user.id,
      recordedByName: user.name,
      note,
      createdAt: `${date}T09:15:00.000Z`,
    });
  };

  // Exact September 2026 transactions matching PDF Page 1 & Page 2
  const sepEvents: Array<[string, 'TERIMA' | 'PAKAI', number, string, string]> = [
    ['item-os-004', 'PAKAI', 3, '2026-09-04', 'Pengemasan dokumen arsip HR'],
    ['item-os-008', 'TERIMA', 2, '2026-09-07', 'Kedatangan barang dari GA Dept'],
    ['item-os-009', 'PAKAI', 1, '2026-09-09', 'Kebutuhan area training center'],
    ['item-os-014', 'PAKAI', 1, '2026-09-11', 'Pengambilan rutin administrasi HR'],
    ['item-os-015', 'PAKAI', 1, '2026-09-12', 'Kebutuhan alat tulis staf'],
    ['item-os-017', 'PAKAI', 2, '2026-09-14', 'Baterai mic & remote ruang meeting'],
    ['item-os-025', 'PAKAI', 1, '2026-09-16', 'Kebutuhan meja admin HR'],
    ['item-os-032', 'PAKAI', 2, '2026-09-18', 'Packing berkas karyawan baru'],
    ['item-os-046', 'PAKAI', 1, '2026-09-21', 'Penandaan berkas kontrak kerja'],
    ['item-os-047', 'PAKAI', 4, '2026-09-23', 'Workshop HR Development batch III'],
    ['item-os-049', 'PAKAI', 3, '2026-09-25', 'Pengisian kotak tisu ruang HR & klinik'],
    ['item-oh-023', 'TERIMA', 5, '2026-09-19', 'Kedatangan akrilik signage ruangan'],
  ];

  for (const [id, type, qty, date, note] of sepEvents) {
    const found = items.find((i) => i.id === id);
    if (found) pushTx(found, type, qty, date, note);
  }

  // August 2026 transactions (so Aug report is authentic and Oct 2025 - Jul 2026 give 12-month area chart richness)
  const augEvents: Array<[string, 'TERIMA' | 'PAKAI', number, string, string]> = [
    ['item-os-050', 'TERIMA', 12, '2026-08-05', 'Restock spidol board marker biru'],
    ['item-os-051', 'TERIMA', 12, '2026-08-05', 'Restock spidol board marker hijau'],
    ['item-os-052', 'PAKAI', 4, '2026-08-10', 'Kebutuhan training K3 Mojokerto'],
    ['item-os-036', 'TERIMA', 5, '2026-08-12', 'Kedatangan kertas F4 70g'],
    ['item-os-036', 'PAKAI', 4, '2026-08-19', 'Cetak formulir rekrutmen operator'],
    ['item-os-049', 'TERIMA', 4, '2026-08-08', 'Restock tissue Paseo'],
    ['item-os-049', 'PAKAI', 3, '2026-08-22', 'Pemakaian ruang HR & ruang interview'],
    ['item-os-017', 'TERIMA', 3, '2026-08-14', 'Restock baterai Energyzer A2'],
    ['item-os-017', 'PAKAI', 2, '2026-08-24', 'Operasional training & absensi'],
    ['item-os-047', 'PAKAI', 3, '2026-08-26', 'Kegiatan QCC & Kaizen HR'],
    ['item-oh-006', 'PAKAI', 5, '2026-08-18', 'Orientasi karyawan baru gelombang II'],
    ['item-oh-007', 'PAKAI', 5, '2026-08-18', 'Orientasi karyawan baru gelombang II'],
    ['item-oh-010', 'TERIMA', 6, '2026-08-11', 'Pengadaan Box Training Kit AJIU'],
  ];

  for (const [id, type, qty, date, note] of augEvents) {
    const found = items.find((i) => i.id === id);
    if (found) pushTx(found, type, qty, date, note);
  }

  // Historical monthly series (2025-11 through 2026-07) for 12-month analytics
  const historicalMonths: Array<{ period: string; itemIds: string[]; terima: number[]; pakai: number[] }> = [
    { period: '2025-11', itemIds: ['item-os-036', 'item-os-049', 'item-os-052', 'item-os-017'], terima: [8, 5, 6, 4], pakai: [6, 4, 5, 3] },
    { period: '2025-12', itemIds: ['item-os-036', 'item-os-047', 'item-os-014', 'item-oh-006'], terima: [6, 6, 4, 10], pakai: [5, 5, 3, 6] },
    { period: '2026-01', itemIds: ['item-os-036', 'item-os-050', 'item-os-026', 'item-os-049'], terima: [10, 12, 10, 6], pakai: [7, 6, 4, 5] },
    { period: '2026-02', itemIds: ['item-os-017', 'item-os-047', 'item-os-008', 'item-os-032'], terima: [4, 5, 4, 4], pakai: [3, 4, 3, 3] },
    { period: '2026-03', itemIds: ['item-os-036', 'item-os-052', 'item-os-049', 'item-oh-010'], terima: [8, 8, 5, 10], pakai: [6, 6, 4, 4] },
    { period: '2026-04', itemIds: ['item-os-014', 'item-os-017', 'item-os-046', 'item-os-025'], terima: [4, 5, 4, 3], pakai: [3, 4, 2, 2] },
    { period: '2026-05', itemIds: ['item-os-036', 'item-os-049', 'item-os-053', 'item-oh-007'], terima: [9, 6, 6, 12], pakai: [7, 5, 4, 7] },
    { period: '2026-06', itemIds: ['item-os-017', 'item-os-047', 'item-os-004', 'item-os-032'], terima: [6, 8, 5, 4], pakai: [4, 5, 3, 3] },
    { period: '2026-07', itemIds: ['item-os-036', 'item-os-049', 'item-os-052', 'item-os-014'], terima: [7, 5, 8, 4], pakai: [6, 4, 5, 3] },
  ];

  for (const hm of historicalMonths) {
    hm.itemIds.forEach((id, idx) => {
      const found = items.find((i) => i.id === id);
      if (!found) return;
      pushTx(found, 'TERIMA', hm.terima[idx], `${hm.period}-08`, 'Penerimaan bulanan rutin');
      pushTx(found, 'PAKAI', hm.pakai[idx], `${hm.period}-20`, 'Pemakaian operasional HR');
    });
  }

  // 5. Inventories (Overhead)
  const inventories: OverheadInventoryItem[] = RAW_INVENTORIES.map((inv, idx) => ({
    id: `inv-${String(idx + 1).padStart(3, '0')}`,
    partId: inv.partId,
    prefix: inv.prefix,
    kategori: 'Overhead',
    itemName: inv.itemName,
    qty: inv.qty,
    uom: 'PC',
    location: inv.location,
    condition: 'BAGUS',
    notes: inv.qty === 0 ? 'Stok kosong / sudah terdistribusi' : '',
    mutations: [
      {
        id: `mut-${idx + 1}-1`,
        date: '2026-09-30',
        type: 'IN',
        qty: inv.qty,
        note: 'Hasil stock opname akhir bulan September 2026',
        byName: 'Mahmud Nurdiansyah',
      },
    ],
    createdAt: '2026-01-10T08:00:00.000Z',
    updatedAt: nowIso,
  }));

  // Helper to build signature groups with signed state
  const makeSignatureGroups = (
    template: SignatureTemplate,
    signedMap: Record<string, { at: string; user: User }>
  ): SignatureGroup[] =>
    template.groups.map((g) => ({
      id: g.id,
      label: g.label,
      stage: g.stage,
      order: g.order,
      slots: g.slots.map((s) => {
        const match = signedMap[s.allowedUserId];
        return {
          id: s.id,
          name: s.name,
          jabatan: s.jabatan,
          allowedUserId: s.allowedUserId,
          order: s.order,
          status: match ? 'SIGNED' : 'PENDING',
          signedByUserId: match?.user.id,
          signedByName: match?.user.name,
          signedAt: match?.at,
          signatureImageUrl: match?.user.savedSignatureDataUrl,
        };
      }),
    }));

  const userMahmud = SEED_USERS[1];
  const userArya = SEED_USERS[2];
  const userEra = SEED_USERS[3];
  const userMujibur = SEED_USERS[4];

  const allSignedAug = {
    'usr-mahmud': { at: '2026-09-04T08:40:00.000Z', user: userMahmud },
    'usr-arya': { at: '2026-09-05T09:15:00.000Z', user: userArya },
    'usr-era': { at: '2026-09-06T13:20:00.000Z', user: userEra },
    'usr-mujibur': { at: '2026-09-07T10:05:00.000Z', user: userMujibur },
  };

  const allSignedSepOS = {
    'usr-mahmud': { at: '2026-10-08T08:25:00.000Z', user: userMahmud },
    'usr-arya': { at: '2026-10-08T10:12:00.000Z', user: userArya },
    'usr-era': { at: '2026-10-09T09:45:00.000Z', user: userEra },
    'usr-mujibur': { at: '2026-10-10T11:30:00.000Z', user: userMujibur },
  };

  // Build rows for Sep 2026 & Aug 2026 (where Aug stockAkhir === Sep stokAwal!)
  const sepOfficeRows: ReportCheckRow[] = RAW_OFFICE_SUPPLIES.map((r, idx) => {
    const [kategori, codeItem, itemName, uom, sepAwal, sepTerima, sepPakai, minStock, location] = r;
    return {
      itemId: officeItems[idx].id,
      kategori,
      codeItem,
      itemName,
      uom,
      stokAwal: sepAwal,
      terima: sepTerima,
      pakai: sepPakai,
      stockAkhir: sepAwal + sepTerima - sepPakai,
      minStock,
      location,
      notes: '',
    };
  });

  const augOfficeRows: ReportCheckRow[] = sepOfficeRows.map((row) => {
    // Ensure augStockAkhir === sepStokAwal
    const augTerima = row.itemId === 'item-os-050' ? 12 : row.itemId === 'item-os-051' ? 12 : row.itemId === 'item-os-036' ? 5 : row.itemId === 'item-os-049' ? 4 : 0;
    const augPakai = row.itemId === 'item-os-052' ? 4 : row.itemId === 'item-os-036' ? 4 : row.itemId === 'item-os-049' ? 3 : row.itemId === 'item-os-047' ? 3 : 0;
    const augAwal = Math.max(0, row.stokAwal - augTerima + augPakai);
    return {
      ...row,
      stokAwal: augAwal,
      terima: augTerima,
      pakai: augPakai,
      stockAkhir: row.stokAwal, // equals Sep stokAwal!
    };
  });

  const sepOverheadRows: ReportCheckRow[] = RAW_OVERHEAD_GOODS.map((r, idx) => {
    const [kategori, codeItem, itemName, uom, sepAwal, sepTerima, sepPakai, minStock, location] = r;
    return {
      itemId: overheadItems[idx].id,
      kategori,
      codeItem,
      itemName,
      uom,
      stokAwal: sepAwal,
      terima: sepTerima,
      pakai: sepPakai,
      stockAkhir: sepAwal + sepTerima - sepPakai,
      minStock,
      location,
      notes: '',
    };
  });

  const augOverheadRows: ReportCheckRow[] = sepOverheadRows.map((row) => {
    const augTerima = row.itemId === 'item-oh-010' ? 6 : 0;
    const augPakai = row.itemId === 'item-oh-006' ? 5 : row.itemId === 'item-oh-007' ? 5 : 0;
    const augAwal = Math.max(0, row.stokAwal - augTerima + augPakai);
    return {
      ...row,
      stokAwal: augAwal,
      terima: augTerima,
      pakai: augPakai,
      stockAkhir: row.stokAwal,
    };
  });

  const invRows: ReportInventoryRow[] = inventories.map((inv) => ({
    inventoryId: inv.id,
    kategori: inv.kategori,
    partId: inv.partId,
    itemName: inv.itemName,
    qty: inv.qty,
    uom: inv.uom,
    location: inv.location,
    condition: inv.condition,
    notes: inv.notes,
  }));

  const makeReport = (params: {
    id: string;
    documentId: string;
    jenis: MonthlyReport['jenis'];
    title: string;
    period: string;
    periodLabel: string;
    placeDateText: string;
    status: MonthlyReport['status'];
    checkRows?: ReportCheckRow[];
    inventoryRows?: ReportInventoryRow[];
    signatureGroups: SignatureGroup[];
    templateId: string;
    locked: boolean;
  }): MonthlyReport => {
    const payloadStr = JSON.stringify({
      documentId: params.documentId,
      jenis: params.jenis,
      period: params.period,
      rows: params.checkRows || params.inventoryRows,
    });
    return {
      ...params,
      docHash: computeDocHash(payloadStr),
      department: params.jenis === 'INVENTARIS_OVERHEAD' ? 'Human Resource' : 'Human Resources',
      section: 'HR Development & HR Adm. & Operation',
      version: 1,
      versions: [
        {
          version: 1,
          savedAt: nowIso,
          savedBy: 'Mahmud Nurdiansyah',
          note: 'Pembuatan laporan bulanan awal periode',
        },
      ],
      rejectionHistory: [],
      createdAt: nowIso,
      updatedAt: nowIso,
    };
  };

  // 6 Reports: 3 for Agustus 2026 (all FINAL), 3 for September 2026 (OS = FINAL, Overhead Goods = MENGETAHUI waiting DM, Inventaris = DICHECK waiting Era!)
  const reports: MonthlyReport[] = [
    makeReport({
      id: 'rep-os-2026-08',
      documentId: 'DOC-HR-OS-202608-01',
      jenis: 'OFFICE_SUPPLIES',
      title: 'LIST PENGECHEKAN BARANG OFFICE SUPPLIES',
      period: '2026-08',
      periodLabel: 'Agt-26',
      placeDateText: 'Mojokerto, 07 September 2026',
      status: 'FINAL',
      checkRows: augOfficeRows,
      signatureGroups: makeSignatureGroups(templates[0], allSignedAug),
      templateId: templates[0].id,
      locked: true,
    }),
    makeReport({
      id: 'rep-oh-2026-08',
      documentId: 'DOC-HR-OG-202608-01',
      jenis: 'OVERHEAD_GOODS',
      title: 'LIST PENGECHEKAN BARANG OVERHEAD GOODS',
      period: '2026-08',
      periodLabel: 'Agt-26',
      placeDateText: 'Mojokerto, 07 September 2026',
      status: 'FINAL',
      checkRows: augOverheadRows,
      signatureGroups: makeSignatureGroups(templates[1], allSignedAug),
      templateId: templates[1].id,
      locked: true,
    }),
    makeReport({
      id: 'rep-inv-2026-08',
      documentId: 'DOC-HR-INV-202608-01',
      jenis: 'INVENTARIS_OVERHEAD',
      title: 'LIST INVENTARIS OVERHEAD',
      period: '2026-08',
      periodLabel: 'Agustus 2026',
      placeDateText: 'Mojokerto, 07 September 2026',
      status: 'FINAL',
      inventoryRows: invRows,
      signatureGroups: makeSignatureGroups(templates[2], allSignedAug),
      templateId: templates[2].id,
      locked: true,
    }),
    makeReport({
      id: 'rep-os-2026-09',
      documentId: 'DOC-HR-OS-202609-01',
      jenis: 'OFFICE_SUPPLIES',
      title: 'LIST PENGECHEKAN BARANG OFFICE SUPPLIES',
      period: '2026-09',
      periodLabel: 'Sep-26',
      placeDateText: 'Mojokerto, 08 Oktober 2026',
      status: 'FINAL',
      checkRows: sepOfficeRows,
      signatureGroups: makeSignatureGroups(templates[0], allSignedSepOS),
      templateId: templates[0].id,
      locked: true,
    }),
    makeReport({
      id: 'rep-oh-2026-09',
      documentId: 'DOC-HR-OG-202609-01',
      jenis: 'OVERHEAD_GOODS',
      title: 'LIST PENGECHEKAN BARANG OVERHEAD GOODS',
      period: '2026-09',
      periodLabel: 'Sep-26',
      placeDateText: 'Mojokerto, 14 Oktober 2026',
      status: 'MENGETAHUI',
      checkRows: sepOverheadRows,
      signatureGroups: makeSignatureGroups(templates[1], {
        'usr-mahmud': { at: '2026-10-14T08:10:00.000Z', user: userMahmud },
        'usr-arya': { at: '2026-10-14T09:40:00.000Z', user: userArya },
        'usr-era': { at: '2026-10-14T11:15:00.000Z', user: userEra },
      }),
      templateId: templates[1].id,
      locked: false,
    }),
    makeReport({
      id: 'rep-inv-2026-09',
      documentId: 'DOC-HR-INV-202609-01',
      jenis: 'INVENTARIS_OVERHEAD',
      title: 'LIST INVENTARIS OVERHEAD',
      period: '2026-09',
      periodLabel: 'September 2026',
      placeDateText: 'Mojokerto, 14 Oktober 2026',
      status: 'DICHECK',
      inventoryRows: invRows,
      signatureGroups: makeSignatureGroups(templates[2], {
        'usr-mahmud': { at: '2026-10-14T08:15:00.000Z', user: userMahmud },
        'usr-arya': { at: '2026-10-14T09:50:00.000Z', user: userArya },
      }),
      templateId: templates[2].id,
      locked: false,
    }),
  ];

  // 7. Stock Opname Session (September 2026 approved)
  const opnames: OpnameSession[] = [
    {
      id: 'opn-2026-09-os',
      period: '2026-09',
      jenis: 'OFFICE_SUPPLIES',
      createdAt: '2026-09-30T14:00:00.000Z',
      createdByUserId: userMahmud.id,
      createdByName: userMahmud.name,
      status: 'DISETUJUI',
      approvedByUserId: userArya.id,
      approvedByName: userArya.name,
      approvedAt: '2026-10-01T09:00:00.000Z',
      lines: sepOfficeRows.slice(0, 15).map((r) => ({
        itemId: r.itemId,
        kategori: r.kategori,
        codeItem: r.codeItem,
        itemName: r.itemName,
        uom: r.uom,
        stokAwal: r.stokAwal,
        terima: r.terima,
        pakai: r.pakai,
        systemStock: r.stockAkhir,
        physicalStock: r.stockAkhir,
        diff: 0,
        reason: '',
        balanced: true,
      })),
    },
  ];

  // 8. Item Requests & Purchase Requests
  const itemRequests: ItemRequest[] = [
    {
      id: 'req-001',
      requesterName: 'Siti Aminah',
      requesterSection: 'Production Dept.',
      requestDate: '2026-10-12',
      status: 'MENUNGGU',
      items: [
        { itemId: 'item-os-036', itemName: 'Kertas F4 70g Putih', uom: 'PAC', qty: 2 },
        { itemId: 'item-os-052', itemName: 'Spidol Board Marker Hitam', uom: 'PC', qty: 2 },
      ],
      note: 'Untuk keperluan briefing safety line produksi bulan Oktober',
    },
    {
      id: 'req-002',
      requesterName: 'Budi Santoso',
      requesterSection: 'QA & Laboratory',
      requestDate: '2026-10-09',
      status: 'DISETUJUI',
      items: [{ itemId: 'item-os-049', itemName: 'Tissue Kotak Paseo Facial 280', uom: 'PAC', qty: 1 }],
      note: 'Pengisian ruang admin QA',
      processedByName: 'Mahmud Nurdiansyah',
      processedAt: '2026-10-09T13:20:00.000Z',
    },
  ];

  const rollingForecast = buildRollingForecastSeed();

  // 9. Notifications
  const notifications: AppNotification[] = [
    {
      id: 'notif-1',
      title: 'Menunggu Tanda Tangan Mengetahui',
      message: 'Laporan Overhead Goods Sep-26 siap ditandatangani oleh Mujibur Rokhman.',
      type: 'TANDA_TANGAN',
      targetUserId: 'usr-mujibur',
      linkTo: '/app/signatures',
      read: false,
      createdAt: '2026-10-14T11:20:00.000Z',
    },
    {
      id: 'notif-2',
      title: 'Menunggu Tanda Tangan Dicheck',
      message: 'List Inventaris Overhead September 2026 menunggu pengecekan Era Setyawati.',
      type: 'TANDA_TANGAN',
      targetUserId: 'usr-era',
      linkTo: '/app/signatures',
      read: false,
      createdAt: '2026-10-14T10:00:00.000Z',
    },
    {
      id: 'notif-3',
      title: 'Peringatan Stok Kritis & Update Forecast',
      message: `${items.filter((i) => i.currentStock <= i.minStock).length} item berada pada atau di bawah batas Minimum Stok. Segera perbarui Rolling Forecast GA.`,
      type: 'STOK_KRITIS',
      targetRoles: ['SUPER_ADMIN', 'STAFF', 'SECTION_MANAGER'],
      linkTo: '/app/forecast',
      read: false,
      createdAt: '2026-10-14T08:00:00.000Z',
    },
    {
      id: 'notif-4',
      title: 'Permintaan Barang Baru',
      message: 'Production Dept. mengajukan permintaan 2 item Office Supplies.',
      type: 'LAPORAN',
      targetRoles: ['SUPER_ADMIN', 'STAFF', 'SECTION_MANAGER'],
      linkTo: '/app/requests',
      read: false,
      createdAt: '2026-10-12T10:30:00.000Z',
    },
  ];

  // 10. Audit Logs
  const auditLogs: AuditLogEntry[] = [
    {
      id: 'aud-001',
      timestamp: '2026-10-10T11:30:00.000Z',
      userId: userMujibur.id,
      userName: userMujibur.name,
      userRole: userMujibur.role,
      action: 'SIGN',
      objectType: 'Laporan Bulanan',
      objectLabel: 'DOC-HR-OS-202609-01 (Office Supplies Sep-26)',
      oldValue: 'MENGETAHUI',
      newValue: 'FINAL',
    },
    {
      id: 'aud-002',
      timestamp: '2026-10-14T11:15:00.000Z',
      userId: userEra.id,
      userName: userEra.name,
      userRole: userEra.role,
      action: 'SIGN',
      objectType: 'Laporan Bulanan',
      objectLabel: 'DOC-HR-OG-202609-01 (Overhead Goods Sep-26)',
      oldValue: 'DICHECK',
      newValue: 'MENGETAHUI',
    },
    {
      id: 'aud-003',
      timestamp: '2026-11-20T09:15:00.000Z',
      userId: userMahmud.id,
      userName: userMahmud.name,
      userRole: userMahmud.role,
      action: 'UPDATE',
      objectType: 'Rolling Forecast GA',
      objectLabel: 'RF FY2026 — Periode Dec-26',
      newValue: '5 item (11 unit) dikirim ke GA Dept',
    },
  ];

  return {
    users: SEED_USERS,
    items,
    transactions,
    opnames,
    templates,
    reports,
    inventories,
    itemRequests,
    rollingForecast,
    documents: [],
    notifications,
    auditLogs,
    masterData,
    settings: SEED_SETTINGS,
  };
}

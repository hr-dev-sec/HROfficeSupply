import {
  isSupabaseConfigured,
  supabase,
  SUPABASE_DOCUMENTS_BUCKET,
  SUPABASE_STORAGE_BUCKET,
} from '../lib/supabaseClient';
import type { DocumentCategory } from '../types';

export type MediaFolder = 'items' | 'inventories' | 'signatures' | 'company';

export const ALLOWED_DOCUMENT_ACCEPT =
  '.pdf,.xlsx,.xls,.csv,.docx,.doc,.jpg,.jpeg,.png,.webp';

export const MAX_LOCAL_DOC_BYTES = 3.5 * 1024 * 1024; // 3.5 MB aman untuk localStorage browser
export const MAX_CLOUD_DOC_BYTES = 15 * 1024 * 1024; // 15 MB untuk Supabase Storage

/**
 * Mengompresi file gambar ke ukuran maksimal 800px (JPEG 0.82)
 * agar ringan disimpan baik di localStorage maupun Supabase Storage.
 */
export async function compressImageFileToDataUrl(file: File, maxDim = 800, quality = 0.82): Promise<string> {
  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Gagal membaca file gambar.'));
    reader.readAsDataURL(file);
  });

  // Pertahankan SVG atau PNG transparan kecil apa adanya untuk tanda tangan
  if (file.type === 'image/svg+xml') {
    return rawDataUrl;
  }

  return new Promise<string>((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      try {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width >= height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const isPng = file.type === 'image/png';
          if (!isPng) {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, width, height);
          }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(
            isPng
              ? canvas.toDataURL('image/png')
              : canvas.toDataURL('image/jpeg', quality)
          );
          return;
        }
      } catch {
        // Fallback ke dataUrl mentah
      }
      resolve(rawDataUrl);
    };
    img.onerror = () => resolve(rawDataUrl);
    img.src = rawDataUrl;
  });
}

function dataUrlToBlob(dataUrl: string): { blob: Blob; ext: string; mime: string } {
  const [header, payload] = dataUrl.split(',');
  const mimeMatch = header.match(/data:([^;]+)/);
  const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
  const ext =
    mime === 'image/png'
      ? 'png'
      : mime === 'image/webp'
      ? 'webp'
      : mime === 'image/svg+xml'
      ? 'svg'
      : mime === 'image/jpeg'
      ? 'jpg'
      : mime === 'application/pdf'
      ? 'pdf'
      : mime.includes('spreadsheet')
      ? 'xlsx'
      : mime.includes('ms-excel')
      ? 'xls'
      : mime.includes('wordprocessingml')
      ? 'docx'
      : mime === 'text/csv'
      ? 'csv'
      : 'bin';

  if (header.includes(';base64')) {
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return { blob: new Blob([bytes], { type: mime }), ext, mime };
  }
  const decoded = decodeURIComponent(payload);
  return { blob: new Blob([decoded], { type: mime }), ext, mime };
}

/**
 * Mengunggah DataURL (hasil kompresi foto item, aset inventaris, atau tanda tangan)
 * ke Supabase Storage jika koneksi Supabase aktif.
 * Jika Supabase belum dihubungkan, langsung mengembalikan DataURL lokal.
 */
export async function uploadDataUrlToStorage(
  dataUrl: string,
  folder: MediaFolder,
  entityId: string
): Promise<string> {
  if (!dataUrl || !dataUrl.startsWith('data:')) {
    return dataUrl;
  }
  if (!isSupabaseConfigured || !supabase) {
    return dataUrl;
  }

  try {
    const { blob, ext, mime } = dataUrlToBlob(dataUrl);
    const safeId = entityId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const objectPath = `${folder}/${safeId}-${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from(SUPABASE_STORAGE_BUCKET)
      .upload(objectPath, blob, {
        contentType: mime,
        upsert: true,
        cacheControl: '31536000',
      });

    if (error) {
      console.warn('Upload ke Supabase Storage gagal, fallback ke DataURL lokal:', error.message);
      return dataUrl;
    }

    const { data } = supabase.storage.from(SUPABASE_STORAGE_BUCKET).getPublicUrl(objectPath);
    return data.publicUrl || dataUrl;
  } catch (err) {
    console.warn('Gagal mengunggah media ke Supabase Storage:', err);
    return dataUrl;
  }
}

/**
 * Helper utama untuk form upload foto (Master Item, Inventaris Overhead, Tanda Tangan):
 * 1. Kompresi gambar di browser
 * 2. Upload otomatis ke Supabase Storage jika terkoneksi (atau kembalikan DataURL jika lokal)
 */
export async function processAndUploadImage(
  file: File,
  folder: MediaFolder,
  entityId: string
): Promise<{ url: string; uploadedToCloud: boolean }> {
  const compressed = await compressImageFileToDataUrl(file);
  if (isSupabaseConfigured && supabase) {
    const cloudUrl = await uploadDataUrlToStorage(compressed, folder, entityId);
    return {
      url: cloudUrl,
      uploadedToCloud: cloudUrl.startsWith('http'),
    };
  }
  return {
    url: compressed,
    uploadedToCloud: false,
  };
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_');
}

function inferMimeType(file: File): string {
  if (file.type) return file.type;
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.pdf')) return 'application/pdf';
  if (lower.endsWith('.xlsx')) return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  if (lower.endsWith('.xls')) return 'application/vnd.ms-excel';
  if (lower.endsWith('.csv')) return 'text/csv';
  if (lower.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (lower.endsWith('.doc')) return 'application/msword';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.webp')) return 'image/webp';
  return 'application/octet-stream';
}

/**
 * Mengunggah dokumen resmi (PDF, Excel, Word, CSV, Scan Gambar) ke bucket Supabase
 * `supplyhub-documents` saat terkoneksi, atau menyimpannya sebagai DataURL lokal saat mode offline.
 */
export async function uploadDocumentFile(
  file: File,
  category: DocumentCategory,
  docId: string
): Promise<{
  fileUrl: string;
  storagePath?: string;
  fileType: string;
  fileSize: number;
  uploadedToCloud: boolean;
}> {
  const fileType = inferMimeType(file);
  const safeName = sanitizeFileName(file.name);
  const objectPath = `${category}/${docId}-${Date.now()}-${safeName}`;

  if (isSupabaseConfigured && supabase) {
    if (file.size > MAX_CLOUD_DOC_BYTES) {
      throw new Error('Ukuran dokumen melebihi batas maksimal 15 MB.');
    }
    const { error } = await supabase.storage
      .from(SUPABASE_DOCUMENTS_BUCKET)
      .upload(objectPath, file, {
        contentType: fileType,
        upsert: true,
        cacheControl: '31536000',
      });

    if (!error) {
      const { data } = supabase.storage.from(SUPABASE_DOCUMENTS_BUCKET).getPublicUrl(objectPath);
      if (data.publicUrl) {
        return {
          fileUrl: data.publicUrl,
          storagePath: objectPath,
          fileType,
          fileSize: file.size,
          uploadedToCloud: true,
        };
      }
    } else {
      console.warn('Upload dokumen ke Supabase Storage gagal, fallback ke penyimpanan lokal:', error.message);
    }
  }

  // Mode lokal: kompres jika gambar, atau simpan DataURL jika <= 3.5 MB
  if (fileType.startsWith('image/')) {
    const compressed = await compressImageFileToDataUrl(file, 1400, 0.85);
    return {
      fileUrl: compressed,
      fileType: fileType === 'image/png' ? 'image/png' : 'image/jpeg',
      fileSize: file.size,
      uploadedToCloud: false,
    };
  }

  if (file.size > MAX_LOCAL_DOC_BYTES) {
    throw new Error(
      'Ukuran berkas terlalu besar untuk penyimpanan lokal browser (maks. 3,5 MB). Hubungkan Supabase untuk kapasitas hingga 15 MB/berkas.'
    );
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Gagal membaca berkas dokumen.'));
    reader.readAsDataURL(file);
  });

  return {
    fileUrl: dataUrl,
    fileType,
    fileSize: file.size,
    uploadedToCloud: false,
  };
}

/**
 * Memigrasikan dokumen berbentuk DataURL lokal ke Supabase Storage bucket `supplyhub-documents`
 * saat melakukan sinkronisasi penuh ke Supabase.
 */
export async function uploadDocumentDataUrlToStorage(
  dataUrl: string,
  category: DocumentCategory,
  docId: string,
  fileName: string
): Promise<{ fileUrl: string; storagePath?: string }> {
  if (!dataUrl || !dataUrl.startsWith('data:') || !isSupabaseConfigured || !supabase) {
    return { fileUrl: dataUrl };
  }
  try {
    const { blob, mime } = dataUrlToBlob(dataUrl);
    const objectPath = `${category}/${docId}-${Date.now()}-${sanitizeFileName(fileName)}`;
    const { error } = await supabase.storage
      .from(SUPABASE_DOCUMENTS_BUCKET)
      .upload(objectPath, blob, {
        contentType: mime,
        upsert: true,
        cacheControl: '31536000',
      });
    if (error) return { fileUrl: dataUrl };
    const { data } = supabase.storage.from(SUPABASE_DOCUMENTS_BUCKET).getPublicUrl(objectPath);
    return { fileUrl: data.publicUrl || dataUrl, storagePath: objectPath };
  } catch {
    return { fileUrl: dataUrl };
  }
}

export async function deleteDocumentFromStorage(storagePath?: string): Promise<void> {
  if (!storagePath || !isSupabaseConfigured || !supabase) return;
  try {
    await supabase.storage.from(SUPABASE_DOCUMENTS_BUCKET).remove([storagePath]);
  } catch (err) {
    console.warn('Gagal menghapus file dari Supabase Storage:', err);
  }
}


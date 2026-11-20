import React, { useEffect, useRef, useState } from 'react';
import { Check, Eraser, Eye, EyeOff, KeyRound, PenTool, Upload, UserCheck, X } from 'lucide-react';
import type { SignatureSlot, User } from '../../types';

interface SignatureModalProps {
  open: boolean;
  onClose: () => void;
  slot: SignatureSlot | null;
  groupLabel: string;
  currentUser: User;
  verifyPassword: (pwd: string) => boolean;
  onConfirmSign: (signatureDataUrl: string, saveToProfile: boolean) => void;
}

type SignMode = 'DRAW' | 'UPLOAD' | 'SAVED';

export const SignatureModal: React.FC<SignatureModalProps> = ({
  open,
  onClose,
  slot,
  groupLabel,
  currentUser,
  verifyPassword,
  onConfirmSign,
}) => {
  const [mode, setMode] = useState<SignMode>('DRAW');
  const [inkColor, setInkColor] = useState('#111827');
  const [strokeWidth, setStrokeWidth] = useState(2.5);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [uploadedDataUrl, setUploadedDataUrl] = useState<string | null>(null);
  const [removeBg, setRemoveBg] = useState(true);
  const [saveToProfile, setSaveToProfile] = useState(true);
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);

  useEffect(() => {
    if (open) {
      setPassword('');
      setError('');
      setHasDrawn(false);
      setUploadedDataUrl(null);
      setMode(currentUser.savedSignatureDataUrl ? 'DRAW' : 'DRAW');
      setTimeout(() => {
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          ctx?.clearRect(0, 0, canvas.width, canvas.height);
        }
      }, 40);
    }
  }, [open, currentUser.savedSignatureDataUrl]);

  if (!open || !slot) return null;

  const getPointerPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pos = getPointerPos(e);
    ctx.strokeStyle = inkColor;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    isDrawingRef.current = true;
    setHasDrawn(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const pos = getPointerPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const handlePointerUp = () => {
    isDrawingRef.current = false;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setHasDrawn(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const offscreen = document.createElement('canvas');
        const w = Math.min(480, img.width);
        const h = Math.round((img.height / img.width) * w);
        offscreen.width = w;
        offscreen.height = h;
        const ctx = offscreen.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, w, h);

        if (removeBg) {
          const imgData = ctx.getImageData(0, 0, w, h);
          const data = imgData.data;
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            // Turn near-white pixels transparent
            if (r > 215 && g > 215 && b > 215) {
              data[i + 3] = 0;
            }
          }
          ctx.putImageData(imgData, 0, 0);
        }
        setUploadedDataUrl(offscreen.toDataURL('image/png'));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!verifyPassword(password)) {
      setError('Kata sandi konfirmasi tidak sesuai. Gunakan kata sandi akun Anda (demo: demo123).');
      return;
    }

    let finalSignature = '';
    if (mode === 'DRAW') {
      if (!hasDrawn || !canvasRef.current) {
        setError('Silakan gambar tanda tangan Anda di kanvas terlebih dahulu.');
        return;
      }
      finalSignature = canvasRef.current.toDataURL('image/png');
    } else if (mode === 'UPLOAD') {
      if (!uploadedDataUrl) {
        setError('Silakan unggah gambar tanda tangan terlebih dahulu.');
        return;
      }
      finalSignature = uploadedDataUrl;
    } else {
      if (!currentUser.savedSignatureDataUrl) {
        setError('Profil Anda belum memiliki tanda tangan tersimpan.');
        return;
      }
      finalSignature = currentUser.savedSignatureDataUrl;
    }

    onConfirmSign(finalSignature, saveToProfile && mode !== 'SAVED');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/55 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#171A1F] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
          <div>
            <h3 className="text-lg font-bold text-[#1F2328] dark:text-neutral-100">
              Bubuhkan Tanda Tangan Digital
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              {groupLabel.replace(',', '')} · {slot.name} ({slot.jabatan})
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            aria-label="Tutup modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Segmented Mode Picker */}
          <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-neutral-100 dark:bg-neutral-800/80">
            <button
              type="button"
              onClick={() => setMode('DRAW')}
              className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                mode === 'DRAW'
                  ? 'bg-white dark:bg-[#1F2328] text-[#1F2328] dark:text-white shadow-sm'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
              }`}
            >
              <PenTool className="w-3.5 h-3.5" />
              Gambar Kanvas
            </button>
            <button
              type="button"
              onClick={() => setMode('UPLOAD')}
              className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                mode === 'UPLOAD'
                  ? 'bg-white dark:bg-[#1F2328] text-[#1F2328] dark:text-white shadow-sm'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              Unggah Gambar
            </button>
            <button
              type="button"
              onClick={() => setMode('SAVED')}
              className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                mode === 'SAVED'
                  ? 'bg-white dark:bg-[#1F2328] text-[#1F2328] dark:text-white shadow-sm'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              TTD Tersimpan
            </button>
          </div>

          {/* Mode Body */}
          {mode === 'DRAW' && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                    Warna Tinta:
                  </span>
                  {[
                    { color: '#111827', label: 'Hitam' },
                    { color: '#1E3A8A', label: 'Biru Tua' },
                    { color: '#991B1B', label: 'Merah Tua' },
                  ].map((c) => (
                    <button
                      key={c.color}
                      type="button"
                      onClick={() => setInkColor(c.color)}
                      title={c.label}
                      className={`w-6 h-6 rounded-full border-2 transition-transform ${
                        inkColor === c.color
                          ? 'border-[#E60012] scale-110'
                          : 'border-neutral-300 dark:border-neutral-600'
                      }`}
                      style={{ backgroundColor: c.color }}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                    Ketebalan:
                  </span>
                  {[1.5, 2.5, 4].map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setStrokeWidth(w)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${
                        strokeWidth === w
                          ? 'border-[#E60012] bg-[#E60012]/10 text-[#E60012]'
                          : 'border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400'
                      }`}
                    >
                      {w === 1.5 ? 'Tipis' : w === 2.5 ? 'Sedang' : 'Tebal'}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={clearCanvas}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    <Eraser className="w-3.5 h-3.5" />
                    Bersihkan
                  </button>
                </div>
              </div>
              <div className="rounded-xl border-2 border-dashed border-neutral-300 dark:border-neutral-700 bg-white overflow-hidden">
                <canvas
                  ref={canvasRef}
                  width={520}
                  height={180}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  onPointerLeave={handlePointerUp}
                  className="w-full h-44 touch-none cursor-crosshair block"
                />
              </div>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                Gunakan mouse atau jari pada layar sentuh untuk menggambar tanda tangan di area putih di atas.
              </p>
            </div>
          )}

          {mode === 'UPLOAD' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="inline-flex items-center gap-2 text-xs text-neutral-700 dark:text-neutral-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={removeBg}
                    onChange={(e) => setRemoveBg(e.target.checked)}
                    className="rounded border-neutral-300 text-[#E60012] focus:ring-[#E60012]"
                  />
                  Hapus latar putih otomatis (transparan)
                </label>
              </div>
              <label className="flex flex-col items-center justify-center h-40 rounded-xl border-2 border-dashed border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/40 cursor-pointer hover:border-[#E60012] transition-colors p-4">
                {uploadedDataUrl ? (
                  <img
                    src={uploadedDataUrl}
                    alt="Pratinjau tanda tangan unggahan"
                    className="max-h-28 object-contain"
                  />
                ) : (
                  <>
                    <Upload className="w-7 h-7 text-neutral-400 mb-2" />
                    <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                      Pilih berkas PNG / JPG tanda tangan
                    </span>
                    <span className="text-[11px] text-neutral-500 mt-1">
                      Klik di sini untuk memilih gambar
                    </span>
                  </>
                )}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          )}

          {mode === 'SAVED' && (
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white p-5 flex flex-col items-center justify-center min-h-[150px]">
              {currentUser.savedSignatureDataUrl ? (
                <>
                  <img
                    src={currentUser.savedSignatureDataUrl}
                    alt="Tanda tangan tersimpan"
                    className="max-h-24 object-contain"
                  />
                  <span className="text-xs text-neutral-500 mt-3">
                    Tanda tangan tersimpan milik {currentUser.name}
                  </span>
                </>
              ) : (
                <p className="text-xs text-neutral-500">
                  Belum ada tanda tangan tersimpan di profil Anda. Silakan gambar atau unggah terlebih dahulu.
                </p>
              )}
            </div>
          )}

          {mode !== 'SAVED' && (
            <label className="flex items-center gap-2 text-xs text-neutral-700 dark:text-neutral-300 cursor-pointer">
              <input
                type="checkbox"
                checked={saveToProfile}
                onChange={(e) => setSaveToProfile(e.target.checked)}
                className="rounded border-neutral-300 text-[#E60012] focus:ring-[#E60012]"
              />
              Simpan tanda tangan ini ke profil saya untuk penggunaan berikutnya
            </label>
          )}

          {/* Password Verification */}
          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
              Konfirmasi Kata Sandi Akun ({currentUser.username})
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan kata sandi (demo: demo123)"
                className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-[#0F1114] text-sm focus:outline-none focus:ring-2 focus:ring-[#E60012]/30 focus:border-[#E60012]"
                required
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                aria-label="Tampilkan atau sembunyikan kata sandi"
              >
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-neutral-200 dark:border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-neutral-300 dark:border-neutral-700 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800"
            >
              Batal
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#E60012] hover:bg-[#C4000F] text-white text-sm font-semibold transition-colors shadow-sm"
            >
              <Check className="w-4 h-4" />
              Sahkan &amp; Tanda Tangani
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

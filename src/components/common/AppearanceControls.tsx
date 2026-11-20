import React, { useEffect, useRef, useState } from 'react';
import { Check, Globe, Moon, Palette, Sun } from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { COLOR_THEMES, useTheme } from '../../context/ThemeContext';

interface AppearanceControlsProps {
  compact?: boolean;
  onDarkSurface?: boolean;
}

export const AppearanceControls: React.FC<AppearanceControlsProps> = ({
  compact = false,
  onDarkSurface = false,
}) => {
  const { theme, toggleTheme, colorTheme, setColorTheme, activePreset } = useTheme();
  const { language, setLanguage, tr } = useLanguage();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setPaletteOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPaletteOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, []);

  const surfaceBtnClass = onDarkSurface
    ? 'border-white/20 bg-white/10 text-white hover:bg-white/20'
    : 'border-neutral-200/90 dark:border-neutral-700 bg-white/85 dark:bg-[#171A1F] text-neutral-700 dark:text-neutral-200 hover:border-neutral-300 dark:hover:border-neutral-600';

  return (
    <div ref={wrapRef} className="inline-flex items-center gap-1.5 sm:gap-2 shrink-0">
      {/* Language Switcher: ID | EN */}
      <div
        role="group"
        aria-label={tr('Pilih bahasa', 'Select language')}
        className={`inline-flex items-center p-0.5 rounded-xl border text-[11px] font-bold shrink-0 ${
          onDarkSurface
            ? 'border-white/20 bg-white/10 text-white'
            : 'border-neutral-200/90 dark:border-neutral-700 bg-neutral-100/80 dark:bg-[#111419]'
        }`}
      >
        <button
          type="button"
          onClick={() => setLanguage('id')}
          className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
            language === 'id'
              ? onDarkSurface
                ? 'bg-white text-neutral-900 shadow-sm'
                : 'bg-white dark:bg-[#1E222A] text-neutral-900 dark:text-white shadow-sm'
              : onDarkSurface
              ? 'text-white/75 hover:text-white'
              : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
          }`}
        >
          {!compact && <Globe className="w-3 h-3 hidden sm:inline" />}
          ID
        </button>
        <button
          type="button"
          onClick={() => setLanguage('en')}
          className={`px-2 py-1.5 rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
            language === 'en'
              ? onDarkSurface
                ? 'bg-white text-neutral-900 shadow-sm'
                : 'bg-white dark:bg-[#1E222A] text-neutral-900 dark:text-white shadow-sm'
              : onDarkSurface
              ? 'text-white/75 hover:text-white'
              : 'text-neutral-500 hover:text-neutral-900 dark:hover:text-white'
          }`}
        >
          EN
        </button>
      </div>

      {/* Color Theme Palette Popover */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setPaletteOpen((v) => !v)}
          aria-label={tr('Pilih tema warna', 'Choose color theme')}
          title={tr('Tema Warna Sistem', 'System Color Theme')}
          className={`inline-flex items-center gap-1.5 h-9 px-2.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${surfaceBtnClass}`}
        >
          <span
            className="w-3.5 h-3.5 rounded-full ring-1 ring-black/15 dark:ring-white/25 shrink-0"
            style={{ backgroundColor: activePreset.primary }}
          />
          <Palette className="w-3.5 h-3.5 shrink-0" />
        </button>

        {paletteOpen && (
          <div className="absolute right-0 mt-2 w-64 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#161920] text-[#1F2328] dark:text-[#F1F3F5] shadow-2xl p-3 z-[80] space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold">
                {tr('Tema Warna Sistem', 'System Color Theme')}
              </span>
              <span className="text-[10px] font-semibold text-neutral-400">
                5 {tr('Pilihan', 'Themes')}
              </span>
            </div>

            <div className="space-y-1">
              {COLOR_THEMES.map((preset) => {
                const isSelected = colorTheme === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setColorTheme(preset.id);
                      setPaletteOpen(false);
                    }}
                    className={`w-full flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-xl text-left transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-neutral-100 dark:bg-neutral-800/90'
                        : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex items-center -space-x-1 shrink-0">
                        <span
                          className="w-4 h-4 rounded-full ring-2 ring-white dark:ring-[#161920]"
                          style={{ backgroundColor: preset.primary }}
                        />
                        <span
                          className="w-3.5 h-3.5 rounded-full ring-2 ring-white dark:ring-[#161920]"
                          style={{ backgroundColor: preset.accent }}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold truncate">
                          {language === 'en' ? preset.nameEn : preset.nameId}
                        </div>
                        <div className="text-[10px] text-neutral-500 dark:text-neutral-400 truncate">
                          {language === 'en' ? preset.descEn : preset.descId}
                        </div>
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 shrink-0" style={{ color: preset.primary }} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Light / Dark Mode Toggle */}
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={tr('Ubah mode terang atau gelap', 'Toggle light or dark mode')}
        title={theme === 'dark' ? tr('Mode Terang', 'Light Mode') : tr('Mode Gelap', 'Dark Mode')}
        className={`w-9 h-9 rounded-xl border flex items-center justify-center transition-colors cursor-pointer shrink-0 ${surfaceBtnClass}`}
      >
        {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>
    </div>
  );
};

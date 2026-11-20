import React, { useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, useMotionTemplate, useMotionValue, useSpring } from 'framer-motion';
import { ArrowRight, Building2, ClipboardList, ShieldCheck } from 'lucide-react';
import { AppearanceControls } from '../components/common/AppearanceControls';
import { AjiuLogoBadge, AjinomotoLogoTile, HseLogoBadge } from '../components/common/BrandEmblems';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';

export const LandingPage: React.FC = () => {
  const { user } = useAuth();
  const { activePreset } = useTheme();
  const { tr } = useLanguage();
  const navigate = useNavigate();

  // Interactive ambient spotlight across viewport
  const mouseX = useMotionValue(0.5);
  const mouseY = useMotionValue(0.35);
  const smoothX = useSpring(mouseX, { stiffness: 60, damping: 24 });
  const smoothY = useSpring(mouseY, { stiffness: 60, damping: 24 });

  // Subtle 3D tilt for the factory showcase frame
  const frameRef = useRef<HTMLDivElement>(null);
  const tiltX = useSpring(0, { stiffness: 140, damping: 20 });
  const tiltY = useSpring(0, { stiffness: 140, damping: 20 });

  const handlePageMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    mouseX.set(e.clientX / window.innerWidth);
    mouseY.set(e.clientY / window.innerHeight);
  };

  const handleFrameMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    tiltX.set(-py * 5);
    tiltY.set(px * 5);
  };

  const handleFrameMouseLeave = () => {
    tiltX.set(0);
    tiltY.set(0);
  };

  const spotlightBg = useMotionTemplate`radial-gradient(640px circle at calc(${smoothX} * 100%) calc(${smoothY} * 100%), rgba(var(--brand-accent-rgb), 0.11), rgba(var(--brand-primary-rgb), 0.05) 40%, transparent 72%)`;

  return (
    <div
      onMouseMove={handlePageMouseMove}
      className="relative min-h-screen flex flex-col overflow-hidden bg-theme-canvas text-[#1A1D21] dark:text-[#F4F5F7] transition-colors duration-300"
    >
      {/* Multi-layered Silk Architectural Background */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.45] dark:opacity-[0.18]"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(148, 152, 160, 0.14) 1px, transparent 1px), linear-gradient(to bottom, rgba(148, 152, 160, 0.14) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
            maskImage: 'radial-gradient(ellipse 85% 75% at 50% 42%, black 28%, transparent 100%)',
            WebkitMaskImage:
              'radial-gradient(ellipse 85% 75% at 50% 42%, black 28%, transparent 100%)',
          }}
        />

        {/* Interactive Cursor Ambient Spotlight */}
        <motion.div className="absolute inset-0" style={{ background: spotlightBg }} />

        {/* Dynamic Theme Ambient Blooms */}
        <motion.div
          animate={{ x: [0, 26, 0], y: [0, -20, 0], scale: [1, 1.07, 1] }}
          transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -top-40 right-[-8%] w-[620px] h-[620px] rounded-full blur-[130px] opacity-[0.14] dark:opacity-[0.2]"
          style={{ backgroundColor: activePreset.primary }}
        />
        <motion.div
          animate={{ x: [0, -24, 0], y: [0, 20, 0], scale: [1, 1.08, 1] }}
          transition={{ duration: 19, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute -bottom-44 -left-28 w-[580px] h-[580px] rounded-full blur-[130px] opacity-[0.16] dark:opacity-[0.14]"
          style={{ backgroundColor: activePreset.accent }}
        />
      </div>

      {/* Floating Executive Glass Navigation */}
      <header className="sticky top-0 z-40 px-3 sm:px-6 lg:px-10 pt-3">
        <div
          className="w-full max-w-[1640px] mx-auto rounded-2xl border bg-white/85 dark:bg-[#12151B]/86 backdrop-blur-2xl shadow-[0_14px_40px_-14px_rgba(24,26,32,0.14)] dark:shadow-[0_16px_44px_-12px_rgba(0,0,0,0.65)]"
          style={{ borderColor: `rgba(var(--brand-accent-rgb), 0.28)` }}
        >
          <div
            className="h-[2px] w-full rounded-t-2xl opacity-90"
            style={{
              background: `linear-gradient(to right, ${activePreset.primary}, ${activePreset.accent}, transparent)`,
            }}
          />
          <div className="px-4 sm:px-6 lg:px-8 h-15 flex items-center justify-between gap-3">
            <Link to="/" className="group flex items-center gap-3 whitespace-nowrap shrink-0">
              <AjinomotoLogoTile
                size="md"
                className="transition-transform duration-300 group-hover:scale-105"
              />
              <div className="h-6 w-px bg-neutral-200 dark:bg-white/10 hidden sm:block" />
              <div className="leading-tight">
                <span className="font-display font-extrabold text-[17px] tracking-tight block">
                  HR SupplyHub
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-theme-accent block">
                  Mojokerto Factory
                </span>
              </div>
            </Link>

            <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
              <div className="hidden lg:flex items-center gap-2 pr-1">
                <AjiuLogoBadge size="md" />
                <HseLogoBadge size="md" />
              </div>

              <div className="hidden lg:block h-6 w-px bg-neutral-200/90 dark:bg-white/10" />

              <AppearanceControls />

              <button
                type="button"
                onClick={() => navigate(user ? '/app/dashboard' : '/login')}
                className="group relative overflow-hidden px-4 sm:px-5 py-2 rounded-xl text-white text-xs sm:text-sm font-semibold hover:-translate-y-0.5 transition-all whitespace-nowrap cursor-pointer"
                style={{
                  background: `linear-gradient(to bottom, ${activePreset.primary}, ${activePreset.primaryHover})`,
                  boxShadow: `0 10px 24px -8px rgba(var(--brand-primary-rgb), 0.55)`,
                }}
              >
                <span className="relative z-10">
                  {user ? tr('Buka Dashboard', 'Open Dashboard') : tr('Masuk', 'Sign In')}
                </span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Hero Stage */}
      <main className="relative z-10 flex-1 flex flex-col justify-center">
        <section className="py-6 sm:py-8 lg:py-10">
          <div className="w-full max-w-[1640px] mx-auto px-4 sm:px-6 lg:px-10 xl:px-14 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 xl:gap-14 items-center">
            {/* Left Column: Editorial Luxury Typography */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="lg:col-span-5 min-w-0 space-y-5 lg:space-y-6"
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-3">
                  <span
                    className="h-[1.5px] w-8 sm:w-10 shrink-0"
                    style={{
                      background: `linear-gradient(to right, ${activePreset.primary}, ${activePreset.accent})`,
                    }}
                  />
                  <span className="text-[11px] font-bold tracking-[0.18em] uppercase text-theme-accent">
                    {tr('Departemen Human Resources', 'Human Resources Department')}
                  </span>
                </div>
                <p className="pl-11 sm:pl-[52px] text-xs sm:text-[13px] font-semibold tracking-wide text-neutral-600 dark:text-neutral-300 leading-snug">
                  PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory
                </p>
              </div>

              <div className="space-y-2">
                <h1
                  className="font-display font-extrabold tracking-[-0.03em] leading-[1.06] text-[#181B20] dark:text-white"
                  style={{ fontSize: 'clamp(2rem, 3.6vw, 3.75rem)', textWrap: 'balance' }}
                >
                  {tr('Sistem Kontrol Persediaan', 'Inventory Control System')}{' '}
                  <span
                    className="block mt-1 text-transparent bg-clip-text"
                    style={{
                      backgroundImage: `linear-gradient(to right, ${activePreset.primary}, ${activePreset.accent})`,
                    }}
                  >
                    {tr('& Laporan Digital HR', '& Digital HR Reporting')}
                  </span>
                </h1>
              </div>

              <p className="text-sm sm:text-base xl:text-[18px] text-neutral-600 dark:text-neutral-300/90 leading-[1.68] max-w-xl font-normal">
                {tr(
                  'Sistem terintegrasi HR Department untuk pengelolaan Office Supplies, Overhead Goods, dan Inventaris Overhead',
                  'Integrated HR Department platform for managing Office Supplies, Overhead Goods, and Overhead Inventory'
                )}
              </p>

              {/* Shimmering Primary Action + Public Employee Request Form */}
              <div className="pt-1 flex flex-wrap items-center gap-3.5">
                <button
                  type="button"
                  onClick={() => navigate(user ? '/app/dashboard' : '/login')}
                  className="group relative overflow-hidden inline-flex items-center gap-3.5 px-7 sm:px-8 py-3.5 sm:py-4 rounded-2xl text-white font-semibold text-sm tracking-wide hover:-translate-y-0.5 active:translate-y-0 transition-all whitespace-nowrap cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, ${activePreset.primary}, ${activePreset.primaryHover})`,
                    boxShadow: `0 20px 42px -12px rgba(var(--brand-primary-rgb), 0.56)`,
                  }}
                >
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-0 -left-full w-1/2 skew-x-[-24deg] bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-[360%]"
                  />
                  <span className="relative z-10">
                    {user
                      ? tr('Masuk ke Workspace', 'Enter Workspace')
                      : tr('Masuk ke Sistem', 'Sign In to System')}
                  </span>
                  <ArrowRight className="relative z-10 w-4 h-4 transition-transform duration-200 group-hover:translate-x-1" />
                </button>

                <button
                  type="button"
                  onClick={() => navigate('/pengambilan')}
                  className="inline-flex items-center gap-2.5 px-6 py-3.5 sm:py-4 rounded-2xl border bg-white/85 dark:bg-[#14171E]/85 hover:bg-white dark:hover:bg-[#1A1E26] text-[#1A1D21] dark:text-white font-semibold text-sm tracking-wide shadow-[0_12px_28px_-14px_rgba(24,26,32,0.18)] hover:-translate-y-0.5 active:translate-y-0 transition-all whitespace-nowrap cursor-pointer"
                  style={{ borderColor: `rgba(var(--brand-accent-rgb), 0.55)` }}
                >
                  <ClipboardList className="w-4 h-4 text-theme-primary shrink-0" />
                  <span>{tr('Form Pengambilan Karyawan', 'Employee Supply Request')}</span>
                </button>
              </div>

              {/* Architectural Numbered Scope Index */}
              <div
                className="pt-5 border-t grid grid-cols-1 xs:grid-cols-3 sm:grid-cols-3 gap-3 sm:gap-4 max-w-xl"
                style={{ borderColor: `rgba(var(--brand-accent-rgb), 0.28)` }}
              >
                <div className="space-y-0.5">
                  <div className="font-mono-num text-[11px] font-bold text-theme-accent">01</div>
                  <div className="text-xs font-semibold text-neutral-700 dark:text-neutral-200">
                    Office Supplies
                  </div>
                </div>
                <div className="space-y-0.5 sm:border-l border-neutral-200/80 dark:border-white/10 sm:pl-4">
                  <div className="font-mono-num text-[11px] font-bold text-theme-primary">02</div>
                  <div className="text-xs font-semibold text-neutral-700 dark:text-neutral-200">
                    Overhead Goods
                  </div>
                </div>
                <div className="space-y-0.5 sm:border-l border-neutral-200/80 dark:border-white/10 sm:pl-4">
                  <div className="font-mono-num text-[11px] font-bold text-theme-accent">03</div>
                  <div className="text-xs font-semibold text-neutral-700 dark:text-neutral-200">
                    {tr('Inventaris Overhead', 'Overhead Inventory')}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Right Column: Wide Gallery-Grade Architectural Factory Showcase */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
              className="lg:col-span-7 min-w-0 relative px-2 sm:px-4 py-3 sm:py-4"
            >
              <div
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[108%] aspect-square rounded-full border"
                style={{ borderColor: `rgba(var(--brand-accent-rgb), 0.2)` }}
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[88%] aspect-square rounded-full border border-dashed"
                style={{ borderColor: `rgba(var(--brand-primary-rgb), 0.2)` }}
              />

              <span
                aria-hidden="true"
                className="pointer-events-none absolute top-1 left-0 sm:left-2 w-5 h-5 border-t-2 border-l-2 rounded-tl-md"
                style={{ borderColor: activePreset.accent }}
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute top-1 right-0 sm:right-2 w-5 h-5 border-t-2 border-r-2 rounded-tr-md"
                style={{ borderColor: activePreset.accent }}
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute bottom-1 left-0 sm:left-2 w-5 h-5 border-b-2 border-l-2 rounded-bl-md"
                style={{ borderColor: activePreset.accent }}
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute bottom-1 right-0 sm:right-2 w-5 h-5 border-b-2 border-r-2 rounded-br-md"
                style={{ borderColor: activePreset.accent }}
              />

              <div style={{ perspective: 1200 }}>
                <motion.div
                  ref={frameRef}
                  onMouseMove={handleFrameMouseMove}
                  onMouseLeave={handleFrameMouseLeave}
                  style={{ rotateX: tiltX, rotateY: tiltY, transformStyle: 'preserve-3d' }}
                  className="relative"
                >
                  <div
                    className="p-[1.5px] rounded-[28px] shadow-[0_32px_80px_-20px_rgba(24,26,32,0.34)] dark:shadow-[0_34px_84px_-18px_rgba(0,0,0,0.85)]"
                    style={{
                      background: `linear-gradient(135deg, ${activePreset.accent}, rgba(255,255,255,0.6), ${activePreset.primary})`,
                    }}
                  >
                    <div className="group relative rounded-[26.5px] p-2 sm:p-2.5 bg-white/92 dark:bg-[#14171E]/95 backdrop-blur-xl">
                      <div className="relative rounded-[20px] overflow-hidden">
                        <img
                          src="/assets/aistudio/grup_ajinomoto_indonesia-dmQw_large_0e1fe3a6.jpeg"
                          alt="PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory"
                          className="w-full aspect-[16/10] object-cover block contrast-[1.04] saturate-[1.06] transition-transform duration-700 ease-out group-hover:scale-[1.035]"
                        />

                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0D1015]/88 via-[#0D1015]/15 to-transparent" />
                        <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/25 rounded-[20px]" />

                        <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6">
                          <div
                            className="pt-3 border-t flex flex-wrap items-end justify-between gap-3"
                            style={{ borderColor: `rgba(var(--brand-accent-rgb), 0.45)` }}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-white/90">
                                <Building2 className="w-3 h-3 shrink-0" style={{ color: activePreset.accent }} />
                                <span>Mojokerto Factory</span>
                              </div>
                              <div className="text-xs sm:text-sm xl:text-[15px] font-display font-bold text-white mt-0.5 leading-snug">
                                PT Ajinomoto Indonesia - PT Ajinex International
                              </div>
                            </div>

                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/45 backdrop-blur-md border border-white/15 text-white shrink-0">
                              <ShieldCheck className="w-3.5 h-3.5" style={{ color: activePreset.accent }} />
                              <span className="text-[11px] font-medium tracking-wide whitespace-nowrap">
                                HR SupplyHub Portal
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      {/* Architectural Hairline Footer */}
      <footer className="relative z-10 py-5">
        <div className="w-full max-w-[1640px] mx-auto px-4 sm:px-6 lg:px-10 xl:px-14">
          <div
            className="h-px w-full mb-5"
            style={{
              background: `linear-gradient(to right, transparent, rgba(var(--brand-accent-rgb), 0.48), transparent)`,
            }}
          />
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
              <AjinomotoLogoTile size="sm" />
              <AjiuLogoBadge size="sm" />
              <HseLogoBadge size="sm" />
              <span className="text-xs font-semibold tracking-wide text-neutral-700 dark:text-neutral-300 pl-1">
                HR SupplyHub · {tr('Departemen Human Resources', 'Human Resources Department')}
              </span>
            </div>
            <div className="text-xs text-neutral-500 dark:text-neutral-400 text-center sm:text-right leading-relaxed">
              © 2026 PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

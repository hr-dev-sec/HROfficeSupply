import React from 'react';

interface EmblemSizeProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_MAP = {
  sm: { box: 'w-8 h-8', ajinoH: 'h-6', pad: 'p-[3px]' },
  md: { box: 'w-9 h-9', ajinoH: 'h-7', pad: 'p-[3.5px]' },
  lg: { box: 'w-11 h-11', ajinoH: 'h-9', pad: 'p-1' },
};

export const AjinomotoLogoTile: React.FC<EmblemSizeProps> = ({ size = 'md', className = '' }) => {
  const s = SIZE_MAP[size];
  return (
    <div
      title="PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory"
      className={`inline-flex items-center justify-center rounded-xl bg-white shadow-[0_4px_12px_-3px_rgba(0,0,0,0.12)] ring-1 ring-black/5 px-1.5 py-1 shrink-0 ${className}`}
    >
      <img
        src="/logo-ajinomoto.png"
        alt="PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory"
        className={`${s.ajinoH} w-auto object-contain block`}
      />
    </div>
  );
};

export const AjiuLogoBadge: React.FC<EmblemSizeProps> = ({ size = 'md', className = '' }) => {
  const s = SIZE_MAP[size];
  return (
    <div
      title="Ajinomoto Indonesia University · Mojokerto Campus"
      className={`${s.box} rounded-full overflow-hidden bg-[#0B0D10] ring-1 ring-[#C9A24B]/60 shadow-[0_4px_12px_-3px_rgba(201,162,75,0.35)] flex items-center justify-center shrink-0 ${className}`}
    >
      <img
        src="/assets/aistudio/LOGO_AJIU_HD_a159e3b5.png"
        alt="AJI University Mojokerto Campus"
        className="w-full h-auto max-w-none scale-[1.09] block"
      />
    </div>
  );
};

export const HseLogoBadge: React.FC<EmblemSizeProps> = ({ size = 'md', className = '' }) => {
  const s = SIZE_MAP[size];
  return (
    <div
      title="Safety First · HSE PT Ajinomoto Indonesia - PT Ajinex International, Mojokerto Factory"
      className={`${s.box} ${s.pad} rounded-xl bg-white ring-1 ring-emerald-700/20 shadow-[0_4px_12px_-3px_rgba(5,150,105,0.18)] flex items-center justify-center shrink-0 ${className}`}
    >
      <div className="w-full h-full overflow-hidden flex items-center justify-center">
        <img
          src="/assets/aistudio/HSE_8e0164a8.png"
          alt="Safety First HSE"
          className="h-full w-auto max-w-none block"
        />
      </div>
    </div>
  );
};

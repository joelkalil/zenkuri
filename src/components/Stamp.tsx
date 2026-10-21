import type { CSSProperties } from 'react';

/*
 * Estampa de conclusão (hanko). O arquivo SVG de public/brand é só a moldura:
 * entra como máscara para herdar a cor do tema (platina = vermilhão, o próprio
 * hanko; 100% = verde jade) e a data é composta em mono na zona livre
 * (x 28..100 de 128; y 57..85 na platina, 60..88 no 100%).
 */
type StampKind = 'platina' | '100';
type StampSize = 24 | 48 | 96;

interface StampProps {
  kind: StampKind;
  /** ISO (2026-10-20) ou qualquer string aceita por Date; ausente = sem data */
  date?: string;
  size?: StampSize;
  /** semente da rotação determinística (ex.: id do jogo) */
  seed?: string | number;
  className?: string;
}

const KIND = {
  platina: { frame: '/brand/stamp-platina.svg', color: 'var(--color-violet-500)', label: 'Platina', zoneTop: 57 },
  '100': { frame: '/brand/stamp-100.svg', color: 'var(--zk-complete)', label: '100%', zoneTop: 60 },
} as const;

const ZONE = { left: 28, width: 72, height: 28 } as const;
const GRID = 128;
const MONTHS_LONG = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'] as const;

function hashSeed(seed: string | number): number {
  const text = String(seed);
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  return hash;
}

/** -4° a +4°, passo de 1°; estável por semente. */
export function stampRotation(seed: string | number): number {
  return (hashSeed(seed) % 9) - 4;
}

function parseDate(date: string): Date | null {
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(date);
  const parsed = iso ? new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])) : new Date(date);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function Stamp({ kind, date, size = 48, seed = 0, className = '' }: StampProps) {
  const spec = KIND[kind];
  const parsed = date ? parseDate(date) : null;
  const showDate = size !== 24 && parsed !== null;
  const text = parsed ? `${pad(parsed.getDate())}.${pad(parsed.getMonth() + 1)}.${size === 48 ? pad(parsed.getFullYear() % 100) : parsed.getFullYear()}` : '';
  const zoneWidthPx = (ZONE.width / GRID) * size;
  const fontSize = Math.min((ZONE.height / GRID) * size * 0.6, zoneWidthPx / (Math.max(text.length, 1) * 0.62));
  const label = parsed
    ? `${spec.label} em ${parsed.getDate()} de ${MONTHS_LONG[parsed.getMonth()]} de ${parsed.getFullYear()}`
    : spec.label;

  const frameStyle: CSSProperties = {
    backgroundColor: spec.color,
    WebkitMask: `url(${spec.frame}) center / contain no-repeat`,
    mask: `url(${spec.frame}) center / contain no-repeat`,
  };

  return (
    <span
      role="img"
      aria-label={label}
      className={`relative inline-block shrink-0 ${className}`}
      style={{ width: size, height: size, transform: size === 24 ? undefined : `rotate(${stampRotation(seed)}deg)` }}
    >
      <span aria-hidden="true" className="absolute inset-0" style={frameStyle} />
      {showDate && (
        <span
          aria-hidden="true"
          className="absolute flex items-center justify-center font-mono font-medium leading-none"
          style={{
            left: `${(ZONE.left / GRID) * 100}%`,
            top: `${(spec.zoneTop / GRID) * 100}%`,
            width: `${(ZONE.width / GRID) * 100}%`,
            height: `${(ZONE.height / GRID) * 100}%`,
            color: spec.color,
            fontSize,
          }}
        >
          {text}
        </span>
      )}
    </span>
  );
}

import { Link } from 'react-router-dom';
import type { UserLevel } from '../lib/api';
import type { I18n } from '../i18n/core';
import { formatNumber, getActiveLocale } from '../i18n/format';
import type { Locale } from '../i18n/locales';
import type { StringKey } from '../i18n/types';
import { useI18n } from '../i18n';

const TIER_LABEL_KEY = {
  alvorada: 'level.tiers.alvorada',
  aurora: 'level.tiers.aurora',
  peregrino: 'level.tiers.peregrino',
  artesao: 'level.tiers.artesao',
  veterano: 'level.tiers.veterano',
  mestre: 'level.tiers.mestre',
  sensei: 'level.tiers.sensei',
  lenda: 'level.tiers.lenda',
} as const satisfies Record<string, StringKey>;

function isTierKey(key: string): key is keyof typeof TIER_LABEL_KEY {
  return key in TIER_LABEL_KEY;
}

/** Translated tier name; falls back to the server-provided label for unknown tiers. */
export function tierLabel(t: I18n['t'], tier: { key: string; label: string }): string {
  return isTierKey(tier.key) ? t(TIER_LABEL_KEY[tier.key]) : tier.label;
}

/*
  Style per tier. It lives on the client (not the server) because Tailwind
  needs the class names written out in full, and because the `violet-*` accent
  is the theme's highlight token, so the tier follows both Zenkuri and Paper.
  The tier is never conveyed by color alone: its name always appears next to it.
*/
const TIER_STYLE: Record<string, { text: string; ring: string; bar: string }> = {
  alvorada: { text: 'text-gray-400', ring: 'ring-gray-700', bar: 'bg-gray-500' },
  aurora: { text: 'text-violet-300', ring: 'ring-violet-500/30', bar: 'bg-violet-300' },
  peregrino: { text: 'text-violet-300', ring: 'ring-violet-500/40', bar: 'bg-violet-400' },
  artesao: { text: 'text-violet-400', ring: 'ring-violet-500/40', bar: 'bg-violet-400' },
  veterano: { text: 'text-violet-400', ring: 'ring-violet-500/60', bar: 'bg-violet-500' },
  mestre: { text: 'text-violet-400', ring: 'ring-violet-500/70', bar: 'bg-violet-500' },
  sensei: { text: 'text-zk-gold', ring: 'ring-zk-gold/60', bar: 'bg-zk-gold' },
  lenda: { text: 'text-zk-gold', ring: 'ring-zk-gold/70', bar: 'bg-zk-gold' },
};

export function tierStyle(tierKey: string) {
  return TIER_STYLE[tierKey] ?? TIER_STYLE.alvorada;
}

/** Thousands-separated XP in the given locale (defaults to the active one). */
export function formatXp(xp: number, locale: Locale = getActiveLocale()) {
  return formatNumber(locale, xp);
}

/**
 * Level badge. The compact version shows only the number, with the rest in the
 * `title`; the expanded one shows tier, level and a thin XP bar.
 */
export function LevelBadge({ level, compact = false }: { level: UserLevel; compact?: boolean }) {
  const { t, locale } = useI18n();
  const style = tierStyle(level.tier.key);
  const tier = tierLabel(t, level.tier);
  const caption = t('level.caption', { level: level.level, tier, xp: formatXp(level.xp, locale) });

  if (compact) {
    return (
      <div
        title={caption}
        className={`mx-auto grid h-10 w-10 place-items-center rounded bg-gray-900 text-[13px] font-bold tabular-nums ring-1 ${style.ring} ${style.text}`}
      >
        {level.level}
      </div>
    );
  }

  return (
    <div className="space-y-1.5" title={caption}>
      <div className="flex items-baseline justify-between gap-2">
        <span className={`font-display text-[11px] font-semibold uppercase tracking-[0.14em] ${style.text}`}>
          {tier}
        </span>
        <span className="text-[11px] font-semibold tabular-nums text-gray-500">{t('level.level', { level: level.level })}</span>
      </div>
      <div
        className="h-1 overflow-hidden rounded-full bg-gray-800"
        role="progressbar"
        aria-valuenow={level.progressPercent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t('level.progressLabel', { next: level.level + 1 })}
      >
        <div className={`h-full rounded-full ${style.bar} transition-[width] duration-500`} style={{ width: `${level.progressPercent}%` }} />
      </div>
    </div>
  );
}

/**
 * Level in the header, between Sync and the avatar. Number and tier share one
 * link; the 2px bar underneath is the progress to the next level. The detail
 * (XP, breakdown and platform levels) lives in Settings > Level.
 */
export function LevelChip({ level }: { level: UserLevel }) {
  const { t, locale } = useI18n();
  const style = tierStyle(level.tier.key);
  const tier = tierLabel(t, level.tier);
  const label = t('level.chipLabel', { level: level.level, tier, percent: level.progressPercent, next: level.level + 1 });

  return (
    <Link to="/settings?tab=level" className="level-chip" aria-label={label} title={t('level.chipTitle', { percent: level.progressPercent, next: level.level + 1, xp: formatXp(level.xp, locale) })}>
      <span className="level-chip-text">
        <span className="level-chip-number">{t('level.level', { level: level.level })}</span>
        <span className="level-chip-sep" aria-hidden="true">·</span>
        <span className={`level-chip-tier ${style.text}`}>{tier}</span>
      </span>
      <span className="level-chip-track" aria-hidden="true">
        <span className={`level-chip-fill ${style.bar}`} style={{ width: `${level.progressPercent}%` }} />
      </span>
    </Link>
  );
}

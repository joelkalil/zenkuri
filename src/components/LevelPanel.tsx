import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useI18n, useT } from '../i18n';
import { withSlots } from '../i18n/withSlots';
import { useErrorMessage } from '../i18n/useErrorMessage';
import { ApiError, fetchPlatformLevels, type LevelSlice, type PlatformLevel, type UserLevel } from '../lib/api';
import { PLATFORM_META } from '../lib/platforms';
import type { Platform } from '../types/steam';
import { formatXp, tierLabel, tierStyle } from './LevelBadge';

const RARITY_KEYS = ['mythic', 'ultra', 'rare', 'uncommon', 'common', 'trivial', 'unknown'] as const;

type RarityKey = (typeof RARITY_KEYS)[number];

function isRarityKey(key: string): key is RarityKey {
  return (RARITY_KEYS as readonly string[]).includes(key);
}

function Bar({ percent, className, label }: { percent: number; className: string; label?: string }) {
  return (
    <div
      className="h-1 overflow-hidden bg-gray-800"
      role={label ? 'progressbar' : undefined}
      aria-valuenow={label ? percent : undefined}
      aria-valuemin={label ? 0 : undefined}
      aria-valuemax={label ? 100 : undefined}
      aria-label={label}
    >
      <div className={`h-full transition-[width] duration-200 ${className}`} style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} />
    </div>
  );
}

/**
 * One composition row: label, achievements, XP and the share of the total.
 * The server sends pt-BR rarity labels; they are rendered by the stable slice key.
 * Platform labels are brand names and stay as sent.
 */
function SliceRow({ slice, totalXp, barClass, byRarity = false }: { slice: LevelSlice; totalXp: number; barClass: string; byRarity?: boolean }) {
  const t = useT('hall');
  const { formatNumber } = useI18n();
  const share = totalXp > 0 ? Math.round((slice.xp / totalXp) * 100) : 0;
  const label = byRarity && isRarityKey(slice.key) ? t(`levelPanel.rarity.${slice.key}`) : slice.label;
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-1.5">
      <span className="truncate text-sm text-gray-200">{label}</span>
      <span className="text-xs tabular-nums text-gray-500">
        {formatNumber(slice.achievements)} · <span className="text-gray-300">{t('levelPanel.xpUnit', { xp: formatXp(slice.xp) })}</span>
      </span>
      <span className="col-span-2"><Bar percent={share} className={barClass} /></span>
    </li>
  );
}

/**
 * Zenkuri level in detail: number, progress and where the XP came from.
 * Lives in Settings → Level; the header only shows the summary (LevelChip).
 */
export function LevelPanel({ level }: { level: UserLevel }) {
  const t = useT('hall');
  const { t: tGlobal, formatNumber } = useI18n();
  const n = formatNumber;
  const style = tierStyle(level.tier.key);
  const remaining = Math.max(0, level.xpForNextLevel - level.xpIntoLevel);
  const isEmpty = level.counts.achievements === 0;

  return (
    <section aria-labelledby="zenkuri-level" className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
      <div>
        <h3 id="zenkuri-level" className="micro">{t('levelPanel.title')}</h3>
        <p className="mt-3 flex items-baseline gap-3">
          <span className="font-display text-5xl font-black leading-none tabular-nums tracking-tight text-gray-100">{level.level}</span>
          <span className={`text-base font-medium ${style.text}`}>{tierLabel(tGlobal, level.tier)}</span>
        </p>
        <div className="mt-5">
          <Bar percent={level.progressPercent} className={style.bar} label={t('levelPanel.progress', { next: level.level + 1 })} />
        </div>
        <p className="mt-2.5 text-sm text-gray-500">
          {isEmpty
            ? t('levelPanel.empty')
            : <>
                {withSlots(t('levelPanel.intoLevel', { total: formatXp(level.xpForNextLevel), next: level.level + 1 }), {
                  into: <span className="tabular-nums text-gray-300">{formatXp(level.xpIntoLevel)}</span>,
                  remaining: <span className="tabular-nums text-gray-300">{formatXp(remaining)}</span>,
                })}
                {level.nextTier ? withSlots(t('levelPanel.tierArrives', { minLevel: level.nextTier.minLevel }), {
                  tier: <span className={tierStyle(level.nextTier.key).text}>{tierLabel(tGlobal, level.nextTier)}</span>,
                }) : null}.
              </>}
        </p>
        {!isEmpty && (
          <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-gray-800 pt-5 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
            {[
              [t('levelPanel.stats.totalXp'), formatXp(level.xp)],
              [t('levelPanel.stats.achievements'), n(level.counts.achievements)],
              [t('levelPanel.stats.rare'), n(level.counts.rare)],
              [t('levelPanel.stats.platinums'), n(level.counts.platinums)],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-gray-500">{label}</dt>
                <dd className="mt-1 text-lg font-semibold tabular-nums text-gray-100">{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      {!isEmpty && (
        <div className="grid gap-8 sm:grid-cols-2">
          <div>
            <h3 className="text-sm font-semibold text-gray-300">{t('levelPanel.byPlatform')}</h3>
            <ul className="mt-4 space-y-4">
              {level.breakdown.platforms.map((slice) => (
                <SliceRow key={slice.key} slice={slice} totalXp={level.xp} barClass="bg-violet-500" />
              ))}
            </ul>
            {level.breakdown.bonusXp > 0 && (
              <p className="mt-4 text-xs text-gray-500">
                {t.plural('levelPanel.bonus', level.counts.perfects, { xp: formatXp(level.breakdown.bonusXp) })}
              </p>
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-300">{t('levelPanel.byRarity')}</h3>
            <ul className="mt-4 space-y-4">
              {level.breakdown.rarity.map((slice) => (
                <SliceRow key={slice.key} slice={slice} totalXp={level.xp} barClass="bg-zk-gold" byRarity />
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
}

const ORDER: Platform[] = ['steam', 'psn', 'retroachievements'];

const PSN_TROPHIES = [
  ['platinum', '/trophies/platinum.png'],
  ['gold', '/trophies/gold.png'],
  ['silver', '/trophies/silver.png'],
  ['bronze', '/trophies/bronze.png'],
] as const;

type PsnGradeKey = 'bronze' | 'silver' | 'gold' | 'platinum';

/** PSN trophy level (1 to 10) to grade; mirrors the server table, which sends the grade only as a pt-BR word. */
function psnGradeKey(tier: number): PsnGradeKey | null {
  if (tier >= 10) return 'platinum';
  if (tier >= 7) return 'gold';
  if (tier >= 4) return 'silver';
  if (tier >= 1) return 'bronze';
  return null;
}

function PlatformBody({ item, onOpenConnections }: { item: PlatformLevel; onOpenConnections: () => void }) {
  const t = useT('hall');
  const { formatNumber } = useI18n();
  const describe = useErrorMessage();
  const n = formatNumber;

  if (item.status === 'unlinked') {
    return (
      <div className="mt-4 text-sm text-gray-500">
        <p>{t('levelPanel.platforms.unlinked')}</p>
        <button onClick={onOpenConnections} className="mt-2 min-h-10 font-medium text-violet-400 hover:text-violet-300">{t('levelPanel.platforms.link')}</button>
      </div>
    );
  }

  if (item.status === 'error') {
    const { message, code } = item;
    return <p className="mt-4 text-sm leading-relaxed text-zk-danger">{describe(new ApiError(message, 0, code), 'hall.levelPanel.platforms.failed')}</p>;
  }

  if (item.platform === 'steam') {
    const toNext = Math.max(0, item.xpForNextLevel - item.xpIntoLevel);
    return (
      <>
        <p className="mt-4 flex items-baseline gap-2">
          <span className="font-display text-4xl font-black leading-none tabular-nums tracking-tight text-gray-100">{n(item.level)}</span>
          <span className="text-sm text-gray-500">{t('levelPanel.platforms.steam.level')}</span>
        </p>
        <div className="mt-4"><Bar percent={item.progressPercent} className="bg-violet-500" label={t('levelPanel.platforms.steam.progress', { next: item.level + 1 })} /></div>
        <p className="mt-2.5 text-sm text-gray-500">
          {withSlots(t('levelPanel.platforms.steam.summary', { next: item.level + 1 }), {
            xp: <span className="tabular-nums text-gray-300">{n(item.xp)}</span>,
            remaining: <span className="tabular-nums text-gray-300">{n(toNext)}</span>,
          })}
        </p>
      </>
    );
  }

  if (item.platform === 'psn') {
    const gradeKey = psnGradeKey(item.tier);
    // Unknown tier: fall back to the server string.
    const gradeLabel = gradeKey ? t(`levelPanel.platforms.psn.grades.${gradeKey}`) : item.grade;
    return (
      <>
        <p className="mt-4 flex items-baseline gap-2">
          <span className="font-display text-4xl font-black leading-none tabular-nums tracking-tight text-gray-100">{n(item.level)}</span>
          <span className="text-sm text-gray-500">{t('levelPanel.platforms.psn.level', { grade: gradeLabel })}</span>
        </p>
        <div className="mt-4"><Bar percent={item.progressPercent} className="bg-zk-platinum" label={t('levelPanel.platforms.psn.progress', { next: item.level + 1 })} /></div>
        <p className="mt-2.5 text-sm text-gray-500">
          {withSlots(t('levelPanel.platforms.psn.toNext', { next: item.level + 1 }), {
            percent: <span className="tabular-nums text-gray-300">{item.progressPercent}%</span>,
          })}
        </p>
        <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
          {PSN_TROPHIES.map(([key, icon]) => (
            <li key={key} className="flex items-center gap-1.5 text-sm tabular-nums text-gray-300" title={t(`levelPanel.platforms.psn.trophies.${key}`)}>
              <img src={icon} alt="" className="h-4 w-4 object-contain" />
              {n(item.trophies[key])}<span className="sr-only"> {t(`levelPanel.platforms.psn.trophies.${key}`)}</span>
            </li>
          ))}
        </ul>
      </>
    );
  }

  if (item.platform === 'retroachievements') {
    return (
      <>
        <p className="mt-4 flex items-baseline gap-2">
          <span className="font-display text-4xl font-black leading-none tabular-nums tracking-tight text-gray-100">{n(item.points)}</span>
          <span className="text-sm text-gray-500">{t('levelPanel.platforms.ra.points')}</span>
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div>
            <dt className="text-xs text-gray-500">{t('levelPanel.platforms.ra.rank')}</dt>
            <dd className="mt-0.5 tabular-nums text-gray-200">
              {item.rank ? <>#{n(item.rank)}{item.totalRanked ? <span className="text-gray-500">{t('levelPanel.platforms.ra.ofTotal', { total: n(item.totalRanked) })}</span> : null}</> : t('levelPanel.platforms.ra.noRank')}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">{t('levelPanel.platforms.ra.truePoints')}</dt>
            <dd className="mt-0.5 tabular-nums text-gray-200">{n(item.truePoints)}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">{t('levelPanel.platforms.ra.softcore')}</dt>
            <dd className="mt-0.5 tabular-nums text-gray-200">{n(item.softcorePoints)}</dd>
          </div>
          {item.rank && item.totalRanked ? (
            <div>
              <dt className="text-xs text-gray-500">{t('levelPanel.platforms.ra.top')}</dt>
              <dd className="mt-0.5 tabular-nums text-gray-200">{n(Math.max(0.1, (item.rank / item.totalRanked) * 100), { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%</dd>
            </div>
          ) : null}
        </dl>
      </>
    );
  }

  return null;
}

/** Level each platform shows on its own profile, side by side. */
export function PlatformLevels({ onOpenConnections }: { onOpenConnections: () => void }) {
  const t = useT('hall');
  const describe = useErrorMessage();
  const [items, setItems] = useState<PlatformLevel[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<unknown>(null);

  const load = useCallback((fresh: boolean) => {
    setLoading(true);
    setFailure(null);
    fetchPlatformLevels(fresh)
      .then(setItems)
      .catch(setFailure)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(false); }, [load]);

  const failed = failure === null ? null : describe(failure, 'hall.levelPanel.platforms.failed');
  const byPlatform = new Map(items?.map((item) => [item.platform, item]));

  return (
    <section aria-labelledby="platform-levels" className="border-t border-gray-800 pt-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 id="platform-levels" className="micro">{t('levelPanel.platforms.title')}</h3>
          <p className="mt-1 text-sm text-gray-500">{t('levelPanel.platforms.description')}</p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={loading}
          className="flex min-h-10 items-center gap-2 rounded px-3 text-sm font-medium text-gray-400 transition-colors hover:bg-gray-850 hover:text-gray-100 disabled:cursor-progress disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          {loading ? t('levelPanel.platforms.refreshing') : t('levelPanel.platforms.refresh')}
        </button>
      </div>

      {failed && <p className="mt-5 text-sm text-zk-danger">{failed}</p>}

      <div className="mt-6 grid gap-y-8 md:grid-cols-3 md:divide-x md:divide-gray-800">
        {ORDER.map((platform, index) => {
          const meta = PLATFORM_META[platform];
          const item = byPlatform.get(platform);
          return (
            <article key={platform} className={index === 0 ? 'md:pr-10' : index === ORDER.length - 1 ? 'md:pl-10' : 'md:px-10'} aria-busy={loading && !item}>
              <h3 className="flex items-center gap-2 text-sm font-medium text-gray-200">
                <img src={meta.logo} alt="" className="h-4 w-4 object-contain" />
                {meta.label}
              </h3>
              {item ? (
                <PlatformBody item={item} onOpenConnections={onOpenConnections} />
              ) : loading ? (
                <div className="mt-4 space-y-3" aria-hidden="true">
                  <div className="h-9 w-24 animate-pulse rounded-md bg-gray-800" />
                  <div className="h-1.5 animate-pulse rounded-full bg-gray-800" />
                  <div className="h-4 w-40 animate-pulse rounded bg-gray-800" />
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

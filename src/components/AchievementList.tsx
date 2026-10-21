import { Check } from 'lucide-react';
import { Stamp } from './Stamp';
import { useI18n } from '../i18n';
import type { AchievementWithStatus, Platform } from '../types/steam';

interface AchievementListProps {
  achievements: AchievementWithStatus[];
  platform?: Platform;
}


type TrophyType = 'platinum' | 'gold' | 'silver' | 'bronze';

function isTrophyType(value: string | undefined): value is TrophyType {
  return value === 'platinum' || value === 'gold' || value === 'silver' || value === 'bronze';
}

const TYPE_ICON: Record<string, string> = {
  platinum: '/trophies/platinum.png',
  gold: '/trophies/gold.png',
  silver: '/trophies/silver.png',
  bronze: '/trophies/bronze.png',
};

const TYPE_COLOR: Record<string, string> = {
  platinum: 'text-zk-platinum',
  gold: 'text-zk-gold',
  silver: 'text-zk-silver',
  bronze: 'text-zk-bronze',
};

/** Dense table checklist: number, image, name + description, type/points, rarity, date and state. */
export function AchievementList({ achievements, platform }: AchievementListProps) {
  const { t, formatDate, formatNumber } = useI18n();
  const noun = platform === 'psn' ? 'trophies' : 'achievements';

  function fmtDate(ts: number): string {
    if (!ts) return '';
    return formatDate(ts * 1000, { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  if (achievements.length === 0) {
    return <p className="py-10 text-sm text-gray-500">{t(`game.list.${noun}.empty`)}</p>;
  }

  return (
    <div role="table" aria-label={t(`game.list.${noun}.label`)} className="trophy-table">
      <div role="row" className="trophy-head col-head">
        <span role="columnheader" className="r">{t('game.list.rank')}</span>
        <span role="columnheader"><span className="sr-only">{t('game.list.image')}</span></span>
        <span role="columnheader">{t(`game.list.${noun}.name`)}</span>
        <span role="columnheader" className="trophy-hide-sm">{t('game.list.type')}</span>
        <span role="columnheader" className="r">{t('game.list.rarity')}</span>
        <span role="columnheader" className="r trophy-hide-sm">{t('game.list.earnedAt')}</span>
        <span role="columnheader"><span className="sr-only">{t('game.list.state')}</span></span>
      </div>
      {achievements.map((a, index) => {
        const earned = a.achieved;
        const type = a.type;
        const trophyIcon = type ? TYPE_ICON[type] : undefined;
        const hasRarity = typeof a.rarity === 'number' && a.rarity > 0;
        return (
          <div key={a.name} role="row" className="trophy-row" data-earned={earned} data-platinum={type === 'platinum'}>
            <span role="cell" className="n r">{index + 1}</span>
            <span role="cell">
              <img
                src={earned ? a.icon : a.icongray}
                alt=""
                className={`trophy-img ${earned ? '' : 'grayscale opacity-60'}`}
                onError={(e) => { (e.target as HTMLImageElement).style.visibility = 'hidden'; }}
              />
            </span>
            <span role="cell" className="min-w-0">
              <span className="trophy-name">{a.displayName || a.name}</span>
              <span className="trophy-desc">{a.hidden && !earned ? t(`game.list.${noun}.hidden`) : a.description || t('game.list.noDescription')}</span>
            </span>
            <span role="cell" className="trophy-hide-sm trophy-type">
              {trophyIcon && isTrophyType(type) ? (
                <>
                  <img src={trophyIcon} alt="" />
                  <span className={TYPE_COLOR[type] ?? 'text-gray-300'}>{t(`game.trophyTypes.${type}`)}</span>
                </>
              ) : typeof a.points === 'number' && a.points > 0 ? (
                <span className="num">{t('game.points', { count: a.points })}</span>
              ) : null}
            </span>
            <span role="cell" className="num r">{hasRarity ? `${formatNumber(a.rarity as number, { maximumFractionDigits: 1 })}%` : '—'}</span>
            <span role="cell" className="num r trophy-hide-sm trophy-date">{earned && a.unlocktime > 0 ? fmtDate(a.unlocktime) : '—'}</span>
            <span role="cell" className="trophy-state">
              {earned ? (
                type === 'platinum' && a.unlocktime > 0
                  ? <Stamp kind="platina" size={24} seed={a.name} />
                  : <span className="trophy-mark" role="img" aria-label={a.unlocktime > 0 ? t(`game.list.${noun}.earnedOn`, { date: fmtDate(a.unlocktime) }) : t(`game.list.${noun}.earned`)}><Check size={12} strokeWidth={3} aria-hidden="true" /></span>
              ) : (
                <span className="trophy-open" role="img" aria-label={t('game.list.locked')} />
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

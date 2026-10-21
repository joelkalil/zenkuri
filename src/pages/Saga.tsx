import { useMemo, useState } from 'react';
import { Link, Navigate, NavLink, useParams } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { Attribution } from '../components/community/Attribution';
import { GameCover } from '../components/GameCover';
import { SectionHead } from '../components/SectionHead';
import { Stamp } from '../components/Stamp';
import { StoreCover } from '../components/StoreCover';
import { useSteam } from '../context/SteamContext';
import { contentLang } from '../hooks/useCommunity';
import { useSagas, type SagaWithMeta } from '../hooks/useSagas';
import { RichText } from '../components/RichText';
import { useI18n, useT } from '../i18n';
import { withSlots } from '../i18n/withSlots';
import { formatDayLong } from '../lib/planDates';
import { steamStoreUrl } from '../lib/steamStore';
import {
  type Saga as SagaData,
  type SagaEntry,
  type SagaFlag,
} from '../types/community';
import type { Game } from '../types/steam';
import '../styles/sagas.css';

type EntryStatus = 'done' | 'progress' | 'owned' | 'missing';

interface ResolvedEntry extends SagaEntry {
  order: number;
  game: Game | null;
  status: EntryStatus;
  percent: number;
}

const DIFFICULTY_KEY = {
  1: 'calm',
  2: 'light',
  3: 'medium',
  4: 'demanding',
  5: 'brutal',
} as const satisfies Record<SagaEntry['difficulty'], string>;

const FLAG_TONE: Record<SagaFlag, 'gold' | undefined> = {
  online: undefined,
  missable: 'gold',
  legacy: undefined,
};

function statusOf(game: Game | null): { status: EntryStatus; percent: number } {
  if (!game) return { status: 'missing', percent: 0 };
  const percent = game.completion?.percent ?? 0;
  if (percent >= 100) return { status: 'done', percent };
  if (percent > 0) return { status: 'progress', percent };
  return { status: 'owned', percent };
}

/** Hours range as text ("12 h" or "10–14 h"), already formatted for the active locale. */
function useHoursFormat() {
  const t = useT('saga');
  const { formatNumber } = useI18n();
  return ([min, max]: [number, number]) => {
    const lo = Math.round(min);
    const hi = Math.round(max);
    return lo === hi
      ? t('hours.single', { hours: formatNumber(lo) })
      : t('hours.range', { min: formatNumber(lo), max: formatNumber(hi) });
  };
}

function useBrl() {
  const { formatNumber } = useI18n();
  return (value: number) => formatNumber(value, { style: 'currency', currency: 'BRL' });
}

function DifficultyMeter({ value }: { value: SagaEntry['difficulty'] }) {
  const t = useT('saga');
  const label = t(`difficulty.levels.${DIFFICULTY_KEY[value]}`);
  const tone = value >= 5 ? 'bg-zk-danger' : value >= 4 ? 'bg-zk-gold' : 'bg-gray-400';
  return (
    <span className="inline-flex items-center gap-1.5" title={t('difficulty.title', { label })}>
      <span className="flex gap-0.5" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((step) => (
          <span key={step} className={`h-2.5 w-1 rounded-[1px] ${step <= value ? tone : 'bg-gray-800'}`} />
        ))}
      </span>
      <span>{t('difficulty.text', { label })}</span>
    </span>
  );
}

function EntryStatusBlock({ entry }: { entry: ResolvedEntry }) {
  const t = useT('saga');
  const brl = useBrl();
  if (entry.status === 'done') {
    return (
      <span className="sg-status-done">
        <Stamp kind="100" size={24} seed={entry.appid} /> 100%
      </span>
    );
  }

  if (entry.status === 'progress' || entry.status === 'owned') {
    return (
      <span className="block w-full">
        <span className="mb-1.5 flex items-center justify-between text-xs">
          <span className="text-gray-500">{entry.status === 'owned' ? t('entry.owned') : t('entry.inProgress')}</span>
          <span className="num font-semibold text-gray-200">{entry.percent}%</span>
        </span>
        <span className="sg-track" role="progressbar" aria-label={t('entry.progress', { title: entry.title })} aria-valuenow={entry.percent} aria-valuemin={0} aria-valuemax={100}>
          <span className="sg-fill" style={{ width: `${entry.percent}%` }} />
        </span>
      </span>
    );
  }

  const price = entry.priceBRL;
  const priceLabel = price === null ? t('price.delisted') : price === 0 ? t('price.free') : brl(price);

  return (
    <span className="flex flex-col items-end gap-0.5">
      <span className="micro">{t('entry.notOwned')}</span>
      <span className="num text-sm font-semibold text-gray-200">{priceLabel}</span>
    </span>
  );
}

function EntryRow({ entry, isNext, language }: { entry: ResolvedEntry; isNext: boolean; language?: string }) {
  const t = useT('saga');
  const { formatNumber } = useI18n();
  const formatHours = useHoursFormat();
  const done = entry.status === 'done';
  const cover = entry.game
    ? <GameCover game={entry.game} portrait className="h-[5.25rem] w-14 rounded-sm bg-gray-800" imgClassName="object-cover" />
    : <StoreCover appid={entry.appid} title={entry.title} className="h-[5.25rem] w-14 rounded-sm bg-gray-800 opacity-80 grayscale-[35%]" />;
  const titleClass = `sg-title ${done ? '!text-gray-400' : ''}`;

  return (
    <li className="sg-row" data-next={isNext ? 'true' : undefined}>
      <span className="sg-order" data-next={isNext ? 'true' : undefined}>{String(entry.order).padStart(2, '0')}</span>
      <span className="shrink-0">{cover}</span>
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {entry.game ? (
            <Link lang={language} to={`/game/${entry.game.appid}`} className={`${titleClass} after:absolute after:inset-0`}>{entry.title}</Link>
          ) : (
            <span lang={language} className={titleClass}>{entry.title}</span>
          )}
          {isNext && <span className="badge" data-tone="accent">{t('entry.next')}</span>}
        </span>
        <span className="sg-meta">
          <span className="num">{entry.year}</span>
          <span><span className="num">{formatNumber(entry.achievements)}</span> {t.plural('entry.achievements', entry.achievements)}</span>
          <span className="num">{formatHours(entry.hours)}</span>
          <DifficultyMeter value={entry.difficulty} />
        </span>
        <span className="sg-note block" lang={language}>{entry.note}</span>
        {entry.flags && entry.flags.length > 0 && (
          <span className="mt-2 flex flex-wrap gap-1.5">
            {entry.flags.map((flag) => (
              <span key={flag} className="badge" data-tone={FLAG_TONE[flag]}>{t(`flags.${flag}`)}</span>
            ))}
          </span>
        )}
      </span>
      <div className="sg-status relative z-10">
        <EntryStatusBlock entry={entry} />
        {entry.status === 'missing' && entry.priceBRL !== null && (
          <a
            href={steamStoreUrl(entry.appid)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold text-violet-400 transition-colors hover:text-violet-300"
          >
            {t('entry.viewOnSteam')} <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        )}
      </div>
    </li>
  );
}

function SagaView({ saga, meta, sagas }: { saga: SagaData; meta: SagaWithMeta['meta']; sagas: SagaData[] }) {
  const t = useT('saga');
  const { formatNumber, locale } = useI18n();
  const brl = useBrl();
  const formatHours = useHoursFormat();
  const language = contentLang(meta);
  const { games, loading } = useSteam();

  const steamGames = useMemo(() => {
    const map = new Map<string, Game>();
    for (const game of games) {
      if (game.platform === 'steam' && game.platformGameId) map.set(game.platformGameId, game);
    }
    return map;
  }, [games]);

  const phases = useMemo(() => {
    // Continuous numbering across phases: each phase offset is the sum of the previous ones.
    const offsets = saga.phases.map((_, index) =>
      saga.phases.slice(0, index).reduce((sum, phase) => sum + phase.entries.length, 0));
    return saga.phases.map((phase, phaseIndex) => ({
      ...phase,
      entries: phase.entries.map<ResolvedEntry>((entry, entryIndex) => {
        const game = steamGames.get(entry.appid) ?? null;
        return { ...entry, order: offsets[phaseIndex] + entryIndex + 1, game, ...statusOf(game) };
      }),
    }));
  }, [saga, steamGames]);

  const all = phases.flatMap((phase) => phase.entries);
  const done = all.filter((entry) => entry.status === 'done');
  const owned = all.filter((entry) => entry.game);
  const inProgress = all.filter((entry) => entry.status === 'progress');
  const missing = all.filter((entry) => entry.status === 'missing' && entry.priceBRL !== null && entry.priceBRL > 0);
  const cost = missing.reduce((sum, entry) => sum + (entry.priceBRL ?? 0), 0);
  const remaining = all
    .filter((entry) => entry.status !== 'done')
    .reduce<[number, number]>((sum, entry) => {
      const left = 1 - entry.percent / 100;
      return [sum[0] + entry.hours[0] * left, sum[1] + entry.hours[1] * left];
    }, [0, 0]);
  const next = all.find((entry) => entry.status !== 'done') ?? null;
  const percentDone = all.length > 0 ? Math.round((done.length / all.length) * 100) : 0;
  const [artFailed, setArtFailed] = useState(false);
  const heroGame = next?.game ?? owned.find((entry) => entry.game?.heroUrl)?.game ?? null;
  const heroArt = !artFailed && heroGame?.heroUrl ? heroGame.heroUrl : null;
  const outNumber = String(phases.length + 1).padStart(2, '0');

  return (
    <div className="page">
      <div className="tabs-bar">
        <nav className="subtabs" aria-label={t('chooseSaga')}>
          {sagas.map((item) => (
            <NavLink key={item.slug} to={`/sagas/${item.slug}`} className="subtab">{item.name}</NavLink>
          ))}
        </nav>
      </div>

      <section className="sg-banner" aria-labelledby="saga-title">
        {heroArt ? <img src={heroArt} alt="" onError={() => setArtFailed(true)} /> : <div className="sg-banner-fallback" />}
        <div className="min-w-0" lang={language}>
          <span className="sg-eyebrow">{t.plural('eyebrow', all.length)}</span>
          <h1 id="saga-title" className="mt-1">{saga.name}</h1>
          <p>{saga.tagline}</p>
        </div>
      </section>

      <Attribution
        className="-mt-3"
        publication={meta}
        extra={withSlots(t('priceChecked'), { date: <span className="num">{formatDayLong(saga.priceCheckedAt, locale)}</span> })}
      />

      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
        <p className="lede max-w-3xl">
          {withSlots(t('summary.platinated'), {
            done: <span className="num">{formatNumber(done.length)}</span>,
            total: <span className="num">{formatNumber(all.length)}</span>,
            owned: <span className="num">{formatNumber(owned.length)}</span>,
          })}
          {inProgress.length > 0 && <> {t('summary.inProgress', { count: formatNumber(inProgress.length) })}</>}
          {' · '}{withSlots(t('summary.remaining'), { hours: <span className="num">{formatHours(remaining)}</span> })}
          {missing.length > 0 && <> · {withSlots(t('summary.cost'), {
            cost: <span className="num">{brl(cost)}</span>,
            games: t.plural('summary.missingGames', missing.length),
            date: formatDayLong(saga.priceCheckedAt, locale),
          })}</>}
        </p>
        {next && (
          next.game ? (
            <Link to={`/game/${next.game.appid}`} className="btn btn-primary">{t('continue', { title: next.title })}</Link>
          ) : (
            <a href={steamStoreUrl(next.appid)} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
              {t('upNext', { title: next.title })} <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
          )
        )}
      </div>

      <div className="sg-progress" role="progressbar" aria-label={t('progressLabel')} aria-valuenow={percentDone} aria-valuemin={0} aria-valuemax={100}>
        <span className="sg-track"><span className="sg-fill" data-complete={percentDone === 100} style={{ width: `${percentDone}%` }} /></span>
        <span className="num text-sm font-semibold text-gray-100">{percentDone}%</span>
      </div>

      <section aria-label={t('method')}>
        <p className="micro">{t('method')}</p>
        <p className="lede mt-1 max-w-4xl" lang={language}>{saga.method}</p>
        {next && (
          <p className="mt-3 text-sm text-gray-300">
            {withSlots(t(next.status === 'missing' ? 'queue.nextMissing' : 'queue.next'), {
              entry: <span className="font-semibold text-violet-400"><span className="num">#{String(next.order).padStart(2, '0')}</span> <span lang={language}>{next.title}</span></span>,
            })}
          </p>
        )}
      </section>

      {phases.map((phase, index) => {
        const phaseDone = phase.entries.filter((entry) => entry.status === 'done').length;
        const phasePercent = Math.round((phaseDone / phase.entries.length) * 100);
        return (
          <section key={phase.id} aria-labelledby={`phase-${phase.id}`}>
            <SectionHead className="sh-wrap"
              number={String(index + 1).padStart(2, '0')}
              title={<span id={`phase-${phase.id}`}>{withSlots(t('phase.title', { number: index + 1 }), { title: <span lang={language}>{phase.title}</span> })}</span>}
              action={
                <span className="sg-progress w-44 sm:w-56" role="progressbar" aria-label={t('phase.progress', { number: index + 1 })} aria-valuenow={phasePercent} aria-valuemin={0} aria-valuemax={100}>
                  <span className="sg-track"><span className="sg-fill" data-complete={phasePercent === 100} style={{ width: `${phasePercent}%` }} /></span>
                  <span className="num whitespace-nowrap text-xs text-gray-400">{phaseDone}/{phase.entries.length}</span>
                </span>
              }
            />
            <p className="lede -mt-1 mb-3 max-w-3xl" lang={language}>{phase.summary}</p>
            {loading ? (
              <div className="space-y-2">
                {phase.entries.map((entry) => <div key={entry.appid} className="h-20 animate-pulse rounded-sm bg-gray-900" />)}
              </div>
            ) : (
              <ol>
                {phase.entries.map((entry) => (
                  <EntryRow key={entry.appid} entry={entry} isNext={next?.appid === entry.appid} language={language} />
                ))}
              </ol>
            )}
          </section>
        );
      })}

      {saga.outOfScope.length > 0 && (
        <section aria-labelledby="saga-out">
          <SectionHead className="sh-wrap" number={outNumber} title={<span id="saga-out">{t('outOfScope.title')}</span>} sub={t('outOfScope.subtitle')} />
          <ul className="grid gap-x-10 sm:grid-cols-2">
            {saga.outOfScope.map((item) => (
              <li key={item.appid} className="border-b border-gray-800 py-3 text-sm" lang={language}>
                <a href={steamStoreUrl(item.appid)} target="_blank" rel="noopener noreferrer" className="font-display font-bold text-gray-200 hover:text-violet-400">
                  {item.title}
                </a>
                <span className="block text-xs text-gray-500">{item.reason}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export default function Saga() {
  const t = useT('saga');
  const { slug } = useParams();
  const { items, loading, error } = useSagas();

  if (loading) {
    return (
      <div className="page" aria-busy="true">
        <div className="h-28 animate-pulse rounded-sm bg-gray-850" />
        <div className="h-4 w-2/3 animate-pulse rounded-sm bg-gray-850" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="page">
        <div className="empty-state" role="alert">
          <strong>{t('error.title')}</strong>
          <span className="text-zk-danger">{error}</span>
          <button type="button" className="btn btn-secondary" onClick={() => window.location.reload()}>{t('error.retry')}</button>
        </div>
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="page">
        <div className="empty-state">
          <strong>{t('empty.title')}</strong>
          <span><RichText text={t('empty.body')} codeClassName="" /></span>
          <Link to="/comunidade" className="btn btn-primary">{t('empty.link')}</Link>
        </div>
      </div>
    );
  }

  const current = items.find((item) => item.saga.slug === slug);
  if (!current) return <Navigate to={`/sagas/${items[0].saga.slug}`} replace />;
  return <SagaView key={current.saga.slug} saga={current.saga} meta={current.meta} sagas={items.map((item) => item.saga)} />;
}

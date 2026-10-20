import { useMemo, useState } from 'react';
import { Link, Navigate, NavLink, useParams } from 'react-router-dom';
import { ArrowRight, Ban, Check, Clock3, Compass, ExternalLink, Play, ScrollText, Trophy, TriangleAlert, Wifi } from 'lucide-react';
import { GameCover } from '../components/GameCover';
import { ProgressBar, completionTextColor } from '../components/ProgressBar';
import { useSteam } from '../context/SteamContext';
import {
  DIFFICULTY_LABEL,
  FLAG_LABEL,
  PRICE_CHECKED_AT,
  SAGAS,
  steamPortraitUrls,
  steamStoreUrl,
  type Saga as SagaData,
  type SagaEntry,
  type SagaFlag,
} from '../data/sagas';
import type { Game } from '../types/steam';

type EntryStatus = 'done' | 'progress' | 'owned' | 'missing';

interface ResolvedEntry extends SagaEntry {
  order: number;
  game: Game | null;
  status: EntryStatus;
  percent: number;
}

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const FLAG_ICON: Record<SagaFlag, typeof Wifi> = {
  online: Wifi,
  missable: TriangleAlert,
  legacy: Ban,
};

const FLAG_TONE: Record<SagaFlag, string> = {
  online: 'text-sky-300 ring-sky-400/30',
  missable: 'text-amber-300 ring-amber-400/30',
  legacy: 'text-gray-400 ring-gray-700',
};

function statusOf(game: Game | null): { status: EntryStatus; percent: number } {
  if (!game) return { status: 'missing', percent: 0 };
  const percent = game.completion?.percent ?? 0;
  if (percent >= 100) return { status: 'done', percent };
  if (percent > 0) return { status: 'progress', percent };
  return { status: 'owned', percent };
}

function formatHours([min, max]: [number, number]) {
  const lo = Math.round(min);
  const hi = Math.round(max);
  return lo === hi ? `${lo}h` : `${lo}–${hi}h`;
}

function formatPrice(price: number | null) {
  if (price === null) return 'Fora de venda';
  if (price === 0) return 'Gratuito';
  return brl.format(price);
}

/** Capa vertical direto do CDN da Steam para jogos que não estão na biblioteca. */
function StoreCover({ appid, title, className }: { appid: string; title: string; className: string }) {
  const srcs = useMemo(() => steamPortraitUrls(appid), [appid]);
  const [index, setIndex] = useState(0);

  if (index >= srcs.length) {
    return (
      <div className={`${className} grid place-items-center bg-gray-800 p-1 text-center text-[9px] font-bold leading-tight text-gray-500`}>
        {title}
      </div>
    );
  }

  return (
    <img
      key={srcs[index]}
      src={srcs[index]}
      alt=""
      loading="lazy"
      onError={() => setIndex((current) => current + 1)}
      className={`${className} object-cover`}
    />
  );
}

function DifficultyMeter({ value }: { value: SagaEntry['difficulty'] }) {
  return (
    <span className="inline-flex items-center gap-1.5" title={`Dificuldade da platina: ${DIFFICULTY_LABEL[value]}`}>
      <span className="flex gap-0.5" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((step) => (
          <span
            key={step}
            className={`h-2.5 w-1 rounded-[1px] ${step <= value ? (value >= 5 ? 'bg-red-400' : value >= 4 ? 'bg-orange-400' : 'bg-violet-400') : 'bg-gray-800'}`}
          />
        ))}
      </span>
      <span>{DIFFICULTY_LABEL[value]}</span>
    </span>
  );
}

function EntryStatusBlock({ entry }: { entry: ResolvedEntry }) {
  if (entry.status === 'done') {
    return (
      <span className="flex items-center justify-end gap-1.5 text-sm font-bold text-yellow-400">
        <Trophy className="h-4 w-4" /> 100%
      </span>
    );
  }

  if (entry.status === 'progress' || entry.status === 'owned') {
    return (
      <span className="block w-full">
        <span className="mb-1.5 flex items-center justify-between text-[11px]">
          <span className="text-gray-500">{entry.status === 'owned' ? 'Na biblioteca' : 'Em andamento'}</span>
          <span className={`font-mono font-bold ${completionTextColor(entry.percent)}`}>{entry.percent}%</span>
        </span>
        <ProgressBar percent={entry.percent} height="h-1.5" />
      </span>
    );
  }

  return (
    <span className="flex flex-col items-end gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Não adquirido</span>
      <span className="font-mono text-sm font-bold text-gray-200">{formatPrice(entry.priceBRL)}</span>
    </span>
  );
}

function EntryRow({ entry, isNext }: { entry: ResolvedEntry; isNext: boolean }) {
  const done = entry.status === 'done';
  const cover = entry.game
    ? <GameCover game={entry.game} portrait className="h-[5.25rem] w-14 rounded-md bg-gray-800" imgClassName="object-cover" />
    : <StoreCover appid={entry.appid} title={entry.title} className="h-[5.25rem] w-14 rounded-md bg-gray-800 opacity-80 grayscale-[35%]" />;

  const body = (
    <>
      <span className={`font-mono text-sm font-bold tabular-nums ${isNext ? 'text-violet-300' : done ? 'text-gray-700' : 'text-gray-500'}`}>
        {String(entry.order).padStart(2, '0')}
      </span>
      <span className="relative shrink-0">
        {cover}
        {done && (
          <span className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-yellow-400 text-gray-950 ring-2 ring-gray-900">
            <Check className="h-3 w-3" strokeWidth={3} />
          </span>
        )}
      </span>
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className={`text-sm font-bold sm:text-[15px] ${done ? 'text-gray-400' : 'text-gray-100'}`}>{entry.title}</span>
          {isNext && (
            <span className="rounded-sm bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-300 ring-1 ring-inset ring-violet-500/30">
              Próximo
            </span>
          )}
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-500">
          <span>{entry.year}</span>
          <span>{entry.achievements} conquistas</span>
          <span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" /> {formatHours(entry.hours)}</span>
          <DifficultyMeter value={entry.difficulty} />
        </span>
        <span className={`mt-1.5 block text-xs leading-relaxed ${done ? 'text-gray-600' : 'text-gray-400'}`}>{entry.note}</span>
        {entry.flags && entry.flags.length > 0 && (
          <span className="mt-2 flex flex-wrap gap-1.5">
            {entry.flags.map((flag) => {
              const Icon = FLAG_ICON[flag];
              return (
                <span key={flag} className={`inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${FLAG_TONE[flag]}`}>
                  <Icon className="h-3 w-3" /> {FLAG_LABEL[flag]}
                </span>
              );
            })}
          </span>
        )}
      </span>
    </>
  );

  const grid = 'grid grid-cols-[1.75rem_3.5rem_minmax(0,1fr)] items-start gap-3 sm:gap-4';

  return (
    <li className={`list-surface-row flex-col items-stretch gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5 ${isNext ? 'bg-violet-500/[0.07]' : ''}`}>
      {entry.game ? (
        <Link to={`/game/${entry.game.appid}`} className={`group flex-1 ${grid} rounded-md`}>
          {body}
        </Link>
      ) : (
        <div className={`flex-1 ${grid}`}>{body}</div>
      )}
      <div className="flex shrink-0 items-center gap-3 pl-[calc(1.75rem+3.5rem+1.5rem)] sm:w-44 sm:flex-col sm:items-end sm:pl-0">
        <EntryStatusBlock entry={entry} />
        {entry.status === 'missing' && entry.priceBRL !== null && (
          <a
            href={steamStoreUrl(entry.appid)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold text-violet-300 transition-colors hover:text-violet-200"
          >
            Ver na Steam <ExternalLink className="h-3 w-3" />
          </a>
        )}
        {entry.game && (
          <Link to={`/game/${entry.game.appid}`} className="hidden items-center gap-1 text-xs font-semibold text-gray-500 transition-colors hover:text-violet-300 sm:inline-flex">
            Abrir jogo <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
    </li>
  );
}

function SummaryStat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="stat-tile">
      <span className="stat-tile-label">{label}</span>
      <span className="stat-tile-value text-gray-100">{value}</span>
      {hint && <span className="stat-tile-hint truncate">{hint}</span>}
    </div>
  );
}
function SagaView({ saga }: { saga: SagaData }) {
  const { games, loading } = useSteam();

  const steamGames = useMemo(() => {
    const map = new Map<string, Game>();
    for (const game of games) {
      if (game.platform === 'steam' && game.platformGameId) map.set(game.platformGameId, game);
    }
    return map;
  }, [games]);

  const phases = useMemo(() => {
    // Numeração contínua entre fases: o offset de cada fase é a soma das anteriores.
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


  return (
    <div className="page">
      <div className="tabs-bar">
        <nav className="subtabs" aria-label="Escolher saga">
          <span className="page-eyebrow mr-2"><ScrollText className="h-3.5 w-3.5" aria-hidden="true" /> Sagas</span>
          {SAGAS.map((item) => (
            <NavLink key={item.slug} to={`/sagas/${item.slug}`} className="subtab">{item.name}</NavLink>
          ))}
        </nav>
      </div>

      <section className="game-hero saga-hero" aria-labelledby="saga-title">
        {heroArt ? <img src={heroArt} alt="" onError={() => setArtFailed(true)} /> : <div className="game-hero-fallback" />}
        <div className="game-hero-body">
          <div className="min-w-0 flex-1">
            <span className="spotlight-eyebrow">Saga · {all.length} jogos</span>
            <h1 id="saga-title" className="game-hero-title mt-2">{saga.name}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/80">{saga.tagline}</p>
            <div className="mt-4 flex max-w-md items-center gap-3">
              <span className="game-card-meter-track h-1.5" role="progressbar" aria-label="Platinas da saga" aria-valuenow={percentDone} aria-valuemin={0} aria-valuemax={100}>
                <span className="game-card-meter-fill" data-complete={percentDone === 100} style={{ width: `${percentDone}%` }} />
              </span>
              <span className="whitespace-nowrap text-sm font-semibold tabular-nums">{done.length}/{all.length} platinados</span>
            </div>
            {next && (
              <div className="spotlight-actions">
                {next.game ? (
                  <Link to={`/game/${next.game.appid}`} className="btn btn-primary btn-lg">
                    <Play className="h-4 w-4" fill="currentColor" aria-hidden="true" /> Continuar: {next.title}
                  </Link>
                ) : (
                  <a href={steamStoreUrl(next.appid)} target="_blank" rel="noreferrer" className="btn btn-primary btn-lg">
                    Próximo: {next.title} <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="stat-strip stat-strip-4">
        <SummaryStat label="Platinados" value={`${done.length}/${all.length}`} hint={`${percentDone}% da saga`} />
        <SummaryStat label="Na biblioteca" value={String(owned.length)} hint={inProgress.length > 0 ? `${inProgress.length} em andamento` : 'nenhum em andamento'} />
        <SummaryStat label="Horas restantes" value={`~${Math.round(remaining[0])}–${Math.round(remaining[1])}h`} hint="estimativa da lista inteira" />
        <SummaryStat label="Para completar a coleção" value={brl.format(cost)} hint={`${missing.length} jogos · preço cheio em ${PRICE_CHECKED_AT.split('-').reverse().join('/')}`} />
      </div>

      <section className="surface surface-pad">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-100">
          <Compass className="h-4 w-4 text-violet-400" aria-hidden="true" /> Como a ordem foi montada
        </h2>
        <p className="mt-1.5 max-w-4xl text-sm leading-relaxed text-gray-400">{saga.method}</p>
        {next && (
          <p className="mt-3 text-sm text-gray-300">
            Próximo da fila: <span className="font-semibold text-violet-400">#{String(next.order).padStart(2, '0')} {next.title}</span>
            {next.status === 'missing' ? ' — ainda não está na sua conta.' : '.'}
          </p>
        )}
      </section>

      {phases.map((phase, index) => {
        const phaseDone = phase.entries.filter((entry) => entry.status === 'done').length;
        return (
          <section key={phase.id} aria-labelledby={`phase-${phase.id}`}>
            <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold text-violet-400">Fase {index + 1}</p>
                <h2 id={`phase-${phase.id}`} className="mt-0.5 text-lg font-semibold text-gray-100">{phase.title}</h2>
                <p className="mt-1 max-w-3xl text-sm leading-relaxed text-gray-500">{phase.summary}</p>
              </div>
              <span className="chip shrink-0 self-start sm:self-end">{phaseDone}/{phase.entries.length} platinados</span>
            </div>
            {loading ? (
              <div className="space-y-2">
                {phase.entries.map((entry) => <div key={entry.appid} className="h-20 animate-pulse rounded-lg bg-gray-900" />)}
              </div>
            ) : (
              <ol className="list-surface">
                {phase.entries.map((entry) => (
                  <EntryRow key={entry.appid} entry={entry} isNext={next?.appid === entry.appid} />
                ))}
              </ol>
            )}
          </section>
        );
      })}

      {saga.outOfScope.length > 0 && (
        <section className="rounded-xl border border-dashed border-gray-800 px-5 py-4">
          <h2 className="text-sm font-semibold text-gray-200">Na Steam, mas fora da conta</h2>
          <p className="mt-0.5 text-xs text-gray-500">Existem na loja, mas hoje não dá para platinar.</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {saga.outOfScope.map((item) => (
              <li key={item.appid} className="flex items-start gap-3 text-sm">
                <Ban className="mt-0.5 h-4 w-4 shrink-0 text-gray-600" aria-hidden="true" />
                <span>
                  <a href={steamStoreUrl(item.appid)} target="_blank" rel="noreferrer" className="font-semibold text-gray-300 hover:text-violet-400">
                    {item.title}
                  </a>
                  <span className="block text-xs text-gray-500">{item.reason}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export default function Saga() {
  const { slug } = useParams();
  const saga = SAGAS.find((item) => item.slug === slug);
  if (!saga) return <Navigate to={`/sagas/${SAGAS[0].slug}`} replace />;
  return <SagaView key={saga.slug} saga={saga} />;
}

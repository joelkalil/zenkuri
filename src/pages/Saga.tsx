import { useMemo, useState } from 'react';
import { Link, Navigate, NavLink, useParams } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { GameCover } from '../components/GameCover';
import { SectionHead } from '../components/SectionHead';
import { Stamp } from '../components/Stamp';
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
import '../styles/sagas.css';

type EntryStatus = 'done' | 'progress' | 'owned' | 'missing';

interface ResolvedEntry extends SagaEntry {
  order: number;
  game: Game | null;
  status: EntryStatus;
  percent: number;
}

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

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

function formatHours([min, max]: [number, number]) {
  const lo = Math.round(min);
  const hi = Math.round(max);
  return lo === hi ? `${lo} h` : `${lo}–${hi} h`;
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
      <div className={`${className} grid place-items-center bg-gray-800 p-1 text-center font-display text-[9px] font-bold leading-tight text-gray-500`}>
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
  const tone = value >= 5 ? 'bg-zk-danger' : value >= 4 ? 'bg-zk-gold' : 'bg-gray-400';
  return (
    <span className="inline-flex items-center gap-1.5" title={`Dificuldade da platina: ${DIFFICULTY_LABEL[value]}`}>
      <span className="flex gap-0.5" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((step) => (
          <span key={step} className={`h-2.5 w-1 rounded-[1px] ${step <= value ? tone : 'bg-gray-800'}`} />
        ))}
      </span>
      <span>Dificuldade {DIFFICULTY_LABEL[value].toLowerCase()}</span>
    </span>
  );
}

function EntryStatusBlock({ entry }: { entry: ResolvedEntry }) {
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
          <span className="text-gray-500">{entry.status === 'owned' ? 'Na biblioteca' : 'Em andamento'}</span>
          <span className="num font-semibold text-gray-200">{entry.percent}%</span>
        </span>
        <span className="sg-track" role="progressbar" aria-label={`Progresso de ${entry.title}`} aria-valuenow={entry.percent} aria-valuemin={0} aria-valuemax={100}>
          <span className="sg-fill" style={{ width: `${entry.percent}%` }} />
        </span>
      </span>
    );
  }

  return (
    <span className="flex flex-col items-end gap-0.5">
      <span className="micro">Não adquirido</span>
      <span className="num text-sm font-semibold text-gray-200">{formatPrice(entry.priceBRL)}</span>
    </span>
  );
}

function EntryRow({ entry, isNext }: { entry: ResolvedEntry; isNext: boolean }) {
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
            <Link to={`/game/${entry.game.appid}`} className={`${titleClass} after:absolute after:inset-0`}>{entry.title}</Link>
          ) : (
            <span className={titleClass}>{entry.title}</span>
          )}
          {isNext && <span className="badge" data-tone="accent">Próximo</span>}
        </span>
        <span className="sg-meta">
          <span className="num">{entry.year}</span>
          <span><span className="num">{entry.achievements}</span> conquistas</span>
          <span className="num">{formatHours(entry.hours)}</span>
          <DifficultyMeter value={entry.difficulty} />
        </span>
        <span className="sg-note block">{entry.note}</span>
        {entry.flags && entry.flags.length > 0 && (
          <span className="mt-2 flex flex-wrap gap-1.5">
            {entry.flags.map((flag) => (
              <span key={flag} className="badge" data-tone={FLAG_TONE[flag]}>{FLAG_LABEL[flag]}</span>
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
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold text-violet-400 transition-colors hover:text-violet-300"
          >
            Ver na Steam <ExternalLink className="h-3 w-3" aria-hidden="true" />
          </a>
        )}
      </div>
    </li>
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
  const outNumber = String(phases.length + 1).padStart(2, '0');

  return (
    <div className="page">
      <div className="tabs-bar">
        <nav className="subtabs" aria-label="Escolher saga">
          {SAGAS.map((item) => (
            <NavLink key={item.slug} to={`/sagas/${item.slug}`} className="subtab">{item.name}</NavLink>
          ))}
        </nav>
      </div>

      <section className="sg-banner" aria-labelledby="saga-title">
        {heroArt ? <img src={heroArt} alt="" onError={() => setArtFailed(true)} /> : <div className="sg-banner-fallback" />}
        <div className="min-w-0">
          <span className="sg-eyebrow">Saga · {all.length} jogos</span>
          <h1 id="saga-title" className="mt-1">{saga.name}</h1>
          <p>{saga.tagline}</p>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
        <p className="lede max-w-3xl">
          <span className="num">{done.length}</span> de <span className="num">{all.length}</span> platinados · <span className="num">{owned.length}</span> na biblioteca
          {inProgress.length > 0 && <> ({inProgress.length} em andamento)</>}
          {' · '}~<span className="num">{Math.round(remaining[0])}–{Math.round(remaining[1])} h</span> restantes
          {missing.length > 0 && <> · <span className="num">{brl.format(cost)}</span> para completar a coleção ({missing.length} {missing.length === 1 ? 'jogo' : 'jogos'}, preço cheio em {PRICE_CHECKED_AT.split('-').reverse().join('/')})</>}
        </p>
        {next && (
          next.game ? (
            <Link to={`/game/${next.game.appid}`} className="btn btn-primary">Continuar: {next.title}</Link>
          ) : (
            <a href={steamStoreUrl(next.appid)} target="_blank" rel="noreferrer" className="btn btn-primary">
              Próximo: {next.title} <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
          )
        )}
      </div>

      <div className="sg-progress" role="progressbar" aria-label="Platinas da saga" aria-valuenow={percentDone} aria-valuemin={0} aria-valuemax={100}>
        <span className="sg-track"><span className="sg-fill" data-complete={percentDone === 100} style={{ width: `${percentDone}%` }} /></span>
        <span className="num text-sm font-semibold text-gray-100">{percentDone}%</span>
      </div>

      <section aria-label="Como a ordem foi montada">
        <p className="micro">Como a ordem foi montada</p>
        <p className="lede mt-1 max-w-4xl">{saga.method}</p>
        {next && (
          <p className="mt-3 text-sm text-gray-300">
            Próximo da fila: <span className="font-semibold text-violet-400"><span className="num">#{String(next.order).padStart(2, '0')}</span> {next.title}</span>
            {next.status === 'missing' ? ', ainda não está na sua conta.' : '.'}
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
              title={<span id={`phase-${phase.id}`}>Fase {index + 1}: {phase.title}</span>}
              action={
                <span className="sg-progress w-44 sm:w-56" role="progressbar" aria-label={`Progresso da fase ${index + 1}`} aria-valuenow={phasePercent} aria-valuemin={0} aria-valuemax={100}>
                  <span className="sg-track"><span className="sg-fill" data-complete={phasePercent === 100} style={{ width: `${phasePercent}%` }} /></span>
                  <span className="num whitespace-nowrap text-xs text-gray-400">{phaseDone}/{phase.entries.length}</span>
                </span>
              }
            />
            <p className="lede -mt-1 mb-3 max-w-3xl">{phase.summary}</p>
            {loading ? (
              <div className="space-y-2">
                {phase.entries.map((entry) => <div key={entry.appid} className="h-20 animate-pulse rounded-sm bg-gray-900" />)}
              </div>
            ) : (
              <ol>
                {phase.entries.map((entry) => (
                  <EntryRow key={entry.appid} entry={entry} isNext={next?.appid === entry.appid} />
                ))}
              </ol>
            )}
          </section>
        );
      })}

      {saga.outOfScope.length > 0 && (
        <section aria-labelledby="saga-out">
          <SectionHead className="sh-wrap" number={outNumber} title={<span id="saga-out">Na Steam, fora da sua conta</span>} sub="Existem na loja, mas hoje não dá para platinar." />
          <ul className="grid gap-x-10 sm:grid-cols-2">
            {saga.outOfScope.map((item) => (
              <li key={item.appid} className="border-b border-gray-800 py-3 text-sm">
                <a href={steamStoreUrl(item.appid)} target="_blank" rel="noreferrer" className="font-display font-bold text-gray-200 hover:text-violet-400">
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
  const { slug } = useParams();
  const saga = SAGAS.find((item) => item.slug === slug);
  if (!saga) return <Navigate to={`/sagas/${SAGAS[0].slug}`} replace />;
  return <SagaView key={saga.slug} saga={saga} />;
}

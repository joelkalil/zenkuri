import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { fetchPlatformLevels, type LevelSlice, type PlatformLevel, type UserLevel } from '../lib/api';
import { PLATFORM_META } from '../lib/platforms';
import type { Platform } from '../types/steam';
import { formatXp, tierStyle } from './LevelBadge';

const n = (value: number) => value.toLocaleString('pt-BR');

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

/** Uma linha da composição: rótulo, conquistas, XP e a fatia do total. */
function SliceRow({ slice, totalXp, barClass }: { slice: LevelSlice; totalXp: number; barClass: string }) {
  const share = totalXp > 0 ? Math.round((slice.xp / totalXp) * 100) : 0;
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-1.5">
      <span className="truncate text-sm text-gray-200">{slice.label}</span>
      <span className="text-xs tabular-nums text-gray-500">
        {n(slice.achievements)} · <span className="text-gray-300">{formatXp(slice.xp)} XP</span>
      </span>
      <span className="col-span-2"><Bar percent={share} className={barClass} /></span>
    </li>
  );
}

/**
 * Nível Zenkuri em detalhe: número, progresso e de onde veio o XP.
 * Vive em Ajustes → Nível; o header mostra só o resumo (LevelChip).
 */
export function LevelPanel({ level }: { level: UserLevel }) {
  const style = tierStyle(level.tier.key);
  const remaining = Math.max(0, level.xpForNextLevel - level.xpIntoLevel);
  const isEmpty = level.counts.achievements === 0;

  return (
    <section aria-labelledby="zenkuri-level" className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
      <div>
        <h3 id="zenkuri-level" className="micro">Nível Zenkuri</h3>
        <p className="mt-3 flex items-baseline gap-3">
          <span className="font-display text-5xl font-black leading-none tabular-nums tracking-tight text-gray-100">{level.level}</span>
          <span className={`text-base font-medium ${style.text}`}>{level.tier.label}</span>
        </p>
        <div className="mt-5">
          <Bar percent={level.progressPercent} className={style.bar} label={`Progresso para o nível ${level.level + 1}`} />
        </div>
        <p className="mt-2.5 text-sm text-gray-500">
          {isEmpty
            ? 'Sincronize uma plataforma para começar a acumular XP.'
            : <>
                <span className="tabular-nums text-gray-300">{formatXp(level.xpIntoLevel)}</span> de {formatXp(level.xpForNextLevel)} XP no nível.
                Faltam <span className="tabular-nums text-gray-300">{formatXp(remaining)}</span> para o {level.level + 1}
                {level.nextTier ? <>; <span className={tierStyle(level.nextTier.key).text}>{level.nextTier.label}</span> chega no {level.nextTier.minLevel}</> : null}.
              </>}
        </p>
        {!isEmpty && (
          <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-gray-800 pt-5 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
            {[
              ['XP total', formatXp(level.xp)],
              ['Conquistas', n(level.counts.achievements)],
              ['Raras (<10%)', n(level.counts.rare)],
              ['Platinas', n(level.counts.platinums)],
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
            <h3 className="text-sm font-semibold text-gray-300">XP por plataforma</h3>
            <ul className="mt-4 space-y-4">
              {level.breakdown.platforms.map((slice) => (
                <SliceRow key={slice.key} slice={slice} totalXp={level.xp} barClass="bg-violet-500" />
              ))}
            </ul>
            {level.breakdown.bonusXp > 0 && (
              <p className="mt-4 text-xs text-gray-500">
                Inclui {formatXp(level.breakdown.bonusXp)} XP de bônus por {n(level.counts.perfects)} jogos em 100%.
              </p>
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-300">XP por raridade</h3>
            <ul className="mt-4 space-y-4">
              {level.breakdown.rarity.map((slice) => (
                <SliceRow key={slice.key} slice={slice} totalXp={level.xp} barClass="bg-zk-gold" />
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
  ['platinum', 'Platina', '/trophies/platinum.png'],
  ['gold', 'Ouro', '/trophies/gold.png'],
  ['silver', 'Prata', '/trophies/silver.png'],
  ['bronze', 'Bronze', '/trophies/bronze.png'],
] as const;

function PlatformBody({ item, onOpenConnections }: { item: PlatformLevel; onOpenConnections: () => void }) {
  if (item.status === 'unlinked') {
    return (
      <div className="mt-4 text-sm text-gray-500">
        <p>Conta não vinculada.</p>
        <button onClick={onOpenConnections} className="mt-2 min-h-10 font-medium text-violet-400 hover:text-violet-300">Vincular em Conexões</button>
      </div>
    );
  }

  if (item.status === 'error') {
    return <p className="mt-4 text-sm leading-relaxed text-zk-danger">{item.message}</p>;
  }

  if (item.platform === 'steam') {
    const toNext = Math.max(0, item.xpForNextLevel - item.xpIntoLevel);
    return (
      <>
        <p className="mt-4 flex items-baseline gap-2">
          <span className="font-display text-4xl font-black leading-none tabular-nums tracking-tight text-gray-100">{n(item.level)}</span>
          <span className="text-sm text-gray-500">nível Steam</span>
        </p>
        <div className="mt-4"><Bar percent={item.progressPercent} className="bg-violet-500" label={`Progresso para o nível Steam ${item.level + 1}`} /></div>
        <p className="mt-2.5 text-sm text-gray-500">
          <span className="tabular-nums text-gray-300">{n(item.xp)}</span> XP · faltam <span className="tabular-nums text-gray-300">{n(toNext)}</span> para o {item.level + 1}
        </p>
      </>
    );
  }

  if (item.platform === 'psn') {
    return (
      <>
        <p className="mt-4 flex items-baseline gap-2">
          <span className="font-display text-4xl font-black leading-none tabular-nums tracking-tight text-gray-100">{n(item.level)}</span>
          <span className="text-sm text-gray-500">nível de troféus · {item.grade}</span>
        </p>
        <div className="mt-4"><Bar percent={item.progressPercent} className="bg-zk-platinum" label={`Progresso para o nível PSN ${item.level + 1}`} /></div>
        <p className="mt-2.5 text-sm text-gray-500"><span className="tabular-nums text-gray-300">{item.progressPercent}%</span> até o {item.level + 1}</p>
        <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
          {PSN_TROPHIES.map(([key, label, icon]) => (
            <li key={key} className="flex items-center gap-1.5 text-sm tabular-nums text-gray-300" title={label}>
              <img src={icon} alt="" className="h-4 w-4 object-contain" />
              {n(item.trophies[key])}<span className="sr-only"> {label}</span>
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
          <span className="text-sm text-gray-500">pontos hardcore</span>
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div>
            <dt className="text-xs text-gray-500">Rank</dt>
            <dd className="mt-0.5 tabular-nums text-gray-200">
              {item.rank ? <>#{n(item.rank)}{item.totalRanked ? <span className="text-gray-500"> de {n(item.totalRanked)}</span> : null}</> : 'Sem rank'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">True points</dt>
            <dd className="mt-0.5 tabular-nums text-gray-200">{n(item.truePoints)}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Softcore</dt>
            <dd className="mt-0.5 tabular-nums text-gray-200">{n(item.softcorePoints)}</dd>
          </div>
          {item.rank && item.totalRanked ? (
            <div>
              <dt className="text-xs text-gray-500">Topo</dt>
              <dd className="mt-0.5 tabular-nums text-gray-200">{Math.max(0.1, (item.rank / item.totalRanked) * 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%</dd>
            </div>
          ) : null}
        </dl>
      </>
    );
  }

  return null;
}

/** Nível que cada plataforma mostra no próprio perfil, lado a lado. */
export function PlatformLevels({ onOpenConnections }: { onOpenConnections: () => void }) {
  const [items, setItems] = useState<PlatformLevel[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState<string | null>(null);

  const load = useCallback((fresh: boolean) => {
    setLoading(true);
    setFailed(null);
    fetchPlatformLevels(fresh)
      .then(setItems)
      .catch((err) => setFailed(err instanceof Error ? err.message : 'Falha ao consultar as plataformas.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(false); }, [load]);

  const byPlatform = new Map(items?.map((item) => [item.platform, item]));

  return (
    <section aria-labelledby="platform-levels" className="border-t border-gray-800 pt-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 id="platform-levels" className="micro">Nas plataformas</h3>
          <p className="mt-1 text-sm text-gray-500">O que cada perfil mostra hoje, consultado direto na Steam, PSN e RetroAchievements.</p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={loading}
          className="flex min-h-10 items-center gap-2 rounded px-3 text-sm font-medium text-gray-400 transition-colors hover:bg-gray-850 hover:text-gray-100 disabled:cursor-progress disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
          {loading ? 'Consultando…' : 'Consultar de novo'}
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

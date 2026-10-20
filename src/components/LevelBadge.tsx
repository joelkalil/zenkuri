import { Link } from 'react-router-dom';
import type { UserLevel } from '../lib/api';

/*
  Estilo por faixa. Fica no cliente (e não no servidor) porque o Tailwind precisa
  das classes escritas por extenso, e porque o acento `violet-*` é o token de
  destaque do tema — assim a faixa acompanha Neo Mirai, Steam, PSNProfiles etc.
  A faixa nunca é comunicada só por cor: o nome dela aparece sempre ao lado.
*/
const TIER_STYLE: Record<string, { text: string; ring: string; bar: string }> = {
  alvorada: { text: 'text-gray-400', ring: 'ring-gray-700', bar: 'bg-gray-500' },
  aurora: { text: 'text-violet-300', ring: 'ring-violet-500/30', bar: 'bg-violet-300' },
  peregrino: { text: 'text-violet-300', ring: 'ring-violet-500/40', bar: 'bg-violet-400' },
  artesao: { text: 'text-violet-400', ring: 'ring-violet-500/40', bar: 'bg-violet-400' },
  veterano: { text: 'text-violet-400', ring: 'ring-violet-500/60', bar: 'bg-violet-500' },
  mestre: { text: 'text-violet-400', ring: 'ring-violet-500/70', bar: 'bg-violet-500' },
  sensei: { text: 'text-amber-400', ring: 'ring-amber-400/60', bar: 'bg-amber-400' },
  lenda: { text: 'text-amber-300', ring: 'ring-amber-300/70', bar: 'bg-amber-300' },
};

export function tierStyle(tierKey: string) {
  return TIER_STYLE[tierKey] ?? TIER_STYLE.alvorada;
}

export function formatXp(xp: number) {
  return xp.toLocaleString('pt-BR');
}

/**
 * Selo de nível da Sidebar. Na versão recolhida vira só o número, com o resto
 * no `title`; expandida, mostra faixa, nível e uma barra fina de XP.
 */
export function LevelBadge({ level, compact = false }: { level: UserLevel; compact?: boolean }) {
  const style = tierStyle(level.tier.key);
  const caption = `Nível ${level.level} · ${level.tier.label} · ${formatXp(level.xp)} XP`;

  if (compact) {
    return (
      <div
        title={caption}
        className={`mx-auto grid h-10 w-10 place-items-center rounded-xl bg-gray-900 text-[13px] font-bold tabular-nums ring-1 ${style.ring} ${style.text}`}
      >
        {level.level}
      </div>
    );
  }

  return (
    <div className="space-y-1.5" title={caption}>
      <div className="flex items-baseline justify-between gap-2">
        <span className={`font-display text-[11px] font-semibold uppercase tracking-[0.14em] ${style.text}`}>
          {level.tier.label}
        </span>
        <span className="text-[11px] font-semibold tabular-nums text-gray-500">Nv {level.level}</span>
      </div>
      <div
        className="h-1 overflow-hidden rounded-full bg-gray-800"
        role="progressbar"
        aria-valuenow={level.progressPercent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Progresso para o nível ${level.level + 1}`}
      >
        <div className={`h-full rounded-full ${style.bar} transition-[width] duration-500`} style={{ width: `${level.progressPercent}%` }} />
      </div>
    </div>
  );
}

/**
 * Nível no header, entre Sincronizar e o avatar. Número e faixa num link só;
 * a barra de 2px embaixo é o progresso para o próximo nível. O detalhe (XP,
 * composição e níveis das plataformas) fica em Ajustes → Nível.
 */
export function LevelChip({ level }: { level: UserLevel }) {
  const style = tierStyle(level.tier.key);
  const label = `Nível ${level.level}, ${level.tier.label}. ${level.progressPercent}% até o nível ${level.level + 1}. Ver detalhes do nível`;

  return (
    <Link to="/settings?tab=level" className="level-chip" aria-label={label} title={`${formatXp(level.xp)} XP`}>
      <span className="level-chip-text">
        <span className="level-chip-number">Nv {level.level}</span>
        <span className={`level-chip-tier ${style.text}`}>{level.tier.label}</span>
      </span>
      <span className="level-chip-track" aria-hidden="true">
        <span className={`level-chip-fill ${style.bar}`} style={{ width: `${level.progressPercent}%` }} />
      </span>
    </Link>
  );
}

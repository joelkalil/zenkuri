/*
  Calibração da curva de nível.

  Uso:  npx tsx server/level.calibrate.ts [username]

  Somente leitura: imprime o XP, o nível e a composição de cada usuário, além da
  régua de níveis, para ajustar CURVE_BASE_XP / CURVE_EXPONENT em `level.ts`.
*/

import { db } from './db';
import { computeUserLevel, LEVEL_CURVE, xpForLevel } from './level';

const fmt = (value: number) => value.toLocaleString('pt-BR');

const filter = process.argv[2];
const users = db.prepare(
  filter
    ? 'select id, username from users where username = ? order by id'
    : 'select id, username from users order by id',
).all(...(filter ? [filter] : [])) as Array<{ id: number; username: string }>;

if (users.length === 0) {
  console.log(filter ? `Nenhum usuário chamado "${filter}".` : 'Nenhum usuário no banco.');
  process.exit(0);
}

for (const user of users) {
  const started = Date.now();
  const level = computeUserLevel(user.id);
  const elapsed = Date.now() - started;

  console.log(`\n═══ ${user.username} (id ${user.id}) ═══`);
  console.log(`Nível ${level.level} · ${level.tier.label} · ${fmt(level.xp)} XP  [calculado em ${elapsed}ms]`);
  console.log(`Progresso no nível: ${fmt(level.xpIntoLevel)}/${fmt(level.xpForNextLevel)} XP (${level.progressPercent}%)`);
  console.log(`Conquistas: ${fmt(level.counts.achievements)} · raras <10%: ${fmt(level.counts.rare)} · platinas: ${level.counts.platinums} · 100%: ${level.counts.perfects}`);

  console.log('\n  Por plataforma:');
  for (const slice of level.breakdown.platforms) {
    const share = level.xp > 0 ? Math.round((slice.xp / level.xp) * 100) : 0;
    console.log(`   ${slice.label.padEnd(20)} ${String(fmt(slice.achievements)).padStart(6)} conquistas  ${String(fmt(slice.xp)).padStart(9)} XP  (${share}%)`);
  }

  console.log('\n  Por raridade:');
  for (const slice of level.breakdown.rarity) {
    const share = level.xp > 0 ? Math.round((slice.xp / level.xp) * 100) : 0;
    console.log(`   ${slice.label.padEnd(20)} ${String(fmt(slice.achievements)).padStart(6)} conquistas  ${String(fmt(slice.xp)).padStart(9)} XP  (${share}%)`);
  }
  console.log(`\n  Bônus de conclusão: ${fmt(level.breakdown.bonusXp)} XP`);
}

console.log(`\n═══ Régua atual (base ${LEVEL_CURVE.CURVE_BASE_XP}, expoente ${LEVEL_CURVE.CURVE_EXPONENT}) ═══`);
for (const tier of LEVEL_CURVE.LEVEL_TIERS) {
  console.log(`  Nv ${String(tier.minLevel).padStart(3)}  ${tier.label.padEnd(12)} ${String(fmt(xpForLevel(tier.minLevel))).padStart(12)} XP`);
}

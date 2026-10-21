/*
  Level curve calibration.

  Usage:  npx tsx server/level.calibrate.ts [username]

  Read-only: prints each user's XP, level and breakdown, plus the level scale,
  to tune CURVE_BASE_XP / CURVE_EXPONENT in `level.ts`.
*/

import { db } from './db';
import { computeUserLevel, LEVEL_CURVE, xpForLevel } from './level';

const fmt = (value: number) => value.toLocaleString('en-US');

const filter = process.argv[2];
const users = db.prepare(
  filter
    ? 'select id, username from users where username = ? order by id'
    : 'select id, username from users order by id',
).all(...(filter ? [filter] : [])) as Array<{ id: number; username: string }>;

if (users.length === 0) {
  console.log(filter ? `No user named "${filter}".` : 'No users in the database.');
  process.exit(0);
}

for (const user of users) {
  const started = Date.now();
  const level = computeUserLevel(user.id);
  const elapsed = Date.now() - started;

  console.log(`\n═══ ${user.username} (id ${user.id}) ═══`);
  console.log(`Level ${level.level} · ${level.tier.label} · ${fmt(level.xp)} XP  [computed in ${elapsed}ms]`);
  console.log(`Level progress: ${fmt(level.xpIntoLevel)}/${fmt(level.xpForNextLevel)} XP (${level.progressPercent}%)`);
  console.log(`Achievements: ${fmt(level.counts.achievements)} · rare <10%: ${fmt(level.counts.rare)} · platinums: ${level.counts.platinums} · 100%: ${level.counts.perfects}`);

  console.log('\n  By platform:');
  for (const slice of level.breakdown.platforms) {
    const share = level.xp > 0 ? Math.round((slice.xp / level.xp) * 100) : 0;
    console.log(`   ${slice.label.padEnd(20)} ${String(fmt(slice.achievements)).padStart(6)} achievements  ${String(fmt(slice.xp)).padStart(9)} XP  (${share}%)`);
  }

  console.log('\n  By rarity:');
  for (const slice of level.breakdown.rarity) {
    const share = level.xp > 0 ? Math.round((slice.xp / level.xp) * 100) : 0;
    console.log(`   ${slice.label.padEnd(20)} ${String(fmt(slice.achievements)).padStart(6)} achievements  ${String(fmt(slice.xp)).padStart(9)} XP  (${share}%)`);
  }
  console.log(`\n  Completion bonus: ${fmt(level.breakdown.bonusXp)} XP`);
}

console.log(`\n═══ Current scale (base ${LEVEL_CURVE.CURVE_BASE_XP}, exponent ${LEVEL_CURVE.CURVE_EXPONENT}) ═══`);
for (const tier of LEVEL_CURVE.LEVEL_TIERS) {
  console.log(`  Lv ${String(tier.minLevel).padStart(3)}  ${tier.label.padEnd(12)} ${String(fmt(xpForLevel(tier.minLevel))).padStart(12)} XP`);
}

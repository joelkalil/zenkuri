import { achievementXp, levelFromXp, xpForLevel, rarityTier, LEVEL_TIERS } from './levelMath';

let failures = 0;
function check(name: string, cond: boolean, detail = '') {
  if (!cond) { failures++; console.log(`  ✗ ${name} ${detail}`); } else console.log(`  ✓ ${name}`);
}

console.log('\n— Curve inverse: levelFromXp(xpForLevel(n)) === n —');
for (let n = 1; n <= 120; n++) {
  const xp = xpForLevel(n);
  const got = levelFromXp(xp).level;
  if (got !== n) { failures++; console.log(`  ✗ level ${n}: xp ${xp} returned level ${got}`); }
}
console.log(`  ${failures === 0 ? '✓ all 120 levels match exactly' : 'failures above'}`);

console.log('\n— Boundaries: 1 XP less never levels up —');
for (const n of [2, 5, 10, 18, 28, 40, 55, 75, 100]) {
  const below = levelFromXp(xpForLevel(n) - 1).level;
  check(`level ${n} - 1 XP => ${below}`, below === n - 1);
}

console.log('\n— Monotonicity: more XP never gives a lower level —');
let prev = 0, mono = true;
for (let xp = 0; xp < 3_000_000; xp += 977) {
  const lvl = levelFromXp(xp).level;
  if (lvl < prev) { mono = false; break; }
  prev = lvl;
}
check('monotonic over 0..3M XP', mono);

console.log('\n— Progress always within 0..100 —');
let range = true;
for (let xp = 0; xp < 500_000; xp += 313) {
  const p = levelFromXp(xp).progressPercent;
  if (p < 0 || p > 100) { range = false; break; }
}
check('progressPercent within 0..100', range);
check('xp 0 => level 1', levelFromXp(0).level === 1);
check('negative xp => level 1', levelFromXp(-999).level === 1);

console.log('\n— Rarity multiplies —');
const commonSteam = achievementXp({ platform: 'steam', rarity: 80 });
const mythicSteam = achievementXp({ platform: 'steam', rarity: 0.4 });
check(`steam common ${commonSteam} XP vs mythic ${mythicSteam} XP`, mythicSteam === commonSteam * 4);
check('no rarity is not penalized', achievementXp({ platform: 'steam', rarity: null }) === commonSteam);

console.log('\n— PSN hierarchy —');
const psn = (type: string, rarity: number | null = null) => achievementXp({ platform: 'psn', type, rarity });
check(`bronze ${psn('bronze')} < silver ${psn('silver')} < gold ${psn('gold')} < platinum ${psn('platinum')}`,
  psn('bronze') < psn('silver') && psn('silver') < psn('gold') && psn('gold') < psn('platinum'));
check('unknown type falls back to bronze', psn('mystery') === psn('bronze'));

console.log('\n— RetroAchievements —');
check('points scale', achievementXp({ platform: 'retroachievements', points: 50, rarity: null }) === 75);
check('absurd points are capped', achievementXp({ platform: 'retroachievements', points: 9999, rarity: null }) === 150);
check('no points is worth the minimum', achievementXp({ platform: 'retroachievements', points: null, rarity: null }) === 2);

console.log('\n— Rarity tiers —');
check('0.9% => Mythic', rarityTier(0.9)?.key === 'mythic');
check('1% => Ultra rare (exclusive boundary)', rarityTier(1)?.key === 'ultra');
check('99% => Trivial', rarityTier(99)?.key === 'trivial');
check('null => no tier', rarityTier(null) === null);

console.log('\n— Level tiers cover everything with no gaps —');
const tiers = LEVEL_TIERS.map(t => t.minLevel);
check('minLevel strictly increasing', tiers.every((v, i) => i === 0 || v > tiers[i - 1]));
check('first tier starts at level 1', tiers[0] === 1);
for (const n of [1, 4, 5, 9, 10, 17, 18, 27, 28, 39, 40, 54, 55, 74, 75, 200]) {
  const t = levelFromXp(xpForLevel(n)).tier;
  if (!t) { failures++; console.log(`  ✗ level ${n} has no tier`); }
}
console.log('  ✓ the whole scale has a tier');

console.log(`\n${failures === 0 ? '✅ all passed' : `❌ ${failures} failure(s)`}`);
process.exit(failures === 0 ? 0 : 1);

import { achievementXp, levelFromXp, xpForLevel, rarityTier, LEVEL_TIERS } from './levelMath';

let failures = 0;
function check(name: string, cond: boolean, detail = '') {
  if (!cond) { failures++; console.log(`  ✗ ${name} ${detail}`); } else console.log(`  ✓ ${name}`);
}

console.log('\n— Inversa da curva: levelFromXp(xpForLevel(n)) === n —');
for (let n = 1; n <= 120; n++) {
  const xp = xpForLevel(n);
  const got = levelFromXp(xp).level;
  if (got !== n) { failures++; console.log(`  ✗ nível ${n}: xp ${xp} devolveu nível ${got}`); }
}
console.log(`  ${failures === 0 ? '✓ 120 níveis batem exatamente' : 'falhas acima'}`);

console.log('\n— Fronteiras: 1 XP a menos nunca sobe de nível —');
for (const n of [2, 5, 10, 18, 28, 40, 55, 75, 100]) {
  const below = levelFromXp(xpForLevel(n) - 1).level;
  check(`nível ${n} - 1 XP => ${below}`, below === n - 1);
}

console.log('\n— Monotonia: XP maior nunca dá nível menor —');
let prev = 0, mono = true;
for (let xp = 0; xp < 3_000_000; xp += 977) {
  const lvl = levelFromXp(xp).level;
  if (lvl < prev) { mono = false; break; }
  prev = lvl;
}
check('monotônico em 0..3M XP', mono);

console.log('\n— Progresso sempre dentro de 0..100 —');
let range = true;
for (let xp = 0; xp < 500_000; xp += 313) {
  const p = levelFromXp(xp).progressPercent;
  if (p < 0 || p > 100) { range = false; break; }
}
check('progressPercent em 0..100', range);
check('xp 0 => nível 1', levelFromXp(0).level === 1);
check('xp negativo => nível 1', levelFromXp(-999).level === 1);

console.log('\n— Raridade multiplica —');
const commonSteam = achievementXp({ platform: 'steam', rarity: 80 });
const mythicSteam = achievementXp({ platform: 'steam', rarity: 0.4 });
check(`steam comum ${commonSteam} XP vs mítica ${mythicSteam} XP`, mythicSteam === commonSteam * 4);
check('sem raridade não penaliza', achievementXp({ platform: 'steam', rarity: null }) === commonSteam);

console.log('\n— Hierarquia PSN —');
const psn = (type: string, rarity: number | null = null) => achievementXp({ platform: 'psn', type, rarity });
check(`bronze ${psn('bronze')} < prata ${psn('silver')} < ouro ${psn('gold')} < platina ${psn('platinum')}`,
  psn('bronze') < psn('silver') && psn('silver') < psn('gold') && psn('gold') < psn('platinum'));
check('tipo desconhecido cai em bronze', psn('mystery') === psn('bronze'));

console.log('\n— RetroAchievements —');
check('pontos escalam', achievementXp({ platform: 'retroachievements', points: 50, rarity: null }) === 75);
check('pontos absurdos são limitados', achievementXp({ platform: 'retroachievements', points: 9999, rarity: null }) === 150);
check('sem pontos vale o mínimo', achievementXp({ platform: 'retroachievements', points: null, rarity: null }) === 2);

console.log('\n— Faixas de raridade —');
check('0.9% => Mítica', rarityTier(0.9)?.key === 'mythic');
check('1% => Ultra rara (fronteira exclusiva)', rarityTier(1)?.key === 'ultra');
check('99% => Trivial', rarityTier(99)?.key === 'trivial');
check('null => sem faixa', rarityTier(null) === null);

console.log('\n— Faixas de nível cobrem tudo sem buraco —');
const tiers = LEVEL_TIERS.map(t => t.minLevel);
check('minLevel estritamente crescente', tiers.every((v, i) => i === 0 || v > tiers[i - 1]));
check('primeira faixa começa no nível 1', tiers[0] === 1);
for (const n of [1, 4, 5, 9, 10, 17, 18, 27, 28, 39, 40, 54, 55, 74, 75, 200]) {
  const t = levelFromXp(xpForLevel(n)).tier;
  if (!t) { failures++; console.log(`  ✗ nível ${n} sem faixa`); }
}
console.log('  ✓ toda a régua tem faixa');

console.log(`\n${failures === 0 ? '✅ tudo passou' : `❌ ${failures} falha(s)`}`);
process.exit(failures === 0 ? 0 : 1);

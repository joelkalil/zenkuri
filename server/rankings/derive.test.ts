import { deriveRankings, estimateRemainingHours, RANKING_THRESHOLDS } from './derive';
import type { RankingGameInput, RankingList, RankingListId } from './types';

let failures = 0;
function check(name: string, cond: boolean, detail = '') {
  if (!cond) { failures++; console.log(`  ✗ ${name} ${detail}`); } else console.log(`  ✓ ${name}`);
}

const NOW = Date.UTC(2026, 9, 1);
let nextId = 1;
function rep(n: number, rarity: number | null): Array<number | null> {
  return Array.from({ length: n }, () => rarity);
}
function game(title: string, p: Partial<RankingGameInput> & { total: number; unlocked: number }): RankingGameInput {
  const id = nextId++;
  return {
    gameId: id,
    groupId: null,
    platform: 'steam',
    externalId: String(id),
    title,
    playtimeMinutes: 0,
    percent: Math.round((p.unlocked / p.total) * 100),
    remainingRarities: [],
    ...p,
  };
}
function list(lists: RankingList[], id: RankingListId): RankingList {
  const found = lists.find((l) => l.id === id);
  if (!found) throw new Error(`missing list: ${id}`);
  return found;
}
function ids(lists: RankingList[], id: RankingListId, byTitle: Map<number, string>): string[] {
  return list(lists, id).entries.map((e) => byTitle.get(e.gameId) ?? '?');
}

const near95 = game('Near95', { total: 40, unlocked: 38, playtimeMinutes: 3000, remainingRarities: [30, 18] });
const near80 = game('Near80', { total: 30, unlocked: 24, playtimeMinutes: 1800, remainingRarities: [20, 25, 40, 12, 35, 50] });
const near90Ultra = game('Near90Ultra', { total: 50, unlocked: 45, playtimeMinutes: 4000, remainingRarities: [0.4, 40, 35, 30, 45] });
const quickFresh = game('QuickFresh', { total: 8, unlocked: 0, remainingRarities: rep(8, 60) });
const quickStarted = game('QuickStarted', { total: 15, unlocked: 6, playtimeMinutes: 300, remainingRarities: rep(9, 40) });
const tenUltra = game('TenUltra', { total: 30, unlocked: 20, playtimeMinutes: 3000, remainingRarities: rep(10, 0.5) });
const grindTop = game('GrindTop', { total: 100, unlocked: 30, playtimeMinutes: 6000, remainingRarities: rep(70, 40) });
const grindMid = game('GrindMid', { total: 60, unlocked: 10, playtimeMinutes: 600, remainingRarities: rep(50, 30) });
const grindUltra = game('GrindUltra', { total: 60, unlocked: 30, playtimeMinutes: 3000, remainingRarities: [...rep(6, 0.7), ...rep(24, 40)] });
const completed = game('Completed', { total: 20, unlocked: 20 });
const percentFull = game('PercentFull', { total: 10, unlocked: 9, percent: 100, remainingRarities: [50] });
const noAch = game('NoAch', { total: 0, unlocked: 0 });
const psnNoDetail = game('PsnNoDetail', { total: 50, unlocked: 45, percent: 90, platform: 'psn', remainingRarities: [] });
const threePercent = game('ThreePercent', { total: 40, unlocked: 30, playtimeMinutes: 2400, remainingRarities: rep(10, 3) });
const groupSteam = game('GroupSteam', { groupId: 7, total: 40, unlocked: 20, playtimeMinutes: 1200, remainingRarities: rep(20, 30) });
const groupPsn = game('GroupPsn', { groupId: 7, platform: 'psn', total: 40, unlocked: 32, playtimeMinutes: 900, remainingRarities: rep(8, 30) });
const groupDoneA = game('GroupDoneA', { groupId: 8, total: 30, unlocked: 15, playtimeMinutes: 900, remainingRarities: rep(15, 30) });
const groupDoneB = game('GroupDoneB', { groupId: 8, platform: 'psn', total: 30, unlocked: 30 });

const fixture = [
  near95, near80, near90Ultra, quickFresh, quickStarted, tenUltra, grindTop, grindMid, grindUltra,
  completed, percentFull, noAch, psnNoDetail, threePercent, groupSteam, groupPsn, groupDoneA, groupDoneB,
];
const titles = new Map(fixture.map((g) => [g.gameId, g.title]));
const all = deriveRankings(fixture, { now: NOW });
const everyone = new Set(all.flatMap((l) => l.entries.map((e) => titles.get(e.gameId))));

console.log('\n— Structure —');
check('four lists in the order finish, quick, grind, demanding', all.map((l) => l.id).join() === 'finish,quick,grind,demanding');
check('English labels', list(all, 'finish').label === 'Finish now' && list(all, 'quick').label === 'Quick wins'
  && list(all, 'grind').label === 'Long projects' && list(all, 'demanding').label === 'Demanding');

console.log('\n— Exclusions —');
check('completed (unlocked === total) is out of every list', !everyone.has('Completed'));
check('percent >= 100 is out of every list', !everyone.has('PercentFull'));
check('total 0 is out of every list', !everyone.has('NoAch'));
check('group duplicate: the most advanced version stays', everyone.has('GroupPsn') && !everyone.has('GroupSteam'));
check('a group with a completed version is out entirely', !everyone.has('GroupDoneA') && !everyone.has('GroupDoneB'));
check('an empty input does not break', deriveRankings([], { now: NOW }).every((l) => l.entries.length === 0));

console.log('\n— Intent of each list —');
const finish = ids(all, 'finish', titles);
check('finish: 95% with 2 common leads', finish[0] === 'Near95', finish.join());
check('finish: a < 1% blocker excludes', !finish.includes('Near90Ultra'));
check('finish: PSN without detail is included (unknown rarity)', finish.includes('PsnNoDetail'));
check('finish: below 60% is not included', !finish.includes('GrindTop') && !finish.includes('QuickFresh'));
check('finish: closer comes before farther', finish.indexOf('Near95') < finish.indexOf('Near80'));
const quick = ids(all, 'quick', titles);
check('quick: few easy remaining, not started, leads', quick[0] === 'QuickFresh', quick.join());
check('quick: started and small is included', quick.includes('QuickStarted'));
check('quick: never includes home stretch or long projects', !quick.includes('Near95') && !quick.includes('GrindTop'));
check('quick: an ultra-rare excludes', !quick.includes('TenUltra'));
const grind = ids(all, 'grind', titles);
check('grind: the largest feasible project leads', grind[0] === 'GrindTop', grind.join());
check('grind: the second project is included', grind.includes('GrindMid'));
check('grind: dominated by ultra-rares is out', !grind.includes('GrindUltra'));
const demanding = ids(all, 'demanding', titles);
check('demanding: ten 0.5% blockers lead', demanding[0] === 'TenUltra', demanding.join());
check('demanding: more mass comes before less', demanding.indexOf('GrindUltra') < demanding.indexOf('ThreePercent'));
check('demanding: 3% blockers are included', demanding.includes('ThreePercent'));
check('demanding: an easy game is not included', !demanding.includes('Near95') && !demanding.includes('QuickFresh'));

console.log('\n— Reasons —');
const top = list(all, 'finish').entries[0];
check('finish brings near + remaining + rarest', top.reasons[0].code === 'near' && top.reasons[1].code === 'remaining' && top.reasons[2]?.code === 'rarest');
check('rarest uses the lowest remaining rarity', top.reasons[2]?.code === 'rarest' && top.reasons[2].percent === 18);
check('quick not started flags notStarted', list(all, 'quick').entries[0].reasons.some((r) => r.code === 'notStarted'));
check('demanding brings ultraRare with the count', list(all, 'demanding').entries[0].reasons[0].code === 'ultraRare'
  && JSON.stringify(list(all, 'demanding').entries[0].reasons[0]) === '{"code":"ultraRare","count":10}');

console.log('\n— Hours estimate —');
const base = game('Est', { total: 20, unlocked: 10, playtimeMinutes: 600, remainingRarities: rep(10, 30) });
const baseEst = estimateRemainingHours(base);
check('measured: 1h per achievement x 10 x weight 0.9 = 9h, ±30% range rounded to 0.5h', baseEst.mid === 9 && baseEst.range?.[0] === 6.5 && baseEst.range[1] === 12, JSON.stringify(baseEst));
const rareEst = estimateRemainingHours(game('Rare', { total: 20, unlocked: 10, playtimeMinutes: 600, remainingRarities: rep(10, 0.5) }));
check('rares cost more than commons', rareEst.mid > baseEst.mid * 5, `${rareEst.mid}`);
const noPlayKnown = estimateRemainingHours(game('NoPlay', { total: 10, unlocked: 0, remainingRarities: rep(10, 30) }));
check('playtime 0 with rarities: 0.5h/unit fallback, range exists', noPlayKnown.mid === 4.5 && noPlayKnown.range !== null, JSON.stringify(noPlayKnown));
const noSignal = estimateRemainingHours(game('NoSignal', { total: 10, unlocked: 0, remainingRarities: [] }));
check('no playtime and no rarities: null range, fallback mid', noSignal.range === null && noSignal.mid === 7.5, JSON.stringify(noSignal));
const measuredNoRar = estimateRemainingHours(game('NoRar', { total: 20, unlocked: 10, playtimeMinutes: 600, remainingRarities: [] }));
check('measured playtime without rarities: uses the unknown weight', measuredNoRar.mid === 15 && measuredNoRar.range !== null, JSON.stringify(measuredNoRar));
const huge = estimateRemainingHours(game('Huge', { total: 5000, unlocked: 1, playtimeMinutes: 60_000, remainingRarities: rep(4999, 0.1) }));
check('absurd values are capped', huge.mid === RANKING_THRESHOLDS.MAX_HOURS && huge.range?.[1] === RANKING_THRESHOLDS.MAX_HOURS * 1.3);
const tiny = estimateRemainingHours(game('Tiny', { total: 2, unlocked: 1, playtimeMinutes: 1, remainingRarities: [90] }));
check('minimum respected and the range never degenerates', tiny.mid === RANKING_THRESHOLDS.MIN_HOURS && tiny.range !== null && tiny.range[1] > tiny.range[0], JSON.stringify(tiny));
check('PSN without detail exposes null estimateHours in the list', list(all, 'finish').entries.find((e) => e.gameId === psnNoDetail.gameId)?.estimateHours === null);
check('an entry with a range exposes estimateHours', top.estimateHours !== null && top.estimateHours[0] < top.estimateHours[1]);

console.log('\n— Determinism and limit —');
const shuffled = [...fixture].reverse();
check('independent of input order', JSON.stringify(deriveRankings(shuffled, { now: NOW })) === JSON.stringify(all));
check('repeatable', JSON.stringify(deriveRankings(fixture, { now: NOW })) === JSON.stringify(all));
const many = Array.from({ length: 30 }, (_, i) => game(`Many${i}`, { total: 20, unlocked: 18, playtimeMinutes: 600, remainingRarities: [30, 30] }));
check('default limit is 20', list(deriveRankings(many, { now: NOW }), 'finish').entries.length === 20);
check('custom limit', list(deriveRankings(many, { limit: 5, now: NOW }), 'finish').entries.length === 5);
const tie = deriveRankings(many, { now: NOW }).find((l) => l.id === 'finish')?.entries.map((e) => e.gameId) ?? [];
check('ties resolve by ascending gameId', tie.every((id, i) => i === 0 || tie[i - 1] < id));
const frozen = fixture.map((g) => Object.freeze({ ...g, remainingRarities: Object.freeze([...g.remainingRarities]) as Array<number | null> }));
let mutated = false;
try { deriveRankings(frozen, { now: NOW }); } catch { mutated = true; }
check('does not mutate the input', !mutated);
const recent = game('Recent', { total: 20, unlocked: 18, playtimeMinutes: 600, remainingRarities: [30, 30], lastPlayedAt: NOW - 86_400_000 });
const stale = game('Stale', { total: 20, unlocked: 18, playtimeMinutes: 600, remainingRarities: [30, 30], lastPlayedAt: NOW - 400 * 86_400_000 });
const recency = list(deriveRankings([stale, recent], { now: NOW }), 'finish').entries;
check('recently played wins the tie', recency[0].gameId === recent.gameId);

// formatReason moved to the client; its tests live in src/i18n/i18n.test.ts.

console.log(failures === 0 ? '\nOK' : `\n${failures} failure(s)`);
process.exit(failures === 0 ? 0 : 1);

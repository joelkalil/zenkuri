import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  deriveAutoCollections,
  type AutoCollection,
  type CollectionGame,
  type CollectionMeta,
} from './derive';
import { franchisesFromTitle, isExcludedTitle, normalizeKey, resolveName, sagaSeedOf, stripDecorations } from './rules';
import { loadPacks } from '../community/packs';
import { parseSteamStoreItems } from '../steamStoreMeta';

let failures = 0;
function check(name: string, cond: boolean, detail = '') {
  if (!cond) { failures++; console.log(`  ✗ ${name} ${detail}`); } else console.log(`  ✓ ${name}`);
}

// The sagas come from the packs in community/, read from disk by the validator (no database).
const packs = loadPacks(join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'community'));
const sagaSeeds = packs.publications.flatMap((pub) => (pub.kind === 'saga' ? [sagaSeedOf(pub.payload)] : []));

let nextId = 1;
function game(title: string, platform = 'steam', groupId: number | null = null, externalId = String(nextId)): CollectionGame {
  return { id: nextId++, platform, externalId, title, groupId };
}
function meta(g: CollectionGame, m: Partial<Omit<CollectionMeta, 'gameId'>>): CollectionMeta {
  return { gameId: g.id, developers: [], publishers: [], franchises: [], ...m };
}
function find(list: AutoCollection[], name: string) {
  return list.find((c) => c.name === name);
}

console.log('\n— Saga packs —');
check('valid packs, no errors', packs.errors.length === 0, packs.errors.join('; '));
check('Final Fantasy and Resident Evil loaded', ['Final Fantasy', 'Resident Evil'].every((name) => sagaSeeds.some((seed) => seed.name === name)));

console.log('\n— Key normalization —');
const sameKey = (a: string, b: string) => normalizeKey(a) === normalizeKey(b);
check('Capcom == CAPCOM Co., Ltd.', sameKey('Capcom', 'CAPCOM Co., Ltd.'));
check('Bandai Namco Entertainment == BANDAI NAMCO Entertainment', sameKey('Bandai Namco Entertainment', 'BANDAI NAMCO Entertainment'));
check('IO Interactive == Io Interactive', sameKey('IO Interactive', 'Io Interactive'));
check('FromSoftware, Inc. == FromSoftware', sameKey('FromSoftware, Inc.', 'FromSoftware'));
check('diacritics and ®™ are ignored', sameKey('Pokémon®', 'POKEMON™'));
check('trailing (Mac)/(Linux) are dropped', normalizeKey('Feral Interactive (Mac)') === normalizeKey('Feral Interactive') && normalizeKey('Aspyr (Linux)') === 'aspyr');
check('repeated suffixes are dropped', normalizeKey('Foo Games Co., Ltd., Inc.') === normalizeKey('Foo Games'));
check('Square Enix Co.,Ltd. == Square Enix', sameKey('Square Enix Co.,Ltd.', 'Square Enix'));
check('stripDecorations preserves case', stripDecorations('PlatinumGames Inc.') === 'PlatinumGames');

console.log('\n— normalizeKey/stripDecorations edge cases —');
check('®™ are removed from the key', normalizeKey('Foo®Bar™') === 'foobar');
check('diacritics are removed from the key', normalizeKey('Café Zoë') === 'cafezoe');
check('"Co., Ltd." is dropped from the key and the display', normalizeKey('Acme Co., Ltd.') === 'acme' && stripDecorations('Acme Co., Ltd.') === 'Acme');
check('trailing comma is dropped', stripDecorations('Acme,') === 'Acme' && normalizeKey('Acme,') === 'acme');
check('repeated spaces do not affect the key', normalizeKey('Foo   \t Bar') === normalizeKey('Foo Bar'));
check('any trailing parenthetical is dropped', stripDecorations('Feral Interactive (Mac/Linux)') === 'Feral Interactive' && stripDecorations('Aspyr (Mac & Linux)') === 'Aspyr');
check('a mid-string parenthetical is preserved', stripDecorations('Foo (Bar) Baz') === 'Foo (Bar) Baz');
check('stripDecorations of a decoration-only string does not become empty', stripDecorations('Inc.') === 'Inc.');

console.log('\n— Aliases and blocklists —');
check('2K Australia/Boston/Marin/China/Games/Czech => 2K',
  ['2K Australia', '2K Boston', '2K Marin', '2K China', '2K Games', '2K Czech'].every((n) => resolveName('company', n)?.display === '2K'));
check('Gearbox Publishing => Gearbox Software', resolveName('company', 'Gearbox Publishing')?.display === 'Gearbox Software');
check('Warner Bros. Interactive Entertainment => Warner Bros. Games', resolveName('company', 'Warner Bros. Interactive Entertainment')?.display === 'Warner Bros. Games');
check('Koei Tecmo Games => Koei Tecmo', resolveName('company', 'Koei Tecmo Games')?.display === 'Koei Tecmo');
check('Level5 => Level-5', resolveName('company', 'Level5')?.display === 'Level-5' && resolveName('company', 'LEVEL-5 Inc.')?.display === 'Level-5');
check('display override (SEGA, CD Projekt Red)', resolveName('company', 'SEGA Corporation')?.display === 'SEGA' && resolveName('company', 'CD PROJEKT RED')?.display === 'CD Projekt Red');
for (const blocked of ['Feral Interactive', 'Feral Interactive (Mac)', 'Feral Interactive (Mac/Linux)', 'Feral Interactive Ltd', 'Aspyr Media', 'Aspyr Media, Inc.', 'Nixxes Software', 'Aspyr', 'Aspyr (Linux)', 'Nixxes', 'QLOC', 'Virtuos', 'Blind Squirrel', '1C-SoftClub']) {
  check(`blocked company: ${blocked}`, resolveName('company', blocked) === null);
}
for (const blocked of ['EA Play', 'EA Play ', 'EA Originals', 'EA Sports', 'PlayStation Studios', 'PlayStation Publishing LLC', 'WB Games', '505 Games Official', 'FRANCHISE', 'Arc Games', 'Raw Fury Games', 'Team17 Digital', 'Thunderful Publishing', 'Landfall']) {
  check(`blocked franchise: "${blocked}"`, resolveName('franchise', blocked) === null);
}
check('prefix only applies to companies and at a word boundary', resolveName('company', 'Aspyrion Games') !== null && resolveName('franchise', 'EA Play Live') !== null);
check('EA SPORTS FC is still a valid franchise', resolveName('franchise', 'EA SPORTS FC™') !== null);
check('Monster Camp/Roadtrip/Con => Monster Prom', ['Monster Camp', 'Monster Roadtrip', 'Monster Con'].every((n) => resolveName('franchise', n)?.display === 'Monster Prom'));
check('Hellblade aliases', resolveName('franchise', 'Hellblade Franchise')?.display === 'Hellblade' && resolveName('franchise', "Hellblade: Senua's Sacrifice")?.display === 'Hellblade');
check('Skyrim => The Elder Scrolls', resolveName('franchise', 'Skyrim')?.display === 'The Elder Scrolls');
check('Black Ops / Modern Warfare => Call of Duty', resolveName('franchise', 'Black Ops')?.display === 'Call of Duty' && resolveName('franchise', 'Modern Warfare')?.display === 'Call of Duty');
check('THE WITCHER® => The Witcher; NIER => NieR', resolveName('franchise', 'THE WITCHER®')?.display === 'The Witcher' && resolveName('franchise', 'NIER')?.display === 'NieR');
check('the same name is not blocked as both company and franchise', resolveName('company', 'EA Play') !== null);

console.log('\n— Title rules —');
const titleCases: [string, string][] = [
  ['FINAL FANTASY VII REMAKE', 'Final Fantasy'],
  ['Resident Evil 4', 'Resident Evil'],
  ['KINGDOM HEARTS HD 1.5+2.5 ReMIX', 'Kingdom Hearts'],
  ['God of War®', 'God of War'],
  ['Divine Divinity', 'Divinity'],
  ['Beyond Divinity', 'Divinity'],
  ['Divinity: Original Sin 2', 'Divinity'],
  ['Left 4 Dead 2', 'Left 4 Dead'],
  ['Alan Wake 2', 'Alan Wake'],
  ['Ni no Kuni II: Revenant Kingdom', 'Ni no Kuni'],
  ['ELDEN RING', 'Elden Ring'],
  ['Chrono Trigger', 'Chrono'],
  ['Chrono Cross: The Radical Dreamers Edition', 'Chrono'],
  ['Middle-earth™: Shadow of War™', 'Middle-earth'],
  ['Monster Prom 2: Monster Camp', 'Monster Prom'],
  ['Five Hearts Under One Roof', 'Five Hearts Under One Roof'],
  ['The Witcher 3: Wild Hunt', 'The Witcher'],
  ['Ghost of Tsushima DIRECTOR’S CUT', 'Ghost of Tsushima'],
  ['Ghost of Yōtei', 'Ghost of Tsushima'],
  ['DARK SOULS™ III', 'Dark Souls'],
  ['Borderlands 3', 'Borderlands'],
  ['BioShock Infinite', 'BioShock'],
  ['Darksiders III', 'Darksiders'],
  ["Assassin's Creed Odyssey", "Assassin's Creed"],
  ['Assassin’s Creed Valhalla', "Assassin's Creed"],
  ['Devil May Cry 5', 'Devil May Cry'],
  ['Shadow of the Tomb Raider', 'Tomb Raider'],
  ['Fallout 4', 'Fallout'],
  ['The Elder Scrolls V: Skyrim', 'The Elder Scrolls'],
  ['Hollow Knight', 'Hollow Knight'],
  ['Ori and the Blind Forest', 'Ori'],
  ['STAR WARS Jedi: Fallen Order™', 'Star Wars'],
  ['Call of Duty®: Black Ops III', 'Call of Duty'],
  ['Grand Theft Auto V', 'Grand Theft Auto'],
  ['HITMAN 3', 'Hitman'],
  ['Portal 2', 'Portal'],
  ['Half-Life 2', 'Half-Life'],
  ['Pokémon Legends: Arceus', 'Pokémon'],
];
for (const [title, expected] of titleCases) {
  check(`${title} => ${expected}`, franchisesFromTitle(title).includes(expected), JSON.stringify(franchisesFromTitle(title)));
}
check('Portal Knights does not become Portal', franchisesFromTitle('Portal Knights').length === 0);
check('LEGO Star Wars does not become Star Wars (prefix only)', franchisesFromTitle('LEGO Star Wars: The Skywalker Saga').length === 0);
check('Chrono Ark does not become Chrono', franchisesFromTitle('Chrono Ark').length === 0);

console.log('\n— Exclusions —');
for (const title of ['Left 4 Dead 2 Dedicated Server', 'Foo Demo', 'Foo Playtest', 'Foo Test Server', 'Foo Soundtrack', 'Foo SDK', 'Foo - Demo']) {
  check(`excluded: ${title}`, isExcludedTitle(title, 'steam'));
}
check('RA [Subset] is excluded on RA only', isExcludedTitle('Pokemon Red [Subset - Bonus]', 'retroachievements') && !isExcludedTitle('Pokemon Red [Subset - Bonus]', 'steam'));
check('"Demonic" does not match demo', !isExcludedTitle('Demonic Game', 'steam'));

console.log('\n— Derivation: threshold, groups and roles —');
{
  nextId = 1;
  const a = game('Alpha One');
  const b = game('Alpha Two');
  const c = game('Solo');
  const result = deriveAutoCollections([a, b, c], [
    meta(a, { developers: ['Acme Studio, Inc.'], publishers: ['Pub House'] }),
    meta(b, { developers: ['ACME STUDIO'], publishers: ['Acme Studio'] }),
    meta(c, { developers: ['Lonely Dev'] }),
  ]);
  check('a collection with 1 game does not appear', find(result.companies, 'Lonely Dev') === undefined);
  const acme = result.companies.find((x) => x.id === 'company:acmestudio');
  check('dev and pub in one collection, 2 games', acme?.members.length === 2 && acme.groupCount === 2);
  check('role dev / both', acme?.members[0].role === 'dev' && acme.members[1].role === 'both', JSON.stringify(acme?.members));
  check('name: most frequent spelling without suffix', acme?.name === 'Acme Studio', acme?.name);
  check('Pub House with 2 games? no (only 1)', find(result.companies, 'Pub House') === undefined);
}
{
  nextId = 1;
  const steam = game('Cool Game', 'steam', 7);
  const psn = game('Cool Game', 'psn', 7);
  const other = game('Another');
  const result = deriveAutoCollections([steam, psn, other], [
    meta(steam, { developers: ['Dev X'] }),
    meta(other, { developers: ['Dev X'] }),
  ]);
  const dev = find(result.companies, 'Dev X');
  check('the same game on Steam+PSN counts as 1 group', dev?.groupCount === 2 && dev.members.length === 2);

  nextId = 1;
  const s2 = game('Same Game', 'steam', 9);
  const p2 = game('Same Game', 'psn', 9);
  const none = deriveAutoCollections([s2, p2], [meta(s2, { developers: ['Dev Y'], franchises: ['Fr Y'] })]);
  check('a single group => no collection', none.companies.length === 0 && none.franchises.length === 0);

  nextId = 1;
  const n1 = game('Null Group A', 'steam', null);
  const n2 = game('Null Group B', 'steam', null);
  const nulls = deriveAutoCollections([n1, n2], [meta(n1, { developers: ['Dev Z'] }), meta(n2, { developers: ['Dev Z'] })]);
  check('null group_id falls back to the game id', find(nulls.companies, 'Dev Z')?.groupCount === 2);
}
{
  nextId = 1;
  const real = game('Real Game');
  const demo = game('Real Game Demo');
  const ost = game('Real Game Soundtrack');
  const ra = game('Real Game [Subset - Extra]', 'retroachievements');
  const result = deriveAutoCollections([real, demo, ost, ra], [real, demo, ost, ra].map((g) => meta(g, { developers: ['Dev Q'] })));
  check('demo/soundtrack/subset neither count nor enter', result.companies.length === 0);
}
{
  nextId = 1;
  const a = game('Alpha');
  const b = game('Beta');
  const c = game('Gamma');
  const d = game('Delta');
  const result = deriveAutoCollections([a, b, c, d], [
    meta(a, { developers: ['Big Dev'] }), meta(b, { developers: ['Big Dev'] }), meta(c, { developers: ['Big Dev'] }),
    meta(d, { developers: ['Beta Dev'] }),
  ]);
  check('ordered by groups desc', result.companies[0].name === 'Big Dev');
  nextId = 1;
  const e = game('E'); const f = game('F'); const g = game('G'); const h = game('H');
  const tied = deriveAutoCollections([e, f, g, h], [
    meta(e, { developers: ['Zed'] }), meta(f, { developers: ['Zed'] }),
    meta(g, { developers: ['Abe'] }), meta(h, { developers: ['Abe'] }),
  ]);
  check('ties are ordered by name', tied.companies.map((x) => x.name).join(',') === 'Abe,Zed');
}
{
  nextId = 1;
  const ff1 = game('FINAL FANTASY VII', 'psn');
  const ff2 = game('FINAL FANTASY X', 'psn');
  const viaStore = game('Some Remaster', 'steam', null, '999');
  const result = deriveAutoCollections([ff1, ff2, viaStore], [meta(viaStore, { franchises: ['FINAL FANTASY'] })]);
  const ff = find(result.franchises, 'Final Fantasy');
  check('PSN enters by title rule (source=title) and the store by store', ff?.members.length === 3
    && ff.members.filter((m) => m.source === 'title').length === 2 && ff.members.find((m) => m.gameId === viaStore.id)?.source === 'store');
  check('franchise collection without role', ff?.members.every((m) => m.role === undefined) === true);
}
{
  nextId = 1;
  const a = game('Pixel Remaster I', 'steam', null, '1173770');
  const b = game('Pixel Remaster II', 'steam', null, '1173780');
  const result = deriveAutoCollections([a, b], [], sagaSeeds);
  const ff = find(result.franchises, 'Final Fantasy');
  check('a published saga seeds the franchise (source=title)', ff?.groupCount === 2 && ff.members.every((m) => m.source === 'title'));
  check('without input sagas the engine seeds nothing (pure)', deriveAutoCollections([a, b], []).franchises.length === 0);
}
{
  nextId = 1;
  const a = game('Call of Duty®: Black Ops III', 'psn');
  const b = game('Call of Duty®', 'steam', null, '1938090');
  const result = deriveAutoCollections([a, b], [meta(b, { franchises: ['Call of Duty', 'Modern Warfare', 'Black Ops'] })]);
  const cod = find(result.franchises, 'Call of Duty');
  check('Call of Duty: aliases merge into a 2-game collection', cod?.groupCount === 2 && result.franchises.length === 1, JSON.stringify(result.franchises.map((x) => x.name)));
}

console.log('\n— Steam response (parser) —');
{
  const items = parseSteamStoreItems({
    response: {
      store_items: [
        { appid: 10, success: 1, basic_info: { developers: [{ name: ' Dev ' }], publishers: [{ name: 'Pub' }], franchises: [{ name: 'Fr' }, {}] } },
        { appid: 20, success: 15 },
        { success: 1 },
      ],
    },
  });
  check('ok item', items[0]?.appid === '10' && items[0].developers[0] === 'Dev' && items[0].franchises.length === 1 && items[0].error === null);
  check('success != 1 => empty + error', items[1]?.appid === '20' && items[1].error !== null && items[1].developers.length === 0);
  check('an item without appid is discarded', items.length === 2);
  check('invalid body => empty', parseSteamStoreItems(null).length === 0 && parseSteamStoreItems({}).length === 0);
}

console.log('\n— Fixture: 257 real Steam apps —');
{
  const here = dirname(fileURLToPath(import.meta.url));
  const raw = JSON.parse(readFileSync(join(here, 'fixtures', 'steam-basic-info.json'), 'utf8')) as
    Record<string, { name: string; dev: string[]; pub: string[]; fr: string[] }>;
  nextId = 1;
  const entries = Object.entries(raw);
  const games = entries.map(([appid, v]) => game(v.name, 'steam', null, appid));
  const metas = entries.map(([, v], i) => meta(games[i], { developers: v.dev, publishers: v.pub, franchises: v.fr }));
  const { franchises, companies } = deriveAutoCollections(games, metas, sagaSeeds);
  const count = (list: AutoCollection[], name: string) => find(list, name)?.groupCount ?? 0;
  const ids = [...franchises, ...companies].map((c) => c.id);

  check(`Square Enix >= 30 (${count(companies, 'Square Enix')})`, count(companies, 'Square Enix') >= 30);
  check('Capcom is a single collection', companies.filter((c) => /capcom/i.test(c.name)).length === 1 && count(companies, 'Capcom') > 0);
  check(`2K absorbs Australia/Boston/Marin/China (${count(companies, '2K')})`, count(companies, '2K') >= 4 && !companies.some((c) => /^2k /i.test(c.name)));
  check('no EA Play / Feral / FRANCHISE collection', !ids.some((id) => /eaplay|feral|:franchise$/.test(id)));
  check('no port-studio collection (Aspyr/Nixxes/QLOC/Virtuos/Blind Squirrel/1C)', !ids.some((id) => /aspyr|nixxes|qloc|virtuos|blindsquirrel|1csoftclub/.test(id)));
  check('no storefront franchise', !franchises.some((c) => /^(ea sports|wb games|playstation studios|landfall|arc games)$/i.test(c.name)));
  check(`Monster Prom groups 3 (${count(franchises, 'Monster Prom')})`, count(franchises, 'Monster Prom') === 3);
  check(`Divinity >= 4 (${count(franchises, 'Divinity')})`, count(franchises, 'Divinity') >= 4);
  check('Final Fantasy is a franchise', count(franchises, 'Final Fantasy') >= 10);
  check('The Witcher and The Elder Scrolls with display override', count(franchises, 'The Witcher') >= 2 && count(franchises, 'The Elder Scrolls') >= 2);
  check('Hellblade groups both', count(franchises, 'Hellblade') === 2);
  check('CD Projekt Red / FromSoftware / SEGA with display override', count(companies, 'CD Projekt Red') >= 2 && count(companies, 'FromSoftware') >= 2 && count(companies, 'SEGA') >= 2);
  check('every collection has >= 2 groups', [...franchises, ...companies].every((c) => c.groupCount >= 2));
  check('ordered by groupCount desc', companies.every((c, i) => i === 0 || companies[i - 1].groupCount >= c.groupCount));
}

console.log(`\n${failures === 0 ? '✅ all passed' : `❌ ${failures} failure(s)`}`);
process.exit(failures === 0 ? 0 : 1);

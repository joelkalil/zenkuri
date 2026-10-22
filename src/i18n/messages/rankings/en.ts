import type { Shape } from '../../types';
import type { rankingsPtBR } from './pt-BR';

export const rankingsEn = {
  lists: {
    finish: {
      label: 'Finish now',
      short: 'Now',
      description: 'Games right at the goal line: few achievements left and no extreme blockers.',
    },
    quick: {
      label: 'Quick wins',
      short: 'Quick',
      description: 'Games, started or not, that become one more completion without eating your month.',
    },
    grind: {
      label: 'Long hauls',
      short: 'Long',
      description: 'A lot ahead and dozens of estimated hours, but still realistic to finish.',
    },
    demanding: {
      label: 'Demanding',
      short: 'Demanding',
      description: 'Remaining achievements with very low rarity: they take skill, luck or a serious relationship with the game.',
    },
    essentials: {
      label: 'Essentials',
      short: 'Essentials',
      description: 'Community curation, coming from the packs in community/ in the repository.',
    },
  },
  reasons: {
    remaining: {
      one: '{count} achievement left',
      other: '{count} achievements left',
    },
    rarest: 'Rarest: {percent}% of players',
    near: '{percent}% complete',
    long: '~{hours}h project',
    short: '~{hours}h to finish',
    ultraRare: {
      one: '{count} achievement under 1%',
      other: '{count} achievements under 1%',
    },
    notStarted: 'Not started yet',
  },
  page: {
    eyebrow: 'Automatic and curated',
    title: 'Rankings',
    description: 'Five lists to pick your next game: four computed from your achievements and one curated by the community.',
    communityLink: 'Community',
    tabsLabel: 'Ranking lists',
    games: { one: 'game in the library', other: 'games in the library' },
    eligible: { one: 'makes the automatic lists', other: 'make the automatic lists' },
  },
  columns: { rank: 'No.', game: 'Game', platform: 'Platform', situation: 'Your status', estimate: 'Estimate' },
  estimate: { single: '~{hours} h', range: '~{min}–{max} h' },
  situation: { platinum: 'Platinum', perfect: '100%', notStarted: 'Not started', outOfLibrary: 'Not in library' },
  myNote: 'your note',
  recent: {
    platinumsTitle: 'Latest platinums',
    platinumsSubtitle: 'PSN',
    perfectsTitle: 'Latest 100%',
    perfectsSubtitle: 'Steam and RetroAchievements',
    empty: 'No completions recorded yet.',
  },
  auto: {
    games: { one: 'game', other: 'games' },
    emptyTitle: 'No games fit for now',
    emptyBody: 'This list only shows games with achievement data that are not completed yet. Update again after playing.',
  },
  curated: {
    youHave: 'You own {owned} of {total}',
    completed: { one: '{count} completed', other: '{count} completed' },
    storeLink: 'Opens the Steam store',
    unpublishedTitle: 'Ranking not published',
    unpublishedBody: 'The Essentials ranking comes from the packs in `community/`, in the repository.',
    communityLink: 'See the community',
    errorTitle: 'Could not load the ranking',
  },
  noGames: {
    title: 'No games loaded',
    body: 'Connect a platform and update the library: the automatic lists are computed from your achievements.',
    connect: 'Connect platforms',
  },
  error: { title: 'Could not load the rankings', retry: 'Try again' },
  errors: { load: 'Could not load the rankings', curated: 'Could not load the ranking' },
} satisfies Shape<typeof rankingsPtBR>;

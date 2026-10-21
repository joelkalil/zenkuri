import type { Shape } from '../../types';
import type { communityPtBR } from './pt-BR';

export const communityEn = {
  eyebrow: 'Shared content',
  title: 'Community',
  description: 'Sagas and rankings written by other people, to use as a guide without touching your data.',
  rankingsLink: 'Rankings',
  how: 'Publications come from the packs in the repository\'s `community/` folder and are shown here read-only. To publish, open a PR with your pack (validate it first with `npm run community:validate`).',
  groups: { saga: 'Sagas', ranking: 'Curated rankings' },
  space: {
    publications: { one: 'publication', other: 'publications' },
    updatedAt: 'updated on',
    empty: 'This space has no publications yet.',
  },
  publication: { version: 'v{version}' },
  attribution: {
    curatedBy: 'Curated by',
    space: 'space',
  },
  error: { title: 'Could not load the community', retry: 'Try again' },
  noSpaces: {
    title: 'No spaces published',
    body: 'Spaces come from the folders in `community/`. Add a `space.json` and a pack for it to show up here.',
  },
  errors: { load: 'Could not load the community' },
} satisfies Shape<typeof communityPtBR>;

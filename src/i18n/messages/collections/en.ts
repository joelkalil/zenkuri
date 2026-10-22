import type { Shape } from '../../types';
import type { collectionsPtBR } from './pt-BR';

export const collectionsEn = {
  tabs: {
    label: 'Collection type',
    mine: 'Mine',
    franchises: 'Franchises',
    companies: 'Companies',
  },
  gameCount: { one: '{count} game', other: '{count} games' },
  collectionCount: { one: '{count} collection', other: '{count} collections' },
  mine: {
    back: 'Back to collections',
    saveName: 'Save name',
    cancelEdit: 'Cancel editing',
    rename: 'Rename collection',
    delete: 'Delete collection',
    emptyFiltered: 'No game matching the current filters is in this collection.',
    emptyList: 'No collections yet. Create the first one below or right-click a game.',
    newTitle: 'New collection',
    namePlaceholder: 'Collection name…',
    create: 'Create',
    summary: '{games} · {percent}% average',
  },
  menu: {
    label: 'Collection of {name}',
    add: 'Add to collection',
    remove: 'Remove from collection',
  },
  auto: {
    backTo: 'Back to {title}',
    roles: { dev: 'dev', pub: 'pub', both: 'dev·pub' },
    roleTitles: { dev: 'Developer', pub: 'Publisher', both: 'Developer and publisher' },
    loading: 'Loading collections…',
    emptyTitle: 'No collections found.',
    emptyNone: 'A collection appears when at least 2 library games share the same franchise or company. Update Steam to fetch the metadata.',
    emptyFiltered: 'No collection has games within the current filters.',
    colName: 'Name',
    colGames: 'Games',
    loadFailed: 'Failed to load automatic collections',
  },
  rail: {
    label: 'All games',
    hint: 'All games · right-click for collection',
    filterLabel: 'Filter games',
    filterPlaceholder: 'Filter games…',
    collectionOf: 'Collection: {name}',
  },
} satisfies Shape<typeof collectionsPtBR>;

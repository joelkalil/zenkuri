import { getGameStoreMeta, listUserGamesForCollections } from '../db';
import { listSagaPayloads } from '../community/store';
import { deriveAutoCollections } from './derive';
import { sagaSeedOf } from './rules';

/** Automatic collections (franchises and companies) of the user's library. */
export function getAutoCollections(userId: number) {
  const games = listUserGamesForCollections(userId);
  const meta = getGameStoreMeta(games.map((game) => game.id));
  const sagas = listSagaPayloads().map(({ payload }) => sagaSeedOf(payload));
  return deriveAutoCollections(games, meta, sagas);
}

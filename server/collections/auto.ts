import { getGameStoreMeta, listUserGamesForCollections } from '../db';
import { deriveAutoCollections } from './derive';

/** Coleções automáticas (franquias e empresas) da biblioteca do usuário. */
export function getAutoCollections(userId: number) {
  const games = listUserGamesForCollections(userId);
  const meta = getGameStoreMeta(games.map((game) => game.id));
  return deriveAutoCollections(games, meta);
}

import { useState, useEffect } from 'react';
import { useErrorMessage } from '../i18n/useErrorMessage';
import { fetchAchievements } from '../lib/api';
import type { AchievementWithStatus } from '../types/steam';

export interface GameDetails {
  schema: AchievementWithStatus[];
  player: AchievementWithStatus[];
  merged: AchievementWithStatus[];
  completionPercent: number;
  unlocked: number;
  total: number;
}

export function useGameDetails(appid: number | null) {
  const describe = useErrorMessage();
  const [data, setData] = useState<GameDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!appid) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchAchievements(appid)
      .then((achievements) => {
        if (cancelled) return;
        const unlocked = achievements.filter((achievement) => achievement.achieved).length;
        const total = achievements.length;
        setData({
          schema: achievements,
          player: achievements,
          merged: achievements,
          completionPercent: total > 0 ? Math.round((unlocked / total) * 100) : 0,
          unlocked,
          total,
        });
      })
      .catch((err) => {
        if (!cancelled) setError(describe(err, 'game.loadFailed'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [appid, describe]);

  return { data, loading, error };
}

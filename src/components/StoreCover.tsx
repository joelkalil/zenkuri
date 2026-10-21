import { useMemo, useState } from 'react';
import { steamPortraitUrls } from '../lib/steamStore';

interface StoreCoverProps {
  appid: string;
  title: string;
  className: string;
}

/** Portrait cover straight from the Steam CDN for games that are not in the library. */
export function StoreCover({ appid, title, className }: StoreCoverProps) {
  const srcs = useMemo(() => steamPortraitUrls(appid), [appid]);
  const [index, setIndex] = useState(0);

  if (index >= srcs.length) {
    return (
      <div className={`${className} grid place-items-center bg-gray-800 p-1 text-center font-display text-[9px] font-bold leading-tight text-gray-500`}>
        {title}
      </div>
    );
  }

  return (
    <img
      key={srcs[index]}
      src={srcs[index]}
      alt=""
      loading="lazy"
      onError={() => setIndex((current) => current + 1)}
      className={`${className} object-cover`}
    />
  );
}

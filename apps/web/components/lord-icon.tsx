'use client';

import { useEffect } from 'react';

/** Wired / system outline icons from https://lordicon.com/ — brand-tinted. */
export const LORD_ICONS = {
  avatar: 'https://cdn.lordicon.com/dxjqoygy.json',
  account: 'https://cdn.lordicon.com/kthelypq.json',
  briefcase: 'https://cdn.lordicon.com/fhtaantg.json',
  location: 'https://cdn.lordicon.com/zzcjjxew.json',
  locationPin: 'https://cdn.lordicon.com/surcxhka.json',
  mail: 'https://cdn.lordicon.com/rhvddzym.json',
  document: 'https://cdn.lordicon.com/nocovwne.json',
  check: 'https://cdn.lordicon.com/oqdmuxru.json',
  globe: 'https://cdn.lordicon.com/gqzfzudq.json',
  clock: 'https://cdn.lordicon.com/kbtmbyzy.json',
  coins: 'https://cdn.lordicon.com/qhviklyi.json',
  chart: 'https://cdn.lordicon.com/gqdnbnwt.json',
  home: 'https://cdn.lordicon.com/slduhdil.json',
  tools: 'https://cdn.lordicon.com/wkvacbiw.json',
  close: 'https://cdn.lordicon.com/rmkpgtpt.json',
  search: 'https://cdn.lordicon.com/msoeawqm.json',
  consult: 'https://cdn.lordicon.com/wzrwaorf.json',
  arrow: 'https://cdn.lordicon.com/iiueiwdd.json',
  security: 'https://cdn.lordicon.com/pdwpcpva.json',
  bell: 'https://cdn.lordicon.com/vspbqszr.json',
} as const;

export type LordIconName = keyof typeof LORD_ICONS;

export const LORD_BRAND_COLORS = 'primary:#00246b,secondary:#8ab6f9';

let defined: Promise<void> | null = null;

function defineLordIcon() {
  if (typeof window === 'undefined') return Promise.resolve();
  if (!defined) {
    defined = import('@lordicon/element').then(({ defineElement }) => {
      defineElement();
    });
  }
  return defined;
}

export type LordIconTrigger =
  | 'in'
  | 'hover'
  | 'click'
  | 'loop'
  | 'loop-on-hover'
  | 'morph'
  | 'boomerang';

export function LordIcon({
  name,
  src,
  trigger = 'hover',
  size = 28,
  colors = LORD_BRAND_COLORS,
  stroke = 'bold',
  state,
  target,
  className,
  label,
}: {
  name?: LordIconName;
  src?: string;
  trigger?: LordIconTrigger;
  size?: number;
  colors?: string;
  stroke?: 'light' | 'regular' | 'bold';
  state?: string;
  target?: string;
  className?: string;
  label?: string;
}) {
  useEffect(() => {
    void defineLordIcon();
  }, []);

  const resolved = src ?? (name ? LORD_ICONS[name] : undefined);
  if (!resolved) return null;

  return (
    <lord-icon
      className={className}
      src={resolved}
      trigger={trigger}
      colors={colors}
      stroke={stroke}
      state={state}
      target={target}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      style={{ width: size, height: size }}
    />
  );
}

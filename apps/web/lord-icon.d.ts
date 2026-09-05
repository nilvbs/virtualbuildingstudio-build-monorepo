import type { CSSProperties, HTMLAttributes } from 'react';

type LordIconAttributes = HTMLAttributes<HTMLElement> & {
  src?: string;
  trigger?: string;
  colors?: string;
  stroke?: string;
  state?: string;
  target?: string;
  loading?: string;
  speed?: string | number;
  style?: CSSProperties;
};

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'lord-icon': LordIconAttributes;
    }
  }
}

export {};

'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';

const easeClassic = [0.22, 0.61, 0.36, 1] as const;

function BrandStatic() {
  return (
    <div className="mkt-hero-brand mkt-hero-brand-static">
      <div className="mkt-hero-logo-wrap" role="img" aria-label="BLD">
        <span className="mkt-logo-piece mkt-logo-l" aria-hidden />
        <span className="mkt-logo-piece mkt-logo-b" aria-hidden />
        <span className="mkt-logo-piece mkt-logo-d" aria-hidden />
      </div>
      <p className="mkt-hero-tagline">Site surveys, built around you.</p>
      <span className="mkt-hero-rule" aria-hidden />
    </div>
  );
}

export function HeroBrand() {
  const reduce = useReducedMotion();
  // Avoid SSR/hydration freeze at opacity:0 when client JS fails to hydrate.
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    setAnimate(true);
  }, []);

  if (reduce || !animate) {
    return <BrandStatic />;
  }

  return (
    <motion.div
      className="mkt-hero-brand"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.7, ease: easeClassic }}
    >
      <div className="mkt-hero-logo-wrap" role="img" aria-label="BLD">
        <motion.span
          className="mkt-logo-piece mkt-logo-l"
          aria-hidden
          initial={{ opacity: 0, scaleY: 0.12, y: '22%' }}
          animate={{ opacity: 1, scaleY: 1, y: 0 }}
          transition={{
            duration: 1.55,
            delay: 0.45,
            ease: easeClassic,
          }}
          style={{ transformOrigin: '50% 100%' }}
        />

        <motion.span
          className="mkt-logo-piece mkt-logo-b"
          aria-hidden
          initial={{ opacity: 0, x: '-62vw' }}
          animate={{ opacity: 1, x: 0 }}
          transition={{
            type: 'spring',
            stiffness: 48,
            damping: 18,
            mass: 1.05,
            delay: 1.15,
            opacity: { duration: 1, delay: 1.15, ease: easeClassic },
          }}
        />

        <motion.span
          className="mkt-logo-piece mkt-logo-d"
          aria-hidden
          initial={{ opacity: 0, x: '62vw' }}
          animate={{ opacity: 1, x: 0 }}
          transition={{
            type: 'spring',
            stiffness: 48,
            damping: 18,
            mass: 1.05,
            delay: 1.15,
            opacity: { duration: 1, delay: 1.15, ease: easeClassic },
          }}
        />
      </div>

      <div className="mkt-hero-tagline-mask">
        <motion.p
          className="mkt-hero-tagline"
          initial={{ opacity: 0, y: '110%' }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.35, delay: 2.85, ease: easeClassic }}
        >
          Site surveys, built around you.
        </motion.p>
      </div>

      <motion.span
        className="mkt-hero-rule"
        aria-hidden
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: 1, opacity: 1 }}
        transition={{ duration: 1.1, delay: 3.35, ease: easeClassic }}
        style={{ transformOrigin: '50% 50%' }}
      />
    </motion.div>
  );
}

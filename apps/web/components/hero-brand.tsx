'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';

const easeClassic = [0.22, 0.61, 0.36, 1] as const;
const MOBILE_LOGO_QUERY = '(max-width: 768px)';

function LogoPieces({
  animated,
  tone,
}: {
  animated: boolean;
  tone: 'dark' | 'light' | 'brand';
}) {
  const pieceClass =
    tone === 'light'
      ? 'mkt-logo-piece mkt-logo-piece--light'
      : tone === 'brand'
        ? 'mkt-logo-piece mkt-logo-piece--brand'
        : 'mkt-logo-piece';

  if (!animated) {
    return (
      <div className="mkt-hero-logo-wrap" role="img" aria-label="BLD">
        <span className={`${pieceClass} mkt-logo-l`} aria-hidden />
        <span className={`${pieceClass} mkt-logo-b`} aria-hidden />
        <span className={`${pieceClass} mkt-logo-d`} aria-hidden />
      </div>
    );
  }

  return (
    <div className="mkt-hero-logo-wrap" role="img" aria-label="BLD">
      <motion.span
        className={`${pieceClass} mkt-logo-l`}
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
        className={`${pieceClass} mkt-logo-b`}
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
        className={`${pieceClass} mkt-logo-d`}
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
  );
}

export function HeroBrand({ tone = 'dark' }: { tone?: 'dark' | 'light' | 'brand' }) {
  const reduce = useReducedMotion();
  const [animate, setAnimate] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setAnimate(true);

    const media = window.matchMedia(MOBILE_LOGO_QUERY);
    const syncMobile = () => setIsMobile(media.matches);
    syncMobile();
    media.addEventListener('change', syncMobile);

    return () => media.removeEventListener('change', syncMobile);
  }, []);

  const animated = animate && !reduce && !isMobile;
  const className = 'mkt-hero-brand mkt-hero-brand--nav';

  if (!animated) {
    return (
      <div className={className}>
        <LogoPieces animated={false} tone={tone} />
      </div>
    );
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.7, ease: easeClassic }}
    >
      <LogoPieces animated tone={tone} />
    </motion.div>
  );
}

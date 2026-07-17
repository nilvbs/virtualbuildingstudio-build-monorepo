'use client';

import {
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  type MotionValue,
} from 'motion/react';
import { useEffect, useRef, useState, type RefObject } from 'react';

/** Two equal, shallow waves — track sits below the card row. */
const ROUTE =
  'M90 280 C 158 230, 227 230, 295 280 C 363 330, 432 330, 500 280 C 568 230, 637 230, 705 280 C 773 330, 842 330, 910 280';

/** SVG y where the ABOVE card's bottom edge meets its stem. */
const CARD_ABOVE_EDGE = 178;
/** SVG y where the BELOW card's top edge meets its stem. */
const CARD_BELOW_EDGE = 344;
/** Stem stops at pin rim so the joint reads cleanly. */
const PIN_R = 8;

const STEPS = [
  {
    id: 1,
    label: '01',
    title: 'Share the brief',
    sub: 'Site · services · timing',
    cx: 90,
    cy: 280,
    dir: 'down' as const,
  },
  {
    id: 2,
    label: '02',
    title: 'Get matched',
    sub: 'Surveyor near your site',
    cx: 500,
    cy: 280,
    dir: 'up' as const,
  },
  {
    id: 3,
    label: '03',
    title: 'Survey delivered',
    sub: 'Visit · results in',
    cx: 910,
    cy: 280,
    dir: 'down' as const,
  },
] as const;

const easeClassic = [0.22, 0.61, 0.36, 1] as const;

function useTraveler(progress: MotionValue<number>, pathRef: RefObject<SVGPathElement | null>) {
  const x = useMotionValue(STEPS[0].cx as number);
  const y = useMotionValue(STEPS[0].cy as number);
  const rotate = useMotionValue(0);

  useMotionValueEvent(progress, 'change', (t) => {
    const path = pathRef.current;
    if (!path) return;
    const len = path.getTotalLength();
    const d = Math.max(0, Math.min(1, t)) * len;
    const p = path.getPointAtLength(d);
    const p2 = path.getPointAtLength(Math.min(len, d + 1.5));
    x.set(p.x);
    y.set(p.y);
    rotate.set((Math.atan2(p2.y - p.y, p2.x - p.x) * 180) / Math.PI);
  });

  return { x, y, rotate };
}

function activeFromProgress(t: number) {
  if (t < 0.22) return 1;
  if (t < 0.72) return 2;
  return 3;
}

export function HeroJourney() {
  const reduce = useReducedMotion();
  const pathRef = useRef<SVGPathElement | null>(null);
  const progress = useMotionValue(reduce ? 0.5 : 0);
  const comet = useMotionValue(0);
  const cometOpacity = useMotionValue(0);
  const { x, y, rotate } = useTraveler(progress, pathRef);
  const [active, setActive] = useState(reduce ? 2 : 1);

  useMotionValueEvent(progress, 'change', (t) => {
    setActive(activeFromProgress(t));
  });

  useEffect(() => {
    if (reduce) {
      progress.set(0.5);
      return;
    }

    const intro = animate(progress, 0.02, { duration: 0.01 });

    const run = animate(progress, [0, 0, 0.48, 0.48, 1, 1], {
      duration: 12,
      times: [0, 0.1, 0.38, 0.52, 0.8, 0.93],
      ease: easeClassic,
      repeat: Infinity,
      repeatDelay: 0.9,
      delay: 0.35,
    });

    const cometRun = animate(comet, [0, -148], {
      duration: 2.8,
      ease: 'linear',
      repeat: Infinity,
    });

    const cometFade = animate(cometOpacity, [0, 1], {
      duration: 0.7,
      delay: 0.5,
      ease: easeClassic,
    });

    return () => {
      intro.stop();
      run.stop();
      cometRun.stop();
      cometFade.stop();
    };
  }, [progress, comet, cometOpacity, reduce]);

  return (
    <div className="mkt-hero-journey" aria-hidden>
      <div className="mkt-hero-journey-frame">
        <svg className="mkt-hero-route" viewBox="0 0 1000 420" preserveAspectRatio="xMidYMid meet">
          <defs>
            <linearGradient id="mkt-route-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#CADCFC" />
              <stop offset="50%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#8AB6F9" />
            </linearGradient>
            <filter id="mkt-route-glow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="2.8" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <mask id="mkt-route-reveal" maskUnits="userSpaceOnUse">
              <motion.path
                d={ROUTE}
                fill="none"
                stroke="#fff"
                strokeWidth={18}
                strokeLinecap="round"
                style={{ pathLength: progress }}
              />
            </mask>
          </defs>

          <path className="mkt-hero-route-shadow" d={ROUTE} />
          <path className="mkt-hero-route-track-under" d={ROUTE} />
          <path className="mkt-hero-route-track-faint" d={ROUTE} />

          <path ref={pathRef} d={ROUTE} fill="none" stroke="none" />

          <g mask="url(#mkt-route-reveal)" filter="url(#mkt-route-glow)">
            <path className="mkt-hero-route-track-under is-lit" d={ROUTE} />
            <path className="mkt-hero-route-track" d={ROUTE} stroke="url(#mkt-route-grad)" />
            {!reduce && (
              <motion.path
                className="mkt-hero-route-track-flow"
                d={ROUTE}
                style={{ strokeDashoffset: comet, opacity: cometOpacity }}
              />
            )}
          </g>

          {STEPS.map((step, i) => {
            const pinEdge = step.dir === 'up' ? step.cy - PIN_R : step.cy + PIN_R;
            const cardEdge = step.dir === 'up' ? CARD_ABOVE_EDGE : CARD_BELOW_EDGE;
            return (
              <motion.g
                key={`stem-${step.id}`}
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{
                  duration: 0.7,
                  delay: reduce ? 0 : 0.45 + 0.14 * i,
                  ease: easeClassic,
                }}
              >
                <line
                  className="mkt-hero-route-stem-under"
                  x1={step.cx}
                  y1={pinEdge}
                  x2={step.cx}
                  y2={cardEdge}
                />
                <line
                  className="mkt-hero-route-stem"
                  x1={step.cx}
                  y1={pinEdge}
                  x2={step.cx}
                  y2={cardEdge}
                />
                <circle
                  className="mkt-hero-route-stem-cap"
                  cx={step.cx}
                  cy={cardEdge}
                  r={3.25}
                />
              </motion.g>
            );
          })}

          {STEPS.map((step, i) => {
            const isActive = active === step.id;
            return (
              <motion.circle
                key={step.id}
                className="mkt-hero-route-pin"
                cx={step.cx}
                cy={step.cy}
                stroke="#00246B"
                strokeWidth={2.5}
                initial={reduce ? false : { opacity: 0, r: 3 }}
                animate={{
                  r: isActive ? 9.5 : PIN_R,
                  fill: isActive ? '#8AB6F9' : '#ffffff',
                  opacity: 1,
                }}
                transition={{
                  opacity: {
                    duration: 0.55,
                    delay: reduce ? 0 : 0.4 + 0.12 * i,
                    ease: easeClassic,
                  },
                  r: { duration: 0.45, ease: easeClassic },
                  fill: { duration: 0.45, ease: easeClassic },
                }}
              />
            );
          })}

          {!reduce && (
            <motion.g
              className="mkt-hero-route-traveler"
              style={{ x, y, rotate, transformOrigin: '0px 0px' }}
            >
              <circle r="14" fill="rgba(138,182,249,0.2)" />
              <circle r="6.5" fill="#fff" stroke="#00246B" strokeWidth="2" />
              <path d="M9 0 L15.5 -3.8 L15.5 3.8 Z" fill="#fff" />
            </motion.g>
          )}
        </svg>

        {STEPS.map((step, i) => {
          const isActive = active === step.id;
          const fromY = step.dir === 'up' ? -16 : 16;
          return (
            <article
              key={step.id}
              className={`mkt-hero-route-step mkt-hero-route-step-${step.id}${
                isActive ? ' is-active' : ''
              } is-loaded`}
            >
              <motion.div
                initial={reduce ? false : { opacity: 0, y: fromY }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.75,
                  ease: easeClassic,
                  delay: reduce ? 0 : 0.55 + 0.16 * i,
                }}
              >
                <motion.div
                  className="mkt-hero-route-step-card"
                  initial={false}
                  animate={{
                    opacity: isActive ? 1 : 0.9,
                    scale: isActive ? 1.015 : 1,
                  }}
                  transition={{ duration: 0.45, ease: easeClassic }}
                >
                  <strong>{step.label}</strong>
                  <span>
                    <em>{step.title}</em>
                    <small>{step.sub}</small>
                  </span>
                </motion.div>
              </motion.div>
            </article>
          );
        })}
      </div>
    </div>
  );
}


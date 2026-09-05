'use client';

import { AnimatePresence, motion, useReducedMotion, type Transition } from 'motion/react';

const SKIN = '#efbe95';
const SKIN_SH = '#cf9265';
const HAIR = '#2b2420';
const TEE = '#1d1d1d';
const TEE_SH = '#121212';
const JEAN = '#5183c9';
const JEAN_DK = '#3f6cab';
const SHOE = '#262931';
const LENS = '#f4f9ff';

const WAITING = [
  'Scanning services…',
  'Scanning coverage…',
  'Scanning rates…',
  'Scanning showcase…',
];

const RUNNING = ['Moving…', 'Rescanning…', 'Hold laser…', 'Locked…'];

export function SurveyorIdentityFigure({
  step,
  mood,
  named,
}: {
  step: number;
  mood: 'waiting' | 'running' | 'done';
  named?: string;
}) {
  const reduce = useReducedMotion();
  const stage = Math.max(0, Math.min(3, step));
  const running = mood === 'running';
  const done = mood === 'done';
  const line = done ? `${(named || 'You').slice(0, 14)}` : running ? RUNNING[stage] : WAITING[stage];

  return (
    <div className={`svy-idfig${running ? ' is-walking' : ''}`} aria-hidden>
      <motion.div
        className="svy-idfig-stage"
        animate={
          reduce
            ? undefined
            : running
              ? { y: [0, -1.2, 0, -0.8, 0], x: [0, 0.6, 0, -0.6, 0] }
              : { y: [0, -0.5, 0] }
        }
        transition={{ duration: running ? 0.7 : 2.4, repeat: Infinity, ease: 'easeInOut' }}
      >
        <svg viewBox="0 0 56 64" className="svy-idfig-svg">
          <g transform="translate(8 4)">
            <ellipse cx="20" cy="53.4" rx="8.6" ry="1.5" fill="rgba(113,104,246,0.14)" />
            <StandPose reduce={!!reduce} scanning />
          </g>
        </svg>
      </motion.div>
      <AnimatePresence mode="wait">
        <motion.p
          key={line}
          className="svy-idfig-line"
          initial={reduce ? false : { opacity: 0, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? undefined : { opacity: 0 }}
        >
          {line}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

function Head() {
  return (
    <g>
      <ellipse cx="13.5" cy="11.9" rx="1.2" ry="1.7" fill={SKIN_SH} />
      <ellipse cx="26.5" cy="11.9" rx="1.2" ry="1.7" fill={SKIN_SH} />
      <path
        d="M13.7 9.4 a6.3 6.4 0 0 1 12.6 0 v2.2 q0 5.2 -6.3 5.5 q-6.3 -0.3 -6.3 -5.5 z"
        fill={SKIN}
      />
      <path
        d="M13.8 9.2 q-0.5 -6.5 6.2 -6.9 q6.7 -0.4 6.2 6.9 q-1.4 -3 -6.2 -3.1 q-4.8 0.1 -6.2 3.1 z"
        fill={HAIR}
      />
      <path d="M13.7 8.6 q-0.4 2.6 0.1 4.4 l-1.1 -0.5 q-0.6 -2.2 0 -4.2 z" fill={HAIR} />
      <path d="M26.3 8.6 q0.4 2.6 -0.1 4.4 l1.1 -0.5 q0.6 -2.2 0 -4.2 z" fill={HAIR} />
      <path d="M14.6 11.4 H12.9" stroke={HAIR} strokeWidth="0.7" strokeLinecap="round" />
      <path d="M25.4 11.4 H27.1" stroke={HAIR} strokeWidth="0.7" strokeLinecap="round" />
      <circle cx="17.1" cy="11.5" r="2.35" fill={LENS} stroke={HAIR} strokeWidth="0.85" />
      <circle cx="22.9" cy="11.5" r="2.35" fill={LENS} stroke={HAIR} strokeWidth="0.85" />
      <path d="M19.5 11.2 h1" stroke={HAIR} strokeWidth="0.7" strokeLinecap="round" />
      <circle cx="17.3" cy="11.7" r="0.92" fill="#1b2330" />
      <circle cx="23.1" cy="11.7" r="0.92" fill="#1b2330" />
      <circle cx="17.62" cy="11.34" r="0.28" fill="#fff" />
      <circle cx="23.42" cy="11.34" r="0.28" fill="#fff" />
      <path d="M19.5 13.1 q0.5 1.1 1 0" fill="none" stroke={SKIN_SH} strokeWidth="0.7" strokeLinecap="round" />
      <path d="M18.2 15 q1.8 1.6 3.6 0" fill="none" stroke={SKIN_SH} strokeWidth="0.75" strokeLinecap="round" />
    </g>
  );
}

function Shoe({ cx, y }: { cx: number; y: number }) {
  return (
    <path
      d={`M${cx - 2.7} ${y + 1} q0 -2 2.7 -2 q2.7 0 2.7 2 v1.1 q0 1.1 -2.7 1.1 q-2.7 0 -2.7 -1.1 z`}
      fill={SHOE}
    />
  );
}

function Torso() {
  return (
    <g>
      <path d="M17.9 16.6 h4.2 v3.1 h-4.2 z" fill={SKIN_SH} />
      <path
        d="M13.5 21.6 q0.4 -2.8 3.1 -3.6 l1.8 -0.5 q1.6 1 3.2 0 l1.8 0.5 q2.7 0.8 3.1 3.6 l0.6 9.6 q-7.1 2.6 -14.2 0 z"
        fill={TEE}
      />
      <path d="M18.3 17.4 q1.7 1.5 3.4 0 q-0.4 2.1 -1.7 2.1 q-1.3 0 -1.7 -2.1 z" fill={SKIN_SH} />
      <path d="M13.6 21.9 q1 -3 3.6 -3.7 l0.4 1.5 q-2.2 0.9 -2.9 3.4 z" fill={TEE_SH} />
      <path d="M26.4 21.9 q-1 -3 -3.6 -3.7 l-0.4 1.5 q2.2 0.9 2.9 3.4 z" fill={TEE_SH} />
      <path d="M13.6 28.6 q7.1 2.5 12.8 0 l0.1 1.9 q-6.3 2.5 -12.8 0 z" fill={TEE_SH} />
    </g>
  );
}

function Hips() {
  return <path d="M13.6 30.2 q6.4 2.6 12.8 0 l0.5 4.6 q-6.9 2.4 -13.8 0 z" fill={JEAN} />;
}

/** Left arm: upper arm shoulder→elbow, forearm elbow→wrist, drawn behind the torso. */
function ArmLeft({ rotate, transition }: { rotate?: number[]; transition?: Transition }) {
  return (
    <motion.g
      style={{ transformOrigin: '14.2px 21.8px' }}
      animate={rotate ? { rotate } : undefined}
      transition={transition}
    >
      <path d="M14.2 21.8 L13.4 26.6" stroke={SKIN} strokeWidth="3" strokeLinecap="round" fill="none" />
      <path d="M13.4 26.6 L13.6 31.4" stroke={SKIN} strokeWidth="2.8" strokeLinecap="round" fill="none" />
      <circle cx="13.8" cy="32.5" r="1.5" fill={SKIN} />
    </motion.g>
  );
}

/** Right arm with a hinged elbow so the wrist can come up to the face without shearing. */
function ArmRight({
  rotate,
  forearm,
  transition,
  watch,
}: {
  rotate?: number[];
  forearm?: number[];
  transition?: Transition;
  watch?: boolean;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.g
      style={{ transformOrigin: '25.8px 21.8px' }}
      animate={rotate ? { rotate } : undefined}
      transition={transition}
    >
      <path d="M25.8 21.8 L26.6 26.6" stroke={SKIN} strokeWidth="3" strokeLinecap="round" fill="none" />
      <motion.g
        style={{ transformOrigin: '26.6px 26.6px' }}
        animate={forearm ? { rotate: forearm } : undefined}
        transition={transition}
      >
        <path d="M26.6 26.6 L26.4 31.4" stroke={SKIN} strokeWidth="2.8" strokeLinecap="round" fill="none" />
        <circle cx="26.3" cy="32.5" r="1.5" fill={SKIN} />
        {watch ? (
          <g>
            <rect x="24.7" y="27.9" width="3.9" height="1.3" rx="0.6" fill="#2b3340" />
            <circle cx="26.6" cy="29.3" r="1.95" fill="#fff" stroke="#1e2530" strokeWidth="0.7" />
            <motion.path
              d="M26.6 29.3 V27.9"
              stroke="#c2410c"
              strokeWidth="0.6"
              strokeLinecap="round"
              style={{ transformOrigin: '26.6px 29.3px' }}
              animate={reduce ? undefined : { rotate: 360 }}
              transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
            />
          </g>
        ) : null}
      </motion.g>
      <path d="M25.6 20.6 L26.2 23.4" stroke={TEE} strokeWidth="3.6" strokeLinecap="round" fill="none" />
    </motion.g>
  );
}

function StandPose({ reduce, scanning = false }: { reduce: boolean; scanning?: boolean }) {
  return (
    <g>
      <path d="M16.9 33 V48.6" stroke={JEAN} strokeWidth="5.1" strokeLinecap="round" fill="none" />
      <path d="M23.1 33 V48.6" stroke={JEAN} strokeWidth="5.1" strokeLinecap="round" fill="none" />
      <path d="M20 33.4 V47.6" stroke={JEAN_DK} strokeWidth="0.8" strokeLinecap="round" fill="none" />
      <Shoe cx={16.9} y={49.4} />
      <Shoe cx={23.1} y={49.4} />
      <Hips />
      <ArmLeft />
      <Torso />
      {/* Scanner aimed into the building facade */}
      <g transform="translate(2 -1) rotate(-12 30 18)">
        <path d="M27.2 24.2 L33.2 10.8" stroke="#2b2420" strokeWidth="2.2" strokeLinecap="round" />
        <rect x="30.2" y="6.4" width="5.4" height="6" rx="1.2" fill="#7168f6" />
        <rect x="31" y="7.2" width="3.8" height="2.2" rx="0.6" fill="#f4f6ff" opacity="0.9" />
        {scanning ? (
          <motion.circle
            cx="33"
            cy="6.2"
            r="1.5"
            fill="#a29bff"
            animate={reduce ? undefined : { opacity: [0.35, 1, 0.35] }}
            transition={{ duration: 0.9, repeat: Infinity, ease: 'easeInOut' }}
          />
        ) : null}
      </g>
      <ArmRight
        rotate={reduce ? [22] : [18, 24, 18]}
        forearm={reduce ? [-30] : [-28, -34, -28]}
      />
      <motion.g
        style={{ transformOrigin: '20px 17px' }}
        animate={reduce ? undefined : { rotate: [0, -2.5, 0, 2.5, 0] }}
        transition={{ duration: 5.6, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Head />
      </motion.g>
    </g>
  );
}

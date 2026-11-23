import React, { useEffect } from 'react';
import { motion, useReducedMotion } from 'motion/react';

interface SplashScreenProps {
  onComplete: () => void;
  durationMs?: number;
}

const WORD_ONE = ['I', 'n', 'd', 'o', 'o', 'r'];
const WORD_TWO = ['N', 'a', 'v', 'i', 'g', 'a', 't', 'i', 'o', 'n'];

export const SplashScreen: React.FC<SplashScreenProps> = ({
  onComplete,
  durationMs = 2700,
}) => {
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      onComplete();
    }, prefersReducedMotion ? 1600 : durationMs);

    return () => window.clearTimeout(timer);
  }, [onComplete, durationMs, prefersReducedMotion]);

  return (
    <div
      className="relative min-h-screen w-full bg-[#070B14] text-slate-100 flex flex-col items-center justify-center px-6 overflow-hidden select-none"
      aria-label="Indoor Navigation intro"
    >
      {/* Ambient Brand Gradient Glows matching Dashboard */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-36 -left-36 w-[28rem] h-[28rem] rounded-full bg-cyan-500/12 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-36 -right-36 w-[28rem] h-[28rem] rounded-full bg-blue-600/12 blur-3xl"
      />
      <motion.div
        aria-hidden="true"
        initial={{ opacity: 0, scale: prefersReducedMotion ? 1 : 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: prefersReducedMotion ? 0.4 : 1.1, ease: [0.16, 1, 0.3, 1] }}
        className="pointer-events-none absolute w-72 h-72 rounded-full bg-gradient-to-tr from-cyan-500/15 via-sky-500/10 to-blue-600/15 blur-2xl"
      />

      {/* Centered Logo Lockup — fixed footprint prevents layout shift */}
      <div className="relative z-10 flex flex-col items-center text-center">
        {/* (a) Indoor Navigation Compass + Beacon Signal Rings */}
        <motion.div
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.78 }}
          animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-24 h-24 flex items-center justify-center mb-6"
        >
          {/* Expanding RF / Positioning Beacon Pulse Ring */}
          {!prefersReducedMotion && (
            <motion.div
              aria-hidden="true"
              className="absolute inset-0 rounded-2xl border border-cyan-400/50"
              initial={{ opacity: 0.7, scale: 0.9 }}
              animate={{ opacity: [0.65, 0], scale: [0.95, 1.48] }}
              transition={{
                duration: 1.8,
                delay: 0.45,
                repeat: Infinity,
                ease: 'easeOut',
              }}
            />
          )}

          <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-cyan-500/85 to-blue-600/85 p-[1.5px] shadow-[0_0_40px_rgba(6,182,212,0.24)]">
            <div className="w-full h-full rounded-[14.5px] bg-[#0F172A] flex items-center justify-center">
              <svg
                viewBox="0 0 64 64"
                className="w-12 h-12"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="nav-emblem-grad" x1="12" y1="10" x2="52" y2="54" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#22D3EE" />
                    <stop offset="100%" stopColor="#3B82F6" />
                  </linearGradient>
                </defs>

                {/* Outer compass ring drawing in */}
                <motion.circle
                  cx="32"
                  cy="32"
                  r="21"
                  stroke="url(#nav-emblem-grad)"
                  strokeWidth="2.2"
                  strokeOpacity="0.65"
                  initial={prefersReducedMotion ? { opacity: 1 } : { pathLength: 0, opacity: 0 }}
                  animate={prefersReducedMotion ? { opacity: 1 } : { pathLength: 1, opacity: 1 }}
                  transition={{ duration: 0.75, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                />

                {/* Inner positioning ring */}
                <motion.circle
                  cx="32"
                  cy="32"
                  r="13.5"
                  stroke="#38BDF8"
                  strokeWidth="1.5"
                  strokeOpacity="0.38"
                  strokeDasharray="3 3"
                  initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.7 }}
                  animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
                />

                {/* Navigation arrow / compass needle rotating gently into bearing */}
                <motion.g
                  style={{ transformOrigin: '32px 32px' }}
                  initial={
                    prefersReducedMotion
                      ? { opacity: 0 }
                      : { opacity: 0, rotate: -35, scale: 0.7 }
                  }
                  animate={
                    prefersReducedMotion
                      ? { opacity: 1 }
                      : { opacity: 1, rotate: 0, scale: 1 }
                  }
                  transition={{ duration: 0.7, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
                >
                  <polygon points="32,14 40,32 32,27.5 24,32" fill="#22D3EE" />
                  <polygon points="32,50 40,32 32,36.5 24,32" fill="#3B82F6" fillOpacity="0.85" />
                  <circle cx="32" cy="32" r="3" fill="#FFFFFF" />
                </motion.g>
              </svg>
            </div>
          </div>
        </motion.div>

        {/* (b) Wordmark "Indoor Navigation" letter-by-letter slide-up & fade */}
        <h1
          className="text-3xl sm:text-5xl font-bold tracking-tight text-white flex flex-wrap items-center justify-center gap-x-3 min-h-[3.5rem] drop-shadow-[0_0_18px_rgba(34,211,238,0.28)]"
          aria-label="Indoor Navigation"
        >
          <span className="inline-flex">
            {WORD_ONE.map((char, index) => (
              <motion.span
                key={`w1-${char}-${index}`}
                initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 18 }}
                animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                transition={{
                  duration: 0.42,
                  delay: prefersReducedMotion ? 0.15 : 0.48 + index * 0.04,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="inline-block text-white"
              >
                {char}
              </motion.span>
            ))}
          </span>

          <span className="inline-flex">
            {WORD_TWO.map((char, index) => (
              <motion.span
                key={`w2-${char}-${index}`}
                initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 18 }}
                animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                transition={{
                  duration: 0.42,
                  delay: prefersReducedMotion ? 0.15 : 0.72 + index * 0.04,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="inline-block text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400"
              >
                {char}
              </motion.span>
            ))}
          </span>
        </h1>

        {/* (c) Tagline below fades in */}
        <motion.p
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
          animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          transition={{
            duration: 0.55,
            delay: prefersReducedMotion ? 0.3 : 1.25,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="mt-3 text-sm sm:text-base font-medium text-slate-400 tracking-wide"
        >
          Precision indoor positioning &amp; live wayfinding.
        </motion.p>
      </div>
    </div>
  );
};

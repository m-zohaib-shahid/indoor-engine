import React, { useState, useCallback, useEffect, useRef } from 'react';
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'motion/react';
import { SplashScreen } from './components/SplashScreen';
import { AuthScreen } from './components/AuthScreen';
import { CleanNavigationDashboard } from './components/CleanNavigationDashboard';
import { authService, AuthUser } from './services/authService';
import { initialOAuthCallbackError } from './lib/insforge';

type AppScreen = 'splash' | 'auth' | 'dashboard';

export default function App() {
  const prefersReducedMotion = useReducedMotion();
  const [screen, setScreen] = useState<AppScreen>('splash');
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authBannerError, setAuthBannerError] = useState<string | null>(
    initialOAuthCallbackError
  );

  const sessionCheckRef = useRef<Promise<AuthUser | null> | null>(null);

  useEffect(() => {
    // Resolve real InsForge session (and any OAuth PKCE callback) in parallel with SplashScreen
    sessionCheckRef.current = authService.getCurrentUser();
  }, []);

  const handleSplashComplete = useCallback(async () => {
    const checkPromise = sessionCheckRef.current ?? authService.getCurrentUser();
    const existingUser = await checkPromise;
    if (existingUser) {
      setCurrentUser(existingUser);
      setAuthBannerError(null);
      setScreen('dashboard');
    } else {
      setScreen('auth');
    }
  }, []);

  const handleAuthSuccess = useCallback((user: AuthUser) => {
    setCurrentUser(user);
    setAuthBannerError(null);
    setScreen('dashboard');
  }, []);

  const handleSignOut = useCallback(async () => {
    await authService.signOut();
    setCurrentUser(null);
    setAuthBannerError(null);
    setScreen('auth');
  }, []);

  const pageVariants = prefersReducedMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
      }
    : {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -10 },
      };

  return (
    <MotionConfig reducedMotion="user">
      <div className="relative min-h-screen bg-[#070B14] select-none overflow-x-hidden">
        <AnimatePresence mode="wait">
          {screen === 'splash' && (
            <motion.div
              key="splash"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              <SplashScreen onComplete={handleSplashComplete} />
            </motion.div>
          )}

          {screen === 'auth' && (
            <motion.div
              key="auth"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              <AuthScreen
                onAuthSuccess={handleAuthSuccess}
                initialError={authBannerError}
              />
            </motion.div>
          )}

          {screen === 'dashboard' && currentUser && (
            <motion.div
              key="dashboard"
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              <CleanNavigationDashboard
                currentUser={currentUser}
                onSignOut={handleSignOut}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}

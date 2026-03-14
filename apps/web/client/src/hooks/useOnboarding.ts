import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  target: string; // CSS selector
  position?: 'top' | 'bottom' | 'left' | 'right';
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface OnboardingState {
  isActive: boolean;
  currentStep: number;
  completedSteps: string[];
}

const ONBOARDING_KEY = 'nexogestao_onboarding';

export function useOnboarding(steps: OnboardingStep[]) {
  const { user } = useAuth();
  const [state, setState] = useState<OnboardingState>(() => {
    const saved = localStorage.getItem(ONBOARDING_KEY);
    return saved
      ? JSON.parse(saved)
      : { isActive: false, currentStep: 0, completedSteps: [] };
  });

  useEffect(() => {
    if (user && !state.isActive && state.completedSteps.length === 0) {
      const createdAt = new Date(user.createdAt).getTime();
      const now = Date.now();
      const isNewUser = now - createdAt < 60 * 60 * 1000;

      if (isNewUser) {
        startOnboarding();
      }
    }
  }, [user, state.isActive, state.completedSteps.length]);

  useEffect(() => {
    localStorage.setItem(ONBOARDING_KEY, JSON.stringify(state));
  }, [state]);

  const startOnboarding = () => {
    setState((prev) => ({ ...prev, isActive: true, currentStep: 0 }));
  };

  const nextStep = () => {
    setState((prev) => {
      const newStep = prev.currentStep + 1;

      if (newStep >= steps.length) {
        return {
          ...prev,
          isActive: false,
          completedSteps: steps.map((s) => s.id),
        };
      }

      return { ...prev, currentStep: newStep };
    });
  };

  const skipOnboarding = () => {
    setState((prev) => ({
      ...prev,
      isActive: false,
      completedSteps: steps.map((s) => s.id),
    }));
  };

  const resetOnboarding = () => {
    localStorage.removeItem(ONBOARDING_KEY);
    setState({ isActive: false, currentStep: 0, completedSteps: [] });
  };

  const currentStepData = state.isActive ? steps[state.currentStep] : null;

  return {
    isActive: state.isActive,
    currentStep: state.currentStep,
    currentStepData,
    completedSteps: state.completedSteps,
    startOnboarding,
    nextStep,
    skipOnboarding,
    resetOnboarding,
    progress: state.isActive ? ((state.currentStep + 1) / steps.length) * 100 : 0,
  };
}

import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  target: string; // CSS selector
  position?: "top" | "bottom" | "left" | "right";
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

const ONBOARDING_KEY = "nexogestao_onboarding";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getEnvelope(payload: unknown): Record<string, unknown> | null {
  if (!isObject(payload)) return null;

  if (isObject(payload.data) && isObject(payload.data.data)) {
    return payload.data.data;
  }

  return payload;
}

function getRequiresOnboarding(payload: unknown): boolean {
  const env = getEnvelope(payload);
  return Boolean(env?.requiresOnboarding);
}

export function useOnboarding(steps: OnboardingStep[]) {
  const { user, payload, isAuthenticated } = useAuth();

  const [state, setState] = useState<OnboardingState>(() => {
    const saved = localStorage.getItem(ONBOARDING_KEY);
    return saved
      ? JSON.parse(saved)
      : { isActive: false, currentStep: 0, completedSteps: [] };
  });

  useEffect(() => {
    const requiresOnboarding = getRequiresOnboarding(payload);

    if (
      isAuthenticated &&
      user &&
      requiresOnboarding &&
      !state.isActive &&
      state.completedSteps.length === 0
    ) {
      startOnboarding();
    }
  }, [
    isAuthenticated,
    payload,
    state.isActive,
    state.completedSteps.length,
    user,
  ]);

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
    progress:
      state.isActive && steps.length > 0
        ? ((state.currentStep + 1) / steps.length) * 100
        : 0,
  };
}

"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface SmoothProgressOptions {
  duration?: number; // Animation duration in ms
  easing?: (t: number) => number; // Easing function
  threshold?: number; // Minimum change to trigger animation
  onUpdate?: (value: number) => void; // Callback on each frame
  onComplete?: () => void; // Callback when animation completes
}

const defaultEasing = (t: number): number => {
  // Ease out cubic
  return 1 - Math.pow(1 - t, 3);
};

export function useSmoothProgress(options: SmoothProgressOptions = {}) {
  const {
    duration = 500,
    easing = defaultEasing,
    threshold = 0.1,
    onUpdate,
    onComplete,
  } = options;

  const [currentValue, setCurrentValue] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const startValueRef = useRef(0);
  const targetValueRef = useRef(0);

  const animate = useCallback(
    (timestamp: number) => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp;
      }

      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easing(progress);

      const startValue = startValueRef.current;
      const targetValue = targetValueRef.current;
      const newValue = startValue + (targetValue - startValue) * easedProgress;

      setCurrentValue(newValue);
      onUpdate?.(newValue);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setIsAnimating(false);
        animationRef.current = null;
        startTimeRef.current = null;
        onComplete?.();
      }
    },
    [duration, easing, onUpdate, onComplete]
  );

  const animateTo = useCallback(
    (targetValue: number) => {
      // Cancel any existing animation
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }

      // Check if animation is needed
      if (Math.abs(targetValue - currentValue) < threshold) {
        setCurrentValue(targetValue);
        return;
      }

      // Start new animation
      startValueRef.current = currentValue;
      targetValueRef.current = targetValue;
      startTimeRef.current = null;
      setIsAnimating(true);

      animationRef.current = requestAnimationFrame(animate);
    },
    [currentValue, threshold, animate]
  );

  const jumpTo = useCallback((value: number) => {
    // Cancel any existing animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    setCurrentValue(value);
    setIsAnimating(false);
    startTimeRef.current = null;
  }, []);

  const reset = useCallback(() => {
    jumpTo(0);
  }, [jumpTo]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return {
    value: currentValue,
    isAnimating,
    animateTo,
    jumpTo,
    reset,
  };
}

// Hook for managing multiple smooth progress values
export function useSmoothProgressGroup() {
  const progressInstances = useRef(
    new Map<string, ReturnType<typeof useSmoothProgress>>()
  );

  const createProgress = useCallback(
    (key: string, options: SmoothProgressOptions = {}) => {
      if (!progressInstances.current.has(key)) {
        // This is a simplified version - in practice, you'd need to handle the hook rules properly
        // For now, we'll return a basic implementation
        const progress = {
          value: 0,
          isAnimating: false,
          animateTo: (value: number) => {},
          jumpTo: (value: number) => {},
          reset: () => {},
        };
        progressInstances.current.set(key, progress);
      }
      return progressInstances.current.get(key)!;
    },
    []
  );

  const removeProgress = useCallback((key: string) => {
    progressInstances.current.delete(key);
  }, []);

  const clearAll = useCallback(() => {
    progressInstances.current.clear();
  }, []);

  return {
    createProgress,
    removeProgress,
    clearAll,
  };
}

// Utility functions for common easing functions
export const easingFunctions = {
  linear: (t: number) => t,
  easeInQuad: (t: number) => t * t,
  easeOutQuad: (t: number) => t * (2 - t),
  easeInOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  easeInCubic: (t: number) => t * t * t,
  easeOutCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  easeInOutCubic: (t: number) =>
    t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
  easeInQuart: (t: number) => t * t * t * t,
  easeOutQuart: (t: number) => 1 - Math.pow(1 - t, 4),
  easeInOutQuart: (t: number) =>
    t < 0.5 ? 8 * t * t * t * t : 1 - 8 * --t * t * t * t,
  easeOutBounce: (t: number) => {
    if (t < 1 / 2.75) {
      return 7.5625 * t * t;
    } else if (t < 2 / 2.75) {
      return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
    } else if (t < 2.5 / 2.75) {
      return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
    } else {
      return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
    }
  },
};

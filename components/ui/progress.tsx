"use client";

import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

import { cn } from "@/lib/utils";

interface EnhancedProgressProps
  extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  value?: number;
  animated?: boolean;
  showGradient?: boolean;
  pulseOnUpdate?: boolean;
  segments?: number;
}

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  EnhancedProgressProps
>(
  (
    {
      className,
      value,
      animated = true,
      showGradient = false,
      pulseOnUpdate = false,
      segments,
      ...props
    },
    ref
  ) => {
    const [displayValue, setDisplayValue] = React.useState(value || 0);
    const [isAnimating, setIsAnimating] = React.useState(false);
    const prevValueRef = React.useRef(value);

    // Smooth animation for progress updates
    React.useEffect(() => {
      if (value !== undefined && value !== prevValueRef.current) {
        if (pulseOnUpdate) {
          setIsAnimating(true);
          setTimeout(() => setIsAnimating(false), 300);
        }

        if (animated && Math.abs(value - displayValue) > 0.1) {
          const startValue = displayValue;
          const endValue = value;
          const duration = 500; // 500ms animation
          const startTime = Date.now();

          const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Easing function for smooth animation
            const easeOutCubic = 1 - Math.pow(1 - progress, 3);
            const currentValue =
              startValue + (endValue - startValue) * easeOutCubic;

            setDisplayValue(currentValue);

            if (progress < 1) {
              requestAnimationFrame(animate);
            }
          };

          requestAnimationFrame(animate);
        } else {
          setDisplayValue(value);
        }

        prevValueRef.current = value;
      }
    }, [value, displayValue, animated, pulseOnUpdate]);

    const isIndeterminate = value === undefined || value === null;

    // Segmented progress bar
    if (segments && segments > 1) {
      return (
        <ProgressPrimitive.Root
          ref={ref}
          className={cn(
            "relative h-4 w-full overflow-hidden rounded-full bg-secondary",
            className
          )}
          {...props}
        >
          <div className="flex h-full w-full gap-0.5">
            {Array.from({ length: segments }, (_, i) => {
              const segmentProgress = Math.max(
                0,
                Math.min(
                  100,
                  ((displayValue - (i * 100) / segments) * segments) / 100
                )
              );
              return (
                <div
                  key={i}
                  className="flex-1 bg-secondary rounded-sm overflow-hidden"
                >
                  <div
                    className={cn(
                      "h-full transition-all duration-300 ease-out",
                      showGradient
                        ? "bg-gradient-to-r from-blue-500 to-green-500"
                        : "bg-primary",
                      isAnimating && "animate-pulse"
                    )}
                    style={{ width: `${segmentProgress}%` }}
                  />
                </div>
              );
            })}
          </div>
        </ProgressPrimitive.Root>
      );
    }

    return (
      <ProgressPrimitive.Root
        ref={ref}
        className={cn(
          "relative h-4 w-full overflow-hidden rounded-full bg-secondary",
          isAnimating &&
            "ring-2 ring-primary/20 ring-offset-2 ring-offset-background",
          className
        )}
        {...props}
      >
        {isIndeterminate ? (
          <div className="h-full w-full relative">
            <div
              className="h-full w-1/3 bg-primary animate-pulse absolute rounded-full"
              style={{
                animation: "progress-slide 2s ease-in-out infinite",
              }}
            />
          </div>
        ) : (
          <ProgressPrimitive.Indicator
            className={cn(
              "h-full w-full flex-1 transition-all duration-500 ease-out",
              showGradient
                ? "bg-gradient-to-r from-blue-500 to-green-500"
                : "bg-primary",
              isAnimating && "animate-pulse"
            )}
            style={{ transform: `translateX(-${100 - displayValue}%)` }}
          />
        )}
      </ProgressPrimitive.Root>
    );
  }
);
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };

"use client";

import { Play, Pause, SkipBack, SkipForward, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface StepControlsProps {
  currentStep: number;
  totalSteps: number;
  onPrev: () => void;
  onNext: () => void;
  onReset: () => void;
  isPlaying: boolean;
  onToggleAutoPlay: () => void;
  stepTitle: string;
  stepDescription: string;
  className?: string;
}

export function StepControls({
  currentStep,
  totalSteps,
  onPrev,
  onNext,
  onReset,
  isPlaying,
  onToggleAutoPlay,
  stepTitle,
  stepDescription,
  className,
}: StepControlsProps) {
  return (
    <div className={cn("space-y-3", className)}>
      <div className="rounded-lg border border-blue-800 bg-blue-950/40 px-4 py-3">
        <div className="mb-1 text-sm font-semibold text-blue-200">
          {stepTitle}
        </div>
        <div className="text-sm text-blue-300">
          {stepDescription}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            onClick={onReset}
            className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            title="重置"
          >
            <RotateCcw size={16} />
          </button>
          <button
            onClick={onPrev}
            disabled={currentStep === 0}
            className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-30"
            title="上一步"
          >
            <SkipBack size={16} />
          </button>
          <button
            onClick={onToggleAutoPlay}
            className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            title={isPlaying ? "暂停" : "自动播放"}
          >
            {isPlaying ? <Pause size={16} /> : <Play size={16} />}
          </button>
          <button
            onClick={onNext}
            disabled={currentStep === totalSteps - 1}
            className="rounded-md p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 disabled:opacity-30"
            title="下一步"
          >
            <SkipForward size={16} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {Array.from({ length: totalSteps }, (_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1.5 w-1.5 rounded-full transition-colors",
                  i === currentStep
                    ? "bg-blue-500"
                    : i < currentStep
                      ? "bg-blue-700"
                      : "bg-zinc-700"
                )}
              />
            ))}
          </div>
          <span className="font-mono text-xs text-zinc-400">
            {currentStep + 1}/{totalSteps}
          </span>
        </div>
      </div>
    </div>
  );
}

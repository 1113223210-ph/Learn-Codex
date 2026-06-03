"use client";

import { Play, Pause, SkipForward, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface SimulatorControlsProps {
  isPlaying: boolean;
  isComplete: boolean;
  currentIndex: number;
  totalSteps: number;
  speed: number;
  onPlay: () => void;
  onPause: () => void;
  onStep: () => void;
  onReset: () => void;
  onSpeedChange: (speed: number) => void;
}

const SPEEDS = [0.5, 1, 2, 4];

export function SimulatorControls({
  isPlaying,
  isComplete,
  currentIndex,
  totalSteps,
  speed,
  onPlay,
  onPause,
  onStep,
  onReset,
  onSpeedChange,
}: SimulatorControlsProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-1.5">
        {isPlaying ? (
          <button
            onClick={onPause}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-zinc-900 transition-colors hover:bg-zinc-200"
            title="暂停"
          >
            <Pause size={16} />
          </button>
        ) : (
          <button
            onClick={onPlay}
            disabled={isComplete}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-zinc-900 transition-colors hover:bg-zinc-200 disabled:opacity-40"
            title="播放"
          >
            <Play size={16} />
          </button>
        )}
        <button
          onClick={onStep}
          disabled={isComplete}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-700 transition-colors hover:bg-zinc-800 disabled:opacity-40"
          title="单步"
        >
          <SkipForward size={16} />
        </button>
        <button
          onClick={onReset}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-700 transition-colors hover:bg-zinc-800"
          title="重置"
        >
          <RotateCcw size={16} />
        </button>
      </div>

      <div className="flex items-center gap-1.5">
        <span className="text-xs text-zinc-500">速度:</span>
        {SPEEDS.map((s) => (
          <button
            key={s}
            onClick={() => onSpeedChange(s)}
            className={cn(
              "rounded px-2 py-1 text-xs font-medium transition-colors",
              speed === s
                ? "bg-white text-zinc-900"
                : "text-zinc-500 hover:text-zinc-200"
            )}
          >
            {s}x
          </button>
        ))}
      </div>

      <span className="ml-auto text-xs tabular-nums text-zinc-500">
        {Math.max(0, currentIndex + 1)} / {totalSteps}
      </span>
    </div>
  );
}

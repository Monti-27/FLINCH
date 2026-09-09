"use client";

import { useEffect, useRef } from "react";
import { createShaderSurface } from "../../lib/shader/shader-surface.ts";

export function ShaderBackground({ className, paused = false }: { className?: string; paused?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const surfaceRef = useRef<ReturnType<typeof createShaderSurface> | null>(null);
  useEffect(() => {
    if (!canvasRef.current) return;
    const surface = createShaderSurface(canvasRef.current);
    surfaceRef.current = surface;
    return () => {
      surface.dispose();
      surfaceRef.current = null;
    };
  }, []);
  useEffect(() => surfaceRef.current?.setPaused(paused), [paused]);
  return <canvas ref={canvasRef} className={className} aria-hidden="true" data-state="loading" style={{ display: "block", width: "100%", height: "100%", pointerEvents: "none" }} />;
}

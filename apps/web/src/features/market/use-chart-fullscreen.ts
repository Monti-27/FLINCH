import { useEffect, useRef, useState } from "react";

export function useChartFullscreen() {
  const panel = useRef<HTMLElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [active, setActive] = useState(false);
  const [available, setAvailable] = useState(false);
  const [error, setError] = useState<string>();
  useEffect(() => {
    let expanded = false;
    let disposed = false;
    setAvailable(Boolean(document.fullscreenEnabled));
    const change = () => {
      const next = document.fullscreenElement === panel.current;
      setActive(next);
      if (expanded && !next) trigger.current?.focus({ preventScroll: true });
      expanded = next;
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || document.fullscreenElement !== panel.current) return;
      event.preventDefault();
      void document.exitFullscreen().catch(() => {
        if (!disposed) setError("Could not exit fullscreen. Use your browser's fullscreen control.");
      });
    };
    document.addEventListener("fullscreenchange", change);
    document.addEventListener("keydown", keydown);
    return () => {
      disposed = true;
      document.removeEventListener("fullscreenchange", change);
      document.removeEventListener("keydown", keydown);
    };
  }, []);
  const toggle = async () => {
    setError(undefined);
    try {
      if (document.fullscreenElement === panel.current) await document.exitFullscreen();
      else await panel.current?.requestFullscreen();
    } catch { setError("Fullscreen is unavailable in this browser."); }
  };
  return { panel, trigger, active, available, error, toggle };
}

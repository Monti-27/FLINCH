import { animate } from "framer-motion";

const TIMING = { flow: 1.1, dismiss: 0.15 };

export function createFaqFlow(element: HTMLElement) {
  let animation: ReturnType<typeof animate> | undefined;
  return {
    play: () => {
      animation?.stop();
      if (Number(getComputedStyle(element).opacity) < 0.01) animate(element, { opacity: 0, y: "-36%", scale: 1.04 }, { duration: 0 }).complete();
      animation = animate(element, {
        opacity: [null, 0.72, 0.48, 0],
        y: [null, "-12%", "18%", "48%"],
        scale: [null, 1.04, 1.08, 1.16],
      }, { duration: TIMING.flow, times: [0, 0.18, 0.6, 1], ease: [0.4, 0, 0.2, 1] });
    },
    dismiss: () => {
      animation?.stop();
      animation = animate(element, { opacity: 0 }, { duration: TIMING.dismiss });
    },
    stop: () => {
      animation?.stop();
      element.style.opacity = "0";
      element.style.transform = "translateY(-36%) scale(1.04)";
    },
  };
}

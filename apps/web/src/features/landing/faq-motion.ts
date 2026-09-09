import { animate, motionValue } from "framer-motion";
import { createFaqFlow } from "./faq-flow.ts";

const TIMING = {
  height: { type: "spring" as const, stiffness: 240, damping: 32, restDelta: 0.1, restSpeed: 0.1 },
  surface: { type: "spring" as const, stiffness: 240, damping: 32, restDelta: 0.001, restSpeed: 0.001 },
};

export function enhanceFaq(root: HTMLElement) {
  const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
  const rows = [...root.querySelectorAll<HTMLDetailsElement>("details")];
  const controllers = rows.map(element => {
    const summary = element.querySelector<HTMLElement>("summary")!;
    const content = element.querySelector<HTMLElement>("[data-faq-content]")!;
    const flow = createFaqFlow(element.querySelector<HTMLElement>("[data-faq-flow]")!);
    let expanded = element.open;
    let running = false;
    let targetHeight = 0;
    let revision = 0;
    const height = motionValue(element.getBoundingClientRect().height);
    const surface = motionValue(expanded ? 1 : 0);
    const releaseHeight = height.on("change", value => { element.style.height = `${value}px`; });
    const releaseSurface = surface.on("change", value => { element.style.setProperty("--faq-open", String(value)); });
    element.dataset.expanded = String(expanded);
    element.style.setProperty("--faq-open", String(surface.get()));
    summary.setAttribute("aria-expanded", String(expanded));

    const settle = () => {
      revision += 1;
      running = false;
      height.stop();
      surface.stop();
      flow.stop();
      element.open = expanded;
      element.style.removeProperty("height");
      height.jump(element.getBoundingClientRect().height);
      element.style.removeProperty("height");
      surface.jump(expanded ? 1 : 0);
      content.inert = !expanded;
    };

    const resize = () => {
      if (preference.matches) return settle();
      const nextHeight = summary.getBoundingClientRect().height + (expanded ? content.getBoundingClientRect().height : 0);
      if (Math.abs(nextHeight - targetHeight) < 0.5 && running) return;
      if (Math.abs(nextHeight - element.getBoundingClientRect().height) < 0.5 && !running) return;
      if (!running) height.jump(element.getBoundingClientRect().height);
      targetHeight = nextHeight;
      running = true;
      const currentRevision = ++revision;
      animate(height, nextHeight, { ...TIMING.height, onComplete: () => {
        if (currentRevision !== revision) return;
        running = false;
        element.open = expanded;
        element.style.removeProperty("height");
      } });
    };

    const setExpanded = (next: boolean) => {
      if (expanded === next) return;
      if (!running) height.jump(element.getBoundingClientRect().height);
      element.style.height = `${height.get()}px`;
      expanded = next;
      element.dataset.expanded = String(expanded);
      summary.setAttribute("aria-expanded", String(expanded));
      content.inert = !expanded;
      if (preference.matches) return settle();
      if (expanded) element.open = true;
      if (expanded) flow.play();
      else flow.dismiss();
      animate(surface, expanded ? 1 : 0, TIMING.surface);
      resize();
    };

    const click = (event: MouseEvent) => {
      event.preventDefault();
      const next = !expanded;
      if (next) controllers.forEach(controller => { if (controller.element !== element) controller.setExpanded(false); });
      setExpanded(next);
    };

    const toggle = () => {
      if (running || element.open === expanded) return;
      setExpanded(element.open);
      settle();
      if (expanded) controllers.forEach(controller => { if (controller.element !== element) controller.setExpanded(false); });
    };

    const observer = new ResizeObserver(() => { if (expanded || running) resize(); });
    observer.observe(summary);
    observer.observe(content);
    summary.addEventListener("click", click);
    element.addEventListener("toggle", toggle);

    return { element, summary, setExpanded, settle, dispose: () => {
      observer.disconnect();
      summary.removeEventListener("click", click);
      element.removeEventListener("toggle", toggle);
      settle();
      releaseHeight();
      releaseSurface();
      height.destroy();
      surface.destroy();
      element.style.removeProperty("--faq-open");
      delete element.dataset.expanded;
      summary.removeAttribute("aria-expanded");
      content.inert = false;
    } };
  });

  const syncPreference = () => { if (preference.matches) controllers.forEach(controller => controller.settle()); };
  const navigate = (event: KeyboardEvent) => {
    const index = controllers.findIndex(controller => controller.summary === event.target);
    if (index < 0) return;
    const next = { ArrowDown: (index + 1) % rows.length, ArrowUp: (index + rows.length - 1) % rows.length, Home: 0, End: rows.length - 1 }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    controllers[next].summary.focus();
  };

  root.dataset.enhanced = "true";
  root.addEventListener("keydown", navigate);
  preference.addEventListener("change", syncPreference);
  return () => {
    preference.removeEventListener("change", syncPreference);
    root.removeEventListener("keydown", navigate);
    controllers.forEach(controller => controller.dispose());
    delete root.dataset.enhanced;
  };
}

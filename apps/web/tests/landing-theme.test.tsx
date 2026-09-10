import { afterEach, describe, expect, it, vi } from "vitest";
import { runInNewContext } from "node:vm";
import { renderToStaticMarkup } from "react-dom/server";
import { LandingPage } from "../src/features/landing/landing-page.tsx";
import { parseTheme, readTheme, resolveTheme, saveTheme, THEME_KEY, themeBootstrap } from "../src/features/landing/theme/preference.ts";

afterEach(() => vi.unstubAllGlobals());

describe("landing theme preference", () => {
  it.each(["dark", "light"] as const)("accepts only the explicit %s preference", theme => {
    expect(parseTheme(theme)).toBe(theme);
    expect(resolveTheme(theme, theme === "light")).toBe(theme);
  });

  it.each([null, undefined, "", "system", "Dark", "<script>"])("ignores invalid storage %s", value => {
    expect(parseTheme(value)).toBeNull();
  });

  it("uses the system only until an explicit choice exists", () => {
    expect(resolveTheme(null, true)).toBe("dark");
    expect(resolveTheme(null, false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it("does not fail when browser storage is blocked", () => {
    vi.stubGlobal("localStorage", { getItem() { throw new Error("Blocked"); }, setItem() { throw new Error("Blocked"); } });
    expect(readTheme()).toBeNull();
    expect(() => saveTheme("dark")).not.toThrow();
  });

  it("writes only the landing preference", () => {
    const setItem = vi.fn();
    vi.stubGlobal("localStorage", { getItem: () => "dark", setItem });
    expect(readTheme()).toBe("dark");
    saveTheme("light");
    expect(setItem).toHaveBeenCalledExactlyOnceWith(THEME_KEY, "light");
  });

  it.each([
    ["dark", false, "dark"], ["light", true, "light"], [null, true, "dark"], ["invalid", false, "light"], ["blocked", true, "dark"],
  ])("resolves %s before content is painted", (saved, system, expected) => {
    const root = { dataset: { landingTheme: "light" } };
    runInNewContext(themeBootstrap, {
      localStorage: { getItem() { if (saved === "blocked") throw new Error("Blocked"); return saved; } },
      matchMedia: () => ({ matches: system }), document: { getElementById: () => root },
    });
    expect(root.dataset.landingTheme).toBe(expected);
  });

  it("keeps server content and a disabled pre-hydration switch without allocating a shader", () => {
    const html = renderToStaticMarkup(<LandingPage />);
    expect(html).toMatch(/role="switch"[^>]*aria-label="Dark mode"[^>]*disabled=""/);
    expect(html.indexOf("localStorage.getItem")).toBeLessThan(html.indexOf('id="landing-title"'));
    expect(html).toMatch(/<canvas[^>]*hidden=""[^>]*data-theme-sweep=""/);
    expect(html).not.toContain("glimm/react");
  });
});

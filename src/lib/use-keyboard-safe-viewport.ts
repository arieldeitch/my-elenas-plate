import { useEffect } from "react";

/**
 * Keeps the app aware of the mobile visual viewport. When a software keyboard
 * shrinks the visible area, sheets use --app-viewport-height and the focused
 * control is scrolled into the safe centre rather than being covered.
 */
export function useKeyboardSafeViewport(): void {
  useEffect(() => {
    const root = document.documentElement;
    const vv = window.visualViewport;
    let raf = 0;

    const update = () => {
      const height = vv?.height ?? window.innerHeight;
      root.style.setProperty("--app-viewport-height", `${Math.round(height)}px`);
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = document.activeElement;
        if (
          el instanceof HTMLElement &&
          (el.matches("input, textarea, select, [contenteditable='true']") ||
            el.closest("[data-keyboard-focus]"))
        ) {
          el.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
        }
      });
    };

    const onFocus = (event: FocusEvent) => {
      if (event.target instanceof HTMLElement && event.target.matches("input, textarea, select")) {
        setTimeout(update, 80);
      }
    };

    update();
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    document.addEventListener("focusin", onFocus);
    return () => {
      cancelAnimationFrame(raf);
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      document.removeEventListener("focusin", onFocus);
      root.style.removeProperty("--app-viewport-height");
    };
  }, []);
}

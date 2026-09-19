import { useEffect } from "react";

const FOCUSABLE = "input, textarea, select, [contenteditable='true'], [data-keyboard-focus]";

function isObscured(element: HTMLElement, top: number, height: number): boolean {
  const rect = element.getBoundingClientRect();
  const safeTop = top + 12;
  const safeBottom = top + height - 12;
  return rect.top < safeTop || rect.bottom > safeBottom;
}

/** Anchors sheets to the visual viewport and corrects only actual keyboard coverage. */
export function useKeyboardSafeViewport(): void {
  useEffect(() => {
    const root = document.documentElement;
    const vv = window.visualViewport;

    const updateViewport = () => {
      const height = vv?.height ?? window.innerHeight;
      const offsetTop = vv?.offsetTop ?? 0;
      root.style.setProperty("--app-viewport-height", `${Math.round(height)}px`);
      root.style.setProperty("--app-viewport-top", `${Math.round(offsetTop)}px`);
      const active = document.activeElement;
      if (active instanceof HTMLElement && active.matches(FOCUSABLE) && isObscured(active, offsetTop, height)) {
        active.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "auto" });
      }
    };

    const beforeFocus = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement) || !target.matches(FOCUSABLE)) return;
      target.closest<HTMLElement>(".keyboard-safe-scroll")?.scrollTo({
        top: Math.max(0, target.offsetTop - 24),
        behavior: "auto",
      });
      updateViewport();
    };

    updateViewport();
    vv?.addEventListener("resize", updateViewport);
    vv?.addEventListener("scroll", updateViewport);
    window.addEventListener("resize", updateViewport);
    document.addEventListener("focusin", beforeFocus, true);
    return () => {
      vv?.removeEventListener("resize", updateViewport);
      vv?.removeEventListener("scroll", updateViewport);
      window.removeEventListener("resize", updateViewport);
      document.removeEventListener("focusin", beforeFocus, true);
      root.style.removeProperty("--app-viewport-height");
      root.style.removeProperty("--app-viewport-top");
    };
  }, []);
}

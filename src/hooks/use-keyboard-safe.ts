import { useEffect } from "react";

/** Keeps focused controls visible when a mobile software keyboard shrinks the viewport. */
export function useKeyboardSafeViewport() {
  useEffect(() => {
    const viewport = window.visualViewport;
    const root = document.documentElement;

    const revealFocused = () => {
      window.setTimeout(() => {
        const active = document.activeElement;
        if (active instanceof HTMLElement && active.matches("input, textarea, select, button")) {
          active.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
      }, 80);
    };

    const update = () => {
      root.style.setProperty("--visual-viewport-height", `${viewport?.height ?? window.innerHeight}px`);
      revealFocused();
    };

    update();
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    document.addEventListener("focusin", revealFocused);
    window.addEventListener("orientationchange", update);
    return () => {
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
      document.removeEventListener("focusin", revealFocused);
      window.removeEventListener("orientationchange", update);
      root.style.removeProperty("--visual-viewport-height");
    };
  }, []);
}
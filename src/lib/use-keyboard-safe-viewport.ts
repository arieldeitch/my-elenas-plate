import { useEffect } from "react";

function editable(el: EventTarget | Element | null): el is HTMLElement {
  return (
    el instanceof HTMLElement &&
    (el.matches("input, textarea, select, [contenteditable='true']") ||
      Boolean(el.closest("[data-keyboard-focus]")))
  );
}

/**
 * Keeps mobile sheets stable around the software keyboard.
 *
 * Important UX rule: never wait for the keyboard and then visibly recenter the
 * form. Pointer/touch focus is pre-positioned synchronously; viewport changes
 * only make an instant nearest-edge correction when the focused control would
 * actually be obscured.
 */
/** Fraction of the viewport height below which a tapped control is likely to be covered by the keyboard. */
export const KEYBOARD_ZONE_FROM = 0.5;

export function useKeyboardSafeViewport(): void {
  useEffect(() => {
    const root = document.documentElement;
    const vv = window.visualViewport;

    const setViewportVars = () => {
      const height = vv?.height ?? window.innerHeight;
      const offsetTop = vv?.offsetTop ?? 0;
      root.style.setProperty("--app-viewport-height", `${Math.round(height)}px`);
      root.style.setProperty("--app-viewport-offset-top", `${Math.round(offsetTop)}px`);
      const keyboardOpen = Boolean(vv && window.innerHeight - vv.height > 120);
      if (keyboardOpen) root.dataset.keyboardOpen = "true";
      else delete root.dataset.keyboardOpen;
    };

    const ensureVisible = (el: HTMLElement | null) => {
      if (!el) return;
      const height = vv?.height ?? window.innerHeight;
      const top = vv?.offsetTop ?? 0;
      const safeTop = top + 12;
      const safeBottom = top + height - 20;
      const rect = el.getBoundingClientRect();
      if (rect.top < safeTop || rect.bottom > safeBottom) {
        el.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "auto" });
      }
    };

    const update = () => {
      setViewportVars();
      const active = editable(document.activeElement) ? document.activeElement : null;
      ensureVisible(active);
    };

    // pointerdown happens before focus: place the future control first so the
    // keyboard opens onto the final composition instead of moving it afterwards.
    const onPointerDown = (event: PointerEvent) => {
      const target = editable(event.target) ? event.target : null;
      if (!target) return;
      const coarse =
        event.pointerType === "touch" ||
        (typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches);
      if (coarse) {
        // Pre-position while the tap is still being handled, before focus asks
        // the OS to animate the software keyboard — but ONLY when the control
        // sits in the lower part of the viewport, where the keyboard will land.
        // A control already in the upper half stays exactly where the finger
        // is: centring it would itself be a visible jump before the keyboard.
        const height = vv?.height ?? window.innerHeight;
        const top = vv?.offsetTop ?? 0;
        const rect = target.getBoundingClientRect();
        if (rect.bottom > top + height * KEYBOARD_ZONE_FROM) {
          target.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" });
        }
      } else {
        ensureVisible(target);
      }
    };

    const onFocus = (event: FocusEvent) => {
      setViewportVars();
      if (editable(event.target)) ensureVisible(event.target);
    };

    setViewportVars();
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("focusin", onFocus);

    return () => {
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("focusin", onFocus);
      root.style.removeProperty("--app-viewport-height");
      root.style.removeProperty("--app-viewport-offset-top");
      delete root.dataset.keyboardOpen;
    };
  }, []);
}

"use client";

import type { LenisOptions } from "lenis";
import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";

const easing: NonNullable<LenisOptions["easing"]> = (time) => 1 - Math.pow(1 - time, 4);
const scrollableOverflow = /(auto|scroll|overlay)/;
type LenisRoot = ComponentType<{
  root: boolean;
  options: LenisOptions;
  children: ReactNode;
}>;

function shouldUseNativeScroll(node: HTMLElement) {
  if (
    node.closest(
      "[data-lenis-prevent], [data-lenis-prevent-wheel], [data-lenis-prevent-touch], textarea, select, input, [contenteditable='true'], [role='dialog']",
    )
  ) {
    return true;
  }

  for (let element: HTMLElement | null = node; element && element !== document.body; element = element.parentElement) {
    const styles = window.getComputedStyle(element);
    const canScrollY = scrollableOverflow.test(styles.overflowY) && element.scrollHeight > element.clientHeight;
    const canScrollX = scrollableOverflow.test(styles.overflowX) && element.scrollWidth > element.clientWidth;

    if (canScrollY || canScrollX) {
      return true;
    }
  }

  return false;
}

export function SmoothScrollProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  const [LenisRoot, setLenisRoot] = useState<LenisRoot | null>(null);

  useEffect(() => {
    const motionMedia = window.matchMedia("(prefers-reduced-motion: reduce)");
    const coarsePointerMedia = window.matchMedia("(pointer: coarse)");
    const syncPreference = () => setEnabled(!motionMedia.matches && !coarsePointerMedia.matches);

    syncPreference();
    motionMedia.addEventListener("change", syncPreference);
    coarsePointerMedia.addEventListener("change", syncPreference);

    return () => {
      motionMedia.removeEventListener("change", syncPreference);
      coarsePointerMedia.removeEventListener("change", syncPreference);
    };
  }, []);

  useEffect(() => {
    let active = true;

    if (!enabled) {
      return;
    }

    import("lenis/react").then((module) => {
      if (active) {
        setLenisRoot(() => module.ReactLenis as LenisRoot);
      }
    });

    return () => {
      active = false;
    };
  }, [enabled]);

  const options = useMemo<LenisOptions>(
    () => ({
      anchors: {
        duration: 1.05,
        easing,
        offset: -96,
      },
      autoRaf: true,
      duration: 0.95,
      easing,
      gestureOrientation: "vertical",
      overscroll: false,
      prevent: shouldUseNativeScroll,
      smoothWheel: true,
      stopInertiaOnNavigate: true,
      syncTouch: false,
      touchMultiplier: 1,
      virtualScroll: ({ event }) => !(event instanceof WheelEvent && event.ctrlKey),
      wheelMultiplier: 0.9,
    }),
    [],
  );

  if (!enabled || !LenisRoot) {
    return children;
  }

  return (
    <LenisRoot root options={options}>
      {children}
    </LenisRoot>
  );
}

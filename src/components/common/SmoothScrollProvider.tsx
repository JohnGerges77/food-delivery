"use client";

import type { LenisOptions } from "lenis";
import { ReactLenis } from "lenis/react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

const easing: NonNullable<LenisOptions["easing"]> = (time) => 1 - Math.pow(1 - time, 4);
const scrollableOverflow = /(auto|scroll|overlay)/;

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
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const syncMotionPreference = () => setReducedMotion(media.matches);

    syncMotionPreference();
    media.addEventListener("change", syncMotionPreference);

    return () => media.removeEventListener("change", syncMotionPreference);
  }, []);

  const options = useMemo<LenisOptions>(
    () => ({
      anchors: {
        duration: 1.05,
        easing,
        offset: -96,
      },
      autoRaf: true,
      duration: 1.15,
      easing,
      gestureOrientation: "vertical",
      overscroll: true,
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

  if (reducedMotion) {
    return children;
  }

  return (
    <ReactLenis root options={options}>
      {children}
    </ReactLenis>
  );
}

import type { CSSProperties } from "react";
import type { StorefrontThemeId } from "./storefront-theme.ts";

// The native color input needs a hex fallback for the CSS theme defaults.
export const themeDefaultAccent: Record<StorefrontThemeId, string> = {
  "savora-classic": "#ff7a00",
  "savora-aqua": "#06363a",
  "savora-cafe": "#5b3827",
  "savora-luxury": "#2f472d",
};

type RGB = [number, number, number];
const black: RGB = [0, 0, 0];
const white: RGB = [255, 255, 255];

export function normalizeStorefrontAccent(value: string | null | undefined) {
  const hex = value?.trim().toLowerCase();
  if (!hex || !/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/.test(hex)) return null;
  return hex.length === 4 ? "#" + [...hex.slice(1)].map((digit) => digit + digit).join("") : hex;
}

function rgb(hex: string): RGB {
  return [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16)) as RGB;
}

function hex(rgb: RGB) {
  return "#" + rgb.map((channel) => channel.toString(16).padStart(2, "0")).join("");
}

function mix(color: RGB, toward: RGB, fraction: number): RGB {
  return color.map((channel, index) => Math.round(channel + (toward[index] - channel) * fraction)) as RGB;
}

function luminance(color: RGB) {
  const [r, g, b] = color.map((channel) => {
    const srgb = channel / 255;
    return srgb <= 0.04045 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(color: RGB, background: RGB) {
  const first = luminance(color);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

function readableInk(color: RGB, background: RGB, toward: RGB) {
  for (let step = 0; step <= 20; step++) {
    const candidate = mix(color, toward, step / 20);
    if (contrast(candidate, background) >= 4.5) return hex(candidate);
  }
  return hex(toward);
}

export function storefrontAccentStyle(theme: StorefrontThemeId, value: string | null | undefined): CSSProperties | undefined {
  const primary = normalizeStorefrontAccent(value);
  if (!primary) return;
  const color = rgb(primary);
  const foreground = contrast(color, black) >= contrast(color, white) ? black : white;
  const interaction = (amount: number) => {
    const candidate = mix(color, foreground, amount);
    const away = foreground === black ? white : black;
    return hex(contrast(candidate, foreground) >= 4.5 ? candidate : mix(color, away, amount));
  };
  // Choose ink against the most restrictive tinted surface in each preset.
  const isDark = theme === "savora-classic";
  const darkInk = readableInk(color, rgb("#49433f"), white);
  return {
    "--sf-primary": primary,
    "--sf-primary-hover": interaction(0.12),
    "--sf-primary-active": interaction(0.24),
    "--sf-on-primary": hex(foreground),
    "--sf-accent-ink": isDark ? darkInk : readableInk(color, rgb("#d7c7b6"), black),
    "--sf-photo-ink": darkInk,
  } as CSSProperties;
}

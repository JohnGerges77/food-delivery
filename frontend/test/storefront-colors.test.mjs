import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const root = new URL("../src/", import.meta.url);
const css = await readFile(new URL("app/globals.css", root), "utf8");

test("all four storefronts have one scoped palette and explicit color scheme", () => {
  for (const [id, scheme] of [
    ["savora-classic", "dark"], ["savora-aqua", "light"],
    ["savora-cafe", "light"], ["savora-luxury", "light"],
  ]) {
    const block = css.match(new RegExp(`\\[data-storefront-theme="${id}"\\] \\{([^}]+)\\}`))?.[1];
    assert.ok(block, `${id} palette exists`);
    for (const token of ["background", "surface", "surface-alt", "text", "text-muted",
      "primary", "primary-hover", "on-primary", "accent", "border", "highlight"]) {
      assert.match(block, new RegExp(`--sf-${token}:`), `${id} ${token}`);
    }
    assert.match(block, new RegExp(`color-scheme: ${scheme};`));
  }
  assert.equal(css.includes("prefers-color-scheme"), false);
  assert.match(css, /:not\(\[data-storefront-theme\] \*\)/);
});

test("theme modules consume only tokens defined in the central palette", async () => {
  const definitions = new Set([...css.matchAll(/(--sf-[\w-]+):/g)].map((match) => match[1]));
  for (const theme of ["aqua", "cafe", "luxury"]) {
    const cssModule = await readFile(new URL(`components/features/storefront/${theme}/${theme[0].toUpperCase()}${theme.slice(1)}Storefront.module.css`, root), "utf8");
    assert.equal(/#[0-9a-f]{3,8}\b/i.test(cssModule), false, `${theme} palette stays central`);
    for (const match of cssModule.matchAll(/var\((--sf-[\w-]+)\)/g)) {
      assert.ok(definitions.has(match[1]), `${theme} references defined token ${match[1]}`);
    }
  }
});

test("public Classic navigation has no appearance switch", async () => {
  const navbar = await readFile(new URL("components/layout/PublicNavbar.tsx", root), "utf8");
  assert.equal(navbar.includes("ThemeToggle"), false);
});

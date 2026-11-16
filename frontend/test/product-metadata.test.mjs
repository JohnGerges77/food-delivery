import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import { productMetadata } from "../src/lib/product-metadata.ts";

test("metadata shows both exact values with localized labels and Western digits", () => {
  assert.deepEqual(productMetadata({ calories: 412.1256, preparationTime: 25 }, "ar"), [
    { label: "السعرات الحرارية", value: "412.1256" },
    { label: "وقت التحضير", value: "25 دقيقة" },
  ]);
  assert.deepEqual(productMetadata({ calories: 0, preparationTime: 15 }, "en"), [
    { label: "Calories", value: "0" }, { label: "Preparation Time", value: "15 min" },
  ]);
});

test("missing, legacy and invalid optional metadata do not produce placeholders", () => {
  assert.deepEqual(productMetadata({}, "ar"), []);
  assert.deepEqual(productMetadata({ calories: null, preparationTime: undefined }, "en"), []);
  assert.deepEqual(productMetadata({ calories: 90, preparationTime: null }, "en"), [{ label: "Calories", value: "90" }]);
  assert.deepEqual(productMetadata({ calories: undefined, preparationTime: 5 }, "ar"), [{ label: "وقت التحضير", value: "5 دقيقة" }]);
  assert.deepEqual(productMetadata({ calories: NaN, preparationTime: Infinity }, "en"), []);
});

test("metadata component renders localized values and omits the empty area", () => {
  const source = readFileSync(new URL("../src/components/features/storefront/ProductMetadata.tsx", import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const exports = {};
  const require = createRequire(import.meta.url);
  runInNewContext(compiled, { exports, require: (name) => name === "@/lib/product-metadata" ? { productMetadata } : require(name) });
  const render = (product, locale) => renderToStaticMarkup(React.createElement(exports.ProductMetadata, { product, locale, compact: true }));
  assert.equal(render({}, "en"), "");
  const arabic = render({ calories: 150, preparationTime: 20 }, "ar");
  assert.match(arabic, /السعرات الحرارية/);
  assert.match(arabic, /وقت التحضير/);
  assert.match(arabic, /150/);
  assert.doesNotMatch(arabic, /[٠-٩۰-۹]/);
  const english = render({ preparationTime: 10 }, "en");
  assert.match(english, /Preparation Time/);
  assert.doesNotMatch(english, /Calories/);
});

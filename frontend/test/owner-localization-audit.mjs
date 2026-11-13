// Run explicitly with `node test/owner-localization-audit.mjs` while completing
// dashboard localization. It reports direct JSX copy, not user-provided data.
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { ownerText } from '../src/components/features/dashboard/owner-copy.ts';

const roots = ['src/components/features/dashboard', 'src/components/layout'];
const selectedLayout = new Set(['DashboardHeader.tsx', 'DashboardSidebar.tsx']);
const selectedOwner = new Set(['DashboardHomePage.tsx', 'DashboardCategoriesPage.tsx',
  'DashboardProductsPage.tsx', 'DashboardOrdersPage.tsx', 'DashboardSettingsPage.tsx',
  'DashboardLayoutShell.tsx', 'DashboardUI.tsx', 'OwnerImageUpload.tsx',
  'CatalogToast.tsx', 'AnalyticsCharts.tsx', 'CatalogImage.tsx', 'AdminLoginPage.tsx']);
const attrs = new Set(['aria-label', 'alt', 'placeholder', 'title', 'label', 'description', 'eyebrow']);
const ignored = /^(?:SA|SAVORA|Savora|WhatsApp|Facebook|Instagram|EGP|UTC)$/i;
const findings = [];
for (const root of roots) {
  for (const name of fs.readdirSync(root)) {
    if (!name.endsWith('.tsx') || (root.endsWith('/layout') ? !selectedLayout.has(name) : !selectedOwner.has(name))) continue;
    const file = path.join(root, name);
    const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const report = (node, text) => {
      const value = text.replace(/\s+/g, ' ').trim();
      if (!/[a-zA-Z]{2}/.test(value) || ignored.test(value) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return;
      const { line } = source.getLineAndCharacterOfPosition(node.getStart(source));
      findings.push(`${file}:${line + 1}: ${value}`);
    };
    const visit = (node, expression = false, skip = false) => {
      if (ts.isJsxText(node)) report(node, node.getText(source));
      if (ts.isCallExpression(node) && node.expression.getText(source) === 'ownerText' &&
          node.arguments[1] && ts.isStringLiteral(node.arguments[1]) &&
          ownerText('ar', node.arguments[1].text) === node.arguments[1].text) {
        report(node.arguments[1], node.arguments[1].text);
      }
      if (ts.isJsxAttribute(node) && attrs.has(node.name.getText(source)) &&
          node.initializer && ts.isStringLiteral(node.initializer)) report(node, node.initializer.text);
      if (ts.isCallExpression(node) && node.expression.getText(source) === 'field' &&
          node.arguments[1] && (ts.isStringLiteral(node.arguments[1]) || ts.isTemplateExpression(node.arguments[1]))) {
        report(node.arguments[1], node.arguments[1].getText(source));
      }
      if (!skip && ts.isCallExpression(node) && /^(?:set(?:ActionError|ModalError|LoadError|GalleryError|Error|Feedback)|failure|ownerCatalogError)$/.test(node.expression.getText(source))) {
        for (const argument of node.arguments) {
          if (ts.isStringLiteral(argument) || ts.isTemplateExpression(argument)) report(argument, argument.getText(source));
        }
      }
      if (ts.isJsxAttribute(node) && !attrs.has(node.name.getText(source))) skip = true;
      if (ts.isCallExpression(node) && node.expression.getText(source) === 'ownerText') skip = true;
      if (ts.isConditionalExpression(node) && /[\u0600-\u06ff]/.test(node.getText(source))) skip = true;
      if (ts.isJsxExpression(node)) expression = true;
      if (expression && !skip && ts.isTemplateExpression(node) && /[A-Za-z]{2}/.test(node.head.text)) report(node, node.head.text);
      if (expression && !skip && ts.isStringLiteral(node) &&
          ((ts.isConditionalExpression(node.parent) && node.parent.condition !== node) ||
           (ts.isBinaryExpression(node.parent) && node.parent.right === node &&
             [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(node.parent.operatorToken.kind)))) {
        report(node, node.text);
      }
      ts.forEachChild(node, (child) => visit(child, expression, skip));
    };
    visit(source);
  }
}
for (const finding of findings) console.log(finding);
console.log(`Potential untranslated JSX strings: ${findings.length}`);
if (findings.length) process.exitCode = 1;

// Run against an isolated local Next build, read-only visual API fixture and headless Chrome CDP.
import assert from 'node:assert/strict';

const targets = await fetch('http://127.0.0.1:9451/json/list').then((response) => response.json());
const target = targets.find((entry) => entry.type === 'page');
assert.ok(target);
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});
let sequence = 0;
const pending = new Map();
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  const handler = pending.get(message.id);
  if (!handler) return;
  pending.delete(message.id);
  if (message.error) handler.reject(new Error(message.error.message));
  else handler.resolve(message.result);
});
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true,
    awaitPromise: true });
  if (result.result.exceptionDetails) throw new Error(result.result.exceptionDetails.text);
  return result.result.result.value;
}
async function until(expression) {
  for (let attempt = 0; attempt < 80; attempt++) {
    if (await evaluate(expression)) return;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Timed out: ${expression}`);
}
try {
  await send('Page.enable');
  await send('Runtime.enable');
  const results = [];
  for (const slug of ['phase101-classic', 'phase102-aqua', 'phase103-cafe', 'phase104-luxury']) {
    for (const [locale, width, height] of [['en', 1440, 900], ['ar', 375, 812]]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height,
        deviceScaleFactor: 1, mobile: width < 600 });
      const base = `http://127.0.0.1:3101/${locale}/r/${slug}`;
      await send('Page.navigate', { url: `${base}/menu` });
      await until(`document.readyState === 'complete' && !!document.querySelector('[data-menu-card]')`);
      const state = await evaluate(`(() => ({
        direction: document.documentElement.dir,
        overflow: document.documentElement.scrollWidth > innerWidth,
        nonWesternDigits: /[٠-٩۰-۹]/.test(document.body.textContent),
        cardCount: document.querySelectorAll('[data-menu-card]').length,
        cardLink: document.querySelector('[data-menu-card] > a')?.getAttribute('href'),
        addButton: !!document.querySelector('[data-menu-card] button[aria-label]'),
      }))()`);
      assert.equal(state.direction, locale === 'ar' ? 'rtl' : 'ltr', `${slug} ${locale} direction`);
      assert.equal(state.overflow, false, `${slug} ${locale} viewport overflow`);
      assert.equal(state.nonWesternDigits, false, `${slug} ${locale} digits`);
      assert.ok(state.cardCount > 0, `${slug} ${locale} products`);
      assert.ok(state.cardLink?.includes('/menu/'), `${slug} ${locale} full-card link`);
      assert.equal(state.addButton, true, `${slug} ${locale} independent add button`);
      if (locale === 'ar') {
        await evaluate(`document.querySelector('[data-menu-card] button[aria-label]').click()`);
        const afterAdd = await evaluate(`({ path: location.pathname,
          count: document.querySelector('[data-menu-card] button[aria-label] span:last-child')?.textContent })`);
        assert.equal(afterAdd.path, `/ar/r/${slug}/menu`, `${slug} Add does not navigate`);
        await evaluate(`document.querySelector('[data-menu-card] > a').click()`);
        await until(`location.pathname.includes('/menu/507f')`);
      }
      results.push({ slug, locale, width, cards: state.cardCount, overflow: false });
    }
  }
  console.log(JSON.stringify(results));
} finally { socket.close(); }

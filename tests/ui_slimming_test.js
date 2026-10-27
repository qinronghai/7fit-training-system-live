const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const index = read('index.html');
const app = read('js/app.js');
const home = read('js/coach/home.js');
const prep = read('js/coach/prep.js');
const library = read('js/views-library.js');
const maintenance = read('js/views-maintenance.js');
const actionDetail = read('js/action-detail.js');
const css = read('assets/app.css');

assert.match(index, /id="mobile-menu-button"[^>]*aria-controls="app-sidebar"/,
  'mobile menu must identify the sidebar it controls');
assert.match(app, /is-mobile-open/,
  'mobile menu must have an implemented open state');
assert.match(css, /\.sidebar\.is-mobile-open/,
  'mobile menu open state must be visible in responsive CSS');

assert.match(library, /class="library-advanced-filters"/,
  'advanced library filters must be progressively disclosed');
assert.match(library, /<summary>更多筛选<\/summary>/,
  'advanced library filters need a clear disclosure label');

assert.match(actionDetail, /role="dialog"/,
  'action detail must expose dialog semantics');
assert.match(actionDetail, /aria-label="关闭动作详情"/,
  'action detail close control must have an accessible name');

assert.ok(!index.includes('id="page-subtitle"'),
  'global header subtitle should not duplicate the page hero');
assert.ok(!home.includes('capabilityChips(record)'),
  'template cards should not render a capability inventory on every card');
assert.ok(!prep.includes('为什么：${esc(matchReason)}'),
  'warmup cards should not repeat explanatory copy by default');
assert.match(maintenance, /class="maintenance-deep-dive"/,
  'maintenance detail panels must be collapsed behind a deep-dive disclosure');

console.log('ui_slimming_test: PASS');

const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

// Member lazy loader: files load in original order, only on member need.
const ctx = { window: {}, console, document: { head: { appendChild: () => {} }, createElement: () => ({}) } };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('js/member/loader.js', 'utf8'), ctx, { filename: 'js/member/loader.js' });
const L = ctx.window.V14MemberLoader;
assert(L, 'V14MemberLoader missing');
assert.strictEqual(L.files.join(','), 'js/member/api.js,js/member/session.js,js/member/center.js,js/member/snapshot-client.js,js/member/selector.js');
assert.strictEqual(L.needsMemberScripts({ page: 'member-list' }), true);
assert.strictEqual(L.needsMemberScripts({ page: 'member-detail' }), true);
assert.strictEqual(L.needsMemberScripts({ page: 'compose', query: { memberId: 'x' } }), true);
assert.strictEqual(L.needsMemberScripts({ page: 'compose', query: {} }), false);
assert.strictEqual(L.needsMemberScripts({ page: 'home' }), false);
assert.strictEqual(L.isReady(), false);

// ensure() loads the five files in order via script elements.
const requested = [];
ctx.document = {
  head: { appendChild: (el) => { requested.push(el.src); el.onload(); } },
  createElement: () => ({}),
};
(async () => {
  await L.ensure();
  assert.strictEqual(L.isReady(), true);
  assert.strictEqual(requested.join(','), L.files.join(','));
  // Second ensure() must not re-request.
  await L.ensure();
  assert.strictEqual(requested.length, 5);
  console.log('member lazyload: PASS');
})().catch((e) => { console.error(e); process.exit(1); });

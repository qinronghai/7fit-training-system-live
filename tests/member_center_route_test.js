const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'js', 'router.js'), 'utf8');
const window = { V14_DATA: { templateRegistry: {} } };
vm.runInNewContext(source, { window, URLSearchParams, location: {} }, { filename: 'js/router.js' });
const router = window.V14Router;
const memberId = 'e1000000-0000-4000-8000-000000000001';

const listRoute = router.parseHash('#/coach/members');
assert.equal(listRoute.page, 'member-list');
assert.equal(router.isValid(listRoute), true);

const detailHash = `#/coach/members/${memberId}`;
const detailRoute = router.parseHash(detailHash);
assert.equal(detailRoute.page, 'member-detail');
assert.equal(detailRoute.memberId, memberId);
assert.equal(router.isValid(detailRoute), true);
assert.equal(router.canonicalHash(detailRoute), detailHash);

for (const invalidId of ['not-a-uuid', `${memberId}/extra`]) {
  const route = router.parseHash(`#/coach/members/${invalidId}`);
  assert.equal(router.isValid(route), false, `invalid member route ${invalidId}`);
}

console.log('member_center_route_test: PASS');

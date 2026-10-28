const assert = require('node:assert/strict');

async function main() {
  const { escapeLikeTerm, likeContains } = await import('../supabase/functions/_shared/like-escape.mjs');
  assert.equal(escapeLikeTerm('林'), '林');
  assert.equal(escapeLikeTerm('100%'), '100\\%');
  assert.equal(escapeLikeTerm('a_b'), 'a\\_b');
  assert.equal(escapeLikeTerm('a\\b'), 'a\\\\b');
  assert.equal(likeContains('100%'), '%100\\%%');
  assert.equal(likeContains(''), '%%');
  console.log('like escape: PASS');
}

main().catch((e) => { console.error(e); process.exit(1); });

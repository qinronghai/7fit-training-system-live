const fs=require('fs');
const vm=require('vm');
const assert=require('assert');
const root=process.cwd();

global.window=global;
for(const file of ['data/system-data.js','data/anatomy-data.js','js/content-review.js']){
  vm.runInThisContext(fs.readFileSync(`${root}/${file}`,'utf8'),{filename:file});
}

const Review=window.V14ContentReview;
assert(Review,'V14ContentReview must exist');
const contract=window.V14_DATA.contentReview;
assert.strictEqual(contract.schemaVersion,1);
assert.deepStrictEqual(contract.requiredFields,['source','evidenceLevel','reviewStatus','reviewedAt','reviewerNote']);
assert(contract.requiredDomains.includes('actions'));
assert(contract.requiredDomains.includes('anatomy'));

const all=Review.list();
assert(all.length>600,'all formal content records should be reviewable');
assert(all.every(row=>row.metadata.source));
assert(all.every(row=>['reviewed','pending','experimental'].includes(row.metadata.reviewStatus)));
assert(all.every(row=>['internal_curated','source_referenced','not_assessed'].includes(row.metadata.evidenceLevel)));
assert.strictEqual(Review.summary().total,all.length);
assert.strictEqual(Review.summary().pending,all.length,'legacy content must remain transparently pending');

const actions=Review.list({domain:'actions'});
assert(actions.length===Object.keys(window.V14_DATA.actions).length);
assert(actions.every(row=>row.domain==='actions'));
const pendingLow=Review.list({status:'pending',evidenceLevel:'not_assessed'});
assert(pendingLow.length>0);
assert(pendingLow.every(row=>row.metadata.reviewStatus==='pending'&&row.metadata.evidenceLevel==='not_assessed'));

const first=actions[0];
const original=window.V14_DATA.contentReview.overrides.actions;
window.V14_DATA.contentReview.overrides.actions={
  [first.id]:{
    source:'coach-review-2026-09-16',
    evidenceLevel:'internal_curated',
    reviewStatus:'reviewed',
    reviewedAt:'2026-09-16',
    reviewerNote:'运行时元数据测试覆盖'
  }
};
const resolved=Review.resolve('actions',first.id);
assert.strictEqual(resolved.reviewStatus,'reviewed');
assert.strictEqual(Review.summary().reviewed,1);
window.V14_DATA.contentReview.overrides.actions=original;

console.log('content_review_runtime_test: PASS');

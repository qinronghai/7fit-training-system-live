const assert=require('assert');
const fs=require('fs');
const vm=require('vm');
const ctx={window:{},console};
vm.createContext(ctx);
for(const file of ['data/system-data.js','js/composer.js']){
  vm.runInContext(fs.readFileSync(file,'utf8'),ctx,{filename:file});
}
const D=ctx.window.V14_DATA;
const C=ctx.window.V14Composer;
const id='SUP-S3-06';

assert(D.actions[id],'new support action missing');
assert.strictEqual(D.actions[id].name,'直臂支撑前跨步');
assert.strictEqual(D.actions[id].grade,'SUP-S3');
assert.strictEqual(D.actions[id].status,'SUPPORT_CANON');
assert(D.supportIds.includes(id),'supportIds missing new action');
assert(D.supportDetails[id],'supportDetails missing new action');

assert(!C.supportCandidates('L1').some(x=>x.id===id),'L1 must not see SUP-S3 action');
for(const level of ['L2','L3','L4']){
  assert(C.supportCandidates(level).some(x=>x.id===id),level+' should see SUP-S3 action');
  const resolved=C.resolve({level,lowerMode:'squat',upperMode:'horizontal_pull'});
  assert(resolved.slotOptions.C.some(x=>x.id===id),level+' composer C candidates missing new action');
}

for(const [sessionId,view] of Object.entries(D.sessionViews||{})){
  const match=sessionId.match(/-L([1-4])$/);
  if(!match) continue;
  const level='L'+match[1];
  const supportLists=Object.entries(view.slotOptions||{}).filter(([key])=>key.endsWith('__SUPPORT')).map(([,list])=>list);
  for(const list of supportLists){
    const visible=list.some(x=>x.id===id);
    if(level==='L1') assert(!visible,sessionId+' L1 preset must not expose SUP-S3');
    else assert(visible,sessionId+' preset should expose new support action');
  }
}
console.log('issue #78 support front step: PASS');

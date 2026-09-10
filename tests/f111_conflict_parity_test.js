const fs=require('fs'),vm=require('vm'),assert=require('assert'),crypto=require('crypto');
const root=process.cwd();
global.window=global;
function load(file){vm.runInThisContext(fs.readFileSync(`${root}/${file}`,'utf8'),{filename:file});}
for(const file of [
  'data/system-data.js','data/anatomy-data.js','js/prep-grade.js','js/anatomy.js','js/composer.js',
  'js/resolved-session.js','js/conflict-core.js','js/conflict-service.js','js/conflict-plugins/f111.js','js/conflict.js'
]) load(file);

const D=window.V14_DATA,C=window.V14Composer,F=window.V14Conflict;
const levels=['L1','L2','L3','L4'];
const normalize=result=>({
  status:result.status,
  hardCount:result.hardCount,
  warnCount:result.warnCount,
  issues:(result.issues||[]).map(x=>({severity:String(x.severity||''),title:String(x.title||''),text:String(x.text||''),code:String(x.code||'')}))
});
const signatures=[];

const recipeIds=(D.recipeIds||Object.keys(D.recipes||{})).filter(id=>/^F111-0[1-8]$/.test(id));
assert.strictEqual(recipeIds.length,8);
for(const recipeId of recipeIds){
  for(const level of levels){
    const sessionId=`${recipeId}-${level}`,session=D.sessions[sessionId];
    assert(session,`missing ${sessionId}`);
    signatures.push({kind:'preset',id:sessionId,result:normalize(F.evaluate(sessionId,session.slots.map(x=>x.baselineId)))});
  }
}

const lowers=Object.keys(D.composer?.lowerModes||{}),uppers=Object.keys(D.composer?.upperModes||{});
assert.strictEqual(lowers.length,5);assert.strictEqual(uppers.length,4);
for(const lowerMode of lowers){
  for(const upperMode of uppers){
    for(const level of levels){
      const resolved=C.resolve({level,lowerMode,upperMode,coreDemand:'anti_extension'});
      signatures.push({kind:'composer',id:`${resolved.compositionId}-${level}`,result:normalize(F.evaluateComposer(resolved))});
    }
  }
}

// Representative manual changes: preset duplicate, support grade outside normal window, auxiliary-pattern duplication.
{
  const sessionId='F111-01-L3',session=D.sessions[sessionId],ids=session.slots.map(x=>x.baselineId);
  ids[1]=ids[0];
  signatures.push({kind:'manual',id:'preset-duplicate',result:normalize(F.evaluate(sessionId,ids))});
}
{
  const resolved=C.resolve({level:'L3',lowerMode:'single_leg_hinge',upperMode:'horizontal_push',includeExpandedSupport:true,selections:{C:'SUP-S5-01'}});
  signatures.push({kind:'manual',id:'composer-support-grade',result:normalize(F.evaluateComposer(resolved))});
}
{
  const resolved=JSON.parse(JSON.stringify(C.resolve({level:'L3',lowerMode:'squat',upperMode:'horizontal_pull'})));
  resolved.slots[3]={slotKey:'D1',slotName:'D1｜下肢辅助',actionId:'hake_shendun',name:'哈克深蹲',tier:'T3',grade:'',coreDemand:''};
  signatures.push({kind:'manual',id:'composer-aux-pattern',result:normalize(F.evaluateComposer(resolved))});
}

assert.strictEqual(signatures.filter(x=>x.kind==='preset').length,32);
assert.strictEqual(signatures.filter(x=>x.kind==='composer').length,80);
const payload=JSON.stringify(signatures);
const hash=crypto.createHash('sha256').update(payload).digest('hex');
console.log(`F111_CONFLICT_BASELINE_SHA=${hash}`);
assert.strictEqual(hash,'af7d84bc1a1c34793cd81ea776690dfb450f3d13ea1a926be33abda590358465','F111 conflict behavior changed from the pre-migration baseline');
console.log('f111_conflict_parity_test: legacy baseline GREEN');

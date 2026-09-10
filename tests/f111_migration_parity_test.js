const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=process.cwd();
global.window=global;
function load(file){vm.runInThisContext(fs.readFileSync(`${root}/${file}`,'utf8'),{filename:file});}
for(const file of [
  'data/system-data.js','data/anatomy-data.js','js/prep-grade.js','js/anatomy.js','js/prep-resolver.js',
  'js/composer.js','js/conflict.js','js/resolved-session.js','js/template-resolver.js','js/resolvers/f111.js',
  'js/coach/common.js','js/coach/session.js','js/coach/composer-view.js'
]) load(file);

const D=window.V14_DATA,Dispatcher=window.V15TemplateResolver,M=window.V14CoachModules;
const levels=['L1','L2','L3','L4'];
const sorted=a=>[...(a||[])].sort();
const slotKey=(slot,index)=>{
  const raw=String(slot?.slotKey||'');
  if(raw.includes('__'))return raw.split('__').pop();
  const label=String(slot?.slotName||'');
  return label.includes('｜')?label.split('｜')[0]:(raw||`S${index+1}`);
};
const anatomySig=ids=>{const a=window.V14Anatomy.aggregate(ids)||{};return {actionIds:sorted(ids),primary:sorted(a.primary),secondary:sorted(a.secondary),stabilizers:sorted(a.stabilizers)};};
const conflictSig=result=>({status:result.status,hardCount:result.hardCount,warnCount:result.warnCount,codes:sorted((result.issues||[]).map(x=>String(x.code||'')))});
const v15ConflictSig=result=>({status:result.status,hardCount:result.hardCount,warnCount:result.warnCount,codes:sorted((result.issues||[]).map(x=>String(x.code||'')))});
const prepSig=context=>window.V14PrepResolver.resolve(context).slots.map(x=>`${x.slotKey}:${x.actionId}`);

let presetCount=0;
const recipeIds=(D.recipeIds||Object.keys(D.recipes||{})).filter(id=>/^F111-0[1-8]$/.test(id));
assert.strictEqual(recipeIds.length,8,'expected exactly 8 official F111 recipes');
for(const recipeId of recipeIds){
  for(const level of levels){
    const sessionId=`${recipeId}-${level}`,session=D.sessions[sessionId];
    assert(session,`missing legacy preset ${sessionId}`);
    const ids=session.slots.map(x=>x.baselineId);
    const legacySlots=session.slots.map((x,i)=>({key:slotKey(x,i),actionId:ids[i]}));
    const legacyContext=window.V14PrepResolver.contextFromF111({
      level,recipeId,
      mainActionIds:legacySlots.filter(x=>['A','B'].includes(x.key)).map(x=>x.actionId),
      formalActionIds:ids,
    });
    const legacy={
      familyId:recipeId,level,slots:legacySlots,
      anatomy:anatomySig(ids),
      conflict:conflictSig(window.V14Conflict.evaluate(sessionId,ids)),
      prep:prepSig(legacyContext),
    };
    const next=Dispatcher.resolve('f111',{mode:'preset',recipeId,level});
    const nextIds=next.main.content.map(x=>x.actionId);
    const modern={
      familyId:next.familyId,level:next.level,
      slots:next.main.content.map(x=>({key:x.key,actionId:x.actionId})),
      anatomy:{actionIds:sorted(next.anatomyContext.actionIds),primary:sorted(next.anatomyContext.primary),secondary:sorted(next.anatomyContext.secondary),stabilizers:sorted(next.anatomyContext.stabilizers)},
      conflict:v15ConflictSig(next.conflictContext),
      prep:prepSig(next.prepContext),
    };
    assert.deepStrictEqual(modern,legacy,`${sessionId} V14/V15 preset parity mismatch`);
    assert.deepStrictEqual(nextIds,ids,`${sessionId} six-slot action order changed`);
    presetCount++;
  }
}
assert.strictEqual(presetCount,32,'preset parity matrix must cover 32 sessions');

let composerCount=0;
const lowerModes=Object.keys(D.composer?.lowerModes||{}),upperModes=Object.keys(D.composer?.upperModes||{});
assert.strictEqual(lowerModes.length,5,'expected 5 F111 lower modes');
assert.strictEqual(upperModes.length,4,'expected 4 F111 upper modes');
for(const lowerMode of lowerModes){
  for(const upperMode of upperModes){
    for(const level of levels){
      const input={level,lowerMode,upperMode,coreDemand:'anti_extension'};
      const legacyResolved=window.V14Composer.resolve(input);
      const legacyIds=legacyResolved.slots.map(x=>x.actionId);
      const legacyContext=window.V14PrepResolver.contextFromF111({
        level,recipeId:'',
        mainPatterns:[legacyResolved.lower?.name,legacyResolved.upper?.name].filter(Boolean),
        mainActionIds:legacyResolved.slots.filter(x=>['A','B'].includes(x.slotKey)).map(x=>x.actionId),
        formalActionIds:legacyIds,
      });
      const legacy={
        familyId:legacyResolved.compositionId,level,
        slots:legacyResolved.slots.map(x=>({key:x.slotKey,actionId:x.actionId,tier:x.tier||'',grade:x.grade||'',prescription:x.prescriptionOverride||''})),
        anatomy:anatomySig(legacyIds),
        conflict:conflictSig(window.V14Conflict.evaluateComposer(legacyResolved)),
        prep:prepSig(legacyContext),
      };
      const next=Dispatcher.resolve('f111',{mode:'composer',...input});
      const modern={
        familyId:next.familyId,level:next.level,
        slots:next.main.content.map(x=>({key:x.key,actionId:x.actionId,tier:x.tier||'',grade:x.grade||'',prescription:x.prescription||''})),
        anatomy:{actionIds:sorted(next.anatomyContext.actionIds),primary:sorted(next.anatomyContext.primary),secondary:sorted(next.anatomyContext.secondary),stabilizers:sorted(next.anatomyContext.stabilizers)},
        conflict:v15ConflictSig(next.conflictContext),
        prep:prepSig(next.prepContext),
      };
      assert.deepStrictEqual(modern,legacy,`${legacyResolved.compositionId}-${level} V14/V15 composer parity mismatch`);
      composerCount++;
    }
  }
}
assert.strictEqual(composerCount,80,'composer parity matrix must cover 80 states');
console.log(`f111_migration_parity_test: resolver parity GREEN (${presetCount} preset + ${composerCount} composer)`);

// Migration RED boundary: Coach public consumption must resolve through V15 rather than own a second V14 resolution path.
assert.strictEqual(typeof M.Session.resolveResolvedSession,'function','RED #30: Session must expose V15 ResolvedSession consumption');
window.V14State={getComposerSelections:()=>({})};
const originalResolve=Dispatcher.resolve.bind(Dispatcher),calls=[];
Dispatcher.resolve=(templateId,input)=>{calls.push({templateId,input});return originalResolve(templateId,input);};
const ctx=M.ComposerView.composerContext({query:{level:'L3',lower:'single_leg_hinge',upper:'horizontal_push',core:'anti_extension'}});
assert(ctx.resolvedSession&&ctx.resolvedSession.templateId==='f111','RED #30: Composer context must carry the V15 ResolvedSession');
assert(calls.some(x=>x.templateId==='f111'&&x.input?.mode==='composer'),'RED #30: Composer public consumption must call V15TemplateResolver');
console.log('f111_migration_parity_test: public consumption GREEN');

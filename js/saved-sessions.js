(function(){
  'use strict';

  const D=()=>window.V14_DATA||{};
  const S=()=>window.V15State||null;
  const LEVELS=new Set(['L1','L2','L3','L4']);
  let lastRestoreNotice=null;

  function clone(value){return JSON.parse(JSON.stringify(value));}
  function manualMap(value,prep=false){
    const out={};
    if(!value||typeof value!=='object'||Array.isArray(value))return out;
    for(const [key,entry] of Object.entries(value)){
      if(!entry||typeof entry!=='object'||entry.source!=='manual'||typeof entry.actionId!=='string'||!entry.actionId)continue;
      out[key]={actionId:entry.actionId,source:'manual'};
    }
    return out;
  }
  function normalizeSlotKey(slot,index){
    const raw=String(slot?.slotKey||'');
    if(raw.includes('__'))return raw.split('__').pop();
    const label=String(slot?.slotName||'');
    if(label.includes('｜'))return label.split('｜')[0];
    return raw||`S${index+1}`;
  }
  function addReason(reasons,code){
    if(code&&!reasons.includes(code))reasons.push(code);
  }
  function routeSurface(route){
    return route?.page==='template-compose'||route?.page==='compose'?'compose':'session';
  }

  function conditioningRouteIntent(data,route={}){
    const rawFamily=String(route.familyId||route.query?.family||'CON-01').toUpperCase();
    const familyId=(data.conditioningFamilyIds||[]).includes(rawFamily)?rawFamily:'CON-01';
    const rawLevel=String(route.level||route.query?.level||'L1').toUpperCase();
    const level=LEVELS.has(rawLevel)?rawLevel:'L1';
    const variants=data.conditioningBlueprints?.[familyId]?.[level]||{};
    const rawVariant=String(route.query?.variant||'').toUpperCase();
    if(rawVariant&&variants[rawVariant])return {familyId,level,variantId:rawVariant,protocolId:'',legacy:false};
    const protocolId=String(route.query?.protocol||'').toUpperCase();
    const family=data.conditioningFamilies?.[familyId];
    const protocolValid=!!data.conditioningProtocols?.[protocolId]&&family?.protocolEligibility?.includes(protocolId);
    if(protocolValid){
      const matching=Object.entries(variants).find(([,blueprint])=>blueprint?.blocks?.some(block=>block.protocolId===protocolId));
      if(matching)return {familyId,level,variantId:matching[0],protocolId,legacy:false};
      return {familyId,level,variantId:'',protocolId,legacy:true};
    }
    const variantId=variants.A?'A':Object.keys(variants)[0]||'A';
    return {familyId,level,variantId,protocolId:'',legacy:false};
  }

  function failResult(code,message,record=null){
    return {ok:false,code,message,record:record?clone(record):null,reasons:[code],droppedSelections:[],droppedPrepSelections:[]};
  }

  function f111ComposerInput(route={}){
    const cfg=D().composer||{},q=route.query||{};
    const level=LEVELS.has(q.level)?q.level:'L1';
    const lowerMode=cfg.lowerModes?.[q.lower]?q.lower:Object.keys(cfg.lowerModes||{})[0];
    const upperMode=cfg.upperModes?.[q.upper]?q.upper:Object.keys(cfg.upperModes||{})[0];
    const coreDemand=cfg.coreDemands?.[q.core]?q.core:'anti_extension';
    const flags={
      includeExpandedMain:q.em==='1',
      includeExpandedSupport:q.es==='1',
      includeExpandedCore:q.ec==='1',
    };
    const resolved=window.V14Composer.resolve({level,lowerMode,upperMode,coreDemand,...flags});
    return {
      templateId:'f111',
      sessionKey:`${resolved.compositionId}-${level}`,
      familyId:resolved.compositionId,
      level,
      resolverVersion:'f111-adapter-v1',
      input:{
        mode:'composer',
        legacyCompositionKey:`${resolved.compositionId}-${level}`,
        level,lowerMode,upperMode,coreDemand,...flags,
        surface:'compose',
      },
    };
  }

  function descriptorFromRoute(route={}){
    const data=D();
    if(route.templateId==='f111'||route.page==='compose'||route.page==='preset'){
      if(route.page==='compose'||route.page==='template'){
        return f111ComposerInput(route);
      }
      const recipeId=String(route.recipeId||'').toUpperCase(),level=String(route.level||'').toUpperCase();
      if(!data.recipes?.[recipeId]||!LEVELS.has(level))return null;
      const sessionKey=`${recipeId}-${level}`;
      return {
        templateId:'f111',sessionKey,familyId:recipeId,level,resolverVersion:'f111-adapter-v1',
        input:{mode:'preset',recipeId,level,sessionId:sessionKey,surface:'session'},
      };
    }

    if(route.templateId==='body'){
      const ids=data.bodyFamilyIds||[];
      const rawFamily=String(route.familyId||route.query?.family||'BODY-01').toUpperCase();
      const familyId=ids.includes(rawFamily)?rawFamily:'BODY-01';
      const rawLevel=String(route.level||route.query?.level||'L1').toUpperCase();
      const level=LEVELS.has(rawLevel)?rawLevel:'L1';
      return {
        templateId:'body',sessionKey:`${familyId}-${level}`,familyId,level,resolverVersion:'body-v1',
        input:{familyId,level,surface:routeSurface(route)},
      };
    }

    if(route.templateId==='conditioning'){
      const intent=conditioningRouteIntent(data,route),{familyId,level,variantId}=intent;
      const blueprint=data.conditioningBlueprints?.[familyId]?.[level]?.[variantId]||{};
      if(intent.legacy){
        const sessionKey=`${familyId}-${level}-PROTOCOL-${intent.protocolId}`;
        return {
          templateId:'conditioning',sessionKey,familyId,level,resolverVersion:'conditioning-v1',
          input:{familyId,level,protocolId:intent.protocolId,surface:routeSurface(route)},
        };
      }
      return {
        templateId:'conditioning',
        sessionKey:`${familyId}-${level}-BLUEPRINT-${variantId}`,
        familyId,level,resolverVersion:'conditioning-v2',
        input:{
          familyId,level,variantId,
          sessionBlueprintId:blueprint.sessionBlueprintId||`${familyId}-${level}-${variantId}`,
          surface:routeSurface(route),
        },
      };
    }
    if(route.templateId==='hyrox'&&route.page==='template-session'){
      const sessionType=String(route.sessionType||'').toUpperCase();
      const protocolId=sessionType==='BENCHMARK'?String(route.protocolId||'').toUpperCase():'';
      const protocol=data.hyroxBenchmarkProtocols?.[protocolId];
      const level=sessionType==='BENCHMARK'?(protocol?.level||''):String(route.level||'').toUpperCase();
      if(!(data.hyroxSessionTypeIds||[]).includes(sessionType)||!LEVELS.has(level))return null;
      const capacityFocus=sessionType==='CAPACITY'?String(route.query?.focus||'ENGINE').toUpperCase():'';
      if(sessionType==='CAPACITY'&&!(data.hyroxCapacityGroupIds||[]).includes(capacityFocus))return null;
      if(sessionType==='BENCHMARK'&&!(data.hyroxBenchmarkProtocolIds||[]).includes(protocolId))return null;
      const sessionKey=sessionType==='BENCHMARK'
        ?'BENCHMARK-'+protocolId
        :sessionType==='CAPACITY'
          ?'CAPACITY-'+capacityFocus+'-'+level
          :sessionType+'-'+level;
      const familyId=sessionType==='BENCHMARK'?'HYROX-'+protocolId:sessionType==='CAPACITY'?'HYROX-CAPACITY-'+capacityFocus:'HYROX-'+sessionType;
      const stateInput=S()?.getSession?.('hyrox',sessionKey)?.input||{};
      return {
        templateId:'hyrox',sessionKey,familyId,level,resolverVersion:'hyrox-v1',
        input:{...clone(stateInput),sessionType,level,...(capacityFocus?{capacityFocus}:{}),...(protocolId?{benchmarkProtocolId:protocolId}:{}),surface:'session'},
      };
    }
    return null;
  }

  function ensureDescriptorSession(descriptor){
    const state=S();
    if(!state)throw new Error('V15State is unavailable');
    let current=state.getSession(descriptor.templateId,descriptor.sessionKey);
    if(!current){
      return state.ensureSession(descriptor.templateId,descriptor.sessionKey,{
        familyId:descriptor.familyId,
        level:descriptor.level,
        resolverVersion:descriptor.resolverVersion,
        input:descriptor.input,
      });
    }
    if(current.resolverVersion!==descriptor.resolverVersion){
      current=state.reconcileSession(descriptor.templateId,descriptor.sessionKey,{resolverVersion:descriptor.resolverVersion}).session;
    }
    return state.ensureSession(descriptor.templateId,descriptor.sessionKey,{
      familyId:descriptor.familyId,
      level:descriptor.level,
      resolverVersion:descriptor.resolverVersion,
      input:descriptor.input,
    });
  }

  function defaultName(descriptor){
    const data=D(),template=data.templateRegistry?.[descriptor.templateId];
    if(descriptor.templateId==='f111'){
      if(descriptor.input.mode==='preset')return `${data.recipes?.[descriptor.familyId]?.name||descriptor.familyId} · ${descriptor.level}`;
      const r=window.V14Composer.resolve(descriptor.input);
      return `${r.lower?.name||''} + ${r.upper?.name||''} · ${descriptor.level}`;
    }
    if(descriptor.templateId==='body')return `${data.bodyFamilies?.[descriptor.familyId]?.name||descriptor.familyId} · ${descriptor.level}`;
    if(descriptor.templateId==='conditioning'){
      const family=data.conditioningFamilies?.[descriptor.familyId]?.name||descriptor.familyId;
      const blueprint=data.conditioningBlueprints?.[descriptor.familyId]?.[descriptor.level]?.[descriptor.input.variantId]||{};
      return `${family} · ${descriptor.level} · ${blueprint.label||descriptor.input.variantId||'A 变体'}`;
    }
    if(descriptor.templateId==='hyrox'){
      if(descriptor.input.sessionType==='BENCHMARK'){
        const protocol=data.hyroxBenchmarkProtocols?.[descriptor.input.benchmarkProtocolId]||{};
        return ('HYROX Benchmark · '+descriptor.input.benchmarkProtocolId+' '+(protocol.name||'')).trim();
      }
      const type=data.hyroxSessionTypes?.[descriptor.input.sessionType]?.name||descriptor.input.sessionType;
      const focus=descriptor.input.capacityFocus?' · '+descriptor.input.capacityFocus:'';
      return 'HYROX '+type+' · '+descriptor.level+focus;
    }
    return `${template?.shortName||descriptor.templateId} · ${descriptor.level}`;
  }

  function saveRoute(route,name='',options={}){
    const state=S(),descriptor=descriptorFromRoute(route);
    if(!state)throw new Error('V15State is unavailable');
    if(!descriptor)throw new Error('Current route cannot be saved');
    ensureDescriptorSession(descriptor);
    return state.createSavedSession(descriptor.templateId,descriptor.sessionKey,{
      name:typeof name==='string'&&name.trim()?name.trim():defaultName(descriptor),
      input:descriptor.input,
      now:options.now,
      savedId:options.savedId,
    });
  }

  function validatePrep(prepContext,savedPrep){
    const resolver=window.V14PrepResolver,requested=manualMap(savedPrep,true);
    const accepted={},dropped=[];
    if(!resolver?.resolve||!prepContext)return {accepted,dropped:Object.keys(requested)};
    const resolved=resolver.resolve(prepContext,{selections:requested});
    const byKey=Object.fromEntries((resolved.slots||[]).map(slot=>[slot.slotKey,slot]));
    for(const [slotKey,entry] of Object.entries(requested)){
      const slot=byKey[slotKey];
      if(slot?.source==='manual'&&slot.actionId===entry.actionId)accepted[slotKey]=entry;
      else dropped.push(slotKey);
    }
    return {accepted,dropped};
  }

  function applyRestoredState({templateId,sessionKey,familyId,level,resolverVersion,input,selections,prepSelections}){
    const state=S();
    state.resetSession(templateId,sessionKey);
    state.ensureSession(templateId,sessionKey,{familyId,level,resolverVersion,input});
    state.patchSession(templateId,sessionKey,{input,selections,prepSelections});
    return state.getSession(templateId,sessionKey);
  }

  function presetRestore(record,reasons){
    const data=D(),recipeId=data.recipes?.[record.input?.recipeId]?record.input.recipeId:record.familyId,level=record.level;
    if(!data.recipes?.[recipeId]||!LEVELS.has(level))return failResult('UNRESTORABLE_F111_PRESET','Saved F111 preset identity is no longer available',record);
    const sessionId=`${recipeId}-${level}`,session=data.sessions?.[sessionId],view=data.sessionViews?.[sessionId]||{};
    if(!session)return failResult('UNRESTORABLE_F111_PRESET','Saved F111 preset session is no longer available',record);

    const requested=manualMap(record.selections),accepted={},dropped=[];
    const selectedArray=(session.slots||[]).map((slot,index)=>{
      const key=normalizeSlotKey(slot,index),entry=requested[key];
      if(!entry)return slot.baselineId;
      const options=view.slotOptions?.[slot.slotKey]||[];
      const allowed=new Set(options.map(x=>x.id).filter(Boolean));
      allowed.add(slot.baselineId);
      if(key==='D1'&&window.V15LowerAssistance?.isF111SelectionValid){
        const lowerMode=data.composer?.officialPresetMap?.[recipeId]?.[0]||'';
        const otherIds=(session.slots||[]).filter((_,candidateIndex)=>candidateIndex!==index).map((peer,peerIndex)=>requested[normalizeSlotKey(peer,peerIndex)]?.actionId||peer.baselineId).filter(Boolean);
        if(window.V15LowerAssistance.isF111SelectionValid({actionId:entry.actionId,level,lowerMode,currentActionIds:otherIds})){
          accepted[key]=entry;
          return entry.actionId;
        }
      }else if(data.actions?.[entry.actionId]&&allowed.has(entry.actionId)){
        accepted[key]=entry;
        return entry.actionId;
      }
      dropped.push(key);
      return slot.baselineId;
    });
    if(dropped.length)addReason(reasons,'STALE_SELECTION');

    const resolved=window.V15TemplateResolver.resolve('f111',{mode:'preset',recipeId,level,selections:selectedArray});
    if(record.resolverVersion!==resolved.resolverVersion)addReason(reasons,'RESOLVER_VERSION_MISMATCH');
    const prep=validatePrep(resolved.prepContext,record.prepSelections);
    if(prep.dropped.length)addReason(reasons,'STALE_PREP_SELECTION');

    const input={mode:'preset',recipeId,level,sessionId,surface:'session'};
    applyRestoredState({
      templateId:'f111',sessionKey:sessionId,familyId:recipeId,level,
      resolverVersion:resolved.resolverVersion,input,selections:accepted,prepSelections:prep.accepted,
    });
    return {
      ok:true,code:reasons.length?'RESTORED_WITH_MIGRATION':'RESTORED',
      hash:`#/coach/f111/${recipeId.toLowerCase()}/${level.toLowerCase()}`,
      templateId:'f111',sessionKey:sessionId,reasons,
      droppedSelections:dropped,droppedPrepSelections:prep.dropped,
    };
  }

  function composerRestore(record,reasons){
    const data=D(),cfg=data.composer||{},saved=record.input||{},level=LEVELS.has(record.level)?record.level:'L1';
    const lowerMode=cfg.lowerModes?.[saved.lowerMode]?saved.lowerMode:Object.keys(cfg.lowerModes||{})[0];
    const upperMode=cfg.upperModes?.[saved.upperMode]?saved.upperMode:Object.keys(cfg.upperModes||{})[0];
    const coreDemand=cfg.coreDemands?.[saved.coreDemand]?saved.coreDemand:'anti_extension';
    if(lowerMode!==saved.lowerMode||upperMode!==saved.upperMode||coreDemand!==saved.coreDemand)addReason(reasons,'STALE_INPUT');
    const flags={
      includeExpandedMain:!!saved.includeExpandedMain,
      includeExpandedSupport:!!saved.includeExpandedSupport,
      includeExpandedCore:!!saved.includeExpandedCore,
    };
    const base={mode:'composer',level,lowerMode,upperMode,coreDemand,...flags};
    const initial=window.V14Composer.resolve(base),sessionKey=`${initial.compositionId}-${level}`;
    const requested=manualMap(record.selections),acceptedPlain={},accepted={},dropped=[];
    for(const key of ['A','B','C','D1','D2','CORE']){
      const entry=requested[key];
      if(!entry)continue;
      const probe=window.V14Composer.resolve({...base,selections:acceptedPlain});
      const legal=(probe.slotOptions?.[key]||[]).some(option=>option.id===entry.actionId);
      if(legal&&data.actions?.[entry.actionId]){
        acceptedPlain[key]=entry.actionId;
        accepted[key]=entry;
      }else dropped.push(key);
    }
    if(dropped.length)addReason(reasons,'STALE_SELECTION');
    const resolved=window.V15TemplateResolver.resolve('f111',{...base,selections:acceptedPlain});
    if(record.resolverVersion!==resolved.resolverVersion)addReason(reasons,'RESOLVER_VERSION_MISMATCH');
    const prep=validatePrep(resolved.prepContext,record.prepSelections);
    if(prep.dropped.length)addReason(reasons,'STALE_PREP_SELECTION');

    const input={
      ...base,
      legacyCompositionKey:sessionKey,
      surface:'compose',
    };
    applyRestoredState({
      templateId:'f111',sessionKey,familyId:resolved.familyId,level,
      resolverVersion:resolved.resolverVersion,input,selections:accepted,prepSelections:prep.accepted,
    });
    const q={level,lower:lowerMode,upper:upperMode,core:coreDemand};
    if(flags.includeExpandedMain)q.em='1';
    if(flags.includeExpandedSupport)q.es='1';
    if(flags.includeExpandedCore)q.ec='1';
    return {
      ok:true,code:reasons.length?'RESTORED_WITH_MIGRATION':'RESTORED',
      hash:'#/coach/f111?'+new URLSearchParams(q).toString(),
      templateId:'f111',sessionKey,reasons,
      droppedSelections:dropped,droppedPrepSelections:prep.dropped,
    };
  }

  function acceptedResolvedSelections(record,resolved){
    const requested=manualMap(record.selections),accepted={},dropped=[];
    const actual=Object.fromEntries((resolved.resolvedSelections||[]).map(item=>[item.key,item]));
    for(const [key,entry] of Object.entries(requested)){
      const current=actual[key];
      if(current?.source==='manual'&&current.actionId===entry.actionId)accepted[key]=entry;
      else dropped.push(key);
    }
    return {accepted,dropped};
  }

  function bodyRestore(record,reasons){
    const data=D(),familyId=record.familyId,level=record.level;
    if(!(data.bodyFamilyIds||[]).includes(familyId)||!LEVELS.has(level))return failResult('UNRESTORABLE_BODY_SESSION','Saved Body Family / Level is no longer available',record);
    const requested=manualMap(record.selections);
    const resolved=window.V15TemplateResolver.resolve('body',{familyId,level,selections:requested});
    if(record.resolverVersion!==resolved.resolverVersion)addReason(reasons,'RESOLVER_VERSION_MISMATCH');
    const formal=acceptedResolvedSelections(record,resolved);
    if(formal.dropped.length)addReason(reasons,'STALE_SELECTION');
    const prep=validatePrep(resolved.prepContext,record.prepSelections);
    if(prep.dropped.length)addReason(reasons,'STALE_PREP_SELECTION');
    const surface=record.input?.surface==='compose'?'compose':'session';
    const input={familyId,level,surface};
    const sessionKey=`${familyId}-${level}`;
    applyRestoredState({
      templateId:'body',sessionKey,familyId,level,resolverVersion:resolved.resolverVersion,input,
      selections:formal.accepted,prepSelections:prep.accepted,
    });
    const hash=surface==='compose'
      ?`#/coach/body/compose?family=${encodeURIComponent(familyId)}&level=${encodeURIComponent(level)}`
      :`#/coach/body/${familyId.toLowerCase()}/${level.toLowerCase()}`;
    return {
      ok:true,code:reasons.length?'RESTORED_WITH_MIGRATION':'RESTORED',
      hash,templateId:'body',sessionKey,reasons,
      droppedSelections:formal.dropped,droppedPrepSelections:prep.dropped,
    };
  }

  function conditioningRestore(record,reasons){
    const data=D(),familyId=record.familyId,level=record.level;
    if(!(data.conditioningFamilyIds||[]).includes(familyId)||!LEVELS.has(level))return failResult('UNRESTORABLE_CONDITIONING_SESSION','Saved Conditioning Family / Level is no longer available',record);
    const variants=data.conditioningBlueprints?.[familyId]?.[level]||{},variantId=String(record.input?.variantId||'').toUpperCase();
    const blueprint=variants[variantId];
    if(record.resolverVersion!=='conditioning-v2'||!blueprint||record.input?.sessionBlueprintId!==blueprint.sessionBlueprintId){
      return failResult(
        'CONDITIONING_BLUEPRINT_MIGRATION_REQUIRED',
        '这条 Conditioning 保存记录仍是旧版单块课程，需要明确升级为多区块课程；原记录未修改。',
        {...record,migration:{fromResolverVersion:record.resolverVersion||'unknown',toResolverVersion:'conditioning-v2',targetVariantId:'A'}},
      );
    }
    const requested=manualMap(record.selections);
    const resolved=window.V15TemplateResolver.resolve('conditioning',{familyId,level,variantId,selections:requested});
    if(record.resolverVersion!==resolved.resolverVersion)addReason(reasons,'RESOLVER_VERSION_MISMATCH');
    const formal=acceptedResolvedSelections(record,resolved);
    if(formal.dropped.length)addReason(reasons,'STALE_SELECTION');
    const prep=validatePrep(resolved.prepContext,record.prepSelections);
    if(prep.dropped.length)addReason(reasons,'STALE_PREP_SELECTION');
    const surface=record.input?.surface==='compose'?'compose':'session';
    const input={familyId,level,variantId,sessionBlueprintId:blueprint.sessionBlueprintId,surface};
    const sessionKey=`${familyId}-${level}-BLUEPRINT-${variantId}`;
    applyRestoredState({
      templateId:'conditioning',sessionKey,familyId,level,resolverVersion:resolved.resolverVersion,input,
      selections:formal.accepted,prepSelections:prep.accepted,
    });
    const hash=surface==='compose'
      ?`#/coach/conditioning/compose?family=${encodeURIComponent(familyId)}&level=${encodeURIComponent(level)}&variant=${encodeURIComponent(variantId)}`
      :`#/coach/conditioning/${familyId.toLowerCase()}/${level.toLowerCase()}?variant=${encodeURIComponent(variantId)}`;
    return {
      ok:true,code:reasons.length?'RESTORED_WITH_MIGRATION':'RESTORED',
      hash,templateId:'conditioning',sessionKey,reasons,
      droppedSelections:formal.dropped,droppedPrepSelections:prep.dropped,
    };
  }

  function conditioningMigrate(record){
    const data=D(),familyId=record?.familyId,level=record?.level;
    if(record?.templateId!=='conditioning')return failResult('CONDITIONING_BLUEPRINT_MIGRATION_INVALID','只有 Conditioning 保存记录可以执行此升级',record);
    if(!(data.conditioningFamilyIds||[]).includes(familyId)||!LEVELS.has(level))return failResult('UNRESTORABLE_CONDITIONING_SESSION','Saved Conditioning Family / Level is no longer available',record);
    const variants=data.conditioningBlueprints?.[familyId]?.[level]||{};
    const requestedVariant=String(record.input?.variantId||'').toUpperCase();
    const repairableV2=record.resolverVersion==='conditioning-v2'&&!!variants[requestedVariant];
    const currentBlueprint=variants[requestedVariant];
    if(repairableV2&&record.input?.sessionBlueprintId===currentBlueprint.sessionBlueprintId){
      return failResult('CONDITIONING_BLUEPRINT_ALREADY_CURRENT','这条 Conditioning 保存记录已经是多区块版本',record);
    }
    const variantId=repairableV2?requestedVariant:'A',blueprint=variants[variantId];
    if(!blueprint)return failResult('CONDITIONING_BLUEPRINT_UNAVAILABLE','当前 Conditioning 多区块蓝图不可用',record);
    let resolved,accepted={},dropped=[];
    try{
      resolved=window.V15TemplateResolver.resolve('conditioning',{familyId,level,variantId,selections:repairableV2?manualMap(record.selections):{}});
      if(repairableV2){
        const formal=acceptedResolvedSelections(record,resolved);
        accepted=formal.accepted;
        dropped=formal.dropped;
      }
    }catch(error){
      return failResult('CONDITIONING_BLUEPRINT_MIGRATION_FAILED',error?.message||'升级多区块课程失败，原记录未修改',record);
    }
    const prep=validatePrep(resolved.prepContext,record.prepSelections);
    const state=S(),sessionKey=`${familyId}-${level}-BLUEPRINT-${variantId}-${repairableV2?'REPAIR':'MIGRATION'}-${record.savedId}`;
    const targetSessionKey=`${familyId}-${level}-BLUEPRINT-${variantId}`;
    const input={familyId,level,variantId,sessionBlueprintId:blueprint.sessionBlueprintId,surface:record.input?.surface==='compose'?'compose':'session'};
    const baseName=record.name||`${familyId} · ${level}`;
    const preferredId=`${record.savedId}-${repairableV2?'repair':'blueprint'}`;
    const savedId=state.getSavedSession(preferredId)?undefined:preferredId;
    let created;
    try{
      state.ensureSession('conditioning',sessionKey,{familyId,level,resolverVersion:'conditioning-v2',input});
      state.patchSession('conditioning',sessionKey,{selections:accepted,prepSelections:prep.accepted});
      created=state.createSavedSession('conditioning',sessionKey,{savedId,name:`${baseName} · 多区块 ${variantId}${repairableV2?' 修复':'升级'}`,input});
    }catch(error){
      state.resetSession('conditioning',sessionKey);
      return failResult('CONDITIONING_BLUEPRINT_MIGRATION_FAILED',error?.message||'升级多区块课程失败，原记录未修改',record);
    }
    state.resetSession('conditioning',sessionKey);
    const surface=input.surface;
    const hash=surface==='compose'
      ?`#/coach/conditioning/compose?family=${encodeURIComponent(familyId)}&level=${encodeURIComponent(level)}&variant=${variantId}`
      :`#/coach/conditioning/${familyId.toLowerCase()}/${level.toLowerCase()}?variant=${encodeURIComponent(variantId)}`;
    return {
      ok:true,code:repairableV2?'REPAIRED_EXPLICITLY':'MIGRATED_EXPLICITLY',hash,templateId:'conditioning',sessionKey:targetSessionKey,
      savedId:created.savedId,originalSavedId:record.savedId,
      reasons:repairableV2?['CONDITIONING_BLUEPRINT_REPAIRED']:['CONDITIONING_BLUEPRINT_MIGRATION','LEGACY_SINGLE_BLOCK_SELECTIONS_DROPPED'],
      droppedSelections:repairableV2?dropped:Object.keys(record.selections||{}),
      droppedPrepSelections:prep.dropped,
    };
  }

  function hyroxRestore(record,reasons){
    const data=D(),saved=clone(record.input||{}),sessionType=String(saved.sessionType||'').toUpperCase();
    if(!(data.hyroxSessionTypeIds||[]).includes(sessionType))return failResult('UNRESTORABLE_HYROX_SESSION','Saved HYROX session type is no longer available',record);
    let level=LEVELS.has(record.level)?record.level:String(saved.level||'').toUpperCase();
    let protocolId='';
    if(sessionType==='BENCHMARK'){
      protocolId=String(saved.benchmarkProtocolId||'').toUpperCase();
      const protocol=data.hyroxBenchmarkProtocols?.[protocolId];
      if(!protocol)return failResult('UNRESTORABLE_HYROX_SESSION','Saved HYROX Benchmark protocol is no longer available',record);
      level=protocol.level;
    }
    if(!LEVELS.has(level))return failResult('UNRESTORABLE_HYROX_SESSION','Saved HYROX level is no longer available',record);
    let capacityFocus='';
    if(sessionType==='CAPACITY'){
      capacityFocus=String(saved.capacityFocus||'ENGINE').toUpperCase();
      if(!(data.hyroxCapacityGroupIds||[]).includes(capacityFocus)){capacityFocus='ENGINE';addReason(reasons,'STALE_INPUT');}
    }
    const input={...saved,sessionType,level,...(capacityFocus?{capacityFocus}:{}),...(protocolId?{benchmarkProtocolId:protocolId}:{}),surface:'session'};
    let resolved;
    try{resolved=window.V15TemplateResolver.resolve('hyrox',input);}
    catch(error){
      const fallback={...input};delete fallback.selections;delete fallback.workOverrides;delete fallback.scaledVariants;
      try{resolved=window.V15TemplateResolver.resolve('hyrox',fallback);delete input.selections;delete input.workOverrides;delete input.scaledVariants;Object.assign(input,fallback);addReason(reasons,'STALE_INPUT');}
      catch(_){return failResult('UNRESTORABLE_HYROX_SESSION',error?.message||'Saved HYROX session is no longer restorable',record);}
    }
    if(record.resolverVersion!==resolved.resolverVersion)addReason(reasons,'RESOLVER_VERSION_MISMATCH');
    const prepContext=window.V14PrepResolver?.contextFromHyrox?.({level,recipeId:resolved.familyId,stationIds:resolved.domainContext?.orderedStations||[],modalities:Object.values(resolved.domainContext?.stations||{}).map(item=>item.modality)})||resolved.prepContext;
    const prep=validatePrep(prepContext,record.prepSelections);if(prep.dropped.length)addReason(reasons,'STALE_PREP_SELECTION');
    const sessionKey=sessionType==='BENCHMARK'?'BENCHMARK-'+protocolId:sessionType==='CAPACITY'?'CAPACITY-'+capacityFocus+'-'+level:sessionType+'-'+level;
    applyRestoredState({templateId:'hyrox',sessionKey,familyId:resolved.familyId,level,resolverVersion:resolved.resolverVersion,input,selections:{},prepSelections:prep.accepted});
    const hash=sessionType==='BENCHMARK'?'#/coach/hyrox/benchmark/'+protocolId.toLowerCase():sessionType==='CAPACITY'?'#/coach/hyrox/capacity/'+level.toLowerCase()+'?focus='+encodeURIComponent(capacityFocus):'#/coach/hyrox/'+sessionType.toLowerCase()+'/'+level.toLowerCase();
    return {ok:true,code:reasons.length?'RESTORED_WITH_MIGRATION':'RESTORED',hash,templateId:'hyrox',sessionKey,reasons,droppedSelections:[],droppedPrepSelections:prep.dropped};
  }

  function restore(savedId){
    const state=S(),record=state?.getSavedSession?.(savedId);
    if(!record)return failResult('SAVED_SESSION_NOT_FOUND','Saved session does not exist');
    if(record.schemaVersion!==state.getSavedSessionSchemaVersion()){
      return failResult('UNSUPPORTED_SAVED_SCHEMA',`Saved session schema ${record.schemaVersion} is not supported`,record);
    }
    const registry=D().templateRegistry?.[record.templateId];
    if(!registry||registry.status!=='ACTIVE')return failResult('UNRESTORABLE_TEMPLATE','Saved template is not active',record);
    const reasons=[];
    let result;
    if(record.templateId==='f111'){
      result=record.input?.mode==='composer'?composerRestore(record,reasons):presetRestore(record,reasons);
    }else if(record.templateId==='body'){
      result=bodyRestore(record,reasons);
    }else if(record.templateId==='conditioning'){
      result=conditioningRestore(record,reasons);
    }else if(record.templateId==='hyrox'){
      result=hyroxRestore(record,reasons);
    }else{
      result=failResult('UNRESTORABLE_TEMPLATE','Saved template is not supported',record);
    }
    if(result.ok){
      lastRestoreNotice={
        code:result.code,
        savedId,
        name:record.name,
        templateId:record.templateId,
        level:record.level,
        sessionKey:result.sessionKey,
        reasons:[...result.reasons],
        droppedSelections:[...result.droppedSelections],
        droppedPrepSelections:[...result.droppedPrepSelections],
        hash:result.hash,
      };
    }
    return result;
  }

  function list(){return S()?.listSavedSessions?.()||[];}
  function rename(savedId,name,options={}){return S().renameSavedSession(savedId,name,options);}
  function remove(savedId){return S().deleteSavedSession(savedId);}
  function migrate(savedId){
    const record=S()?.getSavedSession?.(savedId);
    if(!record)return failResult('SAVED_SESSION_NOT_FOUND','Saved session does not exist');
    const result=conditioningMigrate(record);
    if(result.ok){
      lastRestoreNotice={
        code:result.code,
        savedId:result.savedId,
        originalSavedId:result.originalSavedId,
        name:S().getSavedSession(result.savedId)?.name||record.name,
        templateId:result.templateId,
        level:record.level,
        sessionKey:result.sessionKey,
        reasons:[...result.reasons],
        droppedSelections:[...result.droppedSelections],
        droppedPrepSelections:[...result.droppedPrepSelections],
        hash:result.hash,
      };
    }
    return result;
  }
  function getLastRestoreNotice(){return lastRestoreNotice?clone(lastRestoreNotice):null;}
  function clearRestoreNotice(){lastRestoreNotice=null;}

  window.V15SavedSessions={
    descriptorFromRoute,defaultName,saveRoute,restore,migrate,list,rename,remove,
    getLastRestoreNotice,clearRestoreNotice,
  };
})();

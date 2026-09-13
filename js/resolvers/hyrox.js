(function(){
  'use strict';

  const D=()=>window.V14_DATA||{};
  const LEVELS=Object.freeze(['L1','L2','L3','L4']);
  const SESSION_TYPES=new Set(['SKILL','CAPACITY','MIXED','BENCHMARK']);
  const FOCUS_IDS=new Set(['ENGINE','SLED','LOCOMOTION','MIXED_STRENGTH_ENDURANCE']);
  const STATION_IDS=Object.freeze(['H1','H2','H3','H4','H5','H6','H7','H8']);
  const WORK_METRICS=new Set(['METER','TURF_LENGTH','REP']);
  const DEFAULT_SKILL=Object.freeze({
    L1:Object.freeze(['H1','H4','H8']),
    L2:Object.freeze(['H1','H6','H8']),
    L3:Object.freeze(['H1','H4','H5','H8']),
    L4:Object.freeze(['H1','H6','H5','H8']),
  });
  const DEFAULT_MIXED=Object.freeze({
    L1:Object.freeze(['H1','H4','H8']),
    L2:Object.freeze(['H1','H7','H5','H8']),
    L3:Object.freeze(['H1','H7','H5','H8','H4']),
    L4:Object.freeze(['H1','H7','H5','H8','H4','H6']),
  });
  const DEFAULT_CAPACITY=Object.freeze({
    ENGINE:Object.freeze(['H1','H5']),
    SLED:Object.freeze(['H2','H3']),
    LOCOMOTION:Object.freeze(['H4','H6','H7']),
    MIXED_STRENGTH_ENDURANCE:Object.freeze(['H6','H7','H8']),
  });
  const SESSION_POLICY=Object.freeze({
    SKILL:Object.freeze({rounds:Object.freeze({L1:2,L2:2,L3:3,L4:3}),rest:Object.freeze({L1:90,L2:75,L3:60,L4:60}),transition:30}),
    CAPACITY:Object.freeze({rounds:Object.freeze({L1:3,L2:3,L3:4,L4:4}),rest:Object.freeze({L1:90,L2:75,L3:60,L4:45}),transition:20}),
    MIXED:Object.freeze({rounds:Object.freeze({L1:1,L2:1,L3:1,L4:1}),rest:Object.freeze({L1:90,L2:75,L3:60,L4:45}),transition:20}),
    BENCHMARK:Object.freeze({rounds:Object.freeze({L1:1,L2:1,L3:1,L4:1}),rest:Object.freeze({L1:0,L2:0,L3:0,L4:0}),transition:15}),
  });
  const GRIP_STATIONS=new Set(['H3','H5','H6']);
  const LOWER_STATIONS=new Set(['H2','H3','H4','H7','H8']);

  function fail(code,message,details={}){
    const error=new Error(message);
    error.code=code;
    Object.assign(error,details);
    throw error;
  }
  function unique(values){return [...new Set((Array.isArray(values)?values:[]).filter(Boolean))];}
  function clone(value){return JSON.parse(JSON.stringify(value));}
  function stationActionId(stationId){return 'HYROX-'+stationId;}

  function normalizeSessionType(value){
    const id=String(value||'').toUpperCase();
    if(!SESSION_TYPES.has(id))fail('HYROX_INPUT_INVALID','HYROX sessionType must be SKILL, CAPACITY, MIXED, or BENCHMARK',{sessionType:value});
    return id;
  }
  function normalizeLevel(value){
    const level=String(value||'').toUpperCase();
    if(!LEVELS.includes(level)||!D().hyroxLevelPolicies?.[level])fail('HYROX_INPUT_INVALID','HYROX level must be L1-L4',{level:value});
    return level;
  }
  function normalizeLoadLevel(value,fallback){
    const level=String(value||fallback||'').toUpperCase();
    if(!LEVELS.includes(level))fail('HYROX_LOAD_INVALID','HYROX loadLevel must be L1-L4',{loadLevel:value});
    return level;
  }
  function normalizeFocus(value){
    const focus=String(value||'').toUpperCase();
    if(!FOCUS_IDS.has(focus))fail('HYROX_CAPACITY_FOCUS_REQUIRED','Capacity session requires a valid capacityFocus',{capacityFocus:value});
    return focus;
  }
  function normalizeSelections(value){
    if(value==null)return [];
    let raw=[];
    if(Array.isArray(value))raw=value;
    else if(value&&typeof value==='object')raw=Object.keys(value).sort().map(key=>value[key]);
    else fail('HYROX_SELECTION_INVALID','HYROX selections must be an array or object');
    const ids=raw.map(item=>{
      if(typeof item==='string')return item.toUpperCase();
      if(item&&typeof item==='object')return String(item.stationId||item.actionId||'').replace(/^HYROX-/i,'').toUpperCase();
      return '';
    }).filter(Boolean);
    for(const id of ids){
      if(id==='RUN'||id==='RUNNING'||/1KM/.test(id))fail('HYROX_RUN_UNSUPPORTED','Running is not part of the 7Fit HYROX template',{stationId:id});
      if(!STATION_IDS.includes(id)||!D().hyroxStations?.[id])fail('HYROX_STATION_INVALID','Unknown HYROX station: '+id,{stationId:id});
    }
    if(new Set(ids).size!==ids.length)fail('HYROX_DUPLICATE_STATION','HYROX session cannot contain duplicate stations',{stationIds:ids});
    return ids;
  }
  function primaryGroup(stationId){
    if(['H1','H5'].includes(stationId))return 'ENGINE';
    if(['H2','H3'].includes(stationId))return 'SLED';
    if(['H4','H6','H7'].includes(stationId))return 'LOCOMOTION';
    return 'BALL';
  }
  function sessionCountRange(sessionType,level){
    const type=D().hyroxSessionTypes?.[sessionType]||{};
    if(sessionType==='MIXED')return type.stationCountByLevel?.[level]||[3,6];
    return type.stationCountRange||[1,8];
  }
  function validateStationCount(sessionType,level,stationIds){
    const range=sessionCountRange(sessionType,level),min=range[0],max=range[1];
    if(stationIds.length<min||stationIds.length>max)fail('HYROX_STATION_COUNT_INVALID',sessionType+' '+level+' requires '+min+'-'+max+' stations',{sessionType,level,stationIds,min,max});
    if(sessionType==='MIXED'&&stationIds.length>6)fail('HYROX_MIXED_STATION_LIMIT','HYROX Mixed cannot exceed 6 stations',{stationIds});
  }
  function defaultBenchmarkProtocol(level){return {L1:'B1',L2:'B2',L3:'B3',L4:'B4'}[level];}
  function validateBenchmarkProtocol(input,level){
    const protocolId=String(input.benchmarkProtocolId||input.protocolId||defaultBenchmarkProtocol(level)).toUpperCase();
    const protocol=D().hyroxBenchmarkProtocols?.[protocolId];
    if(!protocol)fail('HYROX_BENCHMARK_PROTOCOL_INVALID','Unknown HYROX benchmark protocol: '+protocolId,{protocolId});
    const hasSelections=Array.isArray(input.selections)?input.selections.length>0:!!(input.selections&&typeof input.selections==='object'&&Object.keys(input.selections).length);
    if(hasSelections||(Array.isArray(input.stationIds)&&input.stationIds.length))fail('HYROX_BENCHMARK_MUTATION','Benchmark Station identity/order cannot be changed',{protocolId});
    return protocol;
  }
  function chooseStations(input,sessionType,level){
    if(sessionType==='BENCHMARK'){
      const protocol=validateBenchmarkProtocol(input,level);
      return {stationIds:[...protocol.orderedStations],protocol};
    }
    const manual=normalizeSelections(input.selections??input.stationIds);
    if(manual.length){
      validateStationCount(sessionType,level,manual);
      if(sessionType==='CAPACITY'){
        const focus=normalizeFocus(input.capacityFocus),allowed=new Set(D().hyroxCapacityGroups?.[focus]?.stationIds||[]);
        const invalid=manual.filter(id=>!allowed.has(id));
        if(invalid.length)fail('HYROX_CAPACITY_FOCUS_MISMATCH','Selected Station is outside the requested Capacity focus',{capacityFocus:focus,invalidStationIds:invalid});
      }
      if(sessionType==='MIXED'&&new Set(manual.map(primaryGroup)).size<2)fail('HYROX_MIXED_DIVERSITY_REQUIRED','HYROX Mixed must cover at least 2 ability groups',{stationIds:manual});
      return {stationIds:manual,protocol:null};
    }
    let stationIds;
    if(sessionType==='SKILL')stationIds=[...DEFAULT_SKILL[level]];
    else if(sessionType==='CAPACITY')stationIds=[...DEFAULT_CAPACITY[normalizeFocus(input.capacityFocus)]];
    else stationIds=[...DEFAULT_MIXED[level]];
    validateStationCount(sessionType,level,stationIds);
    return {stationIds,protocol:null};
  }
  function stationAvailable(stationId,input){
    if(!Array.isArray(input.availableStationIds))return true;
    return new Set(input.availableStationIds.map(id=>String(id).toUpperCase())).has(stationId);
  }
  function exactWorkOverride(stationId,input,expectedMetric){
    const raw=input.workOverrides?.[stationId];
    if(raw==null)return null;
    const value=typeof raw==='number'?raw:Number(raw?.value);
    const metric=typeof raw==='object'&&raw?.metric?String(raw.metric).toUpperCase():expectedMetric;
    if(!WORK_METRICS.has(metric)||metric!==expectedMetric||!Number.isFinite(value)||value<=0)fail('HYROX_WORK_INVALID','Invalid work override for '+stationId,{stationId,workOverride:raw,expectedMetric});
    return {metric,value};
  }
  function roundTo(value,step){return Math.max(step,Math.round(value/step)*step);}
  function defaultTrainingWork(stationId,sessionType,level){
    const range=D().hyroxLevelPolicies?.[level]?.stationWork?.[stationId];
    if(!range)fail('HYROX_WORK_INVALID','Missing work policy for '+stationId+' '+level,{stationId,level});
    let value=sessionType==='SKILL'?range.min:sessionType==='CAPACITY'?range.max:(range.min+range.max)/2;
    if(range.metric==='METER')value=roundTo(value,50); else value=Math.max(1,Math.round(value));
    return {metric:range.metric,value};
  }
  function stationWork(stationId,sessionType,level,protocol,input){
    const baseline=protocol?clone(protocol.work?.[stationId]):defaultTrainingWork(stationId,sessionType,level);
    if(!baseline||!WORK_METRICS.has(baseline.metric)||!Number.isFinite(baseline.value))fail('HYROX_WORK_INVALID','Missing exact work prescription for '+stationId,{stationId,sessionType,level});
    const override=exactWorkOverride(stationId,input,baseline.metric);
    return {work:override||baseline,scaled:!!override&&override.value!==baseline.value};
  }
  function explicitLoad(stationId,input){
    if(!input.explicitLoads||input.explicitLoads[stationId]==null)return null;
    const value=Number(input.explicitLoads[stationId]);
    if(!Number.isFinite(value)||value<0)fail('HYROX_LOAD_INVALID','Invalid explicit load for '+stationId,{stationId,load:input.explicitLoads[stationId]});
    return value;
  }
  function calibrationFor(stationId,input){
    const profileId=D().hyroxLoadPolicies?.[stationId]?.profileId;
    const raw=input.sledCalibration?.[profileId]||input.sledCalibration?.[stationId]||null;
    if(!raw||!Number.isFinite(Number(raw.calibratedLoadKg))||Number(raw.calibratedLoadKg)<=0||!String(raw.calibrationVersion||''))fail('HYROX_SLED_CALIBRATION_REQUIRED','Valid venue sled calibration is required for '+stationId,{stationId,profileId});
    return {profileId,calibratedLoadKg:Number(raw.calibratedLoadKg),targetRpe:Number.isFinite(Number(raw.targetRpe))?Number(raw.targetRpe):null,calibrationVersion:String(raw.calibrationVersion)};
  }
  function defaultRangeLoad(range,sessionType){
    if(!range)return null;
    if(sessionType==='BENCHMARK'&&range.max!=null)return range.max;
    if(range.max==null)return range.min;
    return Math.round(((range.min+range.max)/2)*2)/2;
  }
  function stationLoad(stationId,sessionType,loadLevel,input){
    const policy=D().hyroxLoadPolicies?.[stationId];
    if(!policy)fail('HYROX_LOAD_INVALID','Missing load policy for '+stationId,{stationId});
    const override=explicitLoad(stationId,input);
    if(policy.type==='NONE'||policy.type==='BODYWEIGHT'){
      if(override!=null&&override!==0)fail('HYROX_LOAD_INVALID',stationId+' does not accept external load override',{stationId,load:override});
      return {load:null,calibrationVersion:''};
    }
    if(policy.type==='SLED_CALIBRATION'){
      const calibration=calibrationFor(stationId,input),value=override==null?calibration.calibratedLoadKg:override;
      if(value<=0)fail('HYROX_LOAD_INVALID','Sled load must be positive for '+stationId,{stationId,value});
      return {load:{value,unit:'KG',source:override==null?'calibration':'explicit',loadLevel,profileId:calibration.profileId},calibrationVersion:calibration.calibrationVersion};
    }
    const range=policy.ranges?.[loadLevel];
    if(!range)fail('HYROX_LOAD_INVALID','Missing '+stationId+' load range for '+loadLevel,{stationId,loadLevel});
    const value=override==null?defaultRangeLoad(range,sessionType):override;
    if(!Number.isFinite(value)||value<0)fail('HYROX_LOAD_INVALID','Invalid effective load for '+stationId,{stationId,value});
    return {load:{value,unit:policy.unit,source:override==null?'level':'explicit',loadLevel},calibrationVersion:''};
  }
  function scaledVariantFor(stationId,input){
    const value=input.scaledVariants?.[stationId];
    if(value==null)return '';
    const name=String(value).trim();
    if(!name)fail('HYROX_SCALE_INVALID','scaledVariants.'+stationId+' must be a non-empty string',{stationId});
    return name;
  }
  function formatWork(work){
    if(work.metric==='METER')return work.value+'m';
    if(work.metric==='REP')return work.value+' 次';
    const meters=work.value*Number(D().hyroxVenuePolicy?.turfLengthMeters||8);
    return work.value+' 趟｜'+meters+'m';
  }
  function formatLoad(load){
    if(!load)return '';
    if(load.unit==='KG_PER_HAND')return '｜2×'+load.value+'kg';
    return '｜'+load.value+'kg';
  }
  function buildPrescription(record){
    const variant=record.scaledVariant?'｜回退：'+record.scaledVariant:'';
    return formatWork(record.work)+formatLoad(record.load)+variant;
  }
  function stationRecord(stationId,sessionType,level,loadLevel,protocol,input,index){
    if(!stationAvailable(stationId,input))fail('HYROX_EQUIPMENT_UNAVAILABLE','Required HYROX Station is unavailable: '+stationId,{stationId});
    const station=D().hyroxStations?.[stationId];
    if(!station)fail('HYROX_STATION_INVALID','Unknown HYROX station: '+stationId,{stationId});
    const workResult=stationWork(stationId,sessionType,level,protocol,input),loadResult=stationLoad(stationId,sessionType,loadLevel,input),scaledVariant=scaledVariantFor(stationId,input);
    return {key:'STATION-'+(index+1),stationId,parentStationId:stationId,actionId:stationActionId(stationId),name:station.zhName||station.name||stationId,canonicalName:station.name||stationId,canonicalOrder:station.canonicalOrder,modality:station.modality,zone:station.zone,route:station.route,equipment:[...(station.equipment||[])],work:workResult.work,load:loadResult.load,calibrationVersion:loadResult.calibrationVersion,scaledVariant,scaled:workResult.scaled||!!scaledVariant,prescription:''};
  }
  function resolvePolicyNumber(inputValue,defaultValue,options={}){
    if(inputValue==null)return defaultValue;
    const value=Number(inputValue),allowZero=options.allowZero===true,field=options.field||'value';
    if(!Number.isFinite(value)||(!allowZero&&value<=0)||(allowZero&&value<0))fail('HYROX_INPUT_INVALID','Invalid HYROX '+field,{[field]:inputValue});
    return Math.round(value);
  }
  function sessionPolicy(sessionType,level,input){
    const policy=SESSION_POLICY[sessionType];
    return {
      rounds:resolvePolicyNumber(input.roundsOverride,policy.rounds[level],{field:'roundsOverride'}),
      restSeconds:resolvePolicyNumber(input.restSecondsOverride,policy.rest[level],{allowZero:true,field:'restSecondsOverride'}),
      transitionSeconds:resolvePolicyNumber(input.transitionSecondsOverride,policy.transition,{allowZero:true,field:'transitionSecondsOverride'}),
    };
  }
  function targetRpe(sessionType,level){
    const range=D().hyroxLevelPolicies?.[level]?.targetRpeRange||[5,7];
    if(sessionType==='SKILL')return Math.min(7,range[1]);
    if(sessionType==='CAPACITY')return Math.round((range[0]+range[1])/2);
    return range[1];
  }
  function totalWork(stations,rounds){
    const total={meters:0,turfLengths:0,turfMeters:0,reps:0};
    for(const station of stations){
      const value=station.work.value*rounds;
      if(station.work.metric==='METER')total.meters+=value;
      else if(station.work.metric==='REP')total.reps+=value;
      else{total.turfLengths+=value;total.turfMeters+=value*Number(D().hyroxVenuePolicy?.turfLengthMeters||8);}
    }
    return total;
  }
  function conflictIssue(code,title,text,severity='warn'){return {severity,title,text,code};}
  function assessConflicts(stations){
    const issues=[];let gripAdjacency=0,lowerAdjacency=0,zoneTransitions=0;
    for(let i=1;i<stations.length;i++){
      const prev=stations[i-1],current=stations[i];
      if(GRIP_STATIONS.has(prev.stationId)&&GRIP_STATIONS.has(current.stationId))gripAdjacency++;
      if(LOWER_STATIONS.has(prev.stationId)&&LOWER_STATIONS.has(current.stationId))lowerAdjacency++;
      if(prev.zone!==current.zone)zoneTransitions++;
    }
    if(gripAdjacency>0)issues.push(conflictIssue('HYROX_GRIP_ADJACENCY','连续握力暴露','检测到 '+gripAdjacency+' 处连续握力型 Station，注意前臂与握力疲劳。'));
    if(lowerAdjacency>1)issues.push(conflictIssue('HYROX_LOWER_FATIGUE_ADJACENCY','下肢疲劳连续暴露','检测到 '+lowerAdjacency+' 处连续下肢高负荷 Station，建议关注动作质量。'));
    if(zoneTransitions>4)issues.push(conflictIssue('HYROX_ROUTE_TRANSITION_DENSITY','场区切换较多','本节存在 '+zoneTransitions+' 次场区切换，注意器械与动线组织。','info'));
    const hardCount=issues.filter(item=>item.severity==='hard').length,warnCount=issues.filter(item=>item.severity==='warn').length;
    return {status:hardCount?'FAIL':warnCount?'WARN':'PASS',hardCount,warnCount,issues};
  }
  function comparisonKey(protocol,stations){
    if(!protocol)return '';
    const payload={protocolId:protocol.protocolId,protocolVersion:protocol.protocolVersion,stations:stations.map(item=>({stationId:item.stationId,work:{metric:item.work.metric,value:item.work.value},load:item.load?{value:item.load.value,unit:item.load.unit}:null,calibrationVersion:item.calibrationVersion||'',scaledVariant:item.scaledVariant||''}))};
    return 'HYROX|'+JSON.stringify(payload);
  }
  function sourceId(sessionType,level,focus,protocol){
    if(sessionType==='BENCHMARK')return 'HYROX-'+protocol.protocolId+'-'+protocol.protocolVersion+'-'+level;
    if(sessionType==='CAPACITY')return 'HYROX-CAPACITY-'+focus+'-'+level;
    return 'HYROX-'+sessionType+'-'+level;
  }

  function resolve(input={}){
    const sessionType=normalizeSessionType(input.sessionType),level=normalizeLevel(input.level),loadLevel=normalizeLoadLevel(input.loadLevel,level);
    const focus=sessionType==='CAPACITY'?normalizeFocus(input.capacityFocus):'';
    const choice=chooseStations(input,sessionType,level),protocol=choice.protocol,stationIds=choice.stationIds;
    validateStationCount(sessionType,level,stationIds);
    const policy=sessionPolicy(sessionType,level,input);
    const stations=stationIds.map((id,index)=>stationRecord(id,sessionType,level,loadLevel,protocol,input,index));
    stations.forEach(record=>{record.prescription=buildPrescription(record);});
    const groups=unique(stations.map(item=>primaryGroup(item.stationId)));
    if(sessionType==='MIXED'&&groups.length<2)fail('HYROX_MIXED_DIVERSITY_REQUIRED','HYROX Mixed must cover at least 2 ability groups',{stationIds});
    const conflictContext=assessConflicts(stations);
    if(conflictContext.status==='FAIL')fail('HYROX_CONFLICT_FAIL','HYROX session contains hard conflicts',{conflictContext});
    const rpe=targetRpe(sessionType,level),workSummary=totalWork(stations,policy.rounds),comparison=comparisonKey(protocol,stations);
    const hasScaling=stations.some(item=>item.scaled)||input.roundsOverride!=null||input.restSecondsOverride!=null||input.transitionSecondsOverride!=null;
    const publicItems=stations.map(item=>({actionId:item.actionId,name:item.name,prescription:item.prescription}));
    const protocolId=protocol?.protocolId||(sessionType+'-'+level);
    const protocolName=protocol?('Benchmark '+protocol.protocolId+'｜'+protocol.name):(D().hyroxSessionTypes?.[sessionType]?.name||sessionType);
    const familyId=sessionType==='BENCHMARK'?('HYROX-'+protocol.protocolId):sessionType==='CAPACITY'?('HYROX-CAPACITY-'+focus):('HYROX-'+sessionType);
    const title='HYROX｜'+protocolName+'｜'+level;
    const summary=stations.length+' Station｜RPE '+rpe+'｜'+(sessionType==='BENCHMARK'?'固定基准协议':('×'+policy.rounds+' 轮'));
    const actionIds=stations.map(item=>item.actionId),modalities=unique(stations.map(item=>item.modality));
    const impactDemand=stationIds.includes('H4')?'high':stationIds.some(id=>['H7','H8'].includes(id))?'medium':'low';
    const powerDemand=stationIds.some(id=>['H4','H8'].includes(id))?'moderate':'low';
    const completionMetric=sessionType==='BENCHMARK'?'完成 8 个固定 Station 并记录总时间与分站时间'
      :sessionType==='CAPACITY'?('完成 '+policy.rounds+' 轮 '+focus+' 专项工作')
      :sessionType==='SKILL'?('完成 '+policy.rounds+' 轮技术质量练习')
      :('完成 '+stations.length+' Station 综合训练');
    const domainStations={};stations.forEach(item=>{domainStations[item.key]=clone(item);});
    const benchmarkContext=protocol?{protocolId:protocol.protocolId,protocolVersion:protocol.protocolVersion,comparisonKey:comparison,canonical:!hasScaling,newBaselineRequired:hasScaling}:null;
    const session={
      schemaVersion:1,resolverVersion:'hyrox-v1',templateId:'hyrox',familyId,level,title,summary,
      main:{kind:'PROTOCOL',content:{protocolId,name:protocolName,blocks:[{key:'MAIN',label:sessionType==='BENCHMARK'?'HYROX Benchmark':'HYROX 主训练',items:publicItems}],metrics:{sessionType,stationCount:stations.length,rounds:policy.rounds,restSeconds:policy.restSeconds,transitionSeconds:policy.transitionSeconds,targetRpe:rpe,totalWork:workSummary,comparisonKey:comparison}}},
      prepContext:{template:'hyrox',level,recipeId:familyId,mainPatterns:groups,mainActionIds:actionIds,formalActionIds:actionIds,targetMuscles:[],modalities,impactDemand,powerDemand},
      anatomyContext:{actionIds,primary:[],secondary:[],stabilizers:[]},
      conflictContext,
      copyContext:{title,summary,actionIds},
      warnings:conflictContext.issues.map(item=>item.code),
      resolvedSelections:stations.map(item=>({key:item.key,actionId:item.actionId,source:'auto'})),
      source:{type:'GENERATED',id:sourceId(sessionType,level,focus,protocol)},
      domainContext:{kind:'HYROX',sessionType,level,loadLevel,capacityFocus:focus,orderedStations:[...stationIds],blocks:[{key:'MAIN',stationIds:[...stationIds],rounds:policy.rounds,restSeconds:policy.restSeconds,transitionSeconds:policy.transitionSeconds}],stations:domainStations,turfLengthMeters:Number(D().hyroxVenuePolicy?.turfLengthMeters||8),totalWork:workSummary,targetRpe:rpe,completionMetric,scaleStatus:hasScaling?'SCALED':'CANONICAL',benchmarkContext,conflictContext:clone(conflictContext),prepContextRef:'prepContext',recoveryContextRef:'HYROX_RECOVERY_PENDING_UI'},
    };
    const validation=window.V15ResolvedSession?.validate?.(session);
    if(validation&&!validation.ok)fail('HYROX_RESOLVED_SESSION_INVALID','HYROX Resolver produced invalid ResolvedSession',{validationErrors:validation.errors});
    return session;
  }
  function isSelectionValid(input={}){
    try{
      const sessionType=normalizeSessionType(input.sessionType),level=normalizeLevel(input.level);
      if(sessionType==='BENCHMARK')return false;
      const ids=normalizeSelections(input.selections??input.stationIds);
      if(!ids.length)return false;
      validateStationCount(sessionType,level,ids);
      if(sessionType==='CAPACITY'){
        const focus=normalizeFocus(input.capacityFocus),allowed=new Set(D().hyroxCapacityGroups?.[focus]?.stationIds||[]);
        if(ids.some(id=>!allowed.has(id)))return false;
      }
      if(sessionType==='MIXED'&&new Set(ids.map(primaryGroup)).size<2)return false;
      return true;
    }catch(error){
      if(String(error?.code||'').startsWith('HYROX_'))return false;
      throw error;
    }
  }

  const api={resolve,isSelectionValid,comparisonKey};
  window.V15HyroxResolver=api;
  if(!window.V15TemplateResolver?.register)throw new Error('Template Resolver Dispatcher is unavailable');
  window.V15TemplateResolver.register('hyrox',resolve);
})();
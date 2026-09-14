(function(){
  'use strict';

  const STORAGE_KEY='7fit-hyrox-benchmark-history-v1';
  const PREF_KEY='7fit-hyrox-benchmark-last-athlete-v1';
  const SCHEMA_VERSION=1;
  const ELIGIBLE_STATUSES=new Set(['VALID_NEW_BASELINE','VALID_COMPARABLE']);
  const GROUPS=Object.freeze({
    ENGINE:Object.freeze(['H1','H5']),
    SLED:Object.freeze(['H2','H3']),
    LOCOMOTION:Object.freeze(['H4','H6','H7']),
    BALL:Object.freeze(['H8']),
  });
  let sequence=0;

  function clone(value){return JSON.parse(JSON.stringify(value));}
  function storage(){return window.localStorage||null;}
  function nowIso(value){return value?new Date(value).toISOString():new Date().toISOString();}
  function recordId(now){sequence+=1;return 'hyrox-benchmark-'+String(now).replace(/[^0-9]/g,'')+'-'+sequence;}
  function cleanText(value){return String(value??'').trim();}
  function positiveMs(value){
    const number=Number(value);
    return Number.isFinite(number)&&number>0?Math.round(number):null;
  }
  function emptyStore(){return {schemaVersion:SCHEMA_VERSION,records:{}};}

  function normalizeStationResult(raw){
    const stationId=cleanText(raw?.stationId).toUpperCase();
    return {
      stationId,
      workPrescription:cleanText(raw?.workPrescription),
      work:raw?.work?clone(raw.work):null,
      effectiveLoad:raw?.effectiveLoad?clone(raw.effectiveLoad):null,
      timeMs:positiveMs(raw?.timeMs),
      rpe:Number.isFinite(Number(raw?.rpe))?Number(raw.rpe):null,
      notes:cleanText(raw?.notes),
      sledCalibrationVersion:cleanText(raw?.sledCalibrationVersion),
      scaledVariant:cleanText(raw?.scaledVariant),
    };
  }

  function legacyRecord(raw,id){
    return {
      recordId:cleanText(raw?.recordId)||id,
      athleteRef:cleanText(raw?.athleteRef)||'',
      completedAt:raw?.completedAt?nowIso(raw.completedAt):'',
      protocolId:cleanText(raw?.protocolId).toUpperCase(),
      protocolVersion:cleanText(raw?.protocolVersion),
      level:cleanText(raw?.level).toUpperCase(),
      comparisonKey:'',
      totalTimeMs:positiveMs(raw?.totalTimeMs),
      stationResults:Array.isArray(raw?.stationResults)?raw.stationResults.map(normalizeStationResult):[],
      rpe:Number.isFinite(Number(raw?.rpe))?Number(raw.rpe):null,
      notes:cleanText(raw?.notes),
      validityStatus:'INVALID_PROTOCOL',
      legacy:true,
      legacyReason:'INSUFFICIENT_COMPARISON_DATA',
      deletedAt:raw?.deletedAt?cleanText(raw.deletedAt):'',
      createdAt:raw?.createdAt?cleanText(raw.createdAt):'',
    };
  }

  function normalizeRecord(raw,id){
    const required=raw&&raw.recordId&&raw.athleteRef&&raw.completedAt&&raw.protocolId&&raw.protocolVersion&&raw.level&&raw.comparisonKey;
    if(!required)return legacyRecord(raw,id);
    return {
      recordId:cleanText(raw.recordId),
      athleteRef:cleanText(raw.athleteRef),
      completedAt:nowIso(raw.completedAt),
      protocolId:cleanText(raw.protocolId).toUpperCase(),
      protocolVersion:cleanText(raw.protocolVersion),
      level:cleanText(raw.level).toUpperCase(),
      comparisonKey:cleanText(raw.comparisonKey),
      totalTimeMs:positiveMs(raw.totalTimeMs),
      stationResults:Array.isArray(raw.stationResults)?raw.stationResults.map(normalizeStationResult):[],
      rpe:Number.isFinite(Number(raw.rpe))?Number(raw.rpe):null,
      notes:cleanText(raw.notes),
      validityStatus:cleanText(raw.validityStatus)||'INVALID_PROTOCOL',
      baselineReason:cleanText(raw.baselineReason),
      deletedAt:cleanText(raw.deletedAt),
      createdAt:cleanText(raw.createdAt)||nowIso(raw.completedAt),
      legacy:raw.legacy===true,
      legacyReason:cleanText(raw.legacyReason),
    };
  }

  function migrate(raw){
    if(!raw)return emptyStore();
    let source=raw;
    if(Array.isArray(source)){
      const records={};
      source.forEach(function(item,index){records[item?.recordId||('legacy-'+index)]=item;});
      source={schemaVersion:0,records};
    }
    const storeValue=emptyStore();
    const records=source.records&&typeof source.records==='object'?source.records:{};
    for(const [id,item] of Object.entries(records)){
      const normalized=source.schemaVersion===SCHEMA_VERSION?normalizeRecord(item,id):legacyRecord(item,id);
      storeValue.records[normalized.recordId||id]=normalized;
    }
    return storeValue;
  }

  function read(){
    const s=storage();
    if(!s)return emptyStore();
    try{return migrate(JSON.parse(s.getItem(STORAGE_KEY)||'null'));}catch(_){return emptyStore();}
  }
  function write(value){
    const next=migrate(value);
    const s=storage();
    if(s)s.setItem(STORAGE_KEY,JSON.stringify(next));
    return clone(next);
  }
  function getLastAthleteRef(){
    try{return cleanText(storage()?.getItem(PREF_KEY));}catch(_){return '';}
  }
  function setLastAthleteRef(value){
    const athleteRef=cleanText(value);
    if(!athleteRef)return '';
    try{storage()?.setItem(PREF_KEY,athleteRef);}catch(_){}
    return athleteRef;
  }

  function activeRecords(options={}){
    const athleteRef=cleanText(options.athleteRef);
    const protocolId=cleanText(options.protocolId).toUpperCase();
    const comparisonKey=cleanText(options.comparisonKey);
    return Object.values(read().records).filter(function(record){
      if(record.deletedAt&&!options.includeDeleted)return false;
      if(athleteRef&&record.athleteRef!==athleteRef)return false;
      if(protocolId&&record.protocolId!==protocolId)return false;
      if(comparisonKey&&record.comparisonKey!==comparisonKey)return false;
      return true;
    }).sort(function(a,b){return String(a.completedAt).localeCompare(String(b.completedAt));});
  }

  function eligible(record){
    return !record.deletedAt&&!record.legacy&&ELIGIBLE_STATUSES.has(record.validityStatus)&&record.totalTimeMs>0&&record.stationResults.length===8&&record.stationResults.every(function(item){return item.timeMs>0;});
  }

  function workComparableSnapshot(record){
    return (record.stationResults||[]).map(function(item){
      return {
        stationId:item.stationId,
        work:item.work,
        effectiveLoad:item.effectiveLoad,
        sledCalibrationVersion:item.sledCalibrationVersion||'',
        scaledVariant:item.scaledVariant||'',
      };
    });
  }

  function baselineReasonFor(session,athleteRef){
    const context=session?.domainContext?.benchmarkContext||{};
    const protocolId=context.protocolId||'';
    const currentStations=Object.values(session?.domainContext?.stations||{});
    const prior=activeRecords({athleteRef,protocolId}).filter(function(record){return !record.legacy;}).at(-1);
    if(!prior)return 'FIRST_BASELINE';
    if(prior.protocolVersion!==context.protocolVersion)return 'PROTOCOL_VERSION_CHANGED';
    const previousById=Object.fromEntries((prior.stationResults||[]).map(function(item){return [item.stationId,item];}));
    let loadChanged=false,workChanged=false,calibrationChanged=false,scaleChanged=false;
    for(const item of currentStations){
      const previous=previousById[item.stationId];
      if(!previous)continue;
      if(JSON.stringify(previous.work)!==JSON.stringify(item.work))workChanged=true;
      const currentLoad=item.load?{value:item.load.value,unit:item.load.unit}:null;
      const previousLoad=previous.effectiveLoad?{value:previous.effectiveLoad.value,unit:previous.effectiveLoad.unit}:null;
      if(JSON.stringify(previousLoad)!==JSON.stringify(currentLoad))loadChanged=true;
      if(cleanText(previous.sledCalibrationVersion)!==cleanText(item.calibrationVersion))calibrationChanged=true;
      if(cleanText(previous.scaledVariant)!==cleanText(item.scaledVariant))scaleChanged=true;
    }
    if(loadChanged)return 'LOAD_CHANGED';
    if(workChanged)return 'WORK_CHANGED';
    if(scaleChanged)return 'SCALING_CHANGED';
    if(calibrationChanged)return 'CALIBRATION_CHANGED';
    return 'SPEC_CHANGED';
  }

  function createRecord(session,input={}){
    if(session?.templateId!=='hyrox'||session?.domainContext?.sessionType!=='BENCHMARK')throw Object.assign(new Error('Benchmark History requires a HYROX Benchmark ResolvedSession'),{code:'HYROX_HISTORY_SESSION_INVALID'});
    const benchmark=session.domainContext.benchmarkContext||{};
    const protocolId=cleanText(benchmark.protocolId).toUpperCase();
    const protocolVersion=cleanText(benchmark.protocolVersion);
    const comparisonKey=cleanText(benchmark.comparisonKey);
    if(!protocolId||!protocolVersion||!comparisonKey)throw Object.assign(new Error('Benchmark comparison identity is incomplete'),{code:'HYROX_HISTORY_PROTOCOL_INVALID'});
    const athleteRef=cleanText(input.athleteRef)||getLastAthleteRef();
    if(!athleteRef)throw Object.assign(new Error('请输入会员姓名或唯一标识'),{code:'HYROX_HISTORY_ATHLETE_REQUIRED'});
    setLastAthleteRef(athleteRef);

    const stationTimes=input.stationTimes||{};
    const stationRpe=input.stationRpe||{};
    const stationNotes=input.stationNotes||{};
    const stations=Object.values(session.domainContext.stations||{});
    const stationResults=stations.map(function(item){
      return normalizeStationResult({
        stationId:item.stationId,
        workPrescription:item.prescription,
        work:item.work,
        effectiveLoad:item.load?{value:item.load.value,unit:item.load.unit,source:item.load.source||'',loadLevel:item.load.loadLevel||''}:null,
        timeMs:stationTimes[item.stationId],
        rpe:stationRpe[item.stationId],
        notes:stationNotes[item.stationId],
        sledCalibrationVersion:item.calibrationVersion||'',
        scaledVariant:item.scaledVariant||'',
      });
    });
    const totalTimeMs=positiveMs(input.totalTimeMs);
    const completeStations=stationResults.length===8&&stationResults.every(function(item){return item.timeMs>0;});
    const stationSum=stationResults.reduce(function(total,item){return total+(item.timeMs||0);},0);
    if(totalTimeMs&&completeStations&&totalTimeMs<stationSum){
      throw Object.assign(new Error('总时间不能小于 8 个 Station 分站时间之和'),{code:'HYROX_HISTORY_TIME_INVALID'});
    }

    const scaled=session.domainContext.scaleStatus==='SCALED'||benchmark.canonical===false||stationResults.some(function(item){return !!item.scaledVariant;});
    let validityStatus;
    if(!totalTimeMs||!completeStations)validityStatus='INCOMPLETE';
    else if(scaled)validityStatus='SCALED';
    else{
      const same=activeRecords({athleteRef,comparisonKey}).filter(eligible);
      validityStatus=same.length?'VALID_COMPARABLE':'VALID_NEW_BASELINE';
    }
    const completedAt=nowIso(input.completedAt);
    const record={
      recordId:cleanText(input.recordId)||recordId(completedAt),
      athleteRef,
      completedAt,
      protocolId,
      protocolVersion,
      level:session.level,
      comparisonKey,
      totalTimeMs,
      stationResults,
      rpe:Number.isFinite(Number(input.rpe))?Number(input.rpe):null,
      notes:cleanText(input.notes),
      validityStatus,
      baselineReason:validityStatus==='VALID_NEW_BASELINE'?baselineReasonFor(session,athleteRef):'',
      deletedAt:'',
      createdAt:nowIso(input.createdAt||completedAt),
      legacy:false,
      legacyReason:'',
    };
    return record;
  }

  function saveRecord(record){
    const normalized=normalizeRecord(record,record?.recordId||'');
    if(!normalized.recordId)throw Object.assign(new Error('Benchmark recordId is required'),{code:'HYROX_HISTORY_RECORD_INVALID'});
    const data=read();
    data.records[normalized.recordId]=normalized;
    write(data);
    setLastAthleteRef(normalized.athleteRef);
    return clone(normalized);
  }

  function saveSessionResult(session,input){return saveRecord(createRecord(session,input));}

  function deleteRecord(recordId,now){
    const data=read(),record=data.records[recordId];
    if(!record)return false;
    record.deletedAt=nowIso(now);
    write(data);return true;
  }
  function restoreRecord(recordId){
    const data=read(),record=data.records[recordId];
    if(!record)return false;
    record.deletedAt='';
    write(data);return true;
  }

  function formatDelta(deltaMs){
    if(deltaMs==null)return '';
    const sign=deltaMs>0?'↑ ':deltaMs<0?'↓ ':'';
    return sign+formatDuration(Math.abs(deltaMs));
  }
  function formatDuration(ms){
    if(ms===null||ms===undefined||!Number.isFinite(Number(ms))||Number(ms)<0)return '—';
    const totalSeconds=Math.round(Number(ms)/1000),minutes=Math.floor(totalSeconds/60),seconds=totalSeconds%60;
    return minutes+':'+String(seconds).padStart(2,'0');
  }
  function parseDuration(value){
    const text=cleanText(value);
    if(!text)return null;
    if(/^\d+(?:\.\d+)?$/.test(text))return Math.round(Number(text)*1000);
    const match=text.match(/^(\d+):([0-5]?\d)(?:\.(\d{1,3}))?$/);
    if(!match)return null;
    const fraction=match[3]?Number(('0.'+match[3]))*1000:0;
    return Math.round((Number(match[1])*60+Number(match[2]))*1000+fraction);
  }

  function summary(options={}){
    const athleteRef=cleanText(options.athleteRef),comparisonKey=cleanText(options.comparisonKey),protocolId=cleanText(options.protocolId).toUpperCase();
    const same=activeRecords({athleteRef,comparisonKey}).filter(eligible);
    const protocolRecords=activeRecords({athleteRef,protocolId});
    const current=same.at(-1)||null;
    const previous=same.length>1?same.at(-2):null;
    const pb=same.length?same.reduce(function(best,item){return !best||item.totalTimeMs<best.totalTimeMs?item:best;},null):null;
    const stationSummary={};
    if(current){
      for(const station of current.stationResults){
        const history=same.map(function(record){return record.stationResults.find(function(item){return item.stationId===station.stationId;});}).filter(function(item){return item?.timeMs>0;});
        const prior=previous?.stationResults.find(function(item){return item.stationId===station.stationId;})||null;
        const stationPb=history.length?history.reduce(function(best,item){return !best||item.timeMs<best.timeMs?item:best;},null):null;
        stationSummary[station.stationId]={
          current:station,
          previous:prior,
          pb:stationPb,
          deltaVsPrevious:prior?prior.timeMs-station.timeMs:null,
          gapToPbPct:stationPb&&stationPb.timeMs?Math.max(0,(station.timeMs-stationPb.timeMs)/stationPb.timeMs*100):0,
          history:history.map(function(item){return item.timeMs;}),
        };
      }
    }
    const otherSpecLatest=protocolRecords.filter(function(record){return record.comparisonKey&&record.comparisonKey!==comparisonKey&&!record.deletedAt;}).at(-1)||null;
    return {
      athleteRef,comparisonKey,protocolId,current,previous,pb,
      deltaVsPrevious:current&&previous?previous.totalTimeMs-current.totalTimeMs:null,
      deltaVsPb:current&&pb?pb.totalTimeMs-current.totalTimeMs:null,
      stationSummary,
      sameComparisonCount:same.length,
      otherSpecLatest,
    };
  }

  function abilityProfile(summaryValue){
    const s=summaryValue||{};
    if(!s.current||!s.previous||s.sameComparisonCount<2){
      return {ready:false,strongestGroup:null,weakestGroup:null,groups:{},reason:'NEED_TWO_COMPARABLE_RECORDS'};
    }
    const groups={};
    for(const [groupId,stationIds] of Object.entries(GROUPS)){
      const rows=stationIds.map(function(id){return s.stationSummary?.[id];}).filter(Boolean);
      if(!rows.length)continue;
      const gapPct=rows.reduce(function(total,row){return total+Number(row.gapToPbPct||0);},0)/rows.length;
      const trends=rows.filter(function(row){return row.previous?.timeMs>0;}).map(function(row){return (row.previous.timeMs-row.current.timeMs)/row.previous.timeMs*100;});
      const trendPct=trends.length?trends.reduce(function(a,b){return a+b;},0)/trends.length:0;
      groups[groupId]={gapToPbPct:Math.round(gapPct*10)/10,trendPct:Math.round(trendPct*10)/10,stationIds:[...stationIds]};
    }
    const entries=Object.entries(groups);
    if(!entries.length)return {ready:false,strongestGroup:null,weakestGroup:null,groups,reason:'NO_GROUP_DATA'};
    const sorted=[...entries].sort(function(a,b){
      if(b[1].gapToPbPct!==a[1].gapToPbPct)return b[1].gapToPbPct-a[1].gapToPbPct;
      return a[0].localeCompare(b[0]);
    });
    const weakest=sorted[0],strongest=sorted.at(-1);
    const spread=weakest[1].gapToPbPct-strongest[1].gapToPbPct;
    if(spread<1){
      return {ready:true,strongestGroup:null,weakestGroup:null,groups,reason:'NO_MEANINGFUL_GAP'};
    }
    return {ready:true,strongestGroup:strongest[0],weakestGroup:weakest[0],groups,reason:'OK'};
  }

  function recommendation(profile,level){
    if(!profile?.ready)return {ready:false,primary:'',secondary:'',message:'完成第二次同协议 Benchmark 后，再判断专项短板。'};
    if(!profile.weakestGroup)return {ready:true,primary:'',secondary:'Mixed '+cleanText(level),message:'当前各能力组与个人 PB 的差距接近，不指定单一短板；继续 Mixed 后再复测。'};
    const focus=profile.weakestGroup==='BALL'?'MIXED_STRENGTH_ENDURANCE':profile.weakestGroup;
    return {
      ready:true,
      weakestGroup:profile.weakestGroup,
      primary:'Capacity · '+focus,
      secondary:'Mixed '+cleanText(level),
      message:'当前短板：'+profile.weakestGroup+'；下一阶段优先 '+focus+' Capacity，其次 Mixed '+cleanText(level)+'。',
    };
  }

  function baselineReasonLabel(code){
    return ({
      FIRST_BASELINE:'首次建立基准',
      LOAD_CHANGED:'负重变化｜建立新基准',
      WORK_CHANGED:'工作量变化｜建立新基准',
      PROTOCOL_VERSION_CHANGED:'协议版本变化｜建立新基准',
      CALIBRATION_CHANGED:'雪橇校准变化｜建立新基准',
      SCALING_CHANGED:'动作 Scaling 变化｜建立新基准',
      SPEC_CHANGED:'训练规格变化｜建立新基准',
    })[code]||'建立新基准';
  }

  function exportData(){return clone(read());}
  function importData(raw){return write(migrate(raw));}
  function clear(){
    try{storage()?.removeItem(STORAGE_KEY);storage()?.removeItem(PREF_KEY);}catch(_){}
    return emptyStore();
  }

  window.V15HyroxBenchmarkHistory={
    STORAGE_KEY,PREF_KEY,SCHEMA_VERSION,GROUPS,
    read,write,migrate,exportData,importData,clear,
    list:activeRecords,eligible,createRecord,saveRecord,saveSessionResult,deleteRecord,restoreRecord,
    summary,abilityProfile,recommendation,baselineReasonLabel,
    formatDuration,formatDelta,parseDuration,getLastAthleteRef,setLastAthleteRef,
    workComparableSnapshot,
  };
})();
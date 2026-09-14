(function(){
  'use strict';

  const STORAGE_KEY='7fit-hyrox-benchmark-history';
  const D=()=>window.V14_DATA||{};
  const ELIGIBLE_STATUSES=new Set(['VALID_NEW_BASELINE','VALID_COMPARABLE']);
  let loadStatus={code:'FRESH'};
  let unsupportedVersion=false;
  let store;

  function clone(v){return JSON.parse(JSON.stringify(v));}
  function contract(){return D().hyroxBenchmarkResultContract||{};}
  function schemaVersion(){return Number(contract().benchmarkHistorySchemaVersion||contract().schemaVersion||1);}
  function nowIso(value){
    if(typeof value==='string'&&value)return value;
    if(value instanceof Date&&!Number.isNaN(value.getTime()))return value.toISOString();
    return new Date().toISOString();
  }
  function storage(){
    try{if(typeof localStorage!=='undefined'&&localStorage)return localStorage;}catch(_){}
    return null;
  }
  function read(){try{return storage()?.getItem(STORAGE_KEY)??null;}catch(_){return null;}}
  function write(value){try{storage()?.setItem(STORAGE_KEY,value);}catch(_){}}
  function fresh(){return {schemaVersion:schemaVersion(),profileRef:'local-default',records:[]};}
  function fail(code,message,details={}){
    const e=new Error(message);e.code=code;Object.assign(e,details);throw e;
  }
  function positiveMs(value){
    const n=Number(value);
    return Number.isFinite(n)&&n>0?Math.round(n):null;
  }
  function recordId(completedAt){
    const base=String(Date.parse(completedAt)||Date.now()).toString(36);
    let i=1,id='bench-'+base;
    const used=new Set((store?.records||[]).map(x=>x.recordId));
    while(used.has(id)){i+=1;id='bench-'+base+'-'+i.toString(36);}
    return id;
  }
  function isCriticalRecordComplete(record){
    return !!(
      record&&record.protocolId&&record.protocolVersion&&record.level&&record.comparisonKey
      &&positiveMs(record.totalTimeMs)
      &&Array.isArray(record.stationResults)&&record.stationResults.length===8
      &&record.stationResults.every(x=>x.stationId&&x.workPrescription&&Object.prototype.hasOwnProperty.call(x,'effectiveLoad')&&positiveMs(x.timeMs))
    );
  }
  function normalizeStation(raw={}){
    const work=raw.workPrescription||raw.work||null;
    const load=Object.prototype.hasOwnProperty.call(raw,'effectiveLoad')?raw.effectiveLoad:(Object.prototype.hasOwnProperty.call(raw,'load')?raw.load:null);
    return {
      stationId:String(raw.stationId||'').toUpperCase(),
      workPrescription:work&&typeof work==='object'?clone(work):null,
      effectiveLoad:load&&typeof load==='object'?clone(load):load===null?null:null,
      timeMs:positiveMs(raw.timeMs),
      rpe:Number.isFinite(Number(raw.rpe))?Number(raw.rpe):null,
      notes:typeof raw.notes==='string'?raw.notes:'',
      sledCalibrationVersion:String(raw.sledCalibrationVersion||raw.calibrationVersion||''),
      scaledVariant:String(raw.scaledVariant||''),
    };
  }
  function hashText(text){
    let h=2166136261;
    for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}
    return h>>>0;
  }
  function normalizeRecord(raw={},options={}){
    const current=schemaVersion(),sourceVersion=Number(raw.schemaVersion||options.sourceVersion||0);
    const stationResults=Array.isArray(raw.stationResults)?raw.stationResults.map(normalizeStation):[];
    const record={
      recordId:String(raw.recordId||''),
      schemaVersion:current,
      profileRef:String(raw.profileRef||'local-default'),
      completedAt:String(raw.completedAt||''),
      protocolId:String(raw.protocolId||'').toUpperCase(),
      protocolVersion:String(raw.protocolVersion||''),
      level:String(raw.level||'').toUpperCase(),
      comparisonKey:String(raw.comparisonKey||''),
      totalTimeMs:positiveMs(raw.totalTimeMs),
      stationResults,
      rpe:Number.isFinite(Number(raw.rpe))?Number(raw.rpe):null,
      notes:typeof raw.notes==='string'?raw.notes:'',
      validityStatus:String(raw.validityStatus||''),
      legacy:!!raw.legacy,
      legacyReason:String(raw.legacyReason||''),
    };
    const missingCritical=!isCriticalRecordComplete(record);
    if(sourceVersion!==current||missingCritical){
      record.legacy=true;
      record.legacyReason=record.legacyReason||'INSUFFICIENT_COMPARISON_DATA';
      record.validityStatus='INVALID_PROTOCOL';
    }
    if(!record.recordId)record.recordId='legacy-'+String(Math.abs(hashText(JSON.stringify(raw))));
    return record;
  }
  function migrate(parsed){
    const current=schemaVersion();
    if(Array.isArray(parsed)){
      loadStatus={code:'MIGRATED_LEGACY_ARRAY'};
      return {schemaVersion:current,profileRef:'local-default',records:parsed.map(x=>normalizeRecord(x,{sourceVersion:0}))};
    }
    if(!parsed||typeof parsed!=='object'||Array.isArray(parsed.records)===false){
      loadStatus={code:'RESET_INVALID_ROOT'};
      return fresh();
    }
    const observed=Number(parsed.schemaVersion||0);
    if(observed>current){
      unsupportedVersion=true;
      loadStatus={code:'UNSUPPORTED_NEWER_SCHEMA',observedVersion:observed};
      return {schemaVersion:current,profileRef:String(parsed.profileRef||'local-default'),records:[]};
    }
    const records=parsed.records.map(x=>normalizeRecord(x,{sourceVersion:observed}));
    loadStatus={code:observed===current?'LOADED':'MIGRATED_OLDER_SCHEMA',observedVersion:observed};
    return {schemaVersion:current,profileRef:String(parsed.profileRef||'local-default'),records};
  }
  function load(){
    const raw=read();
    if(raw===null){store=fresh();loadStatus={code:'FRESH'};write(JSON.stringify(store));return;}
    try{store=migrate(JSON.parse(raw));if(!unsupportedVersion)write(JSON.stringify(store));}
    catch(_){store=fresh();loadStatus={code:'RESET_INVALID_JSON'};write(JSON.stringify(store));}
  }
  function persist(){
    if(unsupportedVersion)fail('HYROX_HISTORY_UNSUPPORTED_SCHEMA','Benchmark history was created by a newer schema and will not be overwritten.');
    write(JSON.stringify(store));
  }
  function list(filters={}){
    let rows=(store.records||[]).map(clone);
    if(filters.protocolId)rows=rows.filter(x=>x.protocolId===String(filters.protocolId).toUpperCase());
    if(filters.comparisonKey)rows=rows.filter(x=>x.comparisonKey===filters.comparisonKey);
    if(filters.includeLegacy===false)rows=rows.filter(x=>!x.legacy);
    rows.sort((a,b)=>String(b.completedAt).localeCompare(String(a.completedAt))||String(b.recordId).localeCompare(String(a.recordId)));
    if(Number.isInteger(filters.limit)&&filters.limit>0)rows=rows.slice(0,filters.limit);
    return rows;
  }
  function get(recordId){
    const x=(store.records||[]).find(r=>r.recordId===recordId);
    return x?clone(x):null;
  }
  function stationHistory(stationId,filters={}){
    const id=String(stationId||'').toUpperCase();
    if(!/^H[1-8]$/.test(id))return [];
    return list(filters).map(function(record){
      const station=(record.stationResults||[]).find(x=>x.stationId===id);
      if(!station)return null;
      return {
        recordId:record.recordId,completedAt:record.completedAt,protocolId:record.protocolId,
        comparisonKey:record.comparisonKey,validityStatus:record.validityStatus,
        stationId:id,timeMs:station.timeMs,workPrescription:clone(station.workPrescription),
        effectiveLoad:clone(station.effectiveLoad),sledCalibrationVersion:station.sledCalibrationVersion,
        scaledVariant:station.scaledVariant
      };
    }).filter(Boolean);
  }
  function eligible(record){
    return !!record&&!record.legacy&&ELIGIBLE_STATUSES.has(record.validityStatus)&&isCriticalRecordComplete(record);
  }
  function comparableBefore(record){
    return (store.records||[])
      .filter(x=>x.recordId!==record.recordId&&eligible(x)&&x.comparisonKey===record.comparisonKey&&String(x.completedAt)<=String(record.completedAt))
      .sort((a,b)=>String(b.completedAt).localeCompare(String(a.completedAt))||String(b.recordId).localeCompare(String(a.recordId)));
  }
  function comparableAll(record){
    return (store.records||[]).filter(x=>eligible(x)&&x.comparisonKey===record.comparisonKey);
  }
  function groupProfile(record,previous){
    const groups=contract().abilityGroups||{};
    const currentBy=Object.fromEntries((record.stationResults||[]).map(x=>[x.stationId,x]));
    const prevBy=Object.fromEntries((previous?.stationResults||[]).map(x=>[x.stationId,x]));
    const rows=[];
    for(const [groupId,group] of Object.entries(groups)){
      const ids=group.stationIds||[];
      const currentTimes=ids.map(id=>positiveMs(currentBy[id]?.timeMs)).filter(Boolean);
      if(!currentTimes.length)continue;
      const currentTimeMs=currentTimes.reduce((a,b)=>a+b,0);
      const prevTimes=ids.map(id=>positiveMs(prevBy[id]?.timeMs)).filter(Boolean);
      const previousTimeMs=prevTimes.length===ids.length?prevTimes.reduce((a,b)=>a+b,0):null;
      const deltaMs=previousTimeMs==null?null:previousTimeMs-currentTimeMs;
      const trendRatio=previousTimeMs?deltaMs/previousTimeMs:null;
      rows.push({
        groupId,name:group.name||groupId,stationIds:[...ids],currentTimeMs,previousTimeMs,deltaMs,trendRatio,
        averageStationTimeMs:Math.round(currentTimeMs/ids.length),
        coachHint:String(group.coachHint||'')
      });
    }
    if(!rows.length)return {basis:'NONE',groups:[],strongestGroup:null,weakestGroup:null,recommendation:null};
    let strongest,weakest,basis;
    if(previous&&rows.every(x=>x.trendRatio!==null)){
      basis='TREND_VS_PREVIOUS';
      strongest=[...rows].sort((a,b)=>b.trendRatio-a.trendRatio||a.groupId.localeCompare(b.groupId))[0];
      weakest=[...rows].sort((a,b)=>a.trendRatio-b.trendRatio||a.groupId.localeCompare(b.groupId))[0];
    }else{
      basis='CURRENT_AVG_STATION_TIME';
      strongest=[...rows].sort((a,b)=>a.averageStationTimeMs-b.averageStationTimeMs||a.groupId.localeCompare(b.groupId))[0];
      weakest=[...rows].sort((a,b)=>b.averageStationTimeMs-a.averageStationTimeMs||a.groupId.localeCompare(b.groupId))[0];
    }
    return {
      basis,groups:rows,strongestGroup:strongest?.groupId||null,weakestGroup:weakest?.groupId||null,
      recommendation:weakest?{groupId:weakest.groupId,hint:weakest.coachHint}:null
    };
  }
  function analyzeRecord(value){
    const record=typeof value==='string'?get(value):clone(value);
    if(!record)return null;
    const previous=comparableBefore(record)[0]||null;
    const all=comparableAll(record);
    const pb=all.length?[...all].sort((a,b)=>a.totalTimeMs-b.totalTimeMs||String(a.completedAt).localeCompare(String(b.completedAt)))[0]:null;
    const prevBy=Object.fromEntries((previous?.stationResults||[]).map(x=>[x.stationId,x]));
    const stationDeltas=Object.fromEntries((record.stationResults||[]).map(x=>[
      x.stationId,prevBy[x.stationId]?.timeMs?prevBy[x.stationId].timeMs-x.timeMs:null
    ]));
    const deltaPreviousMs=previous?previous.totalTimeMs-record.totalTimeMs:null;
    const deltaPbMs=pb?pb.totalTimeMs-record.totalTimeMs:null;
    return {
      record,previous:previous?clone(previous):null,pb:pb?clone(pb):null,
      deltaPreviousMs,deltaPbMs,stationDeltas,
      isPb:!!pb&&pb.recordId===record.recordId,
      abilityProfile:groupProfile(record,previous),
    };
  }
  function sessionStationRows(session){
    const ordered=session?.domainContext?.orderedStations||[];
    const values=Object.values(session?.domainContext?.stations||{});
    return ordered.map(id=>values.find(x=>x.stationId===id)).filter(Boolean);
  }
  function validateProtocolSession(session){
    const b=session?.domainContext?.benchmarkContext,protocol=D().hyroxBenchmarkProtocols?.[b?.protocolId];
    return !!(session?.templateId==='hyrox'&&session?.domainContext?.sessionType==='BENCHMARK'&&b&&protocol&&protocol.protocolVersion===b.protocolVersion);
  }
  function saveFromSession(session,input={}){
    if(unsupportedVersion)persist();
    const completedAt=nowIso(input.completedAt),validProtocol=validateProtocolSession(session);
    const b=session?.domainContext?.benchmarkContext||{};
    const rows=sessionStationRows(session);
    const stationTimes=input.stationTimes&&typeof input.stationTimes==='object'?input.stationTimes:{};
    const stationRpe=input.stationRpe&&typeof input.stationRpe==='object'?input.stationRpe:{};
    const stationNotes=input.stationNotes&&typeof input.stationNotes==='object'?input.stationNotes:{};
    const stationResults=rows.map(item=>({
      stationId:item.stationId,
      workPrescription:clone(item.work),
      effectiveLoad:item.load?{value:item.load.value,unit:item.load.unit}:null,
      timeMs:positiveMs(stationTimes[item.stationId]),
      rpe:Number.isFinite(Number(stationRpe[item.stationId]))?Number(stationRpe[item.stationId]):null,
      notes:typeof stationNotes[item.stationId]==='string'?stationNotes[item.stationId]:'',
      sledCalibrationVersion:String(item.calibrationVersion||''),
      scaledVariant:String(item.scaledVariant||''),
    }));
    const totalTimeMs=positiveMs(input.totalTimeMs);
    const complete=stationResults.length===8&&stationResults.every(x=>x.timeMs)&&totalTimeMs;
    const scaled=session?.domainContext?.scaleStatus==='SCALED'||b.canonical===false||stationResults.some(x=>x.scaledVariant);
    let validityStatus;
    if(!validProtocol)validityStatus='INVALID_PROTOCOL';
    else if(!complete)validityStatus='INCOMPLETE';
    else if(scaled)validityStatus='SCALED';
    else{
      const prior=(store.records||[]).some(x=>eligible(x)&&x.comparisonKey===b.comparisonKey);
      validityStatus=prior?'VALID_COMPARABLE':'VALID_NEW_BASELINE';
    }
    const record={
      recordId:typeof input.recordId==='string'&&input.recordId.trim()?input.recordId.trim():recordId(completedAt),
      schemaVersion:schemaVersion(),
      profileRef:String(input.profileRef||store.profileRef||'local-default'),
      completedAt,
      protocolId:String(b.protocolId||'').toUpperCase(),
      protocolVersion:String(b.protocolVersion||''),
      level:String(session?.level||''),
      comparisonKey:String(b.comparisonKey||''),
      totalTimeMs,
      stationResults,
      rpe:Number.isFinite(Number(input.rpe))?Number(input.rpe):null,
      notes:typeof input.notes==='string'?input.notes:'',
      validityStatus,legacy:false,legacyReason:'',
    };
    if((store.records||[]).some(x=>x.recordId===record.recordId))fail('HYROX_HISTORY_RECORD_EXISTS','Benchmark record already exists',{recordId:record.recordId});
    store.records.push(record);persist();
    return {record:clone(record),analysis:analyzeRecord(record)};
  }
  function remove(recordId){
    if(unsupportedVersion)persist();
    const index=(store.records||[]).findIndex(x=>x.recordId===recordId);
    if(index<0)return null;
    const removed=store.records.splice(index,1)[0];
    persist();
    return clone(removed);
  }
  function restoreRecord(raw){
    if(unsupportedVersion)persist();
    const record=normalizeRecord(raw,{sourceVersion:raw?.schemaVersion});
    if((store.records||[]).some(x=>x.recordId===record.recordId))fail('HYROX_HISTORY_RECORD_EXISTS','Benchmark record already exists',{recordId:record.recordId});
    store.records.push(record);persist();return clone(record);
  }
  function contextForSession(session){
    const b=session?.domainContext?.benchmarkContext;
    if(!b)return null;
    const protocolRows=list({protocolId:b.protocolId});
    const sameKey=protocolRows.filter(x=>eligible(x)&&x.comparisonKey===b.comparisonKey);
    const latest=sameKey[0]||null;
    const latestAnalysis=latest?analyzeRecord(latest):null;
    const otherComparable=protocolRows.some(x=>eligible(x)&&x.comparisonKey!==b.comparisonKey);
    return {
      protocolId:b.protocolId,comparisonKey:b.comparisonKey,canonical:b.canonical,
      records:protocolRows,sameKeyRecords:sameKey,
      latest,latestAnalysis,
      needsNewBaseline:!!b.canonical&&sameKey.length===0&&otherComparable,
      scaledSession:b.canonical===false||session?.domainContext?.scaleStatus==='SCALED',
    };
  }
  function parseTimeText(value){
    if(typeof value==='number')return positiveMs(value);
    const text=String(value||'').trim();
    if(!text)return null;
    if(/^\d+(?:\.\d+)?$/.test(text))return positiveMs(Number(text)*1000);
    const parts=text.split(':').map(Number);
    if(parts.some(x=>!Number.isFinite(x)||x<0)||parts.length<2||parts.length>3)return null;
    const seconds=parts.length===2?parts[0]*60+parts[1]:parts[0]*3600+parts[1]*60+parts[2];
    return positiveMs(seconds*1000);
  }
  function formatTimeMs(value){
    const ms=positiveMs(value);if(!ms)return '—';
    const sec=Math.round(ms/1000),h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s=sec%60;
    const p=n=>String(n).padStart(2,'0');
    return h?String(h)+':'+p(m)+':'+p(s):String(m)+':'+p(s);
  }
  function formatDeltaMs(value){
    if(value===null||value===undefined||!Number.isFinite(Number(value)))return '—';
    const n=Math.round(Number(value)),sign=n>0?'↑ ':n<0?'↓ ':'';
    return sign+formatTimeMs(Math.abs(n));
  }
  function clear(){
    store=fresh();unsupportedVersion=false;loadStatus={code:'CLEARED'};write(JSON.stringify(store));
  }
  function snapshot(){return clone(store);}
  function getLoadStatus(){return clone(loadStatus);}

  load();

  window.V15HyroxBenchmarkHistory={
    STORAGE_KEY,schemaVersion,getLoadStatus,snapshot,list,get,stationHistory,saveFromSession,remove,restoreRecord,
    analyzeRecord,contextForSession,parseTimeText,formatTimeMs,formatDeltaMs,clear,
  };
})();

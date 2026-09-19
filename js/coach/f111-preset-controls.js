(function(){
  'use strict';

  const M=window.V14CoachModules=window.V14CoachModules||{};
  const STORAGE_KEY='7fit-f111-preset-recent-v1';
  const MAX_RECENT=8;
  const GROUPS=new Set(['lower','upper','support']);
  const fresh=()=>({q:'',level:'ALL',lower:new Set(),upper:new Set(),support:new Set()});
  let state=fresh();

  const clean=value=>String(value??'').trim();
  const normalize=value=>clean(value).toLowerCase();

  function snapshot(){
    return {
      q:state.q,
      level:state.level,
      lower:[...state.lower],
      upper:[...state.upper],
      support:[...state.support],
    };
  }

  function setSearch(value){state.q=clean(value).slice(0,120);}
  function setLevel(value){state.level=/^L[1-4]$/.test(value||'')?value:'ALL';}
  function toggle(group,value){
    if(!GROUPS.has(group)||!clean(value))return;
    const set=state[group];
    if(set.has(value))set.delete(value);else set.add(value);
  }
  function clear(){state=fresh();}

  function matches(item){
    if(!item)return false;
    if(state.level!=='ALL'&&item.level!==state.level)return false;
    for(const group of GROUPS){
      const active=state[group];
      if(active.size&&!active.has(item.patterns?.[group]))return false;
    }
    const q=normalize(state.q);
    if(q){
      const haystack=(item.searchTokens||[]).map(normalize).join(' ');
      if(!haystack.includes(q))return false;
    }
    return true;
  }

  function filter(items){return (Array.isArray(items)?items:[]).filter(matches);}

  function activeLabels(){
    const labels=[];
    if(state.level!=='ALL')labels.push(state.level);
    for(const group of ['lower','upper','support']){
      if(state[group].size)labels.push([...state[group]].join(' / '));
    }
    if(state.q)labels.push(`搜索“${state.q}”`);
    return labels;
  }

  function summary(count,total=32){
    const labels=activeLabels();
    return labels.length
      ?`${labels.join(' + ')} · 共 ${count} 套预设`
      :`当前显示全部 · 共 ${total} 套预设`;
  }

  function readRaw(){
    try{return localStorage.getItem(STORAGE_KEY);}catch(_){return null;}
  }
  function writeRaw(value){
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(value));}catch(_){}
  }
  function removeRaw(){
    try{localStorage.removeItem(STORAGE_KEY);}catch(_){}
  }

  function normalizeRecent(value){
    const Browser=M.F111PresetBrowser;
    if(!Array.isArray(value)||!Browser?.find)return [];
    const seen=new Set(),out=[];
    for(const item of value){
      const recipeId=clean(item?.recipeId),level=clean(item?.level),usedAt=clean(item?.usedAt);
      const key=`${recipeId}:${level}`;
      if(!recipeId||!level||!usedAt||Number.isNaN(Date.parse(usedAt))||seen.has(key)||!Browser.find(recipeId,level))continue;
      seen.add(key);
      out.push({recipeId,level,usedAt});
    }
    return out.sort((a,b)=>b.usedAt.localeCompare(a.usedAt)).slice(0,MAX_RECENT);
  }

  function loadRecent(){
    const raw=readRaw();
    if(raw===null)return [];
    let parsed;
    try{parsed=JSON.parse(raw);}catch(_){
      removeRaw();
      return [];
    }
    const normalized=normalizeRecent(parsed);
    if(JSON.stringify(normalized)!==JSON.stringify(parsed))writeRaw(normalized);
    return normalized;
  }

  function recent(limit=3){
    const items=loadRecent();
    return Number.isInteger(limit)&&limit>0?items.slice(0,limit):items;
  }

  function recordRecent({recipeId,level,usedAt}={}){
    const Browser=M.F111PresetBrowser;
    if(!Browser?.find?.(recipeId,level))return false;
    const now=clean(usedAt)||new Date().toISOString();
    const next=[
      {recipeId,level,usedAt:now},
      ...loadRecent().filter(item=>!(item.recipeId===recipeId&&item.level===level)),
    ].slice(0,MAX_RECENT);
    writeRaw(next);
    return true;
  }

  M.F111PresetControls=Object.freeze({
    STORAGE_KEY,MAX_RECENT,
    snapshot,setSearch,setLevel,toggle,clear,matches,filter,summary,
    recent,recordRecent,loadRecent,
  });
})();

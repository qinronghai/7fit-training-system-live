(function(){
  const clean=x=>String(x??'').trim();
  const list=(xs,sep='、',empty='—')=>(xs||[]).filter(Boolean).join(sep)||empty;
  const registry=new Map();
  const D=()=>window.V14_DATA||{};

  function rirFromRpe(text){
    let s=clean(text);
    if(!s||/RIR/i.test(s))return s;
    s=s.replace(/RPE\s*(\d+(?:\.\d+)?)\s*[–-]\s*(\d+(?:\.\d+)?)/ig,(_,a,b)=>{
      const vals=[Math.max(0,10-Number(a)),Math.max(0,10-Number(b))].sort((x,y)=>x-y);
      return `RIR≈${fmt(vals[0])}–${fmt(vals[1])}`;
    });
    s=s.replace(/RPE\s*(\d+(?:\.\d+)?)/ig,(_,a)=>`RIR≈${fmt(Math.max(0,10-Number(a)))}`);
    return s;
  }
  function fmt(n){return Number.isInteger(n)?String(n):String(Math.round(n*10)/10);}
  function defaultRir(level){return ({L1:'RIR 3–4',L2:'RIR 2–3',L3:'RIR 1–2',L4:'RIR 1–2'})[level]||'RIR 2–3';}
  function isStrength(actionId){return window.V14_ANATOMY?.records?.[actionId]?.roleType==='strength';}
  function sourcePrescription(actionId){
    const d=D(),a=d.actions?.[actionId]||{};
    let v=d.actionDetails?.[actionId]?.fields?.['来源处方 / RPE'];
    if(!v&&a.sourceActionId)v=d.actionDetails?.[a.sourceActionId]?.fields?.['来源处方 / RPE'];
    if(!v){
      const w=Object.values(d.warmupDetails||{}).find(x=>x.actionId===actionId);if(w)v=w.prescription;
    }
    if(!v){
      const f=Object.values(d.foamRollDetails||{}).find(x=>x.actionId===actionId);if(f)v=f.prescription;
    }
    return clean(v);
  }
  function canonicalPrescription(actionId){
    const d=D(),a=d.actions?.[actionId]||{},name=clean(a.name);
    if(a.isSupport){
      if(/支撑|保持|平板/.test(name)||String(a.supportGrade||'').startsWith('SUP-S1'))return '2–3组 × 20–30秒';
      return '2–3组 × 6–10次/侧';
    }
    if(a.isCore){
      if(/支撑|保持|空心/.test(name))return '2–3组 × 20–30秒';
      return '2–3组 × 6–10次/侧';
    }
    return '';
  }
  function defaultStrengthPrescription(level){
    return ({L1:'2–3组 × 10–12次',L2:'3组 × 8–12次',L3:'3–4组 × 8–12次',L4:'3–4组 × 6–10次'})[level]||'3组 × 8–12次';
  }
  function prescriptionForAction(actionId,{level}={}){
    let p=sourcePrescription(actionId)||canonicalPrescription(actionId);
    if(!p&&isStrength(actionId))p=defaultStrengthPrescription(level);
    p=rirFromRpe(p);
    if(p&&isStrength(actionId)&&!/RIR/i.test(p))p=`${p}｜${defaultRir(level)}`;
    return p||'按当前动作质量与课程目标执行';
  }
  function tierForAction(actionId){
    const a=D().actions?.[actionId]||{};
    const t=clean(a.tier||a.v11StandardTier);
    return /^T[1-4]$/.test(t)?t:'';
  }
  function memberPrescription(p){
    return clean(p).replace(/\s*[｜|]\s*RIR[^｜|\n]*/ig,'').replace(/RIR[^｜|\n]*/ig,'').trim().replace(/[｜|]\s*$/,'');
  }

  function formatAction(p){
    const tier=clean(p.tier),head=[clean(p.name),/^T[1-4]$/.test(tier)?tier:''].filter(Boolean).join('｜');
    const lines=[`7Fit｜动作模块`,head];
    if(clean(p.grade)&&!/^T[1-4]$/.test(clean(p.grade)))lines.push(`等级：${clean(p.grade)}`);
    if(clean(p.prescription))lines.push(`推荐处方：${clean(p.prescription)}`);
    if((p.primary||[]).length)lines.push(`主要肌群：${list(p.primary)}`);
    if((p.secondary||[]).length)lines.push(`辅助肌群：${list(p.secondary)}`);
    if((p.stabilizers||[]).length)lines.push(`稳定肌群：${list(p.stabilizers)}`);
    if(clean(p.goal))lines.push(`训练目标：${clean(p.goal)}`);
    if(clean(p.cue))lines.push(`教练口令：${clean(p.cue)}`);
    return lines.join('\n').trim();
  }
  function formatPrep(p){
    const lines=['7Fit｜PREP 热身模块',clean(p.title)||'PREP 热身'];
    (p.items||[]).forEach((x,i)=>{
      const head=[`${i+1}. ${clean(x.name)}`,clean(x.grade)].filter(Boolean).join('｜');
      lines.push('',head);
      if(clean(x.prescription))lines.push(`处方：${clean(x.prescription)}`);
      if(clean(x.why))lines.push(`目的：${clean(x.why)}`);
    });
    return lines.join('\n').trim();
  }
  function formatFoam(p){
    const lines=['7Fit｜泡沫轴推荐',clean(p.title)||'泡沫轴模块'];
    (p.items||[]).forEach((x,i)=>{
      lines.push('',`${i+1}. ${clean(x.name)}`);
      if(clean(x.prescription))lines.push(`时间：${clean(x.prescription)}`);
      if(clean(x.safety))lines.push(`安全：${clean(x.safety)}`);
    });
    return lines.join('\n').trim();
  }
  function formatPattern(p){
    const lines=['7Fit｜训练体系',clean(p.name)||'动作模式'];
    (p.levels||[]).forEach(x=>lines.push(`${clean(x.tier)}｜${clean(x.name)}`));
    if(clean(p.note))lines.push('',clean(p.note));
    return lines.join('\n').trim();
  }
  function formatTenPatterns(p){
    const levelLabel=x=>x.type==='support'?'S1–S6':x.type==='core'?'L1–L4 + Core Demand':'T1–T4';
    const lines=['7Fit｜十大动作模式'];
    (p.items||[]).forEach((x,i)=>lines.push(`${String(i+1).padStart(2,'0')} ${clean(x.name)}｜${levelLabel(x)}`));
    return lines.join('\n').trim();
  }
  function formatKnowledge(p){
    return ['7Fit｜知识模块',clean(p.title),...(p.lines||[]).filter(Boolean).map(clean)].filter(Boolean).join('\n').trim();
  }
  const formatters={action:formatAction,prep:formatPrep,foam:formatFoam,pattern:formatPattern,ten_patterns:formatTenPatterns,knowledge:formatKnowledge};

  function register(id,kind,payload){registry.set(id,{kind,payload});return id;}
  function button(id,label='复制本模块'){
    const safe=clean(id).replace(/"/g,'&quot;');
    return `<span class="module-copy-control"><button class="module-copy-button" type="button" data-copy-module="${safe}">${label}</button><small class="module-copy-status" data-copy-status="${safe}" role="status" aria-live="polite"></small></span>`;
  }
  function fallbackCopy(text,doc){
    if(!doc?.body||typeof doc.createElement!=='function'||typeof doc.execCommand!=='function')return false;
    const area=doc.createElement('textarea');area.value=text;area.setAttribute('readonly','');area.style.position='fixed';area.style.opacity='0';doc.body.appendChild(area);area.focus();area.select();
    let ok=false;try{ok=doc.execCommand('copy');}catch(_){ok=false;}area.remove();return !!ok;
  }
  async function copyText(text,env){
    const target=env||window,nav=target.navigator;
    if(nav?.clipboard?.writeText){try{await nav.clipboard.writeText(text);return true;}catch(_){}}
    if(fallbackCopy(text,target.document))return true;
    throw new Error('COPY_UNAVAILABLE');
  }
  async function copyRegistered(id,env){
    const item=registry.get(id);if(!item)throw new Error('COPY_MODULE_NOT_FOUND');
    const payload=typeof item.payload==='function'?item.payload():item.payload;
    const formatter=formatters[item.kind];if(!formatter)throw new Error('COPY_FORMATTER_NOT_FOUND');
    const text=formatter(payload);await copyText(text,env);return text;
  }
  function bind(root){
    const scope=root||document;
    scope.querySelectorAll?.('[data-copy-module]').forEach(btn=>{
      if(btn.dataset.copyBound==='1')return;btn.dataset.copyBound='1';
      btn.addEventListener('click',async()=>{
        const id=btn.dataset.copyModule,status=scope.querySelector?.(`[data-copy-status="${id}"]`)||document.querySelector?.(`[data-copy-status="${id}"]`);
        try{await copyRegistered(id);if(status){status.textContent='✓ 已复制';setTimeout(()=>{if(status.textContent==='✓ 已复制')status.textContent='';},1800);}}
        catch(_){if(status)status.textContent='复制失败';}
      });
    });
  }

  window.V14ModuleCopy={rirFromRpe,prescriptionForAction,tierForAction,memberPrescription,formatAction,formatPrep,formatFoam,formatPattern,formatTenPatterns,formatKnowledge,register,button,bind,copyRegistered,copyText};
})();

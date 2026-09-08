(function(){
  const clean=x=>String(x??'').trim();
  const lineList=(items,empty='—')=>(items||[]).filter(Boolean).map(x=>typeof x==='string'?x:x.name).filter(Boolean).join('、')||empty;
  const dotList=(items,empty='—')=>(items||[]).filter(Boolean).join(' · ')||empty;
  function prepLines(items,prefix){
    if(!(items||[]).length)return [`${prefix}：—`];
    if((items||[]).every(x=>typeof x==='string'))return [`${prefix}：${lineList(items)}`];
    const out=[`${prefix}：`];
    items.forEach(x=>out.push(`- ${clean(x.name)}${clean(x.prescription)?`｜${clean(x.prescription)}`:''}`));
    return out;
  }
  function formatCoach(p){
    const title=clean(p.sessionTitle)||[clean(p.recipeId),clean(p.recipeName)].filter(Boolean).join('｜');
    const header=[title,clean(p.level)].filter(Boolean).join('｜');
    const lines=[`${clean(p.brand)||'7Fit'}｜教练训练单`,header];
    if(clean(p.summary))lines.push(clean(p.summary));
    lines.push('','【2F PREP】',...prepLines(p.foam,'泡沫轴'),...prepLines(p.warmups,'动态热身 / 激活'),'','【1F STRENGTH】');
    (p.slots||[]).forEach(x=>{
      const tier=/^T[1-4]$/.test(clean(x.tier))?clean(x.tier):'';
      const grade=/^(SUP-S[1-6]|CORE-L[1-4])$/.test(clean(x.grade))?clean(x.grade):'';
      lines.push([clean(x.slot),clean(x.name),tier||grade].filter(Boolean).join('｜'));
      if(clean(x.prescription))lines.push(clean(x.prescription));
    });
    lines.push('','【本节主要训练肌群】',`主要刺激：${dotList(p.muscles?.primary)}`,`协同参与：${dotList(p.muscles?.secondary)}`,`核心 / 稳定：${dotList(p.muscles?.stabilizers)}`,'','【2F RECOVERY】',lineList(p.recovery));
    if(clean(p.postCardio))lines.push(`课后有氧：${clean(p.postCardio)}`);
    lines.push('','【系统提醒】',(p.conflicts||[]).length?(p.conflicts||[]).join('\n'):'当前方案未发现替换后冲突。');
    return lines.join('\n').replace(/\n{3,}/g,'\n\n').trim();
  }
  function formatMember(p){
    const primary=(p.muscles?.primary||[]).filter(Boolean).slice(0,6);
    const memberTitle=clean(p.recipeName)||(clean(p.sessionTitle).replace(/^[^｜]+｜/,'')||'今日训练安排');
    const lines=[`${clean(p.brand)||'7Fit'}｜今日训练`,memberTitle,'',`课前准备：${lineList([...(p.foam||[]),...(p.warmups||[])])}`,'','主要训练：'];
    (p.slots||[]).forEach((x,i)=>{
      const mp=window.V14ModuleCopy?.memberPrescription?window.V14ModuleCopy.memberPrescription(x.prescription):clean(x.prescription).replace(/\s*[｜|]\s*RIR.*$/i,'');
      lines.push(`${i+1}. ${clean(x.name)}${mp?`｜${mp}`:''}`);
    });
    lines.push('',`主要训练部位：${lineList(primary)}`,`训练后恢复：${lineList(p.recovery)}`);
    if(clean(p.postCardio))lines.push(`课后有氧：${clean(p.postCardio)}`);
    return lines.filter((x,i,a)=>!(x===''&&a[i-1]==='')).join('\n').trim();
  }
  function fallbackCopy(text,doc){if(!doc?.body||typeof doc.createElement!=='function'||typeof doc.execCommand!=='function')return false;const area=doc.createElement('textarea');area.value=text;area.setAttribute('readonly','');area.style.position='fixed';area.style.opacity='0';area.style.pointerEvents='none';doc.body.appendChild(area);area.focus();area.select();let ok=false;try{ok=doc.execCommand('copy');}catch(_){ok=false;}area.remove();return !!ok;}
  async function copyText(text,env){if(window.V14ModuleCopy?.copyText)return window.V14ModuleCopy.copyText(text,env);const target=env||window,nav=target.navigator;if(nav?.clipboard?.writeText){try{await nav.clipboard.writeText(text);return true;}catch(_){}}const ok=fallbackCopy(text,target.document);if(!ok)throw new Error('COPY_UNAVAILABLE');return true;}
  window.V14SessionCopy={formatCoach,formatMember,copyText};
})();

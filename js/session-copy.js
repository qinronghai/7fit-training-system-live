(function(){
  const clean=x=>String(x??'').trim();
  const D=()=>window.V14_DATA||{};
  const lineList=(items,empty='—')=>(items||[]).filter(Boolean).map(x=>typeof x==='string'?x:x.name).filter(Boolean).join('、')||empty;
  const dotList=(items,empty='—')=>(items||[]).filter(Boolean).join(' · ')||empty;
  const unique=items=>Array.from(new Set((items||[]).filter(Boolean)));
  const WEEKDAYS=['日','一','二','三','四','五','六'];
  const LEVEL_META={
    L1:{label:'动作控制'},
    L2:{label:'基础负重'},
    L3:{label:'负重进阶'},
    L4:{label:'完整能力'}
  };
  const LOWER_MEMBER_MODES=[
    {re:/单腿拉|单腿髋铰链/,title:'单腿后侧链',focus:'单腿后侧链'},
    {re:/单腿蹲/,title:'单腿力量',focus:'单腿力量'},
    {re:/单腿/,title:'单腿力量',focus:'单腿力量'},
    {re:/臀伸|臀推/,title:'臀部力量',focus:'臀部力量'},
    {re:/下肢拉|髋铰链/,title:'后侧链力量',focus:'后侧链力量'},
    {re:/下肢推|蹲/,title:'腿部力量',focus:'下肢力量'}
  ];
  const UPPER_MEMBER_MODES=[
    {re:/水平推|垂直推|上肢推/,title:'上肢推',focus:'上肢推力'},
    {re:/水平拉|垂直拉|上肢拉/,title:'上肢拉',focus:'上肢拉力'}
  ];
  const CARDIO_TEXT='选择跑步机爬坡、爬楼梯机、快走或其他有氧，时间 30 分钟左右，平均心率 130 到 140 左右（燃烧脂肪心率）。';

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

  function formatDate(now){
    let d=now===undefined?new Date():new Date(now);
    if(Number.isNaN(d.getTime()))d=new Date();
    return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日｜星期${WEEKDAYS[d.getDay()]}`;
  }
  function rawMemberTheme(p){
    return clean(p.recipeName)||(clean(p.sessionTitle).replace(/^[^｜]+｜/,'')||'');
  }
  function pickMode(raw,defs){return defs.find(x=>x.re.test(raw))||null;}
  function memberTheme(p){
    const raw=rawMemberTheme(p),lower=pickMode(raw,LOWER_MEMBER_MODES),upper=pickMode(raw,UPPER_MEMBER_MODES);
    const title=[lower?.title,upper?.title,'核心稳定'].filter(Boolean).join(' × ')||raw||'今日训练安排';
    const focus=[lower?.focus,upper?.focus,'核心稳定'].filter(Boolean).join(' · ')||'全身力量 · 核心稳定';
    return {raw,title,focus,lower,upper};
  }
  function levelMeta(level){return LEVEL_META[clean(level)]||{label:'训练进阶'};}
  function memberReason(theme,level){
    const lower=theme?.lower?.title||theme?.lower?.focus||'下肢力量';
    const upper=theme?.upper?.title==='上肢拉'?'背部拉力':theme?.upper?.title==='上肢推'?'上肢推力':theme?.upper?.focus||'上肢力量';
    if(clean(level)==='L1')return `今天以${lower}和${upper}为主，先把动作做稳、找到正确发力，同时建立核心稳定，为后续负重打基础。`;
    if(clean(level)==='L2')return `今天以${lower}和${upper}为主，在动作稳定的基础上加入基础负重，同时继续强化核心控制和身体协调。`;
    if(clean(level)==='L3')return `今天以${lower}和${upper}为主，在增加负重的同时继续强化核心稳定，让力量、动作控制和身体稳定一起进阶。`;
    if(clean(level)==='L4')return `今天以${lower}和${upper}为主，在更高阶段的负重与动作控制下，进一步整合核心稳定和全身协调。`;
    return `今天以${lower}和${upper}为主，同时兼顾核心稳定和身体控制。`;
  }
  function itemName(x){return clean(typeof x==='string'?x:x?.name);}
  function prepMeta(x){
    if(x&&typeof x==='object'&&(x.role||x.why||x.regions||x.targetPatterns||x.muscles))return x;
    const name=itemName(x);
    if(!name)return x||{};
    const warm=Object.values(D().warmupDetails||{}).find(w=>clean(w.name)===name);
    if(warm)return warm;
    const foam=Object.values(D().foamRollDetails||{}).find(f=>clean(f.name)===name);
    return foam||x||{};
  }
  function itemMeta(x){
    const m=prepMeta(x);
    if(!m||typeof m==='string')return '';
    return [m.role,m.why,m.category,m.target,m.goal,Array.isArray(m.targetPatterns)?m.targetPatterns.join(' '):m.targetPatterns,Array.isArray(m.regions)?m.regions.join(' '):m.regions,Array.isArray(m.muscles)?m.muscles.join(' '):m.muscles].map(clean).filter(Boolean).join(' ');
  }
  function anatomyForActionId(actionId){
    if(!actionId)return {};
    return window.V14Anatomy?.get?.(actionId)||window.V14_ANATOMY?.records?.[actionId]||{};
  }
  function actionMetaByName(name){
    const target=clean(name);if(!target)return null;
    const matches=Object.entries(D().actions||{}).filter(([,a])=>clean(a?.name)===target);
    if(!matches.length)return null;
    const [actionId,action]=matches[0];
    return {actionId,action:action||{},anatomy:anatomyForActionId(actionId)};
  }
  function actionMeta(x){
    const actionId=clean(x?.actionId);
    if(actionId){
      const action=D().actions?.[actionId];
      if(action)return {actionId,action,anatomy:anatomyForActionId(actionId)};
    }
    return actionMetaByName(x?.name);
  }
  function slotMuscles(p,slotRe){
    const out=[];
    (p.slots||[]).filter(x=>slotRe.test(clean(x.slot))).forEach(x=>{
      const meta=actionMeta(x),a=meta?.anatomy||{};
      for(const key of ['primary','secondary'])for(const muscle of (Array.isArray(a[key])?a[key]:[]))if(muscle&&!out.includes(muscle))out.push(muscle);
    });
    return out;
  }
  function foamMemberName(x,p){
    let s=itemName(x).replace(/^泡沫轴(?:松解|放松)?\s*[-—–:：]?\s*/,'');
    s=s.replace(/肱三头肌/g,'手臂后侧').replace(/肱二头肌/g,'手臂前侧').replace(/臀大肌|臀肌/g,'臀部').replace(/胸大肌|胸肌/g,'胸部');
    s=s.replace(/背阔肌\s*[\/／]\s*背侧/g,'上背部').replace(/背阔肌/g,'背部');
    if(/^肩部$/.test(s)){
      const d2=slotMuscles(p,/^D2｜/);
      const theme=memberTheme(p);
      if(d2.some(m=>['三角肌后束','中斜方肌','菱形肌'].includes(m))||theme.upper?.title==='上肢拉')s='肩后侧';
      else if(d2.includes('三角肌前束')||theme.upper?.title==='上肢推')s='肩前侧';
    }
    return s.replace(/[\/／]+/g,'、');
  }
  function warmupMemberName(x){
    const s=itemName(x);
    if(/最伟大伸展/.test(s))return '最伟大伸展';
    if(/90\s*\/\s*90/.test(s))return '90/90';
    if(/青蛙趴/.test(s))return '青蛙趴';
    if(/平板支撑/.test(s))return '平板支撑';
    if(/死虫/.test(s))return '死虫';
    if(/鸟狗/.test(s))return '鸟狗';
    if(/胸椎旋转/.test(s))return '胸椎旋转';
    return s.replace(/[（(].*?[）)]/g,'').replace(/^动态/,'').trim();
  }
  function warmupCategory(x){
    const name=itemName(x),meta=itemMeta(x),text=`${name} ${meta}`;
    if(/最伟大伸展|世界最伟大|全身动态/.test(name))return 'dynamic';
    if(/核心激活|平板支撑|死虫|鸟狗|抗伸展|抗旋转|支撑/.test(text))return 'core';
    if(/90\s*\/\s*90|青蛙趴|髋|内收|踝|膝|下肢活动/.test(text))return 'hip';
    if(/肩胛|肩关节|肩袖|胸椎|上肢活动/.test(text))return 'upper';
    return 'dynamic';
  }
  function prepGroups(p){
    const groups={foam:unique((p.foam||[]).map(x=>foamMemberName(x,p))),hip:[],upper:[],dynamic:[],core:[]};
    (p.warmups||[]).forEach(x=>{
      const key=warmupCategory(x),name=warmupMemberName(x);
      if(name&&!groups[key].includes(name))groups[key].push(name);
    });
    return groups;
  }
  function memberPrescription(p){
    let s=window.V14ModuleCopy?.memberPrescription?window.V14ModuleCopy.memberPrescription(p):clean(p).replace(/\s*[｜|]\s*RIR[^｜|\n]*/ig,'').replace(/RIR[^｜|\n]*/ig,'').trim().replace(/[｜|]\s*$/,'');
    s=s.replace(/(\d+(?:[–-]\d+)?)\s*组\s*×\s*/g,'$1 × ');
    s=s.replace(/(\d+(?:[–-]\d+)?)\s*次\s*\/\s*侧/g,'$1 / 侧');
    s=s.replace(/(\d+(?:[–-]\d+)?)\s*次\s*\/\s*方向/g,'$1 / 方向');
    s=s.replace(/(\d+(?:[–-]\d+)?)\s*次/g,'$1');
    s=s.replace(/(\d+(?:[–-]\d+)?)\s*秒\s*\/\s*侧/g,'$1 秒 / 侧');
    s=s.replace(/(\d+(?:[–-]\d+)?)\s*秒/g,'$1 秒');
    return s.replace(/\s{2,}/g,' ').trim();
  }
  function structuredMemberPurpose(x){
    const meta=actionMeta(x);if(!meta)return '';
    const {action,anatomy}=meta,slot=clean(x?.slot),pattern=clean(action.pattern);
    const primary=Array.isArray(anatomy.primary)?anatomy.primary:[],moves=Array.isArray(anatomy.movementActions)?anatomy.movementActions:[];
    const has=(items,re)=>items.some(v=>re.test(clean(v)));
    if(action.isCore||/^CORE/.test(slot)){
      if(has(moves,/抗旋转/))return '核心抗旋转';
      if(has(moves,/抗伸展/))return '核心抗伸展与稳定';
      return '核心稳定';
    }
    if(action.isSupport||/^C｜/.test(slot)){
      if(has(moves,/交替|对侧|单臂|抗旋转/))return '核心稳定与身体控制';
      return '核心稳定';
    }
    if(/^D1｜/.test(slot)){
      if(primary.includes('内收肌群'))return '大腿内侧强化';
      if(primary.includes('股四头肌'))return '大腿前侧强化';
      if(primary.includes('腘绳肌'))return '大腿后侧强化';
      if(primary.some(v=>['臀中肌','臀小肌'].includes(v)))return '臀侧强化';
      if(primary.includes('臀大肌'))return '臀部强化';
      if(primary.some(v=>['腓肠肌','比目鱼肌'].includes(v)))return '小腿强化';
    }
    if(/^D2｜/.test(slot)){
      if(primary.includes('三角肌后束')||has(moves,/肩水平外展/))return '肩后侧与上背强化';
      if(primary.includes('肱三头肌'))return '手臂后侧强化';
      if(primary.some(v=>['肱二头肌','肱肌'].includes(v)))return '手臂前侧强化';
      if(primary.some(v=>['中斜方肌','斜方肌中束','斜方肌下束','菱形肌'].includes(v)))return '上背与肩胛强化';
      if(primary.some(v=>/肩袖|冈下肌|小圆肌/.test(v)))return '肩部稳定强化';
      if(primary.some(v=>['三角肌前束','三角肌中束'].includes(v)))return '肩部强化';
    }
    if(primary.includes('内收肌群'))return '大腿内侧强化';
    if(/水平推|垂直推/.test(pattern))return '上肢推力';
    if(/水平拉|垂直拉/.test(pattern))return '上肢拉力';
    if(/单腿拉|单腿髋铰链/.test(pattern))return '单腿后侧链力量';
    if(/单腿蹲/.test(pattern))return '单腿力量';
    if(/蹲/.test(pattern)&&primary.some(v=>['股四头肌','臀大肌'].includes(v)))return '大腿与臀部力量';
    if(/髋铰链/.test(pattern))return '后侧链力量';
    if(/髋伸展|臀伸|臀推/.test(pattern)||primary.includes('臀大肌'))return '臀部力量';
    return '';
  }
  function memberPurpose(x,theme){
    if(clean(x?.memberPurpose))return clean(x.memberPurpose);
    const structured=structuredMemberPurpose(x);if(structured)return structured;
    const name=clean(x?.name),slot=clean(x?.slot);
    if(/Pallof|抗旋转/i.test(name))return '核心抗旋转';
    if(/交替触肩|触肩/.test(name))return '核心稳定与身体控制';
    if(/腿屈伸/.test(name))return '大腿前侧强化';
    if(/反向飞鸟|俯身飞鸟/.test(name))return '肩后侧与上背强化';
    if(/髋内收|内收/.test(name))return '大腿内侧强化';
    if(/三头|臂屈伸/.test(name))return '手臂后侧强化';
    if(/卧推|胸推|推胸|俯卧撑/.test(name))return '上肢推力';
    if(/划船|下拉|引体/.test(name))return '上肢拉力';
    if(/哈克深蹲|深蹲|腿举|蹲/.test(name))return '大腿与臀部力量';
    if(/臀推|臀桥/.test(name))return '臀部力量';
    if(/罗马尼亚|硬拉|髋铰链/.test(name))return '后侧链力量';
    if(/平板|死虫|鸟狗|支撑/.test(name))return '核心稳定';
    if(/^C｜|^CORE/.test(slot))return '核心稳定';
    if(/^B｜/.test(slot))return theme?.upper?.focus||'上肢力量';
    if(/^A｜/.test(slot))return theme?.lower?.focus||'下肢力量';
    if(/^D1｜/.test(slot))return '下肢辅助强化';
    if(/^D2｜/.test(slot))return '上肢辅助强化';
    return '力量与身体控制';
  }
  function recoveryMemberName(x){
    return itemName(x).replace(/臀大肌|臀肌/g,'臀部').replace(/胸大肌|胸肌/g,'胸部').replace(/肱三头肌/g,'手臂后侧').replace(/背阔肌/g,'背部');
  }
  function formatMember(p,options={}){
    const theme=memberTheme(p),level=clean(p.level),meta=levelMeta(level),groups=prepGroups(p);
    const lines=[formatDate(options.now),`${clean(p.brand)||'7Fit'}｜今日训练`,'',theme.title,`${level||'L'}｜${meta.label}`,'',memberReason(theme,level),'','课前准备｜约 10–12 分钟'];
    if(groups.foam.length)lines.push(`泡沫轴放松：${lineList(groups.foam)}`);
    if(groups.hip.length)lines.push(`髋部活动：${lineList(groups.hip)}`);
    if(groups.upper.length)lines.push(`上肢活动：${lineList(groups.upper)}`);
    if(groups.dynamic.length)lines.push(`动态活动：${lineList(groups.dynamic)}`);
    if(groups.core.length)lines.push(`核心激活：${lineList(groups.core)}`);
    if(!groups.foam.length&&!groups.hip.length&&!groups.upper.length&&!groups.dynamic.length&&!groups.core.length)lines.push('按当天状态完成课程热身');
    lines.push('','主要训练');
    (p.slots||[]).forEach((x,i)=>{
      const rx=memberPrescription(x.prescription),purpose=memberPurpose(x,theme);
      lines.push(`${i+1}. ${clean(x.name)}${rx?`｜${rx}`:''}`);
      if(purpose)lines.push(`   ${purpose}`);
    });
    lines.push('','今日训练重点',theme.focus,'','训练后恢复',dotList(unique((p.recovery||[]).map(recoveryMemberName))),'','课后有氧｜约 30 分钟',CARDIO_TEXT);
    return lines.join('\n').replace(/\n{3,}/g,'\n\n').trim();
  }
  function fallbackCopy(text,doc){if(!doc?.body||typeof doc.createElement!=='function'||typeof doc.execCommand!=='function')return false;const area=doc.createElement('textarea');area.value=text;area.setAttribute('readonly','');area.style.position='fixed';area.style.opacity='0';area.style.pointerEvents='none';doc.body.appendChild(area);area.focus();area.select();let ok=false;try{ok=doc.execCommand('copy');}catch(_){ok=false;}area.remove();return !!ok;}
  async function copyText(text,env){if(window.V14ModuleCopy?.copyText)return window.V14ModuleCopy.copyText(text,env);const target=env||window,nav=target.navigator;if(nav?.clipboard?.writeText){try{await nav.clipboard.writeText(text);return true;}catch(_){}}const ok=fallbackCopy(text,target.document);if(!ok)throw new Error('COPY_UNAVAILABLE');return true;}
  window.V14SessionCopy={formatCoach,formatMember,copyText,formatDate,memberTheme,prepGroups,memberPrescription,memberPurpose,memberReason};
})();

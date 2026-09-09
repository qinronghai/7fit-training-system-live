(function(){
  const clean=x=>String(x??'').trim();
  const D=()=>window.V14_DATA||{};
  const LEVEL_LABELS={L1:'动作控制',L2:'基础负重',L3:'负重进阶',L4:'完整能力'};
  const COACH_CARDIO_LINES=[
    '课后有氧｜约 30 分钟',
    '跑步机爬坡 / 楼梯机 / 快走 / 其他有氧',
    '平均心率：130–140 bpm 左右（燃烧脂肪心率）'
  ];

  function base(){return window.V14SessionCopy||{};}
  function formatDate(now){return typeof base().formatDate==='function'?base().formatDate(now):'';}
  function actionMeta(x){
    const actionId=clean(x?.actionId);
    if(actionId&&D().actions?.[actionId])return {actionId,action:D().actions[actionId]};
    const target=clean(x?.name);
    if(!target)return {actionId:'',action:{}};
    const found=Object.entries(D().actions||{}).find(([,a])=>clean(a?.name)===target);
    return found?{actionId:found[0],action:found[1]||{}}:{actionId:'',action:{}};
  }
  function slotKey(x){
    const raw=clean(x?.slot);
    const first=raw.split('｜')[0].trim();
    if(/^CORE$/i.test(first)||/^CORE/i.test(raw))return 'CORE';
    if(/^D1$/i.test(first))return 'D1';
    if(/^D2$/i.test(first))return 'D2';
    if(/^[ABC]$/i.test(first))return first.toUpperCase();
    return first||raw||'—';
  }
  function gradeLabel(x){
    const tier=/^T[1-4]$/.test(clean(x?.tier))?clean(x.tier):'';
    const grade=/^(SUP-S[1-6]|CORE-L[1-4])$/.test(clean(x?.grade))?clean(x.grade):'';
    return grade||tier;
  }
  function rawTheme(p){
    let raw=clean(p?.recipeName);
    if(!raw)raw=clean(p?.sessionTitle).replace(/^[^｜]+｜/,'');
    return raw;
  }
  function coachTheme(p){
    const raw=rawTheme(p);
    const parts=raw.split(/[+＋×]/).map(clean).filter(Boolean);
    const lower=parts[0]||'下肢训练';
    const upper=parts[1]||'上肢训练';
    const title=`${lower} × ${upper} × 核心稳定`;
    return {raw,lower,upper,title,focus:`${lower} · ${upper} · 核心稳定`};
  }
  function memberTheme(p){return typeof base().memberTheme==='function'?base().memberTheme(p):null;}
  function coachPurpose(x,p){
    if(clean(x?.coachPurpose))return clean(x.coachPurpose);
    if(typeof base().memberPurpose==='function')return base().memberPurpose(x,memberTheme(p))||'力量与身体控制';
    return '力量与身体控制';
  }
  function trimAuxPurpose(text){return clean(text).replace(/强化$/,'').replace(/力量$/,'力量');}
  function coachReason(p,theme){
    const level=clean(p?.level),stage=LEVEL_LABELS[level]||'训练进阶';
    const a=(p?.slots||[]).find(x=>slotKey(x)==='A');
    const b=(p?.slots||[]).find(x=>slotKey(x)==='B');
    const d1=(p?.slots||[]).find(x=>slotKey(x)==='D1');
    const d2=(p?.slots||[]).find(x=>slotKey(x)==='D2');
    const head=`${level||'当前'} ${stage}阶段。`;
    const main=[];
    if(a)main.push(`A 位用${clean(a.name)}建立${theme.lower}主要负荷`);
    if(b)main.push(`B 位用${clean(b.name)}建立${theme.upper}主要负荷`);
    let sentence=head+(main.length?main.join('，'):'围绕本节主训练建立清晰负荷');
    sentence+='；C / CORE 负责核心稳定';
    const aux=[d1,d2].filter(Boolean).map(x=>trimAuxPurpose(coachPurpose(x,p))).filter(Boolean);
    if(aux.length)sentence+=`，D 位补充${aux.join('、')}训练量`;
    return sentence+'。';
  }
  function prepGroups(p){
    if(typeof base().prepGroups==='function')return base().prepGroups(p);
    return {foam:[],hip:[],upper:[],dynamic:[],core:[]};
  }
  function joinSlash(items){return (items||[]).filter(Boolean).join(' / ');}
  function coachRest(x){
    const rx=clean(x?.prescription);
    if(/休息/.test(rx))return '';
    const key=slotKey(x);
    if(key==='A'||key==='B')return '休息 90s';
    if(key==='C'||key==='CORE')return '休息 45–60s';
    return '';
  }
  function prescriptionLine(x){
    const rx=clean(x?.prescription),rest=coachRest(x);
    return [rx,rest].filter(Boolean).join('｜');
  }
  function coachCue(x){
    const {action}=actionMeta(x),name=clean(x?.name),pattern=clean(action?.pattern);
    if(/单腿/.test(name)&&/罗马尼亚|硬拉|髋铰链/.test(name))return '先稳定骨盆，再完成髋向后移动';
    if(/哈克深蹲|深蹲|腿举/.test(name)||/下肢推|蹲/.test(pattern))return '足底三点稳定，膝盖与脚尖方向一致';
    if(/罗马尼亚|硬拉|髋铰链/.test(name)||/下肢拉|髋铰链/.test(pattern))return '保持脊柱中立，髋向后移动';
    if(/臀推|臀桥/.test(name)||/臀伸|髋伸展/.test(pattern))return '肋骨收好，顶端用臀完成伸髋';
    if(/划船/.test(name)||/水平拉/.test(pattern))return '先稳定肩胛，再向后拉肘';
    if(/下拉|引体/.test(name)||/垂直拉/.test(pattern))return '肩胛下沉，肘向身体两侧下拉';
    if(/卧推|胸推|俯卧撑/.test(name)||/水平推/.test(pattern))return '肩胛稳定，推起时保持手腕与前臂对齐';
    if(/肩推|推举/.test(name)||/垂直推/.test(pattern))return '肋骨保持控制，向上推时避免耸肩和腰椎代偿';
    return '动作全程保持稳定控制，不以代偿换负重';
  }
  function coachObservation(x){
    const {action}=actionMeta(x),name=clean(x?.name),pattern=clean(action?.pattern);
    if(/触肩/.test(name))return '骨盆旋转 / 重心转移';
    if(/Pallof|抗旋转/i.test(name)||/抗旋转/.test(pattern))return '躯干旋转 / 骨盆稳定';
    if(/单腿/.test(name)&&/蹲|分腿|弓步/.test(name))return '膝轨迹 / 骨盆偏移 / 左右差异';
    if(/单腿/.test(name)&&/罗马尼亚|硬拉|髋铰链/.test(name))return '骨盆旋转 / 髋控制 / 左右差异';
    if(/哈克深蹲|深蹲|腿举/.test(name)||/下肢推|蹲/.test(pattern))return '膝轨迹 / 骨盆稳定 / 左右发力';
    if(/罗马尼亚|硬拉|髋铰链/.test(name)||/下肢拉|髋铰链/.test(pattern))return '腰椎代偿 / 骨盆控制 / 左右发力';
    if(/臀推|臀桥/.test(name)||/臀伸|髋伸展/.test(pattern))return '腰椎过伸 / 骨盆控制 / 臀部发力';
    if(/划船/.test(name)||/水平拉/.test(pattern))return '肩胛控制 / 耸肩代偿 / 左右拉力';
    if(/下拉|引体/.test(name)||/垂直拉/.test(pattern))return '耸肩代偿 / 躯干后仰 / 左右拉力';
    if(/卧推|胸推|俯卧撑/.test(name)||/水平推/.test(pattern))return '肩前顶 / 肩胛稳定 / 左右推力';
    if(/肩推|推举/.test(name)||/垂直推/.test(pattern))return '耸肩代偿 / 肋骨外翻 / 左右推力';
    if(/平板|死虫|鸟狗|支撑/.test(name)||/抗伸展|抗侧屈/.test(pattern))return '核心稳定 / 呼吸控制';
    return '动作质量 / 左右对称 / 疲劳后代偿';
  }
  function observationItems(p){
    const slots=p?.slots||[];
    const selected=['A','B','C'].map(k=>slots.find(x=>slotKey(x)===k)).filter(Boolean);
    if(!selected.some(x=>slotKey(x)==='C')){
      const core=slots.find(x=>slotKey(x)==='CORE');if(core)selected.push(core);
    }
    return selected.slice(0,3).map(x=>`${slotKey(x)} ${clean(x.name)}：${coachObservation(x)}`);
  }
  function courseIdentity(p){
    if(clean(p?.recipeId))return clean(p.recipeId);
    const s=clean(p?.sessionTitle);
    if(/^自由组合/.test(s))return '自由组合';
    return s.split('｜')[0]||'训练课程';
  }
  function formatCoach(p,options={}){
    const theme=coachTheme(p),level=clean(p?.level),stage=LEVEL_LABELS[level]||'训练进阶',groups=prepGroups(p);
    const lines=[formatDate(options.now),`${clean(p?.brand)||'7Fit'}｜私教训练`,`${courseIdentity(p)}｜${level||'L'} ${stage}`,theme.title,'动线：2F 准备 → 1F 力量 → 2F 恢复','','本节目标',coachReason(p,theme),`本节重点：${theme.focus}`,'','PREP｜约 10–12 分钟'];
    if(groups.foam?.length)lines.push(`泡沫轴松解：${joinSlash(groups.foam)}`);
    if(groups.hip?.length)lines.push(`髋部活动：${joinSlash(groups.hip)}`);
    if(groups.upper?.length)lines.push(`上肢活动：${joinSlash(groups.upper)}`);
    if(groups.dynamic?.length)lines.push(`动态活动：${joinSlash(groups.dynamic)}`);
    if(groups.core?.length)lines.push(`核心激活：${joinSlash(groups.core)}`);
    if(!groups.foam?.length&&!groups.hip?.length&&!groups.upper?.length&&!groups.dynamic?.length&&!groups.core?.length)lines.push('按当天状态完成课程准备');
    lines.push('','STRENGTH');
    (p?.slots||[]).forEach(x=>{
      const key=slotKey(x),grade=gradeLabel(x),name=clean(x?.name);
      lines.push([key,name,grade].filter(Boolean).join('｜'));
      const rx=prescriptionLine(x);if(rx)lines.push(rx);
      const purpose=coachPurpose(x,p);if(purpose)lines.push(`目标：${purpose}`);
      if(key==='A'||key==='B')lines.push(`Cue：${coachCue(x)}`);
      lines.push('');
    });
    const observations=observationItems(p);
    if(observations.length)lines.push('本节观察',...observations,'');
    lines.push('RECOVERY',joinSlash(p?.recovery)||'—','','...CARDIO_PLACEHOLDER');
    lines.splice(lines.indexOf('...CARDIO_PLACEHOLDER'),1,...COACH_CARDIO_LINES);
    if((p?.conflicts||[]).length)lines.push('','注意事项',...(p.conflicts||[]).map(x=>`- ${clean(x)}`));
    return lines.join('\n').replace(/\n{3,}/g,'\n\n').trim();
  }

  window.V14CoachCopy={formatCoach,coachTheme,coachReason,coachPurpose,coachCue,coachObservation,coachRest};
  window.V14SessionCopy=window.V14SessionCopy||{};
  window.V14SessionCopy.formatCoach=formatCoach;
})();

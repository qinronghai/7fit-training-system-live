(function(){
  'use strict';

  const M=window.V14CoachModules=window.V14CoachModules||{};
  const C=M.Common||{};
  const esc=C.esc||((value)=>String(value??''));
  const D=()=>window.V14_DATA||{};
  const SLOT_LABELS={A:'A｜下肢主项',B:'B｜上肢主项',D2:'D2｜上肢辅助',D1:'D1｜下肢辅助',C:'C｜支撑模式',CORE:'CORE｜核心模式'};
  const SUPPORT_GRADES=['SUP-S1','SUP-S2','SUP-S3','SUP-S4','SUP-S5','SUP-S6'];
  const CORE_GRADES=['CORE-L1','CORE-L2','CORE-L3','CORE-L4'];

  function modeOptions(ctx,axis){
    const modes=D().composer?.[axis==='lower'?'lowerModes':'upperModes']||{};
    const current=axis==='lower'?ctx.lowerMode:ctx.upperMode;
    return Object.entries(modes).map(([id,mode])=>({id,name:String(mode.name||id),subtitle:String(mode.subtitle||mode.pattern||''),selected:id===current}));
  }

  function modeTrigger(ctx,axis){
    const current=axis==='lower'?ctx.lowerMode:ctx.upperMode;
    const mode=modeOptions(ctx,axis).find(item=>item.id===current)||{name:current};
    const label=axis==='lower'?'下肢模式':'上肢模式';
    const currentLabel=`${mode.name}${axis==='lower'&&mode.subtitle?`｜${mode.subtitle}`:''}`;
    return `<label class="f111-mode-field"><span class="f111-mode-label">${esc(label)}</span><button type="button" class="f111-mode-drawer-trigger" data-f111-mode-drawer="${axis}" aria-haspopup="dialog"><span>${esc(currentLabel)}</span><i aria-hidden="true">⌄</i></button></label>`;
  }

  function actionGroups(ctx,slotKey){
    const currentOptions=ctx.resolved?.slotOptions?.[slotKey]||[];
    const allowed=slotKey==='C'?SUPPORT_GRADES:slotKey==='CORE'?CORE_GRADES:[];
    const order=allowed.length?allowed:[];
    const data=D();
    const canonicalIds=slotKey==='C'?(data.supportIds||[]):slotKey==='CORE'?(data.coreIds||[]):[];
    const options=canonicalIds.length
      ? canonicalIds.map(id=>{
        const action=data.actions?.[id]||{};
        return {id,name:action.name||id,grade:action.supportGrade||action.coreGrade||action.grade||action.tier||id.split('-').slice(0,2).join('-'),pattern:action.pattern||'',disabled:!currentOptions.some(option=>option.id===id)};
      })
      : currentOptions.map(option=>({...option,disabled:false}));
    const legalIds=new Set(currentOptions.map(option=>option.id));
    const map=new Map();
    options.forEach(option=>{
      const grade=String(option.grade||option.tier||'未分级');
      if(!map.has(grade))map.set(grade,[]);
      map.get(grade).push({id:String(option.id||''),name:String(option.name||option.id||''),grade,pattern:String(option.pattern||''),disabled:option.disabled??!legalIds.has(option.id),selected:option.id===ctx.resolved?.slots?.find(slot=>slot.slotKey===slotKey)?.actionId});
    });
    const grades=[...order,...map.keys().filter(grade=>!order.includes(grade))];
    const labelFor=(grade,items)=>{
      const first=items[0]?.id;
      const detail=slotKey==='C'?data.supportDetails?.[first]:data.coreDetails?.[first];
      const raw=slotKey==='C'?detail?.fields?.['支撑等级']:detail?.fields?.['Core Grade'];
      return (raw||grade.replace(/^SUP-/,'支撑 ').replace(/^CORE-/,'核心 ')).replace(/^SUP-/,'').replace(/^CORE-/,'CORE-');
    };
    return grades.filter(grade=>map.has(grade)).map(grade=>({grade,label:labelFor(grade,map.get(grade)),items:map.get(grade)}));
  }

  function actionTrigger(ctx,slotKey){
    const slot=ctx.resolved?.slots?.find(item=>item.slotKey===slotKey)||{};
    const label=SLOT_LABELS[slotKey]||slotKey;
    const current=slot.name||'选择动作';
    const groups=actionGroups(ctx,slotKey);
    const count=groups.reduce((total,group)=>total+group.items.length,0);
    return `<button type="button" class="f111-action-drawer-trigger" data-f111-action-drawer="${esc(slotKey)}" aria-haspopup="dialog"><span>${esc(label)}</span><b>${esc(current)}</b><i aria-hidden="true">⌄</i></button>`;
  }

  function stepper(active='select'){
    return `<nav class="f111-compose-stepper" aria-label="编课步骤"><span class="${active==='select'?'active':''}"><i class="f111-step-dot" aria-hidden="true">01</i><b>选择阶段</b></span><span class="${active==='compose'?'active':''}"><i class="f111-step-dot" aria-hidden="true">02</i><b>选择模式</b></span><span class="${active==='review'?'active':''}"><i class="f111-step-dot" aria-hidden="true">03</i><b>查看课程</b></span></nav>`;
  }

  function currentLabel(ctx){return `${ctx.level}｜${ctx.resolved?.lower?.name||''} + ${ctx.resolved?.upper?.name||''}`;}

  M.F111ComposeUI={modeOptions,modeTrigger,actionGroups,actionTrigger,stepper,currentLabel,SLOT_LABELS};
})();

(function(){
  'use strict';
  const M=window.V14CoachModules=window.V14CoachModules||{};
  const {D,esc}=M.Common;
  const REFERENCE_WEIGHT_KG=60;
  const MIN_WEIGHT_KG=0.1,MAX_WEIGHT_KG=500;
  const weightInputs=new Map();
  const strengthKeys=['A','B','D1','D2','C','CORE'];
  const phaseMinutes={warmup:[10,12],strength:[40,43],recovery:[5,8]};

  // 2024 Adult Compendium, activity codes 02022, 02024, 02030, 02052,
  // 02054, 02056 and 02101: https://pacompendium.com/conditioning-exercise/
  function strengthMet(action){
    const bodyweight=action.equipmentClass==='bodyweight'||/^(徒手|自重)/.test(action.equipment||'');
    if(bodyweight)return action.isSupport||action.isCore?[2.8,3.8]:[3,3.8];
    if(/深蹲|硬拉/.test(action.name))return [3.5,5];
    return [3.5,3.5];
  }

  function doseSeconds(prescription){
    const dose=/(\d+)\s*组\s*[×x]\s*(\d+)(?:\s*[-–—]\s*(\d+))?\s*(次|秒)(\s*\/\s*侧)?/i.exec(prescription);
    if(!dose)return 0;
    const [,sets,low,high,unit,perSide]=dose;
    const amount=(Number(low)+Number(high||low))/2;
    // A timing proxy for sharing the block, including a standard break/setup allowance per set.
    const workSeconds=amount*(unit==='次'?3:1)*(perSide?2:1);
    return Number(sets)*(workSeconds+60);
  }

  function validWeight(weightKg){
    return Number.isFinite(weightKg)&&weightKg>=MIN_WEIGHT_KG&&weightKg<=MAX_WEIGHT_KG;
  }

  function estimate(session,weightKg){
    if(!validWeight(weightKg))return null;
    const slots=session?.main?.content||[],actions=D().actions||{};
    // Presets retain legacy keys such as SUPPORT and 2; their labels carry the current slots.
    const byKey=new Map(slots.map(slot=>[slot.label?.split('｜')[0]||slot.key,slot]));
    const planned=strengthKeys.map(key=>{
      const slot=byKey.get(key),action=actions[slot?.actionId];
      const prescription=slot?.prescription||window.V14ModuleCopy?.prescriptionForF111Slot?.(key,slot?.actionId)||'';
      const seconds=doseSeconds(prescription);
      return action&&seconds>0?{name:action.name,seconds,met:strengthMet(action)}:null;
    });
    if(planned.some(item=>!item))return null;
    const totalSeconds=planned.reduce((sum,item)=>sum+item.seconds,0);
    // Gross expenditure: standard MET (3.5 mL/kg/min) × body mass × minutes × 5 kcal/L.
    const kcal=(minutes,met,share=1)=>minutes.map((time,i)=>time*met[i]*weightKg*0.0175*share);
    const warmup=kcal(phaseMinutes.warmup,[2.3,3.5]);
    const recovery=kcal(phaseMinutes.recovery,[2.3,2.3]);
    const movements=planned.map(item=>({name:item.name,kcal:kcal(phaseMinutes.strength,item.met,item.seconds/totalSeconds)}));
    const strength=phaseMinutes.strength.map((_,i)=>movements.reduce((sum,item)=>sum+item.kcal[i],0));
    const total=strength.map((value,i)=>warmup[i]+value+recovery[i]);
    return {total,warmup,strength,recovery,movements};
  }

  function kcalText(range,step=1){
    if(!range)return '—';
    const [low,high]=range.map(value=>Math.round(value/step)*step);
    return `约 ${low===high?low:`${low}–${high}`} kcal`;
  }

  function weightNote(raw,weightKg,result){
    if(!validWeight(weightKg))return ' · 请检查体重';
    if(!result)return ' · 选齐力量动作后显示';
    return raw===''?` · ${REFERENCE_WEIGHT_KG} kg 参考`:'';
  }

  function breakdown(result){
    if(!result)return '';
    const row=(label,range)=>`<div><dt>${esc(label)}</dt><dd>${kcalText(range)}</dd></div>`;
    return `<dl class="f111-energy-phases">${row('热身',result.warmup)}${row('力量训练',result.strength)}${row('拉伸',result.recovery)}</dl>
      <dl class="f111-energy-movements" aria-label="各力量动作估算">${result.movements.map(item=>row(item.name,item.kcal)).join('')}</dl>`;
  }

  function render(session,memberId=null){
    const raw=weightInputs.get(memberId)||'';
    const weightKg=raw===''?REFERENCE_WEIGHT_KG:Number(raw);
    const result=estimate(session,weightKg);
    return `<details class="f111-energy" data-f111-energy data-f111-disclosure="energy">
      <summary><span>整课热量估算<small data-f111-energy-note>${weightNote(raw,weightKg,result)}</small></span><strong data-f111-energy-total aria-live="polite">${kcalText(result?.total,5)}</strong></summary>
      <div class="f111-energy-content">
        <label>体重（kg） <input type="number" min="${MIN_WEIGHT_KG}" max="${MAX_WEIGHT_KG}" step="any" inputmode="decimal" placeholder="${REFERENCE_WEIGHT_KG}" value="${esc(raw)}" data-f111-energy-weight data-f111-focus="energy-weight"></label>
        <div data-f111-energy-breakdown>${breakdown(result)}</div>
        <small>按计划时长和动作处方估算，含静息消耗。课后自主有氧另计。</small>
      </div>
    </details>`;
  }

  function bind(root,getSession,memberId=null){
    const card=root.querySelector('[data-f111-energy]');
    if(!card)return;
    const input=card.querySelector('[data-f111-energy-weight]');
    const note=card.querySelector('[data-f111-energy-note]');
    const total=card.querySelector('[data-f111-energy-total]');
    const details=card.querySelector('[data-f111-energy-breakdown]');
    let session;
    input.addEventListener('input',()=>{
      const raw=input.value;
      const badInput=input.validity.badInput;
      if(!badInput)weightInputs.set(memberId,raw);
      session??=getSession();
      const weightKg=badInput?NaN:(raw===''?REFERENCE_WEIGHT_KG:input.valueAsNumber);
      const result=estimate(session,weightKg);
      note.textContent=weightNote(raw,weightKg,result);
      total.textContent=kcalText(result?.total,5);
      details.innerHTML=breakdown(result);
    });
  }

  M.F111Energy={estimate,render,bind};
})();

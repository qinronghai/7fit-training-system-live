/**
 * POST CARDIO ONLY｜课后自主有氧 selector.
 *
 * F111's post-cardio block used to be prose: `sessions.json` carried a static
 * `postCardio` sentence, the member copy hardcoded one sentence
 * (`js/session-copy.js`) and the coach copy hardcoded three different lines
 * (`js/coach-copy.js`). The venue already ships the two machines as data
 * (`venue_treadmill_zone2` / `venue_stair_zone2`, route `POST_CARDIO_ONLY`), and
 * nothing in `js/` consumed that route.
 *
 * This module turns the block into a choice — 器械 / 时长 / 平均心率 — and gives
 * every copy path one source, so the two formatters can no longer drift.
 *
 * The defaults deliberately reproduce the wording that shipped before, so
 * existing copy assertions keep holding while the values become selectable.
 */
(function(){
  'use strict';
  const M=window.V14CoachModules=window.V14CoachModules||{},C=M.Common;
  const {esc,D}=C;

  /** Storage is per session key; the block is independent of the 60-minute template. */
  const STORAGE_KEY='7fit.postCardio.v1';
  const MIN_MINUTES=10,MAX_MINUTES=90;
  const MIN_HEART_RATE=90,MAX_HEART_RATE=180;
  const MINUTE_CHOICES=[20,25,30,35,40,45];
  const HEART_RATE_CHOICES=[[120,130],[130,140],[140,150],[150,160]];
  const DEFAULT_EQUIPMENT='venue_treadmill_zone2';
  const DEFAULT_MINUTES=30,DEFAULT_HEART_RATE=[130,140];

  /**
   * Equipment choices. The two machines come from the venue's POST_CARDIO_ONLY
   * actions; 其他有氧 stays because the copy has always promised it and some
   * members walk outdoors instead.
   */
  const OTHER_EQUIPMENT=Object.freeze({actionId:'post_cardio_other',label:'其他有氧',detail:'快走 / 户外 / 其他器械'});

  function equipmentOptions(){
    const actions=D().actions||{};
    const fromData=Object.entries(actions)
      .filter(([,action])=>action?.route==='POST_CARDIO_ONLY'&&action.status==='可自动编排')
      .map(([actionId,action])=>({
        actionId,
        // 「跑步机课后自主有氧」 → 「跑步机」
        label:String(action.equipment||action.name||actionId).replace(/课后自主有氧$/,'').trim()||action.name,
        detail:action.name||'',
      }));
    return [...fromData,{...OTHER_EQUIPMENT}];
  }

  function findEquipment(actionId){
    return equipmentOptions().find(option=>option.actionId===actionId)||null;
  }

  function clampInt(value,min,max,fallback){
    const number=Math.round(Number(value));
    if(!Number.isFinite(number))return fallback;
    return Math.min(max,Math.max(min,number));
  }

  function normalizePlan(raw={}){
    const equipment=findEquipment(String(raw.actionId||raw.equipment||''))||findEquipment(DEFAULT_EQUIPMENT)||equipmentOptions()[0];
    const pair=Array.isArray(raw.heartRate)?raw.heartRate:[raw.heartRateMin,raw.heartRateMax];
    const low=clampInt(pair[0],MIN_HEART_RATE,MAX_HEART_RATE,DEFAULT_HEART_RATE[0]);
    const high=clampInt(pair[1],MIN_HEART_RATE,MAX_HEART_RATE,DEFAULT_HEART_RATE[1]);
    return {
      actionId:equipment?equipment.actionId:'',
      equipment:equipment?equipment.label:'',
      detail:equipment?equipment.detail:'',
      minutes:clampInt(raw.minutes,MIN_MINUTES,MAX_MINUTES,DEFAULT_MINUTES),
      heartRateMin:Math.min(low,high),
      heartRateMax:Math.max(low,high),
    };
  }

  // --- storage (falls back to memory when localStorage is unavailable) --------
  let memory=Object.create(null);
  function storage(){
    try{
      const candidate=window.localStorage;
      if(candidate&&typeof candidate.getItem==='function')return candidate;
    }catch(_){/* opaque origin or disabled storage */}
    return null;
  }
  function readAll(){
    const store=storage();
    if(!store)return {...memory};
    try{return JSON.parse(store.getItem(STORAGE_KEY)||'{}')||{};}catch(_){return {};}
  }
  function writeAll(next){
    const store=storage();
    if(!store){memory={...next};return;}
    try{store.setItem(STORAGE_KEY,JSON.stringify(next));}catch(_){memory={...next};}
  }

  /** The member's post-cardio plan for one session. */
  function plan(sessionKey){
    const all=readAll(),raw=all[String(sessionKey||'')];
    return normalizePlan(raw||{});
  }

  /** Patch one field of the plan and persist it. */
  function setSelection(sessionKey,{actionId,minutes,heartRateMin,heartRateMax}={}){
    const key=String(sessionKey||'');
    const current=plan(key);
    const next=normalizePlan({
      actionId:actionId||current.actionId,
      minutes:minutes===undefined?current.minutes:minutes,
      heartRate:[heartRateMin===undefined?current.heartRateMin:heartRateMin,heartRateMax===undefined?current.heartRateMax:heartRateMax],
    });
    const all=readAll();
    all[key]=next;
    writeAll(all);
    return next;
  }

  function reset(sessionKey){
    const all=readAll();
    delete all[String(sessionKey||'')];
    writeAll(all);
    return plan(sessionKey);
  }

  // --- copy: one source for both formatters ---------------------------------
  /** Coach-copy lines, e.g. ['课后有氧｜约 30 分钟','器械：跑步机','平均心率：130–140 bpm 左右（燃烧脂肪心率）']. */
  function copyLines(sessionKeyOrPlan){
    const p=typeof sessionKeyOrPlan==='string'?plan(sessionKeyOrPlan):normalizePlan(sessionKeyOrPlan||{});
    return [
      `课后有氧｜约 ${p.minutes} 分钟`,
      `器械：${p.equipment}`,
      `平均心率：${p.heartRateMin}–${p.heartRateMax} bpm 左右（燃烧脂肪心率）`,
    ];
  }

  /** Member-facing sentence; keeps the tail the previous hardcoded copy promised. */
  function memberText(sessionKeyOrPlan){
    const p=typeof sessionKeyOrPlan==='string'?plan(sessionKeyOrPlan):normalizePlan(sessionKeyOrPlan||{});
    return `选择${p.equipment}，时间 ${p.minutes} 分钟左右，平均心率 ${p.heartRateMin} 到 ${p.heartRateMax} 左右（燃烧脂肪心率）。`;
  }

  function summary(sessionKeyOrPlan){
    const p=typeof sessionKeyOrPlan==='string'?plan(sessionKeyOrPlan):normalizePlan(sessionKeyOrPlan||{});
    return `${p.equipment} · 约 ${p.minutes} 分钟 · 平均心率 ${p.heartRateMin}–${p.heartRateMax} bpm`;
  }

  function optionTag(options,current,valueOf,labelOf){
    return options.map(option=>{
      const value=String(valueOf(option));
      return `<option value="${esc(value)}" ${value===String(current)?'selected':''}>${esc(labelOf(option))}</option>`;
    }).join('');
  }

  /**
   * The block. Carries the POST CARDIO ONLY heading so the existing assertions
   * that look for that label keep working.
   */
  function render(sessionKey){
    const key=String(sessionKey||'');
    const p=plan(key),equipment=equipmentOptions();
    const copy=window.V14ModuleCopy
      ?(window.V14ModuleCopy.register(`post-cardio-${key}`,'knowledge',{title:`课后有氧｜${key}`,lines:copyLines(p)}),window.V14ModuleCopy.button(`post-cardio-${key}`,'复制本模块'))
      :'';
    return `<section class="section-card post-cardio-section" data-post-cardio="${esc(key)}"><div class="section-head"><div><h2>POST CARDIO ONLY｜课后自主有氧</h2><p>不计入 F111 的 60 分钟力量模板；按会员独立有氧处方执行。</p></div><span class="time-badge">约 ${p.minutes} 分钟</span></div><div class="post-cardio-controls"><label class="post-cardio-field"><span>器械</span><select class="post-cardio-equipment" data-post-cardio-equipment="${esc(key)}">${optionTag(equipment,p.actionId,option=>option.actionId,option=>option.label)}</select></label><label class="post-cardio-field"><span>时长</span><select class="post-cardio-minutes" data-post-cardio-minutes="${esc(key)}">${optionTag(MINUTE_CHOICES,p.minutes,value=>value,value=>`约 ${value} 分钟`)}</select></label><label class="post-cardio-field"><span>平均心率</span><select class="post-cardio-heart-rate" data-post-cardio-heart-rate="${esc(key)}">${optionTag(HEART_RATE_CHOICES,`${p.heartRateMin}-${p.heartRateMax}`,pair=>`${pair[0]}-${pair[1]}`,pair=>`${pair[0]}–${pair[1]} bpm`)}</select></label>${copy}</div><p class="post-cardio-summary">${esc(summary(p))}</p></section>`;
  }

  M.PostCardio={equipmentOptions,plan,setSelection,reset,copyLines,memberText,summary,render,STORAGE_KEY};
})();

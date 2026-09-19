(function(){
  'use strict';

  const EQUIPMENT_CLASS_LABELS={
    fixed_machine:'固定器械',
    cable_station:'绳索 / 龙门架辅助',
    free_weight:'自由重量',
    bodyweight:'自重',
    other:'其他',
    unknown:'待补齐'
  };
  const EQUIPMENT_CLASSES=new Set(Object.keys(EQUIPMENT_CLASS_LABELS));
  const DETAIL_FIELDS=['训练目标','教练口令','执行步骤','常见错误','禁忌 / 限制'];
  const CONFIG={
    upper:{
      key:'upper',
      moduleId:'aux-upper',
      title:'11｜上肢辅助动作',
      eyebrow:'D2｜上肢辅助',
      sourceLabel:'composer.auxiliaryRules.upper',
      intro:'从 Composer D2 上肢辅助规则实时汇总动作；同一动作只展示一次，并保留它命中的全部上肢动作池。',
      poolKeys:['horizontal_pull','vertical_pull','horizontal_push','vertical_push'],
      poolLabels:{horizontal_pull:'水平拉',vertical_pull:'垂直拉',horizontal_push:'水平推',vertical_push:'垂直推'}
    },
    lower:{
      key:'lower',
      moduleId:'aux-lower',
      title:'12｜下肢辅助与容量动作',
      eyebrow:'D1 / Body｜下肢辅助',
      sourceLabel:'V15LowerAssistance / bodyActionMeta',
      intro:'统一展示 7Fit 已审计的下肢辅助与容量动作；固定器械只是器械筛选，不再是体系边界。',
      poolKeys:['squat','hinge','hip_extension','single_leg_squat','single_leg_hinge'],
      poolLabels:{squat:'蹲来源',hinge:'髋铰链来源',hip_extension:'髋伸来源',single_leg_squat:'单腿蹲来源',single_leg_hinge:'单腿拉来源'}
    }
  };

  const D=()=>window.V14_DATA||{};

  function configFor(side){return CONFIG[side]||null;}

  function normalizeEquipmentClass(value){
    const key=typeof value==='string'?value.trim():'';
    return EQUIPMENT_CLASSES.has(key)&&key!=='unknown'?key:'unknown';
  }

  function detailState(actionId,data){
    const record=data.actionDetails?.[actionId];
    const fields=record&&record.fields&&typeof record.fields==='object'?record.fields:{};
    const missing=DETAIL_FIELDS.filter(key=>!String(fields[key]??'').trim());
    return {
      exists:Boolean(record),
      complete:Boolean(record)&&missing.length===0,
      missing,
      fields
    };
  }

  function catalog(side){
    const cfg=configFor(side);
    if(!cfg)return {side:null,entries:[],total:0,classCounts:{},missingRefs:[],poolKeys:[],poolLabels:{}};
    const data=D();
    if(side==='lower'&&window.V15LowerAssistance?.catalog){
      const domain=window.V15LowerAssistance.catalog();
      const entries=(domain.entries||[]).map(entry=>({
        ...entry,
        sourcePools:[...(entry.sourcePools||[])],
        sourcePoolKeys:[...(entry.sourcePoolKeys||[])],
        detailState:detailState(entry.id,data),
      }));
      return {
        ...cfg,
        ...domain,
        title:cfg.title,
        moduleId:cfg.moduleId,
        eyebrow:cfg.eyebrow,
        intro:cfg.intro,
        sourceLabel:cfg.sourceLabel,
        entries,
        missingRefs:[],
        poolKeys:cfg.poolKeys,
        poolLabels:cfg.poolLabels,
        equipmentClassLabels:EQUIPMENT_CLASS_LABELS,
        detailFields:DETAIL_FIELDS,
      };
    }
    const rules=data.composer?.auxiliaryRules?.[side]||{};
    const actions=data.actions||{};
    const entriesById=new Map();
    const missingRefs=[];

    cfg.poolKeys.forEach(poolKey=>{
      const ids=Array.isArray(rules[poolKey])?rules[poolKey]:[];
      ids.forEach((actionId,index)=>{
        if(typeof actionId!=='string'||!actionId.trim())return;
        const action=actions[actionId];
        if(!action){missingRefs.push({id:actionId,poolKey,index});return;}
        let entry=entriesById.get(actionId);
        if(!entry){
          entry={id:actionId,action,sourcePools:[]};
          entriesById.set(actionId,entry);
        }
        if(!entry.sourcePools.some(pool=>pool.key===poolKey)){
          entry.sourcePools.push({
            key:poolKey,
            label:cfg.poolLabels[poolKey]||poolKey,
            index
          });
        }
      });
    });

    const classCounts={};
    const entries=[...entriesById.values()].map(entry=>{
      const equipmentClass=normalizeEquipmentClass(entry.action.equipmentClass);
      classCounts[equipmentClass]=(classCounts[equipmentClass]||0)+1;
      return {
        ...entry,
        equipmentClass,
        detailState:detailState(entry.id,data),
        sourcePoolKeys:entry.sourcePools.map(pool=>pool.key)
      };
    });
    return {
      ...cfg,
      entries,
      total:entries.length,
      classCounts,
      missingRefs,
      equipmentClassLabels:EQUIPMENT_CLASS_LABELS,
      detailFields:DETAIL_FIELDS
    };
  }

  function equipmentClassLabel(value){
    return EQUIPMENT_CLASS_LABELS[normalizeEquipmentClass(value)];
  }

  function sourcePoolLabel(side,poolKey){
    const cfg=configFor(side);
    return cfg?.poolLabels?.[poolKey]||poolKey||'—';
  }

  window.V14AuxiliaryModules={
    configs:CONFIG,
    detailFields:DETAIL_FIELDS,
    equipmentClassLabels:EQUIPMENT_CLASS_LABELS,
    equipmentClassLabel,
    normalizeEquipmentClass,
    sourcePoolLabel,
    catalog
  };
})();

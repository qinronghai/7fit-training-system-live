(function(){
  const DOMAIN_DEFS={
    actions:{label:'Actions / 动作',get:()=>window.V14_DATA?.actions||{}},
    actionDetails:{label:'Action Details / 动作详情',get:()=>window.V14_DATA?.actionDetails||{}},
    sessions:{label:'Sessions / 课程',get:()=>window.V14_DATA?.sessions||{}},
    bodyFamilies:{label:'Body Families / Body 模式',get:()=>window.V14_DATA?.bodyFamilies||{}},
    conditioningFamilies:{label:'Conditioning Families / 体能模式',get:()=>window.V14_DATA?.conditioningFamilies||{}},
    conditioningProtocols:{label:'Conditioning Protocols / 体能协议',get:()=>window.V14_DATA?.conditioningProtocols||{}},
    hyroxSessionTypes:{label:'HYROX Session Types / 课程类型',get:()=>window.V14_DATA?.hyroxSessionTypes||{}},
    hyroxStations:{label:'HYROX Stations / 站点',get:()=>window.V14_DATA?.hyroxStations||{}},
    hyroxBenchmarkProtocols:{label:'HYROX Benchmarks / 基准协议',get:()=>window.V14_DATA?.hyroxBenchmarkProtocols||{}},
    support:{label:'SUPPORT / 支撑',get:()=>window.V14_DATA?.supportDetails||{}},
    core:{label:'CORE / 核心',get:()=>window.V14_DATA?.coreDetails||{}},
    prep:{label:'PREP / 热身',get:()=>window.V14_DATA?.warmupDetails||{}},
    foam:{label:'FOAM / 泡沫轴',get:()=>window.V14_DATA?.foamRollDetails||{}},
    templates:{label:'Templates / 模板',get:()=>window.V14_DATA?.templateRegistry||{}},
    anatomy:{label:'Anatomy / 解剖',get:()=>window.V14_ANATOMY?.records||{}}
  };
  const STATUS_LABELS={reviewed:'已审核',pending:'待审核',experimental:'实验性'};
  const EVIDENCE_LABELS={internal_curated:'内部整理',source_referenced:'已标记来源',not_assessed:'未评估'};
  const contract=()=>window.V14_DATA?.contentReview||{};
  const configuredDomains=()=>Array.isArray(contract().requiredDomains)&&contract().requiredDomains.length
    ? contract().requiredDomains.filter(id=>DOMAIN_DEFS[id])
    : Object.keys(DOMAIN_DEFS);
  function titleOf(domain,id,record){
    if(typeof record==='string')return record;
    if(!record||typeof record!=='object')return id;
    return record.name||record.title||record.label||record.displayName||record.familyName||record.protocolName||record.typeName||id;
  }
  function records(domain){
    const source=DOMAIN_DEFS[domain]?.get()||{};
    if(Array.isArray(source))return source.map((record,index)=>({id:String(record?.id||index),record}));
    return Object.entries(source).map(([id,record])=>({id,record}));
  }
  function metadata(domain,id){
    const defaults=contract().domainDefaults?.[domain]||{};
    const override=contract().overrides?.[domain]?.[id]||{};
    return Object.assign({},defaults,override);
  }
  function list(filters={}){
    const domains=filters.domain&&DOMAIN_DEFS[filters.domain]?[filters.domain]:configuredDomains();
    return domains.flatMap(domain=>records(domain).map(({id,record})=>({
      domain,
      domainLabel:DOMAIN_DEFS[domain].label,
      id,
      title:titleOf(domain,id,record),
      record,
      metadata:metadata(domain,id),
    }))).filter(row=>{
      if(filters.status&&row.metadata.reviewStatus!==filters.status)return false;
      if(filters.evidenceLevel&&row.metadata.evidenceLevel!==filters.evidenceLevel)return false;
      return true;
    });
  }
  function resolve(domain,id){
    const row=list({domain}).find(item=>item.id===id);
    return row?row.metadata:null;
  }
  function summary(){
    const rows=list();
    const out={total:rows.length,reviewed:0,pending:0,experimental:0,internal_curated:0,source_referenced:0,not_assessed:0};
    rows.forEach(row=>{
      if(Object.prototype.hasOwnProperty.call(out,row.metadata.reviewStatus))out[row.metadata.reviewStatus]+=1;
      if(Object.prototype.hasOwnProperty.call(out,row.metadata.evidenceLevel))out[row.metadata.evidenceLevel]+=1;
    });
    return out;
  }
  window.V14ContentReview={
    contract,
    domains:()=>configuredDomains().map(id=>({id,label:DOMAIN_DEFS[id].label})),
    statuses:()=>Object.entries(STATUS_LABELS).map(([id,label])=>({id,label})),
    evidenceLevels:()=>Object.entries(EVIDENCE_LABELS).map(([id,label])=>({id,label})),
    labels:{status:STATUS_LABELS,evidence:EVIDENCE_LABELS},
    list,
    resolve,
    summary,
  };
})();

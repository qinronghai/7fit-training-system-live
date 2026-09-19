(function(){
  'use strict';

  const M=window.V14CoachModules=window.V14CoachModules||{};
  const D=()=>window.V14_DATA||{};
  const LEVELS=Object.freeze(['L1','L2','L3','L4']);
  const DEFAULT_SESSION_MINUTES=60;
  const LOWER_BROWSER_LABELS=Object.freeze({
    squat:'下肢推',
    hinge:'髋铰链',
    hip_extension:'髋伸',
    single_leg_squat:'单腿',
    single_leg_hinge:'单腿',
  });

  const clean=value=>String(value??'').trim();
  const unique=values=>[...new Set((Array.isArray(values)?values:[]).map(clean).filter(Boolean))];
  const keyOf=(recipeId,level)=>`${recipeId}:${level}`;

  function fail(code,message,details={}){
    const error=new Error(message);
    error.code=code;
    Object.assign(error,details);
    throw error;
  }

  function canonicalHref(recipeId,level){
    return `#/coach/f111/${String(recipeId||'').toLowerCase()}/${String(level||'').toLowerCase()}`;
  }

  function recipeModes(recipeId){
    const data=D(),pair=data.composer?.officialPresetMap?.[recipeId];
    if(!Array.isArray(pair)||pair.length!==2)return {lowerMode:'',upperMode:''};
    return {lowerMode:pair[0],upperMode:pair[1]};
  }

  function recipeDescriptor(recipeId){
    const data=D(),recipe=data.recipes?.[recipeId];
    if(!recipe)fail('F111_BROWSER_RECIPE_MISSING',`Unknown F111 recipe: ${recipeId}`,{recipeId});
    const {lowerMode,upperMode}=recipeModes(recipeId);
    const lowerMeta=data.composer?.lowerModes?.[lowerMode]||{};
    const upperMeta=data.composer?.upperModes?.[upperMode]||{};
    const lower=LOWER_BROWSER_LABELS[lowerMode]||clean(recipe.lower)||clean(lowerMeta.name);
    const upper=clean(upperMeta.name)||clean(recipe.upper);
    const support=clean(recipe.support)||'支撑';
    const label=clean(recipe.name).replace(/\s*\+\s*/g,'｜')||[lower,upper,support].filter(Boolean).join('｜');
    return {
      recipeId,
      recipeName:clean(recipe.name)||recipeId,
      label,
      patterns:{lower,upper,support},
      modeIds:{lower:lowerMode,upper:upperMode},
    };
  }

  function presetState(recipeId,level){
    if(!LEVELS.includes(level))fail('F111_BROWSER_LEVEL_INVALID',`Invalid F111 browser level: ${level}`,{level});
    const data=D(),recipe=recipeDescriptor(recipeId),sessionId=`${recipeId}-${level}`;
    if(!data.sessions?.[sessionId])fail('F111_BROWSER_SESSION_MISSING',`Missing F111 preset session: ${sessionId}`,{sessionId});
    const searchTokens=unique([
      recipeId,level,recipe.recipeName,recipe.label,
      recipe.patterns.lower,recipe.patterns.upper,recipe.patterns.support,
      recipe.modeIds.lower,recipe.modeIds.upper,
      'F111','女性综合 1+1+1','推荐预设',
    ]);
    return Object.freeze({
      key:keyOf(recipeId,level),
      recipeId,
      level,
      recipeName:recipe.recipeName,
      label:recipe.label,
      patterns:Object.freeze({...recipe.patterns}),
      modeIds:Object.freeze({...recipe.modeIds}),
      searchTokens:Object.freeze(searchTokens),
      href:canonicalHref(recipeId,level),
      facets:Object.freeze({
        level,
        lower:recipe.patterns.lower,
        upper:recipe.patterns.upper,
        support:recipe.patterns.support,
      }),
    });
  }

  function buildIndex(){
    const data=D(),recipeIds=Array.isArray(data.recipeIds)?data.recipeIds:[];
    return recipeIds.flatMap(recipeId=>LEVELS.map(level=>presetState(recipeId,level)));
  }

  function recipeRows(){
    const data=D(),recipeIds=Array.isArray(data.recipeIds)?data.recipeIds:[];
    return recipeIds.map(recipeId=>{
      const recipe=recipeDescriptor(recipeId);
      return Object.freeze({
        ...recipe,
        states:Object.freeze(LEVELS.map(level=>presetState(recipeId,level))),
      });
    });
  }

  function find(recipeId,level){
    if(!D().recipes?.[recipeId]||!LEVELS.includes(level))return null;
    if(!D().sessions?.[`${recipeId}-${level}`])return null;
    return presetState(recipeId,level);
  }

  function prepPreview(resolved,prepSelections={}){
    const api=window.V14PrepResolver;
    if(!api?.resolve||!resolved?.prepContext)return [];
    const result=api.resolve(resolved.prepContext,{selections:prepSelections||{}});
    return (result?.slots||[]).map(slot=>Object.freeze({
      key:clean(slot.slotKey),
      label:clean(slot.slotName)||clean(slot.name)||clean(slot.slotKey),
      actionId:clean(slot.actionId),
      name:clean(slot.name)||clean(D().actions?.[slot.actionId]?.name)||clean(slot.actionId),
      prescription:clean(slot.prescription),
      source:clean(slot.source),
    }));
  }

  function formalPreview(resolved){
    return (resolved?.main?.content||[]).map(slot=>Object.freeze({
      key:clean(slot.key),
      label:clean(slot.label)||clean(slot.key),
      actionId:clean(slot.actionId),
      name:clean(slot.name)||clean(D().actions?.[slot.actionId]?.name)||clean(slot.actionId),
      prescription:clean(slot.prescription),
      tier:clean(slot.tier),
      grade:clean(slot.grade),
      source:clean(slot.source),
    }));
  }

  function equipmentFor(items){
    const data=D();
    return unique(items.map(item=>data.actions?.[item.actionId]?.equipment||''));
  }

  function resolvePreview(recipeId,level,options={}){
    const preset=find(recipeId,level);
    if(!preset)fail('F111_BROWSER_PRESET_INVALID',`Unknown preset state: ${recipeId} ${level}`,{recipeId,level});
    const resolver=window.V15TemplateResolver;
    if(!resolver?.resolve)fail('F111_BROWSER_RESOLVER_UNAVAILABLE','Template Resolver Dispatcher is unavailable');
    const input={mode:'preset',recipeId,level};
    if(Array.isArray(options.selections))input.selections=options.selections;
    const resolved=resolver.resolve('f111',input);
    const formal=formalPreview(resolved);
    const prep=prepPreview(resolved,options.prepSelections||{});
    return Object.freeze({
      key:preset.key,
      recipeId,
      level,
      title:clean(resolved.title)||`${recipeId}｜${preset.recipeName}`,
      summary:clean(resolved.summary),
      patterns:preset.patterns,
      duration:Object.freeze({
        minutes:DEFAULT_SESSION_MINUTES,
        label:`约 ${DEFAULT_SESSION_MINUTES} 分钟`,
        source:'F111_SESSION_CONTRACT',
      }),
      goals:Object.freeze(unique([preset.patterns.lower,preset.patterns.upper,preset.patterns.support])),
      equipment:Object.freeze(equipmentFor(formal)),
      sections:Object.freeze([
        Object.freeze({key:'PREP',label:'PREP 热身',kind:'PREP',items:Object.freeze(prep)}),
        ...formal.map(item=>Object.freeze({key:item.key,label:item.label,kind:'SLOT',items:Object.freeze([item])})),
      ]),
      conflict:resolved.conflictContext||null,
      source:Object.freeze({type:clean(resolved.source?.type),id:clean(resolved.source?.id)}),
    });
  }

  function facetValues(){
    const index=buildIndex();
    return Object.freeze({
      levels:LEVELS,
      lower:Object.freeze(unique(index.map(x=>x.patterns.lower))),
      upper:Object.freeze(unique(index.map(x=>x.patterns.upper))),
      support:Object.freeze(unique(index.map(x=>x.patterns.support))),
    });
  }

  M.F111PresetBrowser=Object.freeze({
    LEVELS,
    DEFAULT_SESSION_MINUTES,
    buildIndex,
    recipeRows,
    find,
    resolvePreview,
    facetValues,
    canonicalHref,
  });
})();

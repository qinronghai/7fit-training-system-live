/**
 * PROTOCOL → Recovery signal adapter.
 *
 * `V14RecoveryMatcher` scores RECOVERY_2F candidates against the training
 * actions of a session. That works directly for SLOT sessions (F111 1+1+1 and
 * Body) because every slot resolves to an action carrying `pattern` and
 * `loadFamily`.
 *
 * Conditioning and HYROX resolve to `main.kind === 'PROTOCOL'` instead: their
 * work lives in `domainContext.stations`, and the station metadata is not
 * usable as-is —
 *   - Conditioning station actions fill `pattern` with a *modality* name
 *     (稳态 / 间歇) and leave `loadFamily` empty;
 *   - HYROX station ids (HYROX-H1 …) have no entry in the action table at all,
 *     so there is nothing to look up.
 *
 * This module derives each station's recovery-relevant demand and emits it in
 * the exact vocabulary the RECOVERY_2F metadata declares, so the matcher can
 * score a protocol session with no rule changes:
 *   - Conditioning → the station's curated anatomy record (data-derived).
 *   - HYROX        → the canonical station table (the sport's station list is
 *     fixed and ordered H1–H8), with a modality fallback for unknown ids.
 */
(function(){
  'use strict';

  const esc=value=>String(value??'');

  /** Exposure weights: a main mover outranks an assisting muscle. */
  const PRIMARY_WEIGHT=5,SECONDARY_WEIGHT=2;

  /**
   * Muscle keyword → recovery demand. First matching rule wins, so the more
   * specific keywords (三角肌后 before 三角肌, 臀中 before generic) are listed
   * first. Core / stabilizer muscles intentionally match nothing: RECOVERY_2F
   * has no core stretch target, and inventing one would skew region selection.
   */
  const MUSCLE_DEMANDS=Object.freeze([
    {match:['背阔','大圆','斜方','菱形','三角肌后','上背'],patterns:['水平拉','垂直拉'],loadFamilies:['上肢拉']},
    {match:['肱二头','肱肌','肱桡','前臂握力'],patterns:['水平拉','垂直拉'],loadFamilies:['上肢拉']},
    {match:['肩后侧'],patterns:['水平拉','垂直拉','水平推','垂直推'],loadFamilies:['上肢拉','上肢推']},
    {match:['胸大','胸小','胸前侧','胸廓前'],patterns:['水平推','垂直推'],loadFamilies:['上肢推']},
    {match:['三角肌前','三角肌中','三角肌'],patterns:['垂直推','水平推'],loadFamilies:['上肢推']},
    {match:['肱三头'],patterns:['水平推','垂直推'],loadFamilies:['上肢推']},
    {match:['臀大','臀中','臀小','臀肌','臀部深层'],patterns:['髋伸展','蹲','髋外展'],loadFamilies:['后链 / 髋主导','髋稳定']},
    {match:['腘绳'],patterns:['髋铰链','单腿拉','髋伸展'],loadFamilies:['后链 / 髋主导']},
    {match:['股四头','股直','股外侧','阔筋膜张','胫骨前'],patterns:['蹲'],loadFamilies:['膝主导']},
    {match:['内收','股薄'],patterns:['蹲','单腿拉'],loadFamilies:['髋稳定']},
    {match:['髂腰','髋屈'],patterns:['蹲','髋伸展'],loadFamilies:['膝主导']},
    {match:['腓肠','比目鱼','足踝','足内在','小腿'],patterns:['蹲','单腿拉'],loadFamilies:['膝主导']},
  ]);

  /**
   * Canonical HYROX stations. HYROX ships no anatomy records, and the station
   * list is a fixed property of the sport, so the demand is declared here
   * rather than inferred. `label` is only used for diagnostics.
   */
  const HYROX_STATION_DEMANDS=Object.freeze({
    H1:{label:'滑雪机',patterns:['垂直拉','水平拉'],loadFamilies:['上肢拉','后链 / 髋主导']},
    H2:{label:'雪橇推',patterns:['水平推','蹲'],loadFamilies:['上肢推','膝主导']},
    H3:{label:'雪橇拉',patterns:['水平拉'],loadFamilies:['上肢拉','后链 / 髋主导']},
    H4:{label:'波比跳远',patterns:['蹲','水平推'],loadFamilies:['膝主导','上肢推']},
    H5:{label:'划船机',patterns:['水平拉','蹲'],loadFamilies:['上肢拉','膝主导','后链 / 髋主导']},
    H6:{label:'农夫走',patterns:['单腿拉'],loadFamilies:['髋稳定','上肢拉']},
    H7:{label:'负重行进弓步',patterns:['蹲','单腿拉'],loadFamilies:['膝主导','后链 / 髋主导']},
    H8:{label:'墙球',patterns:['蹲','垂直推'],loadFamilies:['膝主导','上肢推']},
  });

  /** Fallback when a station id is outside the canonical H1–H8 list. */
  const HYROX_MODALITY_DEMANDS=Object.freeze({
    ENGINE:{patterns:['垂直拉','水平拉'],loadFamilies:['上肢拉']},
    SLED:{patterns:['水平推','蹲'],loadFamilies:['上肢推','膝主导']},
    LOCOMOTION:{patterns:['蹲','单腿拉'],loadFamilies:['膝主导','后链 / 髋主导']},
    BALL:{patterns:['蹲','垂直推'],loadFamilies:['膝主导','上肢推']},
  });

  function demandsForMuscle(muscle){
    const name=String(muscle||'');
    for(const rule of MUSCLE_DEMANDS){
      if(rule.match.some(keyword=>name.includes(keyword)))return rule;
    }
    return null;
  }

  /**
   * One entry per demand term, so the matcher keeps matching single
   * `pattern` / `loadFamily` strings. Empty terms never match a recovery
   * target, so they are inert.
   */
  function emit(target,demand,weight,source,extra){
    const out=[];
    (demand.patterns||[]).forEach(pattern=>out.push({key:target.key,actionId:target.actionId,pattern,loadFamily:'',weight,source,...extra}));
    (demand.loadFamilies||[]).forEach(loadFamily=>out.push({key:target.key,actionId:target.actionId,pattern:'',loadFamily,weight,source,...extra}));
    return out;
  }

  function anatomySignals(station){
    const record=window.V14Anatomy?.get?.(station.actionId);
    if(!record)return [];
    const out=[];
    (record.primary||[]).forEach(muscle=>{
      const demand=demandsForMuscle(muscle);
      if(demand)out.push(...emit(station,demand,PRIMARY_WEIGHT,'anatomy:primary',{muscle}));
    });
    (record.secondary||[]).forEach(muscle=>{
      const demand=demandsForMuscle(muscle);
      if(demand)out.push(...emit(station,demand,SECONDARY_WEIGHT,'anatomy:secondary',{muscle}));
    });
    return out;
  }

  function hyroxSignals(station){
    const stationId=String(station.stationId||'');
    const demand=HYROX_STATION_DEMANDS[stationId]||HYROX_MODALITY_DEMANDS[String(station.modality||'')];
    if(!demand)return [];
    return emit(station,demand,PRIMARY_WEIGHT,HYROX_STATION_DEMANDS[stationId]?'station-table':'modality-fallback',{});
  }

  function isHyroxStations(stations){
    return stations.some(station=>typeof station?.stationId==='string'&&station.stationId!=='');
  }

  /**
   * Derive recovery signals for a PROTOCOL session.
   * @returns {Array<{key:string,actionId:string,pattern:string,loadFamily:string,weight:number}>}
   *   An empty array means the protocol exposes no recovery-relevant demand, in
   *   which case the matcher reports an explicit coach-arranged fallback.
   */
  function signals(resolvedSession){
    const stations=Object.values(resolvedSession?.domainContext?.stations||{}).filter(Boolean);
    if(!stations.length)return [];
    const derive=isHyroxStations(stations)?hyroxSignals:anatomySignals;
    const out=[];
    stations.forEach(station=>out.push(...derive(station)));
    return out;
  }

  window.V14RecoveryProtocolAdapter={signals,HYROX_STATION_DEMANDS,MUSCLE_DEMANDS,esc};
})();

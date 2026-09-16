/**
 * Recovery region adapter.
 *
 * Recovery follows the coach's rule: look at which major muscle groups the main
 * and accessory work loaded, stretch those, one action per region, about three
 * in total. This module turns a resolved session into exactly that signal — the
 * recovery regions it trained and how hard.
 *
 * Matching on movement patterns was the wrong signal. A 蹲 pattern put 大腿内侧
 * (adductor) on the card for a session that never trained one, and anterior
 * deltoid pressing put 胸 on the card. Both are pattern look-alikes, not loaded
 * muscle groups.
 *
 * Two sources, because the two session shapes expose different data:
 *   - `main.kind === 'SLOT'` (F111 1+1+1, Body) → the session's curated
 *     `anatomyContext`, which already aggregates the muscles its slots loaded.
 *   - `main.kind === 'PROTOCOL'` (Conditioning, HYROX) → per-station data, since
 *     their stations never reach `main.content`:
 *       · Conditioning: the station's curated anatomy record (data-derived).
 *       · HYROX: the canonical station table (the sport's station list is fixed
 *         and ordered H1–H8), with a modality fallback for unknown ids.
 *
 * 小腿后侧 is mapped like every other muscle but this gym recovers it with the
 * foam roller, so V14RecoveryMatcher keeps it off the stretch cards.
 */
(function(){
  'use strict';

  /** Exposure weights: a main mover outranks an assistant, which outranks a stabiliser. */
  const PRIMARY_WEIGHT=5,SECONDARY_WEIGHT=2,STABILIZER_WEIGHT=1;

  /**
   * Muscle keyword → the recovery region that stretches it. First matching rule
   * wins, so specific keywords (三角肌后, 臀中) precede the generic ones that
   * would otherwise swallow them. Core / stabiliser muscles intentionally map to
   * nothing: they have no stretch region, and inventing one would push a
   * genuinely loaded region off the card set.
   */
  const MUSCLE_REGIONS=Object.freeze([
    {match:['背阔','大圆','斜方','菱形','上背'],region:'upper_back'},
    // 三角肌后束 is a shoulder muscle, not a back one — lumping it into upper_back
    // left back-and-shoulder days with only two stretchable regions.
    {match:['三角肌后','肩后侧'],region:'posterior_shoulder'},
    {match:['肱二头','肱肌','肱桡','前臂握力'],region:'upper_back'},
    {match:['胸大','胸小','胸前侧','胸廓前'],region:'chest'},
    {match:['三角肌前','三角肌中','三角肌'],region:'chest'},
    {match:['肱三头'],region:'triceps'},
    {match:['臀大','臀中','臀小','臀肌','臀部深层'],region:'glute'},
    {match:['腘绳'],region:'hamstring'},
    {match:['股四头','股直','股外侧','阔筋膜张','髂腰','髋屈'],region:'hip_flexor'},
    {match:['内收','股薄'],region:'adductor'},
    {match:['腓肠','比目鱼','足踝','足内在','小腿'],region:'calf'},
  ]);

  /**
   * Canonical HYROX stations. HYROX ships no anatomy records and the station
   * list is a fixed property of the sport, so the loaded regions are declared
   * here rather than inferred. The first region is the station's main driver.
   * `label` is only used for diagnostics.
   */
  const HYROX_STATION_REGIONS=Object.freeze({
    H1:{label:'滑雪机',regions:['upper_back','glute','hip_flexor']},
    H2:{label:'雪橇推',regions:['hip_flexor','glute','chest']},
    H3:{label:'雪橇拉',regions:['upper_back','glute','hamstring']},
    H4:{label:'波比跳远',regions:['glute','hip_flexor','chest']},
    H5:{label:'划船机',regions:['upper_back','glute','hip_flexor']},
    H6:{label:'农夫走',regions:['upper_back','glute']},
    H7:{label:'负重行进弓步',regions:['glute','hip_flexor']},
    H8:{label:'墙球',regions:['hip_flexor','glute','chest']},
  });

  /** Fallback when a station id is outside the canonical H1–H8 list. */
  const HYROX_MODALITY_REGIONS=Object.freeze({
    ENGINE:{regions:['upper_back','glute']},
    SLED:{regions:['hip_flexor','glute','chest']},
    LOCOMOTION:{regions:['glute','hip_flexor']},
    BALL:{regions:['hip_flexor','glute','chest']},
  });

  function regionForMuscle(muscle){
    const name=String(muscle||'');
    for(const rule of MUSCLE_REGIONS){
      if(rule.match.some(keyword=>name.includes(keyword)))return rule.region;
    }
    return null;
  }

  /**
   * One entry per loaded region. `pattern` / `loadFamily` stay empty so the
   * matcher's slot-key contract is untouched — these entries are matched on
   * `region`, which is exactly the signal the coach's rule needs.
   */
  function emit(key,actionId,region,weight,source,extra){
    return {key,actionId,region,weight,source,pattern:'',loadFamily:'',...extra};
  }

  /** Region signals from an aggregated anatomy context (SLOT sessions). */
  function anatomyContextSignals(context){
    if(!context)return [];
    const out=[];
    const push=(muscles,weight,tier)=>{
      (muscles||[]).forEach(muscle=>{
        const region=regionForMuscle(muscle);
        if(region)out.push(emit('anatomy',`anatomy:${region}`,region,weight,tier,{muscle}));
      });
    };
    push(context.primary,PRIMARY_WEIGHT,'anatomy:primary');
    push(context.secondary,SECONDARY_WEIGHT,'anatomy:secondary');
    push(context.stabilizers,STABILIZER_WEIGHT,'anatomy:stabilizer');
    return out;
  }

  /** Region signals from a Conditioning station's own anatomy record. */
  function stationAnatomySignals(station){
    const record=window.V14Anatomy?.get?.(station.actionId);
    if(!record)return [];
    const out=[];
    const push=(muscles,weight,tier)=>{
      (muscles||[]).forEach(muscle=>{
        const region=regionForMuscle(muscle);
        if(region)out.push(emit(station.key,station.actionId,region,weight,tier,{muscle}));
      });
    };
    push(record.primary,PRIMARY_WEIGHT,'anatomy:primary');
    push(record.secondary,SECONDARY_WEIGHT,'anatomy:secondary');
    return out;
  }

  function hyroxStationSignals(station){
    const stationId=String(station.stationId||'');
    const table=HYROX_STATION_REGIONS[stationId];
    const demand=table||HYROX_MODALITY_REGIONS[String(station.modality||'')];
    if(!demand)return [];
    return demand.regions.map((region,index)=>
      emit(station.key,station.actionId,region,index===0?PRIMARY_WEIGHT:SECONDARY_WEIGHT,table?'station-table':'modality-fallback',{}));
  }

  function protocolSignals(resolvedSession){
    const stations=Object.values(resolvedSession?.domainContext?.stations||{}).filter(Boolean);
    if(!stations.length)return [];
    const isHyrox=stations.some(station=>typeof station?.stationId==='string'&&station.stationId!=='');
    const out=[];
    stations.forEach(station=>out.push(...(isHyrox?hyroxStationSignals(station):stationAnatomySignals(station))));
    return out;
  }

  /**
   * Derive the recovery regions a session loaded.
   * @returns {Array<{region:string,weight:number,muscle?:string}>}
   *   An empty array means the session exposes no recoverable muscle group, in
   *   which case the matcher reports an explicit coach-arranged fallback.
   */
  function signals(resolvedSession){
    if(!resolvedSession)return [];
    if(resolvedSession.main?.kind==='PROTOCOL')return protocolSignals(resolvedSession);
    return anatomyContextSignals(resolvedSession.anatomyContext);
  }

  /** Total exposure per region, e.g. `{glute:27,hip_flexor:22}`. */
  function exposureByRegion(resolvedSession){
    const totals={};
    signals(resolvedSession).forEach(signal=>{totals[signal.region]=(totals[signal.region]||0)+signal.weight;});
    return totals;
  }

  window.V14RecoveryProtocolAdapter={signals,exposureByRegion,HYROX_STATION_REGIONS,MUSCLE_REGIONS};
})();

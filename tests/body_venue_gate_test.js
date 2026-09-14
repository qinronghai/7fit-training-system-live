const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=process.cwd();
global.window=global;

function load(file){vm.runInThisContext(fs.readFileSync(`${root}/${file}`,'utf8'),{filename:file});}
for(const file of [
  'data/system-data.js','data/anatomy-data.js','js/prep-grade.js','js/anatomy.js','js/prep-resolver.js',
  'js/resolved-session.js','js/body-volume.js','js/conflict-core.js','js/conflict-service.js','js/conflict-plugins/body.js',
  'js/template-resolver.js','js/resolvers/body.js'
]) load(file);

const D=window.V14_DATA,Body=window.V15BodyResolver,Resolver=window.V15TemplateResolver;
assert(D.venueCapabilityPolicy,'Venue Capability policy must be part of the runtime data contract');
assert.strictEqual(D.venueCapabilityPolicy.policyVersion,'venue-v1');
assert.strictEqual(typeof Body.assessVenueEligibility,'function');

const hackL1=Body.assessVenueEligibility({familyId:'BODY-01',level:'L1',slotKey:'PRIMARY',actionId:'hake_shendun'});
assert.strictEqual(hackL1.ok,false,'L1 must reject the reported Hack minimum load');
assert(hackL1.reasons.includes('BODY_VENUE_MIN_LOAD_EXCEEDS_LEVEL'));
assert.strictEqual(hackL1.minimumSystemLoadKg,20);
assert(hackL1.levelCeilingKg<20);
assert.strictEqual(hackL1.overrideAllowed,true);
assert.strictEqual(hackL1.fallbackActionGroup,'BODY-01-KNEE');

const hackL2=Body.assessVenueEligibility({familyId:'BODY-01',level:'L2',slotKey:'PRIMARY',actionId:'hake_shendun'});
assert.strictEqual(hackL2.ok,false,'L2 must reject the reported Hack minimum load');
const hackL3=Body.assessVenueEligibility({familyId:'BODY-01',level:'L3',slotKey:'PRIMARY',actionId:'hake_shendun'});
assert.strictEqual(hackL3.ok,true,'L3 must be capable of the reported Hack minimum load');
const hackL4=Body.assessVenueEligibility({familyId:'BODY-01',level:'L4',slotKey:'PRIMARY',actionId:'hake_shendun'});
assert.strictEqual(hackL4.ok,true,'L4 must be capable of the reported Hack minimum load');

const trapL2=Body.assessVenueEligibility({familyId:'BODY-02',level:'L2',slotKey:'PRIMARY',actionId:'liujiao_gantui_yingla'});
assert.strictEqual(trapL2.ok,false,'L2 must reject the reported Trap Bar minimum load');
assert(trapL2.reasons.includes('BODY_VENUE_MIN_LOAD_EXCEEDS_LEVEL'));
const trapL3=Body.assessVenueEligibility({familyId:'BODY-02',level:'L3',slotKey:'PRIMARY',actionId:'liujiao_gantui_yingla'});
assert.strictEqual(trapL3.ok,true,'L3 must be capable of the reported Trap Bar minimum load');

const unknown=Body.assessVenueEligibility({familyId:'BODY-02',level:'L2',slotKey:'PRIMARY',actionId:'yaling_luomaniya_yingla'});
assert.strictEqual(unknown.ok,true,'Missing venue metadata must not invent a blocking load');
assert.strictEqual(unknown.status,'UNVERIFIED');
assert(unknown.reasons.includes('BODY_VENUE_METADATA_UNVERIFIED'));
assert.strictEqual(unknown.minimumSystemLoadKg,null);

const machineUnknown=Body.assessVenueEligibility({familyId:'BODY-02',level:'L2',slotKey:'PRIMARY',actionId:'tun_tui'});
assert.strictEqual(machineUnknown.ok,true);
assert.strictEqual(machineUnknown.status,'UNVERIFIED');
assert.strictEqual(machineUnknown.minimumSystemLoadKg,null);
assert.strictEqual(machineUnknown.minimumExternalLoadKg,null);

const l2HackCandidates=Body.candidates({familyId:'BODY-01',level:'L2',slotKey:'PRIMARY',includeVenueBlocked:true});
assert(!l2HackCandidates.candidates.some(item=>item.actionId==='hake_shendun'),'Venue-gated Hack must not be a normal L2 candidate');
assert(l2HackCandidates.blockedCandidates.some(item=>item.actionId==='hake_shendun'),'Coach must be able to inspect a venue-gated candidate');
const l3Candidates=Body.candidates({familyId:'BODY-01',level:'L3',slotKey:'PRIMARY'});
assert(l3Candidates.candidates.some(item=>item.actionId==='hake_shendun'),'Hack must remain available at L3');

const fallback=Resolver.resolve('body',{familyId:'BODY-01',level:'L2',selections:{
  PRIMARY:{actionId:'hake_shendun',source:'manual'},
}});
assert.notStrictEqual(fallback.main.content.find(item=>item.key==='PRIMARY').actionId,'hake_shendun');
assert(fallback.warnings.includes('BODY_VENUE_GATE_FALLBACK:PRIMARY'));
assert.strictEqual(fallback.domainContext.venue.slots.PRIMARY.status,'FALLBACK');
assert.strictEqual(fallback.domainContext.venue.slots.PRIMARY.requestedActionId,'hake_shendun');

const trapFallback=Resolver.resolve('body',{familyId:'BODY-02',level:'L2',selections:{
  PRIMARY:{actionId:'liujiao_gantui_yingla',source:'manual'},
}});
assert.strictEqual(trapFallback.main.content.find(item=>item.key==='PRIMARY').actionId,'yaling_luomaniya_yingla','L2 Trap Bar must fall back to the adjustable dumbbell RDL');
assert(trapFallback.warnings.includes('BODY_VENUE_GATE_FALLBACK:PRIMARY'));

const shortOverride=Resolver.resolve('body',{familyId:'BODY-01',level:'L2',selections:{
  PRIMARY:{actionId:'hake_shendun',source:'manual',venueOverrideReason:'可以'},
}});
assert.notStrictEqual(shortOverride.main.content.find(item=>item.key==='PRIMARY').actionId,'hake_shendun');
assert(shortOverride.warnings.includes('BODY_VENUE_OVERRIDE_REASON_REQUIRED:PRIMARY'));

const overrideReason='教练已现场确认会员具备当前器械负荷能力';
const overridden=Resolver.resolve('body',{familyId:'BODY-01',level:'L2',selections:{
  PRIMARY:{actionId:'hake_shendun',source:'manual',venueOverrideReason:overrideReason},
}});
const overriddenPrimary=overridden.main.content.find(item=>item.key==='PRIMARY');
assert.strictEqual(overriddenPrimary.actionId,'hake_shendun');
assert.strictEqual(overriddenPrimary.source,'manual');
assert(overridden.warnings.includes('BODY_VENUE_MANUAL_OVERRIDE:PRIMARY'));
assert.strictEqual(overridden.domainContext.venue.slots.PRIMARY.status,'OVERRIDDEN');
assert.strictEqual(overridden.domainContext.venue.slots.PRIMARY.overrideReason,overrideReason);
assert.strictEqual(overridden.domainContext.venue.overrides.length,1);
assert.strictEqual(overridden.domainContext.venue.overrides[0].reason,overrideReason);

const illegalOverride=Resolver.resolve('body',{familyId:'BODY-02',level:'L3',selections:{
  PRIMARY:{actionId:'hake_shendun',source:'manual',venueOverrideReason:overrideReason},
}});
assert.notStrictEqual(illegalOverride.main.content.find(item=>item.key==='PRIMARY').actionId,'hake_shendun','Venue override must not bypass family/slot eligibility');
assert(!illegalOverride.domainContext.venue.overrides.length);

const originalMinimum=D.venueCapabilityPolicy.equipment['eq-hack'].minimumSystemLoadKg;
D.venueCapabilityPolicy.equipment['eq-hack'].minimumSystemLoadKg=100;
const changed=Resolver.resolve('body',{familyId:'BODY-01',level:'L3',selections:{
  PRIMARY:{actionId:'hake_shendun',source:'manual'},
}});
assert.notStrictEqual(changed.main.content.find(item=>item.key==='PRIMARY').actionId,'hake_shendun','Changed venue data must invalidate a stale manual selection');
D.venueCapabilityPolicy.equipment['eq-hack'].minimumSystemLoadKg=originalMinimum;

const originalAvailability=D.venueCapabilityPolicy.equipment['eq-hack'].venueAvailability;
D.venueCapabilityPolicy.equipment['eq-hack'].venueAvailability='UNAVAILABLE';
const unavailableOverride=Body.assessVenueEligibility({familyId:'BODY-01',level:'L2',slotKey:'PRIMARY',actionId:'hake_shendun',overrideReason:overrideReason});
assert.strictEqual(unavailableOverride.ok,false,'Unavailable equipment must remain blocked');
assert.strictEqual(unavailableOverride.overrideAllowed,false,'Manual override must not bypass equipment availability');
D.venueCapabilityPolicy.equipment['eq-hack'].venueAvailability=originalAvailability;

console.log('body_venue_gate_test: #94 Venue Gate runtime GREEN');

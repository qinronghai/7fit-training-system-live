const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=process.cwd();
global.window=global;

function load(file){vm.runInThisContext(fs.readFileSync(`${root}/${file}`,'utf8'),{filename:file});}

for(const file of ['data/system-data.js','js/module-copy.js','js/coach/common.js','js/coach/post-cardio.js'])load(file);
const D=window.V14_DATA,P=window.V14CoachModules.PostCardio;
assert(P&&typeof P.plan==='function','PostCardio must expose plan');
assert(P&&typeof P.render==='function','PostCardio must expose render');

// --- the venue's POST_CARDIO_ONLY machines drive the 器械 options -----------
// Nothing in js/ consumed route===POST_CARDIO_ONLY before this selector.
const dataBacked=Object.entries(D.actions).filter(([,a])=>a.route==='POST_CARDIO_ONLY');
assert.strictEqual(dataBacked.length,2,'the venue must ship two post-cardio machines');
const options=P.equipmentOptions();
for(const [actionId] of dataBacked){
  assert(options.some(option=>option.actionId===actionId),`${actionId} must be offered as a 器械 option`);
}
assert(options.some(option=>option.label==='跑步机'),'跑步机 must be offered');
assert(options.some(option=>option.label==='楼梯机'),'楼梯机 must be offered');
assert(options.some(option=>option.label==='其他有氧'),'快走 / 其他有氧 must stay available');

// --- defaults reproduce the wording that shipped -----------------------------
// The block used to be hardcoded in two places; keeping the defaults identical
// is what lets the existing copy contracts keep holding while values become
// selectable.
const KEY='F111-01-L3';
const fresh=P.plan(KEY);
assert.strictEqual(fresh.minutes,30,'default duration must stay 30 分钟');
assert.strictEqual(fresh.heartRateMin,130,'default heart-rate floor must stay 130');
assert.strictEqual(fresh.heartRateMax,140,'default heart-rate ceiling must stay 140');
assert.strictEqual(fresh.equipment,'跑步机','default equipment must stay 跑步机');
assert.deepStrictEqual(P.copyLines(KEY),[
  '课后有氧｜约 30 分钟',
  '器械：跑步机',
  '平均心率：130–140 bpm 左右（燃烧脂肪心率）',
],'default coach copy must match the shipped wording');
assert(P.memberText(KEY).includes('平均心率 130 到 140 左右（燃烧脂肪心率）'),
  'default member copy must keep the shipped heart-rate sentence');

// --- the three controls persist and drive the copy --------------------------
const chosen=P.setSelection(KEY,{actionId:'venue_stair_zone2',minutes:40,heartRateMin:140,heartRateMax:150});
assert.strictEqual(chosen.equipment,'楼梯机');
assert.strictEqual(chosen.minutes,40);
assert.deepStrictEqual([chosen.heartRateMin,chosen.heartRateMax],[140,150]);
assert.deepStrictEqual(P.copyLines(KEY),[
  '课后有氧｜约 40 分钟',
  '器械：楼梯机',
  '平均心率：140–150 bpm 左右（燃烧脂肪心率）',
],'coach copy must follow the selection');
assert(P.memberText(KEY).includes('选择楼梯机，时间 40 分钟左右'),
  'member copy must follow the selection');
assert(P.summary(KEY).includes('楼梯机')&&P.summary(KEY).includes('40 分钟'));

// Selections are per session key, not global.
assert.strictEqual(P.plan('F111-02-L3').minutes,30,'another session must keep its own plan');

// --- inputs are clamped ------------------------------------------------------
const wild=P.setSelection(KEY,{minutes:9999,heartRateMin:10,heartRateMax:999});
assert.strictEqual(wild.minutes,90,'duration must clamp to the ceiling');
assert.strictEqual(wild.heartRateMin,90,'heart rate must clamp to the floor');
assert.strictEqual(wild.heartRateMax,180,'heart rate must clamp to the ceiling');
// A reversed pair is normalised rather than emitted backwards.
const reversed=P.setSelection(KEY,{heartRateMin:150,heartRateMax:120});
assert.deepStrictEqual([reversed.heartRateMin,reversed.heartRateMax],[120,150],'a reversed range must be ordered');
// An unknown machine falls back instead of blanking the block.
const unknown=P.setSelection(KEY,{actionId:'not-a-real-machine'});
assert(unknown.equipment,'an unknown machine must fall back to a real option');
assert.strictEqual(P.reset(KEY).minutes,30,'reset must restore the defaults');

// --- the block renders the three controls -----------------------------------
const html=P.render(KEY);
assert(html.includes('POST CARDIO ONLY'),'the block must keep its POST CARDIO ONLY heading');
assert(html.includes('data-post-cardio="'+KEY+'"'),'the block must carry its session key');
assert.strictEqual((html.match(/<select/g)||[]).length,3,'the block must render three selects');
assert.strictEqual((html.match(/data-f111-option-drawer/g)||[]).length,3,'the block must render one drawer trigger for each selector');
assert.strictEqual((html.match(/class="post-cardio-option-trigger/g)||[]).length,3,'all post-cardio controls must use consistent drawer buttons');
assert(html.includes('data-post-cardio-equipment="'+KEY+'"'),'equipment select must retain its owning session key');
assert(html.includes('data-post-cardio-minutes="'+KEY+'"'),'duration select must retain its owning session key');
assert(html.includes('data-post-cardio-heart-rate="'+KEY+'"'),'heart-rate select must retain its owning session key');
assert(html.includes('post-cardio-equipment'),'器械 select missing');
assert(html.includes('post-cardio-minutes'),'时长 select missing');
assert(html.includes('post-cardio-heart-rate'),'平均心率 select missing');
assert(html.includes('复制本模块'),'the block must offer a copy button');
assert(html.includes('约 30 分钟'),'the badge must show the selected duration');

// --- both copy formatters read the same plan (they used to hardcode) ---------
const coachCopy=fs.readFileSync(`${root}/js/coach-copy.js`,'utf8');
const memberCopy=fs.readFileSync(`${root}/js/session-copy.js`,'utf8');
assert(coachCopy.includes('copyLines'),'coach copy must use the shared plan');
assert(memberCopy.includes('memberText'),'member copy must use the shared plan');
assert(!/跑步机爬坡 \/ 楼梯机 \/ 快走 \/ 其他有氧/.test(coachCopy),'coach copy must not keep the hardcoded option list');

// --- the two F111 surfaces render the selector ------------------------------
for(const file of ['js/coach/session.js','js/coach/composer-view.js']){
  const source=fs.readFileSync(`${root}/${file}`,'utf8');
  assert(source.includes('PostCardio.render'),`${file} must render the selector`);
  assert(source.includes('postCardioPlan'),`${file} must ship the structured plan into copy`);
  assert(!source.includes('class="post-cardio-note"'),`${file} must not keep the static post-cardio note`);
}
const bindings=fs.readFileSync(`${root}/js/views-coach.js`,'utf8');
assert(bindings.includes('bindPostCardio'),'views-coach must bind the selector');
assert.strictEqual((bindings.match(/bindPostCardio\(rerender\);/g)||[]).length,2,'both F111 preset and composer must bind it with the render callback');
assert(/function bindPostCardio\(rerender\)/.test(bindings),'the handler must receive the render callback it needs to repaint');
for(const control of ['post-cardio-equipment','post-cardio-minutes','post-cardio-heart-rate']){
  assert(bindings.includes(control),`views-coach must handle ${control}`);
}

console.log('post cardio runtime: PASS');

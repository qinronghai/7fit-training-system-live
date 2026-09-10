const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=process.cwd();
global.window=global;
function load(file){vm.runInThisContext(fs.readFileSync(`${root}/${file}`,'utf8'),{filename:file});}
for(const file of [
  'data/system-data.js','data/anatomy-data.js','js/prep-grade.js','js/anatomy.js','js/composer.js',
  'js/resolved-session.js','js/conflict-core.js','js/conflict-service.js'
]) load(file);

assert.ok(fs.existsSync(`${root}/js/conflict-plugins/f111.js`),'V15 F111 conflict plugin file must exist');
load('js/conflict-plugins/f111.js');
assert.ok(window.V15F111ConflictPlugin&&typeof window.V15F111ConflictPlugin.evaluate==='function','window.V15F111ConflictPlugin.evaluate must exist');
load('js/conflict.js');
assert.strictEqual(window.V14Conflict?.__v15Facade,true,'V14Conflict must be a compatibility facade over V15Conflict');

const baseline=window.V14Conflict.evaluate('F111-01-L3');
assert.ok(['PASS','WARN','FAIL'].includes(baseline.status));
assert.ok(Array.isArray(baseline.issues));

const composer=window.V14Composer.resolve({level:'L3',lowerMode:'single_leg_hinge',upperMode:'horizontal_push',includeExpandedSupport:true,selections:{C:'SUP-S5-01'}});
const result=window.V14Conflict.evaluateComposer(composer);
assert(result.issues.some(x=>x.code==='GRADE_OUTSIDE_NORMAL_WINDOW'));

console.log('f111_conflict_plugin_test: PASS');

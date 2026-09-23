const fs=require('fs');
const vm=require('vm');
const assert=require('assert');
const path=require('path');

const root=path.resolve(__dirname,'..');
global.window=global;
global.document={};
global.location={hash:'#/library'};
function load(file){vm.runInThisContext(fs.readFileSync(path.join(root,file),'utf8'),{filename:file});}

for(const file of [
  'data/system-data.js',
  'data/anatomy-data.js',
  'js/router.js',
  'js/anatomy.js',
  'js/composer.js',
  'js/template-search.js',
]) load(file);

const S=window.V15TemplateSearch;
assert(S,'V15TemplateSearch must exist');
assert.strictEqual(S.normalizeQuery('x'.repeat(3000)).length,200,'Oversized queries must be bounded');
const boundaryQuery='滑雪机'+' '.repeat(197);
assert.deepStrictEqual(S.search({q:boundaryQuery+'ignored suffix'}),S.search({q:'滑雪机'}),
  'Search must apply the same bound as the visible input before matching');

const index=S.buildIndex();
assert(index.length>0,'search index must not be empty');
assert(index.some(x=>x.kind==='action'),'must index actions');
assert(index.some(x=>x.kind==='f111-combination'),'must index F111 combinations');
assert(index.some(x=>x.kind==='body-family'),'must index Body families');
assert(index.some(x=>x.kind==='conditioning-protocol'),'must index Conditioning family/protocol contexts');
assert(index.some(x=>x.kind==='hyrox-session'),'must index HYROX session types');
assert(index.some(x=>x.kind==='hyrox-benchmark'),'must index HYROX benchmark protocols');
assert(S.activeTemplateOptions().some(x=>x.id==='hyrox'),'HYROX must be an active Template Search option');

const ski=S.search({q:'滑雪机',templateId:'conditioning'});
assert(ski.some(x=>x.kind==='action'&&x.id==='huaxueji_jiange'),'Conditioning action search should find 滑雪机间歇');
assert(ski.find(x=>x.id==='huaxueji_jiange').templates.includes('conditioning'));

const bodyAction=Object.keys(window.V14_DATA.bodyActionMeta||{})[0];
assert(bodyAction,'Body action metadata missing');
assert(S.templatesForAction(bodyAction).includes('body'),'bodyActionMeta membership must drive Body search membership');

const conditioningAction=Object.keys(window.V14_DATA.conditioningActionMeta||{})[0];
assert(conditioningAction,'Conditioning action metadata missing');
assert(S.templatesForAction(conditioningAction).includes('conditioning'),'conditioningActionMeta membership must drive Conditioning search membership');

const combos=S.search({q:'单腿拉',templateId:'f111',kind:'session'});
const combo=combos.find(x=>x.kind==='f111-combination');
assert(combo,'F111 combination search should find 单腿拉');
assert(window.V14Router.isValid(window.V14Router.parseHash(combo.href)),combo.href);
assert(combo.href.startsWith('#/coach/f111?'));

const bodyFamilyId=window.V14_DATA.bodyFamilyIds[1]||window.V14_DATA.bodyFamilyIds[0];
const body=S.search({q:bodyFamilyId,templateId:'body',kind:'session'}).find(x=>x.kind==='body-family');
assert(body,'Body family search should return a composer entry');
assert(window.V14Router.isValid(window.V14Router.parseHash(body.href)),body.href);
assert(body.href.includes('family='+encodeURIComponent(bodyFamilyId)));

const conditioningFamilyId='CON-03';
const conditioning=S.search({q:conditioningFamilyId,templateId:'conditioning',kind:'session'});
assert(conditioning.length>0,'Conditioning search should expose legal protocol contexts');
for(const item of conditioning){
  if(item.kind!=='conditioning-protocol')continue;
  const parsed=window.V14Router.parseHash(item.href);
  assert(window.V14Router.isValid(parsed),item.href);
  assert(window.V14_DATA.conditioningFamilies[conditioningFamilyId].protocolEligibility.includes(item.meta.protocolId));
}

const hyroxMixed=S.search({q:'Mixed',templateId:'hyrox',kind:'session'}).find(x=>x.kind==='hyrox-session');
assert(hyroxMixed,'HYROX Mixed search entry missing');
assert.strictEqual(hyroxMixed.href,'#/coach/hyrox/mixed/l1');
assert(window.V14Router.isValid(window.V14Router.parseHash(hyroxMixed.href)));

const hyroxB3=S.search({q:'B3',templateId:'hyrox',kind:'session'}).find(x=>x.kind==='hyrox-benchmark');
assert(hyroxB3,'HYROX B3 search entry missing');
assert.strictEqual(hyroxB3.href,'#/coach/hyrox/benchmark/b3');
assert(window.V14Router.isValid(window.V14Router.parseHash(hyroxB3.href)));

const allActionSearch=S.search({q:'臀',kind:'action'});
assert(allActionSearch.length>0,'target/action search should return results');
assert(allActionSearch.every(x=>x.kind==='action'));

console.log('template_search_runtime_test: PASS');

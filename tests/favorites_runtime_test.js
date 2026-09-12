const fs=require('fs'),vm=require('vm'),assert=require('assert');
const root=process.cwd();

function boot(initial={}){
  const memory={...initial};
  const sessionStorage={
    getItem:key=>Object.prototype.hasOwnProperty.call(memory,key)?memory[key]:null,
    setItem:(key,value)=>{memory[key]=String(value);},
    removeItem:key=>{delete memory[key];},
  };
  const ctx={window:{},sessionStorage,document:{body:{dataset:{}}},console,URLSearchParams};
  ctx.window.window=ctx.window;
  vm.createContext(ctx);
  for(const file of [
    'data/system-data.js','data/anatomy-data.js','js/router.js','js/state.js','js/anatomy.js','js/composer.js','js/template-search.js','js/favorites.js'
  ]) vm.runInContext(fs.readFileSync(`${root}/${file}`,'utf8'),ctx,{filename:file});
  return {memory,V15:ctx.window.V15State,F:ctx.window.V15Favorites,S:ctx.window.V15TemplateSearch,D:ctx.window.V14_DATA};
}
const plain=v=>JSON.parse(JSON.stringify(v));
const eq=(a,b)=>assert.deepStrictEqual(plain(a),b);

{
  const {V15}=boot();
  assert.strictEqual(V15.getFavoriteSchemaVersion(),1);
  V15.setFavorite({
    favoriteId:'body|body-family|body:BODY-02',
    schemaVersion:1,templateId:'body',entryKind:'body-family',entryId:'body:BODY-02',
    createdAt:'2026-09-12T11:00:00.000Z'
  });
  V15.setFavorite({
    favoriteId:'f111|f111-combination|combo:F111-C-SLH-HP',
    schemaVersion:1,templateId:'f111',entryKind:'f111-combination',entryId:'combo:F111-C-SLH-HP',
    createdAt:'2026-09-12T11:01:00.000Z'
  });
  assert.strictEqual(V15.listFavorites('body').length,1);
  assert.strictEqual(V15.listFavorites('f111').length,1);
  assert.strictEqual(V15.listFavorites('conditioning').length,0);
  assert(V15.hasFavorite('body|body-family|body:BODY-02'));
  assert(V15.removeFavorite('body|body-family|body:BODY-02'));
  assert(!V15.hasFavorite('body|body-family|body:BODY-02'));
}

{
  const first=boot();
  first.V15.setFavorite({
    favoriteId:'conditioning|conditioning-protocol|conditioning:CON-03:CIRCUIT',
    schemaVersion:1,templateId:'conditioning',entryKind:'conditioning-protocol',entryId:'conditioning:CON-03:CIRCUIT',
    createdAt:'2026-09-12T11:00:00.000Z'
  });
  const second=boot(first.memory);
  assert.strictEqual(second.V15.listFavorites('conditioning').length,1);
}

{
  const {F,S}=boot();
  const body=S.search({q:'BODY-02',templateId:'body',kind:'session'}).find(x=>x.kind==='body-family');
  assert(body);
  const saved=F.toggle(body,{templateId:'body',now:'2026-09-12T11:00:00.000Z'});
  assert.strictEqual(saved.favorite,true);
  assert.strictEqual(F.isFavorite(body,'body'),true);
  const listed=F.listResolved();
  const bodyFavorite=listed.find(x=>x.record.templateId==='body');
  assert(bodyFavorite&&!bodyFavorite.stale);
  assert(bodyFavorite.href.includes('#/coach/body/compose?'));
  assert.strictEqual(F.toggle(body,{templateId:'body'}).favorite,false);
}

{
  const {V15,F}=boot();
  V15.setFavorite({
    favoriteId:'body|body-family|body:BODY-99',
    schemaVersion:1,templateId:'body',entryKind:'body-family',entryId:'body:BODY-99',
    createdAt:'2026-09-12T11:00:00.000Z'
  });
  const stale=F.listResolved().find(x=>x.record.favoriteId==='body|body-family|body:BODY-99');
  assert(stale&&stale.stale);
  assert.strictEqual(stale.reason,'ENTRY_NOT_FOUND');
}

console.log('favorites_runtime_test: PASS');

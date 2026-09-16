(function(){
  'use strict';

  const S=()=>window.V15State;
  const Search=()=>window.V15TemplateSearch;
  const Router=()=>window.V14Router;
  const ACTIVE=new Set(['f111','body','conditioning']);

  function entries(){return Search()?.buildIndex?.()||[];}
  function findEntry(entryKind,entryId){
    return entries().find(entry=>entry.kind===entryKind&&entry.id===entryId)||null;
  }
  function templateContext(entry,requested){
    if(requested&&ACTIVE.has(requested)&&(entry.templates||[]).includes(requested))return requested;
    if((entry.templates||[]).length===1&&ACTIVE.has(entry.templates[0]))return entry.templates[0];
    if(entry.kind==='action')return 'shared';
    return (entry.templates||[]).find(id=>ACTIVE.has(id))||'shared';
  }
  function favoriteId(entry,templateId){
    return `${templateId}|${entry.kind}|${entry.id}`;
  }
  function isFavorite(entry,requestedTemplate){
    if(!entry)return false;
    const templateId=templateContext(entry,requestedTemplate);
    return !!S()?.hasFavorite?.(favoriteId(entry,templateId));
  }
  function save(entry,{templateId,now}={}){
    if(!entry)return null;
    const current=findEntry(entry.kind,entry.id);
    if(!current)return null;
    const resolvedTemplate=templateContext(current,templateId);
    if(resolvedTemplate!=='shared'&&!(current.templates||[]).includes(resolvedTemplate))return null;
    const id=favoriteId(current,resolvedTemplate);
    return S()?.setFavorite?.({
      favoriteId:id,
      schemaVersion:S()?.getFavoriteSchemaVersion?.()||1,
      templateId:resolvedTemplate,
      entryKind:current.kind,
      entryId:current.id,
      createdAt:typeof now==='string'&&now?now:new Date().toISOString(),
    })||null;
  }
  function remove(entry,{templateId}={}){
    if(!entry)return false;
    const resolvedTemplate=templateContext(entry,templateId);
    return !!S()?.removeFavorite?.(favoriteId(entry,resolvedTemplate));
  }
  function toggle(entry,options={}){
    if(!entry)return {favorite:false,record:null};
    if(isFavorite(entry,options.templateId)){
      remove(entry,options);
      return {favorite:false,record:null};
    }
    const record=save(entry,options);
    return {favorite:!!record,record};
  }
  function toggleByIdentity(entryKind,entryId,options={}){
    const entry=findEntry(entryKind,entryId);
    return toggle(entry,options);
  }
  function resolve(record){
    const entry=findEntry(record?.entryKind,record?.entryId);
    if(!entry)return {record,stale:true,reason:'ENTRY_NOT_FOUND',entry:null,href:''};
    if(record.templateId!=='shared'&&!(entry.templates||[]).includes(record.templateId)){
      return {record,stale:true,reason:'TEMPLATE_MISMATCH',entry,href:''};
    }
    const href=entry.href||'';
    const router=Router();
    if(!href||!router?.isValid?.(router.parseHash(href))){
      return {record,stale:true,reason:'ROUTE_INVALID',entry,href:''};
    }
    return {record,stale:false,reason:'',entry,href,title:entry.title,subtitle:entry.subtitle||''};
  }
  function listResolved(templateId){
    const records=S()?.listFavorites?.(templateId)||[];
    return records.map(resolve);
  }
  function removeById(favoriteIdValue){return !!S()?.removeFavorite?.(favoriteIdValue);}

  window.V15Favorites={
    entries,findEntry,templateContext,favoriteId,isFavorite,save,remove,toggle,toggleByIdentity,resolve,listResolved,removeById,
  };
})();
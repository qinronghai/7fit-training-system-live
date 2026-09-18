(function(){
  const style=document.createElement('style');
  style.textContent=`
    .grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:26px!important}
    .card{padding:12px!important}
    .case-title-row{display:flex;align-items:flex-end;justify-content:space-between;gap:18px}
    .case-title-row h2{flex:1}
    .edit-case-btn{border:1px solid rgba(149,102,242,.24);background:var(--ps);color:var(--pd);padding:10px 14px;border-radius:999px;font-size:12px;font-weight:900;cursor:pointer;white-space:nowrap;transition:.18s}
    .edit-case-btn:hover{background:#e5dbff;transform:translateY(-1px)}
    @media(max-width:600px){.grid{grid-template-columns:1fr!important;gap:18px!important}.case-title-row{align-items:center}.edit-case-btn{padding:9px 12px;font-size:11px}}
  `;
  document.head.appendChild(style);

  let editingCaseId=null;
  const defaultHelper='不要求填写课时或训练周期。正面 / 侧面 / 背面对比图由人工提前拼好，每个方向只上传 1 张完整对比图，再从中选择 1 张作为首页封面。';
  const originalOpenCase=openCase;
  const originalOpenModal=openModal;

  function titleAndHelper(title,helper){
    const titleEl=document.querySelector('#form .paneltop h2');
    const helperEl=document.querySelector('#form .helper');
    if(titleEl) titleEl.textContent=title;
    if(helperEl) helperEl.textContent=helper;
  }

  function clearFormForNew(){
    editingCaseId=null;
    const f=document.querySelector('#form');
    if(f) f.reset();
    const metrics=document.querySelector('#metrics');
    if(metrics) metrics.innerHTML='';
    titleAndHelper('上传新案例',defaultHelper);
  }

  openCase=function(id){
    originalOpenCase(id);
    const c=cases.find(x=>x.id===id);
    const dt=document.querySelector('#detailBody .dt');
    if(!c||!dt||dt.querySelector('.edit-case-btn')) return;
    const h2=dt.querySelector('h2');
    if(!h2) return;
    const row=document.createElement('div');
    row.className='case-title-row';
    h2.parentNode.insertBefore(row,h2);
    row.appendChild(h2);
    const btn=document.createElement('button');
    btn.type='button';
    btn.className='edit-case-btn';
    btn.textContent='编辑案例';
    btn.onclick=()=>openCaseEditor(id);
    row.appendChild(btn);
  };

  function openCaseEditor(id){
    const c=cases.find(x=>x.id===id);
    if(!c) return;
    editingCaseId=id;
    originalOpenModal();
    const f=document.querySelector('#form');
    const metrics=document.querySelector('#metrics');
    if(!f||!metrics) return;
    f.reset();
    metrics.innerHTML='';
    titleAndHelper('编辑案例','修改已有案例资料。没有重新选择的图片会继续保留原图，不需要全部重新上传。');
    f.elements.name.value=c.name||'';
    f.elements.category.value=c.category||'减脂塑形';
    f.elements.height.value=c.height||'';
    f.elements.startWeight.value=c.startWeight||'';
    f.elements.age.value=c.age||'';
    f.elements.processText.value=c.processText||'';
    const radio=f.querySelector('input[name="coverView"][value="'+(c.coverView||'front')+'"]');
    if(radio) radio.checked=true;
    (c.metrics||[]).forEach(x=>addMetric(x.name||'',x.before||'',x.after||''));
    if(!(c.metrics||[]).length){
      addMetric('体重');addMetric('腰围');addMetric('体脂率');addMetric('大腿围度');addMetric('手臂围度');
    }
  }

  const oldAddMetric=addMetric;
  addMetric=function(name='',before='',after=''){
    const metrics=document.querySelector('#metrics');
    const beforeCount=metrics?metrics.children.length:0;
    oldAddMetric(name);
    if(!metrics||metrics.children.length<=beforeCount) return;
    const row=metrics.lastElementChild;
    if(row&&row.children[1]) row.children[1].value=before||'';
    if(row&&row.children[2]) row.children[2].value=after||'';
  };

  const uploadBtn=document.querySelector('#openUpload');
  if(uploadBtn) uploadBtn.addEventListener('click',clearFormForNew,true);
  for(const id of ['closeUpload','cancel']){
    const el=document.querySelector('#'+id);
    if(el) el.addEventListener('click',()=>{editingCaseId=null;},false);
  }
  const modal=document.querySelector('#modal');
  if(modal) modal.addEventListener('click',e=>{if(e.target===modal) editingCaseId=null;},false);

  const form=document.querySelector('#form');
  form.onsubmit=async e=>{
    e.preventDefault();
    const f=e.currentTarget,fd=new FormData(f),wasEditing=!!editingCaseId,existing=editingCaseId?cases.find(x=>x.id===editingCaseId):null;
    const metrics=[...document.querySelectorAll('.mrow')].map(r=>({
      name:r.children[0].value.trim(),
      before:r.children[1].value.trim(),
      after:r.children[2].value.trim()
    })).filter(x=>x.name&&(x.before||x.after));
    const fresh={
      front:await read(fd.get('frontImage')),
      side:await read(fd.get('sideImage')),
      back:await read(fd.get('backImage'))
    };
    const comparisons={
      front:{image:fresh.front||existing?.comparisons?.front?.image||''},
      side:{image:fresh.side||existing?.comparisons?.side?.image||''},
      back:{image:fresh.back||existing?.comparisons?.back?.image||''}
    };
    const coverView=fd.get('coverView')||existing?.coverView;
    const cover=comparisons[coverView];
    if(!cover||!cover.image){toast('请选择一张已经上传的对比图作为首页封面');return}
    const processImages=f.elements.processImages.files.length?await reads(f.elements.processImages.files):(existing?.processImages||[]);
    const chatImages=f.elements.chatImages.files.length?await reads(f.elements.chatImages.files):(existing?.chatImages||[]);
    const o={
      id:editingCaseId||'case-'+Date.now(),
      name:fd.get('name'),
      category:fd.get('category'),
      height:(fd.get('height')||'').trim(),
      startWeight:(fd.get('startWeight')||'').trim(),
      age:(fd.get('age')||'').trim(),
      coverView,
      coverImage:cover.image,
      comparisons,
      processText:fd.get('processText')||'',
      processImages,
      metrics,
      chatImages
    };
    try{
      await put(o);
      if(wasEditing){
        const i=cases.findIndex(x=>x.id===o.id);
        if(i>=0) cases[i]=o;
      }else{
        cases.unshift(o);
      }
      render();
      editingCaseId=null;
      f.reset();
      document.querySelector('#metrics').innerHTML='';
      closeModal();
      if(!document.querySelector('#detail').classList.contains('hidden')) openCase(o.id);
      toast(wasEditing?'案例已更新':'案例已保存到当前浏览器');
    }catch(err){
      toast('保存失败，请重试');
    }
  };

  const seen=new Set();
  cases=cases.filter(c=>{if(seen.has(c.id)) return false;seen.add(c.id);return true});
  render();
})();
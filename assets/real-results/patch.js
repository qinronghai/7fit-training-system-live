(function(){
  const API="https://ynsodlyanpmixbbxblqh.supabase.co/functions/v1/case-api";
  const ADMIN_STORAGE_KEY="7fit_case_admin_key";
  let editingCaseId=null;
  let cloudReady=false;
  let adminKey=localStorage.getItem(ADMIN_STORAGE_KEY)||"";
  const params=new URLSearchParams(location.search);
  const adminRequested=params.get("admin")==="1" || !!adminKey;

  const style=document.createElement("style");
  style.textContent=`
    .grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:26px!important}
    .card{padding:12px!important}
    .case-title-row{display:flex;align-items:flex-end;justify-content:space-between;gap:18px}
    .case-title-row h2{flex:1}
    .edit-case-btn{border:1px solid rgba(149,102,242,.24);background:var(--ps);color:var(--pd);padding:10px 14px;border-radius:999px;font-size:12px;font-weight:900;cursor:pointer;white-space:nowrap;transition:.18s}
    .edit-case-btn:hover{background:#e5dbff;transform:translateY(-1px)}
    .cloud-state{position:fixed;right:14px;bottom:14px;z-index:150;padding:8px 11px;border-radius:999px;background:rgba(33,30,38,.92);color:#fff;font-size:11px;font-weight:800;box-shadow:0 8px 24px rgba(33,30,38,.18)}
    .cloud-state.ok{background:rgba(38,143,92,.94)}.cloud-state.err{background:rgba(183,65,65,.94)}
    .admin-chip{display:inline-flex;align-items:center;gap:6px;padding:7px 10px;border-radius:999px;background:#EFE8FF;color:#7447D8;font-size:10px;font-weight:900;margin-left:8px}
    @media(max-width:600px){.grid{grid-template-columns:1fr!important;gap:18px!important}.case-title-row{align-items:center}.edit-case-btn{padding:9px 12px;font-size:11px}.cloud-state{right:10px;bottom:10px}}
  `;
  document.head.appendChild(style);

  const state=document.createElement("div");
  state.className="cloud-state";
  state.textContent="云端同步中…";
  document.body.appendChild(state);
  function cloudState(text,type=""){state.textContent=text;state.className="cloud-state"+(type?" "+type:"");clearTimeout(state._t);state._t=setTimeout(()=>state.classList.add("hidden"),2600)}
  function showCloudState(){state.classList.remove("hidden")}

  function assetOf(c,kind){return (c.case_assets||[]).find(a=>a.kind===kind&&a.url)}
  function assetsOf(c,kind){return (c.case_assets||[]).filter(a=>a.kind===kind&&a.url).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0))}
  function mapCase(c){
    const f=assetOf(c,"comparison_front"),s=assetOf(c,"comparison_side"),b=assetOf(c,"comparison_back");
    const cv=c.cover_view||"front";
    const cover={front:f,side:s,back:b}[cv]||f||s||b;
    return {
      id:c.id,name:c.display_name,category:c.category,height:c.height_cm??"",startWeight:c.start_weight_kg??"",age:c.age??"",
      coverView:cv,coverImage:cover?.url||"",
      comparisons:{front:{image:f?.url||"",assetId:f?.id||""},side:{image:s?.url||"",assetId:s?.id||""},back:{image:b?.url||"",assetId:b?.id||""}},
      processText:c.process_text||"",processImages:assetsOf(c,"process").map(a=>a.url),metrics:Array.isArray(c.metrics)?c.metrics:[],
      chatImages:assetsOf(c,"chat").map(a=>a.url),case_assets:c.case_assets||[],status:c.status||"published",cloud:true
    }
  }
  async function api(action,{method="GET",body=null,headers={}}={}){
    const h={...headers};
    if(adminKey) h["x-admin-key"]=adminKey;
    if(body && !(body instanceof ArrayBuffer) && !(body instanceof Blob) && !(body instanceof File)){
      h["content-type"]="application/json";
      body=JSON.stringify(body);
    }
    const res=await fetch(API+"?action="+encodeURIComponent(action),{method,headers:h,body});
    const data=await res.json().catch(()=>({}));
    if(!res.ok) throw new Error(data.error||("HTTP "+res.status));
    return data;
  }
  async function verifyAdmin(promptIfNeeded=true){
    if(adminKey){
      try{await api("verify-admin",{method:"POST"});return true}catch(e){localStorage.removeItem(ADMIN_STORAGE_KEY);adminKey=""}
    }
    if(!promptIfNeeded) return false;
    const entered=prompt("请输入 7Fit 案例后台管理密钥");
    if(!entered) return false;
    adminKey=entered.trim();
    try{
      await api("verify-admin",{method:"POST"});
      localStorage.setItem(ADMIN_STORAGE_KEY,adminKey);
      cloudState("已进入馆主管理模式","ok");
      return true;
    }catch(e){
      adminKey="";
      alert("管理密钥不正确");
      return false;
    }
  }
  async function loadCloud(){
    showCloudState();state.textContent="正在读取云端案例…";
    try{
      const data=await api("list");
      cases=(data.cases||[]).map(mapCase);
      cloudReady=true;
      render();
      cloudState("云端案例已同步","ok");
    }catch(e){
      console.error(e);
      cases=[];
      render();
      cloudState("云端读取失败","err");
    }
  }

  const uploadBtn=document.querySelector("#openUpload");
  if(uploadBtn){
    if(!adminRequested) uploadBtn.style.display="none";
    else {
      uploadBtn.textContent="＋ 上传案例";
      const chip=document.createElement("span");chip.className="admin-chip";chip.textContent="馆主后台";uploadBtn.parentNode.insertBefore(chip,uploadBtn);
    }
  }

  const defaultHelper="正面 / 侧面 / 背面对比图由人工提前拼好，每个方向只上传 1 张完整对比图，再从中选择 1 张作为首页封面。案例保存后会同步到云端，手机和电脑访问同一链接都能看到。";
  const originalOpenCase=openCase;
  const originalOpenModal=openModal;
  function titleAndHelper(title,helper){
    const titleEl=document.querySelector("#form .paneltop h2");
    const helperEl=document.querySelector("#form .helper");
    if(titleEl) titleEl.textContent=title;
    if(helperEl) helperEl.textContent=helper;
  }
  async function clearFormForNew(){
    if(!(await verifyAdmin(true))) return false;
    editingCaseId=null;
    const f=document.querySelector("#form");if(f) f.reset();
    const metrics=document.querySelector("#metrics");if(metrics) metrics.innerHTML="";
    titleAndHelper("上传新案例",defaultHelper);
    return true;
  }

  if(uploadBtn){
    uploadBtn.onclick=async e=>{
      e.preventDefault();e.stopPropagation();
      if(await clearFormForNew()) originalOpenModal();
    };
  }

  openCase=function(id){
    originalOpenCase(id);
    if(!adminRequested) return;
    const c=cases.find(x=>x.id===id);
    const dt=document.querySelector("#detailBody .dt");
    if(!c||!dt||dt.querySelector(".edit-case-btn")) return;
    const h2=dt.querySelector("h2");if(!h2)return;
    const row=document.createElement("div");row.className="case-title-row";
    h2.parentNode.insertBefore(row,h2);row.appendChild(h2);
    const btn=document.createElement("button");btn.type="button";btn.className="edit-case-btn";btn.textContent="编辑案例";
    btn.onclick=async()=>{if(await verifyAdmin(true)) openCaseEditor(id)};
    row.appendChild(btn);
  };

  function openCaseEditor(id){
    const c=cases.find(x=>x.id===id);if(!c)return;
    editingCaseId=id;originalOpenModal();
    const f=document.querySelector("#form"),metrics=document.querySelector("#metrics");if(!f||!metrics)return;
    f.reset();metrics.innerHTML="";
    titleAndHelper("编辑案例","修改后会直接同步到云端。没有重新选择的图片会继续保留原图，不需要全部重新上传。");
    f.elements.name.value=c.name||"";f.elements.category.value=c.category||"减脂塑形";f.elements.height.value=c.height||"";
    f.elements.startWeight.value=c.startWeight||"";f.elements.age.value=c.age||"";f.elements.processText.value=c.processText||"";
    const radio=f.querySelector('input[name="coverView"][value="'+(c.coverView||"front")+'"]');if(radio)radio.checked=true;
    (c.metrics||[]).forEach(x=>addMetric(x.name||"",x.before||"",x.after||""));
    if(!(c.metrics||[]).length){addMetric("体重");addMetric("腰围");addMetric("体脂率");addMetric("大腿围度");addMetric("手臂围度")}
  }

  const oldAddMetric=addMetric;
  addMetric=function(name="",before="",after=""){
    const metrics=document.querySelector("#metrics"),beforeCount=metrics?metrics.children.length:0;
    oldAddMetric(name);
    if(!metrics||metrics.children.length<=beforeCount)return;
    const row=metrics.lastElementChild;if(row&&row.children[1])row.children[1].value=before||"";if(row&&row.children[2])row.children[2].value=after||"";
  };

  async function uploadFile(caseId,kind,file,replace=false){
    if(!file||!file.size)return null;
    const res=await fetch(API+"?action=upload&case_id="+encodeURIComponent(caseId)+"&kind="+encodeURIComponent(kind)+"&replace="+(replace?"1":"0"),{
      method:"POST",headers:{"x-admin-key":adminKey,"content-type":file.type||"image/jpeg","x-file-name":encodeURIComponent(file.name||"image.jpg")},body:file
    });
    const data=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(data.error||"upload_failed");
    return data.asset;
  }

  for(const id of ["closeUpload","cancel"]){
    const el=document.querySelector("#"+id);if(el)el.addEventListener("click",()=>{editingCaseId=null},false);
  }
  const modal=document.querySelector("#modal");if(modal)modal.addEventListener("click",e=>{if(e.target===modal)editingCaseId=null},false);

  const form=document.querySelector("#form");
  form.onsubmit=async e=>{
    e.preventDefault();
    if(!(await verifyAdmin(true)))return;
    const f=e.currentTarget,fd=new FormData(f),wasEditing=!!editingCaseId,existing=editingCaseId?cases.find(x=>x.id===editingCaseId):null;
    const metrics=[...document.querySelectorAll(".mrow")].map(r=>({name:r.children[0].value.trim(),before:r.children[1].value.trim(),after:r.children[2].value.trim()})).filter(x=>x.name&&(x.before||x.after));
    const coverView=fd.get("coverView")||existing?.coverView||"front";
    const chosenInput={front:f.elements.frontImage,side:f.elements.sideImage,back:f.elements.backImage}[coverView];
    const existingCover=existing?.comparisons?.[coverView]?.image;
    if(!(chosenInput?.files?.[0])&&!existingCover){toast("请选择一张已经上传的对比图作为首页封面");return}

    try{
      showCloudState();state.textContent=wasEditing?"正在更新云端案例…":"正在创建云端案例…";
      const draft=await api("save-case",{method:"POST",body:{
        id:editingCaseId||undefined,display_name:fd.get("name"),category:fd.get("category"),
        height_cm:(fd.get("height")||"").trim(),start_weight_kg:(fd.get("startWeight")||"").trim(),age:(fd.get("age")||"").trim(),
        cover_view:coverView,process_text:fd.get("processText")||"",metrics,status:wasEditing?"published":"draft"
      }});
      const caseId=draft.case.id;
      const comparisonInputs=[["front","comparison_front",f.elements.frontImage],["side","comparison_side",f.elements.sideImage],["back","comparison_back",f.elements.backImage]];
      for(const [view,kind,input] of comparisonInputs){if(input?.files?.[0])await uploadFile(caseId,kind,input.files[0],true)}
      for(const file of [...(f.elements.processImages.files||[])])await uploadFile(caseId,"process",file,false);
      for(const file of [...(f.elements.chatImages.files||[])])await uploadFile(caseId,"chat",file,false);
      await api("save-case",{method:"POST",body:{
        id:caseId,display_name:fd.get("name"),category:fd.get("category"),
        height_cm:(fd.get("height")||"").trim(),start_weight_kg:(fd.get("startWeight")||"").trim(),age:(fd.get("age")||"").trim(),
        cover_view:coverView,process_text:fd.get("processText")||"",metrics,status:"published"
      }});
      editingCaseId=null;f.reset();document.querySelector("#metrics").innerHTML="";closeModal();
      await loadCloud();
      if(wasEditing&&!document.querySelector("#detail").classList.contains("hidden"))openCase(caseId);
      toast(wasEditing?"案例已同步更新":"案例已上传到云端");
    }catch(err){
      console.error(err);cloudState("云端保存失败","err");toast("保存失败，请检查网络后重试");
    }
  };

  cases=[];
  render();
  loadCloud();
})();
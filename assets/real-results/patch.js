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

  const responsiveStyle=document.createElement("style");
  responsiveStyle.textContent=`
    html,body{max-width:100%;overflow-x:hidden}
    body{min-width:0}
    .shell,.detail-shell,.panel{min-width:0}
    .topbar,.detailbar{min-width:0}
    .brand{min-width:0}
    .brand>div:last-child{min-width:0}
    .brand strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .upload,.filter,.back,.edit-case-btn,.primary,.secondary,.add{white-space:nowrap;line-height:1.1}
    .filters{-webkit-overflow-scrolling:touch;scrollbar-width:none}
    .filters::-webkit-scrollbar{display:none}
    .field input,.field select,.field textarea,.mrow input{min-width:0}

    @media(max-width:900px){
      .shell{width:min(var(--max),calc(100% - 28px))}
      .topbar{top:8px;padding:9px 10px;gap:8px}
      .hero{padding:52px 2px 18px}
      .hero h1{font-size:clamp(36px,8vw,58px)}
      .grid{gap:18px!important}
      .card{border-radius:24px!important}
      .sec{padding:22px;border-radius:24px}
      .detail-shell{width:calc(100% - 28px)}
    }

    @media(max-width:600px){
      .shell{width:calc(100% - 20px);padding-top:10px}
      .topbar{top:6px;padding:7px 8px;border-radius:22px;gap:6px}
      .logo{width:34px;height:34px;border-radius:11px}
      .brand{gap:8px;flex:1 1 auto}
      .brand strong{font-size:13px;max-width:145px}
      .brand small{font-size:8px;letter-spacing:.08em}
      .upload{padding:8px 10px;font-size:11px;flex:0 0 auto}
      .admin-chip{padding:6px 8px;font-size:9px;margin-left:4px}
      .hero{padding:38px 2px 12px}
      .eyebrow{font-size:9px;letter-spacing:.12em}
      .hero h1{font-size:clamp(32px,10vw,46px);margin:10px 0 10px;line-height:1}
      .hero p{font-size:13px;line-height:1.7}
      .filters{flex-wrap:nowrap;overflow-x:auto;gap:7px;margin:20px -2px 24px;padding:0 2px 5px}
      .filter{flex:0 0 auto;padding:8px 11px;font-size:11px}
      .grid{grid-template-columns:1fr!important;gap:16px!important}
      .card{padding:8px!important;border-radius:20px!important}
      .cover{border-radius:15px}
      .meta{padding:10px 5px 6px}
      .name{font-size:16px}
      .cat{font-size:10px}
      .detail-shell{width:calc(100% - 18px);padding-top:10px}
      .detailbar{top:6px;padding:7px 8px;gap:6px}
      .detailbar .brand strong{font-size:12px;max-width:80px}
      .detailbar .logo{width:32px;height:32px}
      .back{padding:8px 10px;font-size:11px}
      .dt{padding:38px 2px 14px}
      .dt h2{font-size:clamp(30px,9vw,42px);line-height:1}
      .dt p{font-size:13px;line-height:1.7}
      .case-title-row{gap:10px;align-items:center}
      .case-title-row h2{min-width:0}
      .edit-case-btn{padding:8px 10px;font-size:10px;flex:0 0 auto}
      .basicinfo{gap:6px;margin-top:10px}
      .basicitem{padding:7px 9px;font-size:10px}
      .sec{margin-top:14px;padding:16px;border-radius:20px}
      .sechead{align-items:flex-start;gap:8px;flex-wrap:wrap;margin-bottom:14px}
      .sechead h3{font-size:20px}
      .note{font-size:10px;max-width:100%}
      .compare{grid-template-columns:1fr}
      .gallery,.chat{grid-template-columns:1fr}
      .process{font-size:14px;line-height:1.8}
      .drow{grid-template-columns:1.15fr .9fr 18px .9fr;gap:5px;padding:10px 9px}
      .drow b,.drow span{font-size:11px}
      .footer{margin-top:38px;padding-top:18px;font-size:11px}
      .panel{width:calc(100% - 12px);max-height:95dvh;padding:15px;border-radius:22px}
      .paneltop h2{font-size:20px}
      .helper{font-size:11px;margin:7px 0 14px}
      .fs{padding:14px 0}
      .fg{grid-template-columns:1fr}
      .up3{grid-template-columns:1fr}
      .upbox{padding:10px}
      .actions{gap:7px;padding-top:14px}
      .primary,.secondary{padding:9px 13px;font-size:11px;min-height:40px;touch-action:manipulation}
      .add{padding:8px 10px;font-size:10px}
      .mrow{grid-template-columns:1fr 1fr 1fr 28px;gap:5px}
      .mrow input{padding:8px 7px;font-size:11px}
    }

    @media(max-width:390px){
      .shell{width:calc(100% - 16px)}
      .topbar{padding:6px 7px}
      .brand strong{font-size:12px;max-width:118px}
      .brand small{display:none}
      .logo{width:31px;height:31px}
      .upload{padding:7px 9px;font-size:10px}
      .admin-chip{display:none}
      .hero h1{font-size:clamp(29px,10.5vw,40px)}
      .hero p{font-size:12px}
      .filter{padding:7px 10px;font-size:10px}
      .detail-shell{width:calc(100% - 14px)}
      .detailbar .brand strong{display:none}
      .back{padding:7px 9px;font-size:10px}
      .edit-case-btn{padding:7px 9px;font-size:9px}
      .sec{padding:14px}
      .sechead h3{font-size:18px}
      .drow{grid-template-columns:1.1fr .8fr 16px .8fr}
      .drow b,.drow span{font-size:10px}
      .panel{width:calc(100% - 8px);padding:12px}
      .paneltop h2{font-size:18px}
      .primary,.secondary{padding:8px 11px;font-size:10px}
    }

    @media(max-width:350px){
      .brand strong{max-width:92px}
      .upload{padding:7px 8px;font-size:9px}
      .hero h1{font-size:28px}
      .filter{font-size:9px}
      .case-title-row{align-items:flex-start}
      .edit-case-btn{padding:6px 8px}
    }
  `;
  document.head.appendChild(responsiveStyle);

  function applyViewportClass(){
    const w=Math.round(window.visualViewport?.width||window.innerWidth||document.documentElement.clientWidth||0);
    const bucket=w<=350?"xxs":w<=390?"xs":w<=600?"sm":w<=900?"md":"lg";
    document.documentElement.dataset.viewport=bucket;
    document.documentElement.style.setProperty("--viewport-width",w+"px");
  }
  applyViewportClass();
  window.addEventListener("resize",applyViewportClass,{passive:true});
  if(window.visualViewport) window.visualViewport.addEventListener("resize",applyViewportClass,{passive:true});

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

  function friendlyError(err){
    const msg=String(err?.message||err||"");
    if(/unauthorized/i.test(msg)) return "管理身份已失效，请重新输入后台管理密钥";
    if(/Failed to fetch|NetworkError|Load failed/i.test(msg)) return "网络连接失败，请检查手机网络后重试";
    if(/file_too_large/i.test(msg)) return "图片文件太大，请重新选择或压缩后再上传";
    if(/image_only/i.test(msg)) return "只支持上传图片文件";
    if(/display_name_required/i.test(msg)) return "请填写会员显示名称";
    if(/invalid_category/i.test(msg)) return "案例分类无效，请重新选择";
    if(/server key is unavailable/i.test(msg)) return "云端后台配置异常，请稍后重试";
    return "保存失败："+msg.slice(0,80);
  }

  async function normalizeImage(file){
    if(!file||!file.size)return file;
    const safeTypes=["image/jpeg","image/png","image/webp"];
    if(file.size<=4*1024*1024 && safeTypes.includes(file.type)) return file;
    let img=null,url="";
    try{
      url=URL.createObjectURL(file);
      img=await new Promise((resolve,reject)=>{
        const el=new Image();
        el.onload=()=>resolve(el);
        el.onerror=reject;
        el.src=url;
      });
      const maxSide=2600;
      const scale=Math.min(1,maxSide/Math.max(img.naturalWidth||1,img.naturalHeight||1));
      const w=Math.max(1,Math.round((img.naturalWidth||1)*scale));
      const h=Math.max(1,Math.round((img.naturalHeight||1)*scale));
      const canvas=document.createElement("canvas");
      canvas.width=w;canvas.height=h;
      const ctx=canvas.getContext("2d",{alpha:false});
      ctx.fillStyle="#fff";ctx.fillRect(0,0,w,h);
      ctx.drawImage(img,0,0,w,h);
      let quality=.88;
      let blob=await new Promise(ok=>canvas.toBlob(ok,"image/jpeg",quality));
      if(blob&&blob.size>5*1024*1024){
        quality=.76;
        blob=await new Promise(ok=>canvas.toBlob(ok,"image/jpeg",quality));
      }
      if(blob){
        const stem=(file.name||"image").replace(/\.[^.]+$/,"");
        return new File([blob],stem+".jpg",{type:"image/jpeg",lastModified:Date.now()});
      }
    }catch(e){
      console.warn("image normalize skipped",e);
    }finally{
      if(url) URL.revokeObjectURL(url);
    }
    return file;
  }

  async function uploadFile(caseId,kind,file,replace=false){
    if(!file||!file.size)return null;
    const uploadFile=await normalizeImage(file);
    if(uploadFile.size>15*1024*1024)throw new Error("file_too_large");
    const res=await fetch(API+"?action=upload&case_id="+encodeURIComponent(caseId)+"&kind="+encodeURIComponent(kind)+"&replace="+(replace?"1":"0"),{
      method:"POST",headers:{"x-admin-key":adminKey,"content-type":uploadFile.type||"image/jpeg","x-file-name":encodeURIComponent(uploadFile.name||"image.jpg")},body:uploadFile
    });
    const data=await res.json().catch(()=>({}));
    if(!res.ok)throw new Error(data.error||("upload_failed_"+res.status));
    return data.asset;
  }

  for(const id of ["closeUpload","cancel"]){
    const el=document.querySelector("#"+id);if(el)el.addEventListener("click",()=>{editingCaseId=null},false);
  }
  const modal=document.querySelector("#modal");if(modal)modal.addEventListener("click",e=>{if(e.target===modal)editingCaseId=null},false);

  const form=document.querySelector("#form");
  form.noValidate=true;
  form.querySelectorAll("[required]").forEach(el=>el.removeAttribute("required"));
  form.addEventListener("invalid",e=>e.preventDefault(),true);
  form.onsubmit=async e=>{
    e.preventDefault();
    if(!(await verifyAdmin(true)))return;
    const f=e.currentTarget,submitBtn=f.querySelector('button[type="submit"]');
    const oldSubmitText=submitBtn?.textContent||"保存案例";
    if(submitBtn){submitBtn.disabled=true;submitBtn.textContent="正在保存…";}
    const fd=new FormData(f),wasEditing=!!editingCaseId,existing=editingCaseId?cases.find(x=>x.id===editingCaseId):null;
    const displayName=String(fd.get("name")||"").trim();
    if(!displayName){
      if(submitBtn){submitBtn.disabled=false;submitBtn.textContent=oldSubmitText;}
      toast("请先填写会员显示名称");
      f.elements.name?.focus();
      f.elements.name?.scrollIntoView({behavior:"smooth",block:"center"});
      return;
    }
    const metrics=[...document.querySelectorAll(".mrow")].map(r=>({name:r.children[0].value.trim(),before:r.children[1].value.trim(),after:r.children[2].value.trim()})).filter(x=>x.name&&(x.before||x.after));
    const selectedCover=fd.get("coverView")||existing?.coverView||"";
    if(!selectedCover){
      if(submitBtn){submitBtn.disabled=false;submitBtn.textContent=oldSubmitText;}
      toast("请选择一张对比图作为首页封面");
      document.querySelector(".up3")?.scrollIntoView({behavior:"smooth",block:"center"});
      return;
    }
    const coverView=selectedCover;
    const chosenInput={front:f.elements.frontImage,side:f.elements.sideImage,back:f.elements.backImage}[coverView];
    const existingCover=existing?.comparisons?.[coverView]?.image;
    if(!(chosenInput?.files?.[0])&&!existingCover){
      if(submitBtn){submitBtn.disabled=false;submitBtn.textContent=oldSubmitText;}
      toast("你选择的首页封面方向还没有上传对比图");
      document.querySelector(".up3")?.scrollIntoView({behavior:"smooth",block:"center"});
      return;
    }

    try{
      showCloudState();
      state.textContent=wasEditing?"正在准备更新案例…":"正在创建云端案例…";
      if(submitBtn)submitBtn.textContent=wasEditing?"正在更新…":"正在创建…";
      const draft=await api("save-case",{method:"POST",body:{
        id:editingCaseId||undefined,display_name:displayName,category:fd.get("category"),
        height_cm:(fd.get("height")||"").trim(),start_weight_kg:(fd.get("startWeight")||"").trim(),age:(fd.get("age")||"").trim(),
        cover_view:coverView,process_text:fd.get("processText")||"",metrics,status:wasEditing?"published":"draft"
      }});
      const caseId=draft.case.id;
      const comparisonInputs=[["正面","comparison_front",f.elements.frontImage],["侧面","comparison_side",f.elements.sideImage],["背面","comparison_back",f.elements.backImage]];
      for(const [label,kind,input] of comparisonInputs){
        if(input?.files?.[0]){
          state.textContent="正在上传"+label+"对比图…";
          if(submitBtn)submitBtn.textContent="上传"+label+"图…";
          await uploadFile(caseId,kind,input.files[0],true);
        }
      }
      const processFiles=[...(f.elements.processImages.files||[])];
      for(let i=0;i<processFiles.length;i++){
        state.textContent="正在上传训练照片 "+(i+1)+"/"+processFiles.length;
        if(submitBtn)submitBtn.textContent="上传训练照片…";
        await uploadFile(caseId,"process",processFiles[i],false);
      }
      const chatFiles=[...(f.elements.chatImages.files||[])];
      for(let i=0;i<chatFiles.length;i++){
        state.textContent="正在上传反馈截图 "+(i+1)+"/"+chatFiles.length;
        if(submitBtn)submitBtn.textContent="上传反馈截图…";
        await uploadFile(caseId,"chat",chatFiles[i],false);
      }
      state.textContent="正在完成保存…";
      if(submitBtn)submitBtn.textContent="正在完成…";
      await api("save-case",{method:"POST",body:{
        id:caseId,display_name:displayName,category:fd.get("category"),
        height_cm:(fd.get("height")||"").trim(),start_weight_kg:(fd.get("startWeight")||"").trim(),age:(fd.get("age")||"").trim(),
        cover_view:coverView,process_text:fd.get("processText")||"",metrics,status:"published"
      }});
      editingCaseId=null;f.reset();document.querySelector("#metrics").innerHTML="";closeModal();
      await loadCloud();
      if(wasEditing&&!document.querySelector("#detail").classList.contains("hidden"))openCase(caseId);
      toast(wasEditing?"案例已同步更新":"案例已上传到云端");
    }catch(err){
      console.error(err);
      const message=friendlyError(err);
      cloudState(message,"err");
      toast(message);
    }finally{
      if(submitBtn){submitBtn.disabled=false;submitBtn.textContent=oldSubmitText;}
    }
  };

  const explicitSaveButton=form.querySelector('button[type="submit"], .primary');
  if(explicitSaveButton){
    explicitSaveButton.type="button";
    explicitSaveButton.addEventListener("click",e=>{
      e.preventDefault();
      e.stopPropagation();
      form.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true}));
    });
  }

  document.documentElement.dataset.casePatchReady="1";
  cases=[];
  render();
  loadCloud();
})();
(function(){
  'use strict';

  let dialog=null;
  let returnFocus=null;

  function context(){
    return {
      title:document.getElementById('page-title')?.textContent?.trim()||'当前页面',
      hash:location.hash||'#/coach',
      time:new Date().toLocaleString('zh-CN',{hour12:false}),
    };
  }

  function fallbackCopy(text){
    const area=document.createElement('textarea');
    area.value=text;
    area.setAttribute('readonly','');
    area.style.position='fixed';
    area.style.opacity='0';
    area.style.pointerEvents='none';
    document.body.appendChild(area);
    area.focus();
    area.select();
    let copied=false;
    try{copied=document.execCommand('copy');}catch(_){copied=false;}
    area.remove();
    return copied;
  }

  function feedbackText(value){
    const current=context();
    return `7Fit 问题反馈\n页面：${current.title}\n地址：${current.hash}\n时间：${current.time}\n\n问题描述：\n${value.trim()||'（未填写）'}`;
  }

  function renderContact(){
    const href=String(window.V14_FEEDBACK_URL||'').trim();
    const link=dialog?.querySelector('[data-feedback-contact]');
    if(!link)return;
    if(href){
      link.href=href;
      link.hidden=false;
    }else{
      link.hidden=true;
    }
  }

  function create(){
    if(dialog)return dialog;
    dialog=document.createElement('dialog');
    dialog.className='feedback-dialog';
    dialog.setAttribute('aria-labelledby','feedback-title');
    dialog.innerHTML=`<form class="feedback-panel" method="dialog">
      <header class="feedback-head"><div><span>问题现场</span><h2 id="feedback-title">反馈问题</h2></div><button type="button" data-feedback-close aria-label="关闭反馈">×</button></header>
      <div class="feedback-body"><p class="feedback-context" data-feedback-context></p><p class="feedback-help">反馈内容会带上当前页面和时间，方便快速定位。</p><label for="feedback-description">问题描述</label><textarea id="feedback-description" data-feedback-description rows="5" placeholder="告诉我刚才发生了什么，以及你原本想完成什么。"></textarea><p class="feedback-status" data-feedback-status role="status" aria-live="polite"></p></div>
      <footer class="feedback-actions"><button type="button" data-feedback-close>先不反馈</button><button class="primary" type="button" data-feedback-copy>复制反馈内容</button><a data-feedback-contact hidden target="_blank" rel="noreferrer">联系产品负责人</a></footer>
    </form>`;
    document.body.appendChild(dialog);
    dialog.querySelectorAll('[data-feedback-close]').forEach(button=>button.addEventListener('click',close));
    dialog.querySelector('[data-feedback-copy]').addEventListener('click',copy);
    dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
    dialog.addEventListener('click',event=>{if(event.target===dialog)close();});
    return dialog;
  }

  function open(){
    const target=create(),current=context();
    returnFocus=document.activeElement;
    target.querySelector('[data-feedback-context]').textContent=`页面：${current.title} · ${current.hash}`;
    target.querySelector('[data-feedback-status]').textContent='';
    renderContact();
    target.showModal();
    target.querySelector('[data-feedback-description]').focus();
  }

  function close(){
    if(!dialog?.open)return;
    dialog.close();
    if(returnFocus?.isConnected)returnFocus.focus();
  }

  async function copy(){
    const value=dialog?.querySelector('[data-feedback-description]')?.value||'';
    const text=feedbackText(value);
    let copied=false;
    if(navigator.clipboard?.writeText){
      try{await navigator.clipboard.writeText(text);copied=true;}catch(_){copied=false;}
    }
    if(!copied)copied=fallbackCopy(text);
    const status=dialog?.querySelector('[data-feedback-status]');
    if(status)status.textContent=copied?'反馈内容已复制，可以发给产品负责人。':'暂时无法自动复制，请手动选择内容。';
  }

  document.addEventListener('click',event=>{
    const trigger=event.target.closest('[data-feedback-open]');
    if(!trigger)return;
    event.preventDefault();
    open();
  });

  window.V14Feedback={open,close,feedbackText};
})();

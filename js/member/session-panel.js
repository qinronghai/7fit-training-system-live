(function(){
  'use strict';

  const esc = value => String(value ?? '').replace(/[&<>"']/g, character =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[character]);
  const actionCatalog = () => window.V14_DATA?.actions || {};
  const countWithSet = list => list.reduce((total, segment) => total + segment.sets.length, 0);
  const button = (command, text, value = '', options = '') =>
    `<button type="button" data-session-tool="${command}" data-value="${esc(value)}" ${options}>${text}</button>`;
  const modeLabel = mode => ({ reps: '次数', perSide: '次数/侧', duration: '时长（秒）' })[mode];
  const modeFor = value => window.V14SessionRecording.modeFor(value);
  const setLabel = (set, mode) => window.V14SessionRecording.setLabel(set, mode);

  function detailFields(id){
    const data = window.V14_DATA || {};
    return data.actionDetails?.[id]?.fields || data.supportDetails?.[id]?.fields || data.coreDetails?.[id]?.fields || {};
  }

  function amountFor(item){
    if (item.execution) {
      const segments = item.execution.segments || [];
      return segments.flatMap(segment => segment.sets.map(set => setLabel(set, segment.mode))).slice(0, 4).join(' / ');
    }
    return [item.sets != null ? `${item.sets} 组` : '', item.loadKg != null ? `${item.loadKg} kg` : '', item.reps != null ? `${item.reps} 次` : ''].filter(Boolean).join(' × ');
  }

  function prescriptions(item){
    const plan = item.plannedPrescriptionSnapshot || {};
    const raw = plan.rawText || [plan.sets != null ? `${plan.sets} 组` : '', plan.reps != null ? `${plan.reps} 次` : ''].filter(Boolean).join(' × ');
    const facts = [[plan.restSeconds !== null && plan.restSeconds !== undefined, `组间 ${plan.restSeconds} 秒`],
      [plan.rir != null, `RIR ${plan.rir}`], [plan.tempo, `节奏 ${plan.tempo}`], [plan.loadPrescription, plan.loadPrescription]];
    return `<div class="session-coach-prescription"><strong>${raw ? esc(raw) : '处方未记录'}</strong>${
      facts.some(([value]) => value) ? `<p>${esc(facts.filter(([value]) => value).map(([,label]) => label).join(' · '))}</p>` : ''}</div>`;
  }

  function segmentsMarkup(segments, editable = false){
    let position = 0;
    return segments.map((segment, index) => {
      if (!segment.sets.length && !segment.note) return '';
      const entries = segment.sets.map((entry, setIndex) => {
        position++;
        return `<li><span>第 ${position} 组</span><strong>${esc(setLabel(entry, segment.mode))}</strong>${
          editable ? button('edit', '修改', `${index}:${setIndex}`, `aria-label="修改第 ${position} 组"`) : ''}</li>`;
      }).join('');
      return `<div class="session-coach-segment"><strong>${esc(segment.actionSnapshot.name)}</strong>${
        entries ? `<ol class="session-coach-sets">${entries}</ol>` : ''}${segment.note ? `<p>${esc(segment.note)}</p>` : ''}</div>`;
    }).join('');
  }

  function create(root, session, items, { draft, replacements, batchValues, onOverview }){
    const content = root.querySelector('[data-session-detail-content]');
    const base = content.querySelector('[data-session-course-view]');
    const screen = content.querySelector('[data-session-coach-view]');
    const live = root.querySelector('[data-session-coach-status]');
    const model = window.V14SessionRecording.create(items, draft?.model);
    const inputs = new Map(Object.entries(draft?.inputs || {}));
    let item = items.find(value => value.id === draft?.itemId) || null;
    let view = 'course', origin = 'course', recordScroll = 0, courseScroll = 0, browseScroll = 0;
    let query = '', source = 'candidates', purpose = 'browse', summary = null, pending = null, editor = null;
    let lastItems = [], overlayReturn = null;
    const tell = text => { live.textContent = text; };
    const focus = (container, selector) => container?.querySelector(selector)?.focus({ preventScroll:true });
    const entry = () => model.forItem(item.id);
    const find = id => items.find(value => value.id === id);
    const returnFocus = value => [...base.querySelectorAll('[data-session-tool="record"]')].find(node => node.dataset.value === value);
    const readingList = () => items.filter(candidate => candidate.plannedActionSnapshot && (candidate.phase === 'PREP') === (item.phase === 'PREP'));
    const activeId = id => model.forItem(id).active?.actionId;

    function storedValues(set, mode){
      const amount = mode === 'duration' ? set?.durationSeconds : set?.reps;
      return { amount: amount != null ? String(amount) : '', loadKg: set?.loadKg != null ? String(set.loadKg) : '' };
    }

    function formInputs(mode, values, editing = false){
      const label = modeLabel(mode);
      const baseId = editing ? 'coach-edit' : 'coach-next';
      return `<div class="session-coach-fields"><label for="${baseId}-load">重量 kg<input id="${baseId}-load" data-log-load inputmode="decimal" maxlength="8" value="${esc(values.loadKg)}" aria-label="${editing ? '修改' : '本组'}重量 kg"></label><label for="${baseId}-amount">${label}<input id="${baseId}-amount" data-log-amount inputmode="numeric" maxlength="4" value="${esc(values.amount)}" aria-label="${editing ? '修改' : '本组'}${label}"></label></div>`;
    }

    function recordMarkup(){
      const { active, mode, segments } = entry();
      const current = model.count(item.id) + 1;
      const catalogEntry = actionCatalog()[active.actionId] || {};
      const fields = detailFields(active.actionId);
      const previous = model.previous(item.id);
      const values = inputs.get(item.id) || storedValues(previous, mode);
      const list = readingList(), pos = list.indexOf(item);
      const match = previousRecord(active.actionId, lastItems);
      const activeNote = !entry().freshAction && segments.at(-1)?.actionSnapshot.actionId === active.actionId ? segments.at(-1).note : '';
      return `<div class="session-coach-navigation">${button('course', '课程总览')}${button('record', '上一项', list[pos-1]?.id, pos===0?'disabled':'')}${button('record', '下一项', list[pos+1]?.id, pos===list.length-1?'disabled':'')}</div>
        <div class="session-coach-context"><div><h3 tabindex="-1">${esc(active.name)}</h3><p>${esc([active.equipment, catalogEntry.zone, active.stationId].filter(Boolean).join(' · '))}</p></div>${button('replace', '换动作')}</div>
        ${active.actionId === item.plannedActionId ? prescriptions(item) : `<p class="session-coach-original">原计划 · ${esc(item.plannedActionSnapshot.name)}</p>${prescriptions(item)}`}
        <p class="session-coach-previous" data-log-previous ${match.length?'':'hidden'}>${match.length?'上次实练 · '+esc(match.join(' / ')):''}</p>
        ${fields['教练口令'] ? `<p class="session-coach-cue">${esc(fields['教练口令'])}</p>` : ''}
        <section class="session-coach-log" aria-labelledby="session-current-set"><div class="session-coach-context"><h4 id="session-current-set">第 ${current} 组</h4>${previous && !inputs.has(item.id)?'<span>沿用上一组</span>':''}</div>
        ${formInputs(mode, values)}<p class="session-coach-error" data-log-error role="alert" hidden></p><div class="session-coach-navigation">${button('log-done','仅记完成')}${button('log',`记第 ${current} 组`,'','class="primary" data-log-submit')}</div></section>
        <div class="session-coach-navigation">${button('show-detail', '动作详情', active.actionId)}<label class="session-coach-mode">记录方式<select data-log-mode aria-label="记录方式">
        ${Object.entries({reps:'次数',perSide:'次数/侧',duration:'时长'}).map(([id,label])=>`<option value="${id}" ${mode===id?'selected':''}>${label}</option>`).join('')}</select></label></div>
        <details class="session-coach-note"><summary>动作备注</summary><textarea data-log-note aria-label="动作备注" rows="2" maxlength="2000">${esc(activeNote)}</textarea></details>
        ${segments.some(segment=>segment.sets.length||segment.note)?`<section class="session-coach-history"><h4>实练记录 · ${current-1} 组</h4>${segmentsMarkup(segments,true)}</section>`:''}`;
    }

    function previousRecord(actionId, values){
      return values.flatMap(value => value.execution
        ? value.execution.segments.filter(segment => segment.actionSnapshot.actionId === actionId && segment.sets.length)
            .map(segment => segment.sets.map(set => setLabel(set, segment.mode)).slice(0, 4).join(' / '))
        : (value.performedActionId || value.plannedActionId) === actionId ? [amountFor(value)] : []).filter(Boolean);
    }

    function resultRows(){
      const options = purpose === 'replace' ? replacements(item, activeId) : null;
      const formal = actionCatalog();
      const entries = source === 'candidates' ? options.recommended.map(id => ({ id, title: formal[id]?.name || options.byId.get(id)?.name })) :
        (window.V15TemplateSearch?.search({ q:query, kind:'action', limit:10000 }) || [])
          .filter(value => value.kind === 'action' || value.kind === 'opengym-action');
      const sorted = entries.map(result => ({ ...result, allowed: options?.byId.has(result.id) }))
        .sort((a, b) => Number(!!b.allowed) - Number(!!a.allowed));
      const visible = sorted.slice(0, 35);
      if (!visible.length) return `<p class="member-state-note">${source === 'candidates' ? '暂无现有候选，可以搜索动作库。' : '没有匹配的动作，试试其他关键词。'}</p>`;
      return `<p class="session-coach-result-count">${sorted.length > visible.length ? `显示前 ${visible.length} 项 · 可缩小搜索范围` : `${visible.length} 项`}</p><ul class="session-coach-results">${visible.map(result => {
        const a = formal[result.id] || {};
        const available = result.allowed && result.id !== activeId(item.id);
        const label = result.title || a.name || result.id;
        return `<li><div><strong>${esc(label)}</strong><p>${esc([a.equipment,a.zone].filter(Boolean).join(' · ') || result.subtitle || '')}</p>
          ${purpose === 'replace' && !available ? `<p>${esc(result.id === activeId(item.id) ? '当前动作' : options.reason(a))}</p>` : ''}</div>
          <div>${button('result-detail', '查看', result.id, `aria-label="查看 ${esc(label)}"`)}${available ? button('choose', '换成此动作', result.id, `aria-label="换成 ${esc(label)}"`) : ''}</div></li>`;
      }).join('')}</ul>`;
    }

    function searchMarkup(){
      return `<div class="session-coach-navigation">${button('close-search','返回课程')}</div><h3 tabindex="-1">${purpose === 'replace' ? '替换动作' : '搜索动作库'}</h3>
        ${purpose === 'replace' ? `<p>当前 · ${esc(entry().active.name)}</p><div class="session-coach-navigation" role="group" aria-label="替换来源">
        ${button('source','现有候选','candidates',`aria-pressed="${source === 'candidates'}"`)}${button('source','搜索动作库','catalog',`aria-pressed="${source === 'catalog'}"`)}</div>` : ''}
        ${source === 'catalog' ? `<label class="session-coach-search">搜索动作<input type="search" data-coach-search maxlength="120" placeholder="名称、器械、肌群或动作模式" value="${esc(query)}"></label>` : ''}
        <section data-coach-results aria-live="polite">${resultRows()}</section>`;
    }

    function detailMarkup(){
      const id = summary.id, a = actionCatalog()[id], fields = detailFields(id);
      const draftItem = item ? entry().active : null;
      const external = (window.V14_OPENGYM?.candidates || []).find(value => value.id === id);
      const snapshot = a || external || (draftItem?.actionId === id ? draftItem : {});
      const muscle = window.V14Anatomy?.get?.(id)?.primary || snapshot.primaryMuscles || [];
      const rows = [['器械',snapshot.equipment],['场地',[snapshot.zone,snapshot.stationId].filter(Boolean).join(' · ')],['动作模式',snapshot.pattern],['主要肌群',Array.isArray(muscle) ? muscle.join('、') : muscle],
        ['教练口令',fields['教练口令']],['执行步骤',fields['执行步骤'] || external?.instructions?.join('\n')],['常见错误',fields['常见错误']],['动作限制',fields['禁忌 / 限制']]];
      const allow = summary.from === 'search' && purpose === 'replace' && replacements(item,activeId).byId.has(id) && activeId(item.id) !== id;
      return `${button('detail-return','返回')}<h3 tabindex="-1">${esc(snapshot.name || id)}</h3>
        <dl class="session-coach-facts">${rows.filter(([,value]) => value).map(([key,value])=>`<div><dt>${key}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl>
        ${allow ? button('choose','换成此动作',id,'class="primary"') : ''}`;
    }

    function render(next, top = 0, selected = ''){
      view = next;
      base.hidden = next !== 'course';
      const subsidiary = next === 'search' || next === 'detail';
      root.querySelector('[data-session-footer]').hidden = subsidiary;
      root.querySelector('[data-session-tool="browse"]').hidden = subsidiary;
      if(next === 'course'){
        const logged = new Set(model.patches().map(patch=>patch.id));
        for(const row of base.querySelectorAll('[data-session-item]')){
          row.querySelector('.member-session-batch').hidden=logged.has(row.dataset.sessionItem);
        }
        onOverview();
      }
      screen.hidden = next === 'course';
      const markup = { record: recordMarkup, search: searchMarkup, detail: detailMarkup };
      if (markup[next]) screen.innerHTML = markup[next]();
      else screen.replaceChildren();
      content.scrollTop = top;
      if (selected) focus(screen, selected);
    }

    function start(id){
      if (view === 'course') courseScroll = content.scrollTop;
      item = find(id) || items.find(value=>value.phase !== 'PREP' && value.plannedActionSnapshot) || items.find(value=>value.plannedActionSnapshot);
      if (!item?.plannedActionSnapshot) return;
      if(batchValues()[item.id]){
        render('course',courseScroll);
        const row = returnFocus(item.id)?.closest('[data-session-item]');
        const batch = row?.querySelector('.member-session-batch');
        if(batch){batch.open=true;batch.scrollIntoView({block:'nearest'});}
        tell('这个动作已有整项补记，清空补记后可改为逐组记录。');
        return;
      }
      render('record',0,'h3');
    }

    function openSearch(type){
      purpose = type;
      origin = view;
      recordScroll = content.scrollTop;
      query = '';
      source = type === 'replace' ? 'candidates' : 'catalog';
      render('search',0,type === 'replace' ? 'h3' : '[data-coach-search]');
    }

    function readInputs(container, onlyDone, mode, allowEmpty = false){
      const amount = container.querySelector('[data-log-amount]').value.trim();
      const load = container.querySelector('[data-log-load]').value.trim();
      const message = container.querySelector('[data-log-error]');
      let error = '';
      if (!onlyDone) {
        const max = mode === 'duration' ? 3600 : 300;
        if (amount && (!/^\d+$/.test(amount) || Number(amount) < 1 || Number(amount) > max)) error = `请填写 1–${max} ${mode === 'duration' ? '秒' : '次'}。`;
        else if (load && (!/^\d+(\.\d{1,2})?$/.test(load) || Number(load) > 2000)) error = '请填写 0–2000 kg，最多两位小数。';
        else if (!amount && !load && !allowEmpty) error = '填写重量或实际次数，也可以仅记完成。';
      }
      if (error) {
        message.hidden = false;
        message.textContent = error;
        return null;
      }
      const value = onlyDone || !amount ? null : Number(amount);
      return { reps: mode === 'duration' ? null : value, durationSeconds: mode === 'duration' ? value : null, loadKg: onlyDone || !load ? null : Number(load) };
    }

    function saveSet(onlyDone){
      const record = readInputs(screen, onlyDone, entry().mode);
      if (!record) return;
      if (!model.recordSet(item.id, record)) {
        const message = screen.querySelector('[data-log-error]');
        message.hidden = false;
        message.textContent = '一个动作槽位最多记录 100 组。';
        return;
      }
      inputs.delete(item.id);
      render('record',content.scrollTop,'[data-log-submit]');
      tell(`已记录第 ${model.count(item.id)} 组`);
    }

    function showOverlay(title, contentHtml, confirm, label){
      const node = root.querySelector('[data-session-coach-overlay]');
      node.innerHTML = `<h3>${esc(title)}</h3>${contentHtml}<div class="session-coach-navigation">${button('overlay-close', '返回')}${button(confirm,label,'','class="primary"')}</div>`;
      if (!node.open) { overlayReturn = document.activeElement; node.showModal(); }
      focus(node,'[data-session-tool="overlay-close"]');
      return node;
    }

    function confirmAction(id){
      const candidate = replacements(item, activeId).byId.get(id);
      if (!candidate || id === activeId(item.id)) return;
      pending = id;
      const count = model.count(item.id), pendingInput = inputs.has(item.id);
      showOverlay(`换成${candidate.name}？`, `<p>${count ? `已记的 ${count} 组保留在各自的动作下。` : ''}下一组开始记录新动作。${pendingInput ? '尚未确认的本组输入会清空。' : ''}</p>`, 'apply', '确认替换');
    }

    function closeOverlay(){
      root.querySelector('[data-session-coach-overlay]').close();
    }

    function applyAction(){
      const candidate = replacements(item, activeId).byId.get(pending);
      if (!candidate) { closeOverlay(); return; }
      const originalMode = modeFor(item.plannedPrescriptionSnapshot?.rawText || '');
      const fields = detailFields(pending);
      const alternateDose = fields['来源处方 / RPE'] || fields['推荐剂量'] || '';
      model.changeAction(item.id, candidate, alternateDose ? modeFor(alternateDose) : originalMode);
      closeOverlay();
      inputs.delete(item.id);
      render('record',recordScroll,'h3');
      tell(`下一组记录${candidate.name}`);
    }

    function editRecord(id){
      const [segmentIndex,setIndex] = id.split(':').map(Number);
      const segment = entry().segments[segmentIndex];
      editor = { segmentIndex,setIndex,mode:segment.mode };
      showOverlay('修改实练组', formInputs(segment.mode,storedValues(segment.sets[setIndex],segment.mode),true) +
        '<p class="session-coach-error" data-log-error role="alert" hidden></p>' + button('delete-set','删除这组'), 'save-edit','保存修改');
    }

    function finishEdit(remove){
      const overlay = root.querySelector('[data-session-coach-overlay]');
      const { segmentIndex, setIndex, mode } = editor;
      if (remove) model.removeSet(item.id,segmentIndex,setIndex);
      else {
        const value = readInputs(overlay,false,mode,true);
        if (!value) return;
        model.updateSet(item.id,segmentIndex,setIndex,value);
      }
      closeOverlay();
      render('record',content.scrollTop,'[data-log-submit]');
      tell(remove ? '已删除这组' : '已修改实练');
    }

    const handle = (control) => {
      const command = control.dataset.sessionTool;
      const value = control.dataset.value;
      switch (command) {
        case 'record': start(value); break;
        case 'course': render('course',courseScroll); returnFocus(item.id)?.focus({preventScroll:true}); break;
        case 'section': root.querySelector('[data-session-stage="' + value + '"]')?.scrollIntoView({ block:'start' }); break;
        case 'replace': openSearch('replace'); break;
        case 'browse': openSearch('browse'); break;
        case 'source': source=value;query='';render('search',0,source==='catalog'?'[data-coach-search]':null); break;
        case 'close-search': render(origin,recordScroll,origin==='record'?'[data-session-tool="replace"]':''); if(origin==='course')focus(root,'[data-session-tool="browse"]');break;
        case 'show-detail':
        case 'result-detail': browseScroll=content.scrollTop;summary={id:value,from:view};render('detail',0,'h3');break;
        case 'detail-return': render(summary.from,browseScroll,summary.from==='record'?'[data-session-tool="show-detail"]':'[data-coach-search]');break;
        case 'choose': confirmAction(value); break;
        case 'overlay-close': closeOverlay(); break;
        case 'apply': applyAction(); break;
        case 'log-done': saveSet(true); break;
        case 'log': saveSet(false); break;
        case 'edit': editRecord(value); break;
        case 'save-edit': finishEdit(false); break;
        case 'delete-set': finishEdit(true); break;
        case 'clear-batch': {
          const row=control.closest('[data-session-item]');
          for(const input of row.querySelectorAll('[data-session-actual], [data-session-prep-replacement], [data-session-replacement]'))input.value='';
          const replacement=row.querySelector('[data-session-prep-replacement]');
          if(replacement)replacement.dispatchEvent(new Event('change',{bubbles:true}));
          tell('已清空整项补记');
          break;
        }
        case 'save-draft': tell(saveDraft() ? '草稿已保存' : '本机无法保存草稿，请保持面板打开。');break;
        case 'discard': window.V14SessionDraft.clear();closeOverlay();root.close();break;
        case 'draft-close': if(saveDraft()){closeOverlay();root.close();}else tell('本机无法保存草稿，请保持面板打开。');break;
        default: return false;
      }
      return true;
    };

    function input(control){
      if (control.matches('[data-coach-search]')) {
        query = control.value;
        screen.querySelector('[data-coach-results]').innerHTML = resultRows();
      } else if (control.matches('[data-log-load], [data-log-amount]') && view === 'record' && screen.contains(control)) {
        const fields = { loadKg:screen.querySelector('[data-log-load]').value.trim(), amount:screen.querySelector('[data-log-amount]').value.trim() };
        const initial = storedValues(model.previous(item.id),entry().mode);
        if ((!fields.loadKg&&!fields.amount) || (fields.loadKg===initial.loadKg&&fields.amount===initial.amount)) inputs.delete(item.id);
        else inputs.set(item.id,fields);
      } else if (control.matches('[data-log-note]')) model.note(item.id,control.value);
    }

    function saveDraft(){
      return window.V14SessionDraft.save({ model:model.snapshot(), inputs:Object.fromEntries(inputs), batch:batchValues(), itemId:item?.id || null });
    }

    function requestClose(){
      if (session.status !== 'PLANNED' || (!model.patches().length && !inputs.size && !Object.keys(batchValues()).length)) return false;
      const node = showOverlay('离开本节课？','<p>保存草稿后，可以在本机继续记录。</p>','draft-close','保存草稿并关闭');
      node.querySelector('div').prepend(document.createRange().createContextualFragment(button('discard','放弃草稿')));
      return true;
    }

    function confirmCompletion(){
      if (inputs.size) {
        const id = inputs.keys().next().value;
        start(id);
        const message = screen.querySelector('[data-log-error]');
        message.hidden = false;
        message.textContent = '这组输入还未记录。请记下本组，或清空输入后完成。';
        return true;
      }
      const patches = model.patches();
      const count = patches.reduce((total, patch) => total + countWithSet(patch.execution.segments),0);
      const batches = Object.keys(batchValues()).length;
      const details = [count?`逐组记录 ${count} 组`:'',batches?`整项补记 ${batches} 个动作`:''].filter(Boolean);
      const node = showOverlay('完成本节课？',`<p>${details.length ? details.join(' · ')+'。' : '本节还没有实练数据。'}未记录的实练保留为空。</p>`,'complete-confirm','确认完成');
      if(!patches.length&&!batches)node.querySelector('.session-coach-navigation').insertAdjacentHTML('afterbegin',button('complete-as-planned','按原计划完成'));
      return true;
    }

    return {
      model, handle, input, confirmCompletion, requestClose, saveDraft, closeOverlay,
      showCourse(){render('course',courseScroll);},
      setPrevious(values) {
        lastItems = Array.isArray(values) ? values : [];
        const element = screen.querySelector('[data-log-previous]');
        if(element){
          const match=previousRecord(entry().active.actionId,lastItems);
          element.hidden=!match.length;
          if(match.length)element.textContent='上次实练 · '+match.join(' / ');
        }
      },
      restore() { if (draft && item?.plannedActionSnapshot) { start(item.id); tell('已恢复本机草稿'); } },
      modeChange(control) {
        if (!item || !control.matches('[data-log-mode]')) return;
        const current = entry();
        if (current.mode === control.value) return;
        if (inputs.has(item.id)) {
          control.value=current.mode;
          tell('先记下或清空本组，再切换记录方式。');
          return;
        }
        current.mode = control.value;
        current.freshAction = true;
        inputs.delete(item.id);
        render('record',content.scrollTop,'[data-log-mode]');
      },
      overlayClosed() { if (overlayReturn?.isConnected) overlayReturn.focus({preventScroll:true}); overlayReturn = null; },
    };
  }

  window.V14SessionPanel = { create, prescriptions, segmentsMarkup, amountFor };
})();

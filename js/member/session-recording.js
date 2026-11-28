(function(){
  'use strict';

  function modeFor(prescription){
    if (/每侧|\/\s*侧/.test(prescription) && /次/.test(prescription)) return 'perSide';
    return /秒|分钟/.test(prescription) && !/次/.test(prescription) ? 'duration' : 'reps';
  }

  function create(items, restored = {}){
    const inventory = new Map(items.map(item => [item.id, item]));
    const entries = new Map();
    for (const [id, entry] of Object.entries(restored || {})) {
      if (inventory.has(id) && entry?.active?.actionId && Array.isArray(entry.segments)) entries.set(id, entry);
    }

    function forItem(id){
      if (!entries.has(id)) {
        const item = inventory.get(id);
        const mode = modeFor(item.plannedPrescriptionSnapshot?.rawText || '');
        entries.set(id, { active: item.plannedActionSnapshot, mode, segments: [], freshAction: false });
      }
      return entries.get(id);
    }

    function activeSegment(entry){
      const latest = entry.segments.at(-1);
      if (!entry.freshAction && latest?.actionSnapshot.actionId === entry.active?.actionId) return latest;
      const segment = { actionSnapshot: entry.active, mode: entry.mode, sets: [], note: null };
      entry.segments.push(segment);
      entry.freshAction = false;
      return segment;
    }

    function count(id){
      return forItem(id).segments.reduce((total, segment) => total + segment.sets.length, 0);
    }

    function previous(id){
      const entry = forItem(id);
      const latest = entry.segments.at(-1);
      return !entry.freshAction && latest?.actionSnapshot.actionId === entry.active?.actionId ? latest?.sets.at(-1) : null;
    }

    function recordSet(id, set){
      if (count(id) >= 100 || !forItem(id).active) return false;
      activeSegment(forItem(id)).sets.push(set);
      return true;
    }

    function updateSet(id, segmentIndex, setIndex, set){
      forItem(id).segments[segmentIndex].sets[setIndex] = set;
    }

    function removeSet(id, segmentIndex, setIndex){
      forItem(id).segments[segmentIndex].sets.splice(setIndex, 1);
    }

    function changeAction(id, snapshot, mode){
      const entry = forItem(id);
      if (entry.active?.actionId === snapshot.actionId) return;
      entry.active = snapshot;
      entry.mode = mode;
      entry.freshAction = true;
    }

    function note(id, value){
      const entry = forItem(id);
      if (value || (!entry.freshAction && entry.segments.length)) activeSegment(entry).note = value || null;
    }

    function patches(){
      return Array.from(entries).flatMap(([id, entry]) => {
        const segments = entry.segments.filter(segment => segment.sets.length || segment.note);
        if (!segments.length && entry.active?.actionId === inventory.get(id).plannedActionId) return [];
        return [{ id, execution: { schemaVersion: 1, segments } }];
      });
    }

    return { forItem, count, previous, recordSet, updateSet, removeSet, changeAction, note, patches, snapshot: () => Object.fromEntries(entries) };
  }

  function setLabel(set, mode){
    const units = mode === 'perSide' ? '次/侧' : '次';
    const parts = [];
    if (set.loadKg != null) parts.push(`${set.loadKg} kg`);
    if (set.reps != null) parts.push(`${set.reps} ${units}`);
    if (set.durationSeconds != null) parts.push(`${set.durationSeconds} 秒`);
    return parts.join(' × ') || '已完成 · 数值未记录';
  }

  window.V14SessionRecording = { create, modeFor, setLabel };
})();

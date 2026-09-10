(function(){
  'use strict';

  const WINDOWS=Object.freeze({
    L1:Object.freeze(['P1']),
    L2:Object.freeze(['P2','P1']),
    L3:Object.freeze(['P3','P2','P1']),
    L4:Object.freeze(['P4','P3','P2','P1']),
  });
  const LEVELS=Object.freeze(['L1','L2','L3','L4']);
  const GRADES=Object.freeze(['P1','P2','P3','P4']);

  function allowedGrades(level){
    return (WINDOWS[level]||[]).slice();
  }

  function isAllowed(level,grade){
    return allowedGrades(level).includes(grade);
  }

  function gradeRank(level,grade){
    const index=allowedGrades(level).indexOf(grade);
    return index<0?Number.POSITIVE_INFINITY:index;
  }

  function sessionLevelsForGrade(grade){
    return LEVELS.filter(level=>WINDOWS[level].includes(grade));
  }

  function sortIds(ids,level,details){
    return (Array.isArray(ids)?ids:[])
      .filter(id=>details?.[id]&&isAllowed(level,details[id].prepGrade))
      .slice()
      .sort((a,b)=>gradeRank(level,details[a].prepGrade)-gradeRank(level,details[b].prepGrade)||String(a).localeCompare(String(b)));
  }

  window.V14PrepGrade={WINDOWS,LEVELS,GRADES,allowedGrades,isAllowed,gradeRank,sessionLevelsForGrade,sortIds};
})();

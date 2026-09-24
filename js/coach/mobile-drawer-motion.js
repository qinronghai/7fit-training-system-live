(function(){
  'use strict';

  const M=window.V14CoachModules=window.V14CoachModules||{};
  const ua=navigator.userAgent||'';
  const isIOS=/iPhone|iPad|iPod/i.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);

  function activate(root){
    if(!root||!isIOS||!window.matchMedia('(max-width:620px)').matches)return false;
    root.classList.add('ios-no-drawer-motion');
    return true;
  }

  function deactivate(root){
    root?.classList.remove('ios-no-drawer-motion');
  }

  M.DrawerMotion={activate,deactivate};
})();

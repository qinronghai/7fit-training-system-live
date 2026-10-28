(function() {
  'use strict';

  // Overnight member lazy loading: the five member scripts (~101KB total)
  // used to load upfront on every page. They now load only on first member
  // need, in their original index.html order, so their globals
  // (V14MemberAPI, V14CoachModules.MemberCenter, V14CoachModules.MemberSelector)
  // are preserved exactly. Non-member routes never request these files.
  // If loading fails, the page shows a retry state instead of a broken
  // member view; retry re-attempts the same original files (the fallback),
  // and non-member routes keep working regardless.
  var FILES = [
    'js/member/api.js',
    'js/member/session.js',
    'js/member/center.js',
    'js/member/snapshot-client.js',
    'js/member/selector.js',
  ];
  var state = 'idle'; // idle | loading | ready | failed
  var pending = null;
  var failedFile = '';

  function loadOne(src) {
    return new Promise(function(resolve, reject) {
      var script = document.createElement('script');
      script.src = src;
      script.onload = function() { resolve(); };
      script.onerror = function() { reject(new Error('member script failed: ' + src)); };
      document.head.appendChild(script);
    });
  }

  function loadAll() {
    var chain = Promise.resolve();
    FILES.forEach(function(src) {
      chain = chain.then(function() { return loadOne(src); });
    });
    return chain;
  }

  function ensure() {
    if (state === 'ready') return Promise.resolve();
    if (state === 'loading') return pending;
    state = 'loading';
    failedFile = '';
    pending = loadAll().then(function() {
      state = 'ready';
      return true;
    }).catch(function(error) {
      state = 'failed';
      failedFile = String(error && error.message || error || '');
      throw error;
    });
    return pending;
  }

  function isReady() { return state === 'ready'; }
  function isFailed() { return state === 'failed'; }

  // A route needs member scripts when it is a member page, or when any
  // coach page carries ?memberId (F111 composer member context and the
  // session-page "保存到会员" button both read V14MemberAPI / MemberSelector).
  function needsMemberScripts(route) {
    if (!route) return false;
    if (route.page === 'member-list' || route.page === 'member-detail') return true;
    return !!(route.query && route.query.memberId);
  }

  window.V14MemberLoader = Object.freeze({
    files: FILES.slice(),
    ensure: ensure,
    isReady: isReady,
    isFailed: isFailed,
    needsMemberScripts: needsMemberScripts,
    failedFile: function() { return failedFile; },
  });
})();

const fs=require('fs'),assert=require('assert');

const css=fs.readFileSync('assets/app.css','utf8');
const sessionSource=fs.readFileSync('js/member/session.js','utf8');

function block(source,selector){
  const start=source.indexOf(`${selector}{`);
  assert(start>=0,`missing CSS rule ${selector}`);
  const open=start+selector.length;
  let depth=1;
  for(let index=open+1;index<source.length;index++){
    if(source[index]==='{')depth++;
    if(source[index]==='}'&&--depth===0)return source.slice(open+1,index);
  }
  throw new Error(`unclosed CSS rule ${selector}`);
}

function blocks(source,selector){
  const found=[];
  let from=0;
  while(from<source.length){
    const start=source.indexOf(`${selector}{`,from);
    if(start<0)break;
    try{found.push(block(source.slice(start),selector));}catch{}
    from=start+selector.length+1;
  }
  return found;
}

function declaration(rule,property){
  const match=rule.match(new RegExp(`(?:^|;)${property}:([^;]+)`));
  return match?.[1]?.trim()||'';
}

const mobileBlocks=blocks(css,'@media(max-width:620px)');
const recentRules=mobileBlocks.map(media=>blocks(media,'.member-context-columns').at(-1)).filter(Boolean);
assert(
  recentRules.some(rule=>/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/.test(rule)),
  'recent training patterns, actions, and muscles must use a compact two-column mobile layout'
);
const recentLastRules=mobileBlocks.map(media=>blocks(media,'.member-context-columns section:last-child').at(-1)).filter(Boolean);
assert(
  recentLastRules.some(rule=>/grid-column:1\/-1/.test(rule)),
  'the final recent-training group must span the mobile grid without being hidden'
);

for(const selector of [
  '.member-filter-tabs button',
  '.member-row-actions button',
  '.member-detail-actions button',
  '.member-timeline-actions>button',
  '.member-session-actions button',
  '.member-save-actions button',
]){
  const mobileRules=mobileBlocks.map(media=>blocks(media,selector).at(-1)).filter(Boolean);
  assert(mobileRules.length,`missing narrow-screen rule ${selector}`);
  assert(
    mobileRules.some(rule=>Number.parseFloat(declaration(rule,'min-height'))>=44),
    `${selector} must keep a 44px mobile touch target`
  );
}

for(const selector of [
  '.f111-save-member-trigger',
  '.coach-member-entry a',
  '.member-next-session',
  '.member-load-more',
  '.member-directory-search input,.member-form-fields input,.member-form-fields select,.member-form-fields textarea',
  '.member-save-search input,.member-save-member select',
  '.member-session-replacement select,.member-session-actual-grid input,.member-session-actual-grid textarea',
  '.member-primary-action,.member-detail-actions button,.member-section-heading>button,.member-row-actions button,.member-state-empty button,.member-state-error button,.member-archive-actions button,.member-form-actions button,.member-form-head>button,.member-session-head>button,.member-session-dialog button[data-session-detail-retry]',
  '.member-session-actual summary',
  '.member-first-context-state button',
  '.member-first-context-empty-return',
  '.member-first-context-last a',
]){
  const rules=blocks(css,selector);
  assert(rules.length,`missing member flow control ${selector}`);
  assert(
    rules.some(rule=>Number.parseFloat(declaration(rule,'min-height'))>=44),
    `${selector} must expose a 44px touch target`
  );
}
const saveClose=blocks(css,'.member-save-close').at(-1);
assert(saveClose,'missing member save dialog close control');
assert(Number.parseFloat(declaration(saveClose,'width'))>=44&&Number.parseFloat(declaration(saveClose,'height'))>=44,'member save dialog close control must be at least 44px square');
assert.equal(
  declaration(blocks(css,'.member-next-session').at(-1),'display'),
  'inline-flex',
  'the next-session link must honor its declared touch size'
);

for(const selector of [
  '.member-timeline-row time',
  '.member-session-section h5',
  '.member-session-execution-heading span',
  '.member-session-item span,.member-session-item p,.member-session-item small',
  '.member-session-actual summary',
  '.member-first-context-heading>div>span',
  '.member-first-context-last span',
  '.member-first-context-columns h3',
  '.member-first-context-columns li',
  '.member-first-context-columns li b',
  '.member-first-context-columns section>p',
  '.member-first-context-latest-patterns',
]){
  const rules=blocks(css,selector);
  assert(rules.length,`missing readable text rule ${selector}`);
  assert(
    rules.some(rule=>Number.parseFloat(declaration(rule,'font-size'))>=11),
    `${selector} must use at least 11px text for supporting details`
  );
}

const actionRules=blocks(css,'.member-session-actions');
assert(actionRules.length,'missing member session action footer');
assert(actionRules.some(rule=>declaration(rule,'position')==='sticky'),'course completion actions must remain reachable while the session sheet scrolls');
assert(actionRules.some(rule=>declaration(rule,'bottom')==='0'),'course completion actions must stay docked to the sheet bottom');
const panelRules=blocks(css,'.member-session-panel');
assert(panelRules.some(rule=>declaration(rule,'display')==='flex'),'the course drawer must separate its fixed heading from the scrolling content');
assert(panelRules.some(rule=>declaration(rule,'flex-direction')==='column'),'the course drawer must keep a vertical heading/content structure');
assert(panelRules.some(rule=>declaration(rule,'overflow')==='hidden'),'the course drawer must contain scrolling to its body');
const contentRules=blocks(css,'.member-session-content');
assert(contentRules.some(rule=>declaration(rule,'overflow-y')==='auto'),'only the course body should scroll inside the sheet');
const executionActions=sessionSource.match(/function executionActions\(\)\{([\s\S]*?)\n  \}/)?.[1]||'';
assert(executionActions,'missing planned-session action markup');
assert(
  executionActions.indexOf('member-session-cancel-confirmation')<executionActions.indexOf('member-session-actions'),
  'the cancel confirmation must appear before the sticky footer so it remains visible when opened'
);

console.log('member_ui_polish_test: PASS');

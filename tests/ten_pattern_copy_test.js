const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const systemSource = fs.readFileSync('data/system-data.js','utf8');
const moduleSource = fs.readFileSync('js/module-copy.js','utf8');
const context = {window:{}, console};
vm.createContext(context);
vm.runInContext(systemSource, context);
vm.runInContext(moduleSource, context);

const api = context.window.V14ModuleCopy;
assert(api.formatTenPatterns, 'formatTenPatterns missing');
const text = api.formatTenPatterns({items: context.window.V14_DATA.tenPatternCatalog});
assert(text.includes('7Fit｜十大动作模式'));
assert(text.includes('01 蹲模式｜T1–T4'));
assert(text.includes('09 支撑模式｜S1–S6'));
assert(text.includes('10 核心模式｜L1–L4 + Core Demand'));
assert(!text.includes('09 支撑模式｜T1–T4'));
assert(!text.includes('10 核心模式｜T1–T4'));
console.log('ten pattern copy: PASS');

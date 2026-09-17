(function(){
  window.V14_CHANGELOG = [
    {date:'2026-09-18',time:'03:45',type:'修复',area:'预设课 / 上肢辅助',title:'预设课 D1/D2 候选对齐辅助池并纳入两个场馆覆盖动作',detail:'F111 预设课的 D1/D2 替换候选原本停留在 V10 旧池（含飞机拉背、俯卧撑、哈克深蹲等分级主项），现统一由 Composer D1/D2 辅助池生成，槽位名称回归正式写法 D1｜下肢辅助 / D2｜上肢辅助。基础肩胛划船（轻重量）与坐姿轻哑铃肩推的器械映射从 V13 遗留 ID 修正为器械清单中的低位划船一体机与哑铃 + 上斜凳，并纳入模块 11（唯一动作 21 个）。',issue:79,commit:''},
    {date:'2026-09-18',time:'03:20',type:'功能',area:'上肢辅助 / 系统模式',title:'按场馆器械清单补齐上肢辅助动作模块',detail:'按 7Fit 器械清单逐条核对器械可实施性，模块 11｜上肢辅助动作 由 9 个动作扩充到 19 个（水平拉 9 / 垂直拉 11 / 水平推 7 / 垂直推 9）；新增俯身Y举、斜板Y/T/W（进阶）、蝴蝶机反向飞鸟、飞机拉背下把位、低斜面拉上举、绳索面拉、双杠支撑保持、绳索高位夹胸、蝴蝶机单侧胸推、器械窄握胸推，并为全部动作补齐显式 equipmentClass。D2 仍只补充不复制 A/B 主项窗口。',issue:79,commit:''},
    {date:'2026-09-18',time:'02:35',type:'修复',area:'保存记录 / 安全回归',title:'存储失败不再误报保存或删除成功',detail:'保存、重命名与删除记录改为写入成功后更新内存；浏览器存储异常时保留原记录并显示中文错误。增加恶意搜索、超长输入、非法路由、跨模板上下文、删除确认及真实存储失败回归。',issue:74,commit:''},
    {date:'2026-09-18',time:'02:30',type:'修复',area:'F111 / 编课体验',title:'核心功能与动作在同一卡片选择',detail:'将核心功能、核心退阶入口与动作替换集中到 CORE 卡片；F111 主项默认展示当前等级及以下合法模式候选，无需展开额外退阶。',issue:null,commit:''},
    {date:'2026-09-18',time:'02:20',type:'修复',area:'动作库 / 系统维护',title:'限制超长搜索并按时间展示变更记录',detail:'动作库输入与搜索引擎统一限制为 200 字符；维护页按日期和时间倒序显示已有记录，避免旧记录被误标为最新。',issue:null,commit:''},
    {date:'2026-09-14',time:'14:00',type:'功能',area:'训练体系',title:'新增 D1 / D2 辅助动作模块',detail:'系统模式新增 11｜上肢辅助动作与 12｜下肢固定器械动作模块；内容由 Composer 辅助动作池实时去重生成，并按显式 equipmentClass 展示固定器械与绳索 / 龙门架辅助。',issue:79,commit:''},
    {date:'2026-09-14',time:'15:00',type:'规则',area:'Body / Venue',title:'接入场馆最低负重 Gate',detail:'将哈克深蹲与六角杠的真实起始系统负重接入 Body Resolver；L1/L2 自动回退到安全候选，未知负重保持未核验，教练覆盖必须记录理由并进入审计。',issue:94,commit:''},
    {date:'2026-09-14',time:'14:17',type:'规则',area:'Body L1–L4',title:'建立 Family × Level 动作池与进阶链',detail:'为 4 个 Body Family × L1–L4 增加正式优先池、替换池、进阶/退阶链与向下兼容规则；补齐髋铰链、肩胛拉与高等级推拉端点，并保留 L4 稳定有效器械。',issue:93,commit:''},
    {date:'2026-09-16',time:'22:20',type:'数据',area:'Content Review',title:'建立训练内容 Evidence / Review 元数据层',detail:'为正式 Actions、Templates、PREP、Body、Conditioning、HYROX 与 Anatomy 数据建立最小来源/证据/审核契约；系统维护页默认筛出待审核内容，CI 校验缺失或非法元数据。',issue:13,commit:''},
    {date:'2026-09-14',time:'13:38',type:'修复',area:'UI / Audit',title:'收口 V14.7 live 截图验收问题',detail:'修复 F111 PREP 详情 CTA 挤压、动作库筛选响应式与下拉可访问性；Conditioning 空 Primer 增加约束原因、可跳过与人工安排安全说明，并补齐多尺寸浏览器回归。',issue:71,commit:''},
    {date:'2026-09-14',time:'12:21',type:'功能',area:'Body 首页',title:'Body 首页重构为 Family-first 导航',detail:'新增 6 种真实数据训练模式、Family 详情 → L1–L4 导航，保留旧 Session 深链并强化自由编课入口。',issue:81,commit:'f75e190'},
    {date:'2026-09-14',time:'10:30',type:'体验',area:'Body Session',title:'训练页升级为 Coach-first 信息层级',detail:'优先展示今日重点、主项、风险与替换决策；完整诊断收进高级详情，移动端与保存/恢复行为保持不变。',issue:70,commit:'f18d6f8'},
    {date:'2026-09-14',time:'10:13',type:'规则',area:'Body 推荐',title:'加入 Session Compatibility Score',detail:'新增可解释候选评分、局部疲劳链、目标分配、动作顺序审计与推荐理由，用于减少“能选但不该选”的组合。',issue:69,commit:'3ce5013'},
    {date:'2026-09-14',time:'10:02',type:'规则',area:'Body L1–L4',title:'L1–L4 改为能力与动作资格合同',detail:'等级不再只是训练容量差异，而是决定动作是否具备进入当前等级课程的资格，并加入数据与回归约束。',issue:92,commit:'854ba07'},
    {date:'2026-09-14',time:'09:54',type:'修复',area:'已保存课程',title:'强化课程上下文与删除安全',detail:'恢复提示绑定模板上下文，删除动作增加明确确认，并补充上下文隔离与确认弹窗回归测试。',issue:75,commit:'23fa6d6'},
    {date:'2026-09-14',time:'03:30',type:'功能',area:'SUPPORT',title:'新增 SUP-S3 直臂支撑前跨步',detail:'补充动作详情、F111 候选、Anatomy、等级可见性与 SUPPORT 库存校验。',issue:78,commit:'3dc657a'},
    {date:'2026-09-14',time:'03:09',type:'功能',area:'HYROX',title:'HYROX Coach 工作流正式激活',detail:'HYROX 从数据准备阶段进入可使用的 Coach UI / Session 工作流。',issue:89,commit:'7e824ab'},
    {date:'2026-09-14',time:'02:46',type:'架构',area:'HYROX',title:'HYROX Resolver / Protocol Engine 完成',detail:'建立 HYROX 课程解析与协议引擎，为 Skill / Capacity / Mixed / Benchmark 课程提供统一运行层。',issue:88,commit:'6b07b1d'},
    {date:'2026-09-14',time:'02:38',type:'数据',area:'HYROX',title:'建立 HYROX Data Contract',detail:'定义 HYROX 的场馆动作、协议和数据契约，完成后续 Resolver 与 UI 的数据基础。',issue:87,commit:'8eda6b8'},
    {date:'2026-09-14',time:'01:57',type:'规则',area:'Body Composer',title:'落实 Body V2 Slot Intent 语义',detail:'加入主项/辅项意图合同、候选合法性、相似动作拦截与 16-state 回归，减少同质动作与错误组合。',issue:68,commit:'9b6e619'},
    {date:'2026-09-14',time:'01:44',type:'修复',area:'发布',title:'清理字面换行转义并加入产物卫生检查',detail:'移除 HTML/CSS 中的异常字面转义，新增源文件与 Pages 产物检查，补充线上 smoke 验证。',issue:76,commit:'e891990'},
    {date:'2026-09-13',time:'19:11',type:'部署',area:'GitHub Pages',title:'部署资源自动带 Build ID',detail:'静态资源随当前 commit 自动版本化，并在页面中暴露紧凑 Build ID，方便手机端确认是否已更新到最新部署。',issue:null,commit:'98e6dbf'},
    {date:'2026-09-13',time:'17:37',type:'修复',area:'Body',title:'补齐 Body UI 并阻止同动作家族重复',detail:'在 Resolver / Conflict 层阻止同动作家族重复，同时完善独立的响应式 Body Coach UI。',issue:null,commit:'e4497ed'},
    {date:'2026-09-13',time:'14:37',type:'功能',area:'PREP',title:'PREP 扩充至 52 个分级动作',detail:'增加向下等级可见、2F 综合热身选项，并将 PREP 处方与正式 SUPPORT / CORE 文案隔离。',issue:null,commit:'5e21f9b'}
  ];
})();

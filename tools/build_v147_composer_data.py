import json,re
from pathlib import Path

ROOT=Path(__file__).parents[1]

def load(path,name):
    text=path.read_text(encoding='utf-8')
    m=re.search(rf"window\.{re.escape(name)}\s*=\s*(\{{.*\}});\s*$",text,re.S)
    if not m: raise RuntimeError(f'{name} missing')
    return json.loads(m.group(1))

def dump(path,name,obj):
    path.write_text(f"window.{name}="+json.dumps(obj,ensure_ascii=False,separators=(',',':'))+";\n",encoding='utf-8')

sys_path=ROOT/'data/system-data.js'
an_path=ROOT/'data/anatomy-data.js'
d=load(sys_path,'V14_DATA')
a=load(an_path,'V14_ANATOMY')

ids=[
    'movement_supported_single_leg_hinge',
    'movement_supported_db_single_leg_rdl',
    'movement_db_single_leg_rdl',
    'movement_advanced_db_single_leg_rdl',
]
names=[
    '扶持单腿髋铰链（徒手）',
    '扶持哑铃单腿罗马尼亚硬拉',
    '独立哑铃单腿罗马尼亚硬拉',
    '高阶负重单腿罗马尼亚硬拉',
]
tiers=['T1','T2','T3','T4']
source_tiers=['T1 模式学习层','T2 稳定负重层','T3 独立负重层','T4 目标专项层']
equipment=['固定支撑 + 徒手','固定支撑 + 哑铃','哑铃 + 哑铃架','哑铃 + 哑铃架']
equipment_ids=['eq-rack','eq-dumbbell','eq-dumbbell','eq-dumbbell']
prescriptions=['3组 × 8次/侧｜RPE 5','3组 × 8–10次/侧｜RPE 6','3组 × 8–10次/侧｜RPE 7','3–4组 × 6–8次/侧｜RPE 8–9']
cues=[
    '扶稳支撑，髋向后折叠；骨盆保持朝前，支撑脚三点压稳',
    '一手扶稳、一手持哑铃；先向后送髋，再用臀部把身体带回',
    '支撑腿微屈，髋向后；两侧骨盆尽量保持同高，避免身体打开',
    '在骨盆和躯干稳定前提下提高负荷；全程保留1–2次高质量余力',
]
errors=[
    '弯腰代替髋折叠、骨盆旋转打开、支撑膝内扣或足弓塌陷',
    '为了触地过度弯腰、扶手承重过多、哑铃远离身体',
    '失去平衡后用腰背拉起、骨盆打开、支撑腿锁死',
    '为了重量牺牲活动范围与骨盆控制、疲劳后出现明显旋转代偿',
]
limits=[
    '急性下肢疼痛、明显单腿站立不稳时先退阶；必要时缩小活动范围',
    '急性腰髋或下肢疼痛、无法在支撑下维持骨盆控制时暂缓负重',
    '明显平衡障碍、腰髋疼痛或无法独立保持足踝稳定时退回T2',
    '仅用于已稳定掌握T3且能在目标RIR内保持动作质量的会员',
]
for i,aid in enumerate(ids):
    prev=ids[i-1] if i>0 else '—'
    nxt=ids[i+1] if i<len(ids)-1 else '—'
    d['actions'][aid]={
        'id':aid,'name':names[i],'pattern':'单腿拉','tier':tiers[i],'sourceTier':source_tiers[i],
        'route':'1F_ONLY','routeLabel':'1F 专用','equipment':equipment[i],'equipmentId':equipment_ids[i],
        'status':'可自动编排','impact':'低冲击','loadFamily':'后链 / 单侧髋主导','isSupport':False,'isCore':False,
        'v11StandardTier':tiers[i],'category':'主训练','zone':'1F 力量区'
    }
    d['actionDetails'][aid]={
        'summary':f'{names[i]} 主训练 · 1F 力量区 · 1F 专用',
        'fields':{
            '标准 ID':aid,'来源动作模式':'单腿拉','来源层级':source_tiers[i],'器械':equipment[i],
            '来源区域':'1F 力量区','V8 场馆路由':'1F 专用',
            '训练目标':'单侧后链力量、臀腿塑形、髋铰链能力、骨盆稳定与抗旋转',
            '来源处方 / RPE':prescriptions[i],'教练口令':cues[i],
            '执行步骤':'建立支撑脚与骨盆位置，髋向后折叠并保持脊柱中立；在腘绳肌张力和骨盆控制不丢失的范围内下放，再由臀部与后侧链完成髋伸返回。',
            '常见错误':errors[i],'禁忌 / 限制':limits[i],
            '退阶 ID':prev,'同级替代 ID':'—','进阶 ID':nxt
        }
    }
    a['records'][aid]={
        'roleType':'strength',
        'primary':['臀大肌','腘绳肌'],
        'secondary':['内收肌群'],
        'stabilizers':['臀中肌','腹内斜肌','腹外斜肌','腹横肌','竖脊肌','足踝稳定肌群'],
        'joints':['髋关节','膝关节','踝关节'],
        'movementActions':['单侧髋伸','髋铰链','骨盆抗旋转'],
        'tissueTargets':[], 'avoidRegions':[],
        'confidence':'high' if i<2 else 'medium',
        'sourceNote':'7Fit V14.7 single-leg hinge branch; execution changes stabilizer demand but does not change the primary hip-hinge classification.'
    }

d['singleLegHingeIds']=ids
d['singleLegBranches']={
    'single_leg_squat':{'name':'单腿蹲','description':'单侧膝主导','ids':list(d['eightPatterns']['单腿'])},
    'single_leg_hinge':{'name':'单腿拉','description':'单侧髋铰链 / 单腿髋主导','ids':ids},
}
# Preserve the frozen eightPatterns main chain for compatibility; enrich detail metadata only.
d.setdefault('eightPatternDetails',{}).setdefault('单腿',{})['branches']=d['singleLegBranches']
d.setdefault('meta',{})['runtimeVersion']='V14.7'
d['meta']['singleLegBranchBaseline']='2 branches / 4+4 tiers'

d['composer']={
    'lowerModes':{
        'squat':{'code':'SQ','name':'下肢推','subtitle':'蹲 / 膝主导','pattern':'蹲','patternKey':'蹲模式','ids':list(d['eightPatterns']['蹲模式'])},
        'hinge':{'code':'HINGE','name':'下肢拉','subtitle':'髋铰链 / 后侧链','pattern':'髋铰链','patternKey':'髋铰链','ids':list(d['eightPatterns']['髋铰链'])},
        'hip_extension':{'code':'HIP','name':'臀伸','subtitle':'臀推 / 髋伸展','pattern':'髋伸展','patternKey':'臀推 / 髋伸展','ids':list(d['eightPatterns']['臀推 / 髋伸展']),'prescriptionByTier':{'T4':'3–4组 × 6–8次｜RIR 1–2'},'tierNoteByTier':{'T4':'T4 复用臀推停顿主项，通过更高有效负荷、顶端控制与 RIR 1–2 区分高阶处方，不新增器械动作。'}},
        'single_leg_squat':{'code':'SLSQ','name':'单腿蹲','subtitle':'单侧膝主导','pattern':'单腿','patternKey':'单腿','ids':list(d['eightPatterns']['单腿'])},
        'single_leg_hinge':{'code':'SLH','name':'单腿拉','subtitle':'单侧髋铰链','pattern':'单腿拉','patternKey':'单腿','ids':ids},
    },
    'upperModes':{
        'horizontal_pull':{'code':'HR','name':'水平拉','pattern':'水平拉','patternKey':'水平拉','ids':list(d['eightPatterns']['水平拉'])},
        'vertical_pull':{'code':'VR','name':'垂直拉','pattern':'垂直拉','patternKey':'垂直拉','ids':list(d['eightPatterns']['垂直拉'])},
        'horizontal_push':{'code':'HP','name':'水平推','pattern':'水平推','patternKey':'水平推','ids':list(d['eightPatterns']['水平推'])},
        'vertical_push':{'code':'VP','name':'垂直推','pattern':'垂直推','patternKey':'垂直推','ids':list(d['eightPatterns']['垂直推'])},
    },
    'levelMap':{
        'L1':{'recommended':'T1','normal':['T1'],'expanded':[]},
        'L2':{'recommended':'T2','normal':['T1','T2'],'expanded':[]},
        'L3':{'recommended':'T3','normal':['T2','T3'],'expanded':['T1']},
        'L4':{'recommended':'T4','normal':['T3','T4'],'expanded':['T1','T2']},
    },
    'supportMap':{
        'L1':{'recommended':'SUP-S1','normal':['SUP-S1','SUP-S2'],'expanded':[]},
        'L2':{'recommended':'SUP-S2','normal':['SUP-S1','SUP-S2','SUP-S3'],'expanded':[]},
        'L3':{'recommended':'SUP-S3','normal':['SUP-S2','SUP-S3','SUP-S4'],'expanded':['SUP-S5']},
        'L4':{'recommended':'SUP-S4','normal':['SUP-S3','SUP-S4','SUP-S5'],'expanded':['SUP-S6']},
    },
    'coreMap':{
        'L1':{'recommended':['CORE-L1'],'normal':['CORE-L1'],'expanded':[]},
        'L2':{'recommended':['CORE-L2'],'normal':['CORE-L1','CORE-L2'],'expanded':[]},
        'L3':{'recommended':['CORE-L2','CORE-L3'],'normal':['CORE-L2','CORE-L3'],'expanded':['CORE-L1']},
        'L4':{'recommended':['CORE-L3'],'normal':['CORE-L2','CORE-L3','CORE-L4'],'expanded':['CORE-L1']},
    },
    'coreDemands':{
        'anti_extension':{'name':'抗伸展','keywords':['抗伸展']},
        'anti_rotation':{'name':'抗旋转','keywords':['抗旋转']},
        'anti_lateral_flexion':{'name':'抗侧屈','keywords':['抗侧屈']},
        'dynamic_rotation':{'name':'动态旋转','keywords':['旋转 / 传力']},
        'breathing_pressure':{'name':'呼吸 / 腹压协调','keywords':['胸廓骨盆','骨盆控制','基础控制']},
        'loaded_integration':{'name':'负重整合','keywords':['负重整合','高负荷整合','负重核心屈曲','悬垂']},
    },
    'auxiliaryRules':{
        'lower':{
            'squat':['tui_qushen','kuangnei_shou','kuangwai_zhan','tunbu_houti'],
            'hinge':['tui_wanju','tunbu_houti','kuangwai_zhan','kuangnei_shou'],
            'hip_extension':['tui_wanju','kuangwai_zhan','kuangnei_shou','xiao_longmen_wai_zhan'],
            'single_leg_squat':['kuangwai_zhan','kuangnei_shou','tui_qushen','tui_wanju','tunbu_houti'],
            'single_leg_hinge':['tui_wanju','tunbu_houti','kuangwai_zhan','xiao_longmen_wai_zhan','kuangnei_shou'],
        },
        'upper':{
            'horizontal_pull':['houzu_sanji','mianla','shengsuo_ertou_wanju','shengsuo_jianwai_xuanzhuan'],
            'vertical_pull':['shengsuo_ertou_wanju','zhibi_xiala','mianla','houzu_sanji'],
            'horizontal_push':['shengsuo_santou_xiaya','xiongjia_jiaxiong','shengsuo_jiaxiong_zhongwei','shengsuo_jianwai_xuanzhuan'],
            'vertical_push':['shengsuo_cepingju','shengsuo_santou_xiaya','mianla','shengsuo_jianwai_xuanzhuan'],
        }
    },
    'officialPresetMap':{
        'F111-01':['squat','horizontal_pull'],
        'F111-02':['squat','vertical_pull'],
        'F111-03':['hinge','horizontal_pull'],
        'F111-04':['hip_extension','vertical_pull'],
        'F111-05':['single_leg_squat','horizontal_pull'],
        'F111-06':['squat','horizontal_push'],
        'F111-07':['hinge','vertical_push'],
        'F111-08':['single_leg_squat','vertical_pull'],
    }
}

a.setdefault('meta',{})['runtimeVersion']='V14.7'
a['meta']['runtimeExpected']=243

dump(sys_path,'V14_DATA',d)
dump(an_path,'V14_ANATOMY',a)
print('actions',len(d['actions']),'anatomy',len(a['records']))

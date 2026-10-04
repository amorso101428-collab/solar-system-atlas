from pathlib import Path
import re,json,datetime
p=Path.cwd();rows=json.loads((p/'research/missions.json').read_text(encoding='utf-8'))
zh={
'mariner-1':'水手一号|美国首次尝试近距离探测金星，但运载火箭制导故障使任务在发射阶段结束。它展示了早期深空任务对可靠制导的依赖。',
'mariner-2':'水手二号|首次成功飞掠另一颗行星的探测器。近距离测量揭示金星远比人们曾设想的更炎热，开启了用实测数据认识行星的时代。',
'mariner-3':'水手三号|计划飞掠火星并拍照，但整流罩未正常分离，太阳能板无法展开，最终失去电力并留在日心轨道。',
'mariner-4':'水手四号|首次成功近距离拍摄火星，传回布满撞击坑的地表影像；无线电掩星测量同时约束了稀薄大气，为后来的着陆器设计提供依据。',
'mariner-5':'水手五号|由水手四号的备份平台改装，飞掠金星并测量其大气、磁场环境和太阳风相互作用。',
'mariner-6':'水手六号|与水手七号组成双探测器任务，飞掠火星并拍摄地形和测量大气。飞掠只能短暂观察，因此它的成果后来由轨道器长期观测补充。',
'mariner-7':'水手七号|在水手六号之后飞掠火星。地面团队利用前一艘探测器的发现调整观测计划，增加对南极区域的成像。',
'mariner-8':'水手八号|原计划绕火星进行长期探测，但火箭故障导致航天器重返地球大气层，未进入火星轨道。',
'mariner-9':'水手九号|第一艘环绕另一颗行星运行的航天器。在火星尘暴逐渐消退后绘制大范围地图，揭示巨型火山、峡谷和两颗卫星的细节。',
'ranger-1':'徘徊者一号|为后续探月任务测试航天器平台和空间环境仪器。上面级故障使其滞留近地轨道，随后再入。',
'ranger-2':'徘徊者二号|第二次远地点轨道技术试验，上面级故障使航天器未能进入预定轨道。结果推动了后续探月系统的改进。',
'ranger-3':'徘徊者三号|早期月球撞击探测尝试，故障使其错过月球并进入日心轨道；任务仍取得了行星际伽马射线测量。',
'ranger-4':'徘徊者四号|首个到达月球的美国航天器，但计算机故障使其未能开展预定观测，最终撞击月球背面。到达目标不等于完成科学任务。',
'ranger-5':'徘徊者五号|计划探测月球，但电力系统故障使电池耗尽，航天器未能完成预定任务。',
'ranger-6':'徘徊者六号|按计划撞击月球，但电视成像系统失效，未能传回近距离照片，为下一次任务暴露了关键工程问题。',
'ranger-8':'徘徊者八号|撞击月球前传回七千多张近距离影像，为理解月面地形和准备载人登陆提供资料。',
'ranger-9':'徘徊者九号|徘徊者系列的最后一次任务，在下降至月面过程中连续成像，展示撞击式探测能以有限寿命换取高分辨率近景。',
'surveyor-2':'勘测者二号|尝试月面软着陆，但一台推力器未能点火，导致姿态失控并撞击月面。',
'surveyor-3':'勘测者三号|在月面成功软着陆并测试土壤机械性质，为阿波罗登月舱提供承载能力证据；阿波罗十二号后来到访其着陆地点。',
'surveyor-4':'勘测者四号|在接近月面着陆时突然失去无线电联系，任务未能恢复，着陆结果无法由遥测完整确认。',
'surveyor-5':'勘测者五号|首次在月球开展原位土壤成分分析。虽然推力系统出现泄漏，团队仍调整方案完成软着陆。',
'surveyor-6':'勘测者六号|在月面进行成像与土壤实验，并通过短暂再点火改变位置，为理解月面着陆和发动机作用提供经验。',
'surveyor-7':'勘测者七号|系列最后一艘着陆器，前往月球高地区域，扩展了此前以月海为主的着陆样本，使科学家能够比较不同地质环境。',
'lunar-orbiter-1':'月球轨道器一号|以轨道摄影寻找适合勘测者与阿波罗任务的安全着陆区，将月面选址从地面望远镜观测推进到近距离测绘。',
'lunar-orbiter-2':'月球轨道器二号|继续拍摄候选着陆地点，也取得哥白尼环形山的著名斜视图；辐射测量帮助评估载人飞行环境。',
'lunar-orbiter-3':'月球轨道器三号|为阿波罗候选着陆点提供补充影像。尽管部分图像未能传回，任务仍满足主要测绘目标。',
'lunar-orbiter-4':'月球轨道器四号|从以着陆点为中心的拍摄转向更广泛的月球科学测绘，利用极区轨道改善全球覆盖。',
'lunar-orbiter-5':'月球轨道器五号|完成该系列的月球测绘工作，补充潜在着陆点和此前覆盖不足区域的影像，为载人探月提供地形背景。',
'pioneer-5':'先驱者五号|测量行星际磁场与空间环境，帮助建立地球和金星轨道之间的太阳风与磁场图景。',
'pioneer-6':'先驱者六号|进入日心轨道连续测量行星际现象，以远离地球的位置补充地球附近的太阳活动观测。',
'pioneer-7':'先驱者七号|测量太阳风和磁场，并在1986年从远距离经过哈雷彗星附近，提供行星际环境背景数据。',
'pioneer-8':'先驱者八号|长期在日心轨道研究行星际空间，回传数据持续近三十年，体现了简单可靠平台的长期科学价值。',
'pioneer-9':'先驱者九号|与同系列航天器组成分散于日心空间的测量网络，让科学家能够比较不同位置的太阳风条件。',
'viking-2':'海盗二号|由轨道器与着陆器共同研究火星，结合全球背景、着陆点影像和原位实验。其生命探测实验的解释必须结合土壤化学环境。',
'mars-phoenix':'凤凰号|在火星北部高纬度软着陆，研究冰、土壤与大气。固定式平台以挖掘和原位分析探索浅表环境，补充巡视器的移动观测。',
'messenger':'信使号|首艘绕水星运行的航天器，长期测量地表成分、地质历史和磁场，并确认极区沉积物主要由水冰构成，最后撞击水星。',
'deep-space-1':'深空一号|验证离子推进、自主导航等十二项技术，并顺访小天体。它把工程验证和科学飞掠结合，为后续深空任务降低技术风险。',
'genesis':'起源号|采集太阳风样品并送回地球。返回舱硬着陆损坏了部分收集器，但样品仍被回收用于研究太阳物质组成。',
'lcross':'月球撞击坑观测与传感卫星|与上面级先后撞击月球南极永久阴影区域，观测溅射物以寻找水冰证据，是以撞击开展主动探测的案例。',
'ladee':'月球大气与尘埃环境探测器|从低月球轨道测量极稀薄外逸层和尘埃环境，研究无浓厚大气天体的近表面物质循环。',
'clementine':'克莱门汀号|在月球轨道测试航天器技术并开展多波段测绘。月球任务成功，但后续小行星飞掠因故障取消。',
'lunar-prospector':'月球勘探者|测量月球表面成分、重力和磁场，寻找极区富氢物质；这些信号为水冰研究提供线索，但须结合后续任务判读。',
'seasat':'海洋卫星|以雷达等遥感仪器研究海洋，推动从太空测量海面形态、海风和海洋动力学，是后来海洋观测卫星的重要技术先导。',
'sorce':'太阳辐射与气候实验卫星|测量太阳总辐照度与光谱辐照度，帮助区分太阳输入变化和地球气候系统响应。',
'trmm':'热带降雨测量卫星|美国与日本联合研究热带、亚热带降雨的任务，用空间观测补足海洋和偏远地区的雨量资料。',
'uars':'高层大气研究卫星|研究高层大气成分与能量过程，帮助理解臭氧、化学反应和大气动力学之间的联系。',
'rhessi':'高能太阳光谱成像卫星|通过高能辐射研究太阳耀斑中的粒子加速和能量释放，使光学影像之外的高能过程能够被测量。',
'trace':'过渡区与日冕探测器|对太阳过渡区和日冕成像，观察细小磁结构与高温等离子体之间的联系，帮助研究太阳大气加热。',
'sampex':'太阳与磁层粒子探测器|测量高能带电粒子，研究太阳、宇宙射线和地球磁层中的粒子如何进入并影响近地环境。',
'fast':'快速极光快照探测器|穿越极光相关区域，测量等离子体与粒子过程，用局部高时间分辨率观测解释极光形成机制。',
'image':'磁层至极光全球成像卫星|将局部粒子测量扩展为磁层整体成像，追踪地球磁环境如何响应太阳风变化。',
'timed':'热层电离层中间层动力学卫星|研究中间层与低热层、电离层的能量和动力学，观测连接地球大气与太空的过渡区域。',
'aim':'中间层冰云探测器|研究夜光云的形成和变化，利用高层大气中的冰晶云追踪温度、水汽与环境条件。',
'ibex':'星际边界探测器|通过能量中性原子观测描绘日球层边界的远程图景，探测器本身并不需要飞到太阳系边界。',
'dscovr':'深空气候观测台|从日地系统附近的远距离观测位置监测太阳风并观测地球，用于空间天气预警和整盘地球研究。',
'nustar':'核光谱望远镜阵列|聚焦高能X射线，研究黑洞、中子星和超新星遗迹。不同波段揭示的物理过程与可见光照片并不相同。',
'galex':'星系演化探测器|以紫外巡天研究星系中的恒星形成与演化，帮助识别年轻恒星和正在发生恒星形成的区域。',
'fuse':'远紫外光谱探测器|通过远紫外光谱研究恒星和星际介质中的气体，不只拍摄外观，而是利用谱线分析物质成分与运动。',
'suzaku':'朱雀X射线天文卫星|日本主导、美国参与的X射线任务，研究超新星、黑洞及高温宇宙中的元素和能量过程。',
'hitomi':'瞳X射线天文卫星|日本与国际伙伴合作的高能天文台。任务寿命很短，但获得的数据仍用于研究星系团高温气体与元素。',
'rxte':'罗西X射线时变探测器|研究黑洞、中子星和白矮星附近随时间快速变化的X射线，利用亮度变化理解极端环境的物理过程。'
}
months={m.lower():i for i,m in enumerate(['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],1)}
def dateparse(s):
 m=re.search(r'([A-Za-z]+)\.?\s+(\d{1,2}),?\s*(\d{4})',s)
 return f'{m[3]}-{months[m[1][:3].lower()]:02d}-{int(m[2]):02d}' if m else None
objs=[]
for r in rows:
 slug=r['slug']
 if not r['ok'] or slug not in zh:continue
 text=(p/'research'/(slug+'.txt')).read_text(encoding='utf-8');ls=text.splitlines()
 date=next((dateparse(ls[i+1]) for i,l in enumerate(ls[:-1]) if re.fullmatch(r'Launch(?:ed| Date(?: and Time)?)?',l,re.I) and dateparse(ls[i+1])),None)
 if not date: print('No verified launch date:',slug);continue
 name,summary=zh[slug].split('|',1)
 en=next((ls[i+1] for i,l in enumerate(ls[:-1]) if l.startswith('What was ')),None)
 if not en:
  en=next((ls[i+1] for i,l in enumerate(ls[:-1]) if l.lower() in ['objective','objective(s)']),None)
 en=en or next((l for l in ls[:35] if len(l)>90),slug.upper()+' mission archive.')
 sys='earth';kind='satellite';status='COMPLETED'
 if slug.startswith(('surveyor','ranger','lunar-orbiter')) or slug in ['lcross','ladee','clementine','lunar-prospector']:sys='moon';kind='lander' if slug.startswith('surveyor') else 'orbiter' if slug.startswith('lunar-orbiter') or slug in ['ladee','clementine','lunar-prospector'] else 'probe'
 if slug.startswith('mariner'):sys='venus' if slug in ['mariner-1','mariner-2','mariner-5'] else 'mars';kind='orbiter' if slug in ['mariner-8','mariner-9'] else 'probe'
 if slug in ['mariner-1','mariner-8','ranger-1','ranger-2']:sys='earth';status='LOST'
 if slug in ['mariner-3','ranger-3','ranger-5']:sys='deep';status='LOST'
 if slug in ['surveyor-2','ranger-4','ranger-6','ranger-8','ranger-9','lcross','ladee','lunar-prospector','messenger'] or slug.startswith('lunar-orbiter'):status='IMPACTED'
 if slug=='surveyor-4':status='LOST'
 if slug.startswith('pioneer') or slug=='genesis':sys='sun';kind='probe'
 if slug=='messenger':sys='mercury';kind='orbiter'
 if slug in ['viking-2','mars-phoenix']:sys='mars';kind='lander'
 if slug=='deep-space-1':sys='belt';kind='probe'
 if slug in ['nustar','galex','fuse','suzaku','hitomi','rxte','rhessi','trace']:kind='telescope'
 if slug in ['timed','ibex','dscovr','nustar']:status='ACTIVE' if 'Active Mission' in text else 'UNKNOWN'
 cat={'earth':'EARTH','moon':'MOON','mars':'MARS','sun':'SOLAR','venus':'SOLAR','mercury':'SOLAR','deep':'DEEP_SPACE','belt':'SMALL_BODY'}[sys]
 au={'earth':1,'moon':1,'mars':1.52,'venus':.72,'mercury':.39,'sun':1,'deep':1,'belt':2.4}[sys]
 end=next((dateparse(ls[i+1]) for i,l in enumerate(ls[:-1]) if l.lower() in ['mission end','decommissioned','operations ceased'] and dateparse(ls[i+1])),None)
 mass=next((ls[i+1] for i,l in enumerate(ls[:-1]) if l=='Spacecraft Mass'),None)
 vehicle=next((ls[i+1] for i,l in enumerate(ls[:-1]) if l=='Launch Vehicle'),None)
 obj=dict(id=slug,name=slug.replace('-',' ').upper(),cn=name,kind=kind,cat=cat,sys=sys,date=date,org='JAXA / NASA' if slug in ['hitomi','suzaku'] else 'NASA / JAXA' if slug=='trmm' else 'NASA',status=status,orbit='MISSION CONTEXT · SCHEMATIC',orbitCn='任务位置示意 · 非实时轨道',mission={'zh':summary.split('。')[0],'en':en.split('. ')[0]+'.'},summary={'zh':summary,'en':en},au=au,src=r['url'],srcTitle='NASA Science — '+slug.replace('-',' ').title(),imp=3,tags=['science','historical'] if status not in ['ACTIVE','UNKNOWN'] else ['science'])
 if mass:obj['mass']=mass
 if vehicle:obj['vehicle']=vehicle
 if end:obj['events']=[[end,'科学运行结束','Science operations ended']]
 objs.append(obj)
(p/'src/data/expanded-missions.json').write_text(json.dumps(objs,ensure_ascii=False,indent=2),encoding='utf-8')
(p/'src/data/expanded-missions.ts').write_text("import data from './expanded-missions.json'\nimport {makeObject, type ExtraSpec} from './extra-shared'\nexport const EXPANDED_MISSIONS = (data as ExtraSpec[]).map(makeObject)\n",encoding='utf-8')
f=p/'src/data/objects.ts';s=f.read_text(encoding='utf-8');s="import { EXPANDED_MISSIONS } from './expanded-missions'\n"+s;s=s.replace('  ...CHINA_EXTRA,','  ...CHINA_EXTRA,\n  ...EXPANDED_MISSIONS,');f.write_text(s,encoding='utf-8')
f=p/'src/data/types.ts';s=f.read_text(encoding='utf-8').replace("export type ObjectStatus =","export type ObjectStatus =\n  | 'UNKNOWN'");f.write_text(s,encoding='utf-8')
f=p/'src/i18n/index.ts';s=f.read_text(encoding='utf-8').replace("    'status.ACTIVE': '在役',","    'status.UNKNOWN': '当前状态待核实',\n    'status.ACTIVE': '在役',").replace("    'status.ACTIVE': 'ACTIVE',","    'status.UNKNOWN': 'STATUS UNVERIFIED',\n    'status.ACTIVE': 'ACTIVE',");f.write_text(s,encoding='utf-8')
print('Added official-source mission archives:',len(objs))

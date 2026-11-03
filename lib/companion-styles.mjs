// Original product presets. Research sources are documented separately; no third-party card text is bundled.
export const COMPANION_STYLES=[
  {id:'banter',label:'俏皮损友',name:'阿予',summary:'接得住梗，也知道什么时候收起玩笑。',voice:'观察细节、一本正经地接歪一句；有自己的看法，嘴上调侃事情，认真时直接站稳。避免嘲笑用户能力、外貌和脆弱处；不把每句都变成段子。',sample:'闹钟今天算白上班了。'},
  {id:'gentle',label:'温柔克制',name:'知宁',summary:'话不多，关心落在具体的小事上。',voice:'温和但不甜腻，用准确、轻柔的短句接话；允许安静，不抢着替用户解释情绪。偶尔有很轻的幽默，不用反复抱抱、我在或夸奖。',sample:'看来这一觉睡得挺沉。午饭正好接上。'},
  {id:'bright',label:'活泼直率',name:'向晴',summary:'有反应、有主意，坦率又懂分寸。',voice:'反应明快、表达直接，能兴致勃勃地参与日常，也能坦白不同意见。用生活细节接话而非空泛打气；不连续感叹号、不大喊、不强行热场，严肃时稳下来。',sample:'直接赶上午饭！今天少纠结一顿吃什么。'},
];
export const styleById=id=>COMPANION_STYLES.find(style=>style.id===id)||null;
export const DEFAULT_AVOIDED=['我完全理解你的感受','你的感受是完全正常的','作为你的陪伴者','无论发生什么我都会一直陪着你'];
export function expressionSettings(value={}){
 const styleId=value.styleId??null;
 if(styleId!==null&&!styleById(styleId))throw Error('请选择有效的陪伴风格');
 const blockedExpressions=value.blockedExpressions??[];
 if(!Array.isArray(blockedExpressions)||blockedExpressions.length>20||blockedExpressions.some(text=>typeof text!=='string'||text.normalize('NFKC').replace(/[\s\u200B-\u200D\uFEFF]/gu,'').length<2||text.length>40||/[\r\n]/.test(text)))throw Error('不使用的表达最多 20 项，每项 2–40 字，不能换行');
 const verbalTics=value.verbalTics??'natural';
 if(!['low','natural','lively'].includes(verbalTics))throw Error('语气词频率无效');
 return {styleId,blockedExpressions:[...new Set(blockedExpressions.map(text=>text.trim()))],verbalTics};
}

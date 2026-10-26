// Illustrative UI assets only. They never populate a household photo field.
export const EXAMPLE_PEOPLE=[
  {id:'example-father',name:'爸爸',role:'father',age:36,qualities:['patient'],illustrative:true},
  {id:'example-grandmother',name:'外婆',role:'grandmother',age:68,qualities:['patient'],illustrative:true},
];
export function examplePortrait(relation=''){
  if(/^mother$|妈妈|母亲|妻子/.test(relation))return '/demo/preview/mother.png';
  if(/女儿/.test(relation))return '/demo/preview/daughter.png';
  if(/grandmother|外婆|奶奶|祖母/.test(relation))return '/demo/preview/grandmother.png';
  if(/father|grandfather|爸爸|父亲|爷爷|外公/.test(relation))return '/demo/preview/father.png';
  return null;
}
export function exampleCover(memory={}){
  const text=[memory.title,memory.theme,memory.story].filter(Boolean).join(' ');
  if(/生日|毕业|庆祝/.test(text))return '/demo/preview/birthday.png';
  if(/桂花|做饭|厨房|糕|日常/.test(text))return '/demo/preview/osmanthus-cake.png';
  if(/老家|院|老屋|老宅/.test(text))return '/demo/preview/courtyard.png';
  return '/demo/preview/family.png';
}

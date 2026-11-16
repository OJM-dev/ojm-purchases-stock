export const keys=['orders','moves','quotes','items','suppliers','stations','locations'];
export function validateData(d){
 if(!d||keys.some(k=>!Array.isArray(d[k])))throw Error('ملف النسخة غير مكتمل');
 for(const k of keys.slice(3))if(d[k].some(x=>typeof x!=='string'))throw Error('قائمة أسماء غير صالحة');
 for(const k of keys.slice(0,3)){const ids=new Set();for(const x of d[k]){if(!x||typeof x.id!=='string'||!x.id||ids.has(x.id))throw Error('معرّفات السجلات غير صالحة');ids.add(x.id);for(const f of ['qty','price','factor'])if(x[f]!=null&&x[f]!==''&&(!Number.isFinite(Number(x[f]))||Number(x[f])<0))throw Error('قيمة رقمية غير صالحة');}}
 const bal=new Map();const add=(i,l,n)=>{const k=JSON.stringify([i,l]);bal.set(k,(bal.get(k)||0)+n)};
 for(const o of d.orders)if(o.done&&o.reason==='Stock'){if(!o.item||!o.location||!(o.qty>0)||!(o.factor>0))throw Error('بيانات المخزون غير مكتملة');add(o.item,o.location,o.qty*o.factor)}
 for(const m of d.moves){if(!(m.qty>0)||!m.item||!m.from||!m.to||m.from===m.to||!['issue','transfer'].includes(m.type))throw Error('حركة مخزون غير صالحة');add(m.item,m.from,-m.qty);if(m.type==='transfer')add(m.item,m.to,m.qty)}
 if([...bal.values()].some(n=>!Number.isFinite(n)||n< -0.000001))throw Error('الكمية غير كافية في المخزون بعد الدمج');
 return d;
}
export function mergeData(current,incoming){const merged={...current};for(const k of keys.slice(0,3)){const ids=new Set(current[k].map(x=>x.id));merged[k]=[...current[k],...incoming[k].filter(x=>!ids.has(x.id))]}for(const k of keys.slice(3))merged[k]=[...new Set([...current[k],...incoming[k]])];return validateData(merged)}
export function checkBackup(b){if(b?.format!=='ojm-purchases-backup'||b.schemaVersion!==1||!Array.isArray(b.files))throw Error('هذا الملف ليس نسخة احتياطية متوافقة');validateData(b.data);return b}

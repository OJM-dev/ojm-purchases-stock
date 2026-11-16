import {supabase} from './supabase';
import {checkBackup,keys,mergeData,validateData} from '../lib/backup.mjs';

const bucket=supabase.storage.from('purchase-attachments');
const allowedTypes=['application/pdf','image/jpeg','image/png','image/webp'];
const empty=()=>Object.fromEntries(keys.map((key:string)=>[key,[]]));
const records=(data:any)=>[...data.orders,...data.quotes];
const attachments=(data:any)=>[...new Map<string,any>(records(data).filter(r=>r.file?.key).map(r=>[r.file.key,r.file])).values()];
async function owner(){
 const {data,error}=await supabase.auth.getUser();
 if(error||!data.user)throw Error('سجّل الدخول مجددًا');
 return data.user.id;
}
async function read(ownerId:string){
 const {data,error}=await supabase.from('purchase_workspaces').select('data,version').eq('owner_id',ownerId).maybeSingle();
 if(error)throw error;
 return {data:{...empty(),...data?.data},version:data?.version??0};
}
async function write(ownerId:string,data:any,version:number){
 validateData(data);
 const table=supabase.from('purchase_workspaces');
 const {error:initError}=await table.upsert({owner_id:ownerId},{onConflict:'owner_id',ignoreDuplicates:true});
 if(initError)throw initError;
 const {data:updated,error}=await table.update({data,version:version+1}).eq('owner_id',ownerId).eq('version',version).select('version').maybeSingle();
 if(error)throw error;
 if(!updated)throw Error('تم تعديل البيانات من جهاز آخر. حدّث الصفحة ثم حاول مجددًا.');
 return updated;
}
async function upload(ownerId:string,file:Blob,name:string){
 if(!allowedTypes.includes(file.type)||file.size>10*1024*1024)throw Error('اختر PDF أو صورة حتى 10MB');
 const key=ownerId+'/'+crypto.randomUUID();
 const {error}=await bucket.upload(key,file,{contentType:file.type});
 if(error)throw error;
 return {key,name};
}
function encode(bytes:Uint8Array){
 let str='';
 for(let i=0;i<bytes.length;i+=16384)str+=String.fromCharCode(...bytes.subarray(i,i+16384));
 return btoa(str);
}
export async function openAttachment(key:string){
 const tab=window.open('about:blank','_blank');
 if(!tab)throw Error('اسمح بفتح نافذة المرفق ثم حاول مجددًا');
 tab.opener=null;
 try{
  const {data,error}=await bucket.createSignedUrl(key,60);
  if(error)throw error;
  tab.location.replace(data.signedUrl);
 }catch(error){tab.close();throw error}
}
export async function appFetch(path:string,init?:RequestInit){
 try{
  const ownerId=await owner();
  if(path==='/api/data'){
   if(init?.method!=='PUT')return Response.json(await read(ownerId));
   const {data,version}=JSON.parse(String(init.body));
   return Response.json(await write(ownerId,data,version));
  }
  if(path==='/api/files'){
   const file=(init?.body as FormData).get('file');
   if(!(file instanceof File))throw Error('اختر ملفًا');
   return Response.json(await upload(ownerId,file,file.name));
  }
  if(init?.method!=='POST'){
   const {data}=await read(ownerId);
   const files=[];
   for(const file of attachments(data)){
    const {data:blob,error}=await bucket.download(file.key);
    if(error)throw error;
    files.push({...file,type:blob.type,content:encode(new Uint8Array(await blob.arrayBuffer()))});
   }
   return Response.json({format:'ojm-purchases-backup',schemaVersion:1,createdAt:new Date().toISOString(),data,files});
  }
  const {backup,version}=JSON.parse(String(init.body));
  checkBackup(backup);
  const current=await read(ownerId);
  if(current.version!==version)throw Error('حدّث الصفحة قبل الاسترجاع. تغيرت البيانات على جهاز آخر.');
  const merged=structuredClone(mergeData(current.data,backup.data));
  const existing=new Set(attachments(current.data).map(file=>file.key));
  const embedded=new Map<string,any>(backup.files.map((file:any)=>[file.key,file]));
  const newFiles=attachments(merged).filter(file=>!existing.has(file.key));
   for(const file of newFiles){
    const saved=embedded.get(file.key);
    if(!saved||typeof saved.content!=='string')throw Error('النسخة تفتقد أحد المرفقات');
    const bytes=Uint8Array.from(atob(saved.content),c=>c.charCodeAt(0));
    const attachment=await upload(ownerId,new Blob([bytes],{type:saved.type}),file.name);
    for(const record of records(merged))if(record.file?.key===file.key)record.file=attachment;
   }
   const result=await write(ownerId,merged,version);
   return Response.json({data:merged,...result});
 }catch(error:any){return new Response(error?.message||'تعذر إتمام العملية',{status:400})}
}

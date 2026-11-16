import {useState,useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import Workspace from './workspace';
import {supabase} from './supabase';
import './globals.css';
function App(){
 const [session,setSession]=useState<any>(undefined);
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 useEffect(()=>{const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>setSession(session));return ()=>subscription.unsubscribe()},[]);
 if(session===undefined)return <main className="login-card">جارٍ الاتصال…</main>;
 if(session)return <Workspace key={session.user.id}/>;
 return <main className="login-card"><h1>المشتريات والمخزون</h1><form onSubmit={async e=>{e.preventDefault();const form=new FormData(e.currentTarget);setBusy(true);setError('');try{const {error}=await supabase.auth.signInWithPassword({email:String(form.get('email')).trim(),password:String(form.get('password'))});if(error)setError('تعذر تسجيل الدخول. تحقق من البريد وكلمة المرور.')}catch{setError('تعذر الاتصال. حاول مرة أخرى.')}finally{setBusy(false)}}}><label>البريد الإلكتروني<input name="email" type="email" autoComplete="username" required/></label><label>كلمة المرور<input name="password" type="password" autoComplete="current-password" required/></label>{error&&<p role="alert">{error}</p>}<button className="primary" disabled={busy}>تسجيل الدخول</button></form></main>;
}
createRoot(document.getElementById('root')!).render(<App/>);

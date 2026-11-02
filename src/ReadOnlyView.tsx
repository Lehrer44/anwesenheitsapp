import {Fragment,useEffect,useState} from 'react';
import {watchReadOnly} from './api';
import {readOnlyAccess} from './read-only-data';
import {groupedStudents,displayClassName,type State} from './model';

export default function ReadOnlyView({hash}:{hash:string}){
 const [state,setState]=useState<State|null>(null),[error,setError]=useState(''),[online,setOnline]=useState(navigator.onLine);
 useEffect(()=>{
  let disposed=false,stop=()=>{};setState(null);setError('');
  const fail=(e:Error)=>{if(!disposed){setState(null);setError(e.message);}};
  try{watchReadOnly(readOnlyAccess(hash),s=>{if(!disposed){setState(s);setError('');}},fail).then(unsubscribe=>{if(disposed)unsubscribe();else stop=unsubscribe;}).catch(fail);}catch(e){fail(e as Error);}
  return()=>{disposed=true;stop();};
 },[hash]);
 useEffect(()=>{const update=()=>setOnline(navigator.onLine);window.addEventListener('online',update);window.addEventListener('offline',update);return()=>{window.removeEventListener('online',update);window.removeEventListener('offline',update);};},[]);
 return <main className="read-only-page">
  <header className="read-only-heading"><div><h1>{state?.title||'Tabelle ansehen'}</h1></div><p className={'read-only-connection '+(online?'':'offline')} role="status">{!online?'Offline – letzter empfangener Stand':error?'Zugriff nicht verfügbar':state?'Live verbunden':'Verbindung wird hergestellt …'}</p></header>
  {error?<p className="alert error" role="alert">{error}</p>:!state?<p role="status">Tabelle wird geladen …</p>:<ReadOnlyTable state={state}/>}
 </main>;
}

export function ReadOnlyTable({state}:{state:State}){
 const dates=state.sessions;
 return <section className="panel matrix-panel" aria-label="Freigegebene Anwesenheitstabelle">
   <div className="tablewrap" dir="rtl"><table className="matrix consolidated read-only-matrix" dir="rtl" style={{width:`calc(var(--number-width) + var(--student-width) + ${Math.max(1,dates.length)*112}px)`}}>
    <thead><tr><th className="number-column" scope="col">Nr.</th><th className="student-column" scope="col">اسم</th>{!dates.length&&<th scope="col">Noch keine Termine</th>}{dates.map(d=><th scope="col" key={d.date}><span>{new Date(d.date+'T12:00:00').toLocaleDateString('de-DE',{day:'2-digit',month:'2-digit',year:'numeric'})}{d.cancelled&&<small>Ausfall: {d.cancelled}</small>}</span></th>)}</tr></thead>
    <tbody>{groupedStudents(state).filter(g=>g.students.length).map((g,gi)=><Fragment key={g.id}><tr className={'group-divider band-'+gi%6}><td className="class-heading-cell" colSpan={Math.max(1,dates.length)+2}><div className="group-heading" dir="ltr"><strong>{displayClassName(g.name)}</strong><span>Anzahl {g.students.length}</span></div></td></tr>{g.students.map((p,i)=><tr className={'student-band band-'+gi%6} key={p.id}><td className="number-column">{i+1}</td><td className="student-column"><div className="matrix-name"><strong className={'student-label'+(state.groups.some(g=>g.leaderId===p.id||g.helperId===p.id)?' class-role':'')} dir="auto">{p.name}</strong>{p.archived&&<small>Archiviert</small>}</div></td>{!dates.length&&<td className="attendance-cell">—</td>}{dates.map(d=><td className="attendance-cell" key={d.date}>{!d.roster.some(x=>x.id===p.id)?<span className="muted">nicht im Kurs</span>:d.cancelled?<span className="cancel-cell">{d.cancelled}</span>:<span className={'cellstatus '+(d.marks[p.id]||'offen')}>{d.marks[p.id]||''}</span>}</td>)}</tr>)}</Fragment>)}</tbody>
   </table></div>{!state.students.length&&<p className="empty">Noch keine Schüler in dieser Liste.</p>}
  </section>;
}

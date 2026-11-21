import {useEffect,useRef} from 'react';
import {Check,X,FileCheck2} from 'lucide-react';
import {classHistory,type HistoryCell} from './class-history';
import {statusArabic} from './StatusLabel';
import type {State,Status} from './model';

const dayMonth=(d:string)=>d.slice(8,10)+'.'+d.slice(5,7)+'.';
const fullDate=(d:string)=>d.slice(8,10)+'.'+d.slice(5,7)+'.'+d.slice(0,4);
const icon=(v:Status,size:number)=>v==='anwesend'?<Check size={size}/>:v==='abwesend'?<X size={size}/>:<FileCheck2 size={size}/>;
const statuses:Status[]=['anwesend','abwesend','entschuldigt'];

export function ClassHistoryTable({state,groupId}:{state:State,groupId:string}){
 const {dates,rows}=classHistory(state,groupId);
 if(!dates.length)return <p className="history-empty">Noch keine abgesendeten Termine.</p>;
 const cell=(c:HistoryCell)=>c==='fehlt'?'nicht im Kurs':c==='offen'?'nicht gemeldet':c;
 return <>
  <ul className="history-legend" aria-label="Legende">{statuses.map(v=><li key={v}><span className={'history-mark '+v} aria-hidden="true">{icon(v,12)}</span><span lang="ar" dir="rtl">{statusArabic[v]}</span> {v}</li>)}</ul>
  <div className="history-scroll" dir="rtl"><table className="history-table" dir="rtl">
   <thead><tr><th scope="col" className="history-name">اسم</th><th scope="col" className="history-count" title="Unentschuldigte Fehlzeiten">غياب</th>{dates.map(d=><th scope="col" key={d} title={fullDate(d)}><bdi dir="ltr">{dayMonth(d)}</bdi></th>)}</tr></thead>
   <tbody>{rows.map(r=><tr key={r.student.id}>
    <th scope="row" className="history-name" dir="auto">{r.student.name}</th>
    <td className={'history-count'+(r.absent?' has-absence':'')}>{r.absent}</td>
    {r.cells.map((c,i)=><td key={dates[i]} title={`${r.student.name}, ${fullDate(dates[i])}: ${cell(c)}`}>{c==='fehlt'?<span className="history-none" aria-label={cell(c)}>–</span>:c==='offen'?<span className="history-mark offen" aria-label={cell(c)}/>:<span className={'history-mark '+c} role="img" aria-label={c}>{icon(c,13)}</span>}</td>)}
   </tr>)}</tbody>
  </table></div>
 </>;
}

export default function ClassHistoryDialog({state,groupId,onClose}:{state:State,groupId:string,onClose:()=>void}){
 const panel=useRef<HTMLElement>(null),opener=useRef(document.activeElement as HTMLElement|null);
 useEffect(()=>{
  const overflow=document.body.style.overflow;document.body.style.overflow='hidden';
  panel.current?.focus({preventScroll:true});
  return()=>{document.body.style.overflow=overflow;opener.current?.focus();};
 },[]);
 return <div className="modal-backdrop" onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
  <section ref={panel} tabIndex={-1} className="modal class-history" role="dialog" aria-modal="true" aria-labelledby="class-history-title" onKeyDown={e=>{
   if(e.key==='Escape'){e.preventDefault();e.stopPropagation();onClose();}
   if(e.key==='Tab'){e.preventDefault();e.currentTarget.querySelector<HTMLButtonElement>('.history-close')?.focus();}
  }}>
   <div className="history-head"><h2 id="class-history-title">Verlauf <span lang="ar" dir="rtl">السجل</span></h2><button type="button" className="history-close" aria-label="Schließen" onClick={onClose}><X size={20}/></button></div>
   <ClassHistoryTable state={state} groupId={groupId}/>
  </section>
 </div>;
}

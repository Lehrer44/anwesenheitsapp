import type {State,Status,Student} from './model.ts';

export type HistoryCell=Status|'offen'|'fehlt';
export type ClassHistory={dates:string[],rows:{student:Student,cells:HistoryCell[],absent:number}[]};

/** Submitted, not cancelled lessons of one class, newest first, for the current pupils of that class. */
export function classHistory(s:State,groupId:string):ClassHistory{
 const lessons=s.sessions.filter(d=>!d.cancelled&&d.reports[groupId]).sort((a,b)=>b.date.localeCompare(a.date));
 const rows=s.students.filter(p=>p.group===groupId&&!p.archived).map(student=>{
  const cells=lessons.map<HistoryCell>(d=>!d.roster.some(p=>p.id===student.id)?'fehlt':d.marks[student.id]||'offen');
  return {student,cells,absent:cells.filter(c=>c==='abwesend').length};
 });
 return {dates:lessons.map(d=>d.date),rows};
}

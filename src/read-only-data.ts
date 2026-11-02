import type {State} from './model.ts';

export function readOnlySummary(state:State){
 return {title:state.title,students:state.students,groups:state.groups.map(g=>({
  id:g.id,name:g.name,leader:'',...(g.leaderId?{leaderId:g.leaderId}:{}),...(g.helperId?{helperId:g.helperId}:{}),
 }))};
}
export function readOnlySession(day:State['sessions'][number]){
 return {date:day.date,cancelled:day.cancelled,roster:day.roster,marks:day.marks,groupId:'',reportedAt:null};
}
export function readOnlyState(summary:ReturnType<typeof readOnlySummary>,days:ReturnType<typeof readOnlySession>[]):State{
 return {...summary,sessions:days.map(d=>({date:d.date,cancelled:d.cancelled,roster:d.roster,marks:d.marks,reports:{}})).sort((a,b)=>a.date.localeCompare(b.date))};
}
export function readOnlyAccess(hash:string){
 const params=new URLSearchParams(hash.replace(/^#/,'')),course=params.get('course')||'',token=params.get('read')||'';
 if(params.has('group')||!/^[A-Za-z0-9-]{1,128}$/.test(course)||!/^[A-Za-z0-9-]{64,160}$/.test(token))throw Error('Dieser Leselink ist ungültig.');
 return {course,token};
}

import {collection,doc,getDoc,onSnapshot,onSnapshotsInSync,runTransaction,serverTimestamp,setDoc,type Firestore,type Unsubscribe} from 'firebase/firestore';
import {tokenHash,type Channel,type Lesson} from './firebase-data.ts';
import {ownerAction} from './firebase-repository.ts';
import {readOnlyState,readOnlySummary,readOnlySession} from './read-only-data.ts';
import type {State} from './model.ts';

const invalid=()=>Error('Dieser Leselink ist nicht mehr gültig oder wurde widerrufen.');
export async function getReadOnlyLink(db:Firestore,course:string){
 const snap=await getDoc(doc(db,'courses',course,'private','share'));
 return snap.exists()?snap.data().token as string:'';
}
export async function manageReadOnlyLink(db:Firestore,uid:string,course:string,action:'create'|'renew'|'revoke'){
 // Upgrade existing courses before activating a share, including all class reports.
 if(action!=='revoke')await ownerAction(db,uid,{action:'prepareReadOnly'},course);
 const token=crypto.randomUUID()+crypto.randomUUID(),hash=await tokenHash(token);
 const result=await runTransaction(db,async tx=>{
  const ref=doc(db,'courses',course,'private','share'),root=await tx.get(doc(db,'courses',course)),previous=await tx.get(ref);
  if(!root.exists())throw Error('Liste nicht gefunden.');
  if(previous.exists()&&action==='create')return previous.data().token as string;
  if(previous.exists())tx.delete(doc(db,'shares',await tokenHash(previous.data().token)));
  if(action==='revoke'){tx.delete(ref);return '';}
  tx.set(doc(db,'shares',hash),{ownerUid:root.data().ownerUid,courseId:course});
  tx.set(ref,{token});return token;
 });
 // Reports from already-open legacy clients can race activation. Once the
 // share exists, rules require mirroring; this final sync closes that window.
 if(action!=='revoke')await ownerAction(db,uid,{action:'prepareReadOnly'},course);
 return result;
}
export async function registerReadOnlyViewer(db:Firestore,uid:string,course:string,token:string){
 const hash=await tokenHash(token),share=await getDoc(doc(db,'shares',hash));
 if(!share.exists()||share.data().courseId!==course)throw invalid();
 await setDoc(doc(db,'viewers',uid,'courses',course),{shareHash:hash});
 return hash;
}
export function watchReadOnlyCourse(db:Firestore,uid:string,course:string,hash:string,onChange:(state:State)=>void,onError:(error:Error)=>void):Unsubscribe{
 let stopped=false,failed=false,summary:ReturnType<typeof readOnlySummary>|null=null,days:ReturnType<typeof readOnlySession>[]|null=null;
 const fail=(error:Error)=>{if(!stopped&&!failed){failed=true;summary=null;days=null;onError(error);}};
 const stops=[
  onSnapshot(doc(db,'shares',hash),s=>{if(!s.exists()||s.data().courseId!==course)fail(invalid());},()=>fail(invalid())),
  onSnapshot(doc(db,'viewers',uid,'courses',course),s=>{if(s.data()?.shareHash!==hash)fail(invalid());},()=>fail(invalid())),
  onSnapshot(doc(db,'courses',course,'public','summary'),s=>{if(s.exists())summary=s.data() as typeof summary;else fail(invalid());},fail),
  onSnapshot(collection(db,'courses',course,'publicSessions'),s=>{days=s.docs.map(d=>d.data() as ReturnType<typeof readOnlySession>);},fail),
  onSnapshotsInSync(db,()=>{if(!stopped&&!failed&&summary&&days)onChange(readOnlyState(summary,days));}),
 ];
 return ()=>{stopped=true;stops.forEach(stop=>stop());};
}
// Shared by class submissions and emulator tests. No read of the full course is needed.
export async function submitClassReport(db:Firestore,hash:string,course:string,date:string,marks:Record<string,string>){
 async function submit(mirror:boolean){
  await runTransaction(db,async tx=>{
   const parent=await tx.get(doc(db,'channels',hash)),ref=doc(db,'channels',hash,'lessons',date),snap=await tx.get(ref);
   if(!parent.exists()||!parent.data().active||parent.data().courseId!==course)throw Error('Dieser Klassenlink ist ungültig oder wurde erneuert.');
   if(!snap.exists())throw Error('Termin nicht gefunden.');
   const channel=parent.data() as Channel,lesson=snap.data() as Lesson;
   if(lesson.cancelled)throw Error('Dieser Unterricht fällt aus.');
   if(!lesson.rosterIds.length)throw Error('Für diese Klasse sind keine Schüler zugeteilt.');
   if(!marks||lesson.rosterIds.length!==Object.keys(marks).length||lesson.rosterIds.some(id=>!['anwesend','abwesend','entschuldigt'].includes(marks[id])))throw Error('Bitte die Anwesenheit vollständig prüfen.');
   tx.update(ref,{marks,reportedAt:serverTimestamp()});
   if(mirror){
    const fields:Record<string,unknown>={groupId:channel.groupId,reportedAt:serverTimestamp()};
    for(const id of lesson.rosterIds)fields['marks.'+id]=marks[id];
    tx.update(doc(db,'courses',course,'publicSessions',date),fields);
   }
  });
 }
 try{await submit(true);}catch(error){
  // Legacy lists may not have projections yet. Rules allow the fallback only
  // while sharing is disabled, so an active viewer can never miss a report.
  if(!['permission-denied','not-found'].includes((error as {code:string}).code))throw error;
  await submit(false);
 }
}

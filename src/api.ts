import {getReadOnlyLink,manageReadOnlyLink,registerReadOnlyViewer,watchReadOnlyCourse,submitClassReport} from './firebase-read-only';
import {ownerRead,ownerAction,watchOwnerCourse} from './firebase-repository';
import {signInAnonymously} from 'firebase/auth';
import {createAccountAccess} from './account-auth';
import {auth,db,configured} from './firebase';
import {collection,doc,getDoc,getDocs,onSnapshot,query,where,writeBatch,type Unsubscribe} from 'firebase/firestore';
import {initial,mutate,type State} from './model';
import {documentsFor,groupState,tokenHash,type Channel,type Lesson} from './firebase-data';
export {configured};
export type Access={course:string,token:string};
export type Data={course:string,role:'admin'|'group',state:State,version:number};
export type {CourseChoice} from './course-management';
import type {CourseChoice,CourseEdit} from './course-management';
import {saveCourseLists} from './firebase-course-management';
export async function manageCourseLists(original:CourseChoice[],rows:CourseEdit[]){return saveCourseLists(services().db,owner(),original,rows);}
function services(){if(!db||!auth)throw Error('Firebase ist noch nicht eingerichtet.');return {db,auth};}
const accounts=createAccountAccess(auth,{continueUrl:typeof location==='undefined'?undefined:location.origin+location.pathname});
export const session=accounts.session,ready=accounts.ready,watchAuth=accounts.watch,login=accounts.login,resetPassword=accounts.resetPassword,logout=accounts.logout;
export const pendingAccount=accounts.pending,verificationCooldown=accounts.cooldown,resendVerification=accounts.resend,checkVerification=accounts.check;
async function groupUser(){const {auth}=services();await ready();if(!auth.currentUser)await signInAnonymously(auth);}
function owner(){const user=session();if(!user)throw Error('Bitte mit einem bestätigten oder ausdrücklich freigeschalteten Konto anmelden.');return user.uid;}
export async function isAdministrator(){
 owner();return (await services().auth.currentUser!.getIdTokenResult(true)).claims.administrator===true;
}
export async function listCourses():Promise<CourseChoice[]>{
 const {db}=services(),uid=owner();
 const result=await getDocs(await isAdministrator()?collection(db,'courses'):query(collection(db,'courses'),where('ownerUid','==',uid)));
 return result.docs.map(d=>({id:d.id,title:d.data().title as string})).sort((a,b)=>a.title.localeCompare(b.title,'de'));
}
export async function createCourse(title:string,groupCount:number){
 const {db}=services(),uid=owner(),id=crypto.randomUUID(),state=initial(groupCount);state.title=title.trim().slice(0,100)||'Mein Wochenkurs';
 const docs=await documentsFor(state,id,uid,0),batch=writeBatch(db);
 for(const [path,data] of docs)batch.set(doc(db,path),data);
 await batch.commit();return id;
}
async function groupRead(access:Access):Promise<Data>{
 await groupUser();const {db}=services(),hash=await tokenHash(access.token),snap=await getDoc(doc(db,'channels',hash));
 if(!snap.exists()||!snap.data().active||snap.data().courseId!==access.course)throw Error('Dieser Klassenlink ist ungültig oder wurde erneuert.');
 const lessons=await getDocs(collection(db,'channels',hash,'lessons'));
 return {course:access.course,role:'group',state:groupState(snap.data() as Channel,lessons.docs.map(d=>d.data() as Lesson)),version:0};
}
export async function courseRequest(body:any,access:Access):Promise<Data>{
 if(access.token){
  if(body){
   if(body.action!=='submit')throw Error('Nur die eigene Klassenmeldung ist erlaubt.');
   await groupUser();const {db}=services(),hash=await tokenHash(access.token);
   await submitClassReport(db,hash,access.course,String(body.date),body.marks);
  }
  return await groupRead(access);
 }
 owner();if(!access.course)throw Error('Bitte einen Kurs auswählen.');
 const result=body?await ownerAction(services().db,owner(),body,access.course):await ownerRead(services().db,access.course);
 return {course:access.course,role:'admin',state:result.state,version:result.meta.version};
}

export async function watchCourse(access:Access,onChange:(data:Data)=>void,onError:(error:Error)=>void):Promise<Unsubscribe>{
 const {db}=services(),stops:Unsubscribe[]=[];let stopped=false;
 const fail=(e:Error)=>{if(!stopped)onError(e);};
 if(access.token){
  await groupUser();const hash=await tokenHash(access.token);let channel:Channel|null=null,lessons:Lesson[]|null=null;
  const emit=()=>{if(!stopped&&channel&&lessons)onChange({course:access.course,role:'group',state:groupState(channel,lessons),version:0});};
  stops.push(onSnapshot(doc(db,'channels',hash),snap=>{
   if(!snap.exists()||!snap.data().active||snap.data().courseId!==access.course){channel=null;fail(Error('Dieser Klassenlink ist ungültig oder wurde erneuert.'));return;}
   channel=snap.data() as Channel;emit();
  },fail));
  stops.push(onSnapshot(collection(db,'channels',hash,'lessons'),snap=>{lessons=snap.docs.map(d=>d.data() as Lesson);emit();},fail));
 }else{
  owner();stops.push(watchOwnerCourse(db,access.course,({state,meta})=>{if(!stopped)onChange({course:access.course,role:'admin',state,version:meta.version});},fail));
 }
 return ()=>{stopped=true;stops.forEach(stop=>stop());};
}

export async function readOnlyLink(course:string){owner();return getReadOnlyLink(services().db,course);}
export async function changeReadOnlyLink(course:string,action:'create'|'renew'|'revoke'){return manageReadOnlyLink(services().db,owner(),course,action);}
export async function watchReadOnly(access:{course:string,token:string},onChange:(state:State)=>void,onError:(error:Error)=>void){
 await groupUser();const {db,auth}=services(),uid=auth.currentUser!.uid;
 const hash=await registerReadOnlyViewer(db,uid,access.course,access.token);
 return watchReadOnlyCourse(db,uid,access.course,hash,onChange,onError);
}

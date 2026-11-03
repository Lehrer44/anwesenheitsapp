import {sendEmailVerification,sendPasswordResetEmail,signInWithEmailAndPassword,signOut,onIdTokenChanged,reload,type Auth,type User} from 'firebase/auth';

export type AccountResult={ready:boolean,verificationSent:boolean,warning?:string};
export function authErrorMessage(error:unknown){
 const code=(error as {code?:string})?.code;
 const messages:Record<string,string>={
  'auth/invalid-email':'Bitte eine gültige E-Mail-Adresse eingeben.',
  'auth/invalid-credential':'E-Mail-Adresse oder Passwort ist nicht korrekt.',
  'auth/wrong-password':'E-Mail-Adresse oder Passwort ist nicht korrekt.',
  'auth/user-not-found':'E-Mail-Adresse oder Passwort ist nicht korrekt.',
  'auth/email-already-in-use':'Dieses Konto ist bereits angelegt. Bitte über „Anmelden“ mit dem bisherigen Passwort fortfahren oder „Passwort vergessen?“ verwenden.',
  'auth/weak-password':'Bitte ein stärkeres Passwort mit mindestens acht Zeichen wählen.',
  'auth/too-many-requests':'Zu viele Versuche. Bitte einige Minuten warten und erneut versuchen.',
  'auth/network-request-failed':'Die Verbindung zu Firebase ist fehlgeschlagen. Bitte Internetverbindung prüfen und erneut versuchen.',
  'auth/user-disabled':'Dieses Konto ist gesperrt. Bitte die Administration kontaktieren.',
  'auth/operation-not-allowed':'Die Anmeldung mit E-Mail und Passwort ist derzeit nicht freigeschaltet.',
  'auth/admin-restricted-operation':'Dieses Konto ist noch nicht für die Kursverwaltung freigegeben. Bitte die Administration kontaktieren.',
 };
 return code&&messages[code]||'Der Vorgang konnte nicht abgeschlossen werden. Bitte erneut versuchen.';
}

// Unconfirmed users may stay signed in to resend/recheck, but never count as an app session.
export function createAccountAccess(auth:Auth|null,options:{now?:()=>number,sendVerification?:(user:User)=>Promise<void>,continueUrl?:string}={}){
 let approvedUid='',manuallyApprovedUid='';const attempts=new Map<string,number>(),now=options.now||Date.now;
 function service(){if(!auth)throw Error('Firebase ist noch nicht eingerichtet.');auth.languageCode='de';return auth;}
 const settings=()=>options.continueUrl?{url:options.continueUrl}:undefined;
 async function refreshAccess(force=false){
  approvedUid='';manuallyApprovedUid='';
  const user=auth?.currentUser;if(!user||user.isAnonymous)return;
  const {claims}=await user.getIdTokenResult(force);
  if(auth?.currentUser?.uid===user.uid){
   approvedUid=claims.courseAccessApproved===true||claims.administrator===true?user.uid:'';
   manuallyApprovedUid=claims.administrator===true&&claims.manualAccessApproved===true?user.uid:'';
  }
 }
 const session=()=>auth?.currentUser&&!auth.currentUser.isAnonymous&&approvedUid===auth.currentUser.uid&&(auth.currentUser.emailVerified||manuallyApprovedUid===auth.currentUser.uid)?auth.currentUser:null;
 const pending=()=>{const user=auth?.currentUser;return user&&!user.isAnonymous&&!session()?{uid:user.uid,email:user.email||'',approved:approvedUid===user.uid}:null;};
 const cooldown=()=>{const user=auth?.currentUser,attempt=user?attempts.get(user.uid):undefined;return attempt===undefined?0:Math.max(0,Math.ceil((attempt+60000-now())/1000));};
 async function check(){const user=service().currentUser;if(!user||user.isAnonymous)throw Error('Bitte zuerst anmelden.');await reload(user);await refreshAccess(true);return !!session();}
 async function resend():Promise<AccountResult>{
  if(await check())return {ready:true,verificationSent:false};
  if(!pending()?.approved)throw Object.assign(Error('Freigabe erforderlich.'),{code:'auth/admin-restricted-operation'});
  const user=service().currentUser!;
  if(cooldown())throw Object.assign(Error('Bitte vor dem nächsten Versand kurz warten.'),{code:'auth/too-many-requests'});
  attempts.set(user.uid,now());
  await (options.sendVerification?options.sendVerification(user):sendEmailVerification(user,settings()));
  return {ready:false,verificationSent:true};
 }
 async function login(email:string,password:string):Promise<AccountResult>{await signInWithEmailAndPassword(service(),email.trim(),password);await refreshAccess(true);return {ready:!!session(),verificationSent:false};}
 return {session,pending,cooldown,login,resend,check,
  ready:async()=>{if(auth){await auth.authStateReady();await refreshAccess();}},
  watch:(fn:()=>void)=>auth?onIdTokenChanged(auth,()=>{refreshAccess().then(fn).catch(()=>{approvedUid='';manuallyApprovedUid='';fn();});}):()=>{},
  resetPassword:async(email:string)=>{if(!email.trim())throw Object.assign(Error('Bitte eine E-Mail-Adresse eingeben.'),{code:'auth/invalid-email'});await sendPasswordResetEmail(service(),email.trim(),settings());},
  logout:async()=>{approvedUid='';manuallyApprovedUid='';if(auth)await signOut(auth);},
 };
}

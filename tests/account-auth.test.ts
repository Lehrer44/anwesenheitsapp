import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {initializeApp,deleteApp,type FirebaseApp} from 'firebase/app';
import {getAuth,connectAuthEmulator,applyActionCode,signInAnonymously,createUserWithEmailAndPassword,type Auth} from 'firebase/auth';
import {createAccountAccess,authErrorMessage} from '../src/account-auth.ts';

const project='demo-kursblick-auth',host=process.env.FIREBASE_AUTH_EMULATOR_HOST||'127.0.0.1:9099',base='http://'+host;
let app:FirebaseApp,auth:Auth;
async function codes(){return (await (await fetch(base+'/emulator/v1/projects/'+project+'/oobCodes')).json()).oobCodes as {email:string,oobCode:string}[];}
async function update(value:Record<string,unknown>){const response=await fetch(base+'/identitytoolkit.googleapis.com/v1/accounts:update?key=fake-key',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer owner'},body:JSON.stringify({targetProjectId:project,...value})});assert.equal(response.ok,true,await response.text());}
async function claims(uid:string,value:Record<string,unknown>){await update({localId:uid,customAttributes:JSON.stringify(value)});}
async function provision(email:string){await createUserWithEmailAndPassword(auth,email,'test-password-123');return auth.currentUser!.uid;}
before(async()=>{app=initializeApp({projectId:project,apiKey:'fake-key',authDomain:'localhost'},'account-auth-tests');auth=getAuth(app);connectAuthEmulator(auth,base,{disableWarnings:true});await fetch(base+'/emulator/v1/projects/'+project+'/accounts',{method:'DELETE'});});
after(async()=>{await deleteApp(app);});

test('approved teachers must also verify email; checks and resends preserve the account',async()=>{
 let clock=100000;const email='selected@example.test',uid=await provision(email);
 await claims(uid,{courseAccessApproved:true});
 const access=createAccountAccess(auth,{now:()=>clock,continueUrl:'http://localhost/'});
 await access.logout();await access.login(email,'test-password-123');assert.equal(access.session(),null);assert.equal(access.pending()?.approved,true);
 assert.equal((await access.resend()).verificationSent,true);assert.equal(auth.languageCode,'de');assert.equal(access.cooldown(),60);
 await assert.rejects(access.resend(),{code:'auth/too-many-requests'});assert.equal(await access.check(),false);
 clock+=61000;assert.equal((await access.resend()).verificationSent,true);
 const code=(await codes()).filter(c=>c.email===email).at(-1)!;await applyActionCode(auth,code.oobCode);
 assert.equal(await access.check(),true);assert.equal(access.session()?.uid,uid);assert.equal(access.pending(),null);
 await access.logout();assert.equal((await access.login(' '+email+' ','test-password-123')).ready,true);await access.logout();
});

test('directly created verified accounts remain locked until approval and lock again on revocation',async()=>{
 const uid=await provision('unapproved@example.test'),access=createAccountAccess(auth);
 await access.ready();assert.equal(access.pending()?.approved,false);assert.equal('signup' in access,false);
 await assert.rejects(access.resend(),{code:'auth/admin-restricted-operation'});
 // A caller bypassing the UI and verifying their address still has no management access.
 await update({localId:uid,emailVerified:true});
 assert.equal(await access.check(),false);assert.equal(auth.currentUser?.emailVerified,true);assert.equal(access.session(),null);
 await claims(uid,{courseAccessApproved:'true'});assert.equal(await access.check(),false);
 await claims(uid,{courseAccessApproved:true});assert.equal(await access.check(),true);
 await claims(uid,{courseAccessApproved:false});assert.equal(await access.check(),false);assert.equal(access.session(),null);
 await access.logout();assert.equal((await access.login('unapproved@example.test','test-password-123')).ready,false);await access.logout();
});

test('explicit administrators keep their unverified exception; anonymous users never manage courses',async()=>{
 const uid=await provision('admin@example.test'),access=createAccountAccess(auth);
 await claims(uid,{administrator:true});assert.equal(await access.check(),false);
 await claims(uid,{manualAccessApproved:true});assert.equal(await access.check(),false);
 await claims(uid,{courseAccessApproved:true});assert.equal(await access.check(),false);
 await claims(uid,{administrator:true,manualAccessApproved:true});assert.equal(await access.check(),true);assert.equal(auth.currentUser!.emailVerified,false);
 await claims(uid,{});assert.equal(await access.check(),false);await access.logout();
 await signInAnonymously(auth);await claims(auth.currentUser!.uid,{administrator:true,manualAccessApproved:true,courseAccessApproved:true});await access.ready();assert.equal(access.session(),null);assert.equal(access.pending(),null);await access.logout();
});

test('verification mail failure leaves an approved account pending without granting access',async()=>{
 const uid=await provision('mail-failure@example.test');await claims(uid,{courseAccessApproved:true});
 const access=createAccountAccess(auth,{sendVerification:async()=>{throw Object.assign(Error('network'),{code:'auth/network-request-failed'});}});
 await access.ready();await assert.rejects(access.resend(),{code:'auth/network-request-failed'});assert.equal(access.pending()?.approved,true);assert.equal(access.session(),null);await access.logout();
});

test('administrative approval tool defaults to preview, preserves other claims and verifies grant and revoke',async()=>{
 const uid=await provision('tool@example.test'),access=createAccountAccess(auth);
 await update({localId:uid,emailVerified:true});await claims(uid,{unrelated:'keep'});
 const run=(...flags:string[])=>promisify(execFile)(process.execPath,['scripts/approve-account.cjs','--project',project,'--uid',uid,...flags],{env:{...process.env,FIREBASE_AUTH_EMULATOR_HOST:host}});
 assert.match((await run()).stdout,/"dryRun": true/);assert.equal(await access.check(),false);
 await run('--apply');assert.equal(await access.check(),true);assert.equal((await auth.currentUser!.getIdTokenResult()).claims.unrelated,'keep');
 await run('--revoke','--apply');assert.equal(await access.check(),false);assert.equal((await auth.currentUser!.getIdTokenResult()).claims.unrelated,'keep');await access.logout();
});

test('friendly errors explain invalid credentials, throttling and required approval',()=>{
 assert.match(authErrorMessage({code:'auth/admin-restricted-operation'}),/freigegeben/);assert.match(authErrorMessage({code:'auth/invalid-credential'}),/nicht korrekt/);assert.match(authErrorMessage({code:'auth/too-many-requests'}),/warten/);
});

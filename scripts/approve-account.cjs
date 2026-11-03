// Administrative tool only. Never import into the web application.
// Uses the existing Firebase CLI login; no credentials are saved or printed.
async function main(){
 const args=process.argv.slice(2),value=name=>{const i=args.indexOf(name);return i<0?undefined:args[i+1];};
 const project=value('--project'),uid=value('--uid'),approve=!args.includes('--revoke');
 if(!project||!/^[a-z0-9-]+$/.test(project)||!uid||!/^[A-Za-z0-9_-]{1,128}$/.test(uid))throw Error('Erforderlich: --project PROJEKT-ID --uid FIREBASE-UID [--revoke] [--apply]');
 const emulator=process.env.FIREBASE_AUTH_EMULATOR_HOST;
 let origin='https://identitytoolkit.googleapis.com',token;
 if(emulator){
  if(!project.startsWith('demo-')||!/^127\.0\.0\.1:\d+$/.test(emulator))throw Error('Emulatormodus nur für lokale Demo-Projekte erlaubt.');
  origin='http://'+emulator+'/identitytoolkit.googleapis.com';token='owner';
 }else{
  const {configstore}=require('firebase-tools/lib/configstore');
  const {requireAuth}=require('firebase-tools/lib/requireAuth');
  await requireAuth({project,user:configstore.get('user'),tokens:configstore.get('tokens')});
  token=await require('firebase-tools/lib/apiv2').getAccessToken();
 }
 async function request(action,body){
  const response=await fetch(origin+'/v1/projects/'+project+'/accounts:'+action,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!response.ok)throw Error('Firebase-Administrationsaufruf fehlgeschlagen ('+response.status+'). Projekt, Anmeldung und Berechtigungen prüfen.');
  return response.json();
 }
 const before=(await request('lookup',{localId:[uid]})).users?.[0];
 if(!before||before.localId!==uid||!before.email||before.disabled)throw Error('Kein aktives Konto mit E-Mail für diese UID gefunden.');
 const current=JSON.parse(before.customAttributes||'{}');
 if(!current||typeof current!=='object'||Array.isArray(current))throw Error('Ungültige bestehende Claims.');
 const next={...current,courseAccessApproved:approve};
 if(args.includes('--revoke')&&current.administrator===true)throw Error('Dieses Konto ist Administrator. Der Widerruf der Lehrkräftefreigabe entzieht keine Administratorrechte; diese separat administrativ prüfen.');
 console.log(JSON.stringify({project,uid,courseAccessApproved:approve,dryRun:!args.includes('--apply')},null,2));
 if(!args.includes('--apply'))return;
 await request('update',{localId:uid,customAttributes:JSON.stringify(next)});
 const after=(await request('lookup',{localId:[uid]})).users?.[0],actual=JSON.parse(after?.customAttributes||'{}');
 if(JSON.stringify(actual)!==JSON.stringify(next))throw Error('Claims nach dem Schreiben nicht wie erwartet. Bitte administrativ prüfen.');
 console.log('Kontofreigabe gespeichert und nachgelesen. Ein frisches ID-Token ist erforderlich.');
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});

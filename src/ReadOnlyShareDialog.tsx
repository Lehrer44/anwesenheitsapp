import {useEffect,useRef,useState} from 'react';
import {Link2,X} from 'lucide-react';
import {readOnlyLink,changeReadOnlyLink} from './api';

export default function ReadOnlyShareDialog({course,onClose}:{course:string,onClose:()=>void}){
 const [token,setToken]=useState(''),[busy,setBusy]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const input=useRef<HTMLInputElement>(null),close=useRef<HTMLButtonElement>(null),panel=useRef<HTMLElement>(null),opener=useRef(document.activeElement as HTMLElement|null);
 useEffect(()=>{const overflow=document.body.style.overflow;document.body.style.overflow='hidden';panel.current?.focus();return()=>{document.body.style.overflow=overflow;opener.current?.focus();};},[]);
 useEffect(()=>{let disposed=false;close.current?.focus();readOnlyLink(course).then(t=>{if(!disposed)setToken(t);}).catch(e=>{if(!disposed)setError(e.message);}).finally(()=>{if(!disposed)setBusy(false);});return()=>{disposed=true;};},[course]);
 useEffect(()=>{const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!busy)onClose();};window.addEventListener('keydown',escape);return()=>window.removeEventListener('keydown',escape);},[busy,onClose]);
 const url=token?location.origin+location.pathname+'#course='+encodeURIComponent(course)+'&read='+token:'';
 async function change(action:'create'|'renew'|'revoke'){
  if(action!=='create'&&!confirm(action==='renew'?'Bisherigen Leselink ungültig machen und einen neuen erstellen?':'Leselink widerrufen? Die geteilte Ansicht verliert den Zugriff.'))return;
  setBusy(true);setError('');setNotice('');
  try{setToken(await changeReadOnlyLink(course,action));setNotice(action==='revoke'?'Leselink widerrufen.':'Leselink ist bereit.');}catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 async function copy(){try{await navigator.clipboard.writeText(url);setNotice('Leselink kopiert.');}catch{input.current?.focus();input.current?.select();setNotice('Bitte den markierten Link kopieren.');}}
 return <div className="modal-backdrop" onClick={e=>{if(e.target===e.currentTarget&&!busy)onClose();}}><section ref={panel} tabIndex={-1} className="modal share-dialog" onKeyDown={e=>{if(e.key!=='Tab')return;const controls=[...e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled)')];const first=controls[0],last=controls.at(-1);if(!first){e.preventDefault();return;}if(e.shiftKey&&(document.activeElement===first||document.activeElement===e.currentTarget)){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}} role="dialog" aria-modal="true" aria-labelledby="share-title"><button ref={close} className="close" disabled={busy} onClick={onClose} aria-label="Schließen"><X/></button><h2 id="share-title"><Link2 size={22}/> Tabelle teilen</h2><p>Der Leselink zeigt alle Schüler, Klassen und angelegten Termine dieser Liste. Anwesenheitsänderungen werden live angezeigt. Die Ansicht enthält keine Buttons zum Bearbeiten.</p><p className="hint">Jeder mit diesem Link kann die Tabelle lesen. Teile ihn nur mit den vorgesehenen Personen. Du kannst ihn jederzeit widerrufen oder erneuern.</p>
  {url&&<label>Leselink<input ref={input} readOnly value={url} onFocus={e=>e.target.select()}/></label>}
  {error&&<p className="form-error" role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  <div className="share-actions">{token?<><button className="btn primary" disabled={busy} onClick={copy}>Link kopieren</button><button className="btn" disabled={busy} onClick={()=>change('renew')}>Link erneuern</button><button className="btn danger" disabled={busy} onClick={()=>change('revoke')}>Link widerrufen</button></>:<button className="btn primary" disabled={busy} onClick={()=>change('create')}>{busy?'Wird geladen …':'Leselink erstellen'}</button>}</div><div className="modal-actions"><button className="btn" disabled={busy} onClick={onClose}>Schließen</button></div>
 </section></div>;
}

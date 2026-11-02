import {createRoot} from 'react-dom/client';
import {useEffect,useState} from 'react';
import App from './App';
import ReadOnlyView from './ReadOnlyView';
import './style.css';
function Root(){
 const [hash,setHash]=useState(location.hash);
 useEffect(()=>{const changed=()=>setHash(location.hash);window.addEventListener('hashchange',changed);return()=>window.removeEventListener('hashchange',changed);},[]);
 return new URLSearchParams(hash.slice(1)).has('read')?<ReadOnlyView key={hash} hash={hash}/>:<App/>;
}
createRoot(document.getElementById('root')!).render(<Root/>);

import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {initial,mutate} from '../src/model.ts';
const server=await createServer({server:{middlewareMode:true,watch:null,hmr:false},optimizeDeps:{noDiscovery:true,include:[]},appType:'custom'});
try{
 const {default:Login}=await server.ssrLoadModule('/src/Login.tsx');
 const login=renderToStaticMarkup(createElement(Login,{onLogin:()=>{}}));
 assert.ok(login.includes('Neue Konten werden ausschließlich durch die Administration eingerichtet.'));
 assert.ok(login.includes('Anmelden'));assert.ok(!login.includes('Registrieren'));assert.ok(!login.includes('Konto erstellen'));assert.ok(login.includes('current-password'));
 const {ReadOnlyTable}=await server.ssrLoadModule('/src/ReadOnlyView.tsx');
 const state=initial(2);mutate(state,{action:'addStudents',names:'Ada\nBen',group:state.groups[0].id});mutate(state,{action:'addStudents',names:'Clara',group:state.groups[1].id});
 for(const date of ['2026-10-01','2026-10-08'])mutate(state,{action:'session',date});state.sessions[0].marks[state.students[0].id]='abwesend';
 state.sessions[0].roster=state.sessions[0].roster.filter(p=>p.id!==state.students[2].id);state.sessions[1].cancelled='Ferien';
 const html=renderToStaticMarkup(createElement(ReadOnlyTable,{state}));
 for(const tag of ['button','input','select','textarea','a'])assert.ok(!new RegExp('<'+tag+'(?:\\s|>)').test(html),`Read-only table has ${tag}`);
 for(const text of ['اسم','Ada','Ben','Clara','01.10.2026','08.10.2026','abwesend','nicht im Kurs','Ferien'])assert.ok(html.includes(text),`Missing ${text}`);
 assert.ok(!html.includes('Schülername'));assert.ok(!html.includes('>?<'));assert.ok(html.includes('cellstatus offen"></span>'));
 assert.ok(html.includes('dir="rtl"'));assert.equal((html.match(/class="number-column">1<\/td>/g)||[]).length,2);
 const empty=renderToStaticMarkup(createElement(ReadOnlyTable,{state:initial()}));assert.ok(empty.includes('Noch keine Termine'));assert.ok(!empty.includes('<button'));
 console.log('Read-only UI checks passed: all dates, classes and states, RTL, class numbering, empty list and no buttons or editing controls.');
}finally{await server.close();}

import assert from 'node:assert/strict';
import {initial,mutate,type State} from '../src/model.ts';
import {makeXlsx} from '../src/export.ts';
function entries(bytes:Uint8Array){const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),files:Record<string,string>={};let i=0;const decoder=new TextDecoder();while(view.getUint32(i,true)===0x04034b50){const size=view.getUint32(i+18,true),names=view.getUint16(i+26,true),extra=view.getUint16(i+28,true);const path=decoder.decode(bytes.subarray(i+30,i+30+names)),start=i+30+names+extra;files[path]=decoder.decode(bytes.subarray(start,start+size));i=start+size;}return files;}
const s=initial(7);mutate(s,{action:'addStudents',names:'Anna\nBen\nClara',group:s.groups[0].id});mutate(s,{action:'assign',id:s.students[2].id,group:s.groups[1].id});
for(const date of ['2026-10-01','2026-10-08'])mutate(s,{action:'session',date});
for(const [i,status]of ['anwesend','abwesend','entschuldigt'].entries())mutate(s,{action:'mark',date:'2026-10-08',id:s.students[i].id,status});
const files=entries(makeXlsx(s)),sheet=files['xl/worksheets/sheet1.xml'],styles=files['xl/styles.xml'];
function cell(xml:string,address:string){const match=xml.match(new RegExp(`<c r="${address}" s="(\\d+)"[^>]*>(.*?)</c>`));assert.ok(match,`Missing cell ${address}`);return {style:Number(match[1]),body:match[2]};}
function format(address:string){return [...styles.matchAll(/<xf numFmtId=.*?<\/xf>/g)][cell(sheet,address).style][0];}
assert.match(sheet,/rightToLeft="1"/);assert.match(sheet,/topLeftCell="C2"/);
for(const width of ['4','18','10.77734375','4.5546875'])assert.ok(sheet.includes(`width="${width}"`));
assert.ok([...sheet.matchAll(/<row [^>]*>/g)].every(m=>m[0].includes('ht="22.05"')));
assert.equal(cell(sheet,'A3').body,'<v>1</v>');assert.equal(cell(sheet,'A4').body,'<v>2</v>');assert.equal(cell(sheet,'A6').body,'<v>1</v>');
assert.match(cell(sheet,'C3').body,/>\?<\/t>/);assert.match(cell(sheet,'D3').body,/<t xml:space="preserve"><\/t>/);
assert.match(cell(sheet,'D4').body,/>abwesend<\/t>/);assert.match(cell(sheet,'D6').body,/>entschuldigt<\/t>/);
assert.match(cell(sheet,'E4').body,/<f>COUNTIF\(C4:D4,&quot;abwesend&quot;\)<\/f><v>1<\/v>/);
assert.match(cell(sheet,'E6').body,/<v>0<\/v>/);assert.ok(sheet.includes('A2:E2'));assert.ok(!sheet.includes('Schüler ·'));
assert.match(styles,/rgb="FFFF6161"/);assert.match(styles,/rgb="FF0086EA"/);assert.match(format('D4'),/fontId="2" fillId="2"/);assert.match(format('D6'),/fontId="2" fillId="3"/);
assert.match(format('A3'),/borderId="1"/);assert.match(format('D3'),/borderId="0"/);assert.match(format('E3'),/borderId="2"/);assert.match(format('A4'),/borderId="7"/);assert.match(format('D4'),/borderId="6"/);
assert.match(styles,/style="thin"/);assert.match(styles,/style="medium"/);
const filtered=entries(makeXlsx(s,'2026-10-08','2026-10-08',{absent:'A & <fehlt> *?"',excused:'=E'}))['xl/worksheets/sheet1.xml'];
assert.match(cell(filtered,'C4').body,/>A &amp; &lt;fehlt&gt; \*\?&quot;<\/t>/);assert.match(cell(filtered,'C6').body,/>=E<\/t>/);
assert.match(cell(filtered,'D4').body,/COUNTIF\(C4:C4,&quot;A &amp; &lt;fehlt&gt; ~\*~\?&quot;&quot;&quot;\)/);assert.ok(!filtered.includes('r="E1"'));
for(const absent of ['', 'entschuldigt','ENTSCHULDIGT','?','X','x','001']){
 const xml=entries(makeXlsx(s,'','',{absent}))['xl/worksheets/sheet1.xml'];assert.equal(cell(xml,'E4').body,'<v>1</v>');assert.equal(cell(xml,'E6').body,'<v>0</v>');
}
const operatorLabel=entries(makeXlsx(s,'','',{absent:'>0'}))['xl/worksheets/sheet1.xml'];
assert.match(cell(operatorLabel,'E4').body,/&quot;=&gt;0&quot;/);
const historical=structuredClone(s);historical.sessions[0].roster=historical.sessions[0].roster.filter(p=>p.id!==historical.students[0].id);historical.sessions[0].marks[historical.students[0].id]='abwesend';historical.sessions[1].cancelled='Ferien & frei';
const history=entries(makeXlsx(historical))['xl/worksheets/sheet1.xml'];assert.match(cell(history,'C3').body,/>X<\/t>/);assert.match(cell(history,'D3').body,/>Ausfall: Ferien &amp; frei<\/t>/);assert.match(cell(history,'E3').body,/<v>0<\/v>/);
const empty=entries(makeXlsx(s,'2030-01-01'))['xl/worksheets/sheet1.xml'];assert.equal(cell(empty,'C3').body,'<v>0</v>');assert.ok(!empty.includes('<f>'));assert.ok(!empty.includes('max="2" width="10.'));
assert.ok(entries(makeXlsx(initial()))['xl/worksheets/sheet1.xml'].includes('r="C1"'));
const wide:State=structuredClone(s);wide.sessions=Array.from({length:30},(_,i)=>({...s.sessions[1],date:`2026-11-${String(i+1).padStart(2,'0')}`}));
assert.match(cell(entries(makeXlsx(wide))['xl/worksheets/sheet1.xml'],'AG4').body,/COUNTIF\(C4:AF4,/);
console.log('Export checks passed: reference layout, RTL, class numbering, colors/borders, statuses, counters, literal custom labels, date filtering, empty and wide exports.');

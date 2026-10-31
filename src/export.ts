import {groupedStudents,type State} from './model.ts';
const enc=new TextEncoder();
const xml=(x:string)=>x.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
function crc(data:Uint8Array){let c=0xffffffff;for(const x of data){c^=x;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0;}
function zip(files:Record<string,string>){const chunks:Uint8Array[]=[];const central:Uint8Array[]=[];let off=0;for(const [name,content]of Object.entries(files)){const n=enc.encode(name),d=enc.encode(content),sum=crc(d);const h=new Uint8Array(30+n.length);const v=new DataView(h.buffer);v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint32(14,sum,true);v.setUint32(18,d.length,true);v.setUint32(22,d.length,true);v.setUint16(26,n.length,true);h.set(n,30);chunks.push(h,d);const c=new Uint8Array(46+n.length);const w=new DataView(c.buffer);w.setUint32(0,0x02014b50,true);w.setUint16(4,20,true);w.setUint16(6,20,true);w.setUint16(8,0x800,true);w.setUint32(16,sum,true);w.setUint32(20,d.length,true);w.setUint32(24,d.length,true);w.setUint16(28,n.length,true);w.setUint32(42,off,true);c.set(n,46);central.push(c);off+=h.length+d.length;}const size=central.reduce((a,c)=>a+c.length,0);const end=new Uint8Array(22);const e=new DataView(end.buffer);e.setUint32(0,0x06054b50,true);e.setUint16(8,central.length,true);e.setUint16(10,central.length,true);e.setUint32(12,size,true);e.setUint32(16,off,true);const out=new Uint8Array(off+size+22);let p=0;for(const c of [...chunks,...central,end]){out.set(c,p);p+=c.length;}return out;}
function col(n:number){let s='';for(n++;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;}
export function makeXlsx(s:State,from='',to='',labels:{absent?:string,excused?:string}={}){
 const absent=labels.absent??'abwesend',excused=labels.excused??'entschuldigt';
 const ds=s.sessions.filter(d=>(!from||d.date>=from)&&(!to||d.date<=to));
 const palette=['E1EFE9','E3EDF9','F1E6F5','FFF0D8','F8E4E8','E0F1F3'];
 const lastColumn=ds.length+2;
 type Cell={value:string|number,style:number,formula?:string};
 const rows:Cell[][]=[],merges:string[]=[],formats:string[]=[];
 const formatIds=new Map<string,number>();
 // Styles are shared, including positional borders, so large exports stay compact.
 function style(font=0,fill=0,border=0,num=0,align='center'){
  const key=[font,fill,border,num,align].join(':');
  let id=formatIds.get(key);
  if(id===undefined){id=formats.length;formatIds.set(key,id);formats.push(`<xf numFmtId="${num}" fontId="${font}" fillId="${fill}" borderId="${border}" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="${align}" vertical="center" wrapText="1"/></xf>`);}
  return id;
 }
 // 0: inner grid, 1: number edge, 2: counter edges, 3–5: merged class band.
 style(0,0,9,0,'general');
 rows.push([{value:'Nr.',style:style(1,4,1)},{value:'اسم',style:style(1,4)},
  ...ds.map(d=>({value:Math.round((Date.parse(d.date+'T00:00:00Z')-Date.UTC(1899,11,30))/86400000),style:style(1,4,0,164)})),
  {value:'غياب',style:style(0,4,2)}]);
 for(const [gi,g] of groupedStudents(s).entries()){
  if(!g.students.length)continue;
  const fill=5+gi%6;
  rows.push(Array.from({length:lastColumn+1},(_,j)=>({value:j===0?g.name:'',style:style(1,fill,j===0?3:j===lastColumn?5:4,0,'right')})));
  merges.push(`A${rows.length}:${col(lastColumn)}${rows.length}`);
  for(const [i,p] of g.students.entries()){
   const leader=s.groups.some(g=>g.leaderId===p.id);
   const bottom=i===g.students.length-1?6:0;
   const row:Cell[]=[{value:i+1,style:style(1,fill,1+bottom)},{value:p.name+(p.archived?' (archiviert)':''),style:style(leader?1:0,fill,bottom,0,'general')}];
   let absenceCount=0;
   for(const d of ds){
    const enrolled=d.roster.some(x=>x.id===p.id),status=d.marks[p.id];
    let value='',font=0,background=0;
    if(!enrolled)value='X';
    else if(d.cancelled)value='Ausfall: '+d.cancelled;
    else if(status==='abwesend'){value=absent;font=2;background=2;absenceCount++;}
    else if(status==='entschuldigt'){value=excused;font=2;background=3;}
    else if(status!=='anwesend')value='?';
    row.push({value,style:style(font,background,bottom)});
   }
   // Escape COUNTIF wildcards and Excel string quotes. Labels remain literal cell text.
   // Empty or ambiguous custom labels cannot be counted reliably from the visible cells.
   const countable=absent!==''&&!Number.isFinite(Number(absent))&&![excused,'X','?',...ds.filter(d=>d.cancelled).map(d=>'Ausfall: '+d.cancelled)].some(value=>value.toLowerCase()===absent.toLowerCase());
   const criterion=(/^[=<>]/.test(absent)?'=':'')+absent.replace(/[~*?]/g,'~$&').replace(/"/g,'""');
   row.push({value:absenceCount,style:style(0,0,2+bottom),formula:ds.length&&countable?`COUNTIF(C${rows.length+1}:${col(lastColumn-1)}${rows.length+1},"${criterion}")`:undefined});
   rows.push(row);
  }
 }
 const sheet=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0" rightToLeft="1"><pane xSplit="2" ySplit="1" topLeftCell="C2" activePane="bottomRight" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="1" width="4" customWidth="1"/><col min="2" max="2" width="18" customWidth="1"/>${ds.length?`<col min="3" max="${lastColumn}" width="10.77734375" customWidth="1"/>`:''}<col min="${lastColumn+1}" max="${lastColumn+1}" width="4.5546875" customWidth="1"/></cols><sheetData>${rows.map((r,i)=>`<row r="${i+1}" ht="22.05" customHeight="1">${r.map((c,j)=>`<c r="${col(j)}${i+1}" s="${c.style}"${typeof c.value==='number'?'':' t="inlineStr"'}>${c.formula?`<f>${xml(c.formula)}</f>`:''}${typeof c.value==='number'?`<v>${c.value}</v>`:`<is><t xml:space="preserve">${xml(c.value)}</t></is>`}</c>`).join('')}</row>`).join('')}</sheetData>${merges.length?`<mergeCells count="${merges.length}">${merges.map(ref=>`<mergeCell ref="${ref}"/>`).join('')}</mergeCells>`:''}<pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup orientation="landscape" paperSize="9" fitToWidth="1" fitToHeight="0"/></worksheet>`;
 const line=(side:string,width:string)=>`<${side} style="${width}"><color rgb="FF000000"/></${side}>`;
 const border=(left:string,right:string,top:string,bottom:string)=>`<border>${line('left',left)}${line('right',right)}${line('top',top)}${line('bottom',bottom)}<diagonal/></border>`;
 const borders=[border('thin','thin','thin','thin'),border('medium','thin','thin','thin'),border('medium','medium','thin','thin'),border('medium','none','medium','medium'),border('none','none','medium','medium'),border('none','medium','medium','medium'),border('thin','thin','thin','medium'),border('medium','thin','thin','medium'),border('medium','medium','thin','medium'),'<border><left/><right/><top/><bottom/><diagonal/></border>'];
 const styles=`<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="dd.mm.yyyy"/></numFmts><fonts count="3">${[0,1,2].map(i=>`<font>${i===1?'<b/>':''}<sz val="11"/><name val="Calibri"/><color rgb="${i===2?'FFFFFFFF':'FF263A33'}"/></font>`).join('')}</fonts><fills count="11"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>${['FF6161','0086EA','F2F2F2',...palette].map(c=>`<fill><patternFill patternType="solid"><fgColor rgb="FF${c}"/><bgColor indexed="64"/></patternFill></fill>`).join('')}</fills><borders count="${borders.length}">${borders.join('')}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${formats.length}">${formats.join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
 return zip({'[Content_Types].xml':'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>','_rels/.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>','xl/workbook.xml':'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Anwesenheit" sheetId="1" r:id="rId1"/></sheets></workbook>','xl/_rels/workbook.xml.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>','xl/styles.xml':styles,'xl/worksheets/sheet1.xml':sheet});
}

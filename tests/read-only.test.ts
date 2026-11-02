import assert from 'node:assert/strict';
import {initial,mutate} from '../src/model.ts';
import {readOnlySummary,readOnlySession,readOnlyState,readOnlyAccess} from '../src/read-only-data.ts';
const s=initial(2);mutate(s,{action:'addStudents',names:'Anna',group:s.groups[0].id});mutate(s,{action:'session',date:'2026-01-01'});
s.groups[0].helperId=s.students[0].id;
const summary=readOnlySummary(s),serialized=JSON.stringify(summary);
for(const g of s.groups){assert.ok(!serialized.includes(g.token!));assert.ok(!('token' in summary.groups[0]));}
assert.equal(summary.groups[0].helperId,s.students[0].id);
const days=s.sessions.map(readOnlySession),view=readOnlyState(summary,days);
assert.equal(view.sessions[0].date,'2026-01-01');assert.deepEqual(view.sessions[0].reports,{});assert.equal(view.students[0].name,'Anna');
assert.equal(readOnlyAccess('#course=course-one&read='+s.groups[0].token).course,'course-one');
for(const hash of ['#course=x&read=short','#read='+s.groups[0].token,'#course=../x&read='+s.groups[0].token,'#course=x&read='+s.groups[0].token+'&group=other'])assert.throws(()=>readOnlyAccess(hash),/ungültig/);
console.log('Read-only data checks passed: no class credentials, complete table data and strict link parsing.');

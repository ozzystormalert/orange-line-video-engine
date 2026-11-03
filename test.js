'use strict';const assert=require('node:assert/strict');const {exactName,duration,assess}=require('./server');
assert.equal(exactName('Northampton Street Bridge — engineering history','Northampton Street Bridge'),true);
assert.equal(exactName('Northampton Bridge Street railway station','Northampton Street Bridge'),false);
assert.equal(duration('PT3M59S'),239);assert.equal(duration('PT4M'),240);assert.equal(duration('PT20M'),1200);
const v={id:'abc123',snippet:{title:'Northampton Street Bridge historical engineering documentary',description:'History of Northampton Street Bridge in Pennsylvania',channelTitle:'Historic Engineering'},contentDetails:{duration:'PT20M'},statistics:{viewCount:'2400'},status:{privacyStatus:'public'}};
assert.equal(assess(v,'Northampton Street Bridge',4,'Pennsylvania').qualified,true);
assert.equal(assess(v,'Northampton Street Bridge',3,'Pennsylvania').qualified,false);
assert.equal(assess({...v,snippet:{...v.snippet,title:'Unrelated bridge',description:'Rail history'}} ,'Northampton Street Bridge',4,'Pennsylvania').qualified,false);
console.log('PASS: Green Line clone identity and duration rules');

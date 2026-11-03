'use strict';
// Mock YouTube API, not live YouTube. Confirms the Green Line-shaped JSON contract.
const assert=require('node:assert/strict');
process.env.YOUTUBE_API_KEY='TEST_ONLY_NOT_A_REAL_KEY';
const calls=[];
global.fetch=async(url)=>{const u=new URL(url);calls.push(u);if(u.pathname.endsWith('/search'))return {ok:true,json:async()=>({items:[{id:{videoId:'testID123'}}]})};if(u.pathname.endsWith('/videos'))return {ok:true,json:async()=>({items:[{id:'testID123',snippet:{title:'Northampton Street Bridge — Historic Engineering documentary',description:'Historic engineering of the Northampton Street Bridge in Pennsylvania',channelTitle:'History Channel'},contentDetails:{duration:'PT22M'},statistics:{viewCount:'1200'},status:{privacyStatus:'public'}}]})};throw Error('Unexpected API path')};
const {audit}=require('./server');
(async()=>{const result=await audit('Northampton Street Bridge',4,'Pennsylvania');assert.equal(result.ok,true);assert.equal(result.engine,4);assert.equal(result.accepted,1);assert.equal(result.videos[0].durationSeconds,1320);assert.equal(result.videos[0].qualified,true);assert.equal(calls[0].searchParams.get('q'),'Northampton Street Bridge');assert.equal(calls[0].searchParams.get('videoDuration'),'long');assert.equal(calls[1].searchParams.get('part'),'snippet,contentDetails,statistics,status');console.log('PASS mocked /audit-video response and name-only YouTube query')})().catch(e=>{console.error(e);process.exit(1)});

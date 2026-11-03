'use strict';
/* Orange Line 2, adapting Green Line 1 V74 /audit-video contract.
   YouTube key stays in Render YOUTUBE_API_KEY, NEVER in Blogger. */
const http=require('node:http');
const {URL}=require('node:url');
const PORT=Number(process.env.PORT)||10000;
const KEY=process.env.YOUTUBE_API_KEY||'';
const TTL=15*60*1000,cache=new Map();
const HIST=/\b(history|historic|historical|heritage|archive|archival|documentary|engineering|construction|built|restoration|preservation|tour|museum|landmark|civil engineering|explained|industrial|century|railroad|bridge|dam|canal|tunnel)\b/i;
const EDU=/\b(documentary|history|historical|historic|educational|lecture|heritage|engineering|archive|preservation|civil engineering|construction|museum|explained|infrastructure)\b/i;
const OFF_TOPIC=/\b(gaming|walkthrough game|minecraft|roblox|fortnite|music video|lyrics|reaction prank|car accident today)\b/i;
function norm(v){return String(v||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[–—_-]/g,' ').replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim()}
function exactName(text,name){let t=' '+norm(text)+' ',n=' '+norm(name)+' ';return n.trim().length>=5&&t.includes(n)}
function duration(iso){const m=/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(iso||'');return m?86400*(+m[1]||0)+3600*(+m[2]||0)+60*(+m[3]||0)+(+m[4]||0):null}
function stamp(sec){if(!Number.isFinite(sec))return 'unknown';const h=Math.floor(sec/3600),m=Math.floor(sec%3600/60),s=sec%60;return h?`${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`:`${m}:${String(s).padStart(2,'0')}`}
function assess(v,site,engine,state=''){
 const title=String(v.snippet?.title||''),desc=String(v.snippet?.description||''),seconds=duration(v.contentDetails?.duration);
 const titleMatch=exactName(title,site),descMatch=exactName(desc,site),words=title+' '+desc;
 const reasons=[];
 if(!titleMatch&&!descMatch)reasons.push('Full landmark name absent from title and description');
 if(!titleMatch&&descMatch&&state&&!norm(words).includes(norm(state)))reasons.push('Description-only name match lacks geographic corroboration');
 if(seconds===null)reasons.push('Duration metadata unavailable');
 else if(engine===3&&(seconds<=0||seconds>=240))reasons.push('Outside short-video duration (under 4 minutes)');
 else if(engine===4&&seconds<1200)reasons.push('Below 20-minute documentary minimum');
 if(!HIST.test(words))reasons.push('No historical/engineering educational signal in metadata');
 if(engine===4&&!EDU.test(words))reasons.push('No documentary/educational evidence in metadata');
 if(OFF_TOPIC.test(title))reasons.push('Non-historical video title');
 if(v.status?.privacyStatus && v.status.privacyStatus!=='public')reasons.push('Video is not public');
 const qualified=reasons.length===0;
 return {id:v.id,title,url:'https://www.youtube.com/watch?v='+encodeURIComponent(v.id),channel:String(v.snippet?.channelTitle||''),durationSeconds:seconds,durationLabel:stamp(seconds),views:Number(v.statistics?.viewCount||0),publishedAt:v.snippet?.publishedAt||'',qualified,rejectionReasons:reasons,evidence:{status:qualified?'Metadata candidate — historical content not authenticated':'Rejected metadata candidate',nameInTitle:titleMatch,nameInDescription:descMatch}};
}
async function api(path,params){const u=new URL('https://www.googleapis.com/youtube/v3/'+path);Object.entries({...params,key:KEY}).forEach(([k,v])=>u.searchParams.set(k,String(v)));const ctrl=new AbortController(),timeout=setTimeout(()=>ctrl.abort(),17000);try{const r=await fetch(u,{signal:ctrl.signal});const d=await r.json();if(!r.ok)throw Error(d?.error?.message||'YouTube API HTTP '+r.status);return d}finally{clearTimeout(timeout)}}
async function audit(site,engine,state=''){
 const key=[norm(site),engine,norm(state)].join('|'),prev=cache.get(key);if(prev&&prev.expires>Date.now())return {...prev.data,cached:true};
 // Name-only YouTube query exactly as requested; state is used for identity corroboration only.
 const result=await api('search',{part:'snippet',q:site,type:'video',videoDuration:engine===3?'short':'long',maxResults:40,safeSearch:'moderate'});
 const ids=[...new Set((result.items||[]).map(x=>x.id?.videoId).filter(Boolean))];
 const details=ids.length?await api('videos',{part:'snippet,contentDetails,statistics,status',id:ids.join(',')}):{items:[]};
 const videos=(details.items||[]).map(x=>assess(x,site,engine,state));
 const data={ok:true,engine,site,state,videos,checked:ids.length,accepted:videos.filter(x=>x.qualified).length,rejected:videos.filter(x=>!x.qualified).length,complete:false,verifiedScope:'YouTube API metadata screening; source-content verification pending',auditVersion:'green-v74-orange-identity-context-v1',automaticHistoricalGrades:false};
 cache.set(key,{expires:Date.now()+TTL,data});if(cache.size>300)cache.delete(cache.keys().next().value);return data;
}
function respond(res,code,body){res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body))}
const server=http.createServer(async(req,res)=>{if(req.method==='OPTIONS')return respond(res,204,{});if(req.method!=='GET')return respond(res,405,{ok:false,error:'Only GET supported'});
 let u;try{u=new URL(req.url,'http://localhost')}catch(_){return respond(res,400,{ok:false,error:'Invalid URL'})}
 if(u.pathname==='/health')return respond(res,200,{ok:true,hasKey:!!KEY,service:'orange-line-video-engine',auditVersion:'green-v74-orange-identity-context-v1',relevanceVersion:'identity-and-historical-context-v1',independentEngines:[3,4],automaticHistoricalGrades:false});
 if(u.pathname!=='/audit-video'&&u.pathname!=='/audit')return respond(res,404,{ok:false,error:'Use /audit-video?site=...&state=...&engine=3|4'});
 const site=(u.searchParams.get('site')||u.searchParams.get('name')||'').trim(),state=(u.searchParams.get('state')||'').trim();
 const engine=Number(u.searchParams.get('engine')||(u.searchParams.get('type')==='short'?3:u.searchParams.get('type')==='documentary'?4:0));
 if(site.length<4||site.length>160||![3,4].includes(engine)||state.length>100)return respond(res,400,{ok:false,error:'Valid site and engine 3 or 4 required'});
 if(!KEY)return respond(res,503,{ok:false,error:'YOUTUBE_API_KEY not set on Render'});
 try{return respond(res,200,await audit(site,engine,state))}catch(e){return respond(res,502,{ok:false,error:'YouTube metadata request failed: '+String(e.message||e)})}
});
if(require.main===module)server.listen(PORT,'0.0.0.0',()=>console.log('Orange Line video engine listening',PORT));
module.exports={server,exactName,duration,assess,audit};

'use strict';
/* Orange Line 2, adapting Green Line 1 V74 /audit-video contract.
   YouTube key stays in Render YOUTUBE_API_KEY, NEVER in Blogger. */
const http=require('node:http');
const {URL}=require('node:url');
const PORT=Number(process.env.PORT)||10000;
const KEY=process.env.YOUTUBE_API_KEY||'';
const TTL=15*60*1000,cache=new Map();
const HIST=/\b(history|historic|historical|heritage|archive|archival|documentary|engineering|construction|built|restoration|restored|preservation|rede(dication|dicated)|renovation|renewal|rehabilitation|century|railroad|bridge design|dam construction|canal history|tunnel history|civil engineering|explained|infrastructure|development of|story of)\b/i;
const EDU=/\b(documentary|history|historical|heritage|educational|lecture|presentation|engineering|preservation|rehabilitation|restoration|construction|explained|archival|historian|historical society|history of|story of)\b/i;
const OFF_TOPIC=/\b(gaming|minecraft|roblox|fortnite|music video|lyrics|prank|car accident today)\b/i;
const PASSIVE=/\b(scenic drive|scenic driving|driving tour|drive through|driving through|dashcam|road trip|walking tour|walking across|crossing the|eastbound|westbound|ride along|roadway|traffic|timelapse|hyperlapse|asmr|gopro|4k drive|4k walk|walking downtown|on board|pov driving)\b/i;
function norm(v){return String(v||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[–—_-]/g,' ').replace(/[^a-z0-9 ]+/g,' ').replace(/\s+/g,' ').trim()}
function exactName(text,name){let t=' '+norm(text)+' ',n=' '+norm(name)+' ';return n.trim().length>=5&&t.includes(n)}
function duration(iso){const m=/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(iso||'');return m?86400*(+m[1]||0)+3600*(+m[2]||0)+60*(+m[3]||0)+(+m[4]||0):null}
function stamp(sec){if(!Number.isFinite(sec))return 'unknown';const h=Math.floor(sec/3600),m=Math.floor(sec%3600/60),s=sec%60;return h?`${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`:`${m}:${String(s).padStart(2,'0')}`}
// Aliases are site-specific, never generic words such as "Northampton" or "Free Bridge" alone.
// Each identity alias is a distinct bridge name; do not mix in nearby toll bridges or rail stations.
const SITE_ALIASES={
 'northampton street bridge':[
  'Northampton Street Free Bridge',
  'Northampton Street Toll-Supported Bridge',
  'Easton Phillipsburg Free Bridge',
  'Easton Phillipsburg (Northampton Street) Bridge'
 ]
};
const BANNED_CONFUSIONS={
 'northampton street bridge':/\b(northampton\s+(?:bridge street railway|bridge street station|massachusetts|ma\b|england|town centre)|clement street bridge|bushkill street bridge|easton phillipsburg toll bridge|coplay northampton bridge)\b/i
};
function identity(title,desc,site,state){
 const name=norm(site),aliases=SITE_ALIASES[name]||[];
 const exactTitle=exactName(title,site),exactDesc=exactName(desc,site);
 const aliasTitle=aliases.find(x=>exactName(title,x))||'',aliasDesc=aliases.find(x=>exactName(desc,x))||'';
 const titleIdentity=exactTitle||!!aliasTitle,descIdentity=exactDesc||!!aliasDesc;
 const mismatch=BANNED_CONFUSIONS[name]?.test(title)||false;
 // Description-only hits must also identify a place in the video title.
 // General state terms in descriptions are not enough to rescue an unrelated video.
 const localWords=name==='northampton street bridge'?/\b(easton|phillipsburg|delaware river|free bridge)\b/i:null;
 const geoInTitle=localWords?localWords.test(title):(state?norm(title).includes(norm(state)):false);
 const strong=!!titleIdentity|| (!!descIdentity&&geoInTitle);
 return {strong:strong&&!mismatch,exactTitle,exactDesc,aliasTitle,aliasDesc,geoInTitle,mismatch};
}
function assess(v,site,engine,state=''){
 const title=String(v.snippet?.title||''),desc=String(v.snippet?.description||''),seconds=duration(v.contentDetails?.duration);
 const id=identity(title,desc,site,state),words=title+' '+desc;
 const reasons=[];
 if(id.mismatch)reasons.push('Different bridge or Northampton location');
 else if(!id.strong)reasons.push('Selected landmark identity not established by title or corroborated description');
 if(seconds===null)reasons.push('Duration metadata unavailable');
 else if(engine===3&&(seconds<=0||seconds>=240))reasons.push('Outside short-video duration (under 4 minutes)');
 else if(engine===4&&seconds<1200)reasons.push('Below 20-minute documentary minimum');
 // Historical purpose must appear in the video TITLE. Descriptions can be noisy SEO tags.
 const educationalTitle=HIST.test(title)||EDU.test(title);
 const passiveTitle=PASSIVE.test(title);
 if(passiveTitle)reasons.push('Passive drive/walk/traffic footage is not a historical educational presentation');
 if(!educationalTitle)reasons.push('Title lacks a historical or engineering educational purpose');
 if(engine===4&&!EDU.test(title))reasons.push('No documentary/educational purpose established in title');
 if(OFF_TOPIC.test(title))reasons.push('Off-topic video title');
 if(v.status?.privacyStatus && v.status.privacyStatus!=='public')reasons.push('Video is not public');
 const qualified=reasons.length===0;
 return {id:v.id,title,url:'https://www.youtube.com/watch?v='+encodeURIComponent(v.id),channel:String(v.snippet?.channelTitle||''),durationSeconds:seconds,durationLabel:stamp(seconds),views:Number(v.statistics?.viewCount||0),publishedAt:v.snippet?.publishedAt||'',qualified,rejectionReasons:reasons,evidence:{status:qualified?'Identity + educational metadata candidate — historical content not authenticated':'Rejected metadata candidate',nameInTitle:id.exactTitle,nameInDescription:id.exactDesc,aliasMatched:id.aliasTitle||id.aliasDesc||null,identityStrength:id.strong?'corroborated':'unproven',educationalTitle,passiveTitle}};
}
async function api(path,params){const u=new URL('https://www.googleapis.com/youtube/v3/'+path);Object.entries({...params,key:KEY}).forEach(([k,v])=>u.searchParams.set(k,String(v)));const ctrl=new AbortController(),timeout=setTimeout(()=>ctrl.abort(),17000);try{const r=await fetch(u,{signal:ctrl.signal});const d=await r.json();if(!r.ok)throw Error(d?.error?.message||'YouTube API HTTP '+r.status);return d}finally{clearTimeout(timeout)}}
async function audit(site,engine,state=''){
 const key=[norm(site),engine,norm(state)].join('|'),prev=cache.get(key);if(prev&&prev.expires>Date.now())return {...prev.data,cached:true};
 // Name-only YouTube query exactly as requested; state is used for identity corroboration only.
 const result=await api('search',{part:'snippet',q:site,type:'video',videoDuration:engine===3?'short':'long',maxResults:40,safeSearch:'moderate'});
 const ids=[...new Set((result.items||[]).map(x=>x.id?.videoId).filter(Boolean))];
 const details=ids.length?await api('videos',{part:'snippet,contentDetails,statistics,status',id:ids.join(',')}):{items:[]};
 const videos=(details.items||[]).map(x=>assess(x,site,engine,state));
 const data={ok:true,engine,site,state,videos,checked:ids.length,accepted:videos.filter(x=>x.qualified).length,rejected:videos.filter(x=>!x.qualified).length,complete:false,verifiedScope:'YouTube API metadata screening; source-content verification pending',auditVersion:'green-v74-orange-strict-identity-education-v2',automaticHistoricalGrades:false};
 cache.set(key,{expires:Date.now()+TTL,data});if(cache.size>300)cache.delete(cache.keys().next().value);return data;
}
function respond(res,code,body){res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body))}
const server=http.createServer(async(req,res)=>{if(req.method==='OPTIONS')return respond(res,204,{});if(req.method!=='GET')return respond(res,405,{ok:false,error:'Only GET supported'});
 let u;try{u=new URL(req.url,'http://localhost')}catch(_){return respond(res,400,{ok:false,error:'Invalid URL'})}
 if(u.pathname==='/health')return respond(res,200,{ok:true,hasKey:!!KEY,service:'orange-line-video-engine',auditVersion:'green-v74-orange-strict-identity-education-v2',relevanceVersion:'strict-landmark-identity-educational-relevance-v2',independentEngines:[3,4],automaticHistoricalGrades:false});
 if(u.pathname!=='/audit-video'&&u.pathname!=='/audit')return respond(res,404,{ok:false,error:'Use /audit-video?site=...&state=...&engine=3|4'});
 const site=(u.searchParams.get('site')||u.searchParams.get('name')||'').trim(),state=(u.searchParams.get('state')||'').trim();
 const engine=Number(u.searchParams.get('engine')||(u.searchParams.get('type')==='short'?3:u.searchParams.get('type')==='documentary'?4:0));
 if(site.length<4||site.length>160||![3,4].includes(engine)||state.length>100)return respond(res,400,{ok:false,error:'Valid site and engine 3 or 4 required'});
 if(!KEY)return respond(res,503,{ok:false,error:'YOUTUBE_API_KEY not set on Render'});
 try{return respond(res,200,await audit(site,engine,state))}catch(e){return respond(res,502,{ok:false,error:'YouTube metadata request failed: '+String(e.message||e)})}
});
if(require.main===module)server.listen(PORT,'0.0.0.0',()=>console.log('Orange Line video engine listening',PORT));
module.exports={server,exactName,duration,assess,audit};

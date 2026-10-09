import {db,identity,loadRoom,view,RoomError,type State} from '@/lib/room-store';
import {timeControls} from '@/lib/chess-rules';
type Queue={session:string;ticket:string;name:string;variant:'standard'|'atomic';control:string;room:string|null;expires_at:number};
const headers={'Cache-Control':'no-store, private','Vary':'Cookie'};
const ttl=25000;
const code=()=>Array.from(crypto.getRandomValues(new Uint8Array(8)),n=>'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[n%32]).join('');
export async function POST(req:Request){try{
 const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)throw new RoomError('허용되지 않은 요청입니다.',403);
 const text=await req.text();if(text.length>2048)throw new RoomError('요청이 너무 큽니다.',413);
 let b:Record<string,unknown>;try{b=JSON.parse(text)}catch{throw new RoomError('요청 형식을 확인해 주세요.');}
 if(!b||typeof b!=='object'||!['start','poll','cancel'].includes(String(b.action)))throw new RoomError('지원하지 않는 요청입니다.');
 if(typeof b.ticket!=='string'||!/^[a-f0-9-]{36}$/.test(b.ticket))throw new RoomError('대기 정보를 확인해 주세요.');
 const name=typeof b.name==='string'?b.name.trim().replace(/[\u0000-\u001f\u007f]/g,''):'';
 if(b.action==='start'&&(!name||name.length>20))throw new RoomError('닉네임은 1~20자로 입력해 주세요.');
 const {session,cookie}=await identity(req,b.action==='start'?name:undefined);if(!session)throw new RoomError('다시 상대 찾기를 시작해 주세요.',401);
 const responseHeaders:Record<string,string>={...headers};if(cookie)responseHeaders['Set-Cookie']=cookie;
 const now=Date.now(), ticket=b.ticket, id=session.id;
 const response=(status:string,room?:unknown)=>Response.json({status,ticket,...(room?{room}:{})},{headers:responseHeaders});
 const own=()=>db().prepare('SELECT * FROM match_queue WHERE session=? AND ticket=?').bind(id,ticket).first<Queue>();
 if(b.action==='cancel'){
  // Both operations run as a single transaction. A simultaneous match is either
  // prevented, or its still-unplayed room is cancelled for both players.
  await db().batch([
   db().prepare(`UPDATE rooms SET state=json_set(state,'$.result',json(?),'$.lastAt',NULL,'$.drawOffer',NULL),version=version+1,updated_at=?
    WHERE code=(SELECT room FROM match_queue WHERE session=? AND ticket=?) AND json_array_length(state,'$.moves')=0 AND json_extract(state,'$.result') IS NULL`).bind(JSON.stringify({winner:null,reason:'대국 시작 전 취소'}),now,id,ticket),
   db().prepare(`DELETE FROM match_queue WHERE session=? AND ticket=? AND (room IS NULL OR EXISTS(SELECT 1 FROM rooms WHERE code=match_queue.room AND json_extract(state,'$.result') IS NOT NULL))`).bind(id,ticket)
  ]);
  const remaining=await own();return remaining?.room?response('matched',await view(await loadRoom(remaining.room),id)):response('cancelled');
 }
 if(b.action==='start'){
  const variant=b.variant==='atomic'?'atomic':'standard',control=typeof b.control==='string'&&timeControls[b.control]?b.control:'10+0';
  await db().prepare(`INSERT INTO match_queue(session,ticket,name,variant,control,room,expires_at,created_at) VALUES(?,?,?,?,?,NULL,?,?)
   ON CONFLICT(session) DO UPDATE SET ticket=excluded.ticket,name=excluded.name,variant=excluded.variant,control=excluded.control,room=NULL,expires_at=excluded.expires_at,created_at=excluded.created_at
   WHERE (match_queue.room IS NULL AND (match_queue.ticket=excluded.ticket OR match_queue.expires_at<=?))
    OR EXISTS(SELECT 1 FROM rooms WHERE code=match_queue.room AND json_extract(state,'$.result') IS NOT NULL)`)
   .bind(id,ticket,name,variant,control,now+ttl,now,now).run();
  if(!await own())throw new RoomError('다른 탭에서 상대를 찾거나 대국 중입니다. 그 화면에서 대기를 취소하거나 대국을 마쳐 주세요.',409);
 }else{
  // An expired ticket cannot be revived by a delayed heartbeat.
  await db().prepare('UPDATE match_queue SET expires_at=? WHERE session=? AND ticket=? AND room IS NULL AND expires_at>?').bind(now+ttl,id,ticket,now).run();
 }
 let me=await own();if(!me)return response('expired');
 if(me.room)return response('matched',await view(await loadRoom(me.room),id));
 if(me.expires_at<=now)return response('expired');
 for(let attempt=0;attempt<3;attempt++){
  const opponent=await db().prepare('SELECT * FROM match_queue WHERE variant=? AND control=? AND room IS NULL AND expires_at>? AND session<>? ORDER BY RANDOM() LIMIT 1').bind(me.variant,me.control,now,id).first<Queue>();
  if(!opponent)break;
  const room=code(), swap=crypto.getRandomValues(new Uint8Array(1))[0]%2===0;
  const [white,black]=swap?[me,opponent]:[opponent,me],ms=timeControls[me.control].minutes*60000;
  const state:State={mode:'random',variant:me.variant,white:{id:white.session,name:white.name},black:{id:black.session,name:black.name},control:me.control,moves:[],whiteMs:ms,blackMs:ms,lastAt:me.control==='unlimited'?null:now,result:null,drawOffer:null,rematchOffer:null,round:1};
  const paired=await db().batch([
   db().prepare(`INSERT INTO rooms(code,state,version,created_at,updated_at) SELECT ?,?,0,?,?
    WHERE EXISTS(SELECT 1 FROM match_queue WHERE session=? AND ticket=? AND room IS NULL AND expires_at>?)
    AND EXISTS(SELECT 1 FROM match_queue WHERE session=? AND ticket=? AND variant=? AND control=? AND room IS NULL AND expires_at>?)`)
    .bind(room,JSON.stringify(state),now,now,id,ticket,now,opponent.session,opponent.ticket,me.variant,me.control,now),
   db().prepare('UPDATE match_queue SET room=? WHERE session IN (?,?) AND EXISTS(SELECT 1 FROM rooms WHERE code=?)').bind(room,id,opponent.session,room),
   db().prepare('INSERT INTO members(room,session) SELECT ?,? WHERE EXISTS(SELECT 1 FROM rooms WHERE code=?)').bind(room,id,room),
   db().prepare('INSERT INTO members(room,session) SELECT ?,? WHERE EXISTS(SELECT 1 FROM rooms WHERE code=?)').bind(room,opponent.session,room)
  ]);
  me=(await own())!;
  if(me?.room)return response('matched',await view(await loadRoom(me.room),id));
  if(!me)return response('cancelled');
  if(paired[0].meta.changes)break;
 }
 return response('waiting');
}catch(e){if(e instanceof RoomError)return Response.json({error:e.message},{status:e.status,headers});console.error('matchmaking error',e);return Response.json({error:'상대 찾기에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.'},{status:503,headers});}}

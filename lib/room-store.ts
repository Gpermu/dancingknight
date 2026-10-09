import { env } from 'cloudflare:workers';
import type { GameState, RoomView } from './room-types';
import { replay,flagResult,positionView } from './game-engine';
export const db=()=>{if(!env.DB)throw new Error('DB unavailable');return env.DB};
export class RoomError extends Error {constructor(public message:string,public status=400){super(message)}}
export type RoomRecord={code:string;state:string;version:number};
export type State=GameState&{rematchOffer:'w'|'b'|null};
export function readCookie(req:Request){return req.headers.get('cookie')?.match(/(?:^|;\s*)knight_session=([a-f0-9]{64})(?:;|$)/)?.[1]||null}
export async function identity(req:Request,name?:string){
 let token=readCookie(req);let session=token?await db().prepare('SELECT id,name FROM sessions WHERE id=?').bind(token).first<{id:string;name:string}>():null;
 let cookie:string|undefined;
 if(!session&&name){token=Array.from(crypto.getRandomValues(new Uint8Array(32)),v=>v.toString(16).padStart(2,'0')).join('');session={id:token,name};await db().prepare('INSERT INTO sessions(id,name,created_at) VALUES(?,?,?)').bind(token,name,Date.now()).run();cookie=`knight_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=31536000${new URL(req.url).protocol==='https:'?'; Secure':''}`;}
 else if(session&&name&&name!==session.name){await db().prepare('UPDATE sessions SET name=? WHERE id=?').bind(name,session.id).run();session.name=name;}
 return {session,cookie};
}
export async function loadRoom(code:string){const row=await db().prepare('SELECT code,state,version FROM rooms WHERE code=?').bind(code).first<RoomRecord>();if(!row)throw new RoomError('해당 방을 찾지 못했습니다. 초대 코드를 확인해 주세요.',404);return row;}
export async function saveRoom(row:RoomRecord,s:State,now:number){const r=await db().prepare('UPDATE rooms SET state=?, version=version+1, updated_at=? WHERE code=? AND version=?').bind(JSON.stringify(s),now,row.code,row.version).run();if(r.meta.changes!==1)throw new RoomError('대국 상태가 바뀌었습니다. 최신 상태에서 다시 시도해 주세요.',409);row.state=JSON.stringify(s);row.version++;}
export function roleFor(s:State,id?:string|null):RoomView['role']{if(!id)return 'guest';if(s.mode==='local'&&s.white.id===id)return 'both';return s.white.id===id?'w':s.black?.id===id?'b':'spectator';}
export function tick(s:State,now:number){
 if(s.result||s.lastAt===null||s.control==='unlimited'||!s.black)return false;
 const c=replay(s.moves,s.variant), side=c.turn(), key=side==='w'?'whiteMs':'blackMs';
 s[key]=Math.max(0,s[key]-Math.max(0,now-s.lastAt));s.lastAt=now;
 if(s[key]===0){s.result=flagResult(c,side);s.drawOffer=null;return true;}return false;
}
export async function view(row:RoomRecord,id?:string|null):Promise<RoomView>{
 let s=JSON.parse(row.state) as State;const now=Date.now();
 if(tick(s,now)){try{await saveRoom(row,s,now)}catch(e){if(!(e instanceof RoomError)||e.status!==409)throw e;row=await loadRoom(row.code);s=JSON.parse(row.state);tick(s,now);}}
 const role=roleFor(s,id);const member=id?await db().prepare('SELECT 1 AS yes FROM members WHERE room=? AND session=?').bind(row.code,id).first():null;
 const chat=member?await db().prepare('SELECT id,session,name,body,created_at FROM messages WHERE room=? ORDER BY created_at DESC,id DESC LIMIT 120').bind(row.code).all<{id:string;session:string;name:string;body:string;created_at:number}>():{results:[]};
 return {code:row.code,version:row.version,mode:s.mode,variant:s.variant||'standard',position:positionView(replay(s.moves,s.variant)),white:s.white.name,black:s.black?.name||null,control:s.control,moves:s.moves,whiteMs:s.whiteMs,blackMs:s.blackMs,lastAt:s.lastAt,result:s.result,drawOffer:s.drawOffer,rematchOffer:s.rematchOffer||null,round:s.round,role:member?role:'guest',serverNow:now,messages:chat.results.reverse().map(m=>({id:m.id,name:m.name,body:m.body,createdAt:m.created_at,mine:m.session===id}))};
}

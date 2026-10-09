import {timeControls} from '@/lib/chess-rules';
import {automaticResult,claimReason,replay,resignResult,legalMoves} from '@/lib/game-engine';
import {db,identity,loadRoom,saveRoom,roleFor,tick,view,RoomError,type State} from '@/lib/room-store';
const headers={'Cache-Control':'no-store, private','Vary':'Cookie'};
function fail(e:unknown){if(e instanceof RoomError)return Response.json({error:e.message},{status:e.status,headers});console.error('chess room error',e);return Response.json({error:'연결이 원활하지 않습니다. 입력한 내용은 유지됩니다. 잠시 뒤 다시 시도해 주세요.'},{status:503,headers});}
function codeOf(input:unknown){const c=typeof input==='string'?input.trim().toUpperCase():'';if(!/^[A-Z2-9]{8}$/.test(c))throw new RoomError('초대 코드 8자리를 입력해 주세요.');return c;}
function nameOf(input:unknown){if(typeof input!=='string'||!input.trim()||input.trim().length>20)throw new RoomError('이름은 1~20자로 입력해 주세요.');return input.trim().replace(/[\u0000-\u001f\u007f]/g,'');}
export async function GET(req:Request){try{const code=codeOf(new URL(req.url).searchParams.get('code'));const {session}=await identity(req);return Response.json(await view(await loadRoom(code),session?.id),{headers});}catch(e){return fail(e)}}
export async function POST(req:Request){try{
 const origin=req.headers.get('origin');if(origin&&origin!==new URL(req.url).origin)throw new RoomError('허용되지 않은 요청입니다.',403);
 if(Number(req.headers.get('content-length')||0)>8192)throw new RoomError('요청이 너무 큽니다.',413);
 const text=await req.text();if(text.length>8192)throw new RoomError('요청이 너무 큽니다.',413);
 let b:Record<string,unknown>;try{b=JSON.parse(text)}catch{throw new RoomError('요청 형식을 확인해 주세요.');}
 if(!b||typeof b!=='object')throw new RoomError('요청 형식을 확인해 주세요.');
 const action=b.action;const naming=action==='create'||action==='join';
 const local=action==='create'&&b.mode==='local';
 const {session,cookie}=await identity(req,local?'플레이어':naming?nameOf(b.name):undefined);if(!session)throw new RoomError('이름을 입력하고 방에 입장해 주세요.',401);
 const responseHeaders:Record<string,string>={...headers};if(cookie)responseHeaders['Set-Cookie']=cookie;
 const now=Date.now();
 if(action==='create'){
  const mode=b.mode==='local'?'local':'online',variant=b.variant==='atomic'?'atomic':'standard',control=typeof b.control==='string'&&timeControls[b.control]?b.control:'10+0';
  const charset='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';const code=Array.from(crypto.getRandomValues(new Uint8Array(8)),n=>charset[n%32]).join('');
  const recent=await db().prepare('SELECT COUNT(*) AS count FROM rooms r JOIN members m ON m.room=r.code WHERE m.session=? AND r.created_at>?').bind(session.id,now-60000).first<{count:number}>();if((recent?.count||0)>=10)throw new RoomError('방을 너무 빠르게 만들고 있습니다. 잠시 후 다시 시도해 주세요.',429);
  const ms=timeControls[control].minutes*60000;
  const state:State={mode,variant,white:{id:session.id,name:mode==='local'?'백 플레이어':session.name},black:mode==='local'?{id:session.id,name:'흑 플레이어'}:null,control,moves:[],whiteMs:ms,blackMs:ms,lastAt:mode==='local'&&control!=='unlimited'?now:null,result:null,drawOffer:null,rematchOffer:null,round:1};
  await db().batch([db().prepare('INSERT INTO rooms(code,state,version,created_at,updated_at) VALUES(?,?,0,?,?)').bind(code,JSON.stringify(state),now,now),db().prepare('INSERT INTO members(room,session) VALUES(?,?)').bind(code,session.id)]);
  return Response.json(await view({code,state:JSON.stringify(state),version:0},session.id),{status:201,headers:responseHeaders});
 }
 const code=codeOf(b.code);let row=await loadRoom(code);let s=JSON.parse(row.state) as State;
 if(action==='join'){
  if(s.mode==='online'&&!s.black&&s.white.id!==session.id&&!s.result){s.black={id:session.id,name:session.name};s.lastAt=s.control==='unlimited'?null:now;await saveRoom(row,s,now);}
  await db().prepare('INSERT OR IGNORE INTO members(room,session) VALUES(?,?)').bind(code,session.id).run();
  return Response.json(await view(row,session.id),{headers:responseHeaders});
 }
 const member=await db().prepare('SELECT 1 AS yes FROM members WHERE room=? AND session=?').bind(code,session.id).first();if(!member)throw new RoomError('먼저 방에 입장해 주세요.',403);
 if(action==='chat'){
  const body=typeof b.message==='string'?b.message.trim():'';if(!body||body.length>500)throw new RoomError('메시지는 1~500자로 입력해 주세요.');
  const id=typeof b.messageId==='string'&&/^[a-f0-9-]{36}$/.test(b.messageId)?b.messageId:crypto.randomUUID();
  const already=await db().prepare('SELECT id FROM messages WHERE id=? AND room=? AND session=?').bind(id,code,session.id).first();
  if(!already){const last=await db().prepare('SELECT created_at FROM messages WHERE room=? AND session=? ORDER BY created_at DESC LIMIT 1').bind(code,session.id).first<{created_at:number}>();if(last&&now-last.created_at<600)throw new RoomError('메시지를 너무 빠르게 보내고 있습니다.',429);await db().prepare('INSERT INTO messages(id,room,session,name,body,created_at) VALUES(?,?,?,?,?,?)').bind(id,code,session.id,session.name,body,now).run();}
  return Response.json(await view(row,session.id),{headers:responseHeaders});
 }
 const role=roleFor(s,session.id);
 if(action==='leave'){
  if(role==='spectator'||s.result)return Response.json(await view(row,session.id),{headers:responseHeaders});
  if(s.moves.length)throw new RoomError('진행 중인 대국은 종료하거나 기권한 뒤 모드를 바꿀 수 있습니다.');
  if(b.version!==row.version)throw new RoomError('대국 상태가 바뀌었습니다. 다시 확인해 주세요.',409);
  s.result={winner:null,reason:'대국 시작 전 취소'};s.lastAt=null;s.drawOffer=null;await saveRoom(row,s,now);
  return Response.json(await view(row,session.id),{headers:responseHeaders});
 }
 if(role==='guest'||role==='spectator')throw new RoomError('관전 중에는 기물을 움직일 수 없습니다.',403);
 if(typeof b.version!=='number'||b.version!==row.version)throw new RoomError('대국 상태가 바뀌었습니다. 최신 상태에서 다시 시도해 주세요.',409);
 if(tick(s,now)){await saveRoom(row,s,now);return Response.json(await view(row,session.id),{headers:responseHeaders});}
 const c=replay(s.moves,s.variant);const side=role==='both'?c.turn():role;
 if(action==='rematch'){
  if(!s.result)throw new RoomError('현재 대국이 끝난 후 새 대국을 시작할 수 있습니다.');
  if(role==='both'||(s.rematchOffer&&s.rematchOffer!==side)){
   if(s.mode!=='local'&&s.black){const white=s.white;s.white=s.black;s.black=white;}
   const ms=timeControls[s.control].minutes*60000;s.moves=[];s.whiteMs=ms;s.blackMs=ms;s.lastAt=s.control==='unlimited'?null:now;s.result=null;s.drawOffer=null;s.rematchOffer=null;s.round++;
  }else s.rematchOffer=side;
 }else{
  if(s.result)throw new RoomError('이미 종료된 대국입니다.');
  if(!s.black)throw new RoomError('상대방이 입장하면 대국이 시작됩니다.');
  if(action==='move'){
   if(side!==c.turn())throw new RoomError('지금은 상대방의 차례입니다.',403);
   if(typeof b.from!=='string'||typeof b.to!=='string'||! /^[a-h][1-8]$/.test(b.from)||! /^[a-h][1-8]$/.test(b.to))throw new RoomError('올바른 칸을 선택해 주세요.');
   const promotion=typeof b.promotion==='string'&&/^[qrbn]$/.test(b.promotion)?b.promotion:undefined;
   const legal=legalMoves(c).filter(m=>m.from===b.from&&m.to===b.to);if(!legal.length)throw new RoomError('체스 규칙상 이동할 수 없는 수입니다.');if(legal.some(m=>m.promotion)&&!promotion)throw new RoomError('승격할 기물을 선택해 주세요.');
   const beforeClaim=claimReason(c);let move;try{move=c.move({from:b.from,to:b.to,...(promotion?{promotion}:{})})}catch{throw new RoomError('체스 규칙상 이동할 수 없는 수입니다.');}
   if(b.claim===true){const why=beforeClaim||claimReason(c);if(!why)throw new RoomError('이 수로는 3회 반복 또는 50수 규칙이 성립하지 않습니다.');s.result={winner:null,reason:why+' · 예정 수 청구'};}
   else{s.moves.push(move.san);s.result=automaticResult(c);if(s.control!=='unlimited'){if(side==='w')s.whiteMs+=timeControls[s.control].increment*1000;else s.blackMs+=timeControls[s.control].increment*1000;s.lastAt=now;}}
   if(s.drawOffer&&s.drawOffer!==side)s.drawOffer=null;
  }else if(action==='claim'){
   if(side!==c.turn())throw new RoomError('본인 차례에 무승부를 청구할 수 있습니다.');const why=claimReason(c);if(!why)throw new RoomError('아직 3회 반복 또는 50수 규칙이 성립하지 않았습니다.');s.result={winner:null,reason:why};
  }else if(action==='resign'){s.result=resignResult(c,side);
  }else if(action==='offer'){
   if(s.moves.length<2)throw new RoomError('양쪽이 한 수씩 둔 뒤 무승부를 제안할 수 있습니다.');if(s.drawOffer)throw new RoomError('이미 무승부 제안이 있습니다.');s.drawOffer=side;
  }else if(action==='accept'){
   if(!s.drawOffer||(role!=='both'&&s.drawOffer===side))throw new RoomError('수락할 상대방의 무승부 제안이 없습니다.');s.result={winner:null,reason:'합의 무승부'};
  }else if(action==='decline'){
   if(!s.drawOffer||(role!=='both'&&s.drawOffer===side))throw new RoomError('거절할 상대방의 무승부 제안이 없습니다.');s.drawOffer=null;
  }else throw new RoomError('지원하지 않는 요청입니다.');
 }
 if(s.result){s.drawOffer=null;s.lastAt=null;}
 await saveRoom(row,s,now);return Response.json(await view(row,session.id),{headers:responseHeaders});
 }catch(e){return fail(e)}}

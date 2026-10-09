'use client';
import {useEffect,useRef,useState} from 'react';
import type {MatchView,RoomView,Variant} from '@/lib/room-types';
export function useMatchmaking(onMatched:(r:RoomView)=>void,onError:(text:string)=>void){
 const [ticket,setTicket]=useState<string|null>(null),[busy,setBusy]=useState(false);
 const [settings,setSettings]=useState<{variant:Variant;control:string}>({variant:'standard',control:'10+0'});
 const current=useRef<string|null>(null),cancelling=useRef(false),starting=useRef(false),callbacks=useRef({onMatched,onError});callbacks.current={onMatched,onError};
 function save(value:string|null){current.current=value;setTicket(value);try{if(value)sessionStorage.setItem('knight-match-ticket',value);else sessionStorage.removeItem('knight-match-ticket')}catch{}}
 async function call(action:string,id:string,extra:Record<string,unknown>={}){const r=await fetch('/api/match',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,ticket:id,...extra})});const d=await r.json() as MatchView&{error?:string};if(!r.ok)throw new Error(d.error||'상대 찾기에 연결하지 못했습니다.');return d;}
 function handle(d:MatchView,id:string){if(current.current!==id||cancelling.current)return;if(d.status==='matched'&&d.room){save(null);callbacks.current.onMatched(d.room)}else if(d.status==='expired'||d.status==='cancelled'){save(null);callbacks.current.onError(d.status==='expired'?'대기가 만료되었습니다. 상대 찾기를 다시 시작해 주세요.':'상대 찾기를 취소했습니다.')}}
 useEffect(()=>{try{const stored=sessionStorage.getItem('knight-match-ticket');const details=sessionStorage.getItem('knight-match-settings');if(stored){if(details)setSettings(JSON.parse(details));save(stored)}}catch{}},[]);
 useEffect(()=>{
  if(!ticket)return;let stopped=false,timer:ReturnType<typeof setTimeout>;
  const poll=async()=>{try{if(!document.hidden&&!starting.current&&!cancelling.current){const d=await call('poll',ticket);if(!stopped)handle(d,ticket)}}catch(e){if(!stopped)callbacks.current.onError((e as Error).message)}finally{if(!stopped)timer=setTimeout(poll,2000)}};
  timer=setTimeout(poll,2000);
  const visibility=()=>{if(!document.hidden){clearTimeout(timer);void poll()}};
  const leave=()=>{if(current.current===ticket)navigator.sendBeacon('/api/match',new Blob([JSON.stringify({action:'cancel',ticket})],{type:'application/json'}));};
  document.addEventListener('visibilitychange',visibility);window.addEventListener('pagehide',leave);
  return()=>{stopped=true;clearTimeout(timer);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pagehide',leave)};
 },[ticket]);
 async function start(name:string,variant:Variant,control:string){if(current.current||busy)return;const id=crypto.randomUUID();starting.current=true;setSettings({variant,control});try{sessionStorage.setItem('knight-match-settings',JSON.stringify({variant,control}));localStorage.setItem('knight-name',name.trim())}catch{}save(id);setBusy(true);try{handle(await call('start',id,{name,variant,control}),id)}catch(e){callbacks.current.onError((e as Error).message);/* Keep the ticket: the request might have reached the server. */}finally{starting.current=false;setBusy(false)}}
 async function cancel(){const id=current.current;if(!id)return true;cancelling.current=true;setBusy(true);try{const d=await call('cancel',id);save(null);if(d.status==='matched'&&d.room){callbacks.current.onMatched(d.room);callbacks.current.onError('상대방이 이미 첫 수를 두었습니다. 대국을 마치거나 기권한 뒤 모드를 바꿔 주세요.');return false}return true}catch(e){callbacks.current.onError((e as Error).message);return false}finally{cancelling.current=false;setBusy(false)}}
 return {waiting:!!ticket,busy,start,cancel,settings};
}

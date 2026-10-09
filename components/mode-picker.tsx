'use client';
import {useEffect,useState} from 'react';
import {Users,Monitor,Shuffle,Flame,ShieldCheck} from 'lucide-react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import type {PlayMode,Variant} from '@/lib/room-types';
export const modeLabels:Record<PlayMode,string>={online:'온라인',local:'같은 기기',random:'무작위 상대 찾기'};
export const variantLabels:Record<Variant,string>={standard:'스탠다드',atomic:'아토믹'};
export function ModePicker({open,onOpenChange,onSelect,busy,error}:{open:boolean;onOpenChange:(v:boolean)=>void;onSelect:(m:PlayMode,v:Variant)=>Promise<void>;busy:boolean;error:string}){
 const [picked,setPicked]=useState<PlayMode|null>(null);
 useEffect(()=>{if(open)setPicked(null)},[open]);
 return <Dialog open={open} onOpenChange={v=>{if(!busy)onOpenChange(v)}}><DialogContent className="mode-dialog"><DialogTitle>{picked?`${modeLabels[picked]} · 규칙 선택`:'어떻게 플레이할까요?'}</DialogTitle><DialogDescription>{picked?'플레이할 체스 규칙을 선택해 주세요.':'대국 시작 전이나 종료 후에 모드를 바꿀 수 있습니다.'}</DialogDescription>
 <div className="mode-choices">{!picked?<>
  <button className="mode-choice" onClick={()=>setPicked('online')}><Users/><span><strong>온라인</strong><small>방을 만들고 초대 코드로 함께 플레이</small></span></button>
  <button className="mode-choice" onClick={()=>setPicked('local')}><Monitor/><span><strong>같은 기기</strong><small>닉네임 없이 한 화면에서 번갈아 플레이</small></span></button>
  <button className="mode-choice" onClick={()=>setPicked('random')}><Shuffle/><span><strong>무작위 상대 찾기</strong><small>같은 규칙과 시간을 고른 상대와 자동 연결</small></span></button>
 </>:<>
  <button className="mode-choice" disabled={busy} onClick={()=>void onSelect(picked,'standard')}><ShieldCheck/><span><strong>스탠다드</strong><small>캐슬링·앙파상·승격을 포함한 정통 체스</small></span></button>
  <button className="mode-choice atomic-choice" disabled={busy} onClick={()=>void onSelect(picked,'atomic')}><Flame/><span><strong>아토믹</strong><small>기물을 잡으면 주변이 폭발합니다. 상대 킹을 폭발시키거나 체크메이트하세요.</small></span></button>
  <button className="text-button" disabled={busy} onClick={()=>setPicked(null)}>다른 모드 선택</button>
 </>}</div>{busy&&<p role="status" className="muted-note">모드를 전환하고 있습니다…</p>}{error&&<p role="alert" className="danger-action">{error}</p>}
 </DialogContent></Dialog>;
}

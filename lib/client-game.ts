import {Chess,type Square} from 'chess.js';
import type {RoomView,MoveView} from './room-types';
// Rendering/review only. All legal moves and variant checks come from the server.
export function displayGame(room:RoomView|null,ply?:number|null){
 const all=room?.position?.history||[];
 const count=ply??all.length, history=all.slice(0,count);
 const fen=ply===null||ply===undefined?room?.position?.fen:history.at(-1)?.after||all[0]?.before;
 const board=new Chess(fen,{skipValidation:true});
 return {fen:()=>fen||board.fen(),turn:()=>board.turn(),get:(s:Square)=>board.get(s),board:()=>board.board(),
  isCheck:()=>ply===undefined||ply===null?!!room?.position?.check:!!history.at(-1)?.check,
  history:(_options?:{verbose?:boolean})=>history,
  moves:(options?:{square?:string;verbose?:boolean}):MoveView[]=>(room?.position?.legalMoves||[]).filter(m=>!options?.square||m.from===options.square)};
}

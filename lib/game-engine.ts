// Server-only: variant legality is authoritative and never evaluated by the browser.
import {Chess,type Color,type PieceSymbol,type Move} from 'chess.js';
import {Atomic} from 'chessops/variant';
import {makeFen,parseFen} from 'chessops/fen';
import {makeSan,parseSan} from 'chessops/san';
import {makeSquare} from 'chessops/util';
import type {NormalMove,Role} from 'chessops/types';
import * as standard from './chess-rules';
import type {Variant,MoveView,PositionView} from './room-types';
const symbols:Record<Role,PieceSymbol>={king:'k',queen:'q',rook:'r',bishop:'b',knight:'n',pawn:'p'};
const color=(c:string):Color=>c==='white'?'w':'b';
export class AtomicGame {
 position:Atomic;
 private played:MoveView[]=[];
 constructor(fen?:string){this.position=fen?Atomic.fromSetup(parseFen(fen).unwrap()).unwrap():Atomic.default();}
 fen(){return makeFen(this.position.toSetup());}
 turn(){return color(this.position.turn);}
 isCheck(){return this.position.isCheck();}
 history(_options?:{verbose?:boolean}){return this.played;}
 private describe(raw:NormalMove):MoveView{
  const p=this.position, piece=p.board.get(raw.from)!;
  const castle=piece.role==='king'&&p.board.get(raw.to)?.color===p.turn;
  const to=castle?(raw.to>raw.from?raw.from+2:raw.from-2):raw.to;
  const captured=castle?undefined:p.board.get(raw.to)?.role||(piece.role==='pawn'&&raw.to===p.epSquare?'pawn':undefined);
  return {from:makeSquare(raw.from),to:makeSquare(to),color:this.turn(),piece:symbols[piece.role],san:makeSan(p,raw),promotion:raw.promotion?symbols[raw.promotion]:undefined,captured:captured?symbols[captured]:undefined,before:this.fen(),after:'',check:false};
 }
 private candidates(square?:string){
  if(this.position.isEnd())return [];
  const choices:{raw:NormalMove;view:MoveView}[]=[];
  for(const [from,dests] of this.position.allDests()){
   if(square&&makeSquare(from)!==square)continue;
   for(const to of dests){
    const promotion=this.position.board.get(from)?.role==='pawn'&&(to<8||to>=56);
    for(const role of promotion?['queen','rook','bishop','knight'] as Role[]:[undefined]){
     const raw:NormalMove={from,to,...(role?{promotion:role}:{})};
     if(this.position.isLegal(raw))choices.push({raw,view:this.describe(raw)});
    }
   }
  }
  return choices;
 }
 moves(options?:{square?:string;verbose?:boolean}){return this.candidates(options?.square).map(x=>x.view);}
 move(input:string|{from:string;to:string;promotion?:string}){
  let raw:NormalMove|undefined;
  if(typeof input==='string'){
   const parsed=parseSan(this.position,input);if(parsed&&'from' in parsed)raw=parsed;
  }else{
   const candidate=this.candidates(input.from).find(x=>x.view.to===input.to&&x.view.promotion===(input.promotion||undefined));raw=candidate?.raw;
  }
  if(!raw||!this.position.isLegal(raw))throw new Error('Illegal atomic move');
  const view=this.describe(raw);this.position.play(raw);view.after=this.fen();view.check=this.isCheck();this.played.push(view);return view;
 }
 repetitions(){const key=(fen:string)=>fen.split(' ').slice(0,4).join(' ');const current=key(this.fen());return [this.played[0]?.before||this.fen(),...this.played.map(m=>m.after)].filter(f=>key(f)===current).length;}
}
export type Engine=Chess|AtomicGame;
export function legalMoves(c:Engine){return c instanceof Chess?c.moves({verbose:true}):c.moves();}
export function replay(moves:string[],variant:Variant='standard'):Engine{if(variant!=='atomic')return standard.replay(moves);const c=new AtomicGame();for(const m of moves)c.move(m);return c;}
export function claimReason(c:Engine){if(c instanceof Chess)return standard.claimReason(c);if(c.repetitions()>=3)return '동일 국면 3회 반복';if(c.position.halfmoves>=100)return '50수 규칙';return null;}
export function automaticResult(c:Engine):standard.GameResult|null{
 if(c instanceof Chess)return standard.automaticResult(c);
 const p=c.position, winner=p.variantOutcome()?.winner;
 if(winner)return {winner:color(winner),reason:'상대 킹 폭발'};
 if(p.isCheckmate())return {winner:standard.other(c.turn()),reason:'체크메이트'};
 if(p.isStalemate())return {winner:null,reason:'스테일메이트'};
 if(p.isInsufficientMaterial())return {winner:null,reason:'아토믹 · 체크메이트 불가능'};
 if(c.repetitions()>=5)return {winner:null,reason:'동일 국면 5회 반복'};
 if(p.halfmoves>=150)return {winner:null,reason:'75수 규칙'};
 return null;
}
export function flagResult(c:Engine,loser:Color):standard.GameResult{
 if(c instanceof Chess)return standard.flagResult(c,loser);
 const winner=standard.other(loser);return c.position.hasInsufficientMaterial(winner==='w'?'white':'black')?{winner:null,reason:'시간 초과 · 상대 체크메이트 불가능'}:{winner,reason:'시간 초과'};
}
export function resignResult(c:Engine,loser:Color):standard.GameResult{
 if(c instanceof Chess)return standard.resignResult(c,loser);
 const result=flagResult(c,loser);return {...result,reason:result.reason.replace('시간 초과','기권')};
}
export function positionView(c:Engine):PositionView{
 const simplify=(m:Move|MoveView):MoveView=>{
  return {from:m.from,to:m.to,san:m.san,color:m.color,piece:m.piece,promotion:m.promotion,captured:m.captured,before:m.before,after:m.after,check:'check' in m?m.check:/[+#]$/.test(m.san)};
 };
 const history=c instanceof Chess?c.history({verbose:true}):c.history();
 return {fen:c.fen(),check:c.isCheck(),history:history.map(simplify),legalMoves:automaticResult(c)?[]:legalMoves(c).map(simplify),claim:claimReason(c)};
}

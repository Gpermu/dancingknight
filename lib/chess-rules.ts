import { Chess, type Color } from "chess.js";
export type GameResult = { winner: Color | null; reason: string };
export const timeControls: Record<string,{label:string;minutes:number;increment:number}> = {
  unlimited:{label:"시간 제한 없음",minutes:0,increment:0},
  "3+2":{label:"3분 + 2초",minutes:3,increment:2},
  "5+0":{label:"5분",minutes:5,increment:0},
  "10+0":{label:"10분",minutes:10,increment:0},
  "15+10":{label:"15분 + 10초",minutes:15,increment:10},
};
export const other = (c:Color):Color=>c==="w"?"b":"w";
export function replay(moves:string[]) { const c=new Chess(); for(const m of moves)c.move(m); return c; }
export function repetitions(c:Chess) {
  const history=c.history({verbose:true});
  const key=(fen:string)=>fen.split(" ").slice(0,4).join(" ");
  const current=key(c.fen());
  return [history[0]?.before||c.fen(),...history.map(m=>m.after)].filter(f=>key(f)===current).length;
}
export function automaticResult(c:Chess):GameResult|null {
  if(c.isCheckmate())return {winner:other(c.turn()),reason:"체크메이트"};
  if(c.isStalemate())return {winner:null,reason:"스테일메이트"};
  if(c.isInsufficientMaterial())return {winner:null,reason:"체크메이트 불가능 · 기물 부족"};
  if(repetitions(c)>=5)return {winner:null,reason:"동일 국면 5회 반복"};
  if(Number(c.fen().split(" ")[4])>=150)return {winner:null,reason:"75수 규칙"};
  return null;
}
export function claimReason(c:Chess):string|null {
  if(repetitions(c)>=3)return "동일 국면 3회 반복";
  if(Number(c.fen().split(" ")[4])>=100)return "50수 규칙";
  return null;
}
export function cannotMate(c:Chess, color:Color) {
  const pieces=c.board().flat().filter(p=>p!==null);
  const own=pieces.filter(p=>p.color===color);
  if(own.some(p=>["p","r","q"].includes(p.type)))return false;
  const knights=own.filter(p=>p.type==="n").length;
  if(knights) return own.length<=2 && !pieces.some(p=>p.color!==color && !["k","q"].includes(p.type));
  if(own.some(p=>p.type==="b")) {
    const bishops=pieces.filter(p=>p.type==="b");
    const colors=new Set(bishops.map(p=>(p.square.charCodeAt(0)+Number(p.square[1]))%2));
    return colors.size<=1 && !pieces.some(p=>p.type==="p"||p.type==="n");
  }
  return true;
}
export function flagResult(c:Chess, loser:Color):GameResult {
  const winner=other(loser);
  return cannotMate(c,winner)?{winner:null,reason:"시간 초과 · 상대 체크메이트 불가능"}:{winner,reason:"시간 초과"};
}
export function resignResult(c:Chess, loser:Color):GameResult {
  const winner=other(loser);
  return cannotMate(c,winner)?{winner:null,reason:"기권 · 상대 체크메이트 불가능"}:{winner,reason:"기권"};
}

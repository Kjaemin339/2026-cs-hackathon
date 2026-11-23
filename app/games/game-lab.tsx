"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { LayoutTemplate, Ticket, ChartColumn, BrainCircuit, ShieldCheck, Server, ArrowRight, FlaskConical } from "lucide-react";
import s from "./games.module.css";

type PlayProps = { finish: () => void };

function Checkpoint({ error, finish }: PlayProps & { error: string }) {
  const [message, setMessage] = useState("");
  return <div className={s.check}>
    <button className="btn primary" onClick={() => error ? setMessage(error) : finish()}>결과 확인 <ArrowRight size={16}/></button>
    <p role="status">{message}</p>
  </div>;
}

function Board({ title, children }: {title: string; children: ReactNode}) {
  return <section className={s.board}><h2>{title}</h2>{children}</section>;
}

function Frontend({finish}: PlayProps) {
  const [width,setWidth] = useState(70);
  const [wrap,setWrap] = useState(false);
  const [zoom,setZoom] = useState(false);
  return <><Board title="축제 신청 화면"><div className={s.phone}>
    <small>내 신청 내역</small><h3>야외 영화제</h3><p>금요일 저녁 7시</p>
    <span className={s.sample} style={{width, fontSize:zoom ? 28 : 14,whiteSpace:wrap ? "normal":"nowrap"}}>영화제 신청 취소</span>
  </div></Board><section className={s.tools}><h2>작은 화면 수리하기</h2>
    <p>버튼을 120픽셀 안에 넣고, 글자를 두 배로 키워도 이름이 전부 보이게 하세요.</p>
    <label>버튼 너비 · {width}px<input type="range" min="55" max="200" value={width} onChange={e=>setWidth(+e.target.value)}/></label>
    <label><input type="checkbox" checked={wrap} onChange={e=>setWrap(e.target.checked)}/> 두 줄 이상 허용</label>
    <label><input type="checkbox" checked={zoom} onChange={e=>setZoom(e.target.checked)}/> 글자 두 배로 확인</label>
    <Checkpoint key={[width,wrap,zoom].join()} error={!zoom?"글자를 두 배로 키워 확인해 보세요.":width>120?"버튼이 허용된 너비를 넘었어요.":!wrap?"한 줄 안에 큰 글자가 다 들어가지 않아요.":""} finish={finish}/>
  </section></>;
}

const steps = ["남은 자리 확인","표 발급","자리 차감"];
function Backend({finish}: PlayProps) {
  const [locked,setLocked]=useState(false);
  const [turns,setTurns]=useState<number[]>([]);
  const progress=[0,0], allowed=[false,false], tickets=[false,false];
  let seats=1;
  for(const who of turns){
    const step=progress[who]++;
    if(step===0) allowed[who]=seats>0;
    if(step===1) tickets[who]=allowed[who];
    if(step===2 && allowed[who]) seats--;
  }
  const busy=progress.findIndex(n=>n>0 && n<3);
  return <><Board title={`접수 창구 · 남은 자리 ${seats}개`}>
    {["민지","준호"].map((name,i)=><div className={s.row} key={name}><Ticket/><strong>{name}</strong><span>{tickets[i]?"표 받음":progress[i] && !allowed[i]?"마감":"대기 중"}</span>
    <button disabled={progress[i]===3 || (locked && busy>=0 && busy!==i)} onClick={()=>setTurns([...turns,i])}>{steps[progress[i]]??"처리 끝"}</button></div>)}
    <small>처리 순서 · {turns.map(i=>i?"준호":"민지").join(" → ")||"시작 전"}</small></Board>
    <section className={s.tools}><h2>마지막 표 한 장</h2><p>두 창구에서 먼저 자리를 확인해 보세요. 둘 다 표를 받는다면 처음부터 다시 열고, 한 사람의 처리가 끝날 때까지 다른 창구를 기다리게 하세요.</p>
    <label><input type="checkbox" checked={locked} disabled={turns.length>0} onChange={e=>setLocked(e.target.checked)}/> 한 사람씩 끝까지 처리</label>
    <button onClick={()=>setTurns([])}>창구 다시 열기</button>
    <Checkpoint key={turns.join()} error={turns.length<6?"두 사람의 신청을 끝까지 처리하세요.":seats!==0?"한 자리에서 표가 두 장 나갔어요.":!locked?"이번 순서는 성공했어요. 두 요청이 겹쳐도 안전하게 다시 운영해 보세요.":""} finish={finish}/></section></>;
}

function Data({finish}: PlayProps){
  const entries=["민지","준호","민지","서연","준호"];
  const [keep,setKeep]=useState(entries.map(()=>true));
  const selected=entries.filter((_,i)=>keep[i]);
  return <><Board title="입장 기록">{entries.map((name,i)=><label className={s.row} key={i}><input type="checkbox" checked={keep[i]} onChange={()=>setKeep(keep.map((v,j)=>j===i?!v:v))}/><time>10:0{i}</time><strong>{name}</strong><span>{keep[i]?"집계":"제외"}</span></label>)}</Board>
  <section className={s.tools}><h2>실제 방문자 세기</h2><p>재입장한 학생이 있어요. 각 학생의 첫 입장만 남겨 안내판을 완성하세요.</p><output className={s.number}>{selected.length}명</output>
  <Checkpoint key={keep.join()} error={entries.some((name,i)=>keep[i] !== (entries.indexOf(name)===i))?"같은 이름의 가장 이른 기록 하나만 체크하세요.":""} finish={finish}/></section></>;
}

const notices=["지난주 영화제 · 오후 6시, 운동장","이번 주 영화제 · 오후 7시, 학생회관","이번 주 음악회 · 오후 5시, 강당"];
function AI({finish}: PlayProps){
  const [source,setSource]=useState<number|null>(null);
  const [time,setTime]=useState(""),[place,setPlace]=useState("");
  return <><Board title="안내 봇의 공지 서랍">{notices.map((n,i)=><button key={n} aria-pressed={source===i} onClick={()=>setSource(i)}>{n}</button>)}
  <div className={s.bubble}>“이번 주 영화제는 언제 어디서 해?”</div>
  <output>{time||"___"}에 {place||"___"}에서 열려요.</output></Board>
  <section className={s.tools}><h2>근거를 보고 답하는 봇</h2><p>봇이 참고할 공지 한 장을 고르고 그 안에서 시간과 장소를 찾아 답변을 조립하세요.</p>
  <label>시간 <select value={time} onChange={e=>setTime(e.target.value)}><option value="">선택</option>{["오후 5시","오후 6시","오후 7시"].map(v=><option key={v}>{v}</option>)}</select></label>
  <label>장소 <select value={place} onChange={e=>setPlace(e.target.value)}><option value="">선택</option>{["강당","운동장","학생회관"].map(v=><option key={v}>{v}</option>)}</select></label>
  <Checkpoint key={[source,time,place].join()} error={source!==1?"질문의 행사 이름과 주차를 함께 확인하세요.":time!=="오후 7시"||place!=="학생회관"?"참고한 공지와 완성된 답변을 대조해 보세요.":""} finish={finish}/></section></>;
}

function Security({finish}: PlayProps){
  const people=["손님","참가자","접수 담당자"], files=["행사 일정","내 입장권","전체 명단"];
  const [keys,setKeys]=useState<number[]>([]);
  const permitted=[0,3,4,6,8];
  return <><Board title="자료실 출입문">{people.map((person,i)=><div key={person}><strong>{person}</strong><div className={s.keys}>{files.map((file,j)=>{
    const id=i*3+j,open=keys.includes(id);
    return <button key={file} aria-pressed={open} onClick={()=>setKeys(open?keys.filter(v=>v!==id):[...keys,id])}>{open?"열림":"잠김"} · {file}</button>;
  })}</div></div>)}</Board><section className={s.tools}><h2>필요한 문만 열기</h2><p>일정은 모두에게 공개해요. 내 입장권은 참가자가 보고, 전체 명단은 접수 담당자만 봐요. 각 사람에게 필요한 문을 눌러 열어 주세요.</p>
  <Checkpoint key={keys.join()} error={keys.some(v=>!permitted.includes(v))?"맡은 일에 필요 없는 자료가 열려 있어요.":keys.length!==permitted.length?"필요한 자료 중 아직 잠긴 문이 있어요.":""} finish={finish}/></section></>;
}

function Cloud({finish}: PlayProps){
  const [units,setUnits]=useState([1,1,1]);
  const demand=[8,24,16], spare=6-units.reduce((a,b)=>a+b,0);
  return <><Board title="축제 서버 관제실">{["공지","신청","입장"].map((name,i)=>{
    const waiting=Math.max(0,demand[i]-units[i]*8);
    return <div key={name}><strong>{name} · 분당 요청 {demand[i]}건</strong><div className={s.row}><progress value={demand[i]-waiting} max={demand[i]}/><span>대기 {waiting}건</span></div>
    <div className={s.keys}><button aria-label={name+" 서버 줄이기"} disabled={!units[i]} onClick={()=>setUnits(units.map((v,j)=>v-Number(i===j)))}>−</button><span>서버 {units[i]}대</span><button aria-label={name+" 서버 늘리기"} disabled={!spare} onClick={()=>setUnits(units.map((v,j)=>v+Number(i===j)))}>＋</button></div></div>;
  })}</Board><section className={s.tools}><h2>신청 대기 줄 없애기</h2><p>서버 한 대는 1분에 8건을 처리해요. 가진 서버 여섯 대를 나눠 모든 창구의 대기를 0으로 만드세요.</p><output className={s.number}>남은 서버 {spare}대</output>
  <Checkpoint key={units.join()} error={units.some((n,i)=>n*8<demand[i])?"대기가 남은 창구에 서버를 더 배치하세요.":""} finish={finish}/></section></>;
}

const games=[
  {role:"프론트엔드",name:"작은 화면 수리하기",icon:LayoutTemplate,play:Frontend},
  {role:"백엔드",name:"마지막 표 한 장",icon:Ticket,play:Backend},
  {role:"데이터 분석",name:"실제 방문자 세기",icon:ChartColumn,play:Data},
  {role:"AI 엔지니어",name:"근거를 보고 답하는 봇",icon:BrainCircuit,play:AI},
  {role:"보안 엔지니어",name:"필요한 문만 열기",icon:ShieldCheck,play:Security},
  {role:"클라우드/SRE",name:"신청 대기 줄 없애기",icon:Server,play:Cloud},
];

export default function GameLab(){
  const [game,setGame]=useState<number|null>(null),[done,setDone]=useState<number[]>([]),[won,setWon]=useState(false);
  const current=game===null?null:games[game];
  const Play=current?.play;
  return <><header className="site-header"><div className="nav-inner"><Link className="brand" href="/"><FlaskConical/> 해보기</Link><Link className="btn secondary compact" href="/">체험실</Link></div></header>
  <main className={`wrap ${s.main}`}>{current && <button onClick={()=>{setGame(null);setWon(false);}}>← 게임 목록</button>}
  <small>{current?.role??`완료 ${done.length} / 6`}</small><h1>{current?.name??"축제 운영 게임"}</h1>
  {!current && <div className={s.catalog}>{games.map((g,i)=><button key={g.role} onClick={()=>setGame(i)}><g.icon/><small>{g.role}</small><strong>{g.name}</strong><span>{done.includes(i)?"다시 플레이":"시작하기"} →</span></button>)}</div>}
  {Play && !won && <div className={s.layout}><Play finish={()=>{if(game!==null && !done.includes(game))setDone([...done,game]);setWon(true);}}/></div>}
  {won && <Board title="미션 완료!"><p>{current?.role} 미션을 해결했어요.</p><button className="btn primary" onClick={()=>{setGame(null);setWon(false);}}>다른 직무 고르기</button></Board>}</main></>;
}

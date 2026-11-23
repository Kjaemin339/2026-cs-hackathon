"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  LayoutTemplate,
  Ticket,
  ChartColumn,
  BrainCircuit,
  ShieldCheck,
  Server,
  FlaskConical,
  Check,
} from "lucide-react";
import s from "./games.module.css";
import { AnalyticsSettings, useAnalytics } from "../analytics-settings";
import { GAME_ANALYTICS_VERSION } from "../../lib/analytics-schema";
import type { TrackId } from "../../lib/missions";
import { GameCheckContext } from "./shared";
import { AI, Backend, Cloud, Data, Frontend, Security } from "./plays";

const DONE_KEY = "games-done-v1";
const games = [
  {
    role: "프론트엔드",
    track: "frontend" as TrackId,
    scene: "신청 화면 준비",
    next: "신청 화면이 열렸어요. 곧 신청이 몰려와요.",
    name: "작은 화면 수리하기",
    intro:
      "글자 크기와 칸 너비가 달라도 버튼 이름이 끝까지 보이도록 속성을 골라봐요.",
    learned:
      "한 화면만이 아니라 글자 크기, 칸 너비, 이름 길이가 달라져도 내용을 읽고 누를 수 있게 만드는 일이에요.",
    icon: LayoutTemplate,
    play: Frontend,
  },
  {
    role: "백엔드",
    track: "backend" as TrackId,
    scene: "신청 오픈",
    next: "표 처리는 안전해졌어요. 이제 신청 서비스의 새 버전을 배포할 시간이에요.",
    name: "마지막 표 한 장",
    intro:
      "표가 두 장 발급되는 순서를 직접 찾아보고, 어떻게 고쳐야 모든 순서에서 안전한지 확인해요.",
    learned:
      "자리 확인과 차감이 따로 놀면 동시에 신청할 때 표가 겹쳐요. 한 사람씩 처리해 한 덩어리로 묶어야 마지막 한 자리를 지킬 수 있어요.",
    icon: Ticket,
    play: Backend,
  },
  {
    role: "클라우드/SRE",
    track: "cloud" as TrackId,
    scene: "새 버전 배포",
    next: "배포 판단이 끝났어요. 이제 행사 전날 정리가 남았어요.",
    name: "새 버전, 계속 배포할까?",
    intro:
      "새 버전을 일부 사용자에게 먼저 공개했어요. 오류율과 응답 시간을 보고 기다릴지, 되돌릴지, 계속할지 정해봐요.",
    learned:
      "숫자를 보고 기다릴지, 되돌릴지, 계속할지 정하는 일이에요. 관측이 충분한지부터 확인해요.",
    icon: Server,
    play: Cloud,
  },
  {
    role: "보안 엔지니어",
    track: "security" as TrackId,
    scene: "행사 전날",
    next: "권한 정리가 끝났어요. 행사 당일 문의가 들어와요.",
    name: "이 요청, 열어줄까?",
    intro:
      "신청 내역을 보려는 요청이 들어와요. 허용할지, 로그인을 요구할지, 막을지 판정해봐요.",
    learned:
      "요청마다 로그인과 소유자를 확인해 허용과 거부를 정하는 일이에요. 관리자도 모든 걸 할 수 있는 건 아니에요.",
    icon: ShieldCheck,
    play: Security,
  },
  {
    role: "AI 엔지니어",
    track: "ai" as TrackId,
    scene: "행사 당일 문의",
    next: "안내 봇이 정확히 답해요. 입장이 시작돼요.",
    name: "봇 답변 채점하기",
    intro:
      "안내 봇의 답변이 찾아온 공지와 맞는지 채점해봐요. 근거에 없는 내용을 지어낸 답도 섞여 있어요.",
    learned:
      "답변이 근거와 맞는지 확인하고, 근거가 없으면 모른다고 말하게 만드는 일이에요.",
    icon: BrainCircuit,
    play: AI,
  },
  {
    role: "데이터 분석",
    track: "data" as TrackId,
    scene: "입장 후 정산",
    next: "행사가 끝났어요. 오늘 하루를 함께 운영했어요.",
    name: "무엇을 셀까?",
    intro:
      "같은 입장 기록으로 방문자 수, 게이트 통과 횟수, 재입장 횟수를 각각 구해봐요.",
    learned:
      "같은 기록도 질문에 따라 세는 기준이 달라져요. 무엇을 한 건으로 셀지 먼저 정하는 일이에요.",
    icon: ChartColumn,
    play: Data,
  },
];
export default function GameLab() {
  const analytics = useAnalytics();
  useEffect(() => {
    if (analytics.status.enabled)
      analytics.client.current?.track("page_view", { page: "games" });
  }, [analytics.status.token]);
  const [game, setGame] = useState<number | null>(null),
    [done, setDone] = useState<TrackId[]>([]),
    [won, setWon] = useState(false),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(DONE_KEY) ?? "[]");
      if (Array.isArray(saved))
        setDone(
          games.map((g) => g.track).filter((track) => saved.includes(track)),
        );
    } catch {}
  }, []);
  const current = game === null ? null : games[game],
    Play = current?.play,
    nextIndex = games.findIndex((g) => !done.includes(g.track)),
    following = game === null ? undefined : games[game + 1];
  const choose = (i: number | null) => {
    if (i === null) analytics.client.current?.end("left");
    else
      analytics.client.current?.begin(
        games[i].track,
        "game",
        GAME_ANALYTICS_VERSION,
        "new",
      );
    setGame(i);
    setWon(false);
    setAttempt((v) => v + 1);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const markDone = (track: TrackId) => {
    if (done.includes(track)) return;
    const next = [...done, track];
    setDone(next);
    try {
      localStorage.setItem(DONE_KEY, JSON.stringify(next));
    } catch {}
  };
  return (
    <>
      <header className="site-header">
        <div className="nav-inner">
          <Link className="brand" href="/">
            <FlaskConical /> 해보기
          </Link>
          <Link className="btn secondary compact" href="/">
            코드 체험실
          </Link>
        </div>
      </header>
      <main className={`wrap ${s.main}`}>
        {current && (
          <button className={s.back} onClick={() => choose(null)}>
            ← 게임 목록
          </button>
        )}
        <small>{current?.role ?? `완료 ${done.length} / 6`}</small>
        <h1>{current?.name ?? "축제 운영 게임"}</h1>
        <p className={s.lead}>
          {current?.intro ??
            "코드 없이 눌러보고 바꿔보며, 직무마다 하는 일을 하나씩 경험해요."}
        </p>
        <AnalyticsSettings analytics={analytics} />
        {!current && (
          <>
            <ol className={s.catalog}>
              {games.map((g, i) => (
                <li key={g.role}>
                  <button
                    aria-label={`${i + 1}번째 장면 ${g.scene}, ${g.role} 게임 시작${i === nextIndex ? ", 다음 추천" : ""}`}
                    onClick={() => choose(i)}
                  >
                    <g.icon />
                    <small>
                      {i + 1}. {g.scene} · {g.role}
                      {i === nextIndex && " · 다음 추천"}
                    </small>
                    <strong>{g.name}</strong>
                    <span>
                      {done.includes(g.track) ? "다시 해보기" : "시작하기"} →
                    </span>
                  </button>
                </li>
              ))}
            </ol>
            {done.length === games.length && (
              <section className={s.complete} role="status">
                <Check size={28} />
                <h2>축제 하루를 함께 운영했어요!</h2>
                <ul className={s.recap}>
                  {games.map((g) => (
                    <li key={g.role}>
                      <strong>{g.role}</strong> {g.learned}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <p className={s.footnote}>
              게임 완료 표시는 이 브라우저에만 저장돼요. 코드 체험 기록과는
              별개예요.
            </p>
          </>
        )}
        {Play && !won && (
          <div className={s.layout}>
            <GameCheckContext.Provider
              value={(passed) =>
                analytics.client.current?.track("game_check", { passed })
              }
            >
              <Play
                key={attempt}
                finish={() => {
                  if (game !== null) markDone(games[game].track);
                  analytics.client.current?.end("completed");
                  setWon(true);
                  window.scrollTo({ top: 0, behavior: "instant" });
                }}
              />
            </GameCheckContext.Provider>
          </div>
        )}
        {won && current && (
          <section className={s.complete} role="status">
            <Check size={28} />
            <h2>직접 해봤어요!</h2>
            <p>{current.learned}</p>
            <p>{current.next}</p>
            <div className={s.keys}>
              {following && (
                <button
                  className="btn primary"
                  onClick={() => choose(game! + 1)}
                >
                  다음 장면: {following.role}
                </button>
              )}
              <Link className="btn secondary" href="/">
                코드 체험실에서도 해보기
              </Link>
              <button className="btn secondary" onClick={() => choose(game)}>
                한 번 더 해보기
              </button>
              <button className="btn secondary" onClick={() => choose(null)}>
                {done.length === games.length ? "하루 정리 보기" : "목록으로"}
              </button>
            </div>
          </section>
        )}
      </main>
    </>
  );
}

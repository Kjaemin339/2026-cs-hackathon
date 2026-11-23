export const people = ["민지", "준호"] as const;
export const serviceSteps = ["남은 자리 확인", "표 발급", "자리 차감"] as const;
export function backendState(turns: number[]) {
  const progress = [0, 0],
    allowed = [false, false],
    tickets = [false, false];
  let seats = 1;
  for (const who of turns) {
    const step = progress[who]++;
    if (step === 0) allowed[who] = seats > 0;
    if (step === 1) tickets[who] = allowed[who];
    if (step === 2 && allowed[who]) seats--;
  }
  return {
    progress,
    allowed,
    tickets,
    seats,
    busy: progress.findIndex((n) => n > 0 && n < 3),
  };
}
export function advanceBackend(turns: number[], who: number, locked: boolean) {
  const state = backendState(turns);
  if (
    ![0, 1].includes(who) ||
    state.progress[who] >= 3 ||
    (locked && state.busy >= 0 && state.busy !== who)
  )
    return turns;
  return [...turns, who];
}
export function backendFeedback(turns: number[], locked: boolean) {
  const { progress, tickets, seats, busy } = backendState(turns);
  if (turns.length < 6) {
    const who = locked && busy >= 0 ? busy : progress.findIndex((n) => n < 3);
    return `${people[who]} 창구의 ‘${serviceSteps[progress[who]]}’를 눌러 신청 처리를 이어가세요.`;
  }
  if (tickets.filter(Boolean).length !== 1 || seats !== 0)
    return "표 한 장인데 두 사람에게 발급됐어요. ‘한 사람씩 처리하며 다시 시작’을 눌러보세요.";
  if (!locked)
    return "이번 순서는 성공했어요. 요청이 겹쳐도 안전하도록 ‘한 사람씩 처리하며 다시 시작’을 선택해보세요.";
  return "";
}
export const entryNames = ["민지", "준호", "민지", "서연", "준호"];
export function dataFeedback(keep: boolean[]) {
  if (keep.length !== entryNames.length)
    return "입장 기록을 다시 확인해주세요.";
  const wrong = keep.findIndex(
    (v, i) => v !== (entryNames.indexOf(entryNames[i]) === i),
  );
  return wrong < 0
    ? ""
    : entryNames.indexOf(entryNames[wrong]) === wrong
      ? `${entryNames[wrong]}의 첫 입장(10:0${wrong})은 남겨주세요.`
      : `${entryNames[wrong]}는 앞에서 이미 입장했어요. 10:0${wrong} 재입장 기록의 체크를 꺼보세요.`;
}
export const notices = [
  { title: "지난주 영화제", time: "오후 6시", place: "운동장" },
  { title: "이번 주 영화제", time: "오후 7시", place: "학생회관" },
  { title: "이번 주 음악회", time: "오후 5시", place: "강당" },
];
export function aiFeedback(source: number | null, time: string, place: string) {
  if (source === null) return "먼저 봇이 참고할 공지 한 장을 눌러주세요.";
  if (source !== 1)
    return "질문은 ‘이번 주 영화제’예요. 공지의 주차와 행사 이름이 모두 같은지 확인해보세요.";
  if (time !== notices[1].time)
    return "고른 공지의 시간은 오후 7시예요. 시간 선택을 확인해주세요.";
  if (place !== notices[1].place)
    return "고른 공지의 장소는 학생회관이에요. 장소 선택을 확인해주세요.";
  return "";
}
export const accessPeople = ["손님", "참가자", "접수 담당자"];
export const accessFiles = ["행사 일정", "내 입장권", "전체 명단"];
export const accessNotes = [
  "일정만 볼 수 있어요.",
  "일정과 내 입장권을 볼 수 있어요.",
  "일정과 전체 명단을 볼 수 있어요.",
];
export const permittedKeys = [0, 3, 4, 6, 8];
export function securityFeedback(keys: number[]) {
  const extra = keys.find((id) => !permittedKeys.includes(id));
  if (extra !== undefined)
    return `${accessPeople[Math.floor(extra / 3)]}에게 ‘${accessFiles[extra % 3]}’이 열려 있어요. 한 번 더 눌러 잠가주세요.`;
  const missing = permittedKeys.find((id) => !keys.includes(id));
  return missing === undefined
    ? ""
    : `${accessPeople[Math.floor(missing / 3)]}의 ‘${accessFiles[missing % 3]}’을 열어주세요.`;
}
export const serviceNames = ["공지", "신청", "입장"];
export const demands = [8, 24, 16];
export function cloudFeedback(units: number[]) {
  if (
    units.length !== 3 ||
    units.some((n) => !Number.isInteger(n) || n < 0) ||
    units.reduce((a, b) => a + b, 0) > 6
  )
    return "서버 여섯 대 안에서 나눠주세요.";
  const index = units.findIndex((n, i) => n * 8 < demands[i]);
  return index < 0
    ? ""
    : `${serviceNames[index]} 창구에 대기 ${demands[index] - units[index] * 8}건이 남았어요. 이 창구의 ＋를 눌러보세요.`;
}
export function frontendFeedback(width: number, wrap: boolean, zoom: boolean) {
  if (!zoom)
    return "‘큰 글자로 확인’을 켜보세요. 글자가 어디에서 잘리는지 보여요.";
  if (width > 120)
    return "버튼 너비가 화면의 한도인 120px를 넘었어요. 120px 이하로 줄여보세요.";
  if (!wrap) return "‘줄바꿈 허용’을 켜면 큰 글자가 다음 줄로 이어져요.";
  return "";
}

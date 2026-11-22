import type { Mission, MissionGuide } from "../missions.ts";
export const CONTENT_VERSION = "2026-11-23.1";
const requirementId = (m: { id: string }, i: number) =>
  `${m.id}/requirement/${i + 1}`;
const checkId = (m: { id: string }, i: number) => `${m.id}/check/${i + 1}`;
export const events = [
  {
    id: 1,
    title: "나만의 웹페이지 만들기",
    category: "개발",
    registered: 12,
    capacity: 20,
  },
  {
    id: 2,
    title: "선배와 함께하는 진로 이야기",
    category: "진로",
    registered: 30,
    capacity: 30,
  },
  {
    id: 3,
    title: "작은 서비스를 만드는 해커톤",
    category: "개발",
    registered: 24,
    capacity: 24,
  },
  {
    id: 4,
    title: "개발 동아리 오픈 세션",
    category: "동아리",
    registered: 8,
    capacity: 15,
  },
  {
    id: 5,
    title: "처음 만나는 데이터 분석",
    category: "개발",
    registered: 9,
    capacity: 18,
  },
];
export const rows = [
  { userId: "a", category: "개발", attended: true, cancelled: false },
  { userId: "a", category: "개발", attended: true, cancelled: false },
  { userId: "b", category: "개발", attended: false, cancelled: false },
  { userId: "c", category: "개발", attended: true, cancelled: true },
  { userId: "d", category: "진로", attended: true, cancelled: false },
  { userId: "e", category: "진로", attended: true, cancelled: false },
  { userId: "f", category: "진로", attended: false, cancelled: false },
  { userId: "g", category: "동아리", attended: true, cancelled: false },
];
const definitions: Omit<Mission, "contentVersion" | "guides">[] = [
  {
    id: "frontend",
    title: "프론트엔드",
    action: "원하는 행사를 쉽게 찾는 화면",
    description: "사용자의 선택을 화면의 반응으로 바꿔보세요.",
    color: "blue",
    time: "25분",
    fn: "selectEvents",
    brief:
      "행사가 많아지면서 신청 가능한 행사를 찾기 어렵다는 의견이 들어왔어요. 이미 만들어진 화면에 카테고리 필터와 신청 가능 필터를 연결해주세요.",
    starter: `// 조건에 맞는 행사 배열을 반환해주세요.
// category: '전체', '개발', '진로', '동아리'
// availableOnly: 신청 가능한 행사만 보면 true
function selectEvents(events, category, availableOnly) {
  // TODO: 아래 코드를 수정해주세요.
  return events;
}`,
    solution: `function selectEvents(events, category, availableOnly) {
  return events.filter(event => {
    const matches = category === '전체' || event.category === category;
    const hasRoom = event.registered < event.capacity;
    return matches && (!availableOnly || hasRoom);
  });
}`,
    steps: [
      "전체이면 모든 카테고리를 보여주세요.",
      "카테고리를 고르면 해당 행사만 보여주세요.",
      "신청 가능 필터를 켜면 정원이 남은 행사만 보여주세요.",
    ],
    concepts: ["사용자 입력", "화면 상태", "목록 필터"],
    hints: [
      "배열에서 조건에 맞는 항목을 고를 때 filter를 쓸 수 있어요. 먼저 category가 전체인 경우를 생각해보세요.",
      "카테고리 조건은 category === '전체' || event.category === category예요. 조건이 참인 항목만 남겨보세요.",
      "신청 가능 조건은 event.registered < event.capacity예요. availableOnly가 false일 때는 이 조건을 검사하지 않아도 돼요.",
    ],
    next: [
      "검색어로 행사 제목 찾기",
      "마감된 행사의 버튼 상태 만들기",
      "정렬 방식과 빈 화면 추가하기",
    ],
    previewArgs: [events, "개발", true],
    tests: [
      {
        label: "전체 행사 보기",
        why: "전체를 고르고 필터를 끄면 원래 목록을 유지해요.",
        args: [events, "전체", false],
        expected: events,
      },
      {
        label: "카테고리로 찾기",
        why: "개발 카테고리에는 개발 행사만 남아요.",
        args: [events, "개발", false],
        expected: events.filter((x) => x.category === "개발"),
      },
      {
        label: "신청 가능한 행사만 보기",
        why: "정원이 찬 행사는 목록에서 빠져야 해요.",
        args: [events, "전체", true],
        expected: events.filter((x) => x.registered < x.capacity),
      },
      {
        label: "두 필터 함께 사용하기",
        why: "카테고리와 신청 가능 조건을 동시에 적용해요.",
        args: [events, "개발", true],
        expected: events.filter(
          (x) => x.category === "개발" && x.registered < x.capacity,
        ),
      },
      {
        label: "조건에 맞는 행사가 없을 때",
        why: "해당 행사가 없으면 빈 배열을 반환해요.",
        args: [events, "진로", true],
        expected: [],
      },
    ],
  },
  {
    id: "backend",
    title: "백엔드",
    action: "겹치지 않고 공정한 신청 규칙",
    description: "여러 조건을 빠짐없이 다루는 신청 규칙을 만들어보세요.",
    color: "teal",
    time: "25분",
    fn: "applyToEvent",
    brief:
      "신청 버튼을 눌렀을 때 서버가 어떤 답을 줄지 정해주세요. 중복 여부를 먼저 확인하고, 정원이 남았을 때만 신청을 받아야 해요. 실제 서버 배포 대신 요청 처리 함수를 체험해요.",
    starter: `// 반환값: { status: 숫자, accepted: true 또는 false }
// 중복: 409 / 정원 초과: 403 / 성공: 201
// 중복을 먼저 확인해요. 입력 배열은 바꾸지 않아요.
function applyToEvent(attendees, userId, capacity) {
  // TODO: 거절해야 하는 조건을 추가해주세요.
  return { status: 201, accepted: true };
}`,
    solution: `function applyToEvent(attendees, userId, capacity) {
  if (attendees.includes(userId)) {
    return { status: 409, accepted: false };
  }
  if (attendees.length >= capacity) {
    return { status: 403, accepted: false };
  }
  return { status: 201, accepted: true };
}`,
    steps: [
      "이미 신청한 사용자이면 409와 accepted: false를 반환해주세요.",
      "정원에 도달했으면 403과 accepted: false를 반환해주세요.",
      "나머지는 201과 accepted: true를 반환해주세요. 입력 배열은 바꾸지 않아요.",
    ],
    concepts: ["업무 규칙", "예외 처리", "요청과 응답"],
    hints: [
      "성공하는 경우보다 거절해야 하는 두 가지 경우를 먼저 적어보세요. 중복 신청을 먼저 검사해요.",
      "attendees.includes(userId)로 이미 신청한 사람인지 확인할 수 있어요. if 조건 안에서 즉시 응답을 반환해보세요.",
      "중복이 아니라면 attendees.length >= capacity인지 확인해요. 정원도 남아 있다면 마지막 성공 응답에 도달하면 돼요.",
    ],
    next: [
      "취소 요청과 대기 명단 만들기",
      "요청 데이터 검증 더하기",
      "동시에 두 명이 신청하면 어떻게 될지 살펴보기",
    ],
    previewArgs: [["mina", "jun"], "taehun", 2],
    tests: [
      {
        label: "처음 신청하는 사용자",
        why: "정원이 남고 중복이 아니면 신청을 받아요.",
        args: [["a"], "b", 3],
        expected: { status: 201, accepted: true },
      },
      {
        label: "이미 신청한 사용자",
        why: "정원이 남아도 중복 신청은 거절해요.",
        args: [["a"], "a", 3],
        expected: { status: 409, accepted: false },
      },
      {
        label: "정원이 모두 찼을 때",
        why: "인원이 정원과 같으면 더 받을 수 없어요.",
        args: [["a", "b"], "c", 2],
        expected: { status: 403, accepted: false },
      },
      {
        label: "마지막 한 자리",
        why: "한 자리가 남았다면 신청할 수 있어요.",
        args: [["a"], "b", 2],
        expected: { status: 201, accepted: true },
      },
      {
        label: "중복과 정원 초과가 겹칠 때",
        why: "요청 명세대로 중복을 먼저 확인해요.",
        args: [["a"], "a", 1],
        expected: { status: 409, accepted: false },
      },
    ],
  },
  {
    id: "data",
    title: "데이터 분석",
    action: "참여 데이터에서 다음 개선점 찾기",
    description: "데이터를 정리하고 숫자 뒤의 이야기를 찾아보세요.",
    color: "orange",
    time: "30분",
    fn: "summarizeAttendance",
    brief:
      "행사 운영팀이 카테고리별 실제 참여율을 알고 싶어 해요. 취소한 신청을 먼저 제외한 뒤, 같은 카테고리와 사용자 조합은 첫 기록만 사용해요. 결과는 카테고리 이름순으로 정렬해주세요.",
    starter: `// cancelled가 true인 기록은 먼저 제외해요.
// 같은 category + userId는 첫 번째만 사용해요.
// 결과: [{ category, total, attended, rate }]
// rate: 참여 / 유효 신청 * 100을 반올림해요.
function summarizeAttendance(rows) {
  // TODO: 중복 제거와 카테고리별 집계를 구현해요.
  return [];
}`,
    solution: `function summarizeAttendance(rows) {
  const seen = new Set();
  const groups = {};
  for (const row of rows) {
    const key = row.category + ':' + row.userId;
    if (row.cancelled || seen.has(key)) continue;
    seen.add(key);
    if (!groups[row.category]) groups[row.category] = { total: 0, attended: 0 };
    groups[row.category].total += 1;
    if (row.attended) groups[row.category].attended += 1;
  }
  return Object.keys(groups).sort().map(category => ({
    category,
    total: groups[category].total,
    attended: groups[category].attended,
    rate: Math.round(groups[category].attended / groups[category].total * 100)
  }));
}`,
    steps: [
      "취소한 신청을 제외하고, 카테고리와 사용자 조합으로 중복을 제거해주세요.",
      "카테고리별 total과 attended를 집계하고 rate를 반올림해주세요.",
      "카테고리 이름순으로 정렬한 뒤, 숫자로 설명할 수 있는 개선점을 회고에 남겨보세요.",
    ],
    concepts: ["데이터 정리", "집계 기준", "결과 해석"],
    hints: [
      "먼저 유효한 기록만 남겨야 해요. cancelled가 true인지 확인하고, 중복을 기억할 Set을 준비해보세요.",
      "중복 기준은 category + ':' + userId예요. 같은 사람도 서로 다른 카테고리에는 각각 신청할 수 있어요.",
      "카테고리별 total과 attended를 누적한 뒤 Math.round(attended / total * 100)으로 참여율을 계산해요.",
    ],
    next: [
      "분모가 작을 때 해석의 한계 적어보기",
      "행사별 참여율을 그래프로 나타내기",
      "취소율과 참여율을 함께 비교하기",
    ],
    previewArgs: [rows],
    tests: [
      {
        label: "중복과 취소가 섞인 기록",
        why: "유효한 신청만 분모에 넣고 집계해요.",
        args: [rows],
        expected: [
          { category: "개발", total: 2, attended: 1, rate: 50 },
          { category: "동아리", total: 1, attended: 1, rate: 100 },
          { category: "진로", total: 3, attended: 2, rate: 67 },
        ],
      },
      {
        label: "데이터가 비어 있을 때",
        why: "데이터가 없으면 빈 배열을 반환해요.",
        args: [[]],
        expected: [],
      },
      {
        label: "취소 기록만 있을 때",
        why: "취소한 신청은 계산에서 제외해요.",
        args: [
          [{ userId: "a", category: "개발", attended: false, cancelled: true }],
        ],
        expected: [],
      },
      {
        label: "한 사용자의 여러 카테고리",
        why: "사용자와 카테고리를 함께 보고 판단해요.",
        args: [
          [
            { userId: "a", category: "개발", attended: true, cancelled: false },
            {
              userId: "a",
              category: "진로",
              attended: false,
              cancelled: false,
            },
          ],
        ],
        expected: [
          { category: "개발", total: 1, attended: 1, rate: 100 },
          { category: "진로", total: 1, attended: 0, rate: 0 },
        ],
      },
      {
        label: "반복된 신청 세 건",
        why: "같은 조합은 첫 번째 기록만 남겨요.",
        args: [
          [
            { userId: "a", category: "개발", attended: true, cancelled: false },
            { userId: "a", category: "개발", attended: true, cancelled: false },
            { userId: "a", category: "개발", attended: true, cancelled: false },
          ],
        ],
        expected: [{ category: "개발", total: 1, attended: 1, rate: 100 }],
      },
    ],
  },
  {
    id: "ai",
    title: "AI 엔지니어",
    action: "근거를 찾아 답하는 AI 만들기",
    description: "질문과 관련 있는 문서를 골라 AI에게 건네요.",
    color: "violet",
    time: "20분",
    fn: "retrieveDocs",
    brief:
      "행사 안내 AI가 엉뚱한 문서를 참고하고 있어요. 질문의 단어와 문서의 tags가 겹치는 개수를 점수로 쓰고, 관련 있는 문서 2개만 골라주세요. 검색 증강 생성(RAG)의 검색 단계를 작은 함수로 체험해요.",
    starter: `// query: ['신청', '취소']처럼 이미 나뉜 단어 배열
// docs: [{ id, tags: ['신청', '마감'] }]
// 같은 단어는 한 번만 계산해요. 동점은 id 오름차순.
// 점수가 0인 문서는 빼고 id 배열을 최대 2개 반환해요.
function retrieveDocs(query, docs) {
  return docs.slice(0, 2).map(doc => doc.id);
}`,
    solution: `function retrieveDocs(query, docs) {
  const words = new Set(query);
  return docs.map(doc => ({
    id: doc.id,
    score: [...new Set(doc.tags)].filter(tag => words.has(tag)).length
  })).filter(doc => doc.score > 0)
    .sort((a, b) => b.score - a.score || a.id - b.id)
    .slice(0, 2).map(doc => doc.id);
}`,
    steps: [
      "질문과 문서에 겹치는 단어 수를 세세요. 중복 단어는 한 번만 세요.",
      "관련 없는 문서를 빼고 점수 내림차순, 동점은 id 오름차순으로 정렬해요.",
      "상위 문서 id를 최대 2개 반환해요.",
    ],
    concepts: ["RAG", "검색 품질", "근거 선택"],
    hints: [
      "Set으로 중복 단어를 없애고, 문서마다 겹치는 단어 수를 계산해보세요.",
      "각 문서를 { id, score }로 바꾸면 필터와 정렬을 나눠 처리하기 쉬워요.",
      "score가 0인 문서를 빼고 b.score - a.score || a.id - b.id로 정렬한 뒤 두 개를 골라요.",
    ],
    next: [
      "실제로 관련 있는 문서가 뽑혔는지 평가하기",
      "검색 결과가 없을 때 AI가 모른다고 답하게 하기",
      "키워드 검색과 임베딩 검색 비교하기",
    ],
    previewArgs: [
      ["신청", "취소"],
      [
        { id: 1, tags: ["장소"] },
        { id: 2, tags: ["신청"] },
        { id: 3, tags: ["신청", "취소"] },
      ],
    ],
    tests: [
      {
        label: "더 관련 있는 문서를 먼저",
        why: "겹치는 단어가 많은 문서를 먼저 골라요.",
        args: [
          ["신청", "취소"],
          [
            { id: 1, tags: ["장소"] },
            { id: 2, tags: ["신청"] },
            { id: 3, tags: ["신청", "취소"] },
          ],
        ],
        expected: [3, 2],
      },
      {
        label: "관련 문서가 없을 때",
        why: "근거가 없으면 빈 목록을 반환해요.",
        args: [["주차"], [{ id: 1, tags: ["신청"] }]],
        expected: [],
      },
      {
        label: "점수가 같을 때",
        why: "동점의 순서를 일관되게 유지해요.",
        args: [
          ["신청"],
          [
            { id: 8, tags: ["신청"] },
            { id: 2, tags: ["신청"] },
            { id: 4, tags: ["신청"] },
          ],
        ],
        expected: [2, 4],
      },
      {
        label: "중복 단어가 섞일 때",
        why: "중복 단어 때문에 점수가 부풀지 않아요.",
        args: [
          ["신청", "신청", "취소"],
          [
            { id: 1, tags: ["신청", "신청", "신청"] },
            { id: 2, tags: ["신청", "취소"] },
          ],
        ],
        expected: [2, 1],
      },
      {
        label: "질문이 비어 있을 때",
        why: "질문 없이 임의의 문서를 고르지 않아요.",
        args: [[], [{ id: 1, tags: ["신청"] }]],
        expected: [],
      },
    ],
  },
  {
    id: "security",
    title: "보안 엔지니어",
    action: "다른 사람의 신청 내역 지키기",
    description: "누가 어떤 정보를 볼 수 있는지 정해요.",
    color: "rose",
    time: "20분",
    fn: "authorizeRequest",
    brief:
      "주소의 신청 번호만 바꾸면 다른 사람의 내역도 볼 수 있다는 제보가 왔어요. 화면을 숨기는 것에 더해, 서버에서 매 요청의 로그인과 소유권을 확인하는 접근 제어를 만들어주세요.",
    starter: `// user: null 또는 { id, role: 'student' | 'admin' }
// 신청 기록: { ownerId } / action: 'read' 또는 'delete'
// 비로그인 401, 본인 또는 관리자 허용 200, 나머지 403
// 관리자도 다른 사람의 기록 삭제는 허용하지 않아요.
function authorizeRequest(user, record, action) {
  return 200;
}`,
    solution: `function authorizeRequest(user, record, action) {
  if (!user) return 401;
  if (user.id === record.ownerId) return 200;
  if (user.role === 'admin' && action === 'read') return 200;
  return 403;
}`,
    steps: [
      "로그인하지 않았다면 401을 반환해요.",
      "본인의 기록은 조회와 삭제를 모두 허용해요.",
      "관리자는 타인 기록 조회만 허용해요. 나머지는 403으로 거절해요.",
    ],
    concepts: ["접근 제어", "소유권", "최소 권한"],
    hints: [
      "로그인 확인을 가장 먼저 하고, 그다음 기록의 소유자인지 비교해보세요.",
      "user.id === record.ownerId이면 조회와 삭제가 모두 가능해요.",
      "관리자 예외는 role뿐 아니라 action === 'read'도 함께 검사해야 해요.",
    ],
    next: [
      "서버 API에서 소유권 검사 적용하기",
      "요청마다 권한을 검사하는 이유 정리하기",
      "다른 사용자로 접근하는 테스트 추가하기",
    ],
    previewArgs: [{ id: "jun", role: "student" }, { ownerId: "mina" }, "read"],
    tests: [
      {
        label: "로그인하지 않은 요청",
        why: "소유권 검사 전에 로그인을 확인해요.",
        args: [null, { ownerId: "mina" }, "read"],
        expected: 401,
      },
      {
        label: "본인의 신청 조회",
        why: "본인은 자기 기록을 볼 수 있어요.",
        args: [{ id: "mina", role: "student" }, { ownerId: "mina" }, "read"],
        expected: 200,
      },
      {
        label: "다른 학생의 신청 조회",
        why: "신청 번호를 알아도 타인 정보는 거절해요.",
        args: [{ id: "jun", role: "student" }, { ownerId: "mina" }, "read"],
        expected: 403,
      },
      {
        label: "관리자의 신청 조회",
        why: "관리자에게는 조회만 예외로 허용해요.",
        args: [{ id: "staff", role: "admin" }, { ownerId: "mina" }, "read"],
        expected: 200,
      },
      {
        label: "관리자의 타인 기록 삭제",
        why: "관리자라고 모든 작업을 허용하지 않아요.",
        args: [{ id: "staff", role: "admin" }, { ownerId: "mina" }, "delete"],
        expected: 403,
      },
    ],
  },
  {
    id: "cloud",
    title: "클라우드 / SRE",
    action: "새 버전을 계속 배포해도 될까?",
    description: "오류율과 응답 속도로 배포를 판단해요.",
    color: "sky",
    time: "20분",
    fn: "decideRelease",
    brief:
      "신청 서비스 새 버전을 일부 사용자에게 먼저 공개했어요. 관측한 요청 수와 오류율, p95 응답 시간으로 배포를 계속할지 결정해주세요. 실제 인프라 조작 없이 카나리 배포의 판단 로직을 체험해요.",
    starter: `// metrics: { requests, errors, p95Ms }
// requests < 100 → 'wait' (데이터 부족)
// 그 외 오류율 > 2% 또는 p95Ms > 500 → 'rollback'
// 나머지 → 'promote'
function decideRelease(metrics) {
  return 'promote';
}`,
    solution: `function decideRelease(metrics) {
  if (metrics.requests < 100) return 'wait';
  const errorRate = metrics.errors / metrics.requests;
  if (errorRate > 0.02 || metrics.p95Ms > 500) return 'rollback';
  return 'promote';
}`,
    steps: [
      "요청이 100건보다 적으면 wait를 반환해요.",
      "충분히 관측했다면 오류율 2% 초과 또는 p95 500ms 초과일 때 rollback해요.",
      "두 기준을 모두 만족하면 promote를 반환해요.",
    ],
    concepts: ["카나리 배포", "모니터링", "장애 대응"],
    hints: [
      "데이터가 충분한지 먼저 판단해요. 요청 수가 적으면 오류율부터 계산하지 않아도 돼요.",
      "오류율은 errors / requests예요. 2%는 0.02로 비교할 수 있어요.",
      "오류율과 응답 시간 중 하나만 초과해도 되돌려야 하니 || 연산자를 써보세요.",
    ],
    next: [
      "배포 기준의 경계값 테스트 더하기",
      "평균과 p95 응답 시간의 차이 알아보기",
      "되돌리기 이후 확인할 항목 적기",
    ],
    previewArgs: [{ requests: 500, errors: 15, p95Ms: 320 }],
    tests: [
      {
        label: "아직 요청이 부족할 때",
        why: "적은 관측값으로 성급히 배포하지 않아요.",
        args: [{ requests: 30, errors: 3, p95Ms: 700 }],
        expected: "wait",
      },
      {
        label: "오류율이 높아졌을 때",
        why: "속도가 빨라도 오류가 많으면 되돌려요.",
        args: [{ requests: 500, errors: 15, p95Ms: 320 }],
        expected: "rollback",
      },
      {
        label: "응답이 느려졌을 때",
        why: "오류율이 낮아도 응답 지연을 확인해요.",
        args: [{ requests: 100, errors: 0, p95Ms: 501 }],
        expected: "rollback",
      },
      {
        label: "배포를 계속할 수 있을 때",
        why: "관측 수와 두 품질 기준을 만족해요.",
        args: [{ requests: 250, errors: 1, p95Ms: 250 }],
        expected: "promote",
      },
      {
        label: "정확히 기준에 도달했을 때",
        why: "100건, 2%, 500ms는 초과가 아니므로 허용해요.",
        args: [{ requests: 100, errors: 2, p95Ms: 500 }],
        expected: "promote",
      },
    ],
  },
];
const boundaries = {
  frontend:
    "신청 가능은 registered < capacity예요. 정원과 같으면 제외하고, availableOnly가 false이면 정원 조건은 적용하지 않아요. 두 필터를 적용한 결과가 없으면 빈 배열을 반환해요.",
  backend:
    "중복 신청을 먼저 검사해 409를 반환해요. 중복이 아니고 인원이 정원 이상이면 403, 나머지는 201이에요. 입력 배열은 바꾸지 않아요.",
  data: "취소 기록을 먼저 제외한 뒤 같은 카테고리·사용자의 첫 유효 기록만 세요. 참여율은 Math.round(attended / total * 100)으로 계산하고 카테고리 이름순으로 정렬해요. 유효한 기록이 없으면 빈 배열이에요.",
  ai: "점수가 0인 문서는 제외해요(score > 0). 중복 단어는 한 번만 세고, 점수 내림차순·동점 id 오름차순으로 최대 2개를 골라요. 관련 문서나 질문 단어가 없으면 빈 배열이에요.",
  security:
    "비로그인은 401, 본인 기록의 조회·삭제는 200이에요. 관리자의 타인 기록 조회만 200이고 타인 기록 삭제는 403이에요.",
  cloud:
    "요청이 100건 미만이면 먼저 wait예요. 그 외에는 오류율 > 0.02 또는 p95Ms > 500이면 rollback이에요. 정확히 100건·2%·500ms이면 promote예요.",
};
const hintRequirements = {
  frontend: [[0], [0, 1], [2]],
  backend: [[0, 1], [0], [1, 2]],
  data: [[0], [0], [1]],
  ai: [[0], [0, 1], [1, 2]],
  security: [[0, 1], [1], [2]],
  cloud: [[0], [1], [1]],
};
function buildGuides(
  m: Omit<Mission, "contentVersion" | "guides">,
): MissionGuide[] {
  const requirements = m.steps.map((_, i) => requirementId(m, i));
  return [
    ...m.hints.map((message, i) => ({
      id: `${m.id}/hint/${i + 1}`,
      message,
      requirementIds: hintRequirements[m.id][i].map((index) =>
        requirementId(m, index),
      ),
      checkIds: [],
      nextAction: "edit" as const,
    })),
    {
      id: `${m.id}/boundaries`,
      message: boundaries[m.id],
      requirementIds: requirements,
      checkIds: [],
      nextAction: "edit",
    },
    {
      id: `${m.id}/syntax`,
      message: `문법 오류가 보고됐다면 괄호·따옴표의 짝과 return 위치부터 확인해보세요. 함수 이름은 ${m.fn}로 유지하고 수정 후 다시 실행해보세요.`,
      requirementIds: requirements,
      checkIds: [],
      nextAction: "edit",
    },
    ...m.tests.map((t, i) => ({
      id: `${m.id}/check-guide/${i + 1}`,
      message: `“${t.label}” 항목을 살펴보세요. ${t.why} 입력과 기대값을 코드의 조건과 비교해보세요.`,
      requirementIds: requirements,
      checkIds: [checkId(m, i)],
      nextAction: "inspect" as const,
    })),
  ];
}

export const releaseMissions: Mission[] = definitions.map((m) => ({
  ...m,
  contentVersion: CONTENT_VERSION,
  guides: buildGuides(m),
}));

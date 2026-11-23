# 해보기 발표 자료

학생의 개발 직무 탐색을 작은 코드 업무, 실행, 회고, 비교, 다음 활동으로 연결하는 해커톤 발표 자료입니다. 현재 문서는 발표 준비용이며 학생 3명 예비테스트는 아직 실시하지 않았습니다.

- [7장 PowerPoint](../../deliverables/demo/haebogi-hackathon-pitch-v4.pptx): 텍스트와 결과 양식을 편집할 수 있습니다. 발표 노트에 구현 근거와 주장 범위를 넣었습니다.
- [같은 7장 PDF](../../deliverables/demo/haebogi-hackathon-pitch-v4.pdf): 검토한 슬라이드 이미지를 담은 열람용입니다. PDF 텍스트 검색·편집은 지원하지 않으며 결과 양식 수정은 PPTX에서 합니다.
- [2분 시연 대본](DEMO-SCRIPT.md): 사전 준비, 시간표, 실제 한 줄 수정, 실패 시 대체 시연 포함.
- [한 장 프로젝트 요약](ONE-PAGER.md)
- [심사 기준과 증거](JUDGING.md): 기술 30, 창의성 25, 실용성 25, 발표·협업 20.
- [예상 질문과 답변](Q-AND-A.md)
- [실제 팀원 역할 기입 양식](TEAM-ROLES.csv): 담당자를 확인한 뒤 작성합니다. 에이전트 분업을 학생 팀원의 기여로 쓰지 않습니다.

서비스: https://haebogi-career-lab.vercel.app

## 발표 전 확인

1. 최종 배포 버전에서 두 직무 수정·실행·회고·비교를 직접 확인합니다. 슬라이드의 QA 캡처는 과거 점검 화면이며 현장 실측으로 소개하지 않습니다.
2. AI 응답 출처가 `ai`인지 기본 힌트인지 화면에서 구분합니다. 실제 호출이 실패하면 준비된 기본 힌트로 시연하고 출처를 바꾸어 말하지 않습니다.
3. 저장 동시성·게임 기록·후속 활동 개선은 develop `822b5ac`에 통합했고 177개 테스트·빌드·타입·별도 API 검사를 통과했습니다. 운영 반영은 대기입니다. AI 금액 예산은 최종 통합 검토 중이므로 운영 완료 수치로 발표하지 않습니다.
4. 학생 3명에게 실제 관찰·응답을 받은 뒤 마지막 결과 양식을 채웁니다. 참여하지 않은 학생, 미응답, 미완료를 성공·실패 수치로 임의 보정하지 않습니다.
5. 역할 양식의 기획·프론트·백엔드·디자인·발표·사용자 검증 담당은 현재 모두 미정(제안안)입니다. 실제 배정 후 담당 기능·검증·검토·발표자를 확인합니다.

## 글꼴과 편집

Pretendard와 Menlo를 사용했습니다. 현재 제작 환경에서 두 글꼴을 확인했습니다. 다른 발표 컴퓨터에서 글꼴이 없으면 모양이 달라질 수 있으니 발표 전 열어 확인하세요. 글꼴 라이선스는 기존 `public/fonts`에 있으며 PPTX의 글꼴 포함 여부를 가정하지 않습니다.

## 다시 만들기

`build-deck.mjs`는 앱 실행 의존성을 추가하지 않는 별도 발표 제작 스크립트입니다. Codex의 번들 Artifact Tool 환경에서 아래 비밀값이 아닌 경로 설정을 지정해 실행합니다.

```sh
ARTIFACT_RUNTIME_MODULES=/absolute/path/to/runtime/node_modules \
PRESENTATIONS_SKILL_DIR=/absolute/path/to/presentations/skill \
ARTIFACT_PYTHON=/absolute/path/to/runtime/python3 \
RUNTIME_NODE_MODULES=/absolute/path/to/runtime/node_modules \
/absolute/path/to/runtime/node docs/demo/build-deck.mjs
```

`DEMO_PPTX_NAME`에 새 파일 이름을 지정하면 다음 개정본을 만들 수 있습니다. 기존 최종본을 덮어쓰지 않습니다.

초안과 검증 보고서는 Git에서 제외된 `work/demo-build`에, 최종 PPTX와 검토용 이미지들은 `deliverables/demo`에 생성합니다. 슬라이드 이미지는 실제 앱의 합성 QA 화면만 사용합니다. 외부 이미지나 학생 연락처·코드·개인 응답을 새로 수집하지 않습니다.

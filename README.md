# 상식 퀴즈

한국사·과학·지리·일반상식 4개 카테고리, 40문제를 4지선다로 푸는 웹 퀴즈 게임입니다.
문제마다 바로 정답과 해설을 보여 주고, 점수를 닉네임과 함께 랭킹에 남깁니다.

- 기획 문서: [`docs/prd.md`](docs/prd.md)
- 남은 일과 결정 사항: [`docs/remaining-checklist.txt`](docs/remaining-checklist.txt)
- 문제 교차 검수표: [`docs/question-review.md`](docs/question-review.md)

## 게임 규칙

- **전체 도전**: 40문제를 카테고리 순서대로 풉니다(카테고리 안의 문제와 보기 순서는 무작위). 끝까지 풀어야 랭킹에 기록됩니다.
- **카테고리 연습**: 한 카테고리 10문제만 풉니다. 랭킹에는 기록하지 않습니다. 제한 시간 없이 풀 수도 있습니다.
- 보기를 누르면 바로 답이 확정됩니다. 키보드 1~4로도 고를 수 있습니다.
- 문제마다 15초 제한이 있고, 시간이 지나면 오답입니다.
- 점수는 정답 10점에 빠른 정답 보너스를 더합니다. 남은 시간 3초마다 1점, 최대 5점이라 만점은 600점입니다. 오답은 0점입니다.
- 순위는 점수 → 소요 시간 → 기록 시각 순이며, 닉네임마다 가장 좋은 기록 하나만 보여 줍니다.

## 실행

Node.js 22 이상이 필요합니다.

```bash
npm install
npm run dev        # http://localhost:5173
```

| 명령 | 하는 일 |
| --- | --- |
| `npm run dev` | 개발 서버 |
| `npm run build` | 타입 검사(`tsc -b`) 후 `dist/`로 빌드 |
| `npm run preview` | 빌드 결과를 로컬에서 띄우기 |
| `npm run test` | 단위·화면 테스트(Vitest, jsdom) |
| `npx vitest run src/game/ranking.test.ts -t "점수가 같으면"` | 파일 하나, 테스트 하나만 실행 |
| `npm run test:e2e` | 실제 브라우저 점검(Playwright): 플레이, 접근성(axe, WCAG 2.2 AA), 360px 배치 |
| `npm run lint` | oxlint |

`npm run test:e2e`는 설치된 Google Chrome을 씁니다. Chrome이 없으면 `npx playwright install chromium`으로 내려받은 뒤 `PW_CHANNEL=chromium npm run test:e2e`로 실행하세요. 결과 보고서는 `playwright-report/`에 생깁니다.

## 문제 바꾸기

문제는 [`public/questions.json`](public/questions.json)에 있고, 앱이 시작할 때 이 파일을 불러옵니다. 그래서 배포된 사이트에서도 `dist/questions.json`만 바꾸면 다시 빌드하지 않아도 문제가 바뀝니다.

```json
{
  "id": 1,
  "category": "한국사",
  "content": "훈민정음을 창제한 조선의 왕은?",
  "options": ["세종", "태종", "세조", "성종"],
  "answer": 1,
  "explanation": "세종은 1443년 훈민정음을 창제하고 1446년에 반포했다."
}
```

- `category`는 `한국사`, `과학`, `지리`, `일반상식` 중 하나, `answer`는 정답 보기 번호(1~4)입니다.
- 카테고리마다 10문제 이상 있어야 합니다. 10문제보다 많으면 판마다 무작위로 10문제를 뽑습니다.
- 형식이 틀리면 시작 화면에 몇 번 항목이 왜 틀렸는지 표시되고 게임을 시작할 수 없습니다.
- 예전 판의 답안 기록이 문제 id를 가리키므로, 없앤 문제의 id를 다른 문제에 다시 쓰지 마세요.
- 문제를 고쳤으면 `npm run test`로 형식을 확인하고, 검수표(`docs/question-review.md`)로 두 사람이 교차 검수합니다.

## 저장 데이터

서버 없이 브라우저 `localStorage`에만 저장합니다. 그래서 랭킹과 통계는 브라우저마다 따로입니다.

| 키 | 내용 |
| --- | --- |
| `quiz-game/v2/records` | 끝낸 전체 도전 기록(랭킹) |
| `quiz-game/v2/answer-logs` | 기록별 문제 답안(오답 다시 보기, 점수 검증) |
| `quiz-game/v2/plays` | 시작·종료·다시 하기 기록(완주율, 재도전율, 문제별 정답률) |
| `quiz-game/sound` | 효과음 켜기/끄기 |

랭킹 화면의 "통계 보기"에서 PRD 성공 지표(완주율 70%, 재도전율 30%)와 정답률이 10% 미만이거나 95%를 넘는 문제를 볼 수 있습니다.

## 폴더 구조

```
public/questions.json   문제 은행 (실행 중에 불러옴)
src/game/               게임 규칙 순수 함수: 출제, 채점, 보너스, 순위, 진행 상태, 통계
src/storage/            저장소 인터페이스와 localStorage 구현
src/data/               문제 파일 불러오기와 형식 검사
src/screens/            화면(시작, 퀴즈, 결과, 오답, 랭킹, 통계)
src/components/         공용 화면 조각
src/sound/              효과음(Web Audio 합성)과 설정
e2e/                    Playwright 브라우저 점검
```

게임 규칙은 모두 `src/game`의 순수 함수에 있고, 화면은 그 함수를 부르기만 합니다.

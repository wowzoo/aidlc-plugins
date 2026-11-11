---
name: aidlc-team-doc-plugin
description: "Add one team-format deliverable document (요구사항 명세서, 개발 계획, 테스트 문서, 릴리스 노트 등) to an AI-DLC 2.11.0 plugin as a stage at a phase end — from the team's sample file to a verified install. Analyse the sample into a template, choose phase and scope, write the stage, dry-run it with a fresh subagent until the template stops being ambiguous, install and check it, then loop a GPT reviewer subagent (gpt-5.6-sol) until it grades the work A. Use when the user says \"팀 문서를 plugin 으로\", \"이 양식으로 AI-DLC 가 문서를 쓰게\", \"deliverable-docs 에 문서 추가\", \"샘플 문서로 stage 만들어\", \"릴리스 노트 stage\", \"테스트 문서 plugin\", or hands over a sample document and wants AI-DLC to produce it."
---

# 팀 양식 문서를 AI-DLC plugin stage 로 더하기

**기준: AI-DLC 2.11.0.**

이 skill 은 팀 문서 **하나**를 `deliverable-docs` 같은 문서 plugin 에 stage 로 더합니다.
샘플 분석부터 설치 확인까지 하고, 끝으로 GPT 검토자가 A 를 줄 때까지 반복합니다.

**같이 쓰는 파일 (이 skill 폴더 안):**

| 파일 | 무엇 |
|---|---|
| `references/pitfalls.md` | 조용히 실패하는 함정. 단계마다 해당 항목을 확인합니다 |
| `references/prompts.md` | dry run 과 검토에 그대로 쓸 지시문 |
| `references/review-log.md` | 검토 기록 형식 |
| `scripts/install-check.sh` | 검사 → 시험 → 빌드 → 설치 → 확인을 한 번에 하는 스크립트 |
| `agents/plugin-doc-reviewer.md` · `agents/plugin-doc-dryrun.md` | 아래 subagent 의 원본. 0단계에서 `.kiro/agents/` 로 복사합니다 |

**같이 쓰는 subagent:**

| agent | 모델 | 도구 | 역할 |
|---|---|---|---|
| `plugin-doc-reviewer` | `gpt-5.6-sol` | 읽기만 | 엔지니어링 검토와 편집장 검토 |
| `plugin-doc-dryrun` | 기본 | 읽기 · 쓰기 · shell | 설치 전에 stage 를 흉내 내는 시험 |

이름에 `aidlc` 를 붙이지 않은 데는 이유가 있습니다. AI-DLC 의 Kiro hook 은 `.kiro/agents/aidlc*.md` 를 보호 경로로 보고 AI 의 쓰기를 막습니다.

방법을 더 자세히 설명한 문서가 있으면 그것도 읽습니다(0단계 6번: 인계 묶음의 `GUIDE.md`). 이 skill 과 다른 말을 하면, 설치된 엔진 파일을 직접 열어 확인한 쪽을 따릅니다.

**Kiro 에서 실행할 때** (2026-10-14, Kiro CLI 2.30 에서 확인. 2.31.0 에서 0–7단계를 한 대화로 끝까지 실행)

- **agent 파일:**
  - Kiro IDE 는 `.md` 를, Kiro CLI 는 `.json` 을 읽습니다. 둘 다 복사합니다.
  - `.json` 의 `prompt: file://<같은 이름>.md` 가 `.md` 본문을 씁니다. AI-DLC 자신의 Kiro CLI agent 와 같은 방식입니다.
- **도구 승인:**
  - subagent 가 파일을 쓰거나 셸을 실행하면 Kiro 가 승인을 묻습니다. 대화형으로 쓰고 사람이 승인합니다.
  - 비대화형(`kiro-cli chat --no-interactive`)에서는 승인을 받을 수 없어 쓰기 · 셸이 거부됩니다.
- **기본 agent:** AI-DLC 가 설치된 Kiro CLI 프로젝트의 기본 agent 는 지휘 agent `aidlc` 입니다. 이 skill 도 그 agent 위에서 돕니다.
  - 그 agent 는 `rm -r` 을 승인 없이 거부합니다. 작업 폴더는 지우지 말고 번호를 올려 새로 만듭니다(`references/pitfalls.md` 셸).
- **검토자:**
  - `plugin-doc-reviewer` 에는 쓰기 도구가 없습니다. 쓰라고 시켜도 거절하는 것을 확인했습니다.
  - `kiro-cli agent validate --path <json>` 은 잘못된 설정에도 exit 0 이므로, 출력에 `Error` 가 없는지로 판단합니다.

---

## 규칙 — 모든 단계에 적용

1. **엔진에 대한 주장은 설치본에서 확인합니다.** 근거는 `<PROJECT>/<LEAF>/` 의 파일과 줄 번호입니다(`LEAF` 는 0단계에서 정함). 기억이나 다른 버전의 엔진 소스로 판단하지 않습니다.
2. **판단은 exit code 가 아니라 결과물로 합니다.** compose 는 성공해도 실패해도 아무것도 출력하지 않습니다.
3. **검토자의 지적은 반영하기 전에 원문을 열어 확인합니다.** 틀렸으면 반영하지 않고, 근거를 붙여 다음 회차에 다시 판정을 요구합니다.
4. **분기 규칙 하나를 고치면 같은 상태의 이웃 분기도 함께 봅니다.** 하나를 고쳐서 옆이 깨지는 일이 가장 흔했습니다.
5. **사람만 할 수 있는 일은 AI 가 하지 않습니다.** 예를 들어 `.kiro/agents/aidlc*` 편집은 Kiro hook 이 막습니다. 내용을 보여 주고 사람에게 맡깁니다.

---

## 0단계 — 준비

1. **버전:** `aidlc --version` 을 실행합니다.
   - 2.11.x 가 아니면 사용자에게 알립니다. 그리고 `references/pitfalls.md` 의 수치(stage 번호, scope 목록, 파일 줄 번호)를 그 버전에서 다시 확인한다고 밝힙니다.
2. **경로 넷과 harness 를 사용자와 정합니다.** 모두 `/` 로 시작하는 절대 경로로 씁니다. `.` · `..` 성분과 루트 `/` 자체는 쓰지 않습니다(스크립트가 거부합니다).
   - `SRC`: 문서 plugin 의 원본 폴더(예: `.../deliverable-docs`)
   - `PROJECT`: AI-DLC 가 설치된 프로젝트
   - `CLEAN`: 같은 버전의 **plugin 없는** 새 설치본(시험용). 없으면 5단계 스크립트가 만듭니다
   - `DIST`: 빌드 결과를 보관할 곳
   - `CLEAN` · `DIST` · `PROJECT` 는 **서로 겹치지 않는 별도 폴더**로 둡니다. 어느 쪽도 다른 쪽을 안에 품으면 안 됩니다.
     - 스크립트가 심볼릭 링크를 풀어 확인하고, 겹치면 거부합니다.
     - 실패한 실행이 PROJECT 를 건드리지 않게 하려는 것입니다. builder 는 자기 출력 폴더를 통째로 지우고 다시 만들기 때문에, 그 안에 PROJECT 가 있으면 함께 지워집니다.
   - 같은 이유로 `SRC` 와 빌드 출력 폴더(`$DIST/<plugin>/<harness>`)도 서로 겹치지 않게 둡니다. `DIST` 를 plugin 원본 안이나 그 바로 위에 두지 않습니다. 스크립트가 확인합니다.
   - `LEAF`: 그 프로젝트에 있는 harness 폴더. `.kiro` 또는 `.claude` 입니다.
   - `H`: 그 설치본이 기록한 harness 이름. `<PROJECT>/<LEAF>/tools/data/harness.json` 의 `name` 입니다(예: `kiro-ide`, `kiro`, `claude`).
     - Kiro 라고 해서 `kiro-ide` 로 짐작하지 않습니다. `kiro` 와 `kiro-ide` 는 다른 harness 입니다.
     - 5단계 스크립트는 `H` 를 주지 않으면 이 값을 스스로 읽습니다.
3. **subagent 설치:** 작업할 workspace 의 `.kiro/agents/` 에 `plugin-doc-reviewer.md` · `plugin-doc-dryrun.md` 가 없으면 이 skill 의 `agents/` 에서 복사합니다.
   - 내용이 다르면 차이를 보여 주고 사람에게 묻습니다.
   - 복사한 뒤 Kiro IDE 는 `Developer: Reload Window`, Kiro CLI 는 재시작해야 agent 가 보일 수 있습니다.
4. **검토자 모델:** `kiro-cli chat --list-models` 에 `gpt-5.6-sol` 이 있는지 봅니다.
   - 없으면 목록에 있는 가장 새 `gpt-*-sol` 을 사용자에게 제안합니다.
   - 사용자가 동의하면 workspace 에 복사한 **두 파일을 함께** 바꿉니다: `.kiro/agents/plugin-doc-reviewer.md` 의 `model:` 과 `.kiro/agents/plugin-doc-reviewer.json` 의 `"model"`.
     Kiro IDE 는 `.md` 를, Kiro CLI 는 `.json` 을 읽기 때문입니다.
5. **샘플:** 사용자에게 샘플 문서를 받습니다.
   - 한두 건뿐이면 같은 문서의 샘플을 두세 건 더 받을 수 있는지 묻습니다. 샘플이 얇으면 규칙이 짐작이 됩니다.
   - 샘플이 PDF · xlsx 면 텍스트로 뽑아 봅니다(`pdftotext -layout`, xlsx 는 시트별로 셀을 읽음).
6. **GUIDE:** `SRC` 의 부모 폴더에 `GUIDE.md` 가 있는지 봅니다(인계 묶음이면 `<SRC>/../GUIDE.md`).
   - 있으면 읽습니다. 특히 6장 "맵핑 표의 나머지 항목" 에 만들 문서의 항목이 있으면, 그 phase · 입력 · 주의할 점을 1·2단계의 출발점으로 씁니다.
   - 샘플과 요청한 문서 이름이 달라 보여도(예: 요청은 "배포 계획서", 샘플은 릴리스 노트) 6장이 그 짝을 설명하는지 먼저 봅니다.

## 1단계 — 샘플을 템플릿으로 (`knowledge/<writer-agent>/<문서>-template.md`)

이 템플릿이 그 문서의 **단일 정본**입니다. stage 는 언제 · 무엇을 읽는지만 정하고, 양식과 규칙은 여기에만 둡니다.

1. **뼈대 적기.** 시트 · 절마다 무엇이 있고, 템플릿에서 어느 절이 되는지 표로 적습니다. 빼는 것과 다른 문서로 넘기는 것도 이유와 함께 적습니다.
   - 🧑 **사람에게 확인받습니다:** 이 표와, 빼거나 다른 문서로 넘길 절. 확정되기 전에는 2번으로 넘어가지 않습니다.
2. **규칙 재기.** ID 형식, 우선순위 표기, 카테고리 어휘처럼 반복되는 값은 샘플에서 **실제로 세어** 규칙으로 옮깁니다. 표기가 흔들리면 하나로 고정합니다.
3. **일반화.** 제품명 · 제품 코드 · 담당자 · 사내 시스템 이름은 자리표시로 바꿉니다.
   - 템플릿 안의 예시(`예: …`)와 규칙 설명에도 샘플의 실제 값을 쓰지 않습니다. 가상의 값으로 바꿉니다. 예시 결과물과 시험 record 도 같습니다.
4. **입력 → 절 대응표.** 절마다 어느 AI-DLC 산출물에서 오는지 적습니다. 대응할 산출물이 없는 절은 이때 드러납니다.
5. **빈칸 규칙 — 가장 중요합니다.** 입력이 말하지 않을 때 칸에 무엇을 쓰고, 어디(미결 사항)에 올리는지 정합니다. 이 규칙이 없으면 AI 가 그럴듯한 값을 채웁니다.
6. **문서 언어를 템플릿에 적습니다.** 샘플이 영어면 팀이 어느 언어를 원하는지 먼저 묻습니다.
7. **예시 결과물을 손으로 하나 씁니다** (`tests/fixtures/<문서>.sample.md`). HTML 도구가 있으면 변환해 브라우저로 봅니다.

## 2단계 — phase · scope · 입력 정하기

`references/pitfalls.md` 의 "배치" 절을 먼저 읽습니다.

1. 템플릿의 각 절에 필요한 core 산출물을 정합니다.
2. **그 산출물을 만드는 stage 파일을 엽니다**(`<PROJECT>/<LEAF>/aidlc-common/stages/<phase>/<stage>.md`). 네 가지를 확인합니다.
   - `scopes:` — 어느 scope 에서 도는가
   - `condition:` 과 **본문 Step 1** — 언제 건너뛰는가. 건너뛰기 조건은 본문에만 있는 경우가 있습니다
   - `outputs:` — 실제 파일 이름. 산출물 이름과 다를 수 있습니다
   - `for_each:` — construction 의 unit 별 산출물인가
3. **phase 는 필요한 산출물이 모두 나온 phase 의 끝으로 정합니다.** plugin stage 는 phase 끝에만 붙습니다.
4. **scope 는 그 문서가 의미 있고 입력이 생기는 scope 만 적습니다.** 빠뜨리면 어디서도 실행되지 않습니다.
5. 🧑 **사람에게 승인받습니다.** 제안할 내용은 넷입니다.
   - phase
   - scope 목록
   - 주 입력
   - 주 입력이 없을 때의 처리(멈춤, 또는 3단계 3번의 `consumes_absent` 분기)
   승인 전에는 3단계로 넘어가지 않습니다. 도구 사용 승인(파일 쓰기 승인)은 이 결정의 승인을 대신하지 않습니다.

## 3단계 — 파일 쓰기

예제 stage(예: `stages/inception/<plugin>-requirements-spec.md`)를 복사해 시작합니다.

**1. 머리말** — 아래 필드를 새 문서에 맞게 바꿉니다.

- `slug`, `name`, `phase`, `condition`, `produces`, `consumes`, `requires_stage`, `scopes`, `inputs`, `outputs`
- `slug` 와 `produces` 는 `<plugin 이름>-` 으로 시작합니다.
- `consumes` 는 `required: false` 로 둡니다. 단, 주 입력을 만드는 stage 가 `CONDITIONAL` 이면 **그 주 입력만** `required: true` 로 둡니다(3번).
- `name` 은 영어로 쓰고, 팀이 부르는 이름을 괄호에 둡니다.

**2. 본문의 Step 마다**

| Step | 바꿀 것 |
|---|---|
| 1 입력 읽기 | 주 입력과, 그것이 없을 때의 처리(아래) |
| 2 선행 결정 | ID 처럼 문서 전체를 묶는 결정. 없으면 Step 을 지웁니다 |
| 3 작성 | 템플릿 이름 |
| 4 HTML 변환 | 도구는 그대로, 입력 md 경로만 바꿉니다. 두 경로 모두 따옴표로 묶습니다 |
| 5 Completion Handoff | `aidlc engine orchestrate report --stage <slug> --result <outcome>` 의 slug |
| 6 승인 | 검토자가 먼저 볼 숫자 |

**3. 주 입력이 없을 때**

- 주 입력을 만드는 stage 가 `execution: ALWAYS` 면 입력이 없는 것은 이상한 상황입니다. 사용자에게 알리고 멈춥니다.
- `CONDITIONAL` 이라 건너뛰어졌을 수 있으면, 없다는 것만으로는 정상 건너뛰기인지 실제 누락인지 모릅니다. 그래서 주 입력을 `required: true` 로 두고 Step 1 에서 `directive.consumes_absent` 의 그 항목으로 나눕니다.
  - `expected: true` (만드는 stage 가 그 scope 에 없거나 조건으로 건너뛰어짐): 문서를 쓰지 않고 이 stage 도 건너뜁니다.
    `aidlc engine orchestrate report --stage <slug> --result skipped --reason "<무엇이 없어서>"`
  - `expected: false` (만드는 stage 가 scope 경로에 있는데, 조건부 건너뛰기 기록으로 설명되지 않는 누락. 아직 돌지 않음 · forward jump 로 `[S]` · 파일 유실을 모두 포함): 실제 누락입니다. 건너뛰지 않고 `stage-protocol-recovery.md` 의 Missing artifact recovery 를 따릅니다.
  - 단독 실행(`directive.single`)에서는 `skipped` 를 쓸 수 없습니다. 문서를 쓰지 않고 이유를 알린 뒤 멈춥니다. 다른 stage 를 돌리러 가지 않습니다.
  - 근거: `<LEAF>/tools/aidlc-directive.ts` 의 `consumes_absent` 설명, `<LEAF>/skills/aidlc/SKILL.md` 의 Conditional inapplicability. 예: `deliverable-docs` 의 배포 계획서 stage.
- 보조 입력은 scope 마다 없을 수 있습니다. 입력마다 없을 때 무엇으로 대신하는지 Step 1 과 템플릿의 「입력 → 절 대응」 에 한 줄씩 적습니다.

**4. manifest 와 설명** — `version` 을 올리고, manifest 의 `description`, plugin `README.md`, `tests/README.md` 에 새 문서를 더합니다.

**5. 쓰지 말 것**

- `{{INVOKE}}` 를 쓰지 않습니다. plugin 설치 때 치환되지 않아 글자 그대로 남습니다.
- 양식 규칙을 stage 본문에 다시 쓰지 않습니다. "템플릿을 따르라" 고만 씁니다.

## 4단계 — dry run (설치 전)

1. **시험 record 만들기.** `tests/fixtures/<문서>-record/` 에 가짜 산출물을 `<phase>/<stage>/<artifact>.md` 경로로 둡니다.
   - **일부러 빈칸과 모순을 넣습니다.** 예: 우선순위가 없는 항목, 서로 다른 말을 하는 두 산출물, 없는 입력.
2. **실행.** `plugin-doc-dryrun` subagent 를 부르고, 지시문은 `references/prompts.md` 의 "dry run" 을 그대로 씁니다.
   - 새 subagent 라 템플릿을 쓴 맥락이 없습니다. 그래서 빈칸을 봅니다.
3. **보고 고치기.**
   - 양식과 값의 규칙이 애매하면 **템플릿**을 고칩니다.
   - 입력 경로 · 읽는 순서 · 도구 호출이 틀렸으면 **stage** 를 고칩니다.
4. **반복.** 새로 나오는 애매함이 "더 자세히 쓸 수도 있다" 수준뿐일 때까지 돌립니다.
   - 규칙을 더할 때는 기존 규칙과 같은 경우를 다루는지 먼저 봅니다. 규칙끼리 충돌한 일이 실제로 있었습니다.

## 5단계 — 설치와 확인

```bash
SRC="..." PROJECT="..." CLEAN="..." DIST="..." \
SLUG="<새 stage 의 slug>" SCOPE="<2단계에서 승인한 scope 하나>" LEAF="<0단계의 LEAF>" H="<0단계의 H>" \
  bash "<이 skill 폴더>/scripts/install-check.sh"
```

- 0단계에서 정한 `LEAF` 와 `H` 를 **항상** 넘깁니다.
  - 넘기지 않으면 스크립트가 AI-DLC 설치 표식(`<LEAF>/tools/data/harness.json`)이 있는 폴더를 찾습니다.
  - 이 skill 을 Claude 프로젝트에 깔면 `.kiro/` 도 생기므로, 명시하는 편이 확실합니다.
- `SCOPE` 를 빼면 `feature` 로 봅니다. 승인한 scope 가 여럿이면 하나씩 바꿔 다시 실행합니다.

- **실행 대상:** 스크립트는 상속된 `AIDLC_*` · `KIRO_*` 환경 변수를 모두 지우고, 필요한 것만 `PROJECT` 와 0단계의 harness 로 다시 지정합니다. 그래서 다른 프로젝트용으로 설정된 셸에서 실행해도 대상이 바뀌지 않습니다.
- **실패하면:**
  - 검사 · 시험 · 빌드에서 실패하면 sync 전에 멈추고, PROJECT 는 바뀌지 않습니다. 빌드 출력 경로(`$DIST/<plugin>/<H>`)와 PROJECT 가 어느 방향으로든 겹치면(링크 포함) 빌드 전에 거부합니다.
  - sync 가 실패하면 그 자리에서 멈춥니다. sync 는 임시 복사본에서 compose 한 뒤 성공해야 PROJECT 에 반영하므로, 보통 이전 상태가 그대로 남습니다.
  - sync 뒤의 확인(drops · doctor · graph)에서 실패하면 plugin 은 **이미 PROJECT 에 설치된 상태**입니다. 고쳐서 다시 실행하면 sync 가 그 자리에서 업그레이드합니다.

**합격 기준** — 스크립트 출력에서 아래를 모두 확인합니다.

- validate `VALID`
- test `CLEAN`
- sync 완료
- `*.drops` 0개
- doctor `0 problems`
- 새 stage(`SLUG`)가 `SCOPE` 의 순서에 있고, 같은 phase 의 core stage 가 그 뒤에 없음(스크립트가 판정)
- 다른 scope 에서도 확인하려면 `SCOPE=` 를 바꿔 다시 실행합니다

**doctor 경고** — warning 은 설치 전과 비교합니다.

- 새 2.11.0 설치본은 plugin 이 없어도 warning 이 둘 있습니다.
- stage 를 더한 직후의 `skills/aidlc/SKILL.md` 변경 경고는 정상입니다.

**무엇이든 고쳤다면 5단계를 다시 합니다.** 설치본은 원본을 고쳐도 저절로 바뀌지 않습니다.

## 6단계 — 검토 반복 (`plugin-doc-reviewer`, gpt-5.6-sol)

1. **1회차 — 엔지니어링 검토.** `references/prompts.md` 의 "엔지니어링 검토" 를 씁니다. 바뀐 plugin 파일과 문서의 주장이 설치본과 맞는지 봅니다.
2. **2회차부터 — 편집장 검토.** `references/prompts.md` 의 "편집장 검토" 를 씁니다.
   - **범위는 새 stage 와 템플릿, 바뀐 문서, 그리고 그것들이 참조하는 plugin 지시문 전체입니다.** 문서만 보게 하면 A 가 빨리 나오지만 실제 동작 결함을 놓칩니다.
3. **회차마다 같은 순서로 처리합니다.**
   1. 지적을 하나씩 설치본 원문으로 확인합니다. 결과는 맞음 / 틀림 / 부분적으로 맞음 중 하나입니다.
   2. 맞는 것만 고칩니다. 틀린 것은 근거(파일:줄)를 붙여 다음 회차 지시문의 "재판정 요구" 에 넣습니다.
   3. 고친 뒤 5단계를 다시 하고, 바뀐 명령 블록은 문서에서 그대로 뽑아 공백이 든 경로로 bash 에서 실행합니다.
   4. `references/review-log.md` 형식으로 기록합니다.
4. **A 가 나오면 멈춥니다.**
   - 남은 지적이 "더 자세히 쓸 수도 있다" 수준뿐이면 A 입니다. 그 기준을 지시문이 검토자에게 줍니다.
   - 같은 종류의 지적이 계속 나오면 그 종류 전체를 한 번에 훑어 고칩니다.

## 7단계 — 마무리

사용자에게 다음을 보고합니다.

- 만든 파일 목록
- 5단계 결과
- dry run 과 검토의 회차별 요약
- 검증하지 못한 것. 특히 실제 intent 를 돌려 이 stage 가 게이트까지 가는지는 이 skill 이 확인하지 않습니다.

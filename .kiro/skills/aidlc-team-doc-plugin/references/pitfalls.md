# 함정 — AI-DLC 2.11.0 에서 실제로 걸린 것

각 항목은 설치된 2.11.0 트리에서 확인한 것입니다. 다른 버전에서는 **근거 파일을 다시 열어** 확인합니다.
`<H>` 는 `.kiro` 또는 `.claude` 입니다.

## 배치

- **plugin stage 는 phase 맨 끝에만 붙습니다.**
  - 번호는 엔진이 그 phase 의 마지막 번호 다음을 줍니다. core stage 사이에는 끼울 수 없습니다.
- **같은 phase 에 문서를 둘 이상 붙일 때**
  - 둘 사이 순서는 `requires_stage` 로 정합니다.
  - 이 순서는 **새로 번호를 받는 stage** 사이에서만 정해집니다. 이미 설치된 stage 는 번호를 유지하므로, 나중에 `requires_stage` 를 바꿔도 다시 정렬되지 않습니다.
  - `requires_stage` 에 어떤 scope 에서 돌지 않는 stage 를 적어도 괜찮습니다.
- **scope**
  - `scopes:` 를 빠뜨리면 어느 scope 에서도 실행되지 않고, 오류도 나지 않습니다.
  - operation 은 mvp · classic · poc 에서 돌지 않습니다.
  - ideation 은 enterprise · feature · mvp · poc 에서만 돕니다.
  - stories · units 는 enterprise · feature · mvp · classic · workshop 에서만 나옵니다.
- **construction 산출물**
  - unit 마다 `<record>/construction/<unit>/<stage>/` 에 있습니다.
  - unit 이 없는 scope(express)에서는 `<record>/construction/<stage>/` 에 있습니다. 둘 다 읽게 씁니다.
- **산출물 이름과 파일 이름**
  - 다를 수 있습니다. 예: build-and-test 의 `build-test-results` 는 `test-results.md` 입니다. 만드는 stage 의 `outputs:` 를 봅니다.
- **건너뛰기 조건이 본문에만 있는 경우**
  - 예: deployment-pipeline 은 기존 파이프라인이 충분하면 건너뜁니다. 그러면 `cd-config` · `deployment-strategy` 가 없습니다.

## stage 파일

- **자리표시**
  - 설치 때 치환되는 것은 `{{HARNESS_DIR}}` 하나뿐입니다(`.md` 파일 한정).
  - `{{INVOKE}}` 는 core 배포본을 만들 때만 치환됩니다. plugin 에 쓰면 글자 그대로 남습니다. 엔진 명령은 `aidlc engine …` 으로 씁니다.
- **필수 산출물 — `produces` 는 모두 필수 출력입니다.**
  - 근거: reviewer 가 있는 stage 는 필수 출력이 하나라도 없으면 검토를 거부합니다(`<H>/tools/aidlc-lib.ts` 의 `reviewArtifactEntries`).
  - 그래서 "경우에 따라 만들지 않는" 산출물이 필요하면, 그 경우에도 파일을 쓰고 안에 "없음" 과 사유를 적습니다.
- **mode** — `mode: inline` 으로 두고 `reviewer` 는 쓰지 않습니다. 다른 mode 는 Kiro 에서 별도 agent 설정이 있어야 설치됩니다.
- **명령의 따옴표**
  - 본문의 명령은 경로를 따옴표로 묶습니다: `bun "{{HARNESS_DIR}}/tools/x.ts" "<경로>"`.
  - 지휘 agent 가 채우는 경로에 공백이 있을 수 있습니다.
- **주 입력이 없을 때 — 멈출지, 건너뛸지.**
  - 그 입력의 stage 가 `CONDITIONAL` 이면 그 입력만 `required: true` 로 둡니다.
    - 엔진은 없는 `required: true` 입력을 `directive.consumes_absent` 에 넣고 `expected` 를 붙입니다. `required: false` 입력은 없어도 여기 나오지 않아, 건너뛰기와 누락을 구별할 수 없습니다(`<H>/tools/aidlc-directive.ts` 의 `consumes_absent` 설명).
    - 이 표시는 실행을 막지 않습니다(`<H>/tools/aidlc-orchestrate.ts` 가 directive 에 붙이기만 함).
  - `expected: true`(만드는 stage 가 그 scope 경로에 없거나, 경로 위의 만드는 stage 가 모두 조건부로 건너뛰어졌다고 기록됨)면 `aidlc engine orchestrate report --stage <slug> --result skipped --reason "…"`.
  - `expected: false`(그 밖의 모든 누락: 아직 돌지 않음, forward jump 로 `[S]`, 파일 유실)면 건너뛰지 않고 `stage-protocol-recovery.md` 의 Missing artifact recovery. 계산은 `<H>/tools/aidlc-orchestrate.ts` 의 `splitConsumesByPresence`.
  - 단독 실행(`directive.single`)은 `skipped` 를 쓸 수 없습니다(`<H>/skills/aidlc/SKILL.md` 의 Conditional inapplicability). 이유를 알리고 멈춥니다.
  - 근거: `<H>/aidlc-common/protocols/stage-protocol.md` 의 skipped 규칙.
- **scope 마다 없는 보조 입력** — 예: `intent-statement` 는 enterprise · feature · mvp · poc 에만 있습니다(intent-capture 의 `scopes:`). 그래서 operation 이 도는 8개 scope 중에는 enterprise · feature 에만 있습니다. `code-summary` · `build-and-test-summary` 는 infra 에 없습니다. 만드는 stage 의 `scopes:` 로 확인하고 `required: false` 로 둡니다.
- **절 구조 검사(`required-sections` sensor)는 느슨합니다.**
  - 템플릿이 없으면 `##` 절이 두 개 이상인지만 보고, 기본 심각도는 advisory 라 게이트를 막지 않습니다.
  - space 에 템플릿 골격을 두면(`aidlc/spaces/<space>/memory/templates/<artifact>.md`) 그 `##` 제목이 모두 있는지 봅니다. 순서와 추가 제목은 보지 않습니다.
  - **`##` 절이 하나뿐인 작은 산출물**(포인터 등)은 이 검사에 걸립니다.
- **기존 파일 재사용**
  - 재실행에서 같은 이름의 화면 · 절 · 파일을 하나 더 만들지 않고 그 자리에서 고치게 씁니다.
  - 재사용 조건에는 형식이 같은지, 지금 쓸 수 있는지를 함께 둡니다.
- **경로 기준**
  - 다른 stage 가 읽을 경로는 프로젝트 루트 기준으로 씁니다. record 디렉터리 기준 경로는 읽는 쪽에서 틀어집니다.

## 시험 · 설치

- **`aidlc-plugin-test` 는 plugin 이 없는 새 설치본(`CLEAN`)에 대고 돌립니다.**
  - 이미 설치된 프로젝트에 대고 돌리면, 고친 판이 설치된 파일과 부딪혀 `collides … not overwritten` 으로 FAILED 가 납니다.
  - 업그레이드는 `aidlc engine plugin sync` 가 제대로 합니다.
- **build** — 같은 plugin · harness 로 만든 유효한 출력이면 지우고 다시 만듭니다. 소유 표식이 없거나 다른 plugin 의 출력이 있는 디렉터리는 거부합니다.
- **sync 와 직접 compose 는 환경 변수 우선순위가 다릅니다.**
  - sync 는 `AIDLC_PROJECT_DIR` 를 우선하고, compose 를 부를 때 `CLAUDE_PROJECT_DIR` 도 같은 값으로 맞춥니다.
  - `hooks/compose.ts` 를 직접 실행하면 `CLAUDE_PROJECT_DIR` 가 우선하고, 기본 harness 는 `.claude` 입니다. 세 변수를 모두 줍니다.
- **compose 는 성공해도 실패해도 아무것도 출력하지 않습니다.**
  - 판단 기준은 `find "$PROJECT" -name '*.drops'` 가 비었는지, doctor, `aidlc engine graph scope <scope>` 입니다.
- **설치 직후 doctor**
  - stage 를 더하면 `skills/aidlc/SKILL.md` 변경 경고가 납니다. `aidlc config` 는 멈추지 않고, 실행한 뒤에는 경고가 사라집니다.
- **Claude Code 에 직접 sync 한 경우**
  - 설치 목록을 읽을 수 있으면 doctor 가 `installed-missing` 경고를 냅니다. 경고라서 problems 에는 들어가지 않습니다.
  - 그 상태에서 `--prune-missing` 을 실행하면 plugin 이 지워집니다.
- **설치하면 stage 마다 `<H>/skills/<slug>/SKILL.md`(실행용 skill)가 생깁니다.**

## 셸

- 경로는 절대 경로로 정하고, **대입과 사용 모두** 따옴표로 묶습니다: `SRC="/a b/c"`, `bun "$T/x.ts" "$SRC"`.
  - zsh 는 따옴표가 없어도 단어를 가르지 않아 이 문제가 안 보입니다. **bash 로** 확인합니다.
- `rm -rf` 는 변수가 비면 멈추게 씁니다: `rm -rf "${DIST:?}/${H:?}"`.
- **Kiro CLI 의 지휘 agent `aidlc` 는 `rm -r` · `rm --recursive` 를 거부합니다**(`.kiro/agents/aidlc.json` 의 `deniedCommands`). 그 agent 위에서 도는 이 skill 도 같습니다.
  - dry run 작업 폴더는 지우지 말고 번호를 올려 새로 만듭니다(예: `/tmp/<문서> dry run 1`, `… 2`).
  - 지워야 하는 폴더가 생기면 사람에게 맡깁니다. 우회하는 명령을 만들지 않습니다.
- **문서의 명령 블록은 문서 파일에서 그대로 뽑아 실행해 봅니다.** 손으로 옮겨 치면 문서와 다른 것을 시험하게 됩니다.

## Kiro

- **AI 가 고칠 수 없는 파일** — `.kiro/agents/aidlc*.md|json`, `.kiro/hooks/`, `.kiro/tools/aidlc*` 는 Kiro hook 이 agent 의 쓰기를 무조건 거부합니다. 바꿔야 하면 사람이 에디터에서 고칩니다.
- **MCP 허용** — 2.11.0 Kiro 지휘 agent 에는 MCP 허용이 없습니다. inline stage 에서 MCP 도구를 쓰려면 사람이 `tools` 에 `"@<server>"` 와 `includeMcpJson: true` 를 더해야 합니다.
- **effort** — subagent 의 effort 는 머리말로 정하는 필드가 문서에 없습니다. 모델만 `model:` 로 정합니다.

# AI-DLC v2 plugin 메커니즘 — 코드로 확인한 참조서

이 워크스페이스에서 plugin 을 만들고 고칠 때 보는 참조서입니다. 공식 문서 두 개
(`docs/reference/18-plugin-mechanism.md`, `docs/harness-engineering/10-authoring-a-plugin.md`)를
출발점으로 삼고, **모든 주장을 엔진 코드와 대조해 확인했습니다.** 문서와 코드가 다르면
코드를 따랐고, 차이는 §9 에 모았습니다.

## 0. 기준과 표기

| 항목 | 값 |
|---|---|
| 엔진 저장소 | upstream `awslabs/aidlc-workflows`. 확인은 `git archive v2.11.3` 으로 푼 사본에서 했습니다. 로컬 체크아웃은 release 에 맞춰 두지 않으므로 그 HEAD 를 기준으로 삼지 마세요 |
| 읽은 commit | `a8721be36` (`v2.11.3`, 2026-11-04) |
| upstream 대조 | 하지 않음 (2026-11-06 재검증은 v2.11.3 태그 기준) |
| 최근 릴리스 | `v2.11.3` |
| 인용 표기 | `file:line` 은 엔진 저장소 루트 기준입니다. 줄 번호는 위 commit 기준이라 시간이 지나면 어긋납니다 |

2026-11-06 에 v2.11.3 으로 다시 확인했습니다. 처음 판은 `14f17af8d` (v2.10.1-preview, 2026-09-25) 기준이었습니다.

- **⚠️ 추론** 이라고 붙인 항목은 코드를 읽고 추론한 것이며, 실행해서 확인하지 않았습니다.
- **Kiro 메모:** `kiro-ide` projection 은 **Kiro IDE 1.x 와 Kiro CLI v3** 를 함께 맡습니다(unified agent harness, `docs/reference/18-plugin-mechanism.md:595`). `kiro` projection 에는 hook 등록이 없습니다(`core/tools/aidlc-plugin-emit.ts:658`).

주요 코드 위치:

| 역할 | 파일 |
|---|---|
| compose hook 템플릿 (3233줄. 정적 import 는 node 내장 모듈뿐이고, 실행 중에 설치본 `tools/aidlc-{command,lib,stage-schema}.ts` 를 동적 import) | `scripts/plugin-hooks-template/compose.ts` |
| Cursor / Kiro IDE 용 Bun launcher (115줄) | `scripts/plugin-hooks-template/aidlc-plugin-compose.ts` |
| 저작 도구 | `core/tools/aidlc-plugin-{create,validate,build,emit,test}.ts` |
| 설치 측 list / sync (composition stamp 기록, base 계층 판정) | `core/tools/aidlc-plugin.ts` |
| select-plugins, plugin-sync(비 transaction), doctor 행 | `core/tools/aidlc-utility.ts` |
| stage schema · graph compile | `core/tools/aidlc-stage-schema.ts` · `core/tools/aidlc-graph.ts` |
| 참조 plugin | `plugins/test-pro/` |

---

## 1. 전체 흐름

```
저작 원본 (.aidlc-plugin/plugin.json + stages/ contributions/ …)
   │ ① validate — 오프라인. 도구 묶음에 실린 core stage/agent 목록·compose 템플릿과 대조
   │              (base plugin 이 있으면 --with <base checkout> 으로 그 agent·stage 도 대조)
   │ ② build    — harness 하나당 projection 하나
   │              (host manifest + .aidlc-plugin/plugin.json 사본 + projection marker
   │               + 제3자 build 는 marketplace.json + hooks/compose.ts 주입)
   ▼
projection (dist/<harness>/)  ← 이것이 "설치되는 plugin"
   │ ③ install  — Claude/Codex: marketplace · Kiro: folder-drop (<harness>/aidlc-plugins/<name>/)
   ▼
compose (SessionStart hook, `aidlc engine plugin sync`, 또는 bun hooks/compose.ts)
   │  base 계층 순서 → 새 primitive 복사 → contribution 병합 → graph compile → runner/SKILL 표 갱신
   ▼
select (harness.json `plugins`) → doctor (Composed plugin surface, hook drops, <plugin>-doctor.ts)
```

- 원칙은 네 가지입니다. **추가만 하고 덮어쓰지 않습니다. core 를 수정하지 않습니다. 끄면 흔적이 없습니다. stage 의 정체성은 slug 입니다.**
- **저작 원본은 그대로 compose 할 수 없습니다.**
  - 두 sync 경로 모두 host manifest(`.claude-plugin/` 등)와 `hooks/compose.ts` 가 있어야 합니다(`core/tools/aidlc-plugin.ts:243-250, 301-311, 1254-1262`, `core/tools/aidlc-utility.ts:1686-1697`).
  - `.aidlc-plugin/plugin.json` 은 이제 projection 에 함께 실려 plugin key 와 base 를 읽는 데 쓰입니다(`aidlc-plugin.ts:256-274, 350-361`). 하지만 host manifest 를 대신하지는 못합니다.
  - 그래서 반드시 build 를 먼저 합니다. `aidlc-plugin-test.ts` 는 내부에서 직접 build 합니다. `--with` 로 base checkout 을 주면 base 도 함께 build 합니다(`core/tools/aidlc-plugin-test.ts:612-627`).

---

## 2. 저장소 구조와 manifest

```
<name>/                              # 디렉터리 이름 == manifest name (validator 가 검사)
  .aidlc-plugin/plugin.json
  stages/<phase>/<plugin>-<x>.md     # 새 stage
  contributions/<phase>/<core-slug>.md   # core stage 에 추가 (§4)
  contributions/agents/<core-agent>.md   # core persona 에 fragment 추가 (adds: 금지)
  agents/<plugin>-<role>-agent.md
  scopes/<plugin>-<name>.md
  knowledge/<agent-slug>/…           # agent 방법론 지식
  sensors/aidlc-<id>.md              # 최상위, 이 이름 형식만 인식
  tools/…                            # sensor 스크립트, <plugin>-doctor.ts, 변환기
  tests/                             # 테스트·fixture 는 여기. tools/ 아래 금지
```

- contribution 파일은 `contributions/` 바로 아래 디렉터리 한 단계에만 둡니다. 더 깊으면 validator 가 `contribution-path` 로 막고 compose 는 읽지 않습니다(`core/tools/aidlc-plugin-validate.ts:1038-1047`, `scripts/plugin-hooks-template/compose.ts:2712`).
- `contributions/agents/` 의 target 은 core agent slug 이고, fragment 만 실을 수 있습니다. `adds:` 를 쓰면 `contribution-adds` 에러입니다(`aidlc-plugin-validate.ts:1052-1071`, `compose.ts:1895, 2765`).

**`plugin.json` 규칙** (`aidlc-plugin-validate.ts:215-399, 702-859`):

- `name`
  - `^[a-z][a-z0-9-]*$` 형식이어야 합니다.
  - `core`, `aidlc`, `aidlc-*` 는 예약어라 쓸 수 없습니다.
  - **plugin 루트 디렉터리 이름과 같아야 합니다.** 다른 이름으로 clone 하면 실패합니다(`:364-399`).
- `version`: 전체 SemVer (`:126`, `:763-773`).
- `author`: 문자열이거나 `{name}` (`:787-801`).
- `dependencies`: **base plugin 계층을 정합니다**(`readPluginBase`, `:337-362`).
  - 항목 형식은 `"core"`, `"<base>"`, `"<base>@<npm range>"` 입니다(예 `"other-plugin@^1.2.0"`).
  - base plugin 은 **최대 1개**입니다. 자기 자신을 적을 수 없고, range 는 npm 문법이어야 합니다.
  - base 는 core 위에만 설 수 있습니다. base 가 다시 다른 plugin 위에 서면(2단) sync 가 보류합니다.
  - sync 는 base 를 먼저, 그 위의 plugin 을 나중에 compose 합니다. base 가 설치되지 않았거나, range 밖이거나, scope 의 `include_stages` 가 적은 stage 가 base 에 없으면 그 plugin 을 **보류(held)** 하고 이유를 한 줄로 알립니다. base 가 이 project 에서 꺼져 있으면 말없이 멈춥니다(paused)(`aidlc-plugin.ts:2165-2296`).
  - validate 는 base 의 agent 이름을 그냥 넘기지 않고 `base-reference` 경고를 냅니다. `--with <base checkout>` 을 주면 실제로 대조하고, checkout 이 그 base 가 아니면 `base-root` 에러입니다(`aidlc-plugin-validate.ts:567-631`).
- `aidlc.contributes`
  - 허용 키: `stages · overlays · agents · scopes · sensors · knowledge · tools`.
  - 값은 정확히 `stages/` `contributions/`(overlays 용) `agents/` `scopes/` `sensors/` `knowledge/` `tools/` 이어야 합니다(`:129-147`).
  - `memory` 는 **항상 거부**합니다(`:236-243`).
- `aidlc.marketplace` (선택): 제3자 build 의 marketplace 이름입니다(`:287-307`, rule `manifest-marketplace`).
  - host 가 폴더 이름 하나로 쓸 수 있어야 합니다(영숫자와 `. _ -`, 영숫자로 시작).
  - `aidlc` 와 `aidlc-*` 는 대소문자와 상관없이 쓸 수 없습니다. AI-DLC 자체 plugin 몫입니다.
  - 생략하면 plugin 이름을 씁니다.
- 검사하는 것은 **`aidlc.contributes` 의 키와 `aidlc.marketplace`** 입니다. `aidlc` 와 `aidlc.contributes` 는 object 여야 합니다(`:823-841`). 최상위의 다른 키와 `aidlc` 아래 다른 키는 무시합니다. 공식 문서의 "aidlc block 은 strict" 는 과장입니다.
- 내용은 선언 여부와 상관없이 **고정된 디렉터리 이름으로 탐색**합니다. 선언한 디렉터리가 실제로 있는지도 검사하지 않습니다.
- 위 content 디렉터리, `.aidlc-plugin/`, `hooks/` 안의 **symlink 는 금지**입니다(`content-symlink`, `:148-158, 465-479`).

**validator rule 코드** (`aidlc-plugin-validate.ts:35-79`). 이번 판에서 새로 생긴 것:

| rule | 뜻 |
|---|---|
| `manifest-marketplace` | `aidlc.marketplace` 이름이 잘못됨 |
| `base-reference` | base 에서 올 이름이라 검사하지 않음(경고), 또는 base 를 선언하지 않았는데 core·자기 것이 아닌 agent·`requires_stage` 를 적음(에러) |
| `base-root` | `--with` 로 준 checkout 이 manifest 의 base 가 아님 |
| `scope-include` | scope 의 `include_stages` 가 비었거나 base 의 stage 가 아님 (§3.2) |
| `contribution-adds` | `contributions/agents/` 에 `adds:` 를 씀 |
| `contribution-path` | contribution 파일이 `contributions/<dir>/<file>.md` 깊이가 아님 |

**projection 에서의 정체성:**

- 제3자 build(`aidlc-plugin-build.ts`)는 host manifest 에 `name: "<name>"` 을 그대로 씁니다. `aidlc-<name>` 은 AI-DLC 가 직접 배포하는 plugin(`firstParty`)에만 씁니다(`aidlc-plugin-emit.ts:346-359, 931-944`).
- build 는 projection 에 다음을 함께 싣습니다.
  - `.aidlc-plugin/plugin.json` 사본(`:921-929`). sync 가 base 를 여기서 읽습니다. host manifest 에 `dependencies` 를 두면 Claude Code 가 host plugin 의존성으로 읽기 때문에 따로 둡니다.
  - `.aidlc-plugin-projection.json` marker(`:907-919`).
  - 제3자 build 에는 `marketplace.json` 도 씁니다(`:945-955`).
  - Kiro 계열은 `<harness>/aidlc-plugins/<name>/` 아래에 놓습니다(`:91, 902-905`). Kiro IDE 등록 파일에는 `timeout` 1800 s 가 들어갑니다(`:544-569`, `core/tools/aidlc-runtime-budget.ts:19`).
- compose 는 projection 에 실린 `.aidlc-plugin/plugin.json` 의 `name` 을 plugin key 로 씁니다. 그 파일이 없는 옛 build 이면 host 이름에서 `aidlc-` 를 떼어 씁니다(`compose.ts:195-226`, `aidlc-plugin.ts:256-274`).
- 그래서 stage·scope·agent·contribution 의 `plugin:` 은 모두 `<name>` 이어야 합니다(`compose.ts:786-800, 1756-1764`).

---

## 3. 새 primitive 계약

### 3.1 Stage (`stages/<phase>/<slug>.md`)

**필수 frontmatter** (`core/tools/aidlc-stage-schema.ts:204-217`): `slug phase execution condition lead_agent
support_agents mode produces consumes requires_stage inputs outputs`.

**선택 frontmatter** (`:219`): `number name plugin for_each workspace_requires optional_produces
produces_kinds sensors scopes reviewer review_artifact reviewer_max_iterations review_class
summary_confirmation when ars required_sections`.

- **`ars`** (새 키): composer 선별용 사전값입니다. `tools/data/ars-priors.json` 은 core stage 만 알기 때문에, plugin stage 는 같은 값을 frontmatter 에 적습니다(`:177-202, 496-542`).
  - `targets` 필수(`iae csu ve r ua` 중, 빈 목록 허용), `cost` 필수(정수 1..5 또는 `null`), `role` 선택(`initialization core phase-gate structural`), `project_types` 선택(`brownfield greenfield`).
  - compile 은 이 값을 node 에 그대로 넣습니다(`core/tools/aidlc-graph.ts:3034-3036`).

**거부되는 키:**

- schema 에 없는 키는 모두 에러입니다. `inline_context_paths` 도 stage 필드가 **아닙니다**(`aidlc-stage-schema.ts:301-303`).
- 예약 키 `on_failure blocks_on timeout retry` (`:163-168, 285-290`).
- **`bundle:`** 은 `plugin:` 이 함께 있어도 항상 에러입니다(`:297-299`).

**값의 범위:**

- `phase`: `initialization ideation inception construction operation` (`:132-138`).
- `execution`: `ALWAYS` · `CONDITIONAL`. agent 가 스스로 skip 을 보고할 수 있는 것은 CONDITIONAL stage 뿐입니다. 사람이 요청한 skip(`next --skip <slug>`)은 ALWAYS stage 에도 됩니다(`core/tools/aidlc-orchestrate.ts:20051-20066`).
- `mode`: `inline subagent pipeline mob agent-team` (`aidlc-stage-schema.ts:142`). 단 `agent-team` 은 compose 가 모든 harness 에서 거부합니다(`compose.ts:1224-1288`).
- `consumes[]`: `{artifact, required: bool, conditional_on?: brownfield|greenfield, cited?: bool}` (`aidlc-stage-schema.ts:66-72, 686-689`).
  - `cited: true` 는 "이 입력이 있으면 산출물이 인용한다"는 뜻입니다. compile 은 이것을 node 의 `cites` 로 모으고(`aidlc-graph.ts:3040-3043`), upstream-coverage sensor 는 optional consume 이라도 `cited` 면 인용을 요구합니다(`core/tools/aidlc-sensor.ts:630-655`).
- `produces_kinds` 의 키는 `produces` 나 `optional_produces` 항목이어야 합니다(`aidlc-stage-schema.ts:61-62`).
- `requires_stage`: 이미 알려진 slug 여야 하고, 자기보다 **번호가 낮은** stage 여야 합니다(`aidlc-graph.ts:2879-2898`).
- `pipeline` · `mob` 는 `support_agents` 가 비어 있으면 안 됩니다(`aidlc-stage-schema.ts:348-356`). `reviewer` 와 `review_artifact` 는 함께 써야 합니다(`:433-441`).

**plugin stage 에만 붙는 규칙:**

- `plugin: <name>` 은 필수입니다(validator `stage-owner`, `aidlc-plugin-validate.ts:952-960`).
- slug 는 `<name>-` 로 시작해야 합니다(graph `aidlc-graph.ts:2655-2675`, compose `compose.ts:1756-1764`).
- 파일 이름 stem 이 slug 와 같아야 합니다(`aidlc-graph.ts:2677-2682`, `aidlc-plugin-validate.ts:943-951`).
- 본문이 비어 있으면 안 됩니다(`aidlc-plugin-validate.ts:963-970`, `compose.ts:1745-1748`).
- `produces` · `optional_produces` 는 `<name>-` 접두사가 필요합니다. 단 이 검사는 **validator 만** 합니다(`aidlc-plugin-validate.ts:988-1000`). compile 과 compose 는 접두사를 확인하지 않습니다.
- base 를 선언하지 않은 plugin 이 core·자기 것이 아닌 agent 나 `requires_stage` 를 적으면 validator 가 `base-reference` 에러를 냅니다(`aidlc-plugin-validate.ts:893-926`).
- `phase:` 는 디렉터리 이름과 맞추세요. 번호 접두사는 디렉터리에서 오지만 artifact 경로는 `phase:` 에서 오기 때문입니다.

**번호 — 저자가 정하는 것이 아닙니다** (`aidlc-graph.ts:2586-2603, 2734-2741, 2764-2822`):

- 이미 graph 에 있는 slug 는 기존 번호와 이름을 유지합니다.
- 새 slug 는 phase 별로 모아 **그 batch 안의 `requires_stage` 순서**로 정렬합니다. 동률이면 저자가 쓴 `number:` 의 index 를 **정수로** 비교하고, 그다음 slug 순입니다.
- 그 결과 **phase 의 현재 최대 index + 1** 부터 번호를 받습니다.
- ⇒ 새 plugin stage 는 **항상 phase 의 맨 끝**에 붙습니다. core stage 사이에 끼워 넣을 수 없습니다.
- 예: `project-overview` 측정값 1.8 / 2.10 / 3.8 / 4.8, test-pro 의 `3.85` 는 3.8 이 됩니다. (측정은 처음 판 때 한 것입니다. v2.11.3 의 core stage 수 7/9/7/7 로 보면 번호는 같습니다.)
- index 를 정수로 비교하므로 `3.9` 가 `3.85` 보다 앞에 정렬됩니다.
- 한 번 정해진 `name:` 은 graph 에 남은 값이 이깁니다. 나중에 소스에서 고쳐도 반영되지 않습니다.

**scope 소속** (`aidlc-graph.ts:2238-2263, 2832-2846`):

- 다음 둘 중 하나일 때 EXECUTE 입니다. 예외로 initialization phase 는 모든 scope 에서 EXECUTE 입니다.
  - stage 가 `scopes:` 에 그 scope 를 적었을 때.
  - scope 파일의 `include_stages:` 가 그 stage 를 적었을 때. compile 이 그 stage 의 scope 목록에 넣어 줍니다. 설치된 stage 에 없는 이름은 에러 없이 빠집니다(§3.2).
- **둘 다 없으면 어느 scope 에서도 실행되지 않습니다.**
- plugin 이 **자기 stage** 에는 core scope 를 자유롭게 적을 수 있습니다. 소유권 제약은 contribution 의 `adds.scopes` 에만 있습니다.
- core scope 11개: `bugfix classic enterprise express feature infra mvp poc refactor security-patch workshop` (`core/scopes/`, 기본값 `classic`, `core/tools/aidlc-lib.ts:37190, 37193`).

**본문 규칙:**

- compiler 는 본문을 읽지 않습니다.
- 🔴 **자리표시 치환:** v2.11.3 compose 는 `.md` 파일 복사본(`compose.ts:1811-1813`), contribution fragment 본문(`:2966`), Kiro agent 복사본(`:1486`)에서 다음 넷을 설치본 channel 에 맞게 바꿉니다(`core/tools/aidlc-command.ts:745-756`).
  - `{{HARNESS_DIR}}`, `{{INVOKE}}`, `{{TOOL_PREFIX}}`, `{{TRUSTED_NAMESPACE}}`.
  - 설치본에 `aidlc-command.ts` 의 `projectInvocationTokens` 가 없는 옛 tree 에서는 copy channel 값으로 바꿉니다(`{{INVOKE}}` → `bun <harness>/tools/aidlc.ts`, `compose.ts:134-145`).
  - 2.11.0 compose 템플릿에는 이 처리가 없었습니다(2.11.0 실측: `{{INVOKE}}` 처리 0건, `project-overview` 가 이 결함을 갖고 있다가 2026-10-13 수정). 2.11.0 이하 tree 도 지원해야 하면 엔진 명령은 설치본 core stage 처럼 `aidlc engine …` 으로 직접 쓰세요.
- 다른 plugin 의 contribution anchor 가 걸리도록 `## Steps` 와 `### Step N` 형식을 지키세요.
- initialization 이 아닌 EXECUTE stage 는 모두 승인 gate 를 거칩니다(`aidlc-orchestrate.ts:8912-8927`). skeleton scope 의 gate stage 는 skeleton 판단을 따릅니다.

**알려진 공백:**

- `when:` 은 parse 만 하고 평가하지 않습니다(`aidlc-stage-schema.ts:171-175`). 실제 실행 여부는 `scopes:` 로 정하세요.
- `required_sections` 는 compiled node 에 들어가지 않아 아무것도 강제하지 않습니다(`buildGraphStage`, `aidlc-graph.ts:2973`).
- plugin 이 initialization stage 를 만드는 것을 막는 장치가 없습니다. 만들면 selection 과 `scopes:` 를 모두 무시하게 되니 만들지 마세요.

### 3.2 Scope (`scopes/<plugin>-<name>.md`)

- **필수:** 파일 이름이 `<plugin>-<name>.md`, `name` 이 파일 stem 과 같아야 하고, `plugin: <name>` 이 있어야 합니다(`aidlc-plugin-validate.ts:1131-1162`).
- **validator 추가 검사:** `depth` 는 `Minimal|Standard|Comprehensive` 입니다. 없으면 이 검사에 걸리므로 사실상 필수입니다. `keywords` 를 선언했다면 비어 있으면 안 됩니다(`:1164-1184`).
- **`include_stages`** (새 키): base plugin 의 stage 를 이 scope 에 넣습니다(rule `scope-include`, `:1186-1236`).
  - core stage 는 적을 수 없습니다. core stage 는 contribution 의 `adds.scopes` 로 넣습니다.
  - 자기 stage 도 적을 수 없습니다. 그 stage 의 `scopes:` 에 적습니다.
  - `dependencies` 에 base 가 없으면 에러입니다. 이름은 `<base>-` 로 시작해야 하고, `--with` 를 주면 base checkout 에 실제로 있는지 봅니다.
  - sync 는 설치된 base 에 그 stage 가 없으면 이 plugin 을 보류합니다(`aidlc-plugin.ts:2219-2226`).
- **loader 가 읽는 키** (`aidlc-lib.ts:36873-36998`):
  - `description`, `testStrategy`
  - `runner` — `true` 이면 scope runner skill 을 만듭니다. plugin 은 bare name, core 는 `aidlc-<name>` 으로 만듭니다(`core/tools/aidlc-runner-gen.ts:623-631`).
  - `skeleton on|off`
  - `existing_code true|false` — 이미 있는 코드를 바꾸는 scope 라는 표시입니다(`aidlc-lib.ts:596-599, 36937-36945`).
  - `include_stages` (위)
  - `freeform_default: true` — 켜진 scope 중 최대 1개만 가능합니다(`:37057-37066`).
  - `review_cap`, `guard_policy` 또는 `change_control`
  - ceremony 키 `sensors` · `learnings` · `summary_confirmation` · `plan_approval` · `collaborators` (`:40085`)

### 3.3 Agent (`agents/<plugin>-<role>-agent.md`)

- **필수:** 파일 이름이 `<plugin>-<role>-agent.md`, `name` 이 stem 과 같아야 하고, `display_name` 과 `plugin: <name>` 이 있어야 합니다(`aidlc-plugin-validate.ts:1239-1294`). `display_name` 은 validator 가 보지 않지만, 없으면 모든 compile 이 throw 합니다(`aidlc-lib.ts:37376-37395`).
- 그 밖의 필드(`description`, `disallowedTools: Task`, `model`/`tier`, `tools`, `permissions`)는 harness 고유 값이라 엔진이 검사하지 않고 그대로 넘깁니다.

**mode 별 적재** (`core/tools/aidlc-inline-context.ts:80-87`):

| mode | conductor 에 적재되는 agent |
|---|---|
| `inline` | lead + support |
| `mob` | lead 만 |
| `subagent` · `pipeline` | 없음 (native agent 로 dispatch) |

`reviewer` 는 mode 와 상관없이 항상 dispatch 됩니다(`compose.ts:1650-1661`).

**dispatch surface 검사** (`compose.ts:1508-1702`):

- compose 단계에서, leaf 가 `.kiro` · `.codex` · `.aidlc` 일 때만 검사합니다. **Claude 와 Cursor 는 검사하지 않습니다.**
- 대상은 inline 이 아닌 stage 의 lead/support, 그리고 모든 `reviewer` 입니다.
- 이미 설치된 아래 surface 가 없으면 그 stage 는 compose 되지 않습니다(`[degraded]`).
- Kiro IDE 와 Kiro CLI 는 둘 다 `.kiro` 라 tree 배치(`KIRO_KAS_LAYOUT`)로 구분합니다.

| harness | 필요한 surface |
|---|---|
| Kiro IDE (`kiro-ide`) | `.kiro/agents/<a>.md` 에 비어 있지 않은 `tools:` + 올바른 `permissions.rules` (`capability`/`effect`/`match`). plugin 자기 agent 는 compose 가 쓰려는 사본으로 판정합니다(`compose.ts:1667`) |
| Kiro CLI (`kiro`) | `.kiro/agents/<a>.json` **그리고** `.kiro/agents/aidlc.json` 의 `trustedAgents` 등록 |
| Codex | `.codex/agents/<a>.toml` |
| OpenCode/Copilot (`.aidlc`) | native agent `.md`, 또는 plugin 이 실은 persona 가 twin 으로 projection 될 수 있는 경우 |

⇒ **가장 쉬운 길은 plugin stage 를 `mode: inline` 으로 두고 `reviewer` 를 쓰지 않는 것입니다.** `project-overview` 가 이 방식입니다.

**harness 별 persona 변환:**

| harness | 변환 |
|---|---|
| Claude · Codex | 그대로 복사 |
| Cursor | `model\|tier\|effort\|variant` 줄 제거 (`aidlc-plugin-emit.ts:306-322`, `compose.ts:970`) |
| Kiro | `disallowedTools: Task` 줄 제거. 다른 값이면 거부 (`compose.ts:1021-1050`) |
| OpenCode · Copilot | native twin 생성 |

**build 가 하는 일** (`aidlc-plugin-emit.ts:244-303`, 적용은 `:712-747`, `*-agent.md` 에만):

- 모든 agent 파일에 "Delegated knowledge preflight (mandatory)" 블록을 주입합니다. 이 블록은 shipped format 문서 5개를 빼라고 적습니다(`aidlc-inline-context.ts:180-184`).
- 자기 stage 의 `reviewer` 로 쓰이는 agent 에는 knowledge 를 본문에 흡수시킵니다.

### 3.4 Knowledge (`knowledge/<agent-slug>/`)

- `<harness>/knowledge/<agent-slug>/` 로 복사됩니다.
- 소유 기록은 두 가지입니다.
  - `tools/data/plugin-files-<key>.json` (`compose.ts:2255-2261`).
  - `tools/data/plugin-owned-<key>.json`: 파일별 sha256 기록입니다. 다시 compose 할 때 이 기록으로 plugin 자기의 바뀌지 않은 옛 사본(교체)과 사람이 고친 사본(보고)을 구분합니다(`compose.ts:619-627`).

**inline 또는 mob lead 의 적재 순서** (`aidlc-orchestrate.ts:8929-8988`, harness 쪽은 `aidlc-inline-context.ts:336-418`):

1. persona (`<harness>/aidlc-common/personas/<a>.md` 가 있으면 그것, 없으면 `<harness>/agents/<a>.md`, `:352-358`)
2. `aidlc/spaces/<space>/knowledge/aidlc-shared/**`
3. `aidlc/spaces/<space>/knowledge/<a>/**`
4. `<harness>/knowledge/aidlc-shared/**` — format 문서 5개(`audit-format.md` 등)는 빼고 (`:171-177`)
5. `<harness>/knowledge/<a>/**`

- space knowledge 가 shipped knowledge **앞**으로 옮겨졌습니다. 처음 판의 순서는 persona → harness → space 였습니다.
- depth 가 Minimal 이면 다른 stage 몫의 shipped knowledge 를 뺍니다(`aidlc-inline-context.ts:107-162, 303-328`).
- 전체 경로 목록은 JSON 8 KiB 로 제한됩니다(`:221, 229-237`). 앞에서부터 채우므로 넘치면 shipped knowledge 가 먼저 잘립니다.
- dispatch 되는 agent 는 build 가 주입한 preflight 블록을 보고 같은 디렉터리를 읽습니다. 단 preflight 의 순서는 harness → space 그대로입니다(`aidlc-plugin-emit.ts:280-303`).
- **space knowledge(`aidlc/spaces/…`)는 사용자 런타임 상태입니다. plugin 은 거기에 아무것도 싣지 않습니다.**

### 3.5 Sensor (`sensors/aidlc-<id>.md` + `tools/` 스크립트)

**manifest** (`core/tools/aidlc-sensor-schema.ts:11-24, 45-51, 246-280`):

- 필수: `id`(stem 에서 `aidlc-` 를 뺀 값), `kind: deterministic`, `command`, `default_severity advisory|blocking`, `description`.
- 선택: `fire_on write|gate` (**기본 `write`**, `:81-82`), `category`, `matches`, `timeout_seconds`, `input_schema`, `output_schema`.
- 이름 형식 `^aidlc-[a-z][a-z0-9-]*\.md$` 이 아니거나 하위 디렉터리에 있으면 compose 가 거부합니다(`compose.ts:833-858`).
- 오프라인 검사가 없습니다. manifest 가 잘못돼도 compile 단계에서야 실패합니다.

**스크립트:**

- `command` 에 적힌 경로가 아니라 **`.ts` 파일의 basename 을 harness `tools/` 에서** 찾습니다(`aidlc-sensor.ts:336-369`). `aidlc engine sensor-<x>` 형식이면 `aidlc-sensor-<x>.ts` 로 읽습니다.
- compiled 실행 파일 환경에서는 basename 이 `aidlc-sensor-<id>.ts` 여야 합니다(`:384-396`).
- 인자: `--stage <slug> --output-path <abs>` (`input_schema` 에 `file_path` 가 있으면 `--file-path`, `:376-383, 648-653`). stdout 에 `{"pass": bool}` 을 출력합니다.
- **종료 코드 처리** (`aidlc-sensor.ts:26-38`):
  - exit 127 은 "감쌀 도구가 이 project 에 없음" 이라는 스크립트의 답이라 pass(`tool-unavailable`)로 메모만 남깁니다(`:976`).
  - 그 밖의 non-zero 종료, spawn 실패, 잘못된 JSON 은 **`COULD_NOT_RUN`** 입니다. pass 도 fail 도 아닌 별도 상태로 기록되고, gate 가 이것을 모아 알립니다(`aidlc-state.ts:7107-7113`).

**발화 시점:**

- `write` sensor: **`matches` 가 있고 쓰기 경로가 그것과 맞을 때만** 발화합니다(`core/hooks/aidlc-run-sensors.ts:225-231`).
- `blocking` + `fire_on: gate`: 실제로 gate 를 막습니다(`aidlc-state.ts:3992-4000, 4069-4257`).
- gate 에 답할 사람이 없으면 blocking gate sensor 만 발화합니다(`:4089-4092`).

**stage 에 붙이는 법:** 자기 stage 는 `sensors:` 에, core stage 는 contribution 의 `adds.sensors` 에 적습니다.

### 3.6 Tools 와 doctor 스크립트

- `tools/` 는 통째로 복사됩니다. `.md` 가 아닌 파일에는 자리표시 치환이 없습니다(`compose.ts:1796-1813`).
- 다음은 compose 가 복사하지 않습니다(`[advisory]`).
  - 경로에 `tests`, `__tests__`, `fixtures` segment 가 있는 파일, 또는 `*.test.ts` · `*.spec.ts` (`compose.ts:901-916`).
  - **validator 는 `__tests__` 와 `*.spec.ts` 를 놓칩니다**(`aidlc-plugin-validate.ts:1296-1317`). 그래서 validate 는 통과하고 test 에서 실패합니다.
  - 다른 plugin 이름의 `*-doctor.ts` (`compose.ts:870-899`).

**`tools/<plugin>-doctor.ts`** (`aidlc-utility.ts:2621-` `appendPluginDoctorChecks`):

- 환경 변수 `AIDLC_PROJECT_DIR`, `AIDLC_HARNESS_DIR`, `AIDLC_PLUGIN_NAME` 을 받습니다(`:2724-2726`).
- stdout 에 `{"checks":[{"pass","label","fix?","severity?":"error|advisory"}]}` 만 출력해야 합니다(`:2428-2429`).
- 제한: 300 s (`AIDLC_PLUGIN_DOCTOR_TIMEOUT_MS` 로 조정), 50행, 256 KiB, 문구 300자 (`:2422-2425, 2600-2605`, `aidlc-runtime-budget.ts:15`).
- doctor 는 다음 plugin 에서 이 스크립트를 찾습니다(`knownPluginNames`, `aidlc-utility.ts:993-1009`).
  - stage 나 scope 를 하나 이상 소유한 plugin.
  - `tools/data/plugin-{contrib,owned,compose}-<name>.json` 기록이 있는 plugin (`core/tools/aidlc-config-diagnostics.ts:2214-2223`).
  - 따라서 overlay 와 tool 만 있는 plugin(이 저장소의 overlay plugin 3개)도 compose 된 뒤에는 doctor 스크립트가 실행됩니다. **⚠️ 추론** (코드로만 확인했고 실행해 보지 않았습니다. harness.json 의 `plugins` 선택에서 빠지면 실행되지 않습니다.)

---

## 4. Contribution seam (`contributions/<phase>/<core-slug>.md`)

contribution 은 core stage 를 **수정하지 않고** 내용을 더하는 파일입니다. 아래 예시처럼 생겼습니다. core persona 에 prose 만 더하는 `contributions/agents/<core-agent>.md` 도 있습니다(§4.6).

이 절의 `compose.ts` 는 `scripts/plugin-hooks-template/compose.ts` 입니다.

```markdown
---
target: build-and-test          # 반드시 bundled core stage slug
plugin: my-plugin               # bundle: 를 쓰면 파일 전체가 skip 됨
adds:
  produces:
    - my-plugin-report          # 정확히 4칸 들여쓰기 "    - value", 값은 [\w-]+
  consumes:
    - artifact: my-plugin-input
      required: false
  sensors:
    - my-check
fragments:
  - anchor: after-step:3        # anchor 를 먼저, order 는 다음 줄 (필수)
    order: 100
---

## fragment: after-step:3

### Step 3b (my-plugin): …
본문은 다음 "## fragment:" 머리줄 또는 EOF 까지 이어짐. 그 사이의 다른 heading 은 본문에 포함됨.
```

- 목록 항목 파싱: `compose.ts:2791-2803`. anchor·order 쌍: `:2934-2935`. 본문 분리(fence 인식): `:2938-2962`.

### 4.1 처리 순서와 거부 조건

compose 는 아래 순서로 검사하고, 하나라도 걸리면 그 파일은 `[degraded]` 로 skip 합니다(`scripts/plugin-hooks-template/compose.ts:2709-2779`). `recordDrop` 의 기본 severity 가 `degraded` 입니다(`:297`).

0. 파일 위치가 틀림
   - `contributions/` 바로 아래의 `.md`: 읽지 않고 drop(`:2712`)
   - phase 디렉터리 아래 하위 디렉터리: 읽지 않고 drop(`:2720`)
   - `.md` 가 아닌 파일은 기록 없이 건너뜀(`:2723`)
1. `target:` 이 없음(`:2736`)
2. `target` 이 `^[a-z0-9][a-z0-9-]*$` 가 아님(`:2741`)
3. **`bundle:` 이 있음** (`plugin:` 이 함께 있어도 skip, `:2746`)
4. `plugin` 에 `:` 가 들어 있음(`:2753`)
5. `plugin` 이 manifest name 과 다름(`:2754-2759`)
6. target stage 파일(또는 `agents/` 이면 persona 파일)이 없음(`:2767`)
7. `contributions/agents/` 파일인데 설치된 엔진에 core agent roster 가 없거나(`:2773`), target 이 roster 에 없음(`:2777`)

다음 경우에는 **contribution 단계 전체**를 건너뜁니다(`:2565-2580`).

- plugin 이 selection 에서 꺼져 있음. 이때 primitive 는 그래도 복사됩니다(`:2289` 이하는 selection 을 보지 않음). compose 는 `[advisory]` 로 select 명령을 알려 줍니다(`:678-688`).
- 기존 sidecar(`plugin-contrib-<key>.json`)를 읽지 못하거나 빈 객체임(`:2460-2477`, 빈 객체 `:2467`). 이때는 `[degraded]` drop 을 남깁니다(`:2572-2576`).
- 두 경우 모두 stale fragment 정리(§4.4)와 `requires_stage` 재검사(§4.2)도 하지 않습니다(`:2673`, `:3030`).

**validator 가 contribution 에서 보는 것** (`core/tools/aidlc-plugin-validate.ts:1020-1100`):

- 파일이 정확히 `contributions/<phase|agents>/<file>.md` 깊이에 있는지(`contribution-path`, `:1038-1046`)
- `target` 이 bundled core stage slug 인지. `agents/` 아래면 core agent slug 인지(`contribution-target`, `:1053-1080`)
- `agents/` 아래 파일에 `adds:` 가 없는지(`contribution-adds`, `:1063-1071`)
- `plugin` 이 manifest name 과 같은지(`:1082-1088`)
- `adds.produces` 접두사(`artifact-namespace`, `:1090-1099`)

**보지 않는 것:** anchor · fragment 블록 · 그 밖의 `adds` 키 · `bundle:`. 이런 문제는 compose 단계의 drop 으로만 드러납니다.

### 4.2 `adds` 병합 규칙

| 키 | 동작 |
|---|---|
| `produces` `sensors` `scopes` | 중복을 뺀 합집합을 block 끝에 덧붙임(`mergeListField`, `compose.ts:1970-2005`). `field: []` 는 block 으로 바뀜(`:1973-1977`). 비어 있지 않은 inline `field: [a, b]` 도 block 으로 다시 쓴 뒤 덧붙임(`:1978-1990`). **target 에 그 필드가 없으면 adds 를 버림**(`[degraded]`, `:1992`) |
| `consumes` | `- artifact:` 단위로 나눔(`:2804-2830`). `required` 는 값이 `false` 일 때만 false 이고 기본은 true(`:2823`). `conditional_on: <word>` 도 보존. artifact 기준 중복 제거, 기존 항목은 바꾸지 않음(`mergeConsumes`, `:2051-2083`). 필드가 없으면 `[degraded]`(`:2069`) |
| `required_sections` | 따옴표로 감쌈. 필드가 없으면 frontmatter 끝에 새로 만듦(`mergeRequiredSections`, `:2085-2115`). 설치된 schema 가 이 키를 거부하면 `[advisory]`(`:2906-2908`). 빈 값은 `[degraded]`(`:2857`) |
| `scopes` 가드 | 그 이름의 scope 가 **이미 설치돼 있고**, 그 파일의 `plugin:` 이 **바로 이 plugin** 이어야 함(`:2881-2893`). core scope 에는 절대 추가되지 않음 |
| `requires_stage` | 순서 edge 로 중복 없이 합침(`:2894-2899`, `:2904`). 가드를 통과한 edge 만 병합하고, 나머지는 `[degraded]` drop(`:2897`). 가드 내용은 아래 |
| 그 밖의 소문자 `_` 키 | `[advisory]` "not yet an implemented merge surface"(`:2838-2843`) |

**`requires_stage` 가드** (`requiresRefusal`, `compose.ts:2637-2665`):

- dependency 는 target 자신이 아닌, 설치된 stage(core 또는 이미 디스크에 있는 plugin stage)여야 합니다.
- dependency 가 target 보다 먼저 compile 돼야 합니다.
  - pinned 번호가 있으면 (prefix, index) 로 비교합니다.
  - 번호가 없는 stage 는 phase 디렉터리로 prefix 를 정합니다.
- 같은 phase 에서 이번 compose 가 새로 넣는 stage 는 phase 끝 번호를 받습니다. 그래서 설치된 stage 가 그것을 요구할 수 없습니다(RFC #1100).
- 새 stage 끼리의 edge 는 cycle 을 만들지 않을 때만 통과합니다.
- 같은 phase edge 인데 `stage-graph.json` 을 읽지 못하면 거부합니다.
- 예전 compose 가 병합한 edge 는 매번 다시 검사합니다. 더 이상 성립하지 않으면 stage 와 sidecar 에서 지우고 `[degraded]` 로 기록합니다(`:2673-2689`, drop `:2679`).

**아무 기록 없이 무시되는 형식 — 가장 위험한 함정입니다.**

- `adds` 안의 inline list `[a, b]`. `adds` 는 block 형식만 읽습니다(`:2792`, consumes `:2810`, required_sections `:2851`).
- 키 자체가 2칸 들여쓰기가 아닌 `adds` 항목
- `required_sections` 의 항목 중 4칸이 아닌 것(`:2851-2852`)
- 대시·대문자·숫자가 들어간 `adds` 키(`:2839` regex `^ {2}([a-z_]+):`)
- 알 수 없는 최상위 키

다른 목록의 항목이 4칸이 아니면 조용히 사라지지 않습니다. `parsed X of Y … some dropped` 로 `[degraded]` 가 남습니다(`:2799-2801`, consumes `:2825-2828`).

### 4.3 Fragment anchor (`locateAnchor`, `scripts/plugin-hooks-template/compose.ts:2122-2175`)

| anchor | 규칙 | 삽입 위치 |
|---|---|---|
| `after-step:<n>` | `n` 은 **정수만** 허용(소수는 drop, `:2125`). `^### Step (\d+)(?:-(\d+))?\b` 중 `lo≤n≤hi` 인 첫 heading(`:2131-2134`) | 다음 `##` 또는 `###` 직전(`:2137-2139`). `####` 에서는 멈추지 않음 |
| `before-step:<n>` | 위와 같음 | heading 줄 바로 앞(`:2136`) |
| `end-of-steps` | `^## Steps\b`(`:2143-2149`) | 다음 `## ` 직전 |
| `in:<Comp>` | `^## <Comp>\b`(`:2150-2158`). 접두 단어만 맞아도 매치되므로 `in:Inputs` 가 `## Inputs and Outputs` 에도 걸림. 이름은 `[\w -]+` 만 허용(아니면 `[degraded]`, `:2152`) | 그 section 의 끝 |
| `after-preflight` | persona 전용. packager 가 build 때 넣은 delegated-knowledge preflight 블록(`:669`)을 찾음. 없으면 `[degraded]`(`:2159-2165`) | 그 블록 바로 뒤 |
| `end-of-body` | 항상 성공(`:2166-2172`) | 본문 끝. build 때 흡수된 knowledge section(`<!-- Absorbed at build time`)이 있으면 그 앞 |
| `after-questions` | **구현되지 않음** | "unknown anchor" `[degraded]`(`:2173`) |

`n=6` 일 때 heading 이 매치되는지:

| heading | 매치 |
|---|---|
| `### Step 6` · `### Step 6:` | ✅ |
| `### Step 6.1` | ✅ (`.` 앞에서 단어 경계 성립) |
| `### Step 4-8` | ✅ (범위에 포함) |
| `### Step 6b` | ❌ |

- 따라서 plugin 이 만드는 `### Step Nb (<plugin>)` heading 은 다른 plugin 의 anchor 에 걸리지 않습니다.
- anchor 탐색은 code fence 를 인식하지 않습니다(`:2131`). fragment 본문 추출은 fence 를 인식합니다(`:2946-2958`).
- 같은 anchor 에 다른 plugin 의 블록이 이미 있으면 `locateAnchor` 를 다시 부르지 않습니다. 그 블록들 사이에 끼웁니다(`:2231-2244`, 없을 때만 `:2246`).

**anchor 는 번호지만, 뜻하는 것은 step 의 제목입니다.**

- upstream 이 step 번호를 다시 매기면, 어떤 anchor 는 걸 곳이 없어져 `[degraded]` drop 됩니다(`:2135`).
  - compose 를 직접 실행하면 exit 0 입니다. compose 는 실패를 drop 으로만 남기고 종료 코드를 바꾸지 않습니다(`:3217-3221`).
  - `aidlc engine plugin sync` 는 staged 결과에 `[degraded]` 가 하나라도 있으면 거부합니다(`core/tools/aidlc-plugin.ts:1309-1324`).
  - `aidlc-plugin-test.ts` 는 compose drop 을 모두 error 로 올리고 `Plugin test: FAILED` 를 냅니다(`core/tools/aidlc-plugin-test.ts:669-681`, `:825`). ⚠️ **추론:** 코드상 `[advisory]` drop 도 똑같이 error 가 됩니다.
- 다른 anchor 는 여전히 매치되지만 **엉뚱한 step** 에 붙습니다. drop 이 없으므로 sync 도 test 도 통과합니다.
- 이 저장소의 `scripts/check-plugin-anchors.py --pre` 결과를 볼 때는 **제목을 읽어야** 하는 이유입니다.

### 4.4 Sentinel · 순서 · 갱신

**sentinel 형식** (`scripts/plugin-hooks-template/compose.ts:2212-2213`):

```
<!-- plugin:<plugin>:<anchor>:<order>:<hash> -->
…fragment 본문…
<!-- /plugin:<plugin>:<anchor>:<order>:<hash> -->
```

- hash 는 본문을 trim 하고(`:2945`) plugin token 을 치환한 뒤(`:2966`) 계산합니다. 치환하는 token 은 `{{HARNESS_DIR}}` `{{INVOKE}}` `{{TOOL_PREFIX}}` `{{TRUSTED_NAMESPACE}}` 입니다(`core/tools/aidlc-command.ts:745-756`). 그 함수가 없는 옛 설치에서는 앞의 셋만 치환합니다(`compose.ts:134-137`).
- 값은 FNV-1a 32bit, 소문자 hex 8자리입니다(`hashProse`, `:2180-2184`).
- 닫는 marker 는 hash 까지 같아야 블록 끝으로 인식합니다(`:2205-2212`). 그래서 비슷한 닫는 줄 하나로는 splice 가 깨지지 않습니다.
- 여는 marker 모양의 줄(`<!-- plugin:<plugin>:…:<n>:<hex> -->`)은 본문에 쓰면 안 됩니다.
  - compose 의 peer 스캔은 짝이 되는 닫는 marker 가 없는 여는 줄을 건너뜁니다(`:2236`).
  - sync prune 은 이 plugin 이름으로 된 여는 줄에서 짝을 못 찾으면 "unpaired plugin fragment" 로 멈춥니다(`core/tools/aidlc-plugin.ts:1754-1760`). ⚠️ **추론:** 그러면 sync 전체가 실패합니다.

**삽입 규칙:**

- 같은 `(plugin, anchor, order)` 블록이 이미 있으면(`compose.ts:2215-2227`):
  - 블록이 바이트까지 같을 때: 아무것도 하지 않습니다.
  - 다를 때: 그 자리에서 **교체**합니다.
  - 닫는 marker 를 찾지 못하면 손대지 않고 `[degraded]` 로 기록합니다(`:2220`).
- 같은 anchor 에 다른 블록이 있으면 `(order, plugin)` 순서에 맞는 자리에 끼웁니다(`:2240`).
- 같은 실행 안에서 `target:plugin:anchor:order` 가 겹치면, 파일이 달라도 drop 합니다(`:2987-2988`).
- frontmatter 의 fragment 항목에 맞는 `## fragment:` 본문이 없으면 drop 합니다(`:2967`). 반대로 본문 블록에 맞는 항목이 없어도 drop 합니다(`:2974`). 둘 다 `[degraded]` 입니다.

**sidecar** (`<harness>/tools/data/plugin-contrib-<key>.json`, `:2458`):

- target stage(또는 persona)마다 compose 가 **실제로 더한 값**만 기록합니다(`:1966-1969`). 선언만 했던 값은 기록하지 않습니다.
- 필드: `produces` `sensors` `consumes` `scopes` `requires_stage` `required_sections` `required_sections_created` `fragments[{anchor, order, hash}]`(`:2456`).
- splice 가 실제로 된 fragment 만 `fragments` 에 남깁니다(`:2990-2998`).
- 기록이 모두 비면 파일을 지웁니다(`:3099-3101`). 빈 sidecar 는 다음 실행이 거부하기 때문입니다(§4.1).

**갱신:**

- 갱신하면서 anchor 나 order 를 바꾸거나 fragment 를 빼면, compose 가 옛 블록을 지웁니다(`:3026-3091`).
  - sidecar 의 `fragments` 기록 중 이번 실행에 싣지 않은 것을 stage 와 persona twin 에서 잘라냅니다. 기록에서도 지웁니다.
  - sidecar 에 fragment 기록이 없는 옛 hook 이 만든 블록은 지우지 못합니다. 그런 블록은 고아로 남습니다.

**compose 를 직접 실행할 때의 한계:**

- plugin 이 더 이상 싣지 않는 파일은 지우지 않습니다. compose 가 지우는 파일은 자기 기록이 있는 옛 사본을 교체할 때뿐입니다(`:1863`).
- 더 이상 싣지 않는 structural adds(`produces` `sensors` `consumes` `scopes` `required_sections`)도 지우지 않습니다. `requires_stage` 는 예외입니다. 성립하지 않게 된 edge 만 지웁니다(§4.2).
- 이런 정리는 `aidlc engine plugin sync` 만 합니다(`core/tools/aidlc-plugin.ts:1768-1808`, §6.2). fragment 정리는 이제 compose 도 합니다.

### 4.5 할 수 없는 것

- 기존 필드 변경, `lead_agent` 변경, `required` 완화, step 본문 교체·삭제는 모두 불가능합니다. 모든 병합은 덧붙이기만 하고(`compose.ts:1970-2115`), splice 는 끼워 넣기만 합니다(`:2197-2249`).
- 바꿔야 할 필요가 진짜로 있다면 그것은 framework 차원의 결정입니다.

### 4.6 Persona contribution (`contributions/agents/<core-agent>.md`)

- target 은 core persona slug 이고, 파일은 `<harness>/agents/<slug>.md` 입니다(`compose.ts:2765-2767`).
- core agent roster 에 있는 persona 만 받습니다(`:2770-2779`, §4.1 의 7).
- **prose fragment 만** 받습니다.
  - `adds:` 가 있으면 compose 는 `[advisory]` 로 무시합니다(`:2785-2787`).
  - validator 는 error 로 막습니다(`core/tools/aidlc-plugin-validate.ts:1063-1071`).
- 쓸 anchor 는 `in:<H2>` · `after-preflight` · `end-of-body` 입니다(`docs/reference/18-plugin-mechanism.md:549`, `:575-576`).
- harness 별 twin 에도 같은 fragment 를 같은 순서로 넣습니다(`personaTwinFiles`, `compose.ts:1909-1921`, splice `:3005-3022`).
  - Codex: `agents/<slug>.toml` 의 `developer_instructions`. 그 문자열이 없으면 `[degraded]`(`:3014-3016`).
  - OpenCode: 네이티브 agents 디렉터리의 `.md`
  - Kiro: `aidlc-common/personas/<slug>.md`

---

## 5. 저작 도구 (`<tools-dir>` = 대상 release 의 tools)

모든 도구의 exit code 는 같습니다: `0` 정상 · `1` finding 또는 실패 · `2` 사용법 오류.
`--json` 출력의 기본 형태는 `{valid, errors:[{file,rule,message,fix}], warnings}` 입니다 (`core/tools/aidlc-plugin-validate.ts:1441-1453`).

### 5.1 "bundled" 의 뜻 — 어느 도구 묶음으로 돌리느냐가 결과를 바꿉니다

**도구는 plugin 을 설치할 대상 release 의 것을 쓰세요.**

- builder 는 hook 템플릿과 Kiro IDE 등록 파일을 **자기가 실행되는 도구 묶음에서** 복사합니다.
- 그래서 옛 도구로 build 하면 옛 hook 이 만들어집니다.
  - 예: 2.11.3 전의 Kiro IDE 등록에는 `timeout` 이 없습니다 (`core/tools/aidlc-plugin-emit.ts:541-569`, 지난 형식은 `:571-591`).

`scripts/package.ts` 가 각 harness 트리의 `<harness>/tools/data/` 에 다음을 넣습니다 (`scripts/package.ts:829-856`, 호출 `:1043`).

- `plugin-hooks-template/{compose.ts, aidlc-plugin-compose.ts}`
- `plugin-targets.json` — harness 7종 표 (`scripts/package.ts:1947-1985`)
- `plugin-authoring-context.json` — `{agents, stages}`
  - core agent 14개, core stage slug 33개.
  - **다른 plugin 의 stage 와 agent 는 들어 있지 않습니다.** base plugin 의 것은 `--with <base-root>` 로 줍니다(§5.3).
- `plugin-agent.md` — kiro · kiro-ide 트리에만 있습니다. compose 가 plugin agent 를 Kiro 형식으로 바꿀 때 씁니다 (`scripts/package.ts:652-657`; `scripts/plugin-hooks-template/compose.ts:989`).

validator 의 `contribution-target`, agent roster, `compose-hook-stale` 판정은 모두 **실행한 도구 묶음 옆의 이 데이터**를 기준으로 합니다. data 가 없으면 소스 트리로 fallback 합니다 (`core/tools/aidlc-plugin-validate.ts:484-525`).

| 도구 묶음 | compose 템플릿 | 비고 |
|---|---|---|
| 엔진 체크아웃 `core/tools` (2.11.3) | 3233줄 | build 는 bundled `plugin-targets.json` → `dist/claude/.claude/tools/data/plugin-targets.json` 순으로 찾습니다 (`core/tools/aidlc-plugin-build.ts:30-35`). 둘 다 없으면 `build-emission` 으로 실패하므로(`:153-170`) 먼저 `bun scripts/package.ts` 가 필요합니다 |
| 설치 트리 `<harness>/tools` | 그 release 의 것 | 대상 release 와 같은 버전이어야 합니다 |

⇒ 같은 plugin 이라도 **어느 버전의 tools 로 돌리느냐에 따라 stale 판정, target 목록, 만들어지는 hook 이 달라집니다.** 검증 결과를 기록할 때는 도구 묶음의 버전도 함께 적으세요.

### 5.2 create

```bash
bun <tools-dir>/aidlc-plugin-create.ts <name> [targetDir] [--json]
```

- 대상 디렉터리는 없거나 비어 있어야 하고, 그 이름이 `<name>` 과 같아야 합니다 (`core/tools/aidlc-plugin-create.ts:229-280`).
- staging 에서 만든 뒤 rename 하므로 실패해도 일부만 남지 않습니다 (`:304-330`).
- 만드는 파일 (`:199-223`):
  - manifest (`dependencies: ["core"]`, `stages/ agents/ scopes/` 만 선언, `:48-65`)
  - README
  - `agents/<n>-example-agent.md`
  - `scopes/<n>-example.md`
  - `stages/construction/<n>-example-stage.md` (inline, CONDITIONAL)
  - `tests/README.md`
- `hooks/` 는 만들지 않습니다. 의도된 동작입니다.

### 5.3 validate

```bash
bun <tools-dir>/aidlc-plugin-validate.ts <plugin-root> [--with <base-root>] [--json]
```

(`core/tools/aidlc-plugin-validate.ts:1481-1512`)

- **warning 은 두 가지입니다.**
  - `compose-hook-absent` (`:1340-1348`)
  - `base-reference` — base plugin 을 선언했는데 `--with` 없이 돌리면 base 의 agent·stage 이름을 검사하지 못했다고 한 번 알립니다 (`:604-619`).
    - base 를 선언하지 않은 plugin 이 다른 plugin 의 이름을 쓰면 같은 rule 이 **error** 입니다 (`:896-904`).
- 나머지 rule 은 모두 error 입니다 (rule 목록 `:35-80`).
- 주요 rule:
  - `manifest-*` (새로 `manifest-marketplace`: §5.4 marketplace 이름, `:287-307`, `:844-847`)
  - `content-symlink`
  - `stage-schema` · `stage-filename` · `stage-owner` · `stage-body` · `artifact-namespace` · `duplicate-artifact-producer`
  - `contribution-target`
  - `contribution-path` — contribution 파일은 `contributions/` 바로 아래 한 단계에만 둡니다. compose 가 그 밖은 읽지 않습니다 (`:1037-1047`)
  - `contribution-adds` — `contributions/agents/<agent>.md`(persona contribution)에는 `adds:` 를 쓸 수 없습니다 (`:1063-1071`)
  - `scope-*` · `agent-*` (새로 `scope-include`: `include_stages` 는 base 의 stage 만, `:1186-1212`)
  - `base-reference` · `base-root` — `--with` 가 manifest 가 말하는 base 의 checkout 인지 봅니다 (`:567-602`)
  - `tools-payload`
  - `compose-hook-stale` · `compose-template-missing`
- **base plugin:** plugin 은 core 위에 base plugin 을 **하나까지** 둘 수 있습니다 (`dependencies`, `core/tools/aidlc-lib.ts:1078-1082`). `--with` 를 주면 그 checkout 의 agent 와 stage 도 roster 에 들어갑니다.
- **검사하지 않는 것:**
  - consume 한 artifact 가 실제로 있는지
  - `scopes:` · `sensors:` 이름이 실제로 있는지
  - core artifact 와 충돌하는지
  - sensor 와 knowledge 의 내용
  - §4.1 에서 말한 contribution 세부 (파일 깊이와 persona 의 `adds:` 는 이제 검사합니다)

### 5.4 build

```bash
bun <tools-dir>/aidlc-plugin-build.ts <plugin-root> <harness> [outDir] [--json]   # 기본 outDir = <root>/dist/<harness>
```

(`core/tools/aidlc-plugin-build.ts:27-28`, `:131-133`)

**harness 7종** (`core/tools/aidlc-plugin-emit.ts:492-528` 명령, `:651-710` 배선):

| harness | manifest dir | leaf | hook 연결 |
|---|---|---|---|
| `claude` | `.claude-plugin` | `.claude` | `hooks/hooks.json` SessionStart (timeout 1800 s) |
| `codex` | `.codex-plugin` | `.codex` | `hooks/hooks.json` SessionStart (timeout 1800 s) |
| `copilot` | `.plugin` | `.aidlc` | `hooks/hooks.json` |
| `opencode` | `.opencode-plugin` | `.aidlc` | `hooks/hooks.json` 를 쓰지만 **OpenCode 는 읽지 않습니다**. sync 를 직접 실행하세요 (`core/tools/aidlc-plugin.ts:2141-2153`) |
| `cursor` | `.cursor-plugin` | `.cursor` | `hooks/hooks.json` sessionStart **두 항목**: `aidlc engine plugin sync --harness-dir .cursor` 와 `bun ./hooks/aidlc-plugin-compose.ts .cursor`. Cursor 는 두 항목을 각각 실행합니다 (`:666-681`) |
| `kiro` | `.kiro-plugin` | `.kiro` | **없음** (`hooks/compose.ts` 는 실림, `:658`) |
| `kiro-ide` | `.kiro-plugin` | `.kiro` | outDir 의 `.kiro/hooks/aidlc-<name>-compose.json` (timeout 1800 s, `:541-569`, `:659-663`) |

- timeout 1800 s 는 `EXTENDED_SUBPROCESS_TIMEOUT_MS` = 1,800,000 ms 에서 옵니다 (`core/tools/aidlc-runtime-budget.ts:19`; `core/tools/aidlc-plugin-emit.ts:696-698`).
- **Kiro 계열의 drop 형식:** kiro · kiro-ide projection 은 plugin 을 `<outDir>/.kiro/aidlc-plugins/<name>/` 아래에 둡니다 (`:361-369`, `:903-905`). project root 에 그대로 풀면 됩니다.
- **kiro-ide 명령** (`:500-505`):
  ```
  aidlc engine plugin sync --harness-dir .kiro --plugin-root ./.kiro/aidlc-plugins/<name> || bun ./.kiro/aidlc-plugins/<name>/hooks/aidlc-plugin-compose.ts .kiro kiro-ide
  ```

**출력** (`core/tools/aidlc-plugin-emit.ts:863-977`):

- `.aidlc-plugin-projection.json` 마커 (`:908-920`)
- `.aidlc-plugin/plugin.json` — 원본 manifest 를 **그대로** 복사합니다. sync 가 여기서 base 를 읽습니다 (`:925-929`).
- `<manifestDir>/plugin.json` (`:931-944`)
  - 값은 `{name, version, description, author}` 입니다.
  - `name` 은 **plugin 이름 그대로**입니다. `aidlc-<name>` 은 AI-DLC 자체 plugin 에만 붙습니다 (`:346-358`; build 도구는 first-party 로 부르지 않음).
  - **`dependencies` 와 `aidlc` 는 빠집니다.** Claude Code 가 `dependencies` 를 호스트 plugin 으로 읽기 때문입니다.
- `<marketplaceDir>/marketplace.json` (`:946-955`)
  - 위치: 보통 `<manifestDir>`. codex 는 `.agents/plugins/` 입니다 (`harness/codex/manifest.ts:158`).
  - 이름: manifest 의 `aidlc.marketplace`, 없으면 plugin 이름입니다. `aidlc` 와 `aidlc-*` 는 쓸 수 없습니다 (`core/tools/aidlc-plugin-validate.ts:287-307`).
- `hooks/compose.ts` (템플릿, 또는 바이트가 같은 vendored 사본). `aidlc-plugin-compose.ts` 는 cursor · kiro-ide 에만 실립니다 (`core/tools/aidlc-plugin-emit.ts:443-475`).
- 내용 디렉터리 (`stages sensors tools contributions scopes agents knowledge`, `:99-107`)
  - `*-agent.md` 에는 reviewer knowledge 와 delegated-knowledge preflight 가 들어갑니다 (`:729-743`).
  - Cursor 의 agent 는 `aidlc/agents/` 로 갑니다 (`:722-725`).
- **복사되지 않는 것:** `tests/`, README, `prerequisites/`, `hooks/` 아래 다른 파일

**거부 조건:**

- validate error (`core/tools/aidlc-plugin-build.ts:141-151`)
- 출력 경로의 symlink, 또는 보호 경계를 벗어난 출력 경로 (`core/tools/aidlc-plugin-emit.ts:751-801`)
- 마커가 없는데 비어 있지 않은 outDir (강제 옵션 없음, `:838-845`)
- 마커가 **다른 plugin 이나 다른 harness** 의 것인 outDir (`:846-857`)
- 내용이 다른 vendored `compose.ts` (`:452-461`)
- 틀린 `aidlc.marketplace` 이름 (`:878-881`)
- 같은 outDir 에 동시에 build 하면 output lock 을 기다립니다 (`:160-195`).

### 5.5 test

```bash
bun <tools-dir>/aidlc-plugin-test.ts <plugin-root> --install <project-root> [--harness <name>] [--with <base-root>] [--json]
```

절차 (`core/tools/aidlc-plugin-test.ts:545-797`):

1. validate 를 돌립니다 (`:550`).
2. harness 를 감지합니다 (`:357-390`). **`.kiro`(kiro/kiro-ide)와 `.aidlc`(copilot/opencode)는 항상 `--harness` 가 필요합니다.**
3. 실제 설치의 hash snapshot 을 뜹니다 (`:586`).
4. 설치 루트를 임시 후보 디렉터리로 복사합니다 (`:595`).
5. build 합니다 (`:609-614`).
   - `--with` 를 주면 base 를 먼저 build 하고 compose 합니다. base 의 drop 도 실패로 칩니다 (`:618-651`).
6. compose 를 한 번 돌립니다 (`:652-668`).
7. **이 plugin 의 drop 이 한 줄이라도 있으면 실패**합니다. `[advisory]` 도 실패로 칩니다 (`:669-681`).
8. **설치 트리 자신의** `aidlc-graph.ts compile` 을 돌립니다 (`:448-470`, `:683`).
9. plugin stage 노드와 scope 키가 있는지 확인합니다.
10. compose 를 한 번 더 돌려, drop 이 0 이고 바뀐 파일도 0 인지 확인합니다(멱등성, `:722-754`).
11. 실제 설치의 hash 를 다시 대조합니다 (`:765-786`).

- `--dist` 는 예약돼 있습니다(exit 2, `:856-861`).
- 결과 rule: `test-install` · `test-compose` · `test-compose-drop` · `test-graph` · `test-idempotency` · `test-live-mutation`.

### 5.6 CLI 경로

- 다음 세 명령이 같은 구현을 부릅니다 (`core/tools/aidlc.ts:995-1012`; `core/tools/aidlc-utility.ts:1553-1654`).
  - `aidlc plugin validate [path] [--with <base-root>]`
  - `aidlc plugin build <harness> [outDir] [--plugin-root <p>]`
    - **build 는 인자 순서가 직접 도구와 다릅니다.** 생략하면 plugin root 는 현재 디렉터리입니다.
  - `aidlc plugin test [path] --install <project-root> [--harness <name>] [--with <base-root>] [--json]` — 2.11.3 에서 새로 생겼습니다.
- `create` 에는 CLI 경로가 없습니다(RFC #723). 도구를 직접 실행하세요.
- 설치 측 명령은 `aidlc engine plugin select|sync|list` 입니다 (`core/tools/aidlc.ts:963-986`: `sync [--prune-missing] [--yes]`, `list [--verbose] [--json]`).

---

## 6. compose 와 설치 측 lifecycle

### 6.1 compose hook (`hooks/compose.ts`)

**경로와 정체성 결정** (`scripts/plugin-hooks-template/compose.ts`):

| 대상 | 결정 순서 (앞이 우선) |
|---|---|
| plugin root | `CLAUDE_PLUGIN_ROOT` → `PLUGIN_ROOT` → `AIDLC_PLUGIN_ROOT` → hook 파일의 두 단계 위 (`:38-42`) |
| project dir | **`CLAUDE_PROJECT_DIR`** → `AIDLC_PROJECT_DIR` → `PWD` (`:43-48`) |
| harness leaf | `AIDLC_HARNESS_DIR`, 없으면 기본 `.claude` (`:49`) |
| harness 이름 | `AIDLC_HARNESS_NAME` → `tools/data/harness.json` `.name` → leaf. leaf 가 `.aidlc` 이면 `.github/hooks/aidlc.json` 이 있을 때 copilot, 없으면 opencode (`:50-67`) |
| key | ① `AIDLC_PLUGIN_KEY` ② **`.aidlc-plugin/plugin.json` 의 `name`** ③ host manifest dir 6종의 `aidlc-*` name ④ `stages/ scopes/ contributions/` 첫 `plugin:` 줄 ⑤ 두 단계 위 디렉터리 이름 (`:195-226`) |

- 🔴 **project dir 함정:** hook 을 직접 실행할 때의 함정입니다. Claude Code hook 처럼 `CLAUDE_PROJECT_DIR` 가 설정된 셸에서 `AIDLC_PROJECT_DIR=<target>` 만 주면, **다른 project 에 compose 됩니다.**
  - 엔진 쪽 순서는 반대입니다: `AIDLC_PROJECT_DIR` 가 먼저입니다 (`core/tools/aidlc-lib.ts:1231-1240`).
  - `engine plugin sync` 는 두 변수를 모두 staging 경로로 맞추므로 이 함정이 없습니다 (`core/tools/aidlc-plugin.ts:1237-1252`).
- key 는 원본 manifest 가 projection 에 함께 실리므로(§5.4) ②에서 정해집니다. 저작 원본에서도 같습니다.

**실행 단계:**

1. **잠금.** workspace lock 을 잡습니다. 설치된 `aidlc-lib.ts` 의 audit lock 을 씁니다 (`:562-580`).
   - 재시도 횟수는 `LONG_SUBPROCESS_TIMEOUT_MS`(900,000 ms)/100 = 9000회, 100 ms 간격이라 약 15분입니다 (`:158-169`).
   - 설치된 엔진에 공유 lock 지원이 없으면 `[degraded]` drop 을 남기고 건너뜁니다 (`:562-573`).
2. **복사.** (`:2298-2410`)
   - 대상: `stages`→`aidlc-common/stages`, `scopes`, `agents` (Cursor 는 `aidlc/agents`), `knowledge`, `sensors`, `tools`.
     - copilot · opencode 는 native agent roster 에도, Kiro 는 `aidlc-common/personas` 에도 씁니다.
   - **core, 다른 plugin, 사람이 고친 파일은 덮어쓰지 않습니다** (`:1787-1870`).
     - 내용이 같으면 그냥 넘어갑니다.
     - `plugin-owned-<key>.json` 에 기록된 hash 와 같은 **이 plugin 의 옛 사본만** 교체합니다 (`:627-662`).
     - 기록이 없는 충돌은 "collides with an existing file this plugin has no record of installing … not overwritten" 입니다.
     - 설치 뒤 바뀐 파일은 "was changed after this plugin installed it; not overwritten" 입니다.
     - 둘 다 `[degraded]` 입니다.
   - **`.md` 파일에서만** `{{HARNESS_DIR}}` · `{{INVOKE}}` · `{{TOOL_PREFIX}}` 를 설치 채널에 맞게 치환합니다 (`:125-140`, `:1811-1813`).
   - `skills/` 와 `hooks/` 는 복사하지 않습니다.
   - `tools/` 안의 test/fixture payload(`tests/`, `__tests__/`, `fixtures/`, `*.test.ts`, `*.spec.ts`)는 복사하지 않고 `[advisory]` 로 남깁니다 (`:901-918`).
3. **stage 사전 검사.**
   - `agent-team` 이면 거부합니다 (`:1220-1285`).
   - dispatch surface 를 검사합니다(§3.3).
   - 설치된 schema 로 검증합니다. 새 stage 가 실패하면 복사하지 않고, 그 slug 를 버린 stage 로 기록합니다 (`:2298-2304`).
4. **contribution 병합** (§4). stage 뿐 아니라 persona(`contributions/agents/`)와 그 native twin 에도 병합합니다.
   - sidecar 쓰기에 실패하면 이번 실행의 쓰기를 되돌립니다 (`:3096-3107`).
5. **compile.** (`:3109-3191`)
   - 바뀐 것이 있거나, graph 에 plugin slug 가 빠졌거나, retry 마커가 있을 때만 `aidlc-graph.ts compile` 을 돌립니다.
   - 실패하면 이번 실행의 쓰기를 모두 되돌리고 retry 마커 `aidlc/.plugin-compose-retry-<key>` 를 남깁니다 (`:3176-3181`).
   - 성공하면 commit 한 뒤 SKILL.md 표와 runner 를 다시 만듭니다 (`:3182-3215`). 이 단계는 rollback 대상이 아닙니다.
6. **종료 코드.** 예외가 나도 drop 으로 기록할 뿐 **non-zero 로 끝나지 않습니다** (`:3216-3221`). 출력도 없습니다. 결과는 산출물로 판단하세요.

**산출물:**

| 파일 | 내용 |
|---|---|
| `<hooksHealthDir>/plugin-compose-<key>.drops` | `ISO\t[degraded\|advisory] reason`. 실행할 때마다 덮어쓰고, drop 이 없으면 지움 (`:294-299`, `:337-347`). `hooksHealthDir` 는 보통 `aidlc/spaces/<space>/intents/.aidlc-engine/hooks-health` (`:271-282`; `core/tools/aidlc-lib.ts:27880-27882`) |
| `<hooksHealthDir>/plugin-compose-installed-tool-payloads-<leaf>.drops` | 설치된 tools 의 test payload 감사. `<leaf>` 는 점을 뺀 leaf (예: `claude`) (`:360-374`) |
| `<harness>/tools/data/plugin-contrib-<key>.json` | target 별 adds 와 fragment `{anchor,order,hash}`. disable 할 때와 doctor 가 이 기록을 씀 (`:2458`) |
| `<harness>/tools/data/plugin-files-<key>.json` | knowledge 소유 목록 (`:2256-2260`, `:2384-2402`) |
| `<harness>/tools/data/plugin-owned-<key>.json` | 이 plugin 이 설치한 파일과 sha256. **hook 을 직접 실행해도 씁니다** (`:2416-2444`) |

- `plugin-compose-<key>.json`(stamp)과 `plugin-held-<key>.json` 은 **`engine plugin sync` 만 씁니다** (`core/tools/aidlc-plugin.ts:1168-1175`, `:2526-2530`). hook 을 직접 실행하면 생기지 않습니다.

**selection 과의 관계:**

- `harness.json` 에 `plugins` 목록이 있는데 이 plugin 이 빠져 있다고 합시다 (`:408-412`).
  - primitive 는 그래도 복사합니다.
  - contribution 은 **병합하지 않습니다** (`:2578`, `:2673`, `:3030`).
  - "not enabled" `[advisory]` drop 을 남깁니다. 켜는 `plugin select` 명령이 문구에 들어 있습니다 (`:678-687`).

### 6.2 sync 는 두 가지 — 성격이 다릅니다

| 항목 | `aidlc engine plugin sync` (`core/tools/aidlc-plugin.ts:2344-2608`) | `bun <h>/tools/aidlc-utility.ts plugin-sync` (`core/tools/aidlc-utility.ts:1680-1770`) |
|---|---|---|
| 방식 | project sync lock (`:2306-2342`) → staging 복사 → 기존 소유 파일·contribution 제거 → compose → diff → **transaction commit/rollback** | env root 또는 `--plugin-root` 의 `hooks/compose.ts` 를 **실제 project 에 직접** 실행 |
| stamp | 씀 | 쓰지 않음 (`plugin-owned` 는 compose 가 씀) |
| 고아 fragment 정리 | 함 (`:1768-1808`) | 하지 않음 |
| `[degraded]` drop 하나 | **sync 전체 중단** (drops 파일은 staging 에만 있다가 버려지므로 error 문구에 사유를 담음, `:1309-1323`) | 기록만 남김 |
| 결과가 최신이면 | stamp 버전·hash·base, contrib sidecar, 기록된 adds·fragment, 소유 파일 hash, held 기록이 모두 그대로면 0 operation 으로 끝남 (`:2033-2066`, `:2475-2490`) | 매번 compose |

**`engine plugin sync` 의 세부:**

- **플래그:** `--plugin-root <p>` · `--harness-dir <leaf>` (`:2640-2645`), `--prune-missing [--yes]`, `--json`, `--quiet`.
- 🔴 **`--help` 가 없습니다.** 2.11.3 의 sync 에는 help 분기가 없어 `--help` 를 주면 sync 가 그대로 실행됩니다 (`core/tools/aidlc-plugin.ts:2640-2655`).
  - 2026-11-06 에 plugin 이 없는 폴더에서 한 번 실행해 `plugin sync complete: 0 plugin(s)` 가 출력되는 것을 확인했습니다.
- **범위:** env(`CLAUDE_PLUGIN_ROOT`·`PLUGIN_ROOT`·`AIDLC_PLUGIN_ROOT`)나 `--plugin-root` 로 root 가 주어지면 **그 root 만** sync 합니다 (current-root-only, `:363-369`, `:2359-2361`).
  - root 가 없으면 host inventory 전체를 씁니다(§6.3).
- **base plugin:** base 를 둔 plugin 은 host 가 목록을 가진 경우 base 를 같은 실행에서 먼저 compose 합니다 (`:2410-2426`, 순서 `:2246`, `:2427`).
  - base 가 없거나 버전이 안 맞으면 그 plugin 은 compose 하지 않고 `plugin-held-<key>.json` 에 사유를 남깁니다 (held).
- **compose 실행:** 컴파일된 `aidlc` 는 `compose()` 를 프로세스 안에서 import 합니다. 그렇지 않으면 Bun 으로 spawn 합니다 (`:1254-1303`).
  - retry 마커가 남거나 compose 중 plugin 소스가 바뀌면 error 입니다 (`:1305-1307`, `:1325-1327`).
- **commit:** `.aidlc-transaction.lock` 이 바쁘면 3회까지 다시 시도합니다 (`:2549-2565`).
  - commit 뒤에도 구성되지 않은 plugin 이 있으면 exit 0 대신 error 로 끝납니다 (`:2584-2595`).
- **결과:** `{synced, pruned, operations, held, newlyHeld, paused, superseded}` (`:2597-2605`).
  - 사람용 메시지 `plugin sync complete: N plugin(s)` 뒤에 새로 held 된 사유와 superseded 줄이 붙습니다 (`:2646-2650`).
  - superseded 는 "installed twice; AI-DLC uses the rebuilt one. Remove the old copy: `/plugin uninstall <id>`" 입니다 (codex 는 `codex plugin remove <id>`, `:463-471`).
- **`--prune-missing`:** host 목록에서 사라진 plugin 의 소유 파일과 contribution 을 지웁니다 (`:1810-1838`).
  - 대화형이 아니면 `--yes` 가 필요합니다 (`:2073-2088`).

**host hook 의 명령 순서** (`core/tools/aidlc-plugin-emit.ts:492-528`):

- store 계열(claude · codex · copilot · opencode):
  1. `aidlc engine plugin sync` — PATH 에 있으면 이것으로 **끝**입니다.
  2. aidlc 도 bun 도 없으면 메모를 남기고 exit 0.
  3. `bun <proj>/<leaf>/tools/aidlc-plugin.ts sync` — 있으면 이것으로 끝입니다.
  4. `bun <root>/hooks/compose.ts`
- Cursor: sessionStart 두 항목이 각각 실행됩니다. ① `aidlc engine plugin sync --harness-dir .cursor` ② launcher (`:666-681`).
- Kiro IDE: `aidlc engine plugin sync --harness-dir .kiro --plugin-root ./.kiro/aidlc-plugins/<name> || <launcher>` (`:500-505`).
- launcher(`hooks/aidlc-plugin-compose.ts`)의 순서 (`scripts/plugin-hooks-template/aidlc-plugin-compose.ts:75-110`):
  1. PATH 의 `aidlc engine plugin sync`
  2. aidlc 가 없으면 `<leaf>/tools/aidlc-plugin.ts sync`
  3. 둘 다 성공하지 못하면 `hooks/compose.ts` 를 직접 실행
- 🔴 **launcher fallback 의 결과:** Kiro IDE(와 Cursor 의 두 번째 항목)에서 sync 가 실패하면 — `[degraded]` 로 거부된 경우도 포함 — launcher 가 compose.ts 를 직접 실행합니다.
  - 그래서 sync 가 거부한 구성이 session start 때 **transaction 없이** 적용될 수 있습니다.
  - 코드로 확인, 실행해 보지는 않음.
- Kiro CLI(`kiro` projection): hook 이 없습니다. project root 에서 직접 실행하세요.

```bash
aidlc engine plugin sync --harness-dir .kiro --plugin-root ./.kiro/aidlc-plugins/<name>
# env 로 줄 때 (AIDLC_PLUGIN_ROOT 는 outDir 가 아니라 .kiro/aidlc-plugins/<name>/):
AIDLC_PLUGIN_ROOT=<plugin-folder> AIDLC_PROJECT_DIR=<project> AIDLC_HARNESS_DIR=.kiro aidlc engine plugin sync
# aidlc CLI 가 없을 때 (§6.1 project dir 함정 주의):
AIDLC_PLUGIN_ROOT=<plugin-folder> AIDLC_PROJECT_DIR=<project> AIDLC_HARNESS_DIR=.kiro bun <plugin-folder>/hooks/compose.ts
```

- Kiro 는 host inventory 가 없습니다. 그래서 root 없이 sync 하면 두 경로 모두 다음 문구를 냅니다.
  - "Nothing synced: this tool keeps no list of your plugins, so name each one's folder: `aidlc engine plugin sync --plugin-root <<key>'s folder>`" (`core/tools/aidlc-plugin.ts:2133-2139`)
  - compiled 경로는 이 문구로 실패합니다(exit 1, `:2395-2398`). utility 경로는 출력만 하고 끝납니다 (`core/tools/aidlc-utility.ts:1681-1684`).
- `--prune-missing` 은 Kiro 에서 쓸 수 없습니다. 전체 inventory 가 증명돼야 하는 옵션이기 때문입니다 (`core/tools/aidlc-plugin.ts:2385-2388`).

### 6.3 inventory · list · select

**inventory** (`core/tools/aidlc-plugin.ts:710-718`):

| host | 출처 |
|---|---|
| Claude | `~/.claude/plugins/installed_plugins.json` (schema v2, `CLAUDE_CONFIG_DIR` 존중) + 사용자 `settings.json` `enabledPlugins` + project `.claude/settings.json` `enabledPlugins`. local · project scope 기록은 `projectPath` 가 이 project 일 때만 셈 (`:491-617`) |
| Codex | `~/.codex/config.toml` `[plugins]` (`CODEX_HOME` · `AIDLC_CODEX_HOME` · `AIDLC_CODEX_CONFIG`) + `plugins/cache/<marketplace>/<plugin>/<version\|local>` (`:619-708`) |
| Kiro · Cursor · Copilot · OpenCode | 현재 실행 중인 hook 의 root 만 (`:473-489`) |

**`aidlc engine plugin list [--verbose|--json]`:**

- 상태 값 (`:122-134`): `current`, `not-composed`, `version-differs`, `source-changed`, `legacy-unstamped`, `installed-disabled`, `installed-missing`, `invalid-installed`, `inventory-unavailable`, `dependency-unmet`, `paused`, `installed-twice`.
  - `inventory-unavailable` 은 "not compared: no host plugin list" 이고, 할 일이 없는 상태로 칩니다 (`:972-995`).
- 사람용 출력의 sync 안내 문구는 **`run: <invocation> engine plugin sync`** 입니다 (`:1027-1032`). 공식 문서와 같습니다.

**`aidlc engine plugin select [a,b]`** (`core/tools/aidlc-utility.ts:1378-1513`):

1. 이름을 `aidlc` + 알려진 plugin 목록과 대조합니다 (`:993-1009`, `:1401-1406`).
2. 진행 중인 workflow 가 고립되는 변경이면 거부합니다 (`:1413-1426`).
   - 목록에 남겼지만 base 가 빠진 plugin 은 **paused** 가 됩니다. 아무것도 실행되지 않고 목록에는 남습니다 (`:1408-1412`; `core/tools/aidlc-lib.ts:1078-1082`).
3. staging 에서 꺼진 plugin 의 sidecar 기록과 sentinel 블록을 제거하고, `harness.json` 을 쓰고, graph · runner · 표를 다시 만듭니다 (`:1430-1461`).
   - stage 뿐 아니라 persona 와 native twin 의 fragment 도 제거합니다 (`:1225-1287`).
4. transaction 으로 commit 하고 audit 에 `PLUGIN_SELECTION_CHANGED` 를 남깁니다 (`:1462-1476`).

- 다시 켜면 다음 compose 때 contribution 이 다시 병합됩니다. 언제 돌아오는지 출력으로 알려 줍니다 (`:1477-1511`).
- agent 와 knowledge 는 selection 으로 걸러지지 않습니다.

### 6.4 엔진 업그레이드 뒤

- **관리형 refresh(`aidlc config`):** plugin 파일, stamp, sidecar 를 보존합니다. 기록된 contribution 을 새 stage 바이트 위에 다시 병합하고 다시 compile 합니다 (`core/tools/aidlc-init.ts:7075-7078`).
  - selection 이 끈 plugin 의 것은 이때 제거합니다 (`:7299-7312`).
  - Kiro IDE 는 build 가 쓴 그대로의 등록 파일을 plugin 소유로 알아봅니다. 지난 build 의 형식도 포함합니다 (`:13802`; `core/tools/aidlc-plugin-emit.ts:571-649`).
- **`dist/<harness>/` 를 그냥 복사한 경우:** graph 와 core stage 가 덮어써져 plugin 노드와 병합 내용이 사라집니다. doctor 가 "Composed plugin surface" 실패를 보고합니다 (`tests/integration/t314-plugin-reinstall-doctor.test.ts:132-158`).
  - **contribution 을 가진 plugin:** sync 가 사라진 adds·fragment 를 감지해 다시 compose 합니다 (`core/tools/aidlc-plugin.ts:2001-2031`, `:2052-2054`; 테스트 `t314-plugin-reinstall-doctor.test.ts:244-255`).
  - ⚠️ **추론:** **stage 만 더하는 plugin**(contributions 없음)은 graph 만 덮어써지면 stamp 와 소유 파일이 그대로라 `engine plugin sync` 가 "최신" 으로 판단하고 아무것도 하지 않을 수 있습니다. 판정이 graph 를 보지 않기 때문입니다 (`:2033-2066`). 확실하게 복구하려면 `bun <projection>/hooks/compose.ts` 를 직접 실행하세요. compose 는 graph 에 plugin slug 가 없으면 compile 합니다.
  - 엔진 테스트 t314 는 이제 doctor 가 출력한 sync 명령으로 복구합니다 (`t314-plugin-reinstall-doctor.test.ts:160-185`).
- sync 가 contribution 을 지울 때 `stripRecordedAdds` 는 객체형 `consumes` 와 `scopes` 도 처리합니다 (`core/tools/aidlc-plugin.ts:1421-1446`, `:1768-1808`). 2.10.1 에서 추론했던 출처 기록 손실 문제는 2.11.3 코드에 없습니다.

### 6.5 doctor 의 plugin 행

| 행 | 판정 |
|---|---|
| Enabled plugins / Plugin selection flags | Enabled plugins 는 정보 행입니다. `harness.json` 과 graph 의 `enabled` 가 다르면 selection flags 행이 hard fail (`core/tools/aidlc-utility.ts:4897-4938`) |
| Enabled stage compile coverage | selection 이 있을 때 켜진 stage 파일이 graph 에 없으면 hard fail. selection 이 없으면 advisory (`:4975-4998`) |
| **Composed plugin surface** | plugin stage 가 graph 에 없거나, sidecar 가 손상됐거나, 기록된 target 이 없거나, 기록된 adds 나 fragment 가 사라졌으면 실패. persona 와 native twin 의 fragment 도 봅니다. fix 문구는 host 별 sync 명령입니다 (`:5000-5085`, `:1660-1666`) |
| Hook drops | `plugin-compose-*.drops` 에 `[degraded]` 가 있으면 실패 (`:5484-5503`). 하루 안의 비-advisory 기록은 "Hook failures, the latest within the last day" warn (`:5543-5552`) |
| Plugin selection vs active workflows · dropped ordering edges | 각각 hard fail · advisory (`:5087-5113`) |
| Plugin checks | `tools/<plugin>-doctor.ts` 결과 (`:2621-2660`) |
| "Plugins:" (inventory) | attention 이나 sync drift 가 있으면 warn. host 목록이 없는 Kiro · Cursor · Copilot · OpenCode 에서는 **pass**: "Plugins: `<name ver>` in this project (no host plugin list to compare versions with)" (`core/tools/aidlc-doctor.ts:225-272`) |

---

## 7. 새 plugin 만들기 — 이 워크스페이스의 절차

전체 명령은 저장소 `README.md` 가 맡습니다. 어느 도구로 돌리는지는 "Which tools", 배포는 "Distribute", 적용과 판정은 "Apply" 를 보세요. 아래는 순서만 보여 줍니다.

```bash
T=<대상 release 의 tools>   # 그 release 의 aidlc 로 만든 트리의 <harness>/tools, 또는 그 tag 체크아웃에 생성 데이터(plugin-targets.json, data/plugin-hooks-template/)가 있는 것
bun $T/aidlc-plugin-create.ts <name> ./<name>
# … 작성 …
bun $T/aidlc-plugin-validate.ts ./<name>                           # base 위에 짓는 plugin 은 --with <base-root>
uv run python scripts/check-plugin-anchors.py --pre "$TARGET" --plugin-root <name>   # contribution 이 있을 때
bun $T/aidlc-plugin-build.ts   ./<name> claude /tmp/build-<name>   # build 할 harness 마다 반복
bun $T/aidlc-plugin-test.ts    ./<name> --install <설치 트리의 일회용 사본> --harness <claude|codex|kiro-ide|kiro>
uv run python scripts/check-plugin-anchors.py --post "$TARGET" --plugin-root <name>  # sync 로 설치한 뒤
uv run python scripts/package-plugin.py --tools "$T" --out <저장소 밖> <name>        # harness 마다 zip 하나
```

- `T` 는 `aidlc --version` 과 같은 release 여야 합니다. build 는 실행한 도구가 가진 compose hook 과 Kiro IDE hook 등록을 복사합니다. 생성 데이터가 없는 체크아웃에서는 build 가 `bundled plugin target table is missing` 으로 멈춥니다(`core/tools/aidlc-plugin-build.ts:30-35`, `:153-160`).
- create 의 이름은 kebab-case 이고 대상 폴더 이름과 같아야 합니다. 생성물에는 `hooks/compose.ts` 가 없습니다(`docs/harness-engineering/10-authoring-a-plugin.md:591-599`).
- 새 plugin 은 `README.md` 의 plugin 목록과 `CANONICAL.md` 의 asset 목록에도 올립니다.

체크리스트 (위반해도 조용히 지나가는 것부터):

- [ ] `adds` 목록은 block 형식이고 **정확히 4칸 들여쓰기**입니다. inline `[a,b]` 는 아무 기록 없이 무시됩니다. 들여쓰기가 틀린 block 은 "parsed N of M" drop 으로 남습니다(`compose.ts:2792-2799`).
- [ ] anchor 의 step 번호는 정수이고, 그 번호의 **제목**이 의도한 step 인지 대상 버전의 core stage 에서 읽어 확인했습니다. `### Step 4-8` 같은 범위 heading 도 맞는 것으로 칩니다(`compose.ts:2125-2134`).
- [ ] 새 stage 에 `scopes:` 가 있습니다. 없으면 어디서도 실행되지 않습니다(`10-authoring-a-plugin.md:143`).
- [ ] 새 stage 는 phase 의 맨 끝에 붙는다는 것을 전제로 설계했습니다(`core/tools/aidlc-graph.ts:2821-2824`).
- [ ] `mode: inline` 이고 `reviewer` 가 없습니다. 그렇지 않다면 Kiro CLI(agent-v1 JSON + `trustedAgents`)와 Codex(agent TOML)용 native agent surface 를 손으로 준비합니다.
  - Kiro IDE 에서는 plugin 자신의 agent 에 compose 가 surface 를 붙여 줍니다(`18-plugin-mechanism.md:607-614`).
  - OpenCode·Copilot 에서는 plugin persona 가 native twin 으로 살아남으면 됩니다(`18-plugin-mechanism.md:621-623`).
  - 검사 대상은 `.kiro` · `.codex` · `.aidlc` 뿐이고, Claude 와 Cursor 는 검사하지 않습니다(`compose.ts:1508-1514`).
- [ ] contribution frontmatter 에 **`bundle:` 이 없습니다.** 있으면 compose 가 파일 전체를 skip 하고 degraded drop 을 남깁니다(`compose.ts:2743-2748`). 그래서 test 는 FAILED, sync 는 rollback 됩니다. validator 는 contribution 의 `bundle:` 을 잡지 못합니다.
- [ ] `fragments` 항목은 `anchor` 다음 줄에 `order` 가 옵니다(`compose.ts:2935`). 순서가 바뀌면 짝 없는 prose block 이 drop 으로 남습니다(`compose.ts:2971-2974`).
- [ ] produce 하는 artifact 이름에 모두 `<name>-` 접두사가 있습니다. contribution 의 `adds.produces` 도 포함입니다(`core/tools/aidlc-plugin-validate.ts:991-997`, `:1090-1098`).
- [ ] 테스트와 fixture 는 `tests/` 에 있습니다. validator 는 `tools/` 아래의 `tests/`·`fixtures/`·`*.test.ts` 를 막습니다(`aidlc-plugin-validate.ts:1306-1313`). compose 는 `__tests__/`·`*.spec.ts` 까지 막습니다(`compose.ts:903-911`).
- [ ] sensor manifest 는 `sensors/aidlc-<id>.md` 이고, 스크립트 basename 은 `aidlc-sensor-<id>.ts` 입니다(`core/tools/aidlc-sensor.ts:390-394`).
- [ ] `hooks/compose.ts` 를 vendor 하지 않습니다. build 가 주입하고, validate 는 warning `compose-hook-absent` 하나만 냅니다(`aidlc-plugin-validate.ts:1342-1356`).
- [ ] 엔진 명령은 `{{INVOKE}} engine …` 으로 씁니다. 2.11.3 compose 는 복사하는 모든 `.md` 와 fragment 의 `{{INVOKE}}`·`{{TOOL_PREFIX}}`·`{{HARNESS_DIR}}` 를 설치 채널에 맞게 바꿉니다(`compose.ts:125-145`, `:1811-1813`, `:2966`). native 에서는 `aidlc`, copy 채널에서는 `bun <h>/tools/aidlc.ts` 가 됩니다(`core/tools/aidlc-command.ts:745-756`).
- [ ] skill, MCP 서버, memory, 루트 파일은 seam 으로 실을 수 없습니다. 이 저장소에서는 `<plugin>/prerequisites/` 에 두고, compose 뒤에 AI 가 따르는 `INSTALL.md` 로 설치합니다. `package-plugin.py` 가 `prerequisites/` 와 `install/<도구>.md`(→ `INSTALL.md`)를 zip 에 함께 넣습니다.
- [ ] `test` 는 `CLEAN` 입니다. advisory 를 포함해 drop 이 하나라도 있으면 FAILED 이므로, CLEAN 이면 Drops 0 입니다(`core/tools/aidlc-plugin-test.ts:673-681`). compose 를 직접 돌렸다면 drops 파일이 0개인지 확인합니다. exit code 는 증거가 아닙니다.

---

## 8. 이 저장소의 plugin 을 현재 엔진에 대어 본 결과

2026-11-06, AI-DLC v2.11.3(`a8721be36`) 도구의 `aidlc-plugin-validate.ts` · `aidlc-plugin-test.ts` 로 측정했습니다.

| plugin | 버전 | 종류 | validate | test (claude · codex · kiro-ide · kiro) |
|---|---|---|---|---|
| `visual-mockups` | 0.2.2 | overlay-only | **VALID**, warning `compose-hook-absent` 1개 | CLEAN ×4 |
| `ua-plugin` | 0.4.2 | overlay-only | **VALID**, warning `compose-hook-absent` 1개 | CLEAN ×4 |
| `graphify-plugin` | 0.2.2 | overlay-only | **VALID**, warning `compose-hook-absent` 1개 | CLEAN ×4 |
| `project-overview` | 0.1.2 | stage 추가 | **VALID**, warning `compose-hook-absent` 1개 | CLEAN ×4 |
| `requirements-handoff` | 0.2.2 | scope·stage 추가 | **VALID**, warning `compose-hook-absent` 1개 | CLEAN ×4 |

**역사.** 0.1.0 시절의 overlay plugin 3개는 고정된 옛 `hooks/compose.ts` 덕분에 동작했습니다. contribution 에는 `bundle:` 과 `plugin:` 을 둘 다 적었습니다. `visual-mockups` 의 artifact 이름에는 `visual-mockups-` 접두사가 없었습니다(`mockup-visual-ref`). 2026-10-26 에 모두 현재 메커니즘으로 옮겼습니다. 지금은 다섯 plugin 모두 hook 을 싣지 않고, build 가 주입한 hook 으로 `aidlc engine plugin sync` 를 거쳐 설치됩니다. 고정 hook 으로 얹힌 0.1.0 트리를 올리는 방법은 각 plugin README 의 "Upgrading from 0.1.0" 에 있습니다.

overlay-only plugin 도 compose 가 남긴 sidecar(`plugin-contrib-` / `plugin-owned-` / `plugin-compose-<p>.json`)로 발견됩니다. 그래서 `tools/<plugin>-doctor.ts` 가 실행되고, 선택 대상도 됩니다(`core/tools/aidlc-utility.ts:993-1009`, `:2653`, `core/tools/aidlc-config-diagnostics.ts:2214-2223`, `18-plugin-mechanism.md:371-375`).

⇒ 새 plugin 은 `project-overview`·`ua-plugin` 방식으로 만듭니다. 현재 도구로 작성하고, compose hook 은 싣지 않으며, build 가 주입하게 둡니다.

---

## 9. 공식 문서와 코드가 다른 곳

v2.11.3 에서 해소된 것은 다음 일곱 가지라 표에서 뺐습니다: `after-questions` 미구현 명시, hook 의 sync 명령과 fallback, list 의 `run:` 안내, raw 복사 뒤 sync 의 재-compose, `required_sections` 비강제 명시, 새 stage 의 graph 위치, plugin 의 host 설치 이름.

| 문서의 서술 | 코드의 실제 |
|---|---|
| `bundle:` 은 "unused" (`18-plugin-mechanism.md:484-486`, `:517`). `10-authoring-a-plugin.md:128` 은 "rejected with an error" | stage 는 schema error 입니다(`core/tools/aidlc-stage-schema.ts:297-298`). contribution 은 compose 가 degraded drop 후 skip 하고(`compose.ts:2746-2747`), validator 는 아무것도 말하지 않습니다 |
| `aidlc` block 은 strict (`18-plugin-mechanism.md:146`) | `aidlc.contributes` 의 키와 `aidlc.marketplace` 만 검사합니다(`aidlc-plugin-validate.ts:215-224`, `:843-847`) |
| 동률은 slug 알파벳 순 (`docs/reference/15-stage-definition.md:98`) | 저자가 쓴 번호의 index(정수) 다음 slug 입니다(`core/tools/aidlc-graph.ts:2789-2796`). 10번 문서(`:131-141`)와 18번 문서(`:782`)는 코드와 맞습니다 |
| sensor 스크립트가 `tools/<id>.ts` (`18-plugin-mechanism.md:55`) | 모든 런타임에서 `aidlc-sensor-<id>.ts` 가 필요합니다(`core/tools/aidlc-sensor.ts:390-394`). 10번 문서(`:50-51`)는 맞게 씁니다 |
| `core-*` 이름 예약 (`18-plugin-mechanism.md:673`) | `core-*` 를 강제하는 코드는 없습니다. 예약된 것은 plugin 이름 `core` · `aidlc` · `aidlc-*` 뿐입니다(`aidlc-plugin-validate.ts:378-386`) |
| dispatch 검사 대상이 Kiro CLI · Codex · OpenCode · kiro-ide (`18-plugin-mechanism.md:590-626`) | Copilot 도 검사합니다(`.aidlc` 는 OpenCode 와 Copilot, `compose.ts:1296-1300`, `:1508-1514`). Claude 와 Cursor 는 검사하지 않습니다 |
| `after-step` 이 "다음 heading 앞" 에 들어감 (`18-plugin-mechanism.md:529`) | 정확히는 다음 `##` 또는 `###` 앞입니다. `####` 에서는 멈추지 않습니다(`compose.ts:2138`). 10번 문서(`:253`)는 맞게 씁니다 |
| compose 가 `{{HARNESS_DIR}}` 만 치환 (`18-plugin-mechanism.md:164`, `:312`) | `{{INVOKE}}` · `{{TOOL_PREFIX}}` 도 치환합니다(`compose.ts:125-145`, `:1811-1813`, `:2966`). 설치 측 `projectInvocationTokens` 는 `{{TRUSTED_NAMESPACE}}` 도 바꿉니다(`core/tools/aidlc-command.ts:745-756`) |
| `tools/` 의 테스트 payload 는 `tests/` · `fixtures/` · `*.test.ts` (`10-authoring-a-plugin.md:646-647`) | validator 는 그대로 검사합니다(`aidlc-plugin-validate.ts:1306-1313`). compose 는 `__tests__/` 와 `*.spec.ts` 도 거부합니다(`compose.ts:903-911`). validate 를 통과해도 test 가 FAILED 일 수 있습니다 |

---

## 10. 다시 검증하는 법

엔진을 올렸으면 아래 순서로 이 문서를 다시 맞춰 보세요.

1. plugin 관련 파일이 바뀌었는지 봅니다. 비교 대상은 `origin/main` 이 아니라 **대상 release tag** 입니다(예: `v2.11.3` = `a8721be36`).
   ```bash
   git -C <engine> diff --stat <이 문서의 commit> <대상 release tag> -- \
     scripts/plugin-hooks-template 'core/tools/aidlc-plugin*.ts' core/tools/aidlc-stage-schema.ts \
     core/tools/aidlc-graph.ts core/tools/aidlc-sensor.ts core/tools/aidlc-command.ts \
     core/tools/aidlc-config-diagnostics.ts \
     docs/reference/18-plugin-mechanism.md docs/reference/15-stage-definition.md \
     docs/harness-engineering/10-authoring-a-plugin.md
   ```
   - glob 은 git pathspec 이므로 **반드시 따옴표로 감쌉니다.** zsh 는 따옴표 없는 glob 이 맞는 파일을 못 찾으면 명령을 실행하지 않습니다("no matches found").
2. 대상 release 의 tools(§7 의 `T`)로 이 저장소의 5개 plugin 에 validate 와 test 를 다시 돌려 §8 표를 갱신합니다. test 는 `--harness claude` · `codex` · `kiro-ide` · `kiro` 네 번입니다.
3. 엔진의 회귀 테스트를 1차 근거로 봅니다.
   - `tests/integration/t188-plugin-compose.serial.test.ts` — compose
   - `tests/integration/t224-plugin-selection.test.ts` — selection
   - `tests/integration/t314-plugin-reinstall-doctor.test.ts` — 재설치와 doctor
   - `tests/unit/t314-plugin-validate.test.ts` · `t315-plugin-build.test.ts` · `t316-plugin-test.test.ts` · `t317-plugin-create.test.ts` — validate · build · test · create
     - 같은 번호에 plugin 과 무관한 파일이 섞여 있으니 번호가 아니라 파일 이름으로 찾습니다(`t314-minimal-scope-performance` 등).
   - `tests/unit/t242-plugin-state.test.ts` — inventory · stamp · sync rollback · prune
   - `tests/unit/t313-plugin-doctor-checks.test.ts` — `<plugin>-doctor.ts` 실행
   - `tests/unit/t354-plugin-dependencies.test.ts` — base plugin
   - `tests/unit/t262-plugin-sensor-name-guard.test.ts` — sensor 이름
   - `tests/unit/t222-plugin-runner-naming.test.ts` — runner 이름
   - `tests/unit/t-native-plugin-test.test.ts` — native 설치의 `aidlc plugin test`
   - `tests/integration/t300-plugin-kit.test.ts` — 재사용 kit
   - `tests/integration/t327-plugin-author-routes.test.ts` — `aidlc plugin validate|build|test`
   - `tests/integration/t353-parallel-plugin-sync.test.ts` — 병렬 sync
   - `tests/integration/t-plugin-select-harness-dir.test.ts` — harness 디렉터리별 select
4. 문서 전체를 다시 맞출 때 쓴 방법(2026-11-06, 759 → 996줄):
   - 대상 태그를 `git -C <engine> archive <tag> | tar -x -C <scratch>` 로 풉니다. 로컬 체크아웃의 HEAD 를 기준으로 쓰지 않습니다.
   - 문서를 절 단위로 나눠 구간마다 claim 을 HOLDS · CHANGED · GONE 으로 판정하고 새 줄 번호를 답니다. 고친 원고는 scratch 파일에 쓰고, 원본은 마지막에 한 번만 바꿉니다.
   - 조립한 뒤 엔진 경로를 붙인 `file:line` 인용을 모두 기계로 검사합니다(파일이 있는지, 줄 번호가 파일 길이 안인지). 표본으로 뽑은 인용은 그 줄을 열어 내용까지 확인합니다.
   - "X 부터" 라고 쓸 때는 `git log -S '<식별자>'` 와 `git tag --contains <commit>` 로 처음 들어온 태그를 찾습니다. 읽은 release 가 곧 도입 release 는 아닙니다.

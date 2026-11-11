# Canonical plugin source

이 저장소는 AI-DLC plugin authoring의 단일 정본입니다.

## Canonical location

`~/workspaces/platforms/aidlc/extensions/aidlc-plugins`

다음 자산은 이 저장소에서만 편집합니다.

- `visual-mockups` (0.2.0, 2026-10-26 — compose hook 없이 엔진의 현재 plugin 도구로 build · test 한다. artifact 이름을 `visual-mockups-` 로 바꿈, `prerequisites/`)
- `ua-plugin` (0.3.0, 2026-10-21 — compose hook 없이 엔진의 현재 plugin 도구로 build · test 한다. multi-repo 변환기, `prerequisites/`)
- `graphify-plugin` (0.2.0, 2026-10-26 — compose hook 없이 엔진의 현재 plugin 도구로 build · test 한다. 규칙 파일을 `knowledge` 로 싣고, multi-repo 변환기(repo 별 파일명), `prerequisites/`, `tests/`)
- `project-overview` (2026-09-30 추가 — stage 를 더하는 plugin 이라 엔진의 현재 plugin 도구로 build · test 한다)
- `requirements-handoff` (0.2.0, 2026-11-04 — 고객 워크숍용 plugin 을 범용으로 바꾼 것. scope 하나, prototype stage, 개발 요청서 stage(공개 양식 기반), RE 는 기존 코드에서만)
- `codekb-mcp-plugin` (0.1.0, 2026-11-10 — CodeKB 서비스(MCP `code-knowledge-base`)를 RE 의 색인과 requirements-analysis · functional-design 의 영향 범위 근거로 씀. overlay-only, 규칙 파일 하나, `prerequisites/INSTALL.md` 가 MCP 등록. agent 파일은 고치지 않음)
- plugin manifests, contributions, tools, knowledge, `prerequisites/` (pinned compose hook 은 이제 없다)
- anchor 검증과 MCP registry merge/policy scripts
- 배포 묶음: `scripts/package-plugin.py` 와 도구별 설치 절차 `install/claude-code.md` · `install/codex.md` · `install/kiro.md` (2026-10-31)

## Composition rules

- `ua-plugin`과 `graphify-plugin`은 상호 대체재이므로 한 트리에 동시에 적용하지 않습니다.
- `visual-mockups`는 선택한 code-map plugin 하나와 조합할 수 있습니다.
- plugin은 patch/unify의 상시 계층이 아니라 patch tree 생성 이후 선택적으로 compose합니다.
- compose 전에 pre-anchor 검증, compose 뒤 post-anchor 검증을 수행합니다.
- skill 과 MCP 는 plugin 이 실을 수 없으므로 각 plugin 의 `prerequisites/INSTALL.md` 를 AI 가 compose 뒤에 따릅니다.
- 배포는 도구별 zip 입니다. 프로젝트 루트에 풀면 harness 폴더 안(`<H>/aidlc-plugins/<p>/`)에 놓이고, AI 가 그 안의 `INSTALL.md` 를 따릅니다. harness 폴더나 사용자 도구 설정 밖에는 아무것도 두지 않습니다(RE 에 잡히지 않게).

## Workbench mirror

`~/workspaces/platforms/aidlc/patching/aidlc-patch-workbench/plugins`는 과거 workflow와 기록 재현을 위한 compatibility mirror입니다. active workflow는 `paths.env`의 `AIDLC_PLUGINS_ROOT`를 통해 이 canonical 저장소를 직접 사용합니다. mirror는 직접 편집하지 않습니다.

변경 순서:

1. 이 canonical 저장소에서 수정
2. plugin 자체 검증
3. workbench mirror 동기화
4. canonical과 mirror의 `diff -rq` 결과가 0인지 확인
5. patch staging tree에서 compose dry-run

## Baseline

Canonical 선언 시점의 Git HEAD:

`fcb1f33956dff1e1d684613291ca42f837b9a8ae`

이 HEAD는 `origin/main`보다 2 commits 앞서 있습니다. 원격 push는 별도 사용자 결정 전까지 수행하지 않습니다.

## Validation — 2026-09-07

Kiro 2.7.1 patched tree의 scratch 복사본에서 검증했습니다.

- manifest JSON 3개: PASS
- Python scripts compile: PASS
- compose hook 3개 SHA-256 동일: PASS
- canonical ↔ workbench mirror parity: PASS (`diff -rq` 0)
- `visual-mockups + ua-plugin`: pre/post anchors PASS, drops 0
- `visual-mockups + graphify-plugin`: pre/post anchors PASS, drops 0
- `ua-plugin + graphify-plugin`: prerequisite installer가 exit 1로 거부, PASS

검증은 scratch tree에서만 수행했으며 배포 트리 원본은 수정하지 않았습니다.

## Validation — 2026-10-26

AI-DLC v2.11.1 태그에서 packaging 한 claude · kiro-ide 트리의 scratch 복사본에서 검증했습니다.

- `visual-mockups` 0.2.0, `graphify-plugin` 0.2.0: validate `VALID`(compose-hook-absent 경고 1), build claude · kiro-ide · kiro 성공, `aidlc-plugin-test` `CLEAN`(drops 0, graph compiled, idempotent)
- `aidlc` 2.11.1 binary 의 `engine plugin sync`: 두 plugin 을 한 트리에 나란히 설치, post-anchor PASS, drops 0
- 0.1.0 이 얹힌 트리의 업그레이드: graphify 는 0.1.0 의 `tools/graphify-map.ts` 를 지운 뒤, visual-mockups 는 stage 파일 3개를 순정으로 되돌린 뒤 sync 해야 깨끗하다(각 README 의 "Upgrading from 0.1.0")
- 두 `prerequisites/INSTALL.md` 절차를 scratch 트리에서 그대로 실행: skill 복사, Figma skill fetch(`figma/mcp-server-guide@056adaf`), MCP 키 추가(기존 키 불변), doctor problem 수 불변
- `visual-mockups` 의 contribution 은 고객 전달본(2.11.0 실측)에서 고친 것을 들여왔다: 포인터를 매 실행 쓴다(`type: none`), HTML 경로는 프로젝트 루트 기준, code-generation 두 번째 anchor 는 `before-step:4`(`PART 2 — Generation` 앞 = 위임 전). 2.11.1 에서 다시 측정했다
- `aidlc config`(2.11.1, 세 harness 를 scratch 에 실제 설치): 더한 skill 과 `figma` MCP 키는 conflict 0 으로 보존된다(2.11.0 의 Kiro CLI `mcp.json` 충돌은 사라졌다). Kiro agent 파일 두 개에 `"@figma"` 를 더하면 그 두 파일만 `locally modified or unowned` 충돌이 된다
- `graphify-plugin` 을 repo 별 파일명으로 바꿨다(ua 0.4.0 과 같은 방식): 변환기 테스트 9개 통과, fragment 2개(`Developer Code Scan` · `Architect Synthesis` 앞), 설치된 변환기로 repo 두 개를 변환해 서로 덮지 않음, 고정 이름 0.2.0 빌드에서 sync 로 올리면 tool 이 교체됨
- `ua-plugin` 업그레이드 실측: 0.1.0(고정 hook) → 0.4.0 은 옛 `ua-code-map.ts` 를 지워야 sync 가 통과, 0.2.0(sync 설치) → 0.4.0 은 바뀌지 않은 tool 은 교체되고 손댄 tool 은 sync 가 exit 1 로 멈춘다
- `project-overview`: method 게시 3단계를 `onboard` 출력의 `id`·`sha256` 로 고침(`list --json` 에는 `sha256` 이 없음, `summarize` 실측 성공), 네 stage 의 Request Changes 를 protocol 형식(`--user-input "Request Changes"`)으로 고침
- `project-overview` 에 digest 를 더함(a2): 게시할 때마다 `aidlc/spaces/<space>/knowledge/aidlc-shared/project-overview.md`(요약 + 전문 경로 + 갱신한 intent·phase, 1 KB 미만)를 쓴다. 다음 intent 의 첫 directive(intent-capture)의 `inline_context_paths` 에 그 파일이 들어가는 것을 claude · kiro-ide 에서 확인했고(persona 바로 뒤), 위임 agent 의 preflight 도 그 폴더를 읽는다

## Validation — 2026-10-31

AI-DLC 2.11.2 binary, Claude Code 2.1.314, Codex 0.166.0 으로 `~/workspaces/labs/aidlc/aidlc-plugin-test/` 의 scratch 프로젝트에서 측정했습니다(그 폴더의 `README.md` 에 방법과 결과).

- 도구별 설치 경로: Claude Code(local marketplace + `--scope local`), Codex(사용자 범위 store), Kiro IDE · CLI(folder-drop + sync) 모두 compose `current`, drops 0, post-anchor PASS, doctor 문제 0, `aidlc config` 재실행 conflict 0
- RE 노출: 새 프로젝트 · 기존 코드 프로젝트 모두 project type, CodeKB source snapshot(`--paths ./`), source boundary 불변. 예외는 Codex 에서 stage 를 더하는 plugin 의 runner 가 `.agents/skills/` 에 놓여 source boundary 에 들어가는 것(AI-DLC 자신의 runner 도 같음, 엔진 쪽)
- 처음 계획에서 잡힌 자리: 루트 `aidlc-plugins/` 에 `tests/`·`.ts` 가 있으면 Brownfield, 루트 `.mcp.json` 과 `.agents/skills/` 는 source boundary → 설치 문서에서 피함
- hook 경로(사람이 실행): Codex TUI 는 폴더 신뢰와 AI-DLC hook 11개 신뢰만 묻고 plugin hook 은 따로 묻지 않고 실행, `codex exec` 는 plugin hook 을 돌리지 않음. Kiro IDE 는 첫 프롬프트에 compose hook 3개가 돌고 9초에 끝남
- AI 가 zip 안의 `INSTALL.md` 한 줄 지시만으로 `visual-mockups` + `ua-plugin` 을 끝까지 설치: Claude Code(Figma 포함), Codex(Figma 포함), Kiro CLI(HTML only). Kiro IDE 의 AI 설치와 업그레이드는 측정하지 않음

## Validation — 2026-11-01 (`requirements-handoff` 0.1.0)

AI-DLC 2.11.2 에서 측정했습니다.

- validate `VALID`(compose-hook-absent 경고 1), `aidlc-plugin-test` claude · codex · kiro-ide · kiro 모두 `CLEAN`(graph compiled, stage · scope 존재, 두 번째 compose 동일)
- zip 을 새 프로젝트에 풀고 AI 가 `INSTALL.md` 만 따라 설치: Claude Code, Kiro(kiro-ide zip, Kiro CLI 의 AI 로) 는 한 번에 `current`, drops 0, doctor 문제 0. RE 쪽 검사(project type, CodeKB, source boundary) 변화 없음
- Codex 는 `workspace-write` sandbox 가 `.agents/` 쓰기를 막아 첫 sync 가 `EPERM` 으로 롤백됨(stage · scope 를 더하는 plugin 만). sandbox 밖에서 같은 sync 는 성공 → `install/codex.md` 에 처리 방법을 적음. Codex 에서는 runner 4개가 source boundary 에 들어감(엔진 쪽, 알려진 것)
- 측정하지 않음: scope 를 처음부터 끝까지 실제로 돌리기(고객판 0.1.0 은 Kiro CLI 에서 12단계 완주가 측정됨)

## Validation — 2026-11-04 (`requirements-handoff` 0.2.0)

- RE contribution 과 `requirements-handoff-request-form` stage 추가. 개발 요청서의 절은 공개 문서(NCDIT IT Procurement Intake Form 안내, 과기정통부 공공SW사업 제안요청서 작성 예시, NIPA 요구사항 상세화 실무가이드)를 바탕으로 새로 짰고, 고객 양식은 쓰지 않음
- validate `VALID`, `aidlc-plugin-test` 4 harness `CLEAN`
- `intent create` 로 계획 확인: 코드 없음 → RE SKIP(greenfield) 10 stage, 코드 있음 → RE EXECUTE 11 stage, `--skip reverse-engineering` → SKIP. prototype · request-form 은 모두 EXECUTE
- 측정하지 않음: 개발 요청서 stage 를 실제로 돌려 내용 확인

## Validation — 2026-11-05 (rebuild on AI-DLC 2.11.3)

다섯 plugin 의 patch 버전을 올려(visual-mockups 0.2.1, ua-plugin 0.4.1, graphify-plugin 0.2.1, project-overview 0.1.1, requirements-handoff 0.2.1) 2.11.3 도구로 다시 build 했습니다. 소스 내용은 그대로이고 바뀐 것은 build 결과물입니다.

- validate 5개 `VALID`, `aidlc-plugin-test` 4 harness × 5 plugin 모두 `CLEAN`
- anchor: 2.11.3 순정 트리에서 visual-mockups 는 Read All Unit Artifacts · PART 2 — Generation · Generate Artifacts · Present Completion & Request Approval 에, ua/graphify 는 Developer Code Scan · Architect Synthesis 에 붙음
- 2.11.3 builder 는 Kiro IDE compose hook 에 `"timeout": 1800` 을 넣음. 이 build 를 2.11.3 프로젝트와 2.11.2 로 pin 한 프로젝트에 각각 풀고 sync 하면 doctor 문제 0
- 정정: 2026-11-01 의 "timeout 을 넣으면 doctor fail" 은 손으로 JSON 을 다시 쓴 탓이었음. doctor 는 builder 가 쓴 모양의 hook 만 plugin 것으로 알아봄
- `scripts/package-plugin.py --plain-name`: harness 하나만 묶을 때 `aidlc-<p>-<v>.zip`


## Validation — 2026-11-06 (설치 문서에서 python3 제거)

AI-DLC 네이티브 설치에는 Python 이 없고, 새 Mac 에서 `python3` 는 Command Line Tools 설치 창을 띄웁니다. 그래서 설치 절차가 Python 을 부르지 않게 바꿨습니다.

- `install/{kiro,claude-code,codex}.md` Step 1: harness 확인을 `python3 -c …` 에서 `cat <harness>/tools/data/harness.json` 을 읽는 방식으로 바꿈. 규칙에 "단계가 이름을 대지 않은 도구는 설치하지 않는다" 한 줄 추가
- `visual-mockups/prerequisites/INSTALL.md`: `mcp.json`·`config.toml` 문법 확인과 Kiro CLI agent 파일 확인도 `cat` 으로 읽고 AI 가 직접 판정
- 모든 zip 의 INSTALL.md 가 바뀌어 다섯 plugin 의 patch 버전을 올림: visual-mockups 0.2.2, ua-plugin 0.4.2, graphify-plugin 0.2.2, project-overview 0.1.2, requirements-handoff 0.2.2. 2.11.3 도구로 build
- validate 5개 `VALID`, `aidlc-plugin-test` 4 harness × 5 plugin 모두 `CLEAN`
- 설치 경로 측정(Kiro CLI 3.1.0 v3, kiro-ide 2.11.3 새 프로젝트, `python3`/`python` 을 호출 기록 후 127 을 내는 가짜로 PATH 앞에 둠): 대조 실행에서 AI 의 `python3 --version` 이 기록됨. 설치 실행에서 AI 는 `cat .kiro/tools/data/harness.json` 으로 확인했고 python 호출 0회, drops 0, 세 stage 에 sentinel 4개씩, doctor 문제 0 → 0
- 참고: kiro-cli 자체가 시작할 때 `python3 -c 'import sys; …version_info >= (3, 9)…'` 를 두 번 부름(AI-DLC 가 없는 폴더에서도). plugin 과는 무관
- Kiro IDE(macOS, aidlc 2.11.3 native, 새 kiro-ide 프로젝트)에서 워크숍 설치 프롬프트로 설치: AI 가 `cat .kiro/tools/data/harness.json` 으로 확인, python 호출 0, COMPOSED 0.2.2, `.drops` 없음, doctor 0 problems 0 warnings. 다른 세션이 잰 결과이고 여기서 다시 재지 않음
- 측정하지 않음: Windows/PowerShell. 다른 단계의 `grep`·`find`·`ls -d` 는 그대로라 PowerShell 에서는 AI 가 바꿔 써야 함

## Validation — 2026-11-06 (CLAUDE.md 점검, 메커니즘 문서 2.11.3 재검증)

- CLAUDE.md 점검을 Codex 와 교차 검토했습니다(1회, 5.5분, 지적 약 12개, 다시 확인한 결과 모두 맞음). 명령은 README 가 갖고, CLAUDE.md 는 README 를 가리킵니다. README 에 "Which tools — `<tools-dir>`" 절을 새로 냈습니다(대상 release 의 tools 를 쓸 것. 로컬 엔진 체크아웃은 2.11.1-preview+23 이었음)
- 바로잡은 것: MCP `disabled` 설명(Kiro 스크립트는 원본을 그대로 옮기고, plugin 설치는 `figma` 에 `disabled` 를 붙이지 않음), 없는 anchor 처리(직접 compose 는 exit 0, sync 는 거부), contribution 형식(구조만 있는 `adds` 도 있음), doctor 가 상태를 씀, `sync --help` 가 sync 를 실행함, overlay-only plugin 선택 가능(`v2.10.1-preview.20261004.1` 부터. 2.11.3 에서 `Known plugins: aidlc, visual-mockups` 측정)
- `docs/aidlc-v2-plugin-mechanism.md` 를 v2.11.3(`a8721be36`, 태그 export) 기준으로 다시 확인하고 고쳐 썼습니다(759 → 996줄). 엔진 경로를 붙인 인용 92개는 모두 파일 범위 안에 있고, 표본으로 뽑은 인용은 의미도 맞음. 주요 변경: base plugin(`dependencies`, `--with`), `requires_stage` 병합, 옛 fragment 제거, persona contribution, anchor `after-preflight`·`end-of-body`, 토큰 4개 치환, sensor `COULD_NOT_RUN`, inline 로드 순서, build 출력(`name` 이 `<name>` 그대로)
- 코드로 확인했고 실행하지는 않은 것: Kiro IDE hook 의 launcher fallback. sync 가 `[degraded]` 로 거부해도 compose.ts 가 transaction 없이 적용될 수 있음(`scripts/plugin-hooks-template/aidlc-plugin-compose.ts:78-110`)

## Validation — 2026-11-10 (codekb-mcp-plugin 0.1.0, ua-plugin 0.4.3)

이 기계의 `aidlc` 는 `2.11.4-preview.20261110.96` 입니다(stable 은 2.11.3). 두 release 의 `aidlc config` 로 만든 scratch 트리(`~/workspaces/labs/aidlc/aidlc-plugin-test/r2113/`, `r2114/`)에서 쟀습니다.

- `codekb-mcp-plugin` 0.1.0 (새 plugin): validate `VALID`(compose-hook-absent 경고 1). `--pre` 는 2.11.3 · 2.11.4 모두 Developer Code Scan · Architect Synthesis(RE), Determine Depth(requirements-analysis), Create Functional Design Plan(functional-design) 에 붙음. `aidlc-plugin-test` kiro-ide · claude × 두 release `CLEAN`(drops 0, graph compiled, idempotent)
- 실제 설치 경로: `package-plugin.py` 로 만든 kiro-ide zip 을 2.11.4 kiro-ide 트리에 풀고 `aidlc engine plugin sync`, 이어서 ua-plugin 도 sync. 두 plugin `--post` PASS(RE 에 sentinel 8개), doctor 0 problems(경고 4 → 5, 늘어난 것은 sync 가 쓴 `aidlc/` 기록의 uncommitted 경고)
- `ua-plugin` 0.4.3: Modernization Kit 사본(0.4.1)에만 있던 두 수정을 들여옴 — `.ua/` 무시를 `.git/info/exclude` 로도 인정(엔진의 source snapshot 은 `git check-ignore` · `ls-files --exclude-standard` 를 써서 둘 다 info/exclude 를 따름), merged workspace map 은 root 만 변환. 변환기 테스트 10/10, validate `VALID`, `aidlc-plugin-test` kiro-ide × 두 release `CLEAN`, 0.4.2 → 0.4.3 sync 는 fragment 를 제자리에서 바꾸고 `--post` PASS
- 측정하지 않음: CodeKB 서비스에 실제로 붙여 RE · requirements-analysis · functional-design 을 돌리기, 실제 Kiro 세션에서 서버 호출, Codex 서브에이전트의 MCP 접근
- workbench mirror(`aidlc-patch-workbench/plugins`)는 이 날 이전부터 크게 뒤처져 있음(requirements-handoff 없음, 옛 hook). 이번에도 동기화하지 않았음

## Validation — 2026-11-11 (codekb-mcp-plugin 0.1.3, live run against the CodeKB service)

원격 Linux 호스트(Kiro CLI 3.2.0, aidlc 2.11.3 native, 사내 계정 로그인)에서 public 레포 하나(labs CodeKB 에 READY 스페이스로 색인, HEAD = 색인 커밋)를 클론해 돌렸습니다. Mac 에서 tmux · 헤드리스 `kiro-cli chat --no-interactive --trust-workspace --trust-all-tools` 로 몰았고, OAuth 만 사람이 브라우저로 했습니다.

- 설치(AI 가 패키지 INSTALL.md 를 따름): 0.1.2 는 compose 는 되었으나 `.kiro/settings/mcp.json` 직접 쓰기가 `Blocked by a permission rule … Source: kiro-scope` 로 막혀 MCP 등록 실패(AI 는 우회하지 않고 보고). 0.1.3 은 `kiro-cli mcp add --scope workspace` 로 등록 성공, drops 0, sentinel 4/2/2, doctor 0 problems
- 원격 OAuth: 콜백 포트가 시도마다 무작위이고 리스너가 몇 분 뒤 닫혀, 링크 전달 중 두 번 만료(`ERR_CONNECTION_RESET`). `oauth.redirectUri` 로 포트를 고정하고 터널을 먼저 연 뒤 성공. 토큰은 원격 `~/.kiro` 에 남아 헤드리스 세션도 그대로 씀
- RE Step 1c: origin URL 로 스페이스를 찾고 확인을 물음 → `codekb-mcp-spaces.md`, orientation(`freshness current`), Overview 4종(커밋 기록 없음 → `unknown`) 기록. store 9개는 로컬 소스를 인용, 서비스 언급은 timestamp 한 줄. developer 서브에이전트는 knowledge 파일만 읽고 서비스를 직접 부르지 않음
- requirements-analysis Step 2b: 의미 검색 1회 + 로컬 확인 → 질문 파일과 `requirements.md`(Constraints 뒤)에 영향 범위 절. `show_dependencies` 는 부르지 않음
- functional-design Step 1b: requirements 목록에서 출발해 수정 위치 하나를 더 찾음(grep). 서비스는 새로 부르지 않음 → 0.1.3 에서 `show_dependencies` 를 명시. `functional-spec.md` §5 Integration points 에 유지/변경 표
- Kiro v3 는 MCP 도구를 필요할 때 불러옴(`Tool Load`): 첫 헤드리스 질의는 "서버 없음"으로 답함 → 0.1.3 에서 조건 문장을 "이름으로 찾아본 뒤 판단" 으로
- 측정하지 않음: 0.1.3 로 RE · RA · FD 를 다시 끝까지(바뀐 문장의 효과), 하이퍼스페이스, stale 스페이스, Kiro IDE, Claude Code · Codex
- 한 호스트에서는 Kiro overage 한도(`OverageLimitReachedError`)로 RE 중간에 멈췄고, 그 호스트의 aidlc 설치가 측정 중 다른 작업으로 지워져 다른 호스트에서 다시 함
- 재실행(0.1.3, 같은 호스트 · 같은 레포의 새 클론): AI 설치 끝까지 성공(`kiro-cli mcp add`, 원격 로그인 안내를 사람에게 전함), 저장된 토큰을 새 workspace 도 재사용. RE 의 "Changed since" 줄이 current 에서 빠짐. requirements-analysis 는 의미 검색 3회 + `show_dependencies` 4회로 `/api/*` 라우트까지 찾음(0.1.2 실행은 1회 · 0회 — 같은 문장에서 나온 편차). functional-design 은 `show_dependencies` 4회를 새로 불러 "incoming edges" 절을 씀(기본값으로 쥔 함수는 호출 간선이 없다는 것까지)

## Validation — 2026-11-11 (Kiro CLI 3.2.0 쓰기 경로, visual-mockups 0.2.3)

- AI 가 쓸 수 있는 곳(파일 쓰기 도구 / 셸): `.kiro/settings/**` 는 도구 ✗(`kiro-scope`) · 셸 됨(우회라 쓰지 않게 함), `.kiro/hooks/*` 는 둘 다 ✗(AI-DLC 가드) — 단 플러그인 zip 의 `aidlc-<p>-compose.json` 은 AI 의 `unzip -o … -d .` 로 풀림, `.kiro/skills/` · `.kiro/steering/` · `.kiro/aidlc-plugins/` · aidlc 가 아닌 `.kiro/agents/` 파일 · 루트는 둘 다 됨
- 그래서 영향받는 것은 `.kiro/settings/mcp.json` 을 쓰는 두 plugin 뿐: codekb-mcp-plugin(0.1.3 에서 고침), visual-mockups(figma). ua · graphify 의 skill 복사, install/kiro.md 의 unzip · sync 는 영향 없음
- `visual-mockups` 0.2.3: Kiro 에서 `kiro-cli mcp add --name figma … --scope workspace`, `.kiro/agents/aidlc*` 손 편집(`@figma`) 안내 삭제(2.11.1 #2535 부터 불필요, 하면 다음 `aidlc config` 가 멈춤), 옛 안내로 고친 트리의 복구 방법만 남김. validate `VALID`, `aidlc-plugin-test` kiro-ide · claude × 2.11.3 · 2.11.4 `CLEAN`. 측정하지 않음: Figma 경로를 AI 가 끝까지 따르는 설치(Figma Developer Terms 동의가 필요)

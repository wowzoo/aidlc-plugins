# Canonical plugin source

이 저장소는 AI-DLC plugin authoring의 단일 정본입니다.

## Canonical location

`~/workspaces/platforms/aidlc/extensions/aidlc-plugins`

다음 자산은 이 저장소에서만 편집합니다.

- `visual-mockups`
- `ua-plugin`
- `graphify-plugin`
- plugin manifests, contributions, tools, compose hooks
- anchor 검증과 MCP registry merge/policy scripts

## Composition rules

- `ua-plugin`과 `graphify-plugin`은 상호 대체재이므로 한 트리에 동시에 적용하지 않습니다.
- `visual-mockups`는 선택한 code-map plugin 하나와 조합할 수 있습니다.
- plugin은 patch/unify의 상시 계층이 아니라 patch tree 생성 이후 선택적으로 compose합니다.
- compose 전에 pre-anchor 검증, compose 뒤 post-anchor 검증을 수행합니다.

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

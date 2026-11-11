# Plugin tests

Keep plugin tests and fixtures under this directory. Do not place them under
`tools/`: composition copies `tools/` recursively into every install, so
test payloads there become shipped runtime files (issue #876).

This plugin lives outside the AIDLC repository, so `tests/harness/plugin-kit.ts`
is not importable here. Verify it with the shipped tools instead, as the
plugin's README shows: `aidlc-plugin-validate.ts` for content and
`aidlc-plugin-test.ts --install <project-root>` for compose integration against
a disposable copy of a real install.

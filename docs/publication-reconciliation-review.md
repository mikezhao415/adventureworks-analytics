# Publication documentation reconciliation review

Review date: October 27, 2026. This is an uncommitted review record and proposed issue text, not a posted GitHub update or issue-closure approval.

## Repository state and scope

- Base: `origin/main`, `2a1f989c5fd3cd2c3d2b1eb739319d4a5ad8d107` (PR #18 documentation reconciliation).
- Branch: `codex/publication-documentation-reconciliation`.
- Worktree: `C:/Users/Mike/Documents/MikeZhao/adventureworks-publication-docs`.
- Initial inspection found one AdventureWorks worktree, on `feature/16-adventureworks-dashboard-publication` at `688c4df749609025eeb9c7c06b24ee49e24323d5`, with 24 modified application/configuration files. No reconciliation branch or worktree existed locally or in fetched remote refs. Existing branches, recent commits and working-tree state were inspected before creating this separate worktree from fetched main. The original changes were preserved.
- Documentation changes: README, root and web AGENTS, extraction, dimensional modeling, quality automation, dashboard publication, sales dashboard and artifact review guides. Historical Issue #5/#6/#7 validation records received status banners; their results were retained. New files: [reproducibility](reproducibility.md) and this review record. No application, workflow, dataset, deployment configuration or license changes.

## Validation performed

- `git diff --check`: passed.
- Internal documentation check: 69 links/fragments across the 13 edited/new guidance files resolved. Referenced npm scripts, Python modules and script paths exist. Versions and workflow commands were compared with package files, lock files, CLI definitions and both CI workflows.
- Seven CLI `--help` checks passed using the existing Python 3.13 environment: extract, analytics, analytics_check, dashboard_export, check_dashboard_api, provision_reader and quality_check. No provisioning, extraction or pipeline was run by these checks.
- Checked-in aggregate byte length and SHA-256 match the unchanged artifact-review manifest. No source data or artifact was rewritten.
- Read-only HTTP checks returned 200 for the [dashboard](https://adventureworks.mikezhao.dev), [case study](https://mikezhao.dev/projects/adventureworks-analytics), [business page](https://mikezhao.dev/projects/adventureworks-analytics/business), and [technical page](https://mikezhao.dev/projects/adventureworks-analytics/technical). All three case-study pages contained dashboard and source-repository links.
- Live `/api/dashboard` reported `real_adventureworks`, snapshot `20261019T001836Z-ee2547d8e90749b68133c76a806f9e6f`, and six embedded passing export controls: summary 1, monthly 38, customer 19,119, territory 10, product 266 and category 4 rows. This observes the runtime payload, not a fresh upstream reconciliation.
- Live `/definitions` returned 200 and contained Microsoft and sample attribution text. These HTTP checks do not inspect deployed function artifacts or establish full visual, accessibility, security, metadata/sitemap or performance coverage.
- Independent read-only agent review checked the documentation diff and implementation. Its two final findings were corrected: clear the development override before launching the fixture, and describe HTTP reconciliation as needing the matching analytical database rather than source snapshots. Independent whitespace review passed.
- Not rerun: dependency installation, Python/dbt quality suites, source integration, fixture regeneration, web build/unit/E2E, hosted axe/keyboard/mobile or security checks. This change is documentation only; historical test outcomes remain explicitly historical.

## Remaining risks

The original backup acquisition URL/hash and independent asset-level licensing grant remain unverified. Redistribution is a conditional assessment for the exact approved aggregate, not blanket clearance. Numeric sample identifiers remain linkable. The repository's original code license remains unselected. Fresh full-pipeline reproduction and independent hosted accessibility/security/deployment-artifact evidence remain separate from link/runtime smoke checks. No commit, push, PR, issue update, merge, deployment or worktree cleanup was performed.

## Proposed Issue #8 update (not posted)

Publication has progressed beyond the issue's earlier remaining-scope notes:

- The reviewed historical AdventureWorks aggregate dashboard is published at https://adventureworks.mikezhao.dev. PR #17 completed aggregate publication; the earlier fixture-mode deployment evidence remains historical.
- The case study is published at https://mikezhao.dev/projects/adventureworks-analytics with `/business` and `/technical` reading paths. Read-only checks on October 27, 2026 returned HTTP 200 for all four pages; each case-study page links to the dashboard and source repository.
- The dashboard API currently identifies `real_adventureworks` with the reviewed snapshot and six embedded passing export-time reconciliation controls. Definitions includes Microsoft/sample attribution. This is runtime smoke evidence, not a new SQL Server-to-dashboard validation run.
- Documentation reconciliation is prepared locally and remains uncommitted for owner review. It adds `docs/reproducibility.md`, separating dashboard-only fixture/approved-aggregate use from the full SQL Server -> Python/Parquet -> DuckDB/dbt -> validated export path. Commands, prerequisites, versions and file references were checked against the repository; whitespace/link checks and independent read-only review passed.

Still unresolved or requiring separate evidence/approval:

- Fresh execution of the full reproduction guide has not been performed in this reconciliation. Historical local/CI results are retained with their original scope.
- Complete independent hosted E2E, accessibility/keyboard/mobile, security, deployed-artifact and final metadata/sitemap verification are not established by these HTTP checks. Assess existing acceptance evidence before marking those criteria complete.
- Original `.bak` acquisition URL/hash and independent asset-level licensing grant remain unverified. Preserve attribution, provenance caveats and the conditional redistribution conclusion. The exact approved aggregate exception does not clear other datasets; no repository code license has been selected.
- Documentation review/publication and explicit owner approval of issue closure remain outstanding. Keep Issue #8 open; this proposed update does not authorize merge, deployment or closure.

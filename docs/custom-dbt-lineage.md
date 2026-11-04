# Sales lineage viewer

The dashboard's `/lineage` route explores the ancestors of
`mart_sales_summary`: six dbt models, two sources and nine direct dependencies.
This is a custom React Flow viewer of reviewed dbt metadata. Dependencies come
only from model/source `depends_on.nodes`; SQL joins and test relationships do
not add transformation edges. Dashboard financial filters do not affect lineage.

## Explore the graph

Desktop shows a full-width fixed-layout graph with pan, zoom and fit controls.
Selection and All/Upstream/Downstream highlighting are shareable URL state and
support browser Back/Forward. Below the graph, two equal columns contain the
highlighting controls/node list and selected details. Editing, node dragging,
connections and deletion are disabled. The independent keyboard-accessible list
remains available if the graph fails.

At widths up to 900px, a labeled native eight-node selector replaces the graph.
React Flow is not mounted on mobile. The selector preserves selection and URL
history and displays details below it. Resizing keeps selection/highlight state;
pan and zoom remain local.

Details include model/source descriptions, materialization, columns/types,
direct dependencies and named test-definition disclosures. Missing descriptions
and empty test arguments are explicit. Descriptions render as plain text.
**Test definitions are not current execution results or passing statuses.**
Some checks involve resources beyond this focused graph; their scope is stated.
SQL, full manifests/catalogs, row data and environment details are not published.
The ingestion steps are contextual prose, not extra dbt nodes.

## Metadata and manual refresh

`apps/web/data/lineage/sales.json` contains the reviewed metadata snapshot.
`approval.json` pins its exact full-file and independently computed semantic
SHA-256 values. These are server-side files, outside `public/`; only the approved
viewer projection is passed to the client. The historical generation date,
source revision and content fingerprint are visible. This does not establish
live freshness, a new source reconciliation or a fresh dbt test run.

`scripts/build_custom_lineage.py` reads a locally reviewed manifest and verifies
its complete digest, dbt source fingerprint, historical analytical database and
evidence identity, and snapshot manifest. `scripts/lineage_inputs.py` holds the
read-only input checks. `docs/lineage/metadata-policy.json` pins the reviewed input
identity; `sales-lineage.json` declares the expected focused graph. Neither full
input manifests nor analytical databases are distributed with this feature.

After following the [full-source reproduction guide](reproducibility.md), a
maintainer with the required local reviewed evidence can run from the root:

```powershell
$lineageRevision = git rev-parse HEAD
python -m scripts.build_custom_lineage `
  --manifest <reviewed-manifest.json> `
  --analytics-root <analytics-evidence-root> `
  --revision $lineageRevision
```

The command writes a new ignored candidate and review record atomically under
`output/custom-lineage-review/candidates/`; it never approves, stages or publishes
metadata. Failed validation preserves the previous candidate pointer. Required
local evidence must exist: a clean checkout alone can display the checked-in
approved snapshot but cannot regenerate it. No source extraction or dbt execution
is performed by this command.

Refresh is manual. Changed source, manifest, provenance or metadata requires new
input verification and explicit review; do not update pins merely to pass a
check. Review the complete projected artifact for redistribution and sensitive
metadata. Independently verify canonical bytes, full-file/semantic hashes and
scope, then obtain explicit approval before copying exact bytes to the runtime
path and updating the approval record. Release authorization is separate. No
mandatory CI age/freshness enforcement or automatic promotion is added.

## Approval and packaging

`lib/lineage-validation.mjs` is the authoritative contract used by both the
runtime loader and build preflight. It requires approval schema version 1,
approval true, a trimmed nonempty review reference, exact full-file hash,
canonical JSON, independently recomputed semantic hash, strict metadata schema
and the expected graph. The semantic digest excludes only `content_sha256` and
`provenance.generated_at`. Invalid metadata fails closed with no fixture fallback.
The original approved review reference remains part of the immutable approval
record; it records the historical review and is not a deployment authorization.

`npm run build` runs `scripts/check-lineage-package.mjs` before and after Next.js.
The explicit public asset inventory accepts only reviewed notice paths/bytes;
emitted media accepts only the existing favicon. The policy inspects client and
server outputs and traces structurally for unapproved metadata, full dbt artifacts
and SQL fields. Traced data is allowlisted. These checks supplement human review;
they are not general information-flow proof for arbitrary future code.

The fictional contract fixture is never a production fallback. The artifact,
approval and existing financial aggregate are the permitted server data for the
lineage route. Raw artifact URLs are not public endpoints. The financial loader
and decimal-safe calculations remain separate.

## Dependencies and notices

React Flow is pinned to `@xyflow/react` 12.12.0 / `@xyflow/system` 0.0.83.
[Dependency provenance](lineage/custom-viewer-dependencies.json) records exact
versions, registry integrity, archive hashes and notice hashes. The
[served notices](../apps/web/public/notices/custom-lineage-dependencies.txt)
retain MIT, ISC and BSD-3-Clause copyright/license text, including reviewed peers
and type-only packages. This is a deliberate notice superset; visible React Flow
attribution remains. Do not remove notices when changing the presentation.

After installing the lockfile, verify versions, notice bytes and served content:

```text
python -m scripts.check_lineage_notices
```

Dependency upgrades require renewed inventory/notice review. The checker compares
the installed package and lockfile with the inventory; it does not fetch archives
or independently establish all legal obligations.

## Validation

From the root:

```text
python -m unittest discover -s tests -p test_custom_lineage.py -v
python -m scripts.check_lineage_notices
```

From `apps/web`:

```text
npm ci
npm run typecheck
npm test
npm run build
```

For production-mode browser checks against the reviewed sample:

```powershell
$env:AW_E2E_SAMPLE = '1'
npm run test:e2e
npm run evidence
```

Default browser tests use the fictional financial development fixture. The real
lineage artifact is still validated through the fixed loader. Keep browser and
evidence modes consistent. Do not build while a server uses the same `.next`.
Real screenshots/test reports remain ignored; tracked dashboard screenshots are
fictional. Use changed-file Prettier checks when reviewing a focused change, and
report any existing full-repository formatting failures separately.

The disposable fictional positive-packaging workflow is also available:

```text
node scripts/lineage-fixture-app.mjs
```

Its output gives the isolated app path. In that copy, run:

```text
node node_modules/@playwright/test/cli.js test --config playwright.lineage.config.ts
```

Coverage includes canonical/schema/hash/topology rejection, public inventory and
client/server contamination, desktop interactions, mobile selection, history,
keyboard disclosures and existing financial behavior. Physical-device, human
screen-reader and broader browser checks remain pending. Narrow column tables
scroll horizontally; complete hashes wrap. Automated axe checks do not establish
complete accessibility compliance.

Merging or deploying requires separate authorization. Before any future push,
verify current branch deployment behavior and divergence from `main`.

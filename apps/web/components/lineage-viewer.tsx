"use client";
import dynamic from "next/dynamic";
import {
  Component,
  type ReactNode,
  useState,
  useSyncExternalStore,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  highlighted,
  parseLineageQuery,
  type Lineage,
  type Mode,
} from "../lib/lineage";

const Canvas = dynamic(() => import("./lineage-canvas"), {
  ssr: false,
  loading: () => <p role="status">Loading interactive graph…</p>,
});
// Match the CSS breakpoint. SSR and hydration start with the selector, so a
// mobile visit never mounts (or briefly flashes) the desktop-only canvas.
const desktopQuery = "(min-width: 901px)";
function subscribeViewport(notify: () => void) {
  const media = window.matchMedia(desktopQuery);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
}
const desktopSnapshot = () => window.matchMedia(desktopQuery).matches;
const serverSnapshot = () => false;
export class GraphBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <p role="status">
        The interactive graph is unavailable. Use the node list and details
        below.
      </p>
    ) : (
      this.props.children
    );
  }
}
export default function LineageViewer({ doc }: { doc: Lineage }) {
  const desktop = useSyncExternalStore(
    subscribeViewport,
    desktopSnapshot,
    serverSnapshot,
  );
  const query = useSearchParams(),
    router = useRouter();
  const state = parseLineageQuery(new URLSearchParams(query.toString()));
  const node = doc.nodes.find((n) => n.id === state.node)!;
  const active = highlighted(doc, state.node, state.mode);
  const [graphFailed, setGraphFailed] = useState(false);
  const select = (id: string, mode: Mode = state.mode) => {
    if (id === state.node && mode === state.mode && !state.invalid) return;
    const next = new URLSearchParams({ node: id, mode });
    router.push("/lineage?" + next.toString(), { scroll: false });
  };
  const dependencies = (upstream: boolean) =>
    doc.edges
      .filter((e) => (upstream ? e.target === node.id : e.source === node.id))
      .map((e) =>
        doc.nodes.find((n) => n.id === (upstream ? e.source : e.target))!,
      );
  return (
    <>
      {state.invalid && (
        <p role="status">
          The link contains unsupported lineage parameters. Showing the sales
          summary and all dependencies.
        </p>
      )}
      {desktop && (
        <div
          className="lineage-canvas"
          aria-label="Sales dependency graph"
          aria-describedby="lineage-instructions"
        >
          <GraphBoundary>
            {graphFailed ? (
              <p role="status">
                The interactive graph is unavailable. Use the node list and
                details below.
              </p>
            ) : (
              <Canvas
                doc={doc}
                selected={node.id}
                mode={state.mode}
                onSelect={select}
                onFailure={() => setGraphFailed(true)}
              />
            )}
          </GraphBoundary>
        </div>
      )}
      <p className="lineage-announcement" role="status" aria-live="polite">
        Selected {node.name}.
        {desktop &&
          ` Highlighting ${state.mode} dependencies within the sales graph.`}
      </p>
      {desktop && (
        <p id="lineage-instructions" className="lineage-helper">
          Arrows point from a dependency to its dependent. Pan or zoom inside
          the graph, or use the controls. The node list offers the same
          exploration without gestures.
        </p>
      )}
      <div className="lineage-layout">
        {desktop ? (
          <div className="lineage-explore">
            <fieldset className="lineage-modes">
              <legend>Highlight dependencies</legend>
              <div className="lineage-segments">
                {(["all", "upstream", "downstream"] as const).map((mode) => (
                  <label key={mode}>
                    <input
                      type="radio"
                      name="highlight"
                      checked={state.mode === mode}
                      onChange={() => select(node.id, mode)}
                    />
                    <span>{mode[0].toUpperCase() + mode.slice(1)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <section aria-labelledby="lineage-list-title">
              <h2 id="lineage-list-title">Explore all nodes</h2>
              <ul className="lineage-node-list">
                {doc.nodes.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      aria-pressed={n.id === node.id}
                      onClick={() => select(n.id)}
                    >
                      {n.name}
                      <span>
                        {" "}
                        {n.kind}
                        {n.id === node.id ? " · Selected" : ""}
                        {state.mode !== "all" && active.has(n.id)
                          ? " · In highlighted path"
                          : ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        ) : (
          <div className="lineage-mobile-selector">
            <label htmlFor="lineage-node-select">Explore lineage nodes</label>
            <select
              id="lineage-node-select"
              value={node.id}
              onChange={(event) => select(event.target.value)}
              aria-describedby="lineage-mobile-help"
            >
              {doc.nodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name} · {n.kind}
                </option>
              ))}
            </select>
            <p id="lineage-mobile-help" className="lineage-helper">
              Choose a model or source to explore its details and dependencies.
              The interactive graph is available on larger screens.
            </p>
          </div>
        )}
        <section
          className="lineage-details"
          id="lineage-details"
          aria-labelledby="lineage-details-title"
          tabIndex={-1}
        >
          <h2 id="lineage-details-title">{node.name}</h2>
          <p className="lineage-node-kind">
            {node.kind}
            {node.materialization ? " · " + node.materialization : ""}
          </p>
          <p className="lineage-description">
            {node.description || "No description provided"}
          </p>
          {([true, false] as const).map((upstream) => (
            <section key={String(upstream)}>
              <h3>
                {upstream
                  ? "Direct upstream dependencies"
                  : "Direct downstream dependencies"}
              </h3>
              {dependencies(upstream).length ? (
                <ul>
                  {dependencies(upstream).map((n) => (
                    <li key={n.id}>
                      <button type="button" onClick={() => select(n.id)}>
                        {n.name}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>
                  No {upstream ? "upstream" : "downstream"} dependencies within
                  this published graph.
                </p>
              )}
            </section>
          ))}
          <h3>Columns</h3>
          {node.columns.length ? (
            <div
              className="lineage-columns"
              tabIndex={0}
              role="region"
              aria-label="Column metadata; scroll horizontally if needed"
            >
              <table>
                <caption>Declared column metadata for {node.name}</caption>
                <thead>
                  <tr>
                    <th scope="col">Column</th>
                    <th scope="col">Type</th>
                    <th scope="col">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {node.columns.map((c) => (
                    <tr key={c.name}>
                      <th scope="row">{c.name}</th>
                      <td>{c.type}</td>
                      <td>{c.description || "No description provided"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>No columns documented.</p>
          )}
          <h3>Test definitions</h3>
          <p>
            Definitions only. These are not current execution results or passing
            statuses. SQL is not published.
          </p>
          {node.tests.length ? (
            <ul className="lineage-tests">
              {node.tests.map((t) => (
                <li key={t.id}>
                  <details>
                    <summary>
                      <span>
                        {t.definition}
                        {t.column && (
                          <span className="lineage-test-column">
                            {" "}
                            · {t.column}
                          </span>
                        )}
                      </span>
                      <span
                        className="lineage-disclosure-icon"
                        aria-hidden="true"
                      />
                    </summary>
                    <div className="lineage-test-content">
                      <dl>
                        <dt>Test identifier</dt>
                        <dd>{t.id}</dd>
                        <dt>Definition scope</dt>
                        <dd>{t.scope}</dd>
                        <dt>Reviewed arguments</dt>
                        <dd>
                          {Object.entries(t.arguments).length ? (
                            <dl className="lineage-arguments">
                              {Object.entries(t.arguments).map(
                                ([key, value]) => (
                                  <div key={key}>
                                    <dt>{key}</dt>
                                    <dd>
                                      {Array.isArray(value)
                                        ? value.join(", ")
                                        : value}
                                    </dd>
                                  </div>
                                ),
                              )}
                            </dl>
                          ) : (
                            "No arguments declared."
                          )}
                        </dd>
                        <dt>Related nodes in this graph</dt>
                        <dd>
                          {t.related_nodes.length
                            ? t.related_nodes
                                .map(
                                  (id) =>
                                    doc.nodes.find((n) => n.id === id)!.name,
                                )
                                .join(", ")
                            : "None declared within this graph."}
                        </dd>
                      </dl>
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          ) : (
            <p>No attached test definitions.</p>
          )}
        </section>
      </div>
      <section className="lineage-provenance">
        <h2>Provenance and scope</h2>
        <p>{doc.scope}</p>
        <dl>
          <dt>Metadata generated (UTC)</dt>
          <dd>{doc.provenance.generated_at}</dd>
          <dt>Source revision</dt>
          <dd>{doc.provenance.source_revision}</dd>
          <dt>dbt Core</dt>
          <dd>{doc.provenance.versions["dbt-core"]}</dd>
          <dt>Content fingerprint</dt>
          <dd>{doc.content_sha256}</dd>
        </dl>
        <p>
          This is a manually generated snapshot of transformation metadata.
          Generation does not establish a new source reconciliation or current
          test success.
        </p>
        <h3>Ingestion context outside dbt lineage</h3>
        <p>
          {doc.context.join(" → ")}. These stages are context, not extra dbt
          dependency edges.
        </p>
        <a href="/notices/custom-lineage-dependencies.txt">
          Viewer dependency notices
        </a>
      </section>
    </>
  );
}

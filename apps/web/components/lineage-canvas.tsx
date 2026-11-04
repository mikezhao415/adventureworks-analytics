"use client";
import { useMemo } from "react";
import { ReactFlow, Controls, MarkerType, Position } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { highlighted, type Lineage, type Mode } from "../lib/lineage";

const positions: Record<string, [number, number]> = {
  sales_order_header: [0, 100],
  sales_order_detail: [0, 360],
  stg_sales_order_header: [200, 100],
  stg_sales_order_detail: [200, 360],
  fct_sales_orders: [400, 210],
  dim_date: [600, 30],
  fct_sales_order_lines: [600, 360],
  mart_sales_summary: [800, 210],
};
export default function LineageCanvas({
  doc,
  selected,
  mode,
  onSelect,
  onFailure,
}: {
  doc: Lineage;
  selected: string;
  mode: Mode;
  onSelect: (id: string) => void;
  onFailure: () => void;
}) {
  const active = useMemo(
    () => highlighted(doc, selected, mode),
    [doc, selected, mode],
  );
  const nodes = useMemo(
    () =>
      doc.nodes.map((n) => ({
        id: n.id,
        position: { x: positions[n.name][0], y: positions[n.name][1] },
        data: { label: n.name.replaceAll("_", "_\u200b") },
        selected: n.id === selected,
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        ariaLabel: `${n.name}, ${n.kind}${n.id === selected ? ", selected" : ""}`,
        className: active.has(n.id)
          ? "lineage-node"
          : "lineage-node lineage-subdued",
        style: { width: 180 },
      })),
    [doc, selected, active],
  );
  const edges = useMemo(
    () =>
      doc.edges.map((e) => ({
        ...e,
        id: e.source + "->" + e.target,
        markerEnd: { type: MarkerType.ArrowClosed },
        className:
          active.has(e.source) && active.has(e.target)
            ? "lineage-edge-active"
            : "lineage-edge-subdued",
        focusable: false,
        selectable: false,
      })),
    [doc, active],
  );
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      fitView
      minZoom={0.25}
      maxZoom={2}
      nodesDraggable={false}
      nodesConnectable={false}
      edgesReconnectable={false}
      deleteKeyCode={null}
      selectionOnDrag={false}
      multiSelectionKeyCode={null}
      selectNodesOnDrag={false}
      elementsSelectable
      nodesFocusable
      edgesFocusable={false}
      zoomOnDoubleClick={false}
      panOnScroll={false}
      // The default window-wide Space shortcut prevents native disclosures
      // outside the graph from toggling. Pointer pan and graph controls remain.
      panActivationKeyCode={null}
      preventScrolling
      onNodeClick={(_, n) => onSelect(n.id)}
      onNodesChange={(changes) => {
        const change = changes.find((c) => c.type === "select" && c.selected);
        if (change?.type === "select") onSelect(change.id);
      }}
      onError={onFailure}
      ariaLabelConfig={{
        "node.a11yDescription.default":
          "Press Enter or Space to inspect this node. Editing is disabled.",
        "controls.fitView.ariaLabel": "Fit/reset graph view",
        "controls.zoomIn.ariaLabel": "Zoom in",
        "controls.zoomOut.ariaLabel": "Zoom out",
      }}
    >
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}

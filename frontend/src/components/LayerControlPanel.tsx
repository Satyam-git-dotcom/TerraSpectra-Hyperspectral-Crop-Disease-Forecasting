import { FARM_PARCEL_METADATA } from "../data/farmBoundary";

export interface LayerToggles {
  boundary: boolean;
  quadrants: boolean;
  labels: boolean;
  corridors: boolean;
  pcaOverlay: boolean;
  diseaseHeatmap: boolean;
}

interface LayerControlPanelProps {
  toggles: LayerToggles;
  onToggleLayer: (layer: keyof LayerToggles) => void;
  pcaOpacity: number;
  onPcaOpacityChange: (opacity: number) => void;
  heatmapExtruded: boolean;
  onHeatmapExtrudedChange: (extruded: boolean) => void;
  riskThreshold: number;
  onRiskThresholdChange: (threshold: number) => void;
  filteredAcreage: number;
  totalVisibleCells: number;
  onJumpToHotspot: () => void;
}

export function LayerControlPanel({
  toggles,
  onToggleLayer,
  pcaOpacity,
  onPcaOpacityChange,
  heatmapExtruded,
  onHeatmapExtrudedChange,
  riskThreshold,
  onRiskThresholdChange,
  filteredAcreage,
  totalVisibleCells,
  onJumpToHotspot,
}: LayerControlPanelProps) {
  return (
    <aside
      className="tactical-panel font-mono reticle-corner"
      style={{
        position: "absolute",
        top: 74,
        left: 12,
        width: 350,
        maxHeight: "calc(100vh - 120px)",
        borderRadius: 10,
        padding: "16px",
        overflowY: "auto",
        zIndex: 15,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      {/* Parcel Metadata Header */}
      <div
        style={{
          borderBottom: "1px solid rgba(148, 163, 184, 0.12)",
          paddingBottom: 12,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 1.2,
              color: "#34d399",
              textTransform: "uppercase",
            }}
          >
            TARGET PARCEL OVERVIEW
          </span>
          <span
            style={{
              fontSize: 9.5,
              padding: "2px 6px",
              borderRadius: 4,
              background: "rgba(16, 185, 129, 0.2)",
              color: "#34d399",
              fontWeight: 700,
              border: "1px solid rgba(16, 185, 129, 0.4)",
            }}
          >
            GIS AUDIT: PASS
          </span>
        </div>

        <div
          style={{
            fontFamily: "Inter, sans-serif",
            fontSize: 15,
            fontWeight: 700,
            color: "#f8fafc",
            marginTop: 4,
          }}
        >
          {FARM_PARCEL_METADATA.shortName}
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "4px 8px",
            marginTop: 8,
            fontSize: 10.5,
            color: "#94a3b8",
            background: "rgba(15, 23, 42, 0.5)",
            padding: "8px",
            borderRadius: 6,
            border: "1px solid rgba(148, 163, 184, 0.1)",
          }}
        >
          <div>
            CRS: <span style={{ color: "#e2e8f0" }}>{FARM_PARCEL_METADATA.crs}</span>
          </div>
          <div>
            EXTENT: <span style={{ color: "#e2e8f0" }}>{FARM_PARCEL_METADATA.totalAcres} ac</span>
          </div>
          <div>
            GRID: <span style={{ color: "#e2e8f0" }}>201 × 201 px</span>
          </div>
          <div>
            BANDS: <span style={{ color: "#34d399" }}>220 channels</span>
          </div>
        </div>
      </div>

      {/* 3D Disease Risk Volumetric Heatmap Section */}
      <div
        style={{
          borderBottom: "1px solid rgba(148, 163, 184, 0.12)",
          paddingBottom: 14,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 11.5,
              fontWeight: 700,
              color: toggles.diseaseHeatmap ? "#f87171" : "#94a3b8",
              cursor: "pointer",
              userSelect: "none",
            }}
          >
            <input
              type="checkbox"
              checked={toggles.diseaseHeatmap}
              onChange={() => onToggleLayer("diseaseHeatmap")}
              style={{ accentColor: "#ef4444", cursor: "pointer", width: 14, height: 14 }}
            />
            🔥 3D DISEASE RISK HEATMAP
          </label>

          {toggles.diseaseHeatmap && (
            <span
              style={{
                fontSize: 10,
                padding: "2px 6px",
                borderRadius: 4,
                background: "rgba(239, 68, 68, 0.18)",
                color: "#f87171",
                border: "1px solid rgba(239, 68, 68, 0.35)",
                fontWeight: 600,
              }}
            >
              {filteredAcreage} ac ({totalVisibleCells} cells)
            </span>
          )}
        </div>

        {toggles.diseaseHeatmap && (
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
            {/* 3D Pillars vs 2D Flat View Mode */}
            <div style={{ display: "flex", gap: 6 }}>
              <button
                type="button"
                onClick={() => onHeatmapExtrudedChange(true)}
                style={{
                  flex: 1,
                  padding: "5px 8px",
                  borderRadius: 6,
                  border: heatmapExtruded
                    ? "1px solid rgba(239, 68, 68, 0.6)"
                    : "1px solid rgba(148, 163, 184, 0.15)",
                  background: heatmapExtruded
                    ? "rgba(239, 68, 68, 0.22)"
                    : "rgba(15, 23, 42, 0.5)",
                  color: heatmapExtruded ? "#fca5a5" : "#94a3b8",
                  fontSize: 10.5,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                3D Extruded Pillars
              </button>
              <button
                type="button"
                onClick={() => onHeatmapExtrudedChange(false)}
                style={{
                  flex: 1,
                  padding: "5px 8px",
                  borderRadius: 6,
                  border: !heatmapExtruded
                    ? "1px solid rgba(239, 68, 68, 0.6)"
                    : "1px solid rgba(148, 163, 184, 0.15)",
                  background: !heatmapExtruded
                    ? "rgba(239, 68, 68, 0.22)"
                    : "rgba(15, 23, 42, 0.5)",
                  color: !heatmapExtruded ? "#fca5a5" : "#94a3b8",
                  fontSize: 10.5,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                2D Surface Grid
              </button>
            </div>

            {/* Threshold Filter Slider */}
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 10.5,
                  color: "#cbd5e1",
                  marginBottom: 4,
                }}
              >
                <span>CONFIDENCE THRESHOLD:</span>
                <strong style={{ color: "#f87171" }}>
                  ≥ {Math.round(riskThreshold * 100)}%
                </strong>
              </div>
              <input
                type="range"
                min="0.0"
                max="0.85"
                step="0.05"
                value={riskThreshold}
                onChange={(e) => onRiskThresholdChange(parseFloat(e.target.value))}
                style={{
                  width: "100%",
                  accentColor: "#ef4444",
                  cursor: "pointer",
                }}
              />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 9.5,
                  color: "#64748b",
                  marginTop: 2,
                }}
              >
                <span>All Pixels (0%)</span>
                <span>Pre-visual (35%)</span>
                <span>Critical Hotspot (85%)</span>
              </div>
            </div>

            {/* Risk Spectrum Legend */}
            <div>
              <div
                style={{
                  height: 6,
                  borderRadius: 3,
                  background:
                    "linear-gradient(to right, #10b981 0%, #84cc16 25%, #f59e0b 55%, #ef4444 100%)",
                  boxShadow: "0 0 8px rgba(239, 68, 68, 0.2)",
                }}
              />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 9,
                  color: "#94a3b8",
                  marginTop: 3,
                }}
              >
                <span>Healthy (&lt;15%)</span>
                <span>Moderate (35-65%)</span>
                <span style={{ color: "#f87171", fontWeight: 700 }}>Severe (&gt;65%)</span>
              </div>
            </div>

            {/* Jump to Hotspot Action */}
            <button
              type="button"
              onClick={onJumpToHotspot}
              style={{
                marginTop: 2,
                padding: "6px 10px",
                borderRadius: 6,
                background: "rgba(239, 68, 68, 0.12)",
                border: "1px solid rgba(239, 68, 68, 0.4)",
                color: "#fca5a5",
                fontSize: 10.5,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                transition: "all 0.15s ease",
              }}
            >
              <span>🎯</span>
              <span>FOCUS ZONE B HOTSPOT (ROW 62, COL 138)</span>
            </button>
          </div>
        )}
      </div>

      {/* PCA False-Color Image Overlay */}
      <div
        style={{
          borderBottom: "1px solid rgba(148, 163, 184, 0.12)",
          paddingBottom: 14,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 11.5,
              fontWeight: 700,
              color: toggles.pcaOverlay ? "#a78bfa" : "#94a3b8",
              cursor: "pointer",
              userSelect: "none",
            }}
          >
            <input
              type="checkbox"
              checked={toggles.pcaOverlay}
              onChange={() => onToggleLayer("pcaOverlay")}
              style={{ accentColor: "#a78bfa", cursor: "pointer", width: 14, height: 14 }}
            />
            🌈 PCA FALSE-COLOR (PC1–3)
          </label>

          {toggles.pcaOverlay && (
            <span
              style={{
                fontSize: 10,
                padding: "2px 6px",
                borderRadius: 4,
                background: "rgba(167, 139, 250, 0.15)",
                color: "#c4b5fd",
                border: "1px solid rgba(167, 139, 250, 0.3)",
                fontWeight: 600,
              }}
            >
              {Math.round(pcaOpacity * 100)}% OPACITY
            </span>
          )}
        </div>

        {toggles.pcaOverlay && (
          <div style={{ marginTop: 10 }}>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={pcaOpacity}
              onChange={(e) => onPcaOpacityChange(parseFloat(e.target.value))}
              style={{
                width: "100%",
                accentColor: "#a78bfa",
                cursor: "pointer",
              }}
            />
            <div
              style={{
                marginTop: 6,
                fontSize: 9.5,
                color: "#94a3b8",
                lineHeight: 1.4,
                background: "rgba(15, 23, 42, 0.5)",
                padding: "6px 8px",
                borderRadius: 6,
                border: "1px solid rgba(167, 139, 250, 0.15)",
              }}
            >
              <span style={{ color: "#f87171" }}>R: PC1 (Vigor)</span> ·{" "}
              <span style={{ color: "#4ade80" }}>G: PC2 (Cell Structure)</span> ·{" "}
              <span style={{ color: "#60a5fa" }}>B: PC3 (Moisture)</span>
            </div>
          </div>
        )}
      </div>

      {/* Vector Geographical Layers */}
      <div>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 1.1,
            color: "#64748b",
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          CADASTRE & CROP BOUNDARIES
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 10px" }}>
          {[
            { key: "boundary", label: "Perimeter", icon: "🟩", color: "#34d399" },
            { key: "quadrants", label: "Zones A–D", icon: "🌾", color: "#38bdf8" },
            { key: "labels", label: "Zone Tags", icon: "🏷️", color: "#f8fafc" },
            { key: "corridors", label: "Canals / Roads", icon: "🛣️", color: "#94a3b8" },
          ].map(({ key, label, icon, color }) => {
            const checked = toggles[key as keyof LayerToggles];
            return (
              <label
                key={key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 11,
                  color: checked ? color : "#64748b",
                  cursor: "pointer",
                  userSelect: "none",
                  background: checked
                    ? "rgba(15, 23, 42, 0.6)"
                    : "rgba(15, 23, 42, 0.3)",
                  padding: "5px 7px",
                  borderRadius: 5,
                  border: checked
                    ? "1px solid rgba(255, 255, 255, 0.1)"
                    : "1px solid transparent",
                  transition: "all 0.15s ease",
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggleLayer(key as keyof LayerToggles)}
                  style={{ accentColor: color, cursor: "pointer" }}
                />
                <span>{icon}</span>
                <span>{label}</span>
              </label>
            );
          })}
        </div>
      </div>
    </aside>
  );
}

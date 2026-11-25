import { useMemo } from "react";
import type { HeatmapGridCell } from "../data/mockHeatmap";
import type { QuadrantProperties } from "../data/farmLayers";

interface TelemetryPanelProps {
  activeCell: HeatmapGridCell | null;
  activeQuadrant: QuadrantProperties | null;
  onClearActive: () => void;
}

// 7 key diagnostic spectral bands from 400 to 2500 nm
const SPECTRAL_BANDS = [
  { name: "Blue", nm: 450, healthyReflectance: 0.05, blightShift: 0.06 },
  { name: "Green", nm: 550, healthyReflectance: 0.12, blightShift: 0.10 },
  { name: "Red", nm: 670, healthyReflectance: 0.04, blightShift: 0.08 },
  { name: "Red-Edge", nm: 720, healthyReflectance: 0.38, blightShift: 0.21 }, // Critical inflection
  { name: "NIR", nm: 850, healthyReflectance: 0.58, blightShift: 0.36 }, // Mesophyll scattering
  { name: "SWIR-1", nm: 1650, healthyReflectance: 0.22, blightShift: 0.31 }, // Leaf water absorption
  { name: "SWIR-2", nm: 2200, healthyReflectance: 0.12, blightShift: 0.22 }, // Cellulose/lignin
];

export function TelemetryPanel({ activeCell, activeQuadrant, onClearActive }: TelemetryPanelProps) {
  // Compute simulated spectral reflectance profile for the active cell
  const spectralProfile = useMemo(() => {
    if (!activeCell) return null;
    const isDiseased = activeCell.predictedClass === 2;
    const severity = activeCell.blightProbability;

    return SPECTRAL_BANDS.map((b) => {
      let cellVal = b.healthyReflectance;
      if (activeCell.predictedClass === 0) {
        // Soil / road profile: gradually ascending linear curve
        cellVal = 0.1 + (b.nm / 2500) * 0.25;
      } else if (isDiseased) {
        // Linear interpolation towards stressed signature based on probability
        cellVal = b.healthyReflectance + (b.blightShift - b.healthyReflectance) * severity;
      }
      return {
        ...b,
        cellReflectance: Math.max(0.01, Math.min(0.7, cellVal)),
      };
    });
  }, [activeCell]);

  return (
    <aside
      className="tactical-panel font-mono reticle-corner"
      style={{
        position: "absolute",
        top: 74,
        right: 12,
        width: 380,
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
      {/* Target Inspector Header */}
      <div
        style={{
          borderBottom: "1px solid rgba(148, 163, 184, 0.12)",
          paddingBottom: 10,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span className={activeCell?.blightProbability && activeCell.blightProbability >= 0.65 ? "beacon-crimson" : "beacon-emerald"} />
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 1.2,
                color: activeCell?.blightProbability && activeCell.blightProbability >= 0.65 ? "#f87171" : "#38bdf8",
                textTransform: "uppercase",
              }}
            >
              CANOPY TELEMETRY INSPECTOR
            </span>
          </div>

          {(activeCell || activeQuadrant) && (
            <button
              type="button"
              onClick={onClearActive}
              style={{
                background: "rgba(15, 23, 42, 0.6)",
                border: "1px solid rgba(148, 163, 184, 0.2)",
                color: "#94a3b8",
                borderRadius: 4,
                padding: "2px 6px",
                fontSize: 10,
                cursor: "pointer",
              }}
            >
              CLEAR
            </button>
          )}
        </div>

        {activeCell ? (
          <div style={{ marginTop: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#f8fafc",
                }}
              >
                CELL [{activeCell.gridRow}, {activeCell.gridCol}]
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "2px 7px",
                  borderRadius: 4,
                  background:
                    activeCell.blightProbability >= 0.65
                      ? "rgba(239, 68, 68, 0.25)"
                      : activeCell.blightProbability >= 0.35
                      ? "rgba(245, 158, 11, 0.25)"
                      : "rgba(16, 185, 129, 0.2)",
                  color:
                    activeCell.blightProbability >= 0.65
                      ? "#f87171"
                      : activeCell.blightProbability >= 0.35
                      ? "#fbbf24"
                      : "#34d399",
                  border: `1px solid ${
                    activeCell.blightProbability >= 0.65
                      ? "rgba(239, 68, 68, 0.5)"
                      : activeCell.blightProbability >= 0.35
                      ? "rgba(245, 158, 11, 0.5)"
                      : "rgba(16, 185, 129, 0.4)"
                  }`,
                }}
              >
                {activeCell.riskLevel.toUpperCase()}
              </span>
            </div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
              ZONE: <strong>{activeCell.zone}</strong> · PREDICTED:{" "}
              <strong style={{ color: activeCell.predictedClass === 2 ? "#f87171" : "#34d399" }}>
                {activeCell.predictedClass === 2
                  ? "Pre-Visual Blight"
                  : activeCell.predictedClass === 1
                  ? "Healthy Canopy"
                  : "Soil/Road"}
              </strong>
            </div>

            {/* Probability and Stress Bar */}
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5 }}>
                  <span style={{ color: "#cbd5e1" }}>Fungal Blight Probability:</span>
                  <strong style={{ color: activeCell.blightProbability >= 0.65 ? "#f87171" : "#38bdf8" }}>
                    {(activeCell.blightProbability * 100).toFixed(1)}%
                  </strong>
                </div>
                <div
                  style={{
                    height: 5,
                    borderRadius: 3,
                    background: "rgba(15, 23, 42, 0.7)",
                    marginTop: 3,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${activeCell.blightProbability * 100}%`,
                      background:
                        activeCell.blightProbability >= 0.65
                          ? "linear-gradient(90deg, #f59e0b, #ef4444)"
                          : "linear-gradient(90deg, #10b981, #38bdf8)",
                      boxShadow: activeCell.blightProbability >= 0.65 ? "0 0 8px #ef4444" : "none",
                    }}
                  />
                </div>
              </div>

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5 }}>
                  <span style={{ color: "#cbd5e1" }}>Chemical Stress Index (Chlorophyll Shift):</span>
                  <strong style={{ color: "#fbbf24" }}>
                    {(activeCell.stressScore * 100).toFixed(1)}%
                  </strong>
                </div>
                <div
                  style={{
                    height: 5,
                    borderRadius: 3,
                    background: "rgba(15, 23, 42, 0.7)",
                    marginTop: 3,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${activeCell.stressScore * 100}%`,
                      background: "linear-gradient(90deg, #10b981, #f59e0b)",
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : activeQuadrant ? (
          <div style={{ marginTop: 6 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#f8fafc", fontFamily: "Inter, sans-serif" }}>
              {activeQuadrant.name} ({activeQuadrant.code})
            </div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
              Crop: <strong>{activeQuadrant.crop}</strong> ({activeQuadrant.variety})
            </div>
            <div style={{ fontSize: 11, color: "#94a3b8" }}>
              Acreage: <strong>{activeQuadrant.acres} ac</strong> · Irrigation:{" "}
              <strong>{activeQuadrant.irrigation}</strong>
            </div>
            {activeQuadrant.hasStressZone && (
              <div
                style={{
                  marginTop: 6,
                  padding: "4px 8px",
                  borderRadius: 4,
                  background: "rgba(239, 68, 68, 0.15)",
                  border: "1px solid rgba(239, 68, 68, 0.35)",
                  color: "#f87171",
                  fontSize: 10.5,
                }}
              >
                ⚠️ Historical Early Blight Pathogen Infiltration Zone
              </div>
            )}
          </div>
        ) : (
          <div style={{ marginTop: 6, fontSize: 11, color: "#94a3b8" }}>
            Hover or click any cell or quadrant on the 3D map for live spectral telemetry and diagnosis.
          </div>
        )}
      </div>

      {/* Interactive SVG Spectral Reflectance Curve */}
      {spectralProfile && (
        <div
          style={{
            borderBottom: "1px solid rgba(148, 163, 184, 0.12)",
            paddingBottom: 12,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#38bdf8", letterSpacing: 0.8 }}>
              SPECTRAL SIGNATURE (400–2500 NM)
            </span>
            <div style={{ display: "flex", gap: 8, fontSize: 9 }}>
              <span style={{ color: "#34d399" }}>■ Healthy</span>
              <span style={{ color: "#f87171" }}>■ Cell Target</span>
            </div>
          </div>

          {/* SVG Multi-Spectral Graph */}
          <div
            style={{
              background: "rgba(10, 15, 26, 0.7)",
              borderRadius: 6,
              padding: "8px 6px 4px 6px",
              border: "1px solid rgba(148, 163, 184, 0.1)",
            }}
          >
            <svg viewBox="0 0 320 120" style={{ width: "100%", height: 110, overflow: "visible" }}>
              {/* Grid Lines */}
              <line x1="20" y1="20" x2="310" y2="20" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
              <line x1="20" y1="50" x2="310" y2="50" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
              <line x1="20" y1="80" x2="310" y2="80" stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
              <line x1="20" y1="100" x2="310" y2="100" stroke="rgba(148,163,184,0.3)" />

              {/* Y Axis Labels */}
              <text x="16" y="23" fill="#64748b" fontSize="8" textAnchor="end">60%</text>
              <text x="16" y="53" fill="#64748b" fontSize="8" textAnchor="end">40%</text>
              <text x="16" y="83" fill="#64748b" fontSize="8" textAnchor="end">20%</text>
              <text x="16" y="103" fill="#64748b" fontSize="8" textAnchor="end">0%</text>

              {/* Healthy Vegetation Reference Curve */}
              {(() => {
                const points = spectralProfile
                  .map((p, i) => {
                    const x = 30 + i * 44;
                    const y = 100 - (p.healthyReflectance / 0.7) * 80;
                    return `${x},${y}`;
                  })
                  .join(" ");
                return (
                  <polyline
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="1.8"
                    strokeDasharray="4 2"
                    points={points}
                  />
                );
              })()}

              {/* Active Cell Reflectance Curve */}
              {(() => {
                const points = spectralProfile
                  .map((p, i) => {
                    const x = 30 + i * 44;
                    const y = 100 - (p.cellReflectance / 0.7) * 80;
                    return `${x},${y}`;
                  })
                  .join(" ");
                const strokeColor =
                  activeCell?.blightProbability && activeCell.blightProbability >= 0.65
                    ? "#ef4444"
                    : activeCell?.blightProbability && activeCell.blightProbability >= 0.35
                    ? "#f59e0b"
                    : "#38bdf8";

                return (
                  <>
                    <polyline
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth="2.5"
                      points={points}
                    />
                    {spectralProfile.map((p, i) => {
                      const x = 30 + i * 44;
                      const y = 100 - (p.cellReflectance / 0.7) * 80;
                      return (
                        <circle
                          key={p.name}
                          cx={x}
                          cy={y}
                          r="3"
                          fill={strokeColor}
                          stroke="#ffffff"
                          strokeWidth="1"
                        />
                      );
                    })}
                  </>
                );
              })()}

              {/* X Axis Band Labels */}
              {spectralProfile.map((p, i) => {
                const x = 30 + i * 44;
                return (
                  <text
                    key={p.name}
                    x={x}
                    y="114"
                    fill="#94a3b8"
                    fontSize="7.5"
                    textAnchor="middle"
                  >
                    {p.name === "Red-Edge" ? "R-Edge" : p.name}
                  </text>
                );
              })}
            </svg>
          </div>

          {/* Anomaly Callout */}
          <div
            style={{
              marginTop: 6,
              fontSize: 10,
              color:
                activeCell?.blightProbability && activeCell.blightProbability >= 0.65
                  ? "#fca5a5"
                  : "#94a3b8",
              lineHeight: 1.4,
              padding: "4px 8px",
              borderRadius: 4,
              background: "rgba(15, 23, 42, 0.4)",
            }}
          >
            {activeCell?.blightProbability && activeCell.blightProbability >= 0.65 ? (
              <span>
                ⚡ <strong>Red-Edge Shift & NIR Collapse:</strong> Foliar mesophyll cellular wall breakdown detected at 705–850nm.
              </span>
            ) : (
              <span>
                🌿 <strong>Normal Photosynthetic Peak:</strong> Strong Red absorption (670nm) and standard NIR reflectance plateau (850nm).
              </span>
            )}
          </div>
        </div>
      )}

      {/* Agronomic Precision Spraying ROI Card */}
      <div
        style={{
          borderBottom: "1px solid rgba(148, 163, 184, 0.12)",
          paddingBottom: 12,
        }}
      >
        <div style={{ fontSize: 10, fontWeight: 700, color: "#34d399", letterSpacing: 0.8, marginBottom: 6 }}>
          🌱 PRECISION SPRAYING IMPACT
        </div>

        <div
          style={{
            padding: "10px 12px",
            borderRadius: 8,
            background: "rgba(16, 185, 129, 0.08)",
            border: "1px solid rgba(52, 211, 153, 0.25)",
            fontSize: 11,
            lineHeight: 1.5,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ color: "#94a3b8" }}>Target Treatment:</span>
            <strong style={{ color: "#f87171" }}>4.87 acres in Zone B</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ color: "#94a3b8" }}>Broadcast Baseline:</span>
            <span style={{ color: "#cbd5e1" }}>998.33 acres</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ color: "#94a3b8" }}>Chemical Volume Reduction:</span>
            <strong style={{ color: "#34d399" }}>99.51% Saved</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ color: "#94a3b8" }}>Estimated Fungicide Savings:</span>
            <strong style={{ color: "#6ee7b7" }}>~$47,200</strong>
          </div>
          <div
            style={{
              marginTop: 6,
              paddingTop: 6,
              borderTop: "1px solid rgba(52, 211, 153, 0.15)",
              color: "#fcd34d",
              fontSize: 10.5,
            }}
          >
            ⏱️ <strong>Early Warning Lead Time:</strong> 21 days before foliar chlorosis or necrosis appears.
          </div>
        </div>
      </div>

      {/* GIS & Extraction Audit Parity */}
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#38bdf8", letterSpacing: 0.8, marginBottom: 6 }}>
          🛰️ GEODETIC AUDIT & PERFORMANCE
        </div>
        <div
          style={{
            padding: "8px 10px",
            borderRadius: 6,
            background: "rgba(15, 23, 42, 0.5)",
            border: "1px solid rgba(56, 189, 248, 0.15)",
            fontSize: 10.5,
            lineHeight: 1.5,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#94a3b8" }}>Max Geodesic Offset:</span>
            <strong style={{ color: "#34d399" }}>&lt; 0.063 m (PASS)</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#94a3b8" }}>Extraction Batch RAM:</span>
            <strong style={{ color: "#34d399" }}>1.29 MB (92.7% reduction)</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#94a3b8" }}>3D-CNN Model Accuracy:</span>
            <strong style={{ color: "#34d399" }}>99.23% (100% recall)</strong>
          </div>
        </div>
      </div>
    </aside>
  );
}

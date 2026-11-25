import { useEffect, useState } from "react";

export type CameraPreset = "hotspot" | "tactical" | "nadir" | "overview";
export type BasemapMode = "satellite" | "dark";

interface HeaderBarProps {
  basemapMode: BasemapMode;
  onBasemapChange: (mode: BasemapMode) => void;
  onCameraPreset: (preset: CameraPreset) => void;
  activePreset: CameraPreset;
  isLeftPanelOpen: boolean;
  isRightPanelOpen: boolean;
  onToggleLeftPanel: () => void;
  onToggleRightPanel: () => void;
}

export function HeaderBar({
  basemapMode,
  onBasemapChange,
  onCameraPreset,
  activePreset,
  isLeftPanelOpen,
  isRightPanelOpen,
  onToggleLeftPanel,
  onToggleRightPanel,
}: HeaderBarProps) {
  const [utcTime, setUtcTime] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const iso = now.toISOString(); // e.g. 2026-11-24T15:35:12.123Z
      const datePart = iso.slice(0, 10);
      const timePart = iso.slice(11, 19);
      setUtcTime(`${datePart} ${timePart} UTC`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header
      className="tactical-panel font-mono"
      style={{
        position: "absolute",
        top: 12,
        left: 12,
        right: 12,
        height: 52,
        borderRadius: 10,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 16px",
        zIndex: 20,
      }}
    >
      {/* Left: Branding & Status Beacon */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button
          type="button"
          onClick={onToggleLeftPanel}
          title={isLeftPanelOpen ? "Collapse Layer Controls" : "Expand Layer Controls"}
          style={{
            background: isLeftPanelOpen ? "rgba(56, 189, 248, 0.15)" : "rgba(15, 23, 42, 0.6)",
            border: isLeftPanelOpen
              ? "1px solid rgba(56, 189, 248, 0.4)"
              : "1px solid rgba(148, 163, 184, 0.2)",
            color: isLeftPanelOpen ? "#38bdf8" : "#94a3b8",
            width: 32,
            height: 32,
            borderRadius: 6,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            fontSize: 14,
            transition: "all 0.2s ease",
          }}
        >
          {isLeftPanelOpen ? "◀" : "▶"}
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Hexagonal Tactical Logo Mark */}
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background: "linear-gradient(135deg, #10b981 0%, #065f46 100%)",
              border: "1px solid #34d399",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 12px rgba(16, 185, 129, 0.4)",
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ffffff"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  fontFamily: "Inter, sans-serif",
                  fontWeight: 800,
                  fontSize: 14,
                  letterSpacing: 1.5,
                  color: "#f8fafc",
                }}
              >
                TERRASPECTRA
              </span>
              <span
                style={{
                  fontSize: 9.5,
                  letterSpacing: 1,
                  padding: "1px 6px",
                  borderRadius: 4,
                  background: "rgba(52, 211, 153, 0.15)",
                  color: "#34d399",
                  border: "1px solid rgba(52, 211, 153, 0.3)",
                  fontWeight: 700,
                }}
              >
                PRO v1.2
              </span>
            </div>
            <div
              style={{
                fontSize: 10,
                color: "#64748b",
                letterSpacing: 0.5,
                marginTop: -1,
              }}
            >
              HYPERSPECTRAL CANOPY SURVEILLANCE // 220 CHANNELS
            </div>
          </div>
        </div>

        {/* Status Indicator */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            padding: "3px 9px",
            borderRadius: 20,
            background: "rgba(15, 23, 42, 0.7)",
            border: "1px solid rgba(148, 163, 184, 0.15)",
            fontSize: 10.5,
            color: "#94a3b8",
            marginLeft: 8,
          }}
        >
          <span className="beacon-emerald" />
          <span>STREAM: NOMINAL</span>
          <span style={{ color: "#34d399" }}>· 10m GSD</span>
        </div>
      </div>

      {/* Center: Camera Perspective Presets */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          background: "rgba(15, 23, 42, 0.6)",
          padding: "3px",
          borderRadius: 8,
          border: "1px solid rgba(148, 163, 184, 0.15)",
          gap: 4,
        }}
      >
        <span
          style={{
            fontSize: 9.5,
            color: "#64748b",
            letterSpacing: 0.8,
            padding: "0 6px",
            textTransform: "uppercase",
            fontWeight: 600,
          }}
        >
          CAM
        </span>
        {[
          { id: "hotspot", label: "HOTSPOT B", icon: "🎯" },
          { id: "tactical", label: "3D TILT", icon: "📐" },
          { id: "nadir", label: "NADIR 2D", icon: "🗺️" },
          { id: "overview", label: "RESET", icon: "🔄" },
        ].map((item) => {
          const isActive = activePreset === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onCameraPreset(item.id as CameraPreset)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "4px 9px",
                borderRadius: 5,
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s ease",
                border: isActive
                  ? "1px solid rgba(56, 189, 248, 0.6)"
                  : "1px solid transparent",
                background: isActive
                  ? "rgba(56, 189, 248, 0.2)"
                  : "transparent",
                color: isActive ? "#38bdf8" : "#94a3b8",
              }}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Right: Basemap Selector, Mission Clock, Telemetry Toggle */}
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* Basemap Switcher */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            background: "rgba(15, 23, 42, 0.6)",
            padding: "3px",
            borderRadius: 7,
            border: "1px solid rgba(148, 163, 184, 0.15)",
            gap: 2,
          }}
        >
          <button
            type="button"
            onClick={() => onBasemapChange("satellite")}
            style={{
              padding: "4px 8px",
              borderRadius: 5,
              fontSize: 10.5,
              fontWeight: 600,
              cursor: "pointer",
              border: "none",
              background:
                basemapMode === "satellite"
                  ? "rgba(52, 211, 153, 0.25)"
                  : "transparent",
              color: basemapMode === "satellite" ? "#34d399" : "#64748b",
            }}
          >
            🛰️ SATELLITE
          </button>
          <button
            type="button"
            onClick={() => onBasemapChange("dark")}
            style={{
              padding: "4px 8px",
              borderRadius: 5,
              fontSize: 10.5,
              fontWeight: 600,
              cursor: "pointer",
              border: "none",
              background:
                basemapMode === "dark"
                  ? "rgba(56, 189, 248, 0.25)"
                  : "transparent",
              color: basemapMode === "dark" ? "#38bdf8" : "#64748b",
            }}
          >
            📡 RADAR DARK
          </button>
        </div>

        {/* UTC Mission Clock */}
        <div
          style={{
            fontSize: 11,
            color: "#94a3b8",
            background: "rgba(15, 23, 42, 0.7)",
            padding: "4px 10px",
            borderRadius: 6,
            border: "1px solid rgba(148, 163, 184, 0.12)",
          }}
        >
          <span style={{ color: "#38bdf8", marginRight: 6 }}>⏱️</span>
          {utcTime || "UTC CLOCK"}
        </div>

        {/* Right Telemetry Panel Toggle */}
        <button
          type="button"
          onClick={onToggleRightPanel}
          title={isRightPanelOpen ? "Collapse Telemetry" : "Expand Telemetry"}
          style={{
            background: isRightPanelOpen ? "rgba(52, 211, 153, 0.15)" : "rgba(15, 23, 42, 0.6)",
            border: isRightPanelOpen
              ? "1px solid rgba(52, 211, 153, 0.4)"
              : "1px solid rgba(148, 163, 184, 0.2)",
            color: isRightPanelOpen ? "#34d399" : "#94a3b8",
            width: 32,
            height: 32,
            borderRadius: 6,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            fontSize: 14,
            transition: "all 0.2s ease",
          }}
        >
          {isRightPanelOpen ? "▶" : "◀"}
        </button>
      </div>
    </header>
  );
}

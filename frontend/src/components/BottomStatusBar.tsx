interface BottomStatusBarProps {
  cursorCoord: { lon: number; lat: number } | null;
  pitch: number;
  bearing: number;
  zoom: number;
}

export function BottomStatusBar({ cursorCoord, pitch, bearing, zoom }: BottomStatusBarProps) {
  // Approximate conversion to UTM Zone 10N for tactical display
  const utmCoord = cursorCoord
    ? {
        easting: Math.round(247000 + (cursorCoord.lon - (-120.204547)) * 89000),
        northing: Math.round(4048000 + (cursorCoord.lat - 36.61624) * 111000),
      }
    : null;

  return (
    <footer
      className="tactical-panel font-mono"
      style={{
        position: "absolute",
        bottom: 12,
        left: 12,
        right: 12,
        height: 36,
        borderRadius: 8,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 16px",
        fontSize: 10.5,
        color: "#94a3b8",
        zIndex: 20,
      }}
    >
      {/* Left: GPS & UTM Coordinates */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: "#34d399" }}>📍 CURSOR:</span>
          {cursorCoord ? (
            <span style={{ color: "#f8fafc" }}>
              {cursorCoord.lat.toFixed(6)}°N, {Math.abs(cursorCoord.lon).toFixed(6)}°W
            </span>
          ) : (
            <span style={{ color: "#64748b" }}>HOVERING CANOPY...</span>
          )}
        </div>

        {utmCoord && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: "#38bdf8" }}>UTM 10N:</span>
            <span style={{ color: "#cbd5e1" }}>
              {utmCoord.easting}m E, {utmCoord.northing}m N
            </span>
          </div>
        )}

        <div>
          GSD: <span style={{ color: "#34d399" }}>10.0m / px</span>
        </div>
      </div>

      {/* Right: Camera Pitch, Bearing, Zoom, Engine Status */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div>
          ZOOM: <span style={{ color: "#e2e8f0" }}>{zoom.toFixed(1)}</span>
        </div>
        <div>
          PITCH: <span style={{ color: "#e2e8f0" }}>{Math.round(pitch)}°</span>
        </div>
        <div>
          BEARING: <span style={{ color: "#e2e8f0" }}>{Math.round(bearing)}°</span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            padding: "2px 8px",
            borderRadius: 4,
            background: "rgba(15, 23, 42, 0.6)",
            border: "1px solid rgba(148, 163, 184, 0.15)",
            fontSize: 9.5,
            color: "#34d399",
          }}
        >
          <span className="beacon-emerald" />
          <span>DECK.GL v9 · WEBGL2</span>
        </div>
      </div>
    </footer>
  );
}

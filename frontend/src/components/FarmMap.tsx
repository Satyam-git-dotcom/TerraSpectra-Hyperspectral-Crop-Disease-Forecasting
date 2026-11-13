import { useMemo, useState } from "react";
import DeckGL from "@deck.gl/react";
import { GeoJsonLayer, TextLayer } from "@deck.gl/layers";
import Map, { NavigationControl } from "react-map-gl/maplibre";
import type { MapViewState } from "@deck.gl/core";
import {
  FARM_BOUNDARY_GEOJSON,
  FARM_CENTER,
  FARM_PARCEL_METADATA,
} from "../data/farmBoundary";
import {
  FIELD_QUADRANTS_GEOJSON,
  IRRIGATION_CORRIDORS_GEOJSON,
  QUADRANT_LABELS_DATA,
  type LabelDatum,
  type QuadrantProperties,
} from "../data/farmLayers";

type BasemapMode = "satellite" | "dark";

interface LayerToggles {
  boundary: boolean;
  quadrants: boolean;
  labels: boolean;
  corridors: boolean;
}

const INITIAL_VIEW_STATE: MapViewState = {
  longitude: FARM_CENTER.longitude,
  latitude: FARM_CENTER.latitude,
  zoom: 13.8,
  pitch: 45,
  bearing: -15,
};

function createRasterStyle(id: string, tiles: string[], attribution: string) {
  return {
    version: 8 as const,
    sources: {
      [id]: {
        type: "raster" as const,
        tiles,
        tileSize: 256,
        attribution,
      },
    },
    layers: [
      {
        id: `${id}-layer`,
        type: "raster" as const,
        source: id,
        minzoom: 0,
        maxzoom: 19,
      },
    ],
  };
}

const SATELLITE_FALLBACK_STYLE = createRasterStyle(
  "esri-satellite",
  ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
  "Esri World Imagery"
);

const DARK_FALLBACK_STYLE = createRasterStyle(
  "carto-dark",
  ["https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"],
  "CARTO Dark Matter"
);

function getMapStyle(mode: BasemapMode) {
  const token = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;
  if (token && token.trim().length > 0) {
    const styleId = mode === "satellite" ? "satellite-streets-v12" : "dark-v11";
    return `https://api.mapbox.com/styles/v1/mapbox/${styleId}?access_token=${token.trim()}`;
  }
  return mode === "satellite" ? SATELLITE_FALLBACK_STYLE : DARK_FALLBACK_STYLE;
}

export function FarmMap() {
  const [viewState, setViewState] = useState<MapViewState>(INITIAL_VIEW_STATE);
  const [basemapMode, setBasemapMode] = useState<BasemapMode>("satellite");
  const [toggles, setToggles] = useState<LayerToggles>({
    boundary: true,
    quadrants: true,
    labels: true,
    corridors: true,
  });

  const mapStyle = useMemo(() => getMapStyle(basemapMode), [basemapMode]);

  const toggleLayer = (layer: keyof LayerToggles) => {
    setToggles((prev) => ({ ...prev, [layer]: !prev[layer] }));
  };

  const layers = useMemo(() => {
    const activeLayers = [];

    // 1. Field Quadrants (underneath)
    if (toggles.quadrants) {
      activeLayers.push(
        new GeoJsonLayer({
          id: "farm-quadrants-layer",
          data: FIELD_QUADRANTS_GEOJSON,
          filled: true,
          stroked: true,
          autoHighlight: true,
          highlightColor: [255, 255, 255, 45],
          getFillColor: (f) => (f.properties as QuadrantProperties).fillColor,
          getLineColor: [255, 255, 255, 80],
          getLineWidth: 1,
          lineWidthMinPixels: 1,
          pickable: true,
        })
      );
    }

    // 2. Central Irrigation & Access Corridors
    if (toggles.corridors) {
      activeLayers.push(
        new GeoJsonLayer({
          id: "farm-corridors-layer",
          data: IRRIGATION_CORRIDORS_GEOJSON,
          filled: true,
          stroked: true,
          getFillColor: [100, 116, 139, 140],
          getLineColor: [148, 163, 184, 200],
          getLineWidth: 1,
          lineWidthMinPixels: 1,
          pickable: true,
        })
      );
    }

    // 3. Outer Parcel Perimeter
    if (toggles.boundary) {
      activeLayers.push(
        new GeoJsonLayer({
          id: "farm-parcel-boundary",
          data: FARM_BOUNDARY_GEOJSON,
          filled: false,
          stroked: true,
          extruded: false,
          getLineColor: [52, 211, 153, 235],
          getLineWidth: 6,
          lineWidthMinPixels: 2,
          pickable: true,
        })
      );
    }

    // 4. Centroid Labels for Quadrants
    if (toggles.labels) {
      activeLayers.push(
        new TextLayer<LabelDatum>({
          id: "farm-quadrant-labels",
          data: QUADRANT_LABELS_DATA,
          getPosition: (d) => d.coordinates,
          getText: (d) => d.text,
          getSize: 12,
          getColor: [248, 250, 252, 240],
          getBackgroundColor: [15, 23, 42, 200],
          background: true,
          backgroundPadding: [8, 4],
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
          fontWeight: 600,
          billboard: true,
          sizeUnits: "pixels",
          pickable: false,
        })
      );
    }

    return activeLayers;
  }, [toggles]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <DeckGL
        viewState={viewState}
        onViewStateChange={({ viewState: next }) => setViewState(next as MapViewState)}
        controller={true}
        layers={layers}
        getTooltip={({ object }) => {
          if (!object) return null;
          const props = object.properties;

          // Quadrant tooltip
          if (props?.crop) {
            const q = props as QuadrantProperties;
            return {
              text: `${q.name} (${q.code})\nCrop: ${q.crop} (${q.variety})\nArea: ${q.acres} acres\nIrrigation: ${q.irrigation}${
                q.hasStressZone ? "\n⚠️ Historical Fungal Blight Anomaly Zone" : ""
              }`,
            };
          }

          // Corridor tooltip
          if (props?.widthMeters) {
            return {
              text: `${props.name}\nType: ${props.type}\nWidth: ${props.widthMeters} m`,
            };
          }

          // Parcel boundary fallback
          if (props?.acres) {
            return {
              text: `${props.name}\nArea: ~${props.acres} acres (${props.crs})`,
            };
          }

          return null;
        }}
      >
        <Map mapStyle={mapStyle} reuseMaps>
          <NavigationControl position="bottom-right" />
        </Map>
      </DeckGL>

      {/* Primary Telemetry & Controls HUD */}
      <div
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          padding: "14px 16px",
          borderRadius: 12,
          background: "rgba(9, 13, 22, 0.88)",
          backdropFilter: "blur(10px)",
          border: "1px solid rgba(52, 211, 153, 0.3)",
          width: 350,
          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)",
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.1, color: "#34d399" }}>
          TERRASPECTRA · WEEK 1 / DAY 4
        </div>
        <div style={{ fontSize: 16, fontWeight: 600, marginTop: 4 }}>
          {FARM_PARCEL_METADATA.shortName}
        </div>
        <div style={{ fontSize: 12, color: "#cbd5e1", marginTop: 6, lineHeight: 1.5 }}>
          <div>
            Area: <strong>{FARM_PARCEL_METADATA.totalAcres} acres</strong> · {FARM_PARCEL_METADATA.crs}
          </div>
          <div>
            Cube: {FARM_PARCEL_METADATA.gridDimensions} @ {FARM_PARCEL_METADATA.resolutionMeters}m ·{" "}
            {FARM_PARCEL_METADATA.bandCount} bands
          </div>
        </div>

        {/* Basemap & Camera Controls */}
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          {(["satellite", "dark"] as const).map((mode) => {
            const active = basemapMode === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => setBasemapMode(mode)}
                style={{
                  flex: 1,
                  padding: "6px 10px",
                  borderRadius: 6,
                  border: active
                    ? "1px solid #34d399"
                    : "1px solid rgba(148, 163, 184, 0.25)",
                  background: active ? "rgba(16, 185, 129, 0.2)" : "rgba(15, 23, 42, 0.6)",
                  color: active ? "#6ee7b7" : "#94a3b8",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {mode === "dark" ? "Dark GIS" : "Satellite"}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setViewState(INITIAL_VIEW_STATE)}
            style={{
              padding: "6px 10px",
              borderRadius: 6,
              border: "1px solid rgba(148, 163, 184, 0.25)",
              background: "rgba(15, 23, 42, 0.6)",
              color: "#cbd5e1",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Reset
          </button>
        </div>

        {/* Layer Visibility Toggles */}
        <div
          style={{
            marginTop: 12,
            paddingTop: 10,
            borderTop: "1px solid rgba(148, 163, 184, 0.15)",
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "#94a3b8",
              textTransform: "uppercase",
              letterSpacing: 0.8,
              marginBottom: 6,
            }}
          >
            Geographical Layers
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 10px" }}>
            {[
              { key: "boundary", label: "Perimeter" },
              { key: "quadrants", label: "Crop Zones (A–D)" },
              { key: "labels", label: "Zone Labels" },
              { key: "corridors", label: "Access & Canals" },
            ].map(({ key, label }) => {
              const checked = toggles[key as keyof LayerToggles];
              return (
                <label
                  key={key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 11,
                    color: checked ? "#e2e8f0" : "#64748b",
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleLayer(key as keyof LayerToggles)}
                    style={{ accentColor: "#34d399", cursor: "pointer" }}
                  />
                  {label}
                </label>
              );
            })}
          </div>
        </div>

        <div style={{ fontSize: 11, color: "#64748b", marginTop: 10 }}>
          View: {viewState.latitude.toFixed(4)}°N, {viewState.longitude.toFixed(4)}°E · Pitch{" "}
          {Math.round(viewState.pitch ?? 0)}°
        </div>
      </div>
    </div>
  );
}

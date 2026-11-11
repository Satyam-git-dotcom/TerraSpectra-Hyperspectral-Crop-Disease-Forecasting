import { useMemo, useState } from "react";
import DeckGL from "@deck.gl/react";
import { GeoJsonLayer } from "@deck.gl/layers";
import Map, { NavigationControl } from "react-map-gl/maplibre";
import type { MapViewState } from "@deck.gl/core";
import {
  FARM_BOUNDARY_GEOJSON,
  FARM_CENTER,
  FARM_PARCEL_METADATA,
} from "../data/farmBoundary";

type BasemapMode = "satellite" | "dark";

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
  const mapStyle = useMemo(() => getMapStyle(basemapMode), [basemapMode]);

  const layers = useMemo(
    () => [
      new GeoJsonLayer({
        id: "farm-parcel-boundary",
        data: FARM_BOUNDARY_GEOJSON,
        filled: true,
        stroked: true,
        extruded: false,
        getFillColor: [16, 185, 129, 32],
        getLineColor: [52, 211, 153, 235],
        getLineWidth: 6,
        lineWidthMinPixels: 2,
        pickable: true,
      }),
    ],
    []
  );

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <DeckGL
        viewState={viewState}
        onViewStateChange={({ viewState: next }) => setViewState(next as MapViewState)}
        controller={true}
        layers={layers}
        getTooltip={({ object }) =>
          object
            ? `${object.properties.name}\nArea: ~${object.properties.acres} acres (${object.properties.crs})`
            : null
        }
      >
        <Map mapStyle={mapStyle} reuseMaps>
          <NavigationControl position="bottom-right" />
        </Map>
      </DeckGL>

      <div
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          padding: "14px 16px",
          borderRadius: 12,
          background: "rgba(9, 13, 22, 0.86)",
          backdropFilter: "blur(8px)",
          border: "1px solid rgba(52, 211, 153, 0.3)",
          width: 340,
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.1, color: "#34d399" }}>
          TERRASPECTRA · WEEK 1 / DAY 2
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
            {FARM_PARCEL_METADATA.bandCount} bands ({FARM_PARCEL_METADATA.wavelengthRangeNm})
          </div>
        </div>

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
                  textTransform: "capitalize",
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

        <div style={{ fontSize: 11, color: "#64748b", marginTop: 8 }}>
          View: {viewState.latitude.toFixed(4)}°N, {viewState.longitude.toFixed(4)}°E · Pitch{" "}
          {Math.round(viewState.pitch ?? 0)}°
        </div>
      </div>
    </div>
  );
}

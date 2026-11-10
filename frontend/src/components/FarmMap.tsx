import { useMemo, useState } from "react";
import DeckGL from "@deck.gl/react";
import { GeoJsonLayer } from "@deck.gl/layers";
import Map, { NavigationControl } from "react-map-gl/maplibre";
import type { MapViewState } from "@deck.gl/core";
import { FARM_BOUNDARY_GEOJSON, FARM_CENTER } from "../data/farmBoundary";

const INITIAL_VIEW_STATE: MapViewState = {
  longitude: FARM_CENTER.longitude,
  latitude: FARM_CENTER.latitude,
  zoom: 13.8,
  pitch: 45,
  bearing: -15,
};

const SATELLITE_FALLBACK_STYLE = {
  version: 8 as const,
  sources: {
    "esri-satellite": {
      type: "raster" as const,
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "Esri World Imagery",
    },
  },
  layers: [
    {
      id: "esri-satellite-layer",
      type: "raster" as const,
      source: "esri-satellite",
      minzoom: 0,
      maxzoom: 19,
    },
  ],
};

function getMapStyle(): string | typeof SATELLITE_FALLBACK_STYLE {
  const token = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;
  if (token && token.trim().length > 0) {
    return `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12?access_token=${token.trim()}`;
  }
  return SATELLITE_FALLBACK_STYLE;
}

export function FarmMap() {
  const [viewState, setViewState] = useState<MapViewState>(INITIAL_VIEW_STATE);
  const mapStyle = useMemo(() => getMapStyle(), []);

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
          padding: "12px 16px",
          borderRadius: 10,
          background: "rgba(9, 13, 22, 0.82)",
          backdropFilter: "blur(8px)",
          border: "1px solid rgba(52, 211, 153, 0.3)",
          maxWidth: 340,
          pointerEvents: "none",
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.1, color: "#34d399" }}>
          TERRASPECTRA · DAY 1 GIS SCAFFOLD
        </div>
        <div style={{ fontSize: 16, fontWeight: 600, marginTop: 4 }}>
          Central Valley Parcel 01
        </div>
        <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>
          ~1,000 acres · 220 spectral bands (400–2500 nm)
        </div>
        <div style={{ fontSize: 11, color: "#64748b", marginTop: 6 }}>
          View: {viewState.latitude.toFixed(4)}°N, {viewState.longitude.toFixed(4)}°E · Pitch{" "}
          {Math.round(viewState.pitch ?? 0)}°
        </div>
      </div>
    </div>
  );
}


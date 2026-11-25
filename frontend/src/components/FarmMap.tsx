import { useMemo, useState } from "react";
import DeckGL from "@deck.gl/react";
import { BitmapLayer, GeoJsonLayer, PolygonLayer, TextLayer } from "@deck.gl/layers";
import Map, { NavigationControl } from "react-map-gl/maplibre";
import type { MapViewState } from "@deck.gl/core";
import {
  DEFAULT_FARM_BOUNDS,
  FARM_BOUNDARY_GEOJSON,
  FARM_CENTER,
} from "../data/farmBoundary";
import {
  FIELD_QUADRANTS_GEOJSON,
  IRRIGATION_CORRIDORS_GEOJSON,
  QUADRANT_LABELS_DATA,
  type LabelDatum,
  type QuadrantProperties,
} from "../data/farmLayers";
import {
  MOCK_HEATMAP_PREDICTIONS,
  type HeatmapGridCell,
} from "../data/mockHeatmap";
import {
  HeaderBar,
  type BasemapMode,
  type CameraPreset,
} from "./HeaderBar";
import {
  LayerControlPanel,
  type LayerToggles,
} from "./LayerControlPanel";
import { TelemetryPanel } from "./TelemetryPanel";
import { BottomStatusBar } from "./BottomStatusBar";

const INITIAL_VIEW_STATE: MapViewState = {
  longitude: FARM_CENTER.longitude,
  latitude: FARM_CENTER.latitude,
  zoom: 13.8,
  pitch: 45,
  bearing: -15,
};

// Blight hotspot center (Zone B)
const HOTSPOT_COORDINATES = {
  longitude: -120.1885,
  latitude: 36.6285,
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

function getHeatmapCellColor(cell: HeatmapGridCell): [number, number, number, number] {
  if (cell.predictedClass === 0) {
    return [100, 116, 139, 35];
  }
  const p = cell.blightProbability;
  if (p >= 0.85) {
    return [239, 68, 68, 235];
  }
  if (p >= 0.65) {
    return [249, 115, 22, 215];
  }
  if (p >= 0.35) {
    return [245, 158, 11, 180];
  }
  if (p >= 0.15) {
    return [132, 204, 22, 120];
  }
  return [16, 185, 129, 45];
}

function getHeatmapCellElevation(cell: HeatmapGridCell, isExtruded: boolean): number {
  if (!isExtruded || cell.predictedClass === 0) return 0;
  if (cell.blightProbability < 0.15) return 2;
  return Math.pow(cell.blightProbability, 1.4) * 140;
}

export function FarmMap() {
  const [viewState, setViewState] = useState<MapViewState>(INITIAL_VIEW_STATE);
  const [basemapMode, setBasemapMode] = useState<BasemapMode>("satellite");
  const [activePreset, setActivePreset] = useState<CameraPreset>("overview");
  const [pcaOpacity, setPcaOpacity] = useState<number>(0.65);
  const [heatmapExtruded, setHeatmapExtruded] = useState<boolean>(true);
  const [riskThreshold, setRiskThreshold] = useState<number>(0.15);

  const [isLeftPanelOpen, setIsLeftPanelOpen] = useState<boolean>(true);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState<boolean>(true);

  const [cursorCoord, setCursorCoord] = useState<{ lon: number; lat: number } | null>(null);
  const [activeCell, setActiveCell] = useState<HeatmapGridCell | null>(null);
  const [activeQuadrant, setActiveQuadrant] = useState<QuadrantProperties | null>(null);

  const [toggles, setToggles] = useState<LayerToggles>({
    boundary: true,
    quadrants: true,
    labels: true,
    corridors: true,
    pcaOverlay: false,
    diseaseHeatmap: true,
  });

  const mapStyle = useMemo(() => getMapStyle(basemapMode), [basemapMode]);

  const toggleLayer = (layer: keyof LayerToggles) => {
    setToggles((prev) => ({ ...prev, [layer]: !prev[layer] }));
  };

  const filteredHeatmapCells = useMemo(() => {
    return MOCK_HEATMAP_PREDICTIONS.cells.filter(
      (c) => c.blightProbability >= riskThreshold
    );
  }, [riskThreshold]);

  const filteredAcreage = useMemo(() => {
    const cellAcreage = (40 * 40) / 4046.8564224;
    return Math.round(filteredHeatmapCells.length * cellAcreage * 100) / 100;
  }, [filteredHeatmapCells]);

  // Camera Presets handler with smooth transition
  const handleCameraPreset = (preset: CameraPreset) => {
    setActivePreset(preset);
    if (preset === "hotspot") {
      setViewState((prev) => ({
        ...prev,
        longitude: HOTSPOT_COORDINATES.longitude,
        latitude: HOTSPOT_COORDINATES.latitude,
        zoom: 15.2,
        pitch: 52,
        bearing: 25,
      }));
    } else if (preset === "tactical") {
      setViewState((prev) => ({
        ...prev,
        longitude: FARM_CENTER.longitude,
        latitude: FARM_CENTER.latitude,
        zoom: 14.1,
        pitch: 55,
        bearing: -25,
      }));
    } else if (preset === "nadir") {
      setViewState((prev) => ({
        ...prev,
        longitude: FARM_CENTER.longitude,
        latitude: FARM_CENTER.latitude,
        zoom: 13.8,
        pitch: 0,
        bearing: 0,
      }));
    } else {
      setViewState(INITIAL_VIEW_STATE);
    }
  };

  const layers = useMemo(() => {
    const activeLayers = [];

    // 1. Georeferenced PCA False-Color Image Overlay
    if (toggles.pcaOverlay) {
      activeLayers.push(
        new BitmapLayer({
          id: "farm-pca-false-color-layer",
          bounds: [
            DEFAULT_FARM_BOUNDS.minLon,
            DEFAULT_FARM_BOUNDS.minLat,
            DEFAULT_FARM_BOUNDS.maxLon,
            DEFAULT_FARM_BOUNDS.maxLat,
          ],
          image: "/overlays/farm_pca_rgb.png",
          opacity: pcaOpacity,
          pickable: false,
        })
      );
    }

    // 2. Field Quadrants
    if (toggles.quadrants) {
      activeLayers.push(
        new GeoJsonLayer({
          id: "farm-quadrants-layer",
          data: FIELD_QUADRANTS_GEOJSON,
          filled: true,
          stroked: true,
          autoHighlight: true,
          highlightColor: [255, 255, 255, 45],
          getFillColor: (f) => {
            const base = (f.properties as QuadrantProperties).fillColor;
            return toggles.diseaseHeatmap || toggles.pcaOverlay
              ? [base[0], base[1], base[2], Math.min(base[3], 20)]
              : base;
          },
          getLineColor: [255, 255, 255, 80],
          getLineWidth: 1,
          lineWidthMinPixels: 1,
          pickable: true,
          onClick: (info) => {
            if (info.object?.properties) {
              setActiveQuadrant(info.object.properties as QuadrantProperties);
              setActiveCell(null);
            }
          },
        })
      );
    }

    // 3. Central Irrigation & Access Corridors
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

    // 4. Disease Prediction Heatmap (Deck.gl PolygonLayer with 3D extrusion)
    if (toggles.diseaseHeatmap) {
      activeLayers.push(
        new PolygonLayer<HeatmapGridCell>({
          id: "farm-disease-heatmap-layer",
          data: filteredHeatmapCells,
          getPolygon: (d) => d.polygon,
          getFillColor: (d) => getHeatmapCellColor(d),
          getLineColor: (d) =>
            d.blightProbability >= 0.65
              ? [239, 68, 68, 255]
              : [255, 255, 255, 35],
          getLineWidth: 1,
          lineWidthMinPixels: 1,
          extruded: heatmapExtruded,
          getElevation: (d) => getHeatmapCellElevation(d, heatmapExtruded),
          elevationScale: 1,
          wireframe: false,
          pickable: true,
          autoHighlight: true,
          highlightColor: [255, 255, 255, 95],
          onClick: (info) => {
            if (info.object) {
              setActiveCell(info.object);
            }
          },
        })
      );
    }

    // 5. Outer Parcel Perimeter
    if (toggles.boundary) {
      activeLayers.push(
        new GeoJsonLayer({
          id: "farm-parcel-boundary",
          data: FARM_BOUNDARY_GEOJSON,
          filled: false,
          stroked: true,
          extruded: false,
          getLineColor: [52, 211, 153, 240],
          getLineWidth: 5,
          lineWidthMinPixels: 2,
          pickable: true,
        })
      );
    }

    // 6. Centroid Labels for Quadrants
    if (toggles.labels) {
      activeLayers.push(
        new TextLayer<LabelDatum>({
          id: "farm-quadrant-labels",
          data: QUADRANT_LABELS_DATA,
          getPosition: (d) => d.coordinates,
          getText: (d) => d.text,
          getSize: 12,
          getColor: [248, 250, 252, 240],
          getBackgroundColor: [10, 15, 26, 210],
          background: true,
          backgroundPadding: [8, 4],
          fontFamily: "Inter, system-ui, -apple-system, sans-serif",
          fontWeight: 600,
          billboard: true,
          sizeUnits: "pixels",
          pickable: false,
        })
      );
    }

    return activeLayers;
  }, [toggles, pcaOpacity, heatmapExtruded, filteredHeatmapCells]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", background: "#070a12" }}>
      {/* 3D Map Canvas */}
      <DeckGL
        viewState={viewState}
        onViewStateChange={({ viewState: next }) => setViewState(next as MapViewState)}
        controller={true}
        layers={layers}
        onHover={(info) => {
          if (info.coordinate) {
            setCursorCoord({
              lon: info.coordinate[0],
              lat: info.coordinate[1],
            });
          }
          if (info.object) {
            if ((info.object as HeatmapGridCell).blightProbability !== undefined) {
              setActiveCell(info.object as HeatmapGridCell);
            } else if (info.object.properties?.crop) {
              setActiveQuadrant(info.object.properties as QuadrantProperties);
            }
          }
        }}
        getTooltip={({ object }) => {
          if (!object) return null;
          if (object.blightProbability !== undefined) {
            const c = object as HeatmapGridCell;
            return {
              text: `CELL [${c.gridRow}, ${c.gridCol}] · ${c.zone}
Blight Risk: ${(c.blightProbability * 100).toFixed(1)}% (${c.riskLevel.toUpperCase()})
Stress Index: ${(c.stressScore * 100).toFixed(1)}%`,
            };
          }
          if (object.properties?.crop) {
            const q = object.properties as QuadrantProperties;
            return {
              text: `${q.name} (${q.code})\nCrop: ${q.crop} (${q.variety})\nArea: ${q.acres} acres`,
            };
          }
          return null;
        }}
      >
        <Map mapStyle={mapStyle} reuseMaps>
          <NavigationControl position="bottom-right" style={{ marginBottom: 46, marginRight: 12 }} />
        </Map>
      </DeckGL>

      {/* Top Command Bar */}
      <HeaderBar
        basemapMode={basemapMode}
        onBasemapChange={setBasemapMode}
        onCameraPreset={handleCameraPreset}
        activePreset={activePreset}
        isLeftPanelOpen={isLeftPanelOpen}
        isRightPanelOpen={isRightPanelOpen}
        onToggleLeftPanel={() => setIsLeftPanelOpen(!isLeftPanelOpen)}
        onToggleRightPanel={() => setIsRightPanelOpen(!isRightPanelOpen)}
      />

      {/* Left Flank: Layer & Heatmap Controls */}
      {isLeftPanelOpen && (
        <LayerControlPanel
          toggles={toggles}
          onToggleLayer={toggleLayer}
          pcaOpacity={pcaOpacity}
          onPcaOpacityChange={setPcaOpacity}
          heatmapExtruded={heatmapExtruded}
          onHeatmapExtrudedChange={setHeatmapExtruded}
          riskThreshold={riskThreshold}
          onRiskThresholdChange={setRiskThreshold}
          filteredAcreage={filteredAcreage}
          totalVisibleCells={filteredHeatmapCells.length}
          onJumpToHotspot={() => handleCameraPreset("hotspot")}
        />
      )}

      {/* Right Flank: Telemetry & Spectral Anomaly Inspector */}
      {isRightPanelOpen && (
        <TelemetryPanel
          activeCell={activeCell}
          activeQuadrant={activeQuadrant}
          onClearActive={() => {
            setActiveCell(null);
            setActiveQuadrant(null);
          }}
        />
      )}

      {/* Bottom Coordinate & System Status Bar */}
      <BottomStatusBar
        cursorCoord={cursorCoord}
        pitch={viewState.pitch ?? 0}
        bearing={viewState.bearing ?? 0}
        zoom={viewState.zoom ?? 13.8}
      />
    </div>
  );
}

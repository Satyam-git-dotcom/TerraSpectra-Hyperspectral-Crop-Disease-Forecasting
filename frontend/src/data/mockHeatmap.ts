import { DEFAULT_FARM_BOUNDS } from "./farmBoundary";

export type HeatmapRiskLevel = "healthy" | "low" | "moderate" | "high" | "severe";

export interface HeatmapGridCell {
  id: string;
  gridRow: number;
  gridCol: number;
  center: [number, number]; // [lon, lat]
  polygon: [number, number][]; // 4-corner bounding polygon [lon, lat]
  blightProbability: number; // 0.0 to 1.0 (model output confidence)
  stressScore: number; // 0.0 to 1.0 (chemical chlorophyll anomaly index)
  predictedClass: 0 | 1 | 2; // 0: soil/road, 1: healthy, 2: pre-visual blight
  riskLevel: HeatmapRiskLevel;
  zone: string;
}

export interface HeatmapPredictionResponse {
  parcelId: string;
  parcelName: string;
  modelArchitecture: string;
  timestamp: string;
  inferenceResolutionMeters: number;
  gridShape: [number, number]; // [rows, cols]
  totalAcreage: number;
  atRiskAcreage: number;
  criticalHotspotsCount: number;
  cells: HeatmapGridCell[];
}

const { minLon, minLat, maxLon, maxLat } = DEFAULT_FARM_BOUNDS;
const lonSpan = maxLon - minLon;
const latSpan = maxLat - minLat;

/**
 * Generate a deterministic grid of disease prediction cells over the 1,000-acre farm.
 * In Week 2 Day 9, this feeds Deck.gl heatmap layers (GridCellLayer / PolygonLayer).
 *
 * step: sampling stride in raster space (e.g. 5 corresponds to 50m aggregation grid,
 * yielding 40x40 = 1,600 interactive prediction cells).
 */
export function generateMockPredictionHeatmap(step: number = 4): HeatmapPredictionResponse {
  const rasterSize = 201; // 201 x 201 10m pixels
  const cells: HeatmapGridCell[] = [];

  const cellLonWidth = (lonSpan / rasterSize) * step;
  const cellLatHeight = (latSpan / rasterSize) * step;

  // Blight hotspot center matching generate_mock_cube.py (row 62, col 138)
  const centerBlightRow = 62;
  const centerBlightCol = 138;
  const blightRadiusPx = 8.5;

  let atRiskCount = 0;
  let criticalCount = 0;

  for (let r = 0; r < rasterSize; r += step) {
    for (let c = 0; c < rasterSize; c += step) {
      // Cell bounding coordinates
      const west = minLon + (c / rasterSize) * lonSpan;
      const east = Math.min(maxLon, west + cellLonWidth);
      // Row 0 is north (maxLat), Row 200 is south (minLat)
      const north = maxLat - (r / rasterSize) * latSpan;
      const south = Math.max(minLat, north - cellLatHeight);

      const centerLon = (west + east) / 2;
      const centerLat = (south + north) / 2;

      // Determine road/canal corridor
      const isRoad =
        (r >= 98 && r <= 102) ||
        (c >= 98 && c <= 102);

      // Distance from fungal blight epicenter in Zone B
      const distToHotspot = Math.sqrt(
        Math.pow(r - centerBlightRow, 2) + Math.pow(c - centerBlightCol, 2)
      );

      let predictedClass: 0 | 1 | 2 = 1;
      let blightProb = 0.03 + 0.04 * Math.sin(r * 0.1) * Math.cos(c * 0.1);
      let stressScore = 0.08 + 0.03 * Math.cos(r * 0.2);

      if (isRoad) {
        predictedClass = 0;
        blightProb = 0.01;
        stressScore = 0.02;
      } else if (distToHotspot <= blightRadiusPx) {
        // Epicenter of pre-visual blight
        predictedClass = 2;
        const proximityFactor = 1.0 - distToHotspot / blightRadiusPx;
        blightProb = 0.88 + 0.11 * proximityFactor;
        stressScore = 0.85 + 0.14 * proximityFactor;
        atRiskCount++;
        if (blightProb >= 0.9) criticalCount++;
      } else if (distToHotspot <= blightRadiusPx * 1.8) {
        // Buffer ring with early physiological chlorophyll shift
        predictedClass = 2;
        const fade = (blightRadiusPx * 1.8 - distToHotspot) / (blightRadiusPx * 0.8);
        blightProb = 0.45 + 0.38 * fade;
        stressScore = 0.40 + 0.42 * fade;
        atRiskCount++;
      }

      blightProb = Math.min(0.99, Math.max(0.01, blightProb));
      stressScore = Math.min(0.99, Math.max(0.01, stressScore));

      let riskLevel: HeatmapRiskLevel = "healthy";
      if (predictedClass === 0) {
        riskLevel = "healthy";
      } else if (blightProb >= 0.85) {
        riskLevel = "severe";
      } else if (blightProb >= 0.65) {
        riskLevel = "high";
      } else if (blightProb >= 0.35) {
        riskLevel = "moderate";
      } else if (blightProb >= 0.15) {
        riskLevel = "low";
      }

      // Zone determination
      const zone =
        r < 100
          ? c < 100
            ? "Zone A (NW)"
            : "Zone B (NE)"
          : c < 100
          ? "Zone C (SW)"
          : "Zone D (SE)";

      cells.push({
        id: `cell_${r}_${c}`,
        gridRow: r,
        gridCol: c,
        center: [centerLon, centerLat],
        polygon: [
          [west, north],
          [east, north],
          [east, south],
          [west, south],
          [west, north],
        ],
        blightProbability: Math.round(blightProb * 1000) / 1000,
        stressScore: Math.round(stressScore * 1000) / 1000,
        predictedClass,
        riskLevel,
        zone,
      });
    }
  }

  const cellAreaAcres = ((step * 10) * (step * 10)) / 4046.8564224;
  const atRiskAcreage = Math.round(atRiskCount * cellAreaAcres * 100) / 100;

  return {
    parcelId: "TS-PARCEL-CV-01",
    parcelName: "TerraSpectra Central Valley Parcel 01",
    modelArchitecture: "Hybrid 3D-CNN + Vision Transformer",
    timestamp: "2026-11-16T12:00:00Z",
    inferenceResolutionMeters: step * 10,
    gridShape: [Math.ceil(rasterSize / step), Math.ceil(rasterSize / step)],
    totalAcreage: 998.33,
    atRiskAcreage,
    criticalHotspotsCount: criticalCount,
    cells,
  };
}

export const MOCK_HEATMAP_PREDICTIONS = generateMockPredictionHeatmap(4);

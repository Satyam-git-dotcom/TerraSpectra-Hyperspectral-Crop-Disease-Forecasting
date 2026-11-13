import { DEFAULT_FARM_BOUNDS } from "./farmBoundary";

const { minLon, minLat, maxLon, maxLat } = DEFAULT_FARM_BOUNDS;

// 30m road/irrigation corridor corresponding to rows/cols 99..101 out of 201 px in the 10m raster
const lonSpan = maxLon - minLon;
const latSpan = maxLat - minLat;

const midLonWest = minLon + lonSpan * (99 / 201);
const midLonEast = minLon + lonSpan * (102 / 201);
const midLatSouth = minLat + latSpan * (99 / 201);
const midLatNorth = minLat + latSpan * (102 / 201);

export interface QuadrantProperties {
  id: string;
  name: string;
  code: string;
  crop: string;
  variety: string;
  acres: number;
  irrigation: string;
  fillColor: [number, number, number, number];
  hasStressZone: boolean;
}

export const FIELD_QUADRANTS_GEOJSON = {
  type: "FeatureCollection" as const,
  features: [
    {
      type: "Feature" as const,
      properties: {
        id: "quad-a",
        name: "Field Quadrant A (NW)",
        code: "Zone A",
        crop: "Almonds",
        variety: "Nonpareil / Monterey",
        acres: 245.5,
        irrigation: "Subsurface Drip",
        fillColor: [16, 185, 129, 38], // Emerald tint
        hasStressZone: false,
      } as QuadrantProperties,
      geometry: {
        type: "Polygon" as const,
        coordinates: [
          [
            [minLon, midLatNorth],
            [midLonWest, midLatNorth],
            [midLonWest, maxLat],
            [minLon, maxLat],
            [minLon, midLatNorth],
          ],
        ],
      },
    },
    {
      type: "Feature" as const,
      properties: {
        id: "quad-b",
        name: "Field Quadrant B (NE)",
        code: "Zone B",
        crop: "Processing Tomato",
        variety: "Heinz 1301",
        acres: 245.5,
        irrigation: "Precision Micro-Sprinkler",
        fillColor: [245, 158, 11, 42], // Amber tint - contains the 5-acre fungal blight target
        hasStressZone: true,
      } as QuadrantProperties,
      geometry: {
        type: "Polygon" as const,
        coordinates: [
          [
            [midLonEast, midLatNorth],
            [maxLon, midLatNorth],
            [maxLon, maxLat],
            [midLonEast, maxLat],
            [midLonEast, midLatNorth],
          ],
        ],
      },
    },
    {
      type: "Feature" as const,
      properties: {
        id: "quad-c",
        name: "Field Quadrant C (SW)",
        code: "Zone C",
        crop: "Pistachios",
        variety: "Kerman / Peter",
        acres: 245.5,
        irrigation: "Subsurface Drip",
        fillColor: [59, 130, 246, 36], // Blue tint
        hasStressZone: false,
      } as QuadrantProperties,
      geometry: {
        type: "Polygon" as const,
        coordinates: [
          [
            [minLon, minLat],
            [midLonWest, minLat],
            [midLonWest, midLatSouth],
            [minLon, midLatSouth],
            [minLon, minLat],
          ],
        ],
      },
    },
    {
      type: "Feature" as const,
      properties: {
        id: "quad-d",
        name: "Field Quadrant D (SE)",
        code: "Zone D",
        crop: "Upland Cotton",
        variety: "DP 1646 B2XF",
        acres: 245.5,
        irrigation: "Furrow / Surge Valve",
        fillColor: [168, 85, 247, 36], // Violet tint
        hasStressZone: false,
      } as QuadrantProperties,
      geometry: {
        type: "Polygon" as const,
        coordinates: [
          [
            [midLonEast, minLat],
            [maxLon, minLat],
            [maxLon, midLatSouth],
            [midLonEast, midLatSouth],
            [midLonEast, minLat],
          ],
        ],
      },
    },
  ],
};

export const IRRIGATION_CORRIDORS_GEOJSON = {
  type: "FeatureCollection" as const,
  features: [
    // North-South Access Road & Main Canal
    {
      type: "Feature" as const,
      properties: {
        name: "Central N–S Service Road & Canal",
        type: "Access Corridor & Main Irrigation Arterial",
        widthMeters: 30,
      },
      geometry: {
        type: "Polygon" as const,
        coordinates: [
          [
            [midLonWest, minLat],
            [midLonEast, minLat],
            [midLonEast, maxLat],
            [midLonWest, maxLat],
            [midLonWest, minLat],
          ],
        ],
      },
    },
    // East-West Service Road & Lateral Ditch
    {
      type: "Feature" as const,
      properties: {
        name: "Central E–W Service Road & Lateral Ditch",
        type: "Access Corridor & Lateral Distribution",
        widthMeters: 30,
      },
      geometry: {
        type: "Polygon" as const,
        coordinates: [
          [
            [minLon, midLatSouth],
            [maxLon, midLatSouth],
            [maxLon, midLatNorth],
            [minLon, midLatNorth],
            [minLon, midLatSouth],
          ],
        ],
      },
    },
  ],
};

export interface LabelDatum {
  text: string;
  coordinates: [number, number];
  subText: string;
}

export const QUADRANT_LABELS_DATA: LabelDatum[] = [
  {
    text: "Zone A · Almonds",
    subText: "245.5 ac · Subsurface Drip",
    coordinates: [(minLon + midLonWest) / 2, (midLatNorth + maxLat) / 2],
  },
  {
    text: "Zone B · Tomatoes",
    subText: "245.5 ac · Target Zone",
    coordinates: [(midLonEast + maxLon) / 2, (midLatNorth + maxLat) / 2],
  },
  {
    text: "Zone C · Pistachios",
    subText: "245.5 ac · Subsurface Drip",
    coordinates: [(minLon + midLonWest) / 2, (minLat + midLatSouth) / 2],
  },
  {
    text: "Zone D · Cotton",
    subText: "245.5 ac · Furrow",
    coordinates: [(midLonEast + maxLon) / 2, (minLat + midLatSouth) / 2],
  },
];


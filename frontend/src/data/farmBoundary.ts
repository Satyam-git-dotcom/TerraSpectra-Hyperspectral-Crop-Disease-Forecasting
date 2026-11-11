export interface FarmBounds {
  minLon: number;
  minLat: number;
  maxLon: number;
  maxLat: number;
}

/**
 * Coordinates matching ml/src/config.py (EPSG:32610 -> EPSG:4326)
 * for TerraSpectra Central Valley Parcel 01 (~998.3 acres, 2010m x 2010m).
 */
export const DEFAULT_FARM_BOUNDS: FarmBounds = {
  minLon: -120.204547,
  minLat: 36.61624,
  maxLon: -120.181436,
  maxLat: 36.634868,
};

export const FARM_CENTER = {
  longitude: (DEFAULT_FARM_BOUNDS.minLon + DEFAULT_FARM_BOUNDS.maxLon) / 2,
  latitude: (DEFAULT_FARM_BOUNDS.minLat + DEFAULT_FARM_BOUNDS.maxLat) / 2,
};

export const FARM_PARCEL_METADATA = {
  name: "TerraSpectra Central Valley Parcel 01",
  shortName: "Central Valley Parcel 01",
  crs: "EPSG:32610",
  totalAcres: 998.33,
  gridDimensions: "201 × 201 px",
  resolutionMeters: 10,
  bandCount: 220,
  wavelengthRangeNm: "400–2500 nm",
};

export const FARM_BOUNDARY_GEOJSON = {
  type: "FeatureCollection" as const,
  features: [
    {
      type: "Feature" as const,
      properties: {
        name: FARM_PARCEL_METADATA.name,
        acres: FARM_PARCEL_METADATA.totalAcres,
        crs: FARM_PARCEL_METADATA.crs,
      },
      geometry: {
        type: "Polygon" as const,
        coordinates: [
          [
            [DEFAULT_FARM_BOUNDS.minLon, DEFAULT_FARM_BOUNDS.minLat],
            [DEFAULT_FARM_BOUNDS.maxLon, DEFAULT_FARM_BOUNDS.minLat],
            [DEFAULT_FARM_BOUNDS.maxLon, DEFAULT_FARM_BOUNDS.maxLat],
            [DEFAULT_FARM_BOUNDS.minLon, DEFAULT_FARM_BOUNDS.maxLat],
            [DEFAULT_FARM_BOUNDS.minLon, DEFAULT_FARM_BOUNDS.minLat],
          ],
        ],
      },
    },
  ],
};


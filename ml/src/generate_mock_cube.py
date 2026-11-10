"""Generate synthetic 220-band hyperspectral cubes (GeoTIFF + HDF5) for Day 1."""

from __future__ import annotations

import json
from pathlib import Path

import h5py
import numpy as np
import rasterio
from rasterio.transform import from_origin
from rasterio.warp import transform_bounds

from src.config import (
    DATA_DIR,
    DEFAULT_GEOTIFF_PATH,
    DEFAULT_HDF5_PATH,
    DEFAULT_METADATA_PATH,
    FARM_SPEC,
    FarmSpec,
)


def compute_wavelengths(spec: FarmSpec = FARM_SPEC) -> np.ndarray:
    """Return evenly spaced center wavelengths (nm) across 400-2500 nm."""
    return np.linspace(spec.wavelength_min_nm, spec.wavelength_max_nm, spec.num_bands, dtype=np.float32)


def _gaussian(wavelengths: np.ndarray, center: float, width: float, amplitude: float) -> np.ndarray:
    return amplitude * np.exp(-0.5 * ((wavelengths - center) / width) ** 2)


def _base_healthy_spectrum(wl: np.ndarray) -> np.ndarray:
    """Construct a physically plausible healthy vegetation reflectance curve (0-1)."""
    # Visible blue/green/red chlorophyll absorption with green peak (~550 nm)
    visible = (
        0.04
        + _gaussian(wl, 550.0, 28.0, 0.09)
        - _gaussian(wl, 670.0, 20.0, 0.025)
    )
    # Sharp red-edge transition (~690-745 nm) into high NIR plateau (~750-1300 nm)
    red_edge = 0.44 / (1.0 + np.exp(-(wl - 715.0) / 11.0))
    # Gradual SWIR decline + water absorption troughs at 1450 nm and 1940 nm
    swir_decay = np.where(wl > 1300.0, -0.00022 * (wl - 1300.0), 0.0)
    water_1450 = -_gaussian(wl, 1450.0, 45.0, 0.22)
    water_1940 = -_gaussian(wl, 1940.0, 55.0, 0.24)
    spectrum = visible + red_edge + swir_decay + water_1450 + water_1940
    return np.clip(spectrum, 0.01, 0.95).astype(np.float32)


def _blight_delta_spectrum(wl: np.ndarray) -> np.ndarray:
    """Pre-visual fungal blight stress signature: invisible in RGB, shifted in red-edge & SWIR."""
    # Slight red-edge blue-shift & NIR cellular collapse + leaf water stress in SWIR
    red_edge_shift = _gaussian(wl, 702.0, 18.0, 0.045) - _gaussian(wl, 760.0, 55.0, 0.085)
    nir_drop = -_gaussian(wl, 960.0, 140.0, 0.06)
    swir_dryness = _gaussian(wl, 1650.0, 120.0, 0.055) + _gaussian(wl, 2150.0, 110.0, 0.045)
    return (red_edge_shift + nir_drop + swir_dryness).astype(np.float32)


def _soil_spectrum(wl: np.ndarray) -> np.ndarray:
    """Construct a bare soil / access road reflectance spectrum."""
    slope = 0.12 + 0.18 * (wl - 400.0) / 2100.0
    moisture = -_gaussian(wl, 1450.0, 35.0, 0.05) - _gaussian(wl, 1940.0, 45.0, 0.06)
    return np.clip(slope + moisture, 0.05, 0.65).astype(np.float32)


def generate_synthetic_cube(
    spec: FarmSpec = FARM_SPEC,
    seed: int = 42,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Build a (bands, height, width) float32 cube and pixel label mask.

    Label encoding in mask:
        0 = bare soil / farm road
        1 = healthy crop
        2 = pre-visual fungal blight stress (~5-acre hotspot)
    """
    rng = np.random.default_rng(seed)
    wl = compute_wavelengths(spec)

    healthy = _base_healthy_spectrum(wl)
    blight = np.clip(healthy + _blight_delta_spectrum(wl), 0.01, 0.95).astype(np.float32)
    soil = _soil_spectrum(wl)

    cube = np.empty((spec.num_bands, spec.height_px, spec.width_px), dtype=np.float32)
    labels = np.ones((spec.height_px, spec.width_px), dtype=np.uint8)

    # Farm road / irrigation border (rows 99..101 and col 100)
    labels[99:102, :] = 0
    labels[:, 99:102] = 0

    # ~5-acre pre-visual fungal blight cluster (14x14 px @ 10m = 19,600 m^2 ≈ 4.84 acres)
    yy, xx = np.ogrid[: spec.height_px, : spec.width_px]
    blight_dist = ((yy - 62) ** 2 + (xx - 138) ** 2) <= 8 ** 2  # ~201 px = 2.01 ha ≈ 4.97 acres
    labels[blight_dist] = 2

    # Populate spectral cube with realistic spatial micro-variation and sensor noise
    cube[:, labels == 1] = healthy[:, None]
    cube[:, labels == 2] = blight[:, None]
    cube[:, labels == 0] = soil[:, None]

    spatial_gain = rng.normal(1.0, 0.018, size=(1, spec.height_px, spec.width_px)).astype(np.float32)
    sensor_noise = rng.normal(0.0, 0.004, size=cube.shape).astype(np.float32)
    cube = np.clip(cube * spatial_gain + sensor_noise, 0.005, 1.0).astype(np.float32)

    return cube, labels, wl


def write_outputs(
    geotiff_path: Path = DEFAULT_GEOTIFF_PATH,
    hdf5_path: Path = DEFAULT_HDF5_PATH,
    metadata_path: Path = DEFAULT_METADATA_PATH,
    spec: FarmSpec = FARM_SPEC,
) -> dict:
    """Generate and persist the mock cube as GeoTIFF, HDF5, and WGS84 metadata JSON."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    cube, labels, wl = generate_synthetic_cube(spec=spec)

    transform = from_origin(
        spec.origin_easting_m,
        spec.origin_northing_m + spec.height_px * spec.pixel_size_m,
        spec.pixel_size_m,
        spec.pixel_size_m,
    )

    with rasterio.open(
        geotiff_path,
        "w",
        driver="GTiff",
        height=spec.height_px,
        width=spec.width_px,
        count=spec.num_bands,
        dtype=cube.dtype,
        crs=spec.crs,
        transform=transform,
        compress="deflate",
    ) as dst:
        dst.write(cube)
        dst.descriptions = tuple(f"{w:.1f}nm" for w in wl)
        bounds_utm = dst.bounds

    bounds_wgs84 = transform_bounds(spec.crs, "EPSG:4326", *bounds_utm)
    min_lon, min_lat, max_lon, max_lat = bounds_wgs84

    with h5py.File(hdf5_path, "w") as h5f:
        ds = h5f.create_dataset("reflectance", data=cube, compression="gzip")
        ds.attrs["crs"] = spec.crs
        ds.attrs["pixel_size_m"] = spec.pixel_size_m
        ds.attrs["bounds_wgs84"] = bounds_wgs84
        h5f.create_dataset("wavelengths_nm", data=wl)
        h5f.create_dataset("labels", data=labels, compression="gzip")

    area_sq_m = (spec.width_px * spec.pixel_size_m) * (spec.height_px * spec.pixel_size_m)
    area_acres = area_sq_m / 4046.8564224
    blight_acres = float(np.sum(labels == 2) * (spec.pixel_size_m ** 2) / 4046.8564224)

    metadata = {
        "name": spec.name,
        "crs": spec.crs,
        "shape": list(cube.shape),
        "pixel_size_m": spec.pixel_size_m,
        "total_acres": round(area_acres, 2),
        "blight_zone_acres": round(blight_acres, 2),
        "bounds_wgs84": {
            "min_lon": round(min_lon, 6),
            "min_lat": round(min_lat, 6),
            "max_lon": round(max_lon, 6),
            "max_lat": round(max_lat, 6),
        },
        "center_wgs84": {
            "lon": round((min_lon + max_lon) / 2.0, 6),
            "lat": round((min_lat + max_lat) / 2.0, 6),
        },
        "geotiff": str(geotiff_path.name),
        "hdf5": str(hdf5_path.name),
    }
    metadata_path.write_text(json.dumps(metadata, indent=2))
    return metadata


if __name__ == "__main__":
    info = write_outputs()
    print("Generated mock hyperspectral dataset:")
    print(json.dumps(info, indent=2))


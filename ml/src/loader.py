"""Unified GeoTIFF (Rasterio) and HDF5 hyperspectral cube loader and inspector."""

from __future__ import annotations

from dataclasses import dataclass
import json
from pathlib import Path
from typing import Any

import h5py
import numpy as np
import rasterio
from rasterio.warp import transform_bounds

from src.config import DEFAULT_GEOTIFF_PATH, DEFAULT_HDF5_PATH, FARM_SPEC


@dataclass
class HyperspectralCube:
    """In-memory representation of a georeferenced hyperspectral cube."""

    data: np.ndarray              # Shape: (bands, height, width), dtype: float32
    wavelengths_nm: np.ndarray    # Shape: (bands,), dtype: float32
    crs: str
    pixel_size_m: float
    bounds_wgs84: tuple[float, float, float, float]  # (min_lon, min_lat, max_lon, max_lat)
    source_format: str
    labels: np.ndarray | None = None

    @property
    def shape(self) -> tuple[int, int, int]:
        return tuple(self.data.shape)  # type: ignore[return-value]


def _parse_wavelength_descriptions(
    descriptions: tuple[str | None, ...],
    num_bands: int,
) -> np.ndarray:
    """Parse band descriptions like '400.0nm' or fall back to configured range."""
    parsed: list[float] = []
    for desc in descriptions:
        if desc and desc.lower().endswith("nm"):
            try:
                parsed.append(float(desc[:-2]))
                continue
            except ValueError:
                break
        break

    if len(parsed) == num_bands:
        return np.asarray(parsed, dtype=np.float32)

    return np.linspace(
        FARM_SPEC.wavelength_min_nm,
        FARM_SPEC.wavelength_max_nm,
        num_bands,
        dtype=np.float32,
    )


def load_geotiff(path: Path | str) -> HyperspectralCube:
    """Load a hyperspectral GeoTIFF cube via Rasterio."""
    tif_path = Path(path)
    if not tif_path.exists():
        raise FileNotFoundError(f"GeoTIFF file not found: {tif_path}")

    with rasterio.open(tif_path) as src:
        data = src.read().astype(np.float32)
        if src.nodata is not None:
            data = np.where(data == src.nodata, np.nan, data)

        crs_str = str(src.crs) if src.crs else FARM_SPEC.crs
        bounds_wgs84 = tuple(
            float(v) for v in transform_bounds(crs_str, "EPSG:4326", *src.bounds)
        )
        wavelengths = _parse_wavelength_descriptions(src.descriptions, src.count)
        pixel_size_m = float(abs(src.transform.a))

    return HyperspectralCube(
        data=data,
        wavelengths_nm=wavelengths,
        crs=crs_str,
        pixel_size_m=pixel_size_m,
        bounds_wgs84=bounds_wgs84,  # type: ignore[arg-type]
        source_format="geotiff",
        labels=None,
    )


def load_hdf5(path: Path | str) -> HyperspectralCube:
    """Load a hyperspectral HDF5 cube via h5py."""
    h5_path = Path(path)
    if not h5_path.exists():
        raise FileNotFoundError(f"HDF5 file not found: {h5_path}")

    with h5py.File(h5_path, "r") as h5f:
        ds = h5f["reflectance"]
        data = ds[:].astype(np.float32)
        wavelengths = h5f["wavelengths_nm"][:].astype(np.float32)
        crs_raw = ds.attrs.get("crs", FARM_SPEC.crs)
        crs_str = crs_raw.decode() if isinstance(crs_raw, bytes) else str(crs_raw)
        pixel_size_m = float(ds.attrs.get("pixel_size_m", FARM_SPEC.pixel_size_m))
        bounds_arr = ds.attrs["bounds_wgs84"]
        bounds_wgs84 = tuple(float(v) for v in bounds_arr)
        labels = h5f["labels"][:] if "labels" in h5f else None

    return HyperspectralCube(
        data=data,
        wavelengths_nm=wavelengths,
        crs=crs_str,
        pixel_size_m=pixel_size_m,
        bounds_wgs84=bounds_wgs84,  # type: ignore[arg-type]
        source_format="hdf5",
        labels=labels,
    )


def load_cube(path: Path | str) -> HyperspectralCube:
    """Dispatch hyperspectral cube loading by file extension (.tif/.tiff or .h5/.hdf5)."""
    cube_path = Path(path)
    suffix = cube_path.suffix.lower()
    if suffix in {".tif", ".tiff"}:
        return load_geotiff(cube_path)
    if suffix in {".h5", ".hdf5"}:
        return load_hdf5(cube_path)
    raise ValueError(
        f"Unsupported hyperspectral format '{cube_path.suffix}'. Expected .tif/.tiff or .h5/.hdf5."
    )


def summarize_cube(cube: HyperspectralCube) -> dict[str, Any]:
    """Compute metadata and spectral-region reflectance statistics for quick inspection."""
    spectral_regions = {
        "visible_400_700nm": (400.0, 700.0),
        "red_edge_700_750nm": (700.0, 750.0),
        "nir_750_1300nm": (750.0, 1300.0),
        "swir_1300_2500nm": (1300.0, 2500.0),
    }

    region_stats: dict[str, dict[str, float]] = {}
    for name, (low_nm, high_nm) in spectral_regions.items():
        mask = (cube.wavelengths_nm >= low_nm) & (cube.wavelengths_nm <= high_nm)
        subset = cube.data[mask]
        region_stats[name] = {
            "band_count": int(np.sum(mask)),
            "mean": round(float(np.nanmean(subset)), 4),
            "min": round(float(np.nanmin(subset)), 4),
            "max": round(float(np.nanmax(subset)), 4),
        }

    return {
        "source_format": cube.source_format,
        "shape": list(cube.shape),
        "crs": cube.crs,
        "pixel_size_m": cube.pixel_size_m,
        "wavelength_range_nm": [
            round(float(cube.wavelengths_nm.min()), 1),
            round(float(cube.wavelengths_nm.max()), 1),
        ],
        "bounds_wgs84": [round(v, 6) for v in cube.bounds_wgs84],
        "has_labels": cube.labels is not None,
        "regions": region_stats,
    }


if __name__ == "__main__":
    for sample_path in (DEFAULT_GEOTIFF_PATH, DEFAULT_HDF5_PATH):
        loaded = load_cube(sample_path)
        print(f"=== {sample_path.name} ===")
        print(json.dumps(summarize_cube(loaded), indent=2))


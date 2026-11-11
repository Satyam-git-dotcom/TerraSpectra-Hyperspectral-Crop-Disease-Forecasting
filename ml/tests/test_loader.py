"""Day 2 unit tests for unified Rasterio/HDF5 hyperspectral cube loading."""

from pathlib import Path

import numpy as np
import pytest

from src.config import FARM_SPEC
from src.generate_mock_cube import write_outputs
from src.loader import load_cube, summarize_cube


def test_load_cube_parity_geotiff_and_hdf5(tmp_path: Path) -> None:
    tif_path = tmp_path / "farm.tif"
    h5_path = tmp_path / "farm.h5"
    meta_path = tmp_path / "meta.json"
    write_outputs(geotiff_path=tif_path, hdf5_path=h5_path, metadata_path=meta_path)

    tif_cube = load_cube(tif_path)
    h5_cube = load_cube(h5_path)

    assert tif_cube.source_format == "geotiff"
    assert h5_cube.source_format == "hdf5"
    assert tif_cube.shape == h5_cube.shape == (
        FARM_SPEC.num_bands,
        FARM_SPEC.height_px,
        FARM_SPEC.width_px,
    )
    assert tif_cube.crs == h5_cube.crs == FARM_SPEC.crs
    assert np.allclose(tif_cube.data, h5_cube.data, atol=1e-6)
    assert np.allclose(tif_cube.wavelengths_nm, h5_cube.wavelengths_nm, atol=0.06)
    assert np.allclose(tif_cube.bounds_wgs84, h5_cube.bounds_wgs84, atol=1e-6)
    assert tif_cube.labels is None
    assert h5_cube.labels is not None

    summary = summarize_cube(tif_cube)
    assert summary["regions"]["visible_400_700nm"]["band_count"] > 0
    assert summary["regions"]["nir_750_1300nm"]["mean"] > summary["regions"]["visible_400_700nm"]["mean"]


def test_load_cube_error_handling(tmp_path: Path) -> None:
    with pytest.raises(FileNotFoundError):
        load_cube(tmp_path / "missing.tif")

    bad_file = tmp_path / "cube.csv"
    bad_file.write_text("a,b,c\n")
    with pytest.raises(ValueError, match="Unsupported hyperspectral format"):
        load_cube(bad_file)

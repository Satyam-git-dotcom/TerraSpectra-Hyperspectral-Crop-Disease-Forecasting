"""Day 1 smoke tests for GeoTIFF & HDF5 hyperspectral cube I/O."""

from pathlib import Path

import h5py
import numpy as np
import rasterio

from src.config import FARM_SPEC
from src.generate_mock_cube import write_outputs


def test_generate_and_read_hyperspectral_cubes(tmp_path: Path) -> None:
    tif_path = tmp_path / "test_farm.tif"
    h5_path = tmp_path / "test_farm.h5"
    meta_path = tmp_path / "test_meta.json"

    metadata = write_outputs(
        geotiff_path=tif_path,
        hdf5_path=h5_path,
        metadata_path=meta_path,
    )

    assert metadata["shape"] == [FARM_SPEC.num_bands, FARM_SPEC.height_px, FARM_SPEC.width_px]
    assert 990.0 <= metadata["total_acres"] <= 1010.0
    assert 4.5 <= metadata["blight_zone_acres"] <= 5.5

    with rasterio.open(tif_path) as src:
        assert src.count == FARM_SPEC.num_bands
        assert src.width == FARM_SPEC.width_px
        assert src.height == FARM_SPEC.height_px
        assert str(src.crs) == FARM_SPEC.crs
        cube_tif = src.read()

    with h5py.File(h5_path, "r") as h5f:
        cube_h5 = h5f["reflectance"][:]
        wavelengths = h5f["wavelengths_nm"][:]
        labels = h5f["labels"][:]

    assert cube_tif.shape == cube_h5.shape
    assert np.allclose(cube_tif, cube_h5, atol=1e-6)
    assert wavelengths.shape == (FARM_SPEC.num_bands,)
    assert set(np.unique(labels).tolist()) == {0, 1, 2}


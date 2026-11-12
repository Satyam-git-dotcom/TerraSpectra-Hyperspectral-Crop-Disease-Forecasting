"""Day 3 unit tests for spectral normalization and 220-band PCA reduction."""

from pathlib import Path

import numpy as np

from src.generate_mock_cube import write_outputs
from src.loader import load_cube
from src.pca import SpectralPCA, normalize_cube, run_pca_pipeline


def test_normalize_cube_handles_nans_and_standardizes() -> None:
    rng = np.random.default_rng(7)
    data = rng.normal(loc=0.4, scale=0.1, size=(12, 20, 20)).astype(np.float32)
    data[0, 3, 5] = np.nan

    norm, means, stds = normalize_cube(data)

    assert norm.shape == data.shape
    assert not np.isnan(norm).any()
    assert means.shape == (12,)
    assert stds.shape == (12,)
    assert np.allclose(norm.mean(axis=(1, 2)), 0.0, atol=1e-5)
    assert np.allclose(norm.std(axis=(1, 2)), 1.0, atol=1e-2)


def test_spectral_pca_retains_variance_and_separates_blight(tmp_path: Path) -> None:
    tif_path = tmp_path / "farm.tif"
    h5_path = tmp_path / "farm.h5"
    meta_path = tmp_path / "meta.json"
    write_outputs(geotiff_path=tif_path, hdf5_path=h5_path, metadata_path=meta_path)

    cube = load_cube(h5_path)
    pca = SpectralPCA(n_components=16)
    result = pca.fit_transform(cube)

    assert result.components.shape == (16, cube.shape[1], cube.shape[2])
    assert result.components.dtype == np.float32
    assert result.cumulative_variance >= 0.90
    assert result.separability is not None
    assert result.separability["centroid_l2_distance"] > 1.0

    # Verify transform() works on new cubes using fitted statistics
    projected = pca.transform(cube.data)
    assert np.allclose(projected, result.components, atol=1e-4)


def test_incremental_pca_and_pipeline_exports(tmp_path: Path) -> None:
    tif_path = tmp_path / "farm.tif"
    h5_path = tmp_path / "farm.h5"
    meta_path = tmp_path / "meta.json"
    write_outputs(geotiff_path=tif_path, hdf5_path=h5_path, metadata_path=meta_path)

    cube = load_cube(h5_path)
    inc_pca = SpectralPCA(n_components=8, incremental=True, batch_size=2048)
    inc_result = inc_pca.fit_transform(cube)
    assert inc_result.components.shape == (8, cube.shape[1], cube.shape[2])
    assert inc_result.cumulative_variance >= 0.85

    arr_out = tmp_path / "pca16.npy"
    summary_out = tmp_path / "pca_summary.json"
    summary = run_pca_pipeline(
        input_path=h5_path,
        output_array_path=arr_out,
        output_summary_path=summary_out,
        n_components=16,
    )
    assert arr_out.exists()
    assert summary_out.exists()
    assert summary["output_shape"] == [16, cube.shape[1], cube.shape[2]]


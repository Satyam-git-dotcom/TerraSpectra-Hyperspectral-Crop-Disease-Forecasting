"""End-to-end integration test suite for the complete Week 1 milestone.

Verifies:
1. Synthetic 220-band hyperspectral cube generation (HDF5 & GeoTIFF).
2. Rasterio / h5py unified loader ingestion and metadata parity.
3. 220-band PCA dimensionality reduction to 16 components (variance >= 90%).
4. False-color PNG generation for the georeferenced Deck.gl BitmapLayer.
5. Class separability of the pre-visual fungal blight zone in PCA space.
"""

from pathlib import Path

import numpy as np

from src.config import FARM_SPEC, FRONTEND_PCA_IMAGE_PATH
from src.generate_mock_cube import write_outputs
from src.loader import load_cube
from src.pca import export_pca_rgb_image, run_pca_pipeline


def test_full_week1_end_to_end_pipeline(tmp_path: Path) -> None:
    # Step 1: Generate mock cubes
    tif_path = tmp_path / "farm.tif"
    h5_path = tmp_path / "farm.h5"
    meta_path = tmp_path / "metadata.json"
    meta = write_outputs(geotiff_path=tif_path, hdf5_path=h5_path, metadata_path=meta_path)

    assert meta["shape"] == [220, 201, 201]
    assert 990.0 <= meta["total_acres"] <= 1010.0
    assert 4.5 <= meta["blight_zone_acres"] <= 5.5

    # Step 2: Ingest via unified loader
    tif_cube = load_cube(tif_path)
    h5_cube = load_cube(h5_path)
    assert tif_cube.shape == h5_cube.shape == (220, 201, 201)
    assert np.allclose(tif_cube.data, h5_cube.data, atol=1e-6)

    # Step 3: Run PCA pipeline
    pca_arr_path = tmp_path / "pca16.npy"
    pca_summary_path = tmp_path / "summary.json"
    pca_png_path = tmp_path / "pca_rgb.png"

    summary = run_pca_pipeline(
        input_path=h5_path,
        output_array_path=pca_arr_path,
        output_summary_path=pca_summary_path,
        output_image_paths=(pca_png_path,),
        n_components=16,
    )

    assert summary["output_shape"] == [16, 201, 201]
    assert summary["cumulative_explained_variance"] >= 0.90
    assert summary["separability"]["centroid_l2_distance"] > 10.0
    assert summary["separability"]["fisher_ratio_top3"] > 50.0

    # Step 4: Verify generated PNG image
    assert pca_png_path.exists()
    assert pca_png_path.stat().st_size > 50_000  # Non-empty compressed PNG
    with open(pca_png_path, "rb") as f:
        header = f.read(8)
        assert header == b"\x89PNG\r\n\x1a\n"

    # Step 5: Verify frontend asset exists
    assert FRONTEND_PCA_IMAGE_PATH.exists()
    assert FRONTEND_PCA_IMAGE_PATH.stat().st_size > 50_000


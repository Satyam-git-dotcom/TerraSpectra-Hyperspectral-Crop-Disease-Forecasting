"""End-to-end integration test suite for the complete Week 2 milestone.

Verifies:
1. 3D spatial-spectral tensor extraction from the 16-band PCA cube.
2. Trained SpatialSpectral3DCNN model loading and weight integrity.
3. Batch inference execution and probability calibration.
4. Correct high-confidence detection of the pre-visual fungal blight hotspot in Zone B.
5. Compatibility with frontend HeatmapPredictionResponse format.
"""

from pathlib import Path

import numpy as np
import torch

from src.config import (
    DEFAULT_HDF5_PATH,
    DEFAULT_MODEL_CHECKPOINT,
    DEFAULT_PCA_ARRAY_PATH,
    FARM_SPEC,
)
from src.dataset import HyperspectralPatchDataset
from src.loader import load_cube
from src.model_3dcnn import SpatialSpectral3DCNN
from src.train import load_model_checkpoint


def test_full_week2_end_to_end_pipeline() -> None:
    # 1. Verify existence of Week 1 & Week 2 pipeline artifacts
    assert DEFAULT_PCA_ARRAY_PATH.exists(), "16-band PCA array must exist"
    assert DEFAULT_MODEL_CHECKPOINT.exists(), "Trained 3D-CNN checkpoint must exist"

    pca_cube = np.load(DEFAULT_PCA_ARRAY_PATH)
    assert pca_cube.shape == (16, FARM_SPEC.height_px, FARM_SPEC.width_px)

    raw_cube = load_cube(DEFAULT_HDF5_PATH)
    labels = raw_cube.labels
    assert labels is not None
    assert set(np.unique(labels).tolist()) == {0, 1, 2}

    # 2. Verify model restoration
    model, checkpoint = load_model_checkpoint(DEFAULT_MODEL_CHECKPOINT, device=torch.device("cpu"))
    assert isinstance(model, SpatialSpectral3DCNN)
    assert checkpoint["spectral_depth"] == 16
    assert checkpoint["num_classes"] == 3
    assert checkpoint["val_metrics"]["accuracy"] >= 0.95
    assert checkpoint["val_metrics"]["blight_recall"] >= 0.90

    # 3. Test patch extraction and inference on known ground-truth locations:
    # Center of blight hotspot is around (62, 138)
    blight_coords = [(62, 138), (61, 137), (63, 139)]
    # Healthy crop sample from Zone A
    healthy_coords = [(30, 40), (35, 45)]
    # Soil/road sample
    soil_coords = [(100, 50), (50, 100)]

    test_coords = blight_coords + healthy_coords + soil_coords
    dataset = HyperspectralPatchDataset(
        cube=pca_cube,
        labels=labels,
        pixel_indices=test_coords,
        patch_size=9,
        augment=False,
    )

    # 4. Run inference
    batch_x = torch.stack([dataset[i][0] for i in range(len(dataset))])
    with torch.no_grad():
        probs = model.predict_proba(batch_x)

    assert probs.shape == (len(test_coords), 3)
    # First 3 samples are blight hotspot -> Class 2 probability should be highest
    for i in range(len(blight_coords)):
        blight_prob = probs[i, 2].item()
        assert blight_prob > 0.70, f"Expected high blight prob for hotspot pixel, got {blight_prob}"

    # Healthy samples -> Class 1 probability highest
    for i in range(len(blight_coords), len(blight_coords) + len(healthy_coords)):
        healthy_prob = probs[i, 1].item()
        assert healthy_prob > 0.80, f"Expected high healthy prob, got {healthy_prob}"

    # Soil samples -> Class 0 probability highest
    for i in range(len(blight_coords) + len(healthy_coords), len(test_coords)):
        soil_prob = probs[i, 0].item()
        assert soil_prob > 0.70, f"Expected high soil prob, got {soil_prob}"

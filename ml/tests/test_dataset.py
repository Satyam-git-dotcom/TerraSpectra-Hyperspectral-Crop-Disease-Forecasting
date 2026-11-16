"""Unit tests for 3D spatial-spectral patch dataset and stratified loader."""

import numpy as np
import pytest
import torch

from src.dataset import (
    HyperspectralPatchDataset,
    create_stratified_pixel_indices,
    create_train_val_loaders,
)


@pytest.fixture
def mock_spectral_cube_and_labels() -> tuple[np.ndarray, np.ndarray]:
    rng = np.random.default_rng(101)
    depth, height, width = 16, 40, 40
    cube = rng.normal(loc=0.0, scale=1.0, size=(depth, height, width)).astype(np.float32)

    labels = np.ones((height, width), dtype=np.uint8)
    labels[0:5, :] = 0  # Soil
    labels[15:20, 15:20] = 2  # Blight anomaly
    return cube, labels


def test_patch_dataset_shapes_and_boundary_padding(
    mock_spectral_cube_and_labels: tuple[np.ndarray, np.ndarray]
) -> None:
    cube, labels = mock_spectral_cube_and_labels

    # Test top-left corner pixel (0, 0), center pixel (20, 20), bottom-right (39, 39)
    indices = [(0, 0), (20, 20), (39, 39)]
    patch_size = 9
    dataset = HyperspectralPatchDataset(
        cube=cube,
        labels=labels,
        pixel_indices=indices,
        patch_size=patch_size,
        augment=False,
    )

    assert len(dataset) == 3
    x0, y0 = dataset[0]
    assert x0.shape == (1, 16, patch_size, patch_size)
    assert x0.dtype == torch.float32
    assert y0.item() == labels[0, 0]

    x_last, y_last = dataset[2]
    assert x_last.shape == (1, 16, patch_size, patch_size)
    assert y_last.item() == labels[39, 39]


def test_patch_dataset_validation_errors() -> None:
    cube = np.zeros((16, 20, 20), dtype=np.float32)
    labels = np.zeros((20, 20), dtype=np.uint8)

    with pytest.raises(ValueError, match="patch_size must be an odd integer"):
        HyperspectralPatchDataset(cube, labels, [(5, 5)], patch_size=8)

    with pytest.raises(ValueError, match="Spatial dimensions mismatch"):
        HyperspectralPatchDataset(cube, np.zeros((25, 25), dtype=np.uint8), [(5, 5)])


def test_stratified_pixel_indices_and_loaders(
    mock_spectral_cube_and_labels: tuple[np.ndarray, np.ndarray]
) -> None:
    cube, labels = mock_spectral_cube_and_labels
    train_idx, val_idx, dist = create_stratified_pixel_indices(
        labels=labels,
        train_ratio=0.8,
        max_samples_per_class=100,
        seed=42,
    )

    assert len(dist) == 3
    assert len(train_idx) > 0
    assert len(val_idx) > 0

    train_loader, val_loader, _ = create_train_val_loaders(
        cube=cube,
        labels=labels,
        patch_size=7,
        batch_size=8,
        train_ratio=0.8,
        max_samples_per_class=100,
        seed=42,
    )

    for batch_x, batch_y in train_loader:
        assert batch_x.ndim == 5  # (B, 1, Depth, H, W)
        assert batch_x.shape[1:] == (1, 16, 7, 7)
        assert batch_y.ndim == 1
        assert batch_y.shape[0] == batch_x.shape[0]
        break

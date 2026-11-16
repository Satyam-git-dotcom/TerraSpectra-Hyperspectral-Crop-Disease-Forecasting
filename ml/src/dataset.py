"""3D Spatial-Spectral PyTorch Dataset and Patch Extractor for TerraSpectra 3D-CNN."""

from __future__ import annotations

from typing import Sequence

import numpy as np
import torch
from torch.utils.data import DataLoader, Dataset


class HyperspectralPatchDataset(Dataset):
    """Extracts 3D spatial-spectral tensor patches centered at specified pixel coordinates.

    Output tensor shape for each sample:
        x: (1, Depth, Height_patch, Width_patch) -> float32
        y: scalar class index (0 = soil, 1 = healthy, 2 = pre-visual blight) -> int64
    """

    def __init__(
        self,
        cube: np.ndarray,
        labels: np.ndarray,
        pixel_indices: Sequence[tuple[int, int]],
        patch_size: int = 9,
        augment: bool = False,
    ) -> None:
        if cube.ndim != 3:
            raise ValueError(f"Expected cube of shape (Depth, H, W), got {cube.shape}")
        if labels.ndim != 2:
            raise ValueError(f"Expected labels of shape (H, W), got {labels.shape}")
        if cube.shape[1:] != labels.shape:
            raise ValueError(
                f"Spatial dimensions mismatch: cube {cube.shape[1:]} vs labels {labels.shape}"
            )
        if patch_size % 2 == 0 or patch_size < 3:
            raise ValueError(f"patch_size must be an odd integer >= 3, got {patch_size}")

        self.cube = cube.astype(np.float32)
        self.labels = labels.astype(np.int64)
        self.pixel_indices = list(pixel_indices)
        self.patch_size = patch_size
        self.radius = patch_size // 2
        self.augment = augment

        # Apply spatial reflection padding to handle edge/boundary pixels
        # cube is (D, H, W), pad only spatial dimensions H and W
        self.padded_cube = np.pad(
            self.cube,
            pad_width=((0, 0), (self.radius, self.radius), (self.radius, self.radius)),
            mode="reflect",
        )

    def __len__(self) -> int:
        return len(self.pixel_indices)

    def __getitem__(self, idx: int) -> tuple[torch.Tensor, torch.Tensor]:
        row, col = self.pixel_indices[idx]
        target_label = int(self.labels[row, col])

        # Slice patch from padded cube (padded indices shifted by radius)
        r_start = row
        r_end = row + self.patch_size
        c_start = col
        c_end = col + self.patch_size

        patch = self.padded_cube[:, r_start:r_end, c_start:c_end].copy()

        # Data augmentation: random flips / rotations
        if self.augment:
            if np.random.rand() > 0.5:
                patch = np.flip(patch, axis=1)  # Vertical flip
            if np.random.rand() > 0.5:
                patch = np.flip(patch, axis=2)  # Horizontal flip
            k_rot = np.random.choice([0, 1, 2, 3])
            if k_rot > 0:
                patch = np.rot90(patch, k=k_rot, axes=(1, 2))

        # Shape: (1, Depth, Height, Width) for PyTorch Conv3d
        tensor_x = torch.from_numpy(np.ascontiguousarray(patch)).unsqueeze(0)
        tensor_y = torch.tensor(target_label, dtype=torch.long)
        return tensor_x, tensor_y


def create_stratified_pixel_indices(
    labels: np.ndarray,
    train_ratio: float = 0.8,
    max_samples_per_class: int | None = 1200,
    seed: int = 42,
) -> tuple[list[tuple[int, int]], list[tuple[int, int]], dict[int, int]]:
    """Extract balanced, stratified train and validation pixel coordinate indices.

    Prevents majority healthy pixels (~39,000) from starving pre-visual blight (~197)
    and soil/road (~1,200) pixels during 3D-CNN training.
    """
    rng = np.random.default_rng(seed)
    unique_classes = np.unique(labels)

    train_indices: list[tuple[int, int]] = []
    val_indices: list[tuple[int, int]] = []
    class_distribution: dict[int, int] = {}

    for cls in unique_classes:
        rows, cols = np.where(labels == cls)
        coords = list(zip(rows.tolist(), cols.tolist()))
        rng.shuffle(coords)

        total_cls = len(coords)
        class_distribution[int(cls)] = total_cls

        if max_samples_per_class is not None and total_cls > max_samples_per_class:
            coords = coords[:max_samples_per_class]

        n_train = max(1, int(len(coords) * train_ratio))
        train_indices.extend(coords[:n_train])
        val_indices.extend(coords[n_train:])

    rng.shuffle(train_indices)
    rng.shuffle(val_indices)
    return train_indices, val_indices, class_distribution


def create_train_val_loaders(
    cube: np.ndarray,
    labels: np.ndarray,
    patch_size: int = 9,
    batch_size: int = 32,
    train_ratio: float = 0.8,
    max_samples_per_class: int | None = 1200,
    num_workers: int = 0,
    seed: int = 42,
) -> tuple[DataLoader, DataLoader, dict[int, int]]:
    """Create train and validation DataLoaders for 3D-CNN training."""
    train_idx, val_idx, class_dist = create_stratified_pixel_indices(
        labels=labels,
        train_ratio=train_ratio,
        max_samples_per_class=max_samples_per_class,
        seed=seed,
    )

    train_dataset = HyperspectralPatchDataset(
        cube=cube,
        labels=labels,
        pixel_indices=train_idx,
        patch_size=patch_size,
        augment=True,
    )
    val_dataset = HyperspectralPatchDataset(
        cube=cube,
        labels=labels,
        pixel_indices=val_idx,
        patch_size=patch_size,
        augment=False,
    )

    train_loader = DataLoader(
        train_dataset,
        batch_size=batch_size,
        shuffle=True,
        num_workers=num_workers,
    )
    val_loader = DataLoader(
        val_dataset,
        batch_size=batch_size,
        shuffle=False,
        num_workers=num_workers,
    )

    return train_loader, val_loader, class_dist

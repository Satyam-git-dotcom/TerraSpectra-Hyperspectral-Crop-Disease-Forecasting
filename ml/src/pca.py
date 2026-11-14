"""Spectral normalization and PCA dimensionality reduction for hyperspectral cubes."""

from __future__ import annotations

from dataclasses import dataclass
import json
from pathlib import Path
import struct
from typing import Any
import zlib

import numpy as np
from sklearn.decomposition import IncrementalPCA, PCA

from src.config import (
    DATA_DIR,
    DEFAULT_HDF5_PATH,
    DEFAULT_PCA_IMAGE_PATH,
    FRONTEND_PCA_IMAGE_PATH,
)
from src.loader import HyperspectralCube, load_cube

DEFAULT_PCA_ARRAY_PATH = DATA_DIR / "farm_pca16.npy"
DEFAULT_PCA_SUMMARY_PATH = DATA_DIR / "pca_summary.json"


@dataclass
class PCAResult:
    """Reduced-dimension hyperspectral cube and explained variance diagnostics."""

    components: np.ndarray                # Shape: (n_components, height, width), float32
    explained_variance_ratio: list[float]
    cumulative_variance: float
    separability: dict[str, float] | None = None


def normalize_cube(data: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Apply per-band z-score standardization across spatial pixels.

    NaN values (e.g. masked nodata) are imputed with each band's finite mean
    before standardization. Returns (normalized_cube, band_means, band_stds).
    """
    if data.ndim != 3:
        raise ValueError(f"Expected 3D cube (bands, height, width), got shape {data.shape}")

    bands, height, width = data.shape
    flat = data.reshape(bands, height * width).astype(np.float32, copy=True)

    band_means = np.nanmean(flat, axis=1, keepdims=True)
    band_means = np.where(np.isnan(band_means), 0.0, band_means).astype(np.float32)

    nan_mask = np.isnan(flat)
    if np.any(nan_mask):
        row_idx, _ = np.where(nan_mask)
        flat[nan_mask] = band_means[row_idx, 0]

    band_stds = np.std(flat, axis=1, keepdims=True).astype(np.float32)
    safe_stds = np.where(band_stds < 1e-6, 1.0, band_stds).astype(np.float32)

    normalized = ((flat - band_means) / safe_stds).reshape(bands, height, width)
    return normalized.astype(np.float32), band_means.ravel(), safe_stds.ravel()


def compute_blight_separability(
    components: np.ndarray,
    labels: np.ndarray,
) -> dict[str, float] | None:
    """Measure separation between healthy (1) and pre-visual blight (2) pixels in PCA space."""
    healthy_mask = labels == 1
    blight_mask = labels == 2
    if not np.any(healthy_mask) or not np.any(blight_mask):
        return None

    # Transpose to (H, W, k) for pixel-wise indexing
    px_features = np.moveaxis(components, 0, -1)
    healthy_vecs = px_features[healthy_mask]
    blight_vecs = px_features[blight_mask]

    healthy_mean = healthy_vecs.mean(axis=0)
    blight_mean = blight_vecs.mean(axis=0)
    centroid_distance = float(np.linalg.norm(blight_mean - healthy_mean))

    # Mean per-component Fisher discriminant ratio across top 3 PCs
    pooled_var = healthy_vecs[:, :3].var(axis=0) + blight_vecs[:, :3].var(axis=0) + 1e-6
    fisher_top3 = float(
        np.mean(((blight_mean[:3] - healthy_mean[:3]) ** 2) / pooled_var)
    )

    return {
        "healthy_pixels": int(np.sum(healthy_mask)),
        "blight_pixels": int(np.sum(blight_mask)),
        "centroid_l2_distance": round(centroid_distance, 4),
        "fisher_ratio_top3": round(fisher_top3, 4),
    }


class SpectralPCA:
    """Compress 200+ spectral bands to a compact set of orthogonal components."""

    def __init__(
        self,
        n_components: int = 16,
        incremental: bool = False,
        batch_size: int = 4096,
    ) -> None:
        if n_components < 1:
            raise ValueError("n_components must be >= 1")
        self.n_components = n_components
        self.incremental = incremental
        self.batch_size = batch_size
        self._model: PCA | IncrementalPCA = (
            IncrementalPCA(n_components=n_components, batch_size=batch_size)
            if incremental
            else PCA(n_components=n_components, random_state=42)
        )
        self.band_means_: np.ndarray | None = None
        self.band_stds_: np.ndarray | None = None

    def fit_transform(self, cube: HyperspectralCube) -> PCAResult:
        """Standardize cube bands, fit PCA, and return reduced (k, H, W) tensor."""
        normalized, means, stds = normalize_cube(cube.data)
        self.band_means_ = means
        self.band_stds_ = stds

        bands, height, width = normalized.shape
        samples = np.moveaxis(normalized, 0, -1).reshape(height * width, bands)

        reduced_flat = self._model.fit_transform(samples).astype(np.float32)
        components = np.moveaxis(
            reduced_flat.reshape(height, width, self.n_components),
            -1,
            0,
        ).copy()

        evr = [round(float(v), 6) for v in self._model.explained_variance_ratio_]
        cumulative = round(float(np.sum(self._model.explained_variance_ratio_)), 6)
        separability = (
            compute_blight_separability(components, cube.labels)
            if cube.labels is not None
            else None
        )

        return PCAResult(
            components=components,
            explained_variance_ratio=evr,
            cumulative_variance=cumulative,
            separability=separability,
        )

    def transform(self, data: np.ndarray) -> np.ndarray:
        """Project a new (bands, height, width) cube using fitted statistics and PCA."""
        if self.band_means_ is None or self.band_stds_ is None:
            raise RuntimeError("SpectralPCA must be fitted before calling transform().")

        bands, height, width = data.shape
        flat = data.reshape(bands, height * width).astype(np.float32, copy=True)
        nan_mask = np.isnan(flat)
        if np.any(nan_mask):
            row_idx, _ = np.where(nan_mask)
            flat[nan_mask] = self.band_means_[row_idx]

        standardized = (flat - self.band_means_[:, None]) / self.band_stds_[:, None]
        samples = standardized.T
        reduced_flat = self._model.transform(samples).astype(np.float32)
        return np.moveaxis(
            reduced_flat.reshape(height, width, self.n_components),
            -1,
            0,
        ).copy()


def save_png_rgb(image: np.ndarray, path: Path | str) -> Path:
    """Save a (height, width, 3) uint8 numpy array as an RFC-compliant PNG."""
    target_path = Path(path)
    target_path.parent.mkdir(parents=True, exist_ok=True)

    if image.ndim != 3 or image.shape[2] != 3:
        raise ValueError(f"Expected shape (H, W, 3), got {image.shape}")
    if image.dtype != np.uint8:
        image = np.clip(image, 0, 255).astype(np.uint8)

    height, width, _ = image.shape
    raw = bytearray()
    for row in range(height):
        raw.append(0)  # Filter type 0 (None)
        raw.extend(image[row].tobytes())

    compressed = zlib.compress(bytes(raw), level=6)

    def chunk(tag: bytes, data: bytes) -> bytes:
        crc = zlib.crc32(tag + data) & 0xFFFFFFFF
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", crc)

    header = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    with open(target_path, "wb") as f:
        f.write(header)
        f.write(chunk(b"IHDR", ihdr))
        f.write(chunk(b"IDAT", compressed))
        f.write(chunk(b"IEND", b""))

    return target_path


def export_pca_rgb_image(
    components: np.ndarray,
    output_path: Path | str,
) -> Path:
    """Compose top-3 PCA components into a contrast-stretched RGB false-color PNG."""
    if components.ndim != 3 or components.shape[0] < 3:
        raise ValueError("components must have shape (n_components >= 3, height, width)")

    rgb_channels = []
    for c in range(3):
        ch = components[c]
        p2, p98 = np.percentile(ch, (2.0, 98.0))
        if p98 - p2 > 1e-6:
            stretched = (ch - p2) / (p98 - p2)
        else:
            stretched = np.zeros_like(ch)
        stretched_uint8 = np.clip(stretched * 255.0, 0, 255).astype(np.uint8)
        rgb_channels.append(stretched_uint8)

    rgb_image = np.stack(rgb_channels, axis=-1)  # (H, W, 3)
    return save_png_rgb(rgb_image, output_path)


def run_pca_pipeline(
    input_path: Path = DEFAULT_HDF5_PATH,
    output_array_path: Path = DEFAULT_PCA_ARRAY_PATH,
    output_summary_path: Path = DEFAULT_PCA_SUMMARY_PATH,
    output_image_paths: tuple[Path, ...] = (
        DEFAULT_PCA_IMAGE_PATH,
        FRONTEND_PCA_IMAGE_PATH,
    ),
    n_components: int = 16,
) -> dict[str, Any]:
    """Load hyperspectral cube, run SpectralPCA, and persist outputs & RGB overlays."""
    cube = load_cube(input_path)
    pca = SpectralPCA(n_components=n_components)
    result = pca.fit_transform(cube)

    output_array_path.parent.mkdir(parents=True, exist_ok=True)
    np.save(output_array_path, result.components)

    exported_images = []
    for img_path in output_image_paths:
        exported_path = export_pca_rgb_image(result.components, img_path)
        exported_images.append(str(exported_path.name))

    summary: dict[str, Any] = {
        "input_file": input_path.name,
        "input_shape": list(cube.shape),
        "output_shape": list(result.components.shape),
        "n_components": n_components,
        "cumulative_explained_variance": result.cumulative_variance,
        "top5_explained_variance_ratio": result.explained_variance_ratio[:5],
        "separability": result.separability,
        "output_array": output_array_path.name,
        "exported_images": exported_images,
    }
    output_summary_path.write_text(json.dumps(summary, indent=2))
    return summary


if __name__ == "__main__":
    summary = run_pca_pipeline()
    print("PCA dimensionality reduction complete:")
    print(json.dumps(summary, indent=2))


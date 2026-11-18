"""Unit tests for the 3D-CNN training, evaluation, and checkpointing pipeline."""

from pathlib import Path

import numpy as np
import pytest
import torch

from src.train import (
    calculate_metrics,
    compute_class_weights,
    load_model_checkpoint,
    train_model,
)


def test_compute_class_weights() -> None:
    # 80 healthy (class 1), 15 soil (class 0), 5 blight (class 2)
    labels = np.array([0] * 15 + [1] * 80 + [2] * 5, dtype=np.uint8)
    weights = compute_class_weights(labels, num_classes=3)

    assert weights.shape == (3,)
    assert weights.dtype == torch.float32
    # Rare blight class (2) should have highest weight, majority class (1) lowest
    assert weights[2] > weights[0] > weights[1]


def test_calculate_metrics() -> None:
    targets = np.array([0, 1, 1, 2, 2, 2])
    preds = np.array([0, 1, 0, 2, 2, 1])  # 2 true positives for class 2, 1 false negative

    metrics = calculate_metrics(preds=preds, targets=targets, loss=0.42, blight_class_idx=2)

    assert metrics.loss == 0.42
    assert metrics.accuracy == round(4 / 6, 4)
    assert metrics.blight_precision == 1.0  # 2 TP / (2 TP + 0 FP)
    assert metrics.blight_recall == round(2 / 3, 4)  # 2 TP / 3 actual
    assert metrics.blight_f1 > 0.7


def test_train_model_and_checkpoint_roundtrip(tmp_path: Path) -> None:
    rng = np.random.default_rng(42)
    depth, height, width = 16, 25, 25
    cube = rng.normal(0.0, 1.0, size=(depth, height, width)).astype(np.float32)

    labels = np.ones((height, width), dtype=np.uint8)
    labels[0:4, :] = 0  # Soil
    labels[10:14, 10:14] = 2  # Blight

    ckpt_path = tmp_path / "test_model.pt"
    metrics_path = tmp_path / "test_metrics.json"

    summary = train_model(
        cube=cube,
        labels=labels,
        epochs=1,
        batch_size=8,
        patch_size=7,
        checkpoint_path=ckpt_path,
        metrics_path=metrics_path,
        device=torch.device("cpu"),
    )

    assert ckpt_path.exists()
    assert metrics_path.exists()
    assert summary["epochs"] == 1
    assert "best_epoch" in summary

    # Verify model checkpoint deserialization
    restored_model, checkpoint = load_model_checkpoint(ckpt_path, device=torch.device("cpu"))
    assert checkpoint["spectral_depth"] == depth
    assert checkpoint["num_classes"] == 3

    sample_x = torch.randn(2, 1, depth, 7, 7)
    with torch.no_grad():
        out = restored_model(sample_x)
    assert out.shape == (2, 3)

"""Training and evaluation pipeline for the TerraSpectra 3D-CNN."""

from __future__ import annotations

import argparse
from dataclasses import asdict, dataclass
import json
from pathlib import Path
from typing import Any

import numpy as np
import torch
import torch.nn as nn
from torch.optim import AdamW
from torch.optim.lr_scheduler import CosineAnnealingLR
from torch.utils.data import DataLoader

from src.config import (
    CHECKPOINTS_DIR,
    DEFAULT_HDF5_PATH,
    DEFAULT_MODEL_CHECKPOINT,
    DEFAULT_PCA_ARRAY_PATH,
    DEFAULT_TRAINING_METRICS_PATH,
)
from src.dataset import create_train_val_loaders
from src.loader import load_cube
from src.model_3dcnn import SpatialSpectral3DCNN
from src.pca import run_pca_pipeline


@dataclass
class EpochMetrics:
    loss: float
    accuracy: float
    blight_precision: float
    blight_recall: float
    blight_f1: float
    confusion_matrix: list[list[int]]


def get_device() -> torch.device:
    """Select best available hardware acceleration device."""
    if torch.backends.mps.is_available():
        return torch.device("mps")
    if torch.cuda.is_available():
        return torch.device("cuda")
    return torch.device("cpu")


def compute_class_weights(labels: np.ndarray, num_classes: int = 3) -> torch.Tensor:
    """Compute balanced inverse frequency weights across classes."""
    counts = np.bincount(labels.ravel(), minlength=num_classes)
    total = len(labels.ravel())
    weights = total / (num_classes * np.maximum(counts, 1).astype(np.float32))
    # Normalize weights so their mean is 1.0
    weights = weights / weights.mean()
    return torch.from_numpy(weights.astype(np.float32))


def calculate_metrics(
    preds: np.ndarray,
    targets: np.ndarray,
    loss: float,
    blight_class_idx: int = 2,
    num_classes: int = 3,
) -> EpochMetrics:
    """Calculate accuracy, loss, and class-specific precision/recall/F1 for pre-visual blight."""
    total = len(targets)
    correct = int(np.sum(preds == targets))
    accuracy = round(correct / max(total, 1), 4)

    # Confusion matrix: rows = true, cols = pred
    cm = np.zeros((num_classes, num_classes), dtype=int)
    for t, p in zip(targets, preds):
        cm[t, p] += 1

    tp = cm[blight_class_idx, blight_class_idx]
    fp = np.sum(cm[:, blight_class_idx]) - tp
    fn = np.sum(cm[blight_class_idx, :]) - tp

    precision = round(tp / (tp + fp) if (tp + fp) > 0 else 0.0, 4)
    recall = round(tp / (tp + fn) if (tp + fn) > 0 else 0.0, 4)
    f1 = (
        round(2 * (precision * recall) / (precision + recall), 4)
        if (precision + recall) > 0
        else 0.0
    )

    return EpochMetrics(
        loss=round(loss, 4),
        accuracy=accuracy,
        blight_precision=precision,
        blight_recall=recall,
        blight_f1=f1,
        confusion_matrix=cm.tolist(),
    )


def train_one_epoch(
    model: nn.Module,
    loader: DataLoader,
    optimizer: torch.optim.Optimizer,
    criterion: nn.Module,
    device: torch.device,
) -> tuple[float, float]:
    """Execute one training epoch over the DataLoader."""
    model.train()
    total_loss = 0.0
    correct = 0
    total = 0

    for x, y in loader:
        x, y = x.to(device), y.to(device)
        optimizer.zero_grad()
        logits = model(x)
        loss = criterion(logits, y)
        loss.backward()
        optimizer.step()

        total_loss += loss.item() * len(y)
        preds = logits.argmax(dim=-1)
        correct += int((preds == y).sum().item())
        total += len(y)

    avg_loss = total_loss / max(total, 1)
    accuracy = correct / max(total, 1)
    return avg_loss, accuracy


@torch.no_grad()
def evaluate(
    model: nn.Module,
    loader: DataLoader,
    criterion: nn.Module,
    device: torch.device,
) -> EpochMetrics:
    """Evaluate model performance on validation data."""
    model.eval()
    total_loss = 0.0
    all_preds: list[int] = []
    all_targets: list[int] = []

    for x, y in loader:
        x, y = x.to(device), y.to(device)
        logits = model(x)
        loss = criterion(logits, y)
        total_loss += loss.item() * len(y)

        preds = logits.argmax(dim=-1).cpu().numpy().tolist()
        targets = y.cpu().numpy().tolist()
        all_preds.extend(preds)
        all_targets.extend(targets)

    avg_loss = total_loss / max(len(all_targets), 1)
    return calculate_metrics(
        preds=np.array(all_preds),
        targets=np.array(all_targets),
        loss=avg_loss,
    )


def train_model(
    cube: np.ndarray,
    labels: np.ndarray,
    epochs: int = 5,
    batch_size: int = 32,
    lr: float = 1e-3,
    patch_size: int = 9,
    checkpoint_path: Path = DEFAULT_MODEL_CHECKPOINT,
    metrics_path: Path = DEFAULT_TRAINING_METRICS_PATH,
    device: torch.device | None = None,
    seed: int = 42,
) -> dict[str, Any]:
    """Complete 3D-CNN training, evaluation, and checkpointing workflow."""
    torch.manual_seed(seed)
    np.random.seed(seed)

    selected_device = device or get_device()
    checkpoint_path.parent.mkdir(parents=True, exist_ok=True)
    metrics_path.parent.mkdir(parents=True, exist_ok=True)

    spectral_depth = cube.shape[0]
    num_classes = len(np.unique(labels))

    train_loader, val_loader, class_dist = create_train_val_loaders(
        cube=cube,
        labels=labels,
        patch_size=patch_size,
        batch_size=batch_size,
        train_ratio=0.8,
        seed=seed,
    )

    class_weights = compute_class_weights(labels, num_classes=num_classes).to(selected_device)
    criterion = nn.CrossEntropyLoss(weight=class_weights)

    model = SpatialSpectral3DCNN(
        spectral_depth=spectral_depth,
        num_classes=num_classes,
        dropout=0.3,
    ).to(selected_device)

    optimizer = AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    scheduler = CosineAnnealingLR(optimizer, T_max=epochs, eta_min=1e-5)

    history: list[dict[str, Any]] = []
    best_f1 = -1.0
    best_val_loss = float("inf")

    print(f"Training SpatialSpectral3DCNN on {selected_device} for {epochs} epochs...")
    print(f"Class Distribution: {class_dist} | Class Weights: {[round(w, 2) for w in class_weights.tolist()]}")

    for epoch in range(1, epochs + 1):
        train_loss, train_acc = train_one_epoch(
            model=model,
            loader=train_loader,
            optimizer=optimizer,
            criterion=criterion,
            device=selected_device,
        )
        val_metrics = evaluate(
            model=model,
            loader=val_loader,
            criterion=criterion,
            device=selected_device,
        )
        scheduler.step()

        epoch_record = {
            "epoch": epoch,
            "train_loss": round(train_loss, 4),
            "train_acc": round(train_acc, 4),
            "val_loss": val_metrics.loss,
            "val_acc": val_metrics.accuracy,
            "val_blight_precision": val_metrics.blight_precision,
            "val_blight_recall": val_metrics.blight_recall,
            "val_blight_f1": val_metrics.blight_f1,
            "lr": round(scheduler.get_last_lr()[0], 6),
        }
        history.append(epoch_record)

        print(
            f"Epoch {epoch:02d}/{epochs:02d} | "
            f"Train Loss: {train_loss:.4f} Acc: {train_acc:.2%} | "
            f"Val Loss: {val_metrics.loss:.4f} Acc: {val_metrics.accuracy:.2%} | "
            f"Blight F1: {val_metrics.blight_f1:.4f} (Prec: {val_metrics.blight_precision:.2f}, Rec: {val_metrics.blight_recall:.2f})"
        )

        # Save checkpoint if Blight F1 improves or val loss improves
        if val_metrics.blight_f1 > best_f1 or (
            val_metrics.blight_f1 == best_f1 and val_metrics.loss < best_val_loss
        ):
            best_f1 = val_metrics.blight_f1
            best_val_loss = val_metrics.loss
            torch.save(
                {
                    "epoch": epoch,
                    "model_state_dict": model.state_dict(),
                    "optimizer_state_dict": optimizer.state_dict(),
                    "val_metrics": asdict(val_metrics),
                    "spectral_depth": spectral_depth,
                    "num_classes": num_classes,
                    "patch_size": patch_size,
                },
                checkpoint_path,
            )

    summary: dict[str, Any] = {
        "device": str(selected_device),
        "total_parameters": model.count_parameters(),
        "epochs": epochs,
        "spectral_depth": spectral_depth,
        "patch_size": patch_size,
        "best_epoch": max(history, key=lambda h: (h["val_blight_f1"], -h["val_loss"])),
        "history": history,
        "checkpoint": checkpoint_path.name,
    }
    metrics_path.write_text(json.dumps(summary, indent=2))
    return summary


def load_model_checkpoint(
    checkpoint_path: Path | str = DEFAULT_MODEL_CHECKPOINT,
    device: torch.device | None = None,
) -> tuple[SpatialSpectral3DCNN, dict[str, Any]]:
    """Restore trained SpatialSpectral3DCNN model from saved checkpoint."""
    target_path = Path(checkpoint_path)
    if not target_path.exists():
        raise FileNotFoundError(f"Model checkpoint not found: {target_path}")

    selected_device = device or get_device()
    checkpoint = torch.load(target_path, map_location=selected_device, weights_only=False)

    model = SpatialSpectral3DCNN(
        spectral_depth=checkpoint["spectral_depth"],
        num_classes=checkpoint["num_classes"],
    )
    model.load_state_dict(checkpoint["model_state_dict"])
    model.to(selected_device)
    model.eval()
    return model, checkpoint


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train TerraSpectra 3D-CNN")
    parser.add_argument("--epochs", type=int, default=5, help="Number of training epochs")
    parser.add_argument("--batch-size", type=int, default=32, help="Batch size")
    parser.add_argument("--lr", type=float, default=1e-3, help="Learning rate")
    args = parser.parse_args()

    # Ensure PCA cube exists
    if not DEFAULT_PCA_ARRAY_PATH.exists():
        print(f"PCA cube not found at {DEFAULT_PCA_ARRAY_PATH}. Running PCA pipeline...")
        run_pca_pipeline()

    pca_cube = np.load(DEFAULT_PCA_ARRAY_PATH)
    raw_cube = load_cube(DEFAULT_HDF5_PATH)
    labels = raw_cube.labels
    if labels is None:
        raise ValueError("Ground truth labels missing from dataset.")

    results = train_model(
        cube=pca_cube,
        labels=labels,
        epochs=args.epochs,
        batch_size=args.batch_size,
        lr=args.lr,
    )
    print("\nTraining complete. Summary saved to:", DEFAULT_TRAINING_METRICS_PATH)

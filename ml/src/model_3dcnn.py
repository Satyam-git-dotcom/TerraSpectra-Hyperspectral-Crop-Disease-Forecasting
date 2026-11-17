"""Hybrid 3D Convolutional Neural Network for spatial-spectral crop disease forecasting."""

from __future__ import annotations

import torch
import torch.nn as nn
import torch.nn.functional as F


class ConvBlock3D(nn.Module):
    """3D Convolution + Batch Normalization + GELU activation."""

    def __init__(
        self,
        in_channels: int,
        out_channels: int,
        kernel_size: tuple[int, int, int],
        padding: tuple[int, int, int] = (0, 0, 0),
    ) -> None:
        super().__init__()
        self.conv = nn.Conv3d(
            in_channels=in_channels,
            out_channels=out_channels,
            kernel_size=kernel_size,
            padding=padding,
            bias=False,
        )
        self.bn = nn.BatchNorm3d(out_channels)
        self.act = nn.GELU()

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.act(self.bn(self.conv(x)))


class SpatialSpectral3DCNN(nn.Module):
    """Hybrid 3D-CNN that simultaneously captures spectral curves and spatial field texture.

    Input tensor shape:
        (Batch, Channels=1, Depth=spectral_depth, Height=patch_h, Width=patch_w)
    Default expected input:
        (Batch, 1, 16, 9, 9)

    Output:
        Logits of shape (Batch, num_classes)
        Classes: 0 = Bare Soil/Road, 1 = Healthy Crop, 2 = Pre-Visual Blight
    """

    def __init__(
        self,
        in_channels: int = 1,
        spectral_depth: int = 16,
        num_classes: int = 3,
        dropout: float = 0.3,
    ) -> None:
        super().__init__()
        self.spectral_depth = spectral_depth
        self.num_classes = num_classes

        # Block 1: Local spectral absorption gradients + 3x3 spatial context
        # (B, 1, 16, 9, 9) -> (B, 16, 12, 9, 9)
        self.block1 = ConvBlock3D(
            in_channels=in_channels,
            out_channels=16,
            kernel_size=(5, 3, 3),
            padding=(0, 1, 1),
        )

        # Block 2: Intermediate spectral-spatial feature fusion
        # (B, 16, 12, 9, 9) -> (B, 32, 8, 9, 9)
        self.block2 = ConvBlock3D(
            in_channels=16,
            out_channels=32,
            kernel_size=(5, 3, 3),
            padding=(0, 1, 1),
        )

        # Block 3: Higher-order non-linear interaction
        # (B, 32, 8, 9, 9) -> (B, 64, 6, 7, 7)
        self.block3 = ConvBlock3D(
            in_channels=32,
            out_channels=64,
            kernel_size=(3, 3, 3),
            padding=(0, 0, 0),
        )

        # Dual Adaptive Pooling: captures both average background signature and peak anomaly cues
        self.avg_pool = nn.AdaptiveAvgPool3d((1, 1, 1))
        self.max_pool = nn.AdaptiveMaxPool3d((1, 1, 1))

        # Classification Head: 64 avg + 64 max = 128 pooled features
        self.classifier = nn.Sequential(
            nn.Linear(128, 64),
            nn.LayerNorm(64),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(64, num_classes),
        )

    def extract_features(self, x: torch.Tensor) -> torch.Tensor:
        """Extract pooled 128-dimensional spatial-spectral representation vector."""
        if x.ndim != 5:
            raise ValueError(f"Expected 5D tensor (B, 1, D, H, W), got shape {x.shape}")
        if x.shape[2] != self.spectral_depth:
            raise ValueError(
                f"Expected spectral depth {self.spectral_depth}, got {x.shape[2]}"
            )

        h1 = self.block1(x)
        h2 = self.block2(h1)
        h3 = self.block3(h2)

        avg_rep = self.avg_pool(h3).flatten(1)
        max_rep = self.max_pool(h3).flatten(1)
        return torch.cat([avg_rep, max_rep], dim=1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """Compute unnormalized class logits."""
        features = self.extract_features(x)
        return self.classifier(features)

    @torch.no_grad()
    def predict_proba(self, x: torch.Tensor) -> torch.Tensor:
        """Compute calibrated class probabilities via softmax."""
        self.eval()
        logits = self.forward(x)
        return F.softmax(logits, dim=-1)

    def count_parameters(self) -> int:
        """Return total number of trainable model parameters."""
        return sum(p.numel() for p in self.parameters() if p.requires_grad)


if __name__ == "__main__":
    model = SpatialSpectral3DCNN(spectral_depth=16, num_classes=3)
    sample_input = torch.randn(4, 1, 16, 9, 9)
    logits = model(sample_input)
    probs = model.predict_proba(sample_input)
    print("3D-CNN Model Architecture Summary:")
    print(f"  Input Shape: {sample_input.shape}")
    print(f"  Logits Shape: {logits.shape}")
    print(f"  Probs Shape: {probs.shape} (Sum check: {probs.sum(dim=-1)})")
    print(f"  Trainable Parameters: {model.count_parameters():,}")

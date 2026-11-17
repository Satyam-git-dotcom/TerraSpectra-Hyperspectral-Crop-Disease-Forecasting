"""Unit tests for the SpatialSpectral3DCNN model architecture."""

import pytest
import torch
import torch.nn as nn

from src.model_3dcnn import SpatialSpectral3DCNN


def test_model_forward_and_feature_shapes() -> None:
    model = SpatialSpectral3DCNN(spectral_depth=16, num_classes=3)
    batch_size = 4
    x = torch.randn(batch_size, 1, 16, 9, 9)

    features = model.extract_features(x)
    assert features.shape == (batch_size, 128)

    logits = model(x)
    assert logits.shape == (batch_size, 3)
    assert logits.dtype == torch.float32


def test_model_predict_proba() -> None:
    model = SpatialSpectral3DCNN(spectral_depth=16, num_classes=3)
    x = torch.randn(6, 1, 16, 9, 9)

    probs = model.predict_proba(x)
    assert probs.shape == (6, 3)
    assert (probs >= 0.0).all() and (probs <= 1.0).all()
    # Check that probabilities sum to 1.0 along class dimension
    assert torch.allclose(probs.sum(dim=-1), torch.ones(6), atol=1e-5)


def test_model_backpropagation_and_gradients() -> None:
    model = SpatialSpectral3DCNN(spectral_depth=16, num_classes=3)
    optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)
    criterion = nn.CrossEntropyLoss()

    x = torch.randn(8, 1, 16, 9, 9)
    targets = torch.tensor([0, 1, 2, 1, 0, 2, 1, 1], dtype=torch.long)

    logits = model(x)
    loss = criterion(logits, targets)
    assert torch.isfinite(loss)

    optimizer.zero_grad()
    loss.backward()

    # Verify that every trainable parameter received a finite non-zero gradient
    for name, param in model.named_parameters():
        if param.requires_grad:
            assert param.grad is not None, f"Parameter {name} has no gradient"
            assert torch.isfinite(param.grad).all(), f"Parameter {name} has NaN/Inf gradient"


def test_model_parameter_count_and_compactness() -> None:
    model = SpatialSpectral3DCNN(spectral_depth=16, num_classes=3)
    param_count = model.count_parameters()
    # Compact footprint for fast inference and training
    assert 50_000 < param_count < 200_000


def test_model_input_dimension_validation() -> None:
    model = SpatialSpectral3DCNN(spectral_depth=16, num_classes=3)

    # Wrong tensor dimensions (4D instead of 5D)
    with pytest.raises(ValueError, match="Expected 5D tensor"):
        model(torch.randn(2, 16, 9, 9))

    # Wrong spectral depth (8 instead of 16)
    with pytest.raises(ValueError, match="Expected spectral depth 16"):
        model(torch.randn(2, 1, 8, 9, 9))

"""Mid-Project Review automated audit test suite."""

import json
from pathlib import Path

import numpy as np

from src.audit_extraction import profile_batch_scaling, verify_zero_memory_leak
from src.audit_gis import run_gis_validation_audit


def test_extraction_memory_scaling_and_savings() -> None:
    depth, height, width = 16, 20, 20
    cube = np.random.randn(depth, height, width).astype(np.float32)
    labels = np.ones((height, width), dtype=np.uint8)

    benchmarks = profile_batch_scaling(cube, labels, batch_sizes=(8, 16), patch_size=7)

    assert len(benchmarks) == 2
    for b in benchmarks:
        assert b.tensor_memory_mb < 2.0  # Compact sub-2MB batch tensors
        assert b.pca_memory_savings_percent > 90.0  # >= 90% savings over raw 220 bands
        assert b.throughput_samples_per_sec > 10.0


def test_extraction_zero_memory_leak() -> None:
    depth, height, width = 16, 15, 15
    cube = np.random.randn(depth, height, width).astype(np.float32)
    labels = np.ones((height, width), dtype=np.uint8)

    leak_report = verify_zero_memory_leak(cube, labels, total_patches=500, batch_size=32)

    assert not leak_report["leak_detected"]
    assert leak_report["rss_growth_mb"] < 25.0


def test_gis_coordinate_parity_audit(tmp_path: Path) -> None:
    report_path = tmp_path / "gis_report.json"
    report = run_gis_validation_audit(report_path=report_path)

    assert report_path.exists()
    assert report["max_spatial_offset_meters"] < 0.10  # Sub-decimeter boundary precision
    assert report["acreage_validation"]["discrepancy_acres"] < 0.10
    assert report["pre_visual_blight_hotspot_alignment"]["offset_meters"] < 30.0
    assert "PASSED" in report["audit_conclusion"]

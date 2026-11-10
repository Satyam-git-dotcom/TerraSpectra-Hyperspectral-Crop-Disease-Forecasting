"""Shared geospatial and hyperspectral configuration for TerraSpectra."""

from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class FarmSpec:
    """Geospatial specification for the mock 1,000-acre agricultural parcel."""

    name: str = "TerraSpectra Central Valley Parcel 01"
    # UTM Zone 10N (meters) centered near Five Points / Fresno County, CA
    crs: str = "EPSG:32610"
    origin_easting_m: float = 750000.0
    origin_northing_m: float = 4056000.0
    pixel_size_m: float = 10.0
    width_px: int = 201   # 2,010 m (~1,000 acres total area: 2010 * 2010 m^2 = 998.3 acres)
    height_px: int = 201
    num_bands: int = 220
    wavelength_min_nm: float = 400.0
    wavelength_max_nm: float = 2500.0


FARM_SPEC = FarmSpec()

REPO_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = REPO_ROOT / "data"
DEFAULT_GEOTIFF_PATH = DATA_DIR / "farm_hyperspectral.tif"
DEFAULT_HDF5_PATH = DATA_DIR / "farm_hyperspectral.h5"
DEFAULT_METADATA_PATH = DATA_DIR / "farm_metadata.json"


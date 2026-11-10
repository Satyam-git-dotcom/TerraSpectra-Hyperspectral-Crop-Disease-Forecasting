# TerraSpectra — Hyperspectral Crop Disease Forecasting

Precision agriculture platform combining hyperspectral satellite data pipelines (`Rasterio`, `HDF5`, `PCA`), a `3D-CNN + Vision Transformer` early-stress forecasting model (`PyTorch`), `FastAPI` tiled inference, and a 3D `React + Deck.gl` GIS dashboard.

## Structure
- `ml/` — Hyperspectral geospatial data pipeline, mock cube generator, PCA, and PyTorch models
- `frontend/` — React + TypeScript + Deck.gl 3D GIS dashboard
- `api/` — FastAPI inference & raster tiling service (Week 4)
- `data/` — Local GeoTIFF / HDF5 hyperspectral cubes (gitignored)

## Day 1 Quickstart

### 1. ML & Geospatial Pipeline
```bash
cd ml
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python -m src.generate_mock_cube
pytest
```

### 2. Frontend GIS Dashboard
```bash
cd frontend
npm install
npm run dev
```
Optional: copy `frontend/.env.example` to `frontend/.env` and set `VITE_MAPBOX_TOKEN` to use Mapbox styles instead of the built-in satellite tile fallback.


[Uploading README (1).md…]()
# WindScope

**Historical UK wind generation forecast intelligence for day-ahead electricity procurement.**

WindScope is a React and Python application that compares forecasts available at a selected historical decision cutoff with subsequently observed wind generation. It uses official Elexon BMRS datasets and focuses on decisions made in **January 2026**.

**Deployed application:** https://windscope-o17u7fdo8-anish-kinkars-projects.vercel.app/  
**Source repository:** https://github.com/anish-kinkar/wind-7k30m

> **Access note:** Verify that the deployed URL is publicly accessible in an incognito browser window before submission. If Vercel requests authentication, adjust the project's Deployment Protection settings or use a publicly accessible production URL.

## Features

- **Overview:** Wind generation forecasts versus actual generation, key accuracy metrics, and data coverage.
- **Forecast Explorer:** Historical decision-date and cutoff selection, forecast publication timestamps, lead times, and CSV export.
- **Accuracy Analysis:** Mean Absolute Error (MAE), Root Mean Squared Error (RMSE), and forecast bias.
- **Methodology:** Data sources, historical forecast selection, and analytical limitations.

## Technology stack

| Layer | Technology |
| --- | --- |
| Frontend | React, TypeScript, Vite |
| Charts | Recharts |
| Icons | Lucide React |
| Backend | Python, FastAPI, HTTPX |
| Local containers | Docker, Docker Compose |
| Deployment | Vercel |
| Data | Elexon BMRS |

## Repository structure

The following paths are relative to the application root (the directory containing `package.json` and `requirements.txt`).

```text
.
├── api/
│   ├── __init__.py          # Python package marker
│   └── index.py             # FastAPI routes, Elexon retrieval and analysis
├── src/
│   ├── main.tsx             # React interface, charts, filters and CSV export
│   └── style.css            # Application styling
├── tests/
│   └── test_analysis.py     # Backend analysis tests
├── index.html               # Vite HTML entry point
├── package.json             # Frontend dependencies and scripts
├── requirements.txt         # Python dependencies
├── tsconfig.json            # TypeScript configuration
├── vite.config.ts           # Vite configuration and local API proxy
├── vercel.json              # Vercel build and route configuration
├── Dockerfile               # Backend container image
├── docker-compose.yml       # Frontend and backend local services
├── .gitignore               # Ignored development artifacts
└── README.md                # Project documentation
```

## How to run locally

### Prerequisites

- Node.js and npm
- Python 3 and pip
- Git

### 1. Clone the repository

```bash
git clone https://github.com/anish-kinkar/wind-7k30m.git
cd wind-7k30m
```

If the application files are inside a subfolder, navigate to the folder containing `package.json` and `requirements.txt` before continuing.

### 2. Install Python dependencies

```bash
python -m venv .venv
```

Activate the environment:

**macOS / Linux:**

```bash
source .venv/bin/activate
```

**Windows PowerShell:**

```powershell
.venv\Scripts\Activate.ps1
```

Then install:

```bash
pip install -r requirements.txt
```

### 3. Start the Python backend

```bash
uvicorn api.index:app --reload --host 127.0.0.1 --port 8000
```

Backend health endpoint: http://localhost:8000/api/health

### 4. Start the React frontend

Open a second terminal in the application root:

```bash
npm install
npm run dev
```

Open http://localhost:5173 in your browser. Vite proxies `/api` requests to the local Python backend.

## Run with Docker

With Docker installed, start both services from the application root:

```bash
docker compose up --build
```

Open http://localhost:5173. To stop the services:

```bash
docker compose down
```

## Data sources and analysis

WindScope uses only the following Elexon BMRS datasets:

| Dataset | Purpose | Relevant fields |
| --- | --- | --- |
| [FUELHH](https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream) | Actual generation, filtered to `fuelType = WIND` | `startTime`, `generation` |
| [WINDFOR](https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream) | Wind generation forecasts | `startTime`, `publishTime`, `generation` |

For each target interval, the backend selects the most recently published forecast **at or before** the selected decision cutoff. Later forecasts are excluded to avoid look-ahead bias. The default **12:00 UTC** decision cutoff is a configurable scenario assumption, **not** a claim about the official market deadline.

Accuracy metrics use matched forecast and actual observations:

- **MAE:** mean absolute value of `(forecast - actual)`.
- **RMSE:** square root of the mean squared value of `(forecast - actual)`.
- **Bias:** mean of `(forecast - actual)`; positive values indicate overforecasting.

The observed WINDFOR forecast series has hourly target timestamps, while FUELHH actuals are half-hourly. Metrics use matching timestamps only; missing forecasts are not treated as zero or fabricated. Connecting hourly forecast points on a chart is a visual presentation choice, not data imputation.

The analysis is limited to January 2026 decision dates and their next-day delivery intervals. Electricity demand, prices, and trading recommendations are outside scope.

## Testing and production build

Run backend tests:

```bash
python -m pytest tests/
```

Check the frontend production build:

```bash
npm run build
```

These commands describe how to run checks; they do not imply that every future deployment has been tested.

## Deployment on Vercel

The application uses Vercel for the React frontend and Python API. The repository contains `vercel.json` with build and routing configuration.

To deploy:

1. Import the public GitHub repository into Vercel.
2. Set the project root to the application folder containing `package.json`, `api/`, and `vercel.json`.
3. Use `npm run build` as the build command and `dist` as the output directory.
4. Deploy and verify the frontend and `/api/health` and `/api/analysis` routes.
5. Confirm public access using an incognito browser window.

**Application:** https://windscope-o17u7fdo8-anish-kinkars-projects.vercel.app/

**Example analysis request:**

```text
/api/analysis?day=2026-01-15&cutoff_hour=12
```

## AI assistance disclosure

ChatGPT was used to assist with implementation, debugging, and documentation. AI-generated or synthetic energy measurements are not presented as genuine Elexon data.

## Limitations

This is a pilot decision-support application rather than a production electricity trading system. Its availability depends on the Elexon API and Vercel runtime. Historical forecast coverage may be lower than actual generation coverage because the datasets have different temporal resolutions.

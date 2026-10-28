# WindScope — Wind Generation Forecast Intelligence

**A full-stack analytics application for evaluating historical wind generation forecasts and supporting day-ahead electricity procurement decisions in the UK.**

**Live Application:** https://windscope-o17u7fdo8-anish-kinkars-projects.vercel.app/

**GitHub Repository:** https://github.com/anish-kinkar/wind-7k30m

## 1. Project Overview

WindScope is a web-based analytical platform designed for electricity procurement teams that rely on renewable generation forecasts when making day-ahead purchasing decisions.

Wind generation is weather-dependent, and differences between forecasted and actual generation introduce uncertainty into procurement planning.

The application retrieves historical UK wind generation data from Elexon BMRS, compares forecasts against actual generation, and calculates quantitative accuracy metrics to help users understand forecast reliability.

The analysis focuses on purchasing decisions made during January 2026.

## 2. Key Features

- **Wind Generation Overview:** Visualizes forecasted and actual national wind generation using interactive time-series charts.
- **Forecast Explorer:** Allows users to inspect historical forecast values, publication timestamps, and forecast lead times.
- **Forecast Accuracy Analysis:** Calculates Mean Absolute Error (MAE), Root Mean Squared Error (RMSE), and forecast bias.
- **Historical Decision Simulation:** Selects forecasts available before a configurable historical decision cutoff, avoiding look-ahead bias.
- **Data Coverage Monitoring:** Displays the availability of actual, forecast, and matched observations.
- **CSV Export:** Enables downloading interval-level analysis results.
- **Methodology Documentation:** Explains data sources, forecast selection logic, analytical assumptions, and limitations.

## 3. Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React, TypeScript, Vite |
| UI Styling | CSS |
| Charts | Recharts |
| Icons | Lucide React |
| Backend | Python, FastAPI |
| HTTP Client | HTTPX |
| Data Validation | Pydantic |
| Containerization | Docker |
| Deployment | Vercel |
| Data Source | Elexon BMRS API |

## 4. Project Structure

The application is organized into frontend, backend, configuration, and testing components.

```text
windscope/
├── api/
│   └── index.py
├── src/
│   ├── main.tsx
│   └── style.css
├── public/
├── tests/
├── index.html
├── package.json
├── requirements.txt
├── tsconfig.json
├── vite.config.ts
├── vercel.json
├── Dockerfile
├── docker-compose.yml
└── README.md
```

### Directory and File Descriptions

| File / Directory | Description |
|---|---|
| `api/index.py` | FastAPI backend, Elexon data retrieval, historical forecast selection, and accuracy calculations |
| `src/main.tsx` | React application, navigation, dashboard components, charts, filters, and CSV export |
| `src/style.css` | Application styling, layouts, typography, and responsive design |
| `public/` | Static frontend assets |
| `tests/` | Backend test files |
| `index.html` | HTML entry point |
| `package.json` | Frontend dependencies and npm scripts |
| `requirements.txt` | Python backend dependencies |
| `tsconfig.json` | TypeScript configuration |
| `vite.config.ts` | Vite development and build configuration |
| `vercel.json` | Vercel deployment and routing configuration |
| `Dockerfile` | Docker image configuration |
| `docker-compose.yml` | Local container orchestration |
| `README.md` | Project documentation |

## 5. Data Sources

WindScope uses official Elexon Balancing Mechanism Reporting Service (BMRS) datasets.

### Actual Wind Generation — FUELHH

Documentation:

https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream

The application filters records where `fuelType = WIND`.

Relevant fields:

- `startTime`: Generation interval timestamp.
- `generation`: Actual wind generation in MW.

Actual generation is available at 30-minute resolution.

### Forecast Wind Generation — WINDFOR

Documentation:

https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream

Relevant fields:

- `startTime`: Target generation timestamp.
- `publishTime`: Forecast publication timestamp.
- `generation`: Forecasted wind generation in MW.

Historical records are retrieved through the Python backend.

## 6. Forecast Selection Methodology

For each delivery interval, WindScope identifies forecasts published at or before the selected historical decision cutoff.

When multiple eligible forecasts exist, the application selects the most recently published forecast.

This ensures that forecast accuracy is evaluated using information available at the time of the simulated procurement decision.

Forecasts published after the cutoff are excluded to prevent look-ahead bias.

The default decision cutoff is 12:00 UTC. This is a configurable analytical assumption, not an asserted official market deadline.

## 7. Forecast Accuracy Metrics

Forecast accuracy is evaluated using matching forecast and actual generation observations.

**Mean Absolute Error (MAE)**

```text
MAE = mean(|Forecast - Actual|)
```

Measures the average absolute forecasting error in MW.

**Root Mean Squared Error (RMSE)**

```text
RMSE = sqrt(mean((Forecast - Actual)^2))
```

Places greater emphasis on larger forecasting errors.

**Forecast Bias**

```text
Bias = mean(Forecast - Actual)
```

Positive bias indicates overforecasting, while negative bias indicates underforecasting.

Missing observations are excluded from accuracy calculations rather than replaced with artificial values.

## 8. Running the Application Locally

### Prerequisites

Install the following:

- Node.js and npm
- Python 3
- Git
- Docker (optional)

### Clone the Repository

```bash
git clone https://github.com/anish-kinkar/wind-7k30m.git
cd wind-7k30m/windscope-vercel-app/windscope
```

### Install Frontend Dependencies

```bash
npm install
```

### Install Backend Dependencies

Create a Python virtual environment:

```bash
python -m venv .venv
```

Activate it on macOS or Linux:

```bash
source .venv/bin/activate
```

On Windows:

```powershell
.venv\Scripts\Activate.ps1
```

Install dependencies:

```bash
pip install -r requirements.txt
```

### Start the Backend

```bash
uvicorn api.index:app --reload --port 8000
```

The backend will be available at:

```text
http://localhost:8000
```

API health check:

```text
http://localhost:8000/api/health
```

### Start the Frontend

Open another terminal and run:

```bash
npm run dev
```

The frontend runs on the local address displayed by Vite, typically:

```text
http://localhost:5173
```

For local development, configure Vite to proxy `/api` requests to `http://localhost:8000` if this is not already configured.

## 9. Docker

The repository includes Docker configuration for containerized local development.

To start the configured services:

```bash
docker compose up --build
```

To stop them:

```bash
docker compose down
```

The exposed ports and service configuration are defined in `docker-compose.yml`.

## 10. Deployment

WindScope is deployed using Vercel.

**Application URL:**

https://windscope-o17u7fdo8-anish-kinkars-projects.vercel.app/

The application uses a React frontend and Python FastAPI backend, with deployment and routing configured for Vercel.

The frontend requests analysis through the backend's `/api/analysis` endpoint.

Example API request:

```text
/api/analysis?day=2026-01-15&cutoff_hour=12
```

The backend retrieves Elexon data, selects eligible historical forecasts, matches observations, and returns the resulting analysis.

## 11. Testing

Backend tests can be executed using:

```bash
python -m pytest tests/
```

The frontend production build can be checked using:

```bash
npm run build
```

These commands should be run before submitting changes or deploying a new version.

## 12. Scope and Limitations

- The analysis is restricted to purchasing decisions made in January 2026.
- Only national-level wind generation data from Elexon is used.
- Electricity demand, wholesale prices, and purchasing quantities are outside the project scope.
- Actual generation is available at 30-minute intervals, while the observed forecast data contains hourly target timestamps.
- Accuracy metrics are calculated using matched observations only.
- Missing forecast values are not fabricated.
- Data availability and API response times depend on Elexon's upstream service.
- Historical decision cutoffs are configurable analytical assumptions.


## 13. Project Links

**Live Application:**  
https://windscope-o17u7fdo8-anish-kinkars-projects.vercel.app/

**Source Code:**  
https://github.com/anish-kinkar/wind-7k30m

**Data Provider:**  
https://bmrs.elexon.co.uk/

---

WindScope is a pilot application demonstrating how historical renewable generation forecasts can be evaluated and presented through an accessible, data-driven decision-support interface.

# WindScope — UK wind forecast intelligence

A React + Python pilot for comparing UK national wind-generation forecasts with actual generation. Uses Elexon BMRS **FUELHH** actuals (WIND) and **WINDFOR** forecasts. Never displays fabricated production data.

## Features
Overview, Forecast explorer (CSV export), Accuracy analysis (MAE, RMSE, bias), and Methodology. Adjustable January 2026 decision date and cutoff.

## Files
- `src/main.tsx`, `src/style.css`: React/TypeScript frontend
- `api/index.py`: FastAPI backend, Elexon client, historical vintage selection, analytics
- `tests/`: Python unit tests
- `vercel.json`: Vercel build and routing configuration
- `Dockerfile`, `docker-compose.yml`: local containers

## Run locally
Node.js 20+ and Python 3.12+.

Terminal 1:
```bash
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\\Scripts\\activate
pip install -r requirements.txt
uvicorn api.index:app --reload --port 8000
```
Terminal 2:
```bash
npm install
npm run dev
```
Open http://localhost:5173. Docker alternative: `docker compose up --build`.

Tests: `python -m pytest -q`. Frontend: `npm run build`.

## Publish on Vercel
1. Push all files to a **public GitHub repo with an anonymous random-looking name**, as the assignment requires.
2. In Vercel, click **Add New → Project**, import the repo.
3. Set framework to **Vite**, root directory to repository root, build command `npm run build`, output directory `dist`.
4. Deploy. The `/api/index.py` FastAPI app is served as a Python Vercel Function. `vercel.json` maps `/api/*` to it.
5. Verify `https://YOUR-URL.vercel.app/api/health` and the app itself, including a real January data request, in an incognito window. Confirm the function routing works on your deployed Vercel runtime.
6. Put the verified Vercel URL here before submission: **[add URL]**.

## Data methodology and limitations
- Actuals: https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream
- Forecasts: https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream
- For each delivery interval, use the latest forecast published on or before the decision cutoff. Never use a later forecast. Match actuals by `startTime`.
- January 2026 **decision dates**, next-day UTC delivery; January 31 delivers February 1.
- 12:00 UTC default cutoff is a **scenario assumption, not a verified official market deadline**.
- MAE = mean(abs(forecast - actual)); RMSE = sqrt(mean((forecast - actual)^2)); bias = mean(forecast - actual). Missing values excluded.
- No demand or market price data.
- **Elexon live integration has NOT been verified:** the development environment cannot resolve `data.elexon.co.uk`. The `from` and `to` filters on WINDFOR may represent delivery time rather than publication time; confirm with real Elexon responses and correct the query before submission. The app currently attempts both query windows as a fallback, but completeness cannot be guaranteed without live verification.
- If Elexon is unreachable, the UI shows an error instead of fake numbers. Serverless execution time may be exceeded when retrieving large historical windows.

## AI assistance disclosure
OpenAI ChatGPT (GPT-6) assisted with product design, frontend/backend implementation, architecture, and documentation. Independently validate API behavior and deployment before submission.

## Required submission items
- Anonymous-name public GitHub repository
- Public Vercel deployment
- Unlisted YouTube video: <=5 minutes customer pitch + <=5 minutes technical walkthrough, <=10 minutes total
- Submit URLs at https://forms.cloud.microsoft/r/Ljmf1aWESK
- Open all submitted URLs in incognito to verify access

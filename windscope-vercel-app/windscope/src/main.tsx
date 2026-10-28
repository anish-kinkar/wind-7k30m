
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  LineChart, Line, AreaChart, Area, CartesianGrid,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
  Legend, ReferenceLine
} from "recharts";
import {
  Wind, BarChart3, Activity, BookOpen, Calendar,
  Clock, RefreshCw, Download, AlertTriangle,
  Database, Menu, X
} from "lucide-react";
import "./style.css";

type P = {
  time: string;
  forecast: number | null;
  actual: number | null;
  error: number | null;
  publishTime: string | null;
  leadHours: number | null;
};

type D = {
  decisionDate: string;
  deliveryDate: string;
  points: P[];
  metrics: {
    mae: number | null;
    rmse: number | null;
    bias: number | null;
    count: number;
  };
  coverage: {
    forecast: number;
    actual: number;
    matched: number;
    expected: number;
  };
};

const tabs = [
  "Overview",
  "Forecast explorer",
  "Accuracy analysis",
  "Methodology"
];

const fmt = (n: number | null | undefined, suffix = " MW") =>
  n == null
    ? "—"
    : n.toLocaleString("en-GB", { maximumFractionDigits: 1 }) + suffix;

const avg = (values: (number | null)[]) => {
  const valid = values.filter((x): x is number => x !== null);
  return valid.length
    ? valid.reduce((a, b) => a + b, 0) / valid.length
    : null;
};

const tm = (s: string) =>
  new Date(s).toLocaleTimeString("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit"
  });

function Section({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="section">
      <div>
        <h2>{title}</h2>
        <p>{desc}</p>
      </div>
      <span className="tag">Historical intervals</span>
    </div>
  );
}

function Metric({
  label, value, detail
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="metric">
      <div>
        {label}
        <span>↗</span>
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function GenerationChart({
  rows
}: {
  rows: (P & { label: string })[];
}) {
  return (
    <div className="panel chartpanel">
      <div className="panelhead">
        <div>
          <h3>Wind generation: forecast vs actual</h3>
          <p>
            National wind generation across the selected delivery day
          </p>
        </div>
        <span className="tag">MW</span>
      </div>

      <div className="chart">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows}>
            <CartesianGrid stroke="#e8edf0" vertical={false} />

            <XAxis
              dataKey="label"
              interval={7}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "#8895a4" }}
            />

            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: "#8895a4" }}
              width={56}
            />

            <Tooltip
              formatter={(value: number) => fmt(value)}
            />

            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              iconSize={8}
              wrapperStyle={{
                fontSize: 12,
                paddingBottom: 18
              }}
            />

            <Line
              name="Forecast"
              dataKey="forecast"
              stroke="#0d8b86"
              strokeWidth={2.5}
              strokeDasharray="7 4"
              dot={{ r: 2.5 }}
              activeDot={{ r: 6 }}
              connectNulls={true}
              isAnimationActive={false}
            />

            <Line
              name="Actual"
              dataKey="actual"
              stroke="#24384f"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 5 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <p style={{ fontSize: 11, color: "#8895a4" }}>
        Hourly forecast observations are connected visually.
        Missing half-hour values are not estimated.
      </p>
    </div>
  );
}

function Methodology() {
  return (
    <div className="method">
      <div className="panel feature">
        <span className="featureicon">
          <BookOpen size={24} />
        </span>
        <h2>Transparent by design.</h2>
        <p>
          WindScope compares forecasts available at a historical
          decision time against actual generation. Accuracy
          metrics use matching observations only.
        </p>
      </div>

      <div className="panel">
        <h3>01 / Official data sources</h3>
        <p>
          Actuals:{" "}
          <a
            href="https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/FUELHH/stream"
            target="_blank"
            rel="noopener noreferrer"
          >
            Elexon FUELHH ↗
          </a>
          , filtered to fuelType WIND.
        </p>
        <p>
          Forecasts:{" "}
          <a
            href="https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream"
            target="_blank"
            rel="noopener noreferrer"
          >
            Elexon WINDFOR ↗
          </a>
          , using startTime, publishTime, and generation.
        </p>
      </div>

      <div className="panel">
        <h3>02 / Historical forecast selection</h3>
        <p>
          For each delivery interval, the latest forecast
          published at or before the decision cutoff is
          selected. Later revisions are excluded to prevent
          look-ahead bias.
        </p>
        <p>
          The default 12:00 UTC cutoff is an adjustable
          analytical assumption, not an official market deadline.
        </p>
      </div>

      <div className="panel">
        <h3>03 / Accuracy definitions</h3>
        <p><b>MAE</b> = mean(|forecast − actual|)</p>
        <p><b>RMSE</b> = √mean((forecast − actual)²)</p>
        <p><b>Bias</b> = mean(forecast − actual)</p>
        <p>Positive bias indicates overforecasting.</p>
      </div>

      <div className="panel">
        <h3>04 / Scope and limitations</h3>
        <p>
          January 2026 decision dates and next-day national
          wind generation are analyzed. A January 31 decision
          includes February 1 delivery.
        </p>
        <p>
          Actuals have 30-minute resolution, while the observed
          forecast series has hourly timestamps. Missing
          forecast values are not fabricated.
        </p>
        <p>
          Data is processed in UTC and displayed in UK local
          time where indicated. Demand and prices are excluded.
        </p>
      </div>
    </div>
  );
}

function App() {
  const [tab, setTab] = useState(0);
  const [day, setDay] = useState("2026-01-15");
  const [hour, setHour] = useState(12);
  const [data, setData] = useState<D | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError("");
    setData(null);

    fetch(`/api/analysis?day=${day}&cutoff_hour=${hour}`)
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) {
          throw Error(result.detail || "Elexon API request failed");
        }
        return result;
      })
      .then((result: D) => {
        if (active) setData(result);
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [day, hour, retry]);

  const rows =
    data?.points.map((p) => ({
      ...p,
      label: tm(p.time)
    })) || [];

  function exportCSV() {
    if (!data) return;

    const text = [
      "startTime,forecastMW,actualMW,errorMW,publishTime,leadHours",
      ...data.points.map((p) =>
        [
          p.time,
          p.forecast ?? "",
          p.actual ?? "",
          p.error ?? "",
          p.publishTime ?? "",
          p.leadHours ?? ""
        ].join(",")
      )
    ].join("\n");

    const url = URL.createObjectURL(
      new Blob([text], { type: "text/csv" })
    );

    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `windscope-${day}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="shell">
      <aside className={menu ? "sidebar shown" : "sidebar"}>
        <div className="logo">
          <span className="logoicon">
            <Wind size={24} />
          </span>
          <div>
            <b>windscope<span>.</span></b>
            <small>ENERGY INTELLIGENCE</small>
          </div>
          <button
            className="menubtn"
            onClick={() => setMenu(false)}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>

        <div className="navlabel">WORKSPACE</div>

        <nav>
          {tabs.map((title, i) => {
            const Icon = [Activity, Wind, BarChart3, BookOpen][i];
            return (
              <button
                key={title}
                className={tab === i ? "active" : ""}
                onClick={() => {
                  setTab(i);
                  setMenu(false);
                }}
              >
                <Icon size={18} />
                {title}
              </button>
            );
          })}
        </nav>

        <div className="sidebarfoot">
          <div className="source">
            <Database size={20} />
            <div>
              <b>Elexon BMRS</b>
              <small>Official UK generation data</small>
            </div>
          </div>
          <small>HISTORICAL ANALYSIS · JAN 2026</small>
        </div>
      </aside>

      <div className="mainarea">
        <header className="topbar">
          <button
            className="menubtn"
            onClick={() => setMenu(true)}
            aria-label="Open navigation"
          >
            <Menu size={21} />
          </button>
          <div>
            Workspace <span>/</span> <b>{tabs[tab]}</b>
          </div>
          <div className="topright">
            <span><Clock size={14} /> Europe/London</span>
            <span className="pill">Historical dataset</span>
            <b className="avatar">WS</b>
          </div>
        </header>

        <main>
          <div className="pagehead">
            <div>
              <div className="eyebrow">
                ● &nbsp; UK WIND GENERATION · JANUARY 2026
              </div>
              <h1>
                {[
                  "Wind forecast overview",
                  "Forecast explorer",
                  "Forecast accuracy",
                  "Methodology & data"
                ][tab]}
              </h1>
              <p>
                {[
                  "A clearer view of wind supply, forecast reliability, and day-ahead decisions.",
                  "Inspect exactly what was forecast at the historical decision cutoff.",
                  "Understand forecast error, variability, and systematic bias.",
                  "How the data is selected, calculated, and interpreted."
                ][tab]}
              </p>
            </div>

            {tab !== 3 && (
              <button
                className="btn"
                onClick={() => setRetry((x) => x + 1)}
              >
                <RefreshCw size={16} /> Refresh data
              </button>
            )}
          </div>

          {tab !== 3 && (
            <div className="filters">
              <label><Calendar size={17} /> Decision date</label>
              <input
                type="date"
                min="2026-01-01"
                max="2026-01-31"
                value={day}
                onChange={(e) => setDay(e.target.value)}
              />
              <i />
              <label><Clock size={17} /> Decision cutoff</label>
              <select
                value={hour}
                onChange={(e) => setHour(+e.target.value)}
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option value={i} key={i}>
                    {String(i).padStart(2, "0")}:00 UTC
                  </option>
                ))}
              </select>
              <div className="filterhint">
                ⓘ &nbsp; Scenario cutoff, not an official market deadline
              </div>
            </div>
          )}

          {tab === 3 ? (
            <Methodology />
          ) : (
            <>
              {loading && (
                <div className="notice">
                  <span className="spinner" />
                  Fetching real historical wind generation from Elexon…
                </div>
              )}

              {error && (
                <div className="notice err">
                  <AlertTriangle size={22} />
                  <div>
                    <b>Unable to load Elexon data</b>
                    <p>{error}</p>
                    <p>No invented values are displayed.</p>
                  </div>
                  <button
                    className="btn"
                    onClick={() => setRetry((x) => x + 1)}
                  >
                    Retry
                  </button>
                </div>
              )}

              {data && !loading && (
                <>
                  {tab === 0 && (
                    <>
                      <Section
                        title="Decision snapshot"
                        desc={`Decision ${day} · Delivery ${data.deliveryDate}`}
                      />

                      <div className="metrics">
                        <Metric
                          label="Mean forecast generation"
                          value={fmt(avg(data.points.map(p => p.forecast)))}
                          detail="Available at decision cutoff"
                        />
                        <Metric
                          label="Mean actual generation"
                          value={fmt(avg(
                            data.points
                              .filter(p => p.forecast !== null)
                              .map(p => p.actual)
                          ))}
                          detail="At forecast-matched intervals"
                        />
                        <Metric
                          label="Mean absolute error"
                          value={fmt(data.metrics.mae)}
                          detail={`${data.metrics.count} matched intervals`}
                        />
                        <Metric
                          label="Forecast bias"
                          value={fmt(data.metrics.bias)}
                          detail="Forecast minus actual"
                        />
                      </div>

                      <GenerationChart rows={rows} />

                      <div className="twocol">
                        <div className="panel">
                          <h3>Data coverage</h3>
                          {([
                            ["Forecast intervals", data.coverage.forecast],
                            ["Actual intervals", data.coverage.actual],
                            ["Matched intervals", data.coverage.matched]
                          ] as [string, number][]).map(([label, count]) => (
                            <div className="coverage" key={label}>
                              <div>
                                <span>{label}</span>
                                <b>{count} / {data.coverage.expected}</b>
                              </div>
                              <div className="track">
                                <span
                                  style={{
                                    width: `${count / data.coverage.expected * 100}%`
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="panel">
                          <h3>Decision context</h3>
                          <p className="bodytext">
                            Only forecasts published by{" "}
                            <b>{String(hour).padStart(2, "0")}:00 UTC</b>{" "}
                            on {day} are eligible. Later revisions are
                            excluded to avoid look-ahead bias.
                          </p>
                          <div className="callout">
                            ✓ &nbsp; Point-in-time forecast selection
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {tab === 1 && (
                    <>
                      <Section
                        title="Forecast vintage inspection"
                        desc={`Delivery date: ${data.deliveryDate}`}
                      />

                      <div className="metrics two">
                        <Metric
                          label="Eligible forecast intervals"
                          value={`${data.coverage.forecast} / ${data.coverage.expected}`}
                          detail="Published before cutoff"
                        />
                        <Metric
                          label="Average lead time"
                          value={fmt(
                            avg(data.points.map(p => p.leadHours)),
                            " hours"
                          )}
                          detail="From forecast issue to delivery"
                        />
                      </div>

                      <GenerationChart rows={rows} />

                      <div className="panel">
                        <div className="panelhead">
                          <h

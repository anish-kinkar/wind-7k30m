
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

const fmt = (
  n: number | null | undefined,
  suffix = " MW"
) =>
  n == null
    ? "—"
    : n.toLocaleString("en-GB", {
        maximumFractionDigits: 1
      }) + suffix;

const avg = (values: (number | null)[]) => {
  const valid = values.filter(
    (x): x is number => x !== null
  );
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

function Metric({
  label,
  value,
  detail
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

function Section({
  title,
  desc
}: {
  title: string;
  desc: string;
}) {
  return (
    <div className="section">
      <div>
        <h2>{title}</h2>
        <p>{desc}</p>
      </div>
      <span className="tag">
        Historical intervals
      </span>
    </div>
  );
}

// FIXED: Both forecast and actual lines are visible.
// Forecast observations are hourly, while actuals
// are recorded every 30 minutes.
// Connecting forecast observations is visual only.
// No missing values are added to the dataset.

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
            National wind generation across the
            selected delivery day
          </p>
        </div>
        <span className="tag">MW</span>
      </div>

      <div className="chart">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={rows}
            margin={{
              top: 12,
              right: 20,
              left: 0,
              bottom: 8
            }}
          >
            <CartesianGrid
              stroke="#e8edf0"
              vertical={false}
            />

            <XAxis
              dataKey="label"
              interval={7}
              tickLine={false}
              axisLine={false}
              tick={{
                fontSize: 11,
                fill: "#8895a4"
              }}
            />

            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{
                fontSize: 11,
                fill: "#8895a4"
              }}
              width={62}
              tickFormatter={(v: number) =>
                `${(v / 1000).toFixed(0)}k`
              }
            />

            <Tooltip
              formatter={(value: any) =>
                fmt(Number(value))
              }
              labelFormatter={(label: any) =>
                `Delivery time: ${label} UK`
              }
              contentStyle={{
                borderRadius: 10,
                border: "1px solid #e5e9ef",
                boxShadow:
                  "0 8px 24px rgba(15,23,42,0.08)"
              }}
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
              type="linear"
              name="Forecast"
              dataKey="forecast"
              stroke="#0d8b86"
              strokeWidth={3}
              strokeDasharray="7 4"
              dot={{
                r: 2.5,
                fill: "#0d8b86",
                strokeWidth: 0
              }}
              activeDot={{ r: 6 }}
              connectNulls={true}
              isAnimationActive={false}
            />

            <Line
              type="linear"
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

      <p
        style={{
          fontSize: 11,
          color: "#8895a4",
          marginTop: 8
        }}
      >
        Forecast observations are connected between
        available hourly timestamps for visualization.
        Missing half-hour forecasts are not estimated.
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
          WindScope compares forecasts available at
          a historical decision time against actual
          wind generation. Accuracy metrics use only
          matching observations.
        </p>
      </div>

      <div className="panel">
        <h3>01 / Official data sources</h3>
        <p>
          Actual generation:{" "}
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
          Forecast generation:{" "}
          <a
            href="https://bmrs.elexon.co.uk/api-documentation/endpoint/datasets/WINDFOR/stream"
            target="_blank"
            rel="noopener noreferrer"
          >
            Elexon WINDFOR ↗
          </a>
          , using startTime, publishTime and generation.
        </p>
      </div>

      <div className="panel">
        <h3>02 / Historical forecast selection</h3>
        <p>
          For each delivery interval, the application
          selects the latest forecast published at or
          before the selected decision cutoff.
          Later revisions are excluded to prevent
          look-ahead bias.
        </p>
        <p>
          The default 12:00 UTC cutoff is an analytical
          assumption, not an official market deadline.
        </p>
      </div>

      <div className="panel">
        <h3>03 / Accuracy definitions</h3>
        <p>
          <b>MAE</b> = mean(|forecast − actual|)
        </p>
        <p>
          <b>RMSE</b> = √mean((forecast − actual)²)
        </p>
        <p>
          <b>Bias</b> = mean(forecast − actual)
        </p>
        <p>
          Positive bias indicates overforecasting.
          Negative bias indicates underforecasting.
        </p>
      </div>

      <div className="panel">
        <h3>04 / Scope and limitations</h3>
        <p>
          Analysis covers January 2026 decision dates
          and next-day national wind generation.
          A January 31 decision includes February 1
          delivery.
        </p>
        <p>
          Actual generation is recorded at 30-minute
          intervals. The observed WINDFOR forecast
          series has hourly target timestamps.
          Missing forecast values are not fabricated.
        </p>
        <p>
          Data is processed in UTC and displayed
          using UK local time where indicated.
          Demand and electricity prices are excluded.
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

    fetch(
      `/api/analysis?day=${day}&cutoff_hour=${hour}`
    )
      .then(async (response) => {
        const result = await response.json();

        if (!response.ok) {
          throw Error(
            result.detail ||
              "Elexon API request failed"
          );
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

    const csv = [
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
      new Blob([csv], { type: "text/csv" })
    );

    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `windscope-${day}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="shell">
      <aside
        className={
          menu ? "sidebar shown" : "sidebar"
        }
      >
        <div className="logo">
          <span className="logoicon">
            <Wind size={24} />
          </span>

          <div>
            <b>
              windscope<span>.</span>
            </b>
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

        <div className="navlabel">
          WORKSPACE
        </div>

        <nav>
          {tabs.map((title, i) => {
            const Icon = [
              Activity,
              Wind,
              BarChart3,
              BookOpen
            ][i];

            return (
              <button
                key={title}
                className={
                  tab === i ? "active" : ""
                }
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
              <small>
                Official UK generation data
              </small>
            </div>
          </div>
          <small>
            HISTORICAL ANALYSIS · JAN 2026
          </small>
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
            Workspace <span>/</span>{" "}
            <b>{tabs[tab]}</b>
          </div>

          <div className="topright">
            <span>
              <Clock size={14} />
              Europe/London
            </span>
            <span className="pill">
              Historical dataset
            </span>
            <b className="avatar">WS</b>
          </div>
        </header>

        <main>
          <div className="pagehead">
            <div>
              <div className="eyebrow">
                ● &nbsp; UK WIND GENERATION ·
                JANUARY 2026
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
                onClick={() =>
                  setRetry((x) => x + 1)
                }
              >
                <RefreshCw size={16} />
                Refresh data
              </button>
            )}
          </div>

          {tab !== 3 && (
            <div className="filters">
              <label>
                <Calendar size={17} />
                Decision date
              </label>

              <input
                type="date"
                min="2026-01-01"
                max="2026-01-31"
                value={day}
                onChange={(e) =>
                  setDay(e.target.value)
                }
              />

              <i />

              <label>
                <Clock size={17} />
                Decision cutoff
              </label>

              <select
                value={hour}
                onChange={(e) =>
                  setHour(+e.target.value)
                }
              >
                {Array.from(
                  { length: 24 },
                  (_, i) => (
                    <option
                      value={i}
                      key={i}
                    >
                      {String(i).padStart(2, "0")}
                      :00 UTC
                    </option>
                  )
                )}
              </select>

              <div className="filterhint">
                ⓘ &nbsp; Scenario cutoff,
                not an official market deadline
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
                  Fetching real historical wind
                  generation from Elexon…
                </div>
              )}

              {error && (
                <div className="notice err">
                  <AlertTriangle size={22} />
                  <div>
                    <b>
                      Unable to load Elexon data
                    </b>
                    <p>{error}</p>
                    <p>
                      No invented values are
                      displayed.
                    </p>
                  </div>

                  <button
                    className="btn"
                    onClick={() =>
                      setRetry((x) => x + 1)
                    }
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
                          value={fmt(
                            avg(
                              data.points.map(
                                (p) => p.forecast
                              )
                            )
                          )}
                          detail="Available at decision cutoff"
                        />

                        <Metric
                          label="Mean actual generation"
                          value={fmt(
                            avg(
                              data.points
                                .filter(
                                  (p) =>
                                    p.forecast !==
                                    null
                                )
                                .map(
                                  (p) => p.actual

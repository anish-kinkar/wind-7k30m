
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
          throw Error(
            result.detail || "Elexon API request failed"
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
          >
            <X size={18} />
          </button>
        </div>

        <div className="navlabel">WORKSPACE</div>

        <nav>
          {tabs.map((title, i) => {
            const Icon = [
              Activity, Wind, BarChart3, BookOpen
            ][i];

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
          >
            <Menu size={21} />
          </button>

          <div>
            Workspace <span>/</span> <b>{tabs[tab]}</b>
          </div>

          <div className="topright">
            <span>
              <Clock size={14} /> Europe/London
            </span>
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

            <button
              className="btn"
              onClick={() => setRetry((x) => x + 1)}
            >
              <RefreshCw size={16} />
              Refresh data
            </button>
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
                onChange={(e) => setDay(e.target.value)}
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
                    <option value={i} key={i}>
                      {String(i).padStart(2, "0")}:00 UTC
                    </option>
                  )
                )}
              </select>

              <div className="filterhint">
                ⓘ &nbsp; Scenario cutoff, not an
                official market deadline
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
                  Fetching real historical wind generation
                  from Elexon…
                </div>
              )}

              {error && (
                <div className="notice err">
                  <AlertTriangle size={22} />
                  <div>
                    <b>Unable to load Elexon data</b>
                    <p>{error}</p>
                    <p>
                      No invented values are displayed.
                      Check the Elexon API or retry.
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
                                  (p) => p.forecast !== null
                                )
                                .map((p) => p.actual)
                            )
                          )}
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
                          ] as [string, number][]).map(
                            ([label, count]) => (
                              <div
                                className="coverage"
                                key={label}
                              >
                                <div>
                                  <span>{label}</span>
                                  <b>{count} / 48</b>
                                </div>
                                <div className="track">
                                  <span
                                    style={{
                                      width: `${count / 48 * 100}%`
                                    }}
                                  />
                                </div>
                              </div>
                            )
                          )}
                        </div>

                        <div className="panel">
                          <h3>Decision context</h3>
                          <p className="bodytext">
                            Only forecasts published by{" "}
                            <b>
                              {String(hour).padStart(2, "0")}
                              :00 UTC
                            </b>{" "}
                            on {day} are eligible. Later revisions
                            are excluded to avoid look-ahead bias.
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
                          value={`${data.coverage.forecast} / 48`}
                          detail="Published before cutoff"
                        />

                        <Metric
                          label="Average lead time"
                          value={fmt(
                            avg(
                              data.points.map(
                                (p) => p.leadHours
                              )
                            ),
                            " hours"
                          )}
                          detail="From forecast issue to delivery"
                        />
                      </div>

                      <GenerationChart rows={rows} />

                      <div className="panel">
                        <div className="panelhead">
                          <h3>Interval detail</h3>
                          <button
                            className="btn"
                            onClick={exportCSV}
                          >
                            <Download size={16} />
                            Export CSV
                          </button>
                        </div>

                        <div className="tablewrap">
                          <table>
                            <thead>
                              <tr>
                                {[
                                  "Delivery time (UTC)",
                                  "Forecast",
                                  "Actual",
                                  "Error",
                                  "Published (UTC)",
                                  "Lead time"
                                ].map((s) => (
                                  <th key={s}>{s}</th>
                                ))}
                              </tr>
                            </thead>

                            <tbody>
                              {data.points.map((p) => (
                                <tr key={p.time}>
                                  <td>
                                    {p.time
                                      .replace("T", " ")
                                      .replace("Z", "")}
                                  </td>
                                  <td>{fmt(p.forecast)}</td>
                                  <td>{fmt(p.actual)}</td>
                                  <td>{fmt(p.error)}</td>
                                  <td>
                                    {p.publishTime
                                      ?.replace("T", " ")
                                      .replace("Z", "") ||
                                      "Unavailable"}
                                  </td>
                                  <td>
                                    {fmt(p.leadHours, " h")}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  )}

                  {tab === 2 && (
                    <>
                      <Section
                        title="Historical error metrics"
                        desc={`${data.metrics.count} matched forecast observations`}
                      />

                      <div className="metrics three">
                        <Metric
                          label="Mean absolute error"
                          value={fmt(data.metrics.mae)}
                          detail="Average absolute miss"
                        />

                        <Metric
                          label="Root mean squared error"
                          value={fmt(data.metrics.rmse)}
                          detail="Penalizes larger misses"
                        />

                        <Metric
                          label="Forecast bias"
                          value={fmt(data.metrics.bias)}
                          detail={
                            data.metrics.bias == null
                              ? "Insufficient data"
                              : data.metrics.bias > 0
                              ? "Tends to overforecast"
                              : "Tends to underforecast"
                          }
                        />
                      </div>

                      <div className="panel chartpanel">
                        <div className="panelhead">
                          <div>
                            <h3>Signed forecast error</h3>
                            <p>
                              Positive indicates overforecasting;
                              negative indicates underforecasting.
                            </p>
                          </div>
                          <span className="tag">MW</span>
                        </div>

                        <div className="chart">
                          <ResponsiveContainer>
                            <AreaChart data={rows}>
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
                              />
                              <Tooltip />
                              <ReferenceLine
                                y={0}
                                stroke="#9ba7b3"
                                strokeDasharray="4 4"
                              />
                              <Area
                                dataKey="error"
                                name="Forecast error (MW)"
                                stroke="#c18d4c"
                                fill="#f4e8d6"
                                strokeWidth={2}
                                connectNulls={true}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      <div className="panel">
                        <h3>How to interpret these metrics</h3>
                        <div className="explainer">
                          <p>
                            <b>MAE</b>
                            <br />
                            Typical absolute forecast miss, in MW.
                          </p>
                          <p>
                            <b>RMSE</b>
                            <br />
                            Emphasizes large forecast misses.
                          </p>
                          <p>
                            <b>Bias</b>
                            <br />
                            Forecast minus actual; positive means
                            overforecasting.
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </>
          )}
        </main>

        <footer>
          WindScope · A historical analysis pilot
          <span>
            Data: Elexon BMRS · UK time unless stated
          </span>
        </footer>
      </div>

      {menu && (
        <div
          className="overlay"
          onClick={() => setMenu(false)}
        />
      )}
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
      <span className="tag">30-minute intervals</span>
    </div>
  );
}

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
    <div className="metric

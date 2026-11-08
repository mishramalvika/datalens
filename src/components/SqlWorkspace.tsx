import { useCallback, useEffect, useRef, useState } from "react";
import Papa from "papaparse";
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { createSession, closeSession, runReadOnlyQuery, type SqlSession, type QueryResult } from "../lib/queryEngine";
import type { SuggestedQuestion } from "../lib/suggestQuestions";

type Props = { file: File; expectedRowCount: number; question: SuggestedQuestion };
const display = (v: unknown): string => v == null ? "" : v instanceof Date ? v.toISOString() : String(v);

export default function SqlWorkspace({ file, expectedRowCount, question }: Props) {
  const [session, setSession] = useState<SqlSession | null>(null);
  const [sql, setSql] = useState(question.sql);
  const [executedSql, setExecutedSql] = useState("");
  const [result, setResult] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const runId = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let created: SqlSession | null = null;
    setLoading(true);
    setSession(null);
    setError("");
    async function initialize() {
      try {
        const next = await createSession(file);
        created = next;
        if (cancelled) await closeSession(next);
        else setSession(next);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void initialize();
    return () => {
      cancelled = true;
      runId.current++;
      if (created) void closeSession(created);
    };
  }, [file]);

  const execute = useCallback(async (activeSession: SqlSession, query: string) => {
    const id = ++runId.current;
    setRunning(true);
    setError("");
    try {
      const next = await runReadOnlyQuery(activeSession, query);
      if (id === runId.current) {
        setResult(next);
        setExecutedSql(query);
      }
    } catch (err) {
      if (id === runId.current) setError(err instanceof Error ? err.message : String(err));
    } finally {
      if (id === runId.current) setRunning(false);
    }
  }, []);

  useEffect(() => {
    setSql(question.sql);
    setResult(null);
    setExecutedSql("");
    if (session) void execute(session, question.sql);
  }, [question.sql, session, execute]);

  const chartData = (result?.rows ?? [])
    .filter((row) => row.group_label != null && row.value != null && Number.isFinite(Number(row.value)))
    .slice(0, 50)
    .map((row) => ({ group: display(row.group_label), value: Number(row.value) }));
  const chartAvailable = Boolean(result?.columns.includes("group_label") && result.columns.includes("value") && chartData.length > 0);
  const peak = chartData.length > 0 ? chartData.reduce((best, item) => item.value > best.value ? item : best) : null;
  const hasPendingEdits = Boolean(executedSql) && sql.trim() !== executedSql.trim();
  const defaultQuery = Boolean(executedSql) && executedSql.trim() === question.sql.trim();

  function downloadCSV() {
    if (!result) return;
    const csv = Papa.unparse({
      fields: result.columns,
      data: result.rows.map((row) => result.columns.map((column) => display(row[column]))),
    }, { escapeFormulae: true });
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "datalens-results.csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <section className="content-card answer-card" aria-live="polite">
    <div className="section-title answer-top">
      <div><div className="eyebrow">YOUR ANSWER</div><h2>{question.title}</h2><p>{question.explanation}</p></div>
      <button className="button button-subtle" disabled={!result?.rows.length} onClick={downloadCSV}>↓ Export CSV</button>
    </div>

    {(loading || running) && <div className="running-note" role="status">{loading ? "Loading the local SQL engine and dataset…" : "Running query…"}</div>}
    {session && session.rowsLoaded !== expectedRowCount && <div className="warning-box">Profiler counted {expectedRowCount.toLocaleString()} rows; DuckDB loaded {session.rowsLoaded.toLocaleString()}. Review before relying on results.</div>}
    {error && <div className="error-text" role="alert">{error}</div>}

    {result && <>
      {chartAvailable ? <>
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={288}>
            {question.chart === "line" ? <LineChart data={chartData} margin={{ top: 10, right: 16, bottom: 16, left: 0 }}>
              <CartesianGrid stroke="#e9edf4" strokeDasharray="3 4" vertical={false}/>
              <XAxis dataKey="group" minTickGap={28} tick={{ fontSize: 11, fill: "#64748b" }} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} width={48}/>
              <Tooltip /><Line dataKey="value" type="monotone" stroke="#4f46e5" strokeWidth={2.5} dot={false} activeDot={{ r: 5 }}/>
            </LineChart> : <BarChart data={chartData} margin={{ top: 10, right: 16, bottom: 28, left: 0 }}>
              <CartesianGrid stroke="#e9edf4" strokeDasharray="3 4" vertical={false}/>
              <XAxis dataKey="group" minTickGap={20} angle={-15} height={52} textAnchor="end" tick={{ fontSize: 11, fill: "#64748b" }} />
              <YAxis tick={{ fontSize: 11, fill: "#64748b" }} width={48}/>
              <Tooltip /><Bar dataKey="value" fill="#6366f1" radius={[5, 5, 0, 0]}/>
            </BarChart>}
          </ResponsiveContainer>
        </div>
        {peak && <div className="insight-inline"><span>✦ Key observation</span><p><strong>{peak.group}</strong> has the highest value among the groups displayed ({peak.value.toLocaleString()}). This is descriptive, not causal.</p></div>}
      </> : <p className="small-note">This query returns a table instead of chart columns (`group_label`, `value`). You can inspect and download the result below.</p>}

      <div className="provenance" role="note">
        <strong>How this answer was calculated</strong>
        <p>Source: {file.name} · {session?.rowsLoaded.toLocaleString()} source rows · Literal NA retained · No source cells modified. {defaultQuery ? question.footnote : "Custom SQL executed; inspect the SQL below for the precise filters and aggregations."}</p>
      </div>

      <div className="result-toolbar"><span>{result.rows.length.toLocaleString()} result rows {result.truncated ? "(preview limit reached)" : ""}</span><span>Use the controls below to inspect or modify the result.</span></div>
      {result.truncated && <div className="small-note">Query results and exports are capped at the first 5,000 rows in this MVP.</div>}
    </>}

    <details className="disclosure advanced-disclosure">
      <summary>View or edit the SQL <span>Advanced · rerun your calculation</span></summary>
      <div className="disclosure-content">
        <textarea className="sql-editor" aria-label="SQL editor" spellCheck={false} value={sql} disabled={!session || running} onChange={(e) => setSql(e.target.value)} />
        {hasPendingEdits && <p className="small-note">You have unrun changes. The result above still shows the previous SQL.</p>}
        <div className="sql-actions"><button className="button button-primary" disabled={!session || running} onClick={() => { if (session) void execute(session, sql); }}>{running ? "Running…" : "Run SQL"}</button><span className="small-note">One read-only SELECT query at a time.</span></div>
      </div>
    </details>

    {result && <details className="disclosure" open={!chartAvailable}>
      <summary>View result table <span>{result.rows.length.toLocaleString()} rows · first 25 shown</span></summary>
      <div className="table-scroll table-scroll-short"><table><thead><tr>{result.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead><tbody>{result.rows.slice(0, 25).map((row, i) => <tr key={i}>{result.columns.map((c) => <td key={c}>{display(row[c])}</td>)}</tr>)}</tbody></table></div>
    </details>}
  </section>;
}

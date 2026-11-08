import { useRef, useState } from "react";
import Papa from "papaparse";
import DataDictionary, { type DictionaryEntry } from "./components/DataDictionary";
import SuggestedQuestions from "./components/SuggestedQuestions";
import "./App.css";

type FieldType = "Identifier" | "Year" | "Date" | "Number" | "Category/Text" | "Unknown";
type ColumnInfo = {
  name: string;
  type: FieldType;
  missing: number;
  placeholders: number;
  example: string;
  numberCount: number;
  numberSum: number;
  numberMin: number;
  numberMax: number;
  dateCount: number;
};
type DatasetProfile = {
  fileName: string;
  rowCount: number;
  columns: ColumnInfo[];
  preview: Record<string, string>[];
  duplicateRows: number;
  duplicateScanLimited: boolean;
  parseWarnings: number;
  warningDetails: string[];
};
type Screen = "overview" | "dictionary" | "explore";

const format = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });
const isPlaceholder = (v: string) => /^(NA|N\/A|NULL)$/i.test(v);
const isNumeric = (v: string) => /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(v) && Number.isFinite(Number(v));
const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

function inferType(c: ColumnInfo, rows: number): FieldType {
  const available = rows - c.missing - c.placeholders;
  if (available === 0) return "Unknown";
  const name = c.name.trim().toLowerCase();
  if (c.numberCount / available >= 0.98) {
    if (/^(id|.*[_ ]id)$/.test(name)) return "Identifier";
    if (/^(year|.*[_ ]year)$/.test(name)) return "Year";
    return "Number";
  }
  if (c.dateCount / available >= 0.98) return "Date";
  return "Category/Text";
}

export default function App() {
  const [profile, setProfile] = useState<DatasetProfile | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [dictionary, setDictionary] = useState<DictionaryEntry[] | null>(null);
  const [screen, setScreen] = useState<Screen>("overview");
  const [uploadVersion, setUploadVersion] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File | undefined) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Please select a CSV file.");
      return;
    }
    setLoading(true);
    setError("");
    setProfile(null);
    setUploadedFile(null);
    setDictionary(null);
    setScreen("overview");
    setUploadVersion((v) => v + 1);

    let rowCount = 0;
    let duplicateRows = 0;
    let parseWarnings = 0;
    let duplicateScanLimited = false;
    const warningDetails: string[] = [];
    const seenRows = new Set<string>();
    const DUPLICATE_SCAN_LIMIT = 300_000;
    let columns: ColumnInfo[] = [];
    const preview: Record<string, string>[] = [];

    Papa.parse<Record<string, string>>(file, {
      header: true,
      worker: false, // Production-compatible fallback; consider a dedicated worker later.
      skipEmptyLines: "greedy",
      chunkSize: 4 * 1024 * 1024,
      chunk: (results) => {
        parseWarnings += results.errors.length;
        for (const warning of results.errors) {
          if (warningDetails.length < 3) warningDetails.push(`${warning.code}: ${warning.message}`);
        }
        if (columns.length === 0) {
          columns = (results.meta.fields ?? [])
            .filter((name) => name.trim() !== "")
            .map((name) => ({
              name,
              type: "Unknown" as FieldType,
              missing: 0,
              placeholders: 0,
              example: "",
              numberCount: 0,
              numberSum: 0,
              numberMin: Infinity,
              numberMax: -Infinity,
              dateCount: 0,
            }));
        }
        for (const row of results.data) {
          rowCount++;
          if (preview.length < 5) preview.push(row);
          if (rowCount <= DUPLICATE_SCAN_LIMIT) {
            const signature = JSON.stringify(columns.map((c) => row[c.name] ?? ""));
            if (seenRows.has(signature)) duplicateRows++;
            else seenRows.add(signature);
          } else duplicateScanLimited = true;
          for (const c of columns) {
            const value = String(row[c.name] ?? "").trim();
            if (!value) { c.missing++; continue; }
            if (isPlaceholder(value)) { c.placeholders++; continue; }
            if (!c.example) c.example = value;
            if (isNumeric(value)) {
              const n = Number(value);
              c.numberCount++;
              c.numberSum += n;
              c.numberMin = Math.min(c.numberMin, n);
              c.numberMax = Math.max(c.numberMax, n);
            } else if (isDate(value)) c.dateCount++;
          }
        }
      },
      complete: () => {
        if (columns.length === 0 || rowCount === 0) {
          setError("The CSV contains no usable data rows.");
          setLoading(false);
          return;
        }
        setProfile({
          fileName: file.name,
          rowCount,
          columns: columns.map((c) => ({ ...c, type: inferType(c, rowCount) })),
          preview,
          duplicateRows,
          duplicateScanLimited,
          parseWarnings,
          warningDetails,
        });
        setUploadedFile(file);
        setLoading(false);
      },
      error: (err) => {
        setError(err.message);
        setLoading(false);
      },
    });
  }

  const placeholders = profile?.columns.reduce((sum, c) => sum + c.placeholders, 0) ?? 0;
  const reviewFields = profile?.columns.filter((c) => c.placeholders > 0) ?? [];
  const numericalFields = profile?.columns.filter((c) => c.type === "Number") ?? [];

  const navItems: { id: Screen; title: string; detail: string; number: string; disabled: boolean }[] = [
    { id: "overview", title: "Overview", detail: "Understand the dataset", number: "01", disabled: !profile },
    { id: "dictionary", title: "Dictionary", detail: "Review field meanings", number: "02", disabled: !profile },
    { id: "explore", title: "Explore", detail: "Ask and verify", number: "03", disabled: !dictionary },
  ];

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="brand"><span className="brand-symbol">◈</span> DataLens <span className="brand-tag">MVP</span></div>
        <div className="header-right">
          {profile && <span className="file-chip" title={profile.fileName}>● {profile.fileName}</span>}
          <input
            ref={fileInputRef}
            className="visually-hidden"
            type="file"
            accept=".csv,text/csv"
            disabled={loading}
            aria-label="Upload CSV dataset"
            onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ""; }}
          />
          {profile && <button className="button button-subtle" disabled={loading} onClick={() => fileInputRef.current?.click()}>Change dataset</button>}
        </div>
      </header>

      {!profile ? (
        <main className="welcome">
          <div className="eyebrow">ANALYTICS FOR EVERYONE</div>
          <h1>From unfamiliar data to answers you can trust.</h1>
          <p>Upload a CSV, review what its fields mean, then ask questions in plain English. No SQL required.</p>
          <div className="welcome-upload">
            <div className="upload-icon">↑</div>
            <strong>Start with your dataset</strong>
            <span>CSV files only · Processed locally in your browser</span>
            <button className="button button-primary" disabled={loading} onClick={() => fileInputRef.current?.click()}>
              {loading ? "Profiling your dataset…" : "Choose a CSV file"}
            </button>
          </div>
          {error && <p role="alert" className="error-text">{error}</p>}
        </main>
      ) : (
        <div className="workspace">
          <aside className="side-nav" aria-label="Workspace navigation">
            <div className="nav-caption">YOUR WORKSPACE</div>
            {navItems.map((item) => (
              <button
                key={item.id}
                className={`nav-item ${screen === item.id ? "nav-item-active" : ""}`}
                disabled={item.disabled}
                onClick={() => setScreen(item.id)}
                aria-current={screen === item.id ? "page" : undefined}
              >
                <span className="nav-number">{item.number}</span>
                <span className="nav-label"><strong>{item.title}</strong><small>{item.detail}</small></span>
                {item.id === "dictionary" && dictionary && <span className="nav-done" aria-label="Complete">✓</span>}
              </button>
            ))}
            {!dictionary && <p className="nav-hint">Approve the dictionary to unlock Explore.</p>}
            <div className="nav-footer">Runs locally · Single CSV table</div>
          </aside>

          <main className="work-main">
            <section className="screen" hidden={screen !== "overview"}>
              <div className="screen-header">
                <div><div className="eyebrow">STEP 01 · UNDERSTAND</div><h1>Dataset overview</h1><p>Know what's in your data before asking questions.</p></div>
                <button className="button button-primary" onClick={() => setScreen(dictionary ? "explore" : "dictionary")}>
                  {dictionary ? "Go to Explore →" : "Review dictionary →"}
                </button>
              </div>
              <div className="stat-grid">
                <div className="stat"><span>Rows</span><strong>{format(profile.rowCount)}</strong></div>
                <div className="stat"><span>Fields</span><strong>{profile.columns.length}</strong></div>
                <div className="stat"><span>NA placeholders</span><strong>{format(placeholders)}</strong></div>
                <div className="stat"><span>Exact duplicates</span><strong>{format(profile.duplicateRows)}</strong></div>
              </div>
              <section className="content-card">
                <div className="section-title"><div><h2>Data quality at a glance</h2><p>These are potential issues, not automatic corrections.</p></div><span className="count-tag">{reviewFields.length} fields need interpretation</span></div>
                <div className="quality-list">
                  {reviewFields.slice(0, 6).map((c) => (
                    <div key={c.name} className="quality-row"><span className="field-name">{c.name}</span><div className="quality-meter"><span style={{ width: `${Math.min(100, c.placeholders / profile.rowCount * 100)}%` }} /></div><span className="quality-value">{format(c.placeholders)} NA <small>({(c.placeholders / profile.rowCount * 100).toFixed(1)}%)</small></span></div>
                  ))}
                  {reviewFields.length === 0 && <p>No placeholder values detected in this dataset.</p>}
                </div>
                <div className="small-note">“NA” may mean missing information or a valid outcome. Confirm meanings in the dictionary before analysis.</div>
              </section>
              {profile.parseWarnings > 0 && <div className="warning-box" role="alert">{format(profile.parseWarnings)} CSV parsing warning(s): {profile.warningDetails.join(" · ")}</div>}
              {profile.duplicateScanLimited && <div className="warning-box">Duplicate scan covers only the first 300,000 rows.</div>}

              <details className="disclosure"><summary>View all {profile.columns.length} column profiles <span>Types, missing values and examples</span></summary>
                <div className="table-scroll"><table><thead><tr><th>Field</th><th>Detected type</th><th>Empty</th><th>NA placeholders</th><th>Example</th></tr></thead><tbody>{profile.columns.map((c) => <tr key={c.name}><td>{c.name}</td><td>{c.type}</td><td>{format(c.missing)}</td><td>{format(c.placeholders)}</td><td>{c.example || "—"}</td></tr>)}</tbody></table></div>
              </details>
              {numericalFields.length > 0 && <details className="disclosure"><summary>View numeric statistics <span>Average, minimum and maximum</span></summary>
                <div className="table-scroll"><table><thead><tr><th>Field</th><th>Valid values</th><th>Average</th><th>Minimum</th><th>Maximum</th></tr></thead><tbody>{numericalFields.map((c) => <tr key={c.name}><td>{c.name}</td><td>{format(c.numberCount)}</td><td>{format(c.numberSum / c.numberCount)}</td><td>{format(c.numberMin)}</td><td>{format(c.numberMax)}</td></tr>)}</tbody></table></div>
              </details>}
              <details className="disclosure"><summary>Preview source rows <span>First 5 records</span></summary>
                <div className="table-scroll"><table><thead><tr>{profile.columns.map((c) => <th key={c.name}>{c.name}</th>)}</tr></thead><tbody>{profile.preview.map((row, idx) => <tr key={idx}>{profile.columns.map((c) => <td key={c.name}>{row[c.name] ?? ""}</td>)}</tr>)}</tbody></table></div>
              </details>
            </section>

            <section className="screen" hidden={screen !== "dictionary"}>
              <div className="screen-header"><div><div className="eyebrow">STEP 02 · VERIFY</div><h1>Review your dictionary</h1><p>Just resolve ambiguous fields. Everything else is optional.</p></div></div>
              <DataDictionary
                key={uploadVersion}
                columns={profile.columns}
                approved={dictionary !== null}
                onApprove={(entries) => { setDictionary(entries); setScreen("explore"); }}
                onEdit={() => setDictionary(null)}
              />
            </section>

            {dictionary && uploadedFile && (
              <section className="screen" hidden={screen !== "explore"}><div className="screen-header"><div><div className="eyebrow">STEP 03 · DISCOVER</div><h1>Explore your data</h1><p>Ask a question, see the answer, and inspect the calculation if needed.</p></div><span className="ready-pill">✓ Dictionary approved</span></div>
                <SuggestedQuestions dictionary={dictionary} file={uploadedFile} expectedRowCount={profile.rowCount}/>
              </section>
            )}
          </main>
        </div>
      )}
    </div>
  );
}

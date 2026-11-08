import { useState } from "react";

const FIELD_TYPES = ["Identifier", "Year", "Date", "Number", "Category/Text", "Unknown"];
type NAMeaning = "review" | "missing" | "none" | "literal" | "not-present";
type SourceColumn = { name: string; type: string; placeholders: number };
export type DictionaryEntry = {
  name: string;
  type: string;
  description: string;
  naMeaning: NAMeaning;
  placeholderCount: number;
};
type Props = {
  columns: SourceColumn[];
  approved: boolean;
  onApprove: (entries: DictionaryEntry[]) => void;
  onEdit: () => void;
};

export default function DataDictionary({ columns, approved, onApprove, onEdit }: Props) {
  const [entries, setEntries] = useState<DictionaryEntry[]>(() => columns.map((c) => ({
    name: c.name,
    type: c.type,
    description: "",
    naMeaning: c.placeholders > 0 ? "review" : "not-present",
    placeholderCount: c.placeholders,
  })));

  function update(name: string, changes: Partial<DictionaryEntry>) {
    setEntries((all) => all.map((entry) => entry.name === name ? { ...entry, ...changes } : entry));
  }
  const ambiguous = entries.filter((entry) => entry.placeholderCount > 0);
  const unresolved = ambiguous.filter((entry) => entry.naMeaning === "review").length;

  return <div className="dictionary-layout">
    <section className="content-card">
      <div className="section-title">
        <div><h2>Resolve ambiguous values</h2><p>Tell us what “NA” represents in these fields.</p></div>
        <span className={`count-tag ${unresolved === 0 ? "count-tag-good" : ""}`}>
          {approved ? "Approved" : unresolved === 0 ? "Ready to approve" : `${unresolved} remaining`}
        </span>
      </div>
      <div className="review-list">
        {ambiguous.map((entry) => (
          <div className="review-row" key={entry.name}>
            <div><strong>{entry.name}</strong><small>{entry.placeholderCount.toLocaleString()} NA values</small></div>
            <select
              aria-label={`Meaning of NA in ${entry.name}`}
              value={entry.naMeaning}
              disabled={approved}
              onChange={(e) => update(entry.name, { naMeaning: e.target.value as NAMeaning })}
            >
              <option value="review">Choose a meaning…</option>
              <option value="missing">Missing / unknown</option>
              <option value="none">None / not awarded</option>
              <option value="literal">Keep as literal text</option>
            </select>
          </div>
        ))}
        {ambiguous.length === 0 && <p>No NA placeholders need review. You can approve the detected types below.</p>}
      </div>
      <div className="small-note">This changes the interpretation, not the uploaded CSV. Your original data remains untouched.</div>
    </section>

    <details className="disclosure">
      <summary>Review all {entries.length} field definitions <span>Optional: edit types and descriptions</span></summary>
      <div className="table-scroll table-scroll-short">
        <table><thead><tr><th>Field</th><th>Data type</th><th>Description (optional)</th></tr></thead>
          <tbody>{entries.map((entry) => <tr key={entry.name}>
            <td><strong>{entry.name}</strong></td>
            <td><select aria-label={`${entry.name} type`} disabled={approved} value={entry.type} onChange={(e) => update(entry.name, { type: e.target.value })}>
              {FIELD_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
            </select></td>
            <td><input aria-label={`${entry.name} description`} disabled={approved} value={entry.description} placeholder="Optional description" onChange={(e) => update(entry.name, { description: e.target.value })} /></td>
          </tr>)}</tbody>
        </table>
      </div>
    </details>

    <div className="sticky-action-bar">
      <div><strong>{approved ? "Dictionary approved" : `${entries.length} fields · ${unresolved} unresolved`}</strong><small>{approved ? "You can explore the dataset now." : "Confirm field meanings to continue."}</small></div>
      {approved ? <button className="button button-subtle" onClick={onEdit}>Edit definitions</button> :
        <button className="button button-primary" disabled={unresolved > 0} onClick={() => onApprove([...entries])}>Approve & explore →</button>}
    </div>
  </div>;
}

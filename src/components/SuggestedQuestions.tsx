import { useMemo, useState, type FormEvent } from "react";
import { suggestQuestions, type FieldDefinition, type SuggestedQuestion } from "../lib/suggestQuestions";
import { planQuestion } from "../lib/questionPlanner";
import SqlWorkspace from "./SqlWorkspace";

type Props = { dictionary: FieldDefinition[]; file: File; expectedRowCount: number };

export default function SuggestedQuestions({ dictionary, file, expectedRowCount }: Props) {
  const suggestions = useMemo(() => suggestQuestions(dictionary), [dictionary]);
  const [questionText, setQuestionText] = useState("");
  const [selected, setSelected] = useState<SuggestedQuestion | null>(null);
  const [questionError, setQuestionError] = useState("");

  function ask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const plan = planQuestion(questionText, dictionary);
    if ("error" in plan) { setQuestionError(plan.error); return; }
    setQuestionError("");
    setSelected(plan.question);
  }

  return <div className="explore-layout">
    <section className="content-card ask-card">
      <form onSubmit={ask}>
        <label className="ask-title" htmlFor="datalens-question">What do you want to know?</label>
        <div className="ask-row">
          <input
            id="datalens-question" value={questionText} maxLength={200} required
            placeholder="e.g. Average Age by Sport where Sex = F"
            onChange={(e) => setQuestionText(e.target.value)}
          />
          <button className="button button-primary" type="submit">Ask →</button>
        </div>
      </form>
      {questionError && <p className="error-text" role="alert">{questionError}</p>}
      <div className="ask-help">Supports record counts, averages, unique athlete counts, medal-record counts and one equality filter.</div>
      <div className="suggested-heading">Or try a suggested question</div>
      <div className="quick-questions">
        {suggestions.map((q) => <button key={q.id} className="quick-question" title={q.explanation} onClick={() => { setSelected(q); setQuestionError(""); }}>
          <span>{q.title}</span><span aria-hidden="true">↗</span>
        </button>)}
      </div>
    </section>

    {selected ? <SqlWorkspace file={file} expectedRowCount={expectedRowCount} question={selected} /> :
      <div className="empty-result"><div className="empty-result-icon">✦</div><h2>Your answer will appear here</h2><p>Ask a question or choose a suggestion to see a visualization, a plain-language observation and the exact calculation.</p></div>}
  </div>;
}

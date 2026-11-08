
export type FieldDefinition = {
  name: string;
  type: string;
  naMeaning: string;
  description: string;
};

export type SuggestedQuestion = {
  id: string;
  title: string;
  explanation: string;
  chart: "bar" | "line";
  sql: string;
  footnote: string;
};

// Safely quote SQL column identifiers.
const quote = (name: string) =>
  `"${name.replace(/"/g, '""')}"`;

export function suggestQuestions(
  dictionary: FieldDefinition[]
): SuggestedQuestion[] {
  const questions: SuggestedQuestion[] = [];

  const find = (name: string) =>
    dictionary.find(
      (column) =>
        column.name.toLowerCase() === name.toLowerCase()
    );

  const year = dictionary.find(
    (column) => column.type === "Year"
  );

  const date = dictionary.find(
    (column) => column.type === "Date"
  );

  const categories = dictionary.filter(
    (column) => column.type === "Category/Text"
  );

  // Prefer useful dimensions over names or descriptions.
  const category =
    find("Sport") ??
    find("Region") ??
    find("Department") ??
    categories.find(
      (column) =>
        !["Name", "Event", "Medal"].includes(column.name)
    );

  const number =
    dictionary.find(
      (column) =>
        column.type === "Number" &&
        column.name.toLowerCase() === "age"
    ) ??
    dictionary.find(
      (column) => column.type === "Number"
    );

  // Question 1: Trend over time.
  if (year) {
    const field = quote(year.name);

    questions.push({
      id: "trend",
      title: `How has the number of records changed by ${year.name}?`,
      explanation: "Explore how record counts change over time.",
      chart: "line",
      sql: `
SELECT
  TRY_CAST(${field} AS INTEGER) AS group_label,
  COUNT(*) AS value
FROM uploaded_data
WHERE TRY_CAST(${field} AS INTEGER) IS NOT NULL
GROUP BY 1
ORDER BY 1 ASC;
`.trim(),
      footnote:
        `Grouped by ${year.name}. Records without a valid year are excluded. ` +
        "Each source row is counted once. No source data was modified.",
    });
  } else if (date) {
    const field = quote(date.name);

    questions.push({
      id: "trend",
      title: `How have records changed over time by ${date.name}?`,
      explanation: "Explore monthly changes in record counts.",
      chart: "line",
      sql: `
SELECT
  DATE_TRUNC('month', TRY_CAST(${field} AS DATE))
    AS group_label,
  COUNT(*) AS value
FROM uploaded_data
WHERE TRY_CAST(${field} AS DATE) IS NOT NULL
GROUP BY 1
ORDER BY 1 ASC;
`.trim(),
      footnote:
        `Dates grouped into months using ${date.name}. Invalid or missing dates excluded. ` +
        "No source data was modified.",
    });
  }

  // Question 2: Compare categories.
  if (category) {
    const field = quote(category.name);

    const excludeNA =
      category.naMeaning === "missing"
        ? `AND UPPER(TRIM(CAST(${field} AS VARCHAR))) NOT IN ('NA', 'N/A', 'NULL')`
        : "";

    questions.push({
      id: "category-count",
      title: `Which ${category.name} values have the most records?`,
      explanation: "Compare the 10 most frequent categories.",
      chart: "bar",
      sql: `
SELECT
  ${field} AS group_label,
  COUNT(*) AS value
FROM uploaded_data
WHERE ${field} IS NOT NULL
  AND TRIM(CAST(${field} AS VARCHAR)) <> ''
  ${excludeNA}
GROUP BY 1
ORDER BY value DESC
LIMIT 10;
`.trim(),
      footnote:
        `Records grouped by ${category.name}. Empty categories excluded. ` +
        (excludeNA ? "Missing-value placeholders excluded. " : "") +
        "Top 10 groups shown. No source data was modified.",
    });
  }

  // Question 3: Numeric average by category.
  if (category && number) {
    const dimension = quote(category.name);
    const measure = quote(number.name);

    questions.push({
      id: "numeric-average",
      title: `How does average ${number.name} vary by ${category.name}?`,
      explanation: "Compare a numerical measure across groups.",
      chart: "bar",
      sql: `
SELECT
  ${dimension} AS group_label,
  ROUND(AVG(TRY_CAST(${measure} AS DOUBLE)), 2)
    AS value
FROM uploaded_data
WHERE ${dimension} IS NOT NULL
  AND TRIM(CAST(${dimension} AS VARCHAR)) <> ''
  AND TRY_CAST(${measure} AS DOUBLE) IS NOT NULL
GROUP BY 1
ORDER BY value DESC
LIMIT 10;
`.trim(),
      footnote:
        `Average ${number.name} by ${category.name}. ` +
        "Non-numeric and missing measure values excluded. " +
        "Top 10 groups by average shown. No source data was modified.",
    });
  }

  // Olympics-specific suggestion.
  // Only offer it if users confirmed NA means no medal.
  const medal = find("Medal");
  const noc = find("NOC");

  if (medal?.naMeaning === "none" && noc) {
    questions.push({
      id: "medal-records",
      title:
        "Which NOCs have the most medal-awarded athlete-event records?",
      explanation:
        "Compare recorded Gold, Silver and Bronze outcomes.",
      chart: "bar",
      sql: `
SELECT
  ${quote(noc.name)} AS group_label,
  COUNT(*) AS value
FROM uploaded_data
WHERE CAST(${quote(medal.name)} AS VARCHAR)
  IN ('Gold', 'Silver', 'Bronze')
GROUP BY 1
ORDER BY value DESC
LIMIT 10;
`.trim(),
      footnote:
        "Counts athlete-event rows with Gold, Silver or Bronze. " +
        "NA is interpreted as no medal, not missing data. " +
        "This does NOT count unique Olympic medals. " +
        "No source data was modified.",
    });
  }

  return questions;
}

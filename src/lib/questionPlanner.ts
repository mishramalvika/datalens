
import type {
  FieldDefinition,
  SuggestedQuestion,
} from "./suggestQuestions";

type PlanResult =
  | { ok: true; question: SuggestedQuestion }
  | { ok: false; error: string };

const identifier = (name: string) =>
  `"${name.replace(/"/g, '""')}"`;

const literal = (value: string) =>
  `'${value.replace(/'/g, "''")}'`;

function findField(
  name: string,
  dictionary: FieldDefinition[]
) {
  const normalized = name
    .trim()
    .replace(/^the\s+/i, "")
    .toLowerCase();

  return dictionary.find((field) => {
    const fieldName = field.name.toLowerCase();
    return (
      normalized === fieldName ||
      normalized === `${fieldName}s`
    );
  });
}

export function planQuestion(
  input: string,
  dictionary: FieldDefinition[]
): PlanResult {
  const text = input.trim().replace(/[?.!]+$/, "").trim();

  if (!text || text.length > 200) {
    return {
      ok: false,
      error: "Enter a question under 200 characters.",
    };
  }

  // Support one optional equality filter:
  // "Average Age by Sport where Sex = F"
  let mainQuestion = text;
  let filterSql = "";
  let filterNote = "";

  const filterMatch = text.match(
    /\s+where\s+(.+?)\s*(?:=|is)\s+(.+)$/i
  );

  if (filterMatch) {
    const filterField = findField(filterMatch[1], dictionary);
    const filterValue = filterMatch[2]
      .trim()
      .replace(/^["']|["']$/g, "");

    if (!filterField || !filterValue) {
      return {
        ok: false,
        error: "The filter field or value was not recognized.",
      };
    }

    filterSql = `
      AND LOWER(TRIM(CAST(
        ${identifier(filterField.name)} AS VARCHAR
      ))) = LOWER(${literal(filterValue)})`;

    filterNote =
      `Filter applied: ${filterField.name} = ${filterValue}.`;

    mainQuestion = text.slice(0, filterMatch.index).trim();
  } else if (/\s+where\s+/i.test(text)) {
    return {
      ok: false,
      error:
        "Use a filter such as 'where Season = Summer'. " +
        "Only one equality filter is supported.",
    };
  }

  const avgMatch = mainQuestion.match(
    /^(?:(?:what is the|what's the|show me the|show me|show|give me the)\s+)?(?:average|avg|mean)\s+(.+?)\s+(?:by|per|across)\s+(.+)$/i
  );

  const countMatch = mainQuestion.match(
    /^(?:(?:show me|show|give me|what is the)\s+)?(?:(?:count of|count|number of|how many|total)\s+)?(?:records|rows|entries)\s+(?:by|per)\s+(.+)$/i
  );

  const medalMatch = mainQuestion.match(
    /^(?:(?:show me|show)\s+)?(?:medals|medal records|medal-awarded records)\s+(?:by|per)\s+(.+)$/i
  );

  const uniqueMatch = mainQuestion.match(
    /^(?:count\s+)?unique\s+athletes\s+(?:by|per)\s+(.+)$/i
  );

  const operation = avgMatch
    ? "average"
    : medalMatch
      ? "medal"
      : uniqueMatch
        ? "unique"
        : countMatch
          ? "count"
          : null;

  if (!operation) {
    return {
      ok: false,
      error:
        "I can't interpret that question yet. Try " +
        "'Records by Sport', 'Average Age by Sport', " +
        "'Unique athletes by Sport', or 'Medals by NOC'.",
    };
  }

  const dimensionName =
    avgMatch?.[2] ??
    medalMatch?.[1] ??
    uniqueMatch?.[1] ??
    countMatch?.[1] ??
    "";

  const dimension = findField(dimensionName, dictionary);

  if (!dimension) {
    return {
      ok: false,
      error:
        `I couldn't find the field "${dimensionName}". ` +
        "Use a column name from your data dictionary.",
    };
  }

  if (
    !["Category/Text", "Year", "Date", "Identifier"]
      .includes(dimension.type)
  ) {
    return {
      ok: false,
      error:
        `${dimension.name} isn't marked as a grouping field. ` +
        "Use a category, year, date, or identifier.",
    };
  }

  const quotedDimension = identifier(dimension.name);
  const isTime =
    dimension.type === "Year" ||
    dimension.type === "Date";

  const groupExpression =
    dimension.type === "Year"
      ? `TRY_CAST(${quotedDimension} AS INTEGER)`
      : dimension.type === "Date"
        ? `CAST(DATE_TRUNC('month',
            TRY_CAST(${quotedDimension} AS DATE)
          ) AS VARCHAR)`
        : `TRIM(CAST(${quotedDimension} AS VARCHAR))`;

  const conditions: string[] = [
    `${groupExpression} IS NOT NULL`,
  ];

  if (!isTime) {
    conditions.push(`${groupExpression} <> ''`);
  }

  if (dimension.naMeaning === "missing") {
    conditions.push(
      `UPPER(TRIM(CAST(${quotedDimension} AS VARCHAR))) ` +
      "NOT IN ('NA', 'N/A', 'NULL')"
    );
  }

  let aggregate = "COUNT(*)";
  let calculationNote = "Counts source records, not unique athletes.";

  if (operation === "average") {
    const measure = findField(avgMatch![1], dictionary);

    if (!measure || measure.type !== "Number") {
      return {
        ok: false,
        error:
          `I couldn't find a numeric measure named ` +
          `"${avgMatch![1]}". Review your dictionary.`,
      };
    }

    const numericExpression =
      `TRY_CAST(${identifier(measure.name)} AS DOUBLE)`;

    aggregate = `ROUND(AVG(${numericExpression}), 2)`;
    conditions.push(`${numericExpression} IS NOT NULL`);

    calculationNote =
      `Calculates average ${measure.name}, excluding ` +
      "non-numeric and missing measure values.";
  }

  if (operation === "unique") {
    const athleteId = dictionary.find(
      (field) =>
        field.name.toLowerCase() === "id" &&
        field.type === "Identifier"
    );

    if (!athleteId) {
      return {
        ok: false,
        error:
          "Unique athlete counts require an ID field " +
          "confirmed as an Identifier.",
      };
    }

    aggregate = `COUNT(DISTINCT NULLIF(
      TRIM(CAST(${identifier(athleteId.name)} AS VARCHAR)),
      ''
    ))`;

    calculationNote =
      "Counts distinct athlete IDs within each group. " +
      "An athlete can belong to multiple groups.";
  }

  if (operation === "medal") {
    const medal = dictionary.find(
      (field) => field.name.toLowerCase() === "medal"
    );

    if (!medal || medal.naMeaning !== "none") {
      return {
        ok: false,
        error:
          "Confirm that Medal NA means 'None / not awarded' " +
          "in the data dictionary first.",
      };
    }

    conditions.push(
      `CAST(${identifier(medal.name)} AS VARCHAR) ` +
      "IN ('Gold', 'Silver', 'Bronze')"
    );

    calculationNote =
      "Counts athlete-event rows awarded Gold, Silver, " +
      "or Bronze. These are not unique Olympic medal counts.";
  }

  const whereClause =
    conditions.join("\n  AND ") + filterSql;

  const sql = `
SELECT
  ${groupExpression} AS group_label,
  ${aggregate} AS value
FROM uploaded_data
WHERE ${whereClause}
GROUP BY 1
ORDER BY ${isTime ? "group_label ASC" : "value DESC"}
${isTime ? "" : "LIMIT 10"}
`.trim();

  const footnote = [
    `Grouped by ${dimension.name}.`,
    dimension.type === "Date"
      ? "Dates are grouped by calendar month."
      : "",
    calculationNote,
    dimension.naMeaning === "missing"
      ? "Missing grouping values excluded."
      : "",
    filterNote,
    isTime
      ? "Time groups are ordered chronologically."
      : "Top 10 groups shown.",
    "Original CSV data was not modified.",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    ok: true,
    question: {
      id: "typed-question",
      title: text,
      explanation:
        "Generated from your approved field definitions.",
      chart: isTime ? "line" : "bar",
      sql,
      footnote,
    },
  };
}

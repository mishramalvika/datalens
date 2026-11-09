# DataLens

A SQL-free analytics tool that helps business users understand their data, ask questions, and explore results independently.

## Why DataLens?

Having worked with a variety of stakeholders as a consultant in decision analytics, I found that many frequently asked business questions are actually quite straightforward.

However, even simple requests often depend on analysts or technical teams. When working across different time zones, this can increase turnaround times further.

I built DataLens to reduce that friction and create a self-service environment where users can upload datasets and perform basic analytics without needing to know SQL.

## Product Design Decisions

**Data Profiling and Dictionary**

These are integral parts of any data evaluation. Missing values, duplicates, or incorrect encodings can affect the results we generate.

DataLens starts with basic profiling, including control totals, missing values, duplicates, descriptive statistics, and a data preview.

Before analysis, users can also review the data dictionary and clarify field definitions. For example, `NA` in the Olympics dataset can indicate missing measurements or simply that no medal was awarded. Those distinctions matter.

**Power-User Mode**

While the aim is to make analytics SQL-free, some users may want to verify how a result was calculated or make minor changes.

That's why DataLens exposes the underlying SQL, with options to edit and rerun it. Each chart also includes processing notes explaining the calculations and assumptions.

**User Experience**

The first version was functional but required too much scrolling. I redesigned it into three sections — Overview, Dictionary, and Explore — to make navigation easier and show technical details only when needed.

## Features

The workflow is straightforward:

1. Upload a CSV dataset.
2. Review profiling results and data-quality concerns.
3. Confirm the data dictionary.
4. Ask questions or choose suggested analyses.
5. View charts, insights, and underlying SQL.
6. Modify queries and download results.

## Running the Project

Requires Node.js and npm.

```bash
git clone https://github.com/mishramalvika/datalens.git
cd datalens
npm install
npm run dev
```

Open the local URL displayed in the terminal.

To create a production build:

```bash
npm run build
npm run preview
```

I used the [120 Years of Olympic History dataset](https://www.kaggle.com/datasets/heesoo37/120-years-of-olympic-history-athletes-and-results) for testing. Download `athlete_events.csv` and upload it through the app.

**Tech stack:** React, TypeScript, Vite, Papa Parse, DuckDB-WASM, and Recharts.

## How I Used AI

I shared my product requirements with AI and asked for a step-by-step implementation process rather than having it generate the entire application at once.

This helped me review and test each component as it was built. AI assisted with writing code, debugging, and troubleshooting build issues.

I also had to reiterate my UX requirements. The initial implementation focused on functionality but wasn't particularly usable. I pushed for a redesign with simpler navigation and less scrolling.

The product direction, feature priorities, and decision to redesign the interface came from me.

## Limitations and Next Steps

The current version supports a limited set of natural-language question patterns and single-table analysis. It also has basic data-quality checks rather than a complete data-cleaning workflow.

With more time, I would explore:

- AI-assisted data dictionaries and more flexible natural-language queries.
- No-code transformations, including cleaning and filtering datasets.
- Multi-table analysis and better performance for large files.

# DataLens — SQL-Free Analytics

**Understand your data. Ask questions. Explore insights.**

DataLens is a self-service analytics web application that enables nontechnical users to upload datasets, understand their data, and perform basic analytics without writing SQL.

For users who want more control, DataLens also provides access to the underlying SQL queries, allowing them to review, edit, and rerun analyses.

## Why DataLens?

Having worked with a variety of stakeholders as a consultant in decision analytics, I found that some of the most frequently asked business questions are also the most straightforward.

However, answering these questions often requires support from analysts or technical teams. When working with stakeholders across the globe, differences in time zones add another layer of friction, increasing the turnaround time for even simple requests.

I wanted to build something that reduces this dependency.

DataLens aims to create a self-service environment where business users can upload their datasets, understand what they're working with, and run simple analyses independently.

The goal is not to replace analysts, but to make everyday data exploration more accessible.

## Product Design Decisions

### 1. Dataset Profiling and Data Dictionary

These are integral parts of any data evaluation process.

The quality of our data has a direct impact on the results we generate. Missing values, inconsistent encodings, duplicate records, or formatting issues can lead to incorrect analyses and misleading conclusions.

This is where data profiling comes in.

Before users begin analyzing their data, DataLens performs high-level checks, including:

- Row and column counts
- Missing values and null-like placeholders
- Duplicate records
- Data type detection
- Descriptive statistics
- A preview of the uploaded dataset

However, identifying a field's data type is not the same as understanding what that field represents.

Datasets often use similar labels for loosely related concepts, and we cannot always substitute one for another.

For example, in the Olympics dataset, `NA` in the `Age` column indicates an unknown value, whereas `NA` in the `Medal` column indicates that no medal was awarded.

Treating both identically could lead to incorrect results.

This is why DataLens includes an editable data dictionary. Users can review field types, provide definitions, and clarify ambiguous values before proceeding with analytics.

The application does not automatically alter the source data.

### 2. SQL-Free Analytics

Most business users are interested in getting answers, not writing queries.

DataLens allows users to ask supported questions in plain English or select from suggested questions generated based on their dataset.

For example:

- How has the number of records changed over time?
- How does average age vary across sports?
- Which sports have the most records?
- How many unique athletes participated in each sport?

The application translates supported questions into SQL, executes the queries, and presents the results through visualizations and tables.

The current implementation uses a rule-based question interpreter. This makes the supported operations more predictable and easier to validate, although it limits the complexity of questions users can ask.

### 3. Transparency and Power-User Mode

While most business users don't want to write SQL, some users are comfortable with it and want more control over how results are calculated.

I also believe that making analytics accessible should not come at the cost of transparency.

That's why DataLens allows users to inspect the underlying SQL, make edits, and rerun queries.

Each analysis also includes processing notes explaining the calculations, filters, and assumptions used to produce the result.

This allows users to verify their results rather than treating the generated answers as a black box.

### 4. Designing for Usability

One of the biggest lessons from building DataLens was the difference between creating a functional application and creating a usable one.

The first version had most of the required functionality, but everything was presented on a single long page. Users had to scroll through profiling tables, dictionary definitions, and other technical details before reaching the actual analytics interface.

Although the application worked, the experience was overwhelming.

I decided to redesign it around three focused sections:

- **Overview:** A quick summary of the dataset and potential data-quality issues.
- **Dictionary:** A dedicated space to review and confirm field definitions.
- **Explore:** A workspace for asking questions, viewing charts, examining SQL, and exporting results.

I also moved detailed technical information into expandable sections so users can access it when needed without being overwhelmed.

The intention was to make the experience approachable for nontechnical users while retaining the flexibility required by more advanced users.

## Features and Demo Workflow

**1. Upload a dataset**

Upload a CSV file to begin exploring your data.

**2. Understand your data**

Review dataset statistics, detected field types, missing values, duplicates, and potential data-quality issues.

**3. Review the data dictionary**

Confirm field definitions and clarify the meaning of ambiguous values before proceeding.

**4. Explore your data**

Ask a supported natural-language question or choose from suggested analyses. DataLens generates SQL, executes the analysis, and displays the results.

**5. Understand the results**

View charts, numerical results, descriptive observations, and the processing assumptions behind each analysis.

**6. Review, refine, and export**

Inspect the SQL, edit and rerun queries if needed, and download the resulting table as a CSV.

## Tech Stack

| Technology | Purpose |
|---|---|
| React + TypeScript | Frontend application |
| Vite | Development and build tooling |
| Papa Parse | CSV parsing and profiling |
| DuckDB-WASM | In-browser SQL execution |
| Recharts | Interactive data visualizations |
| CSS | Interface styling |

The application processes data locally in the browser and does not require a separate backend or an external AI API.

## How to Run the Project

### Prerequisites

Install Node.js and npm.

### Installation

Clone the repository:

```bash
git clone <repository-url>
cd <repository-folder>
```

Install the required dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open the local URL displayed in the terminal, usually:

`http://localhost:5173/`

### Production Build

To build the application:

```bash
npm run build
```

To preview the production build locally:

```bash
npm run preview
```

### Sample Dataset

I used the [120 Years of Olympic History dataset](https://www.kaggle.com/datasets/heesoo37/120-years-of-olympic-history-athletes-and-results) to develop and test the application.

Download the dataset, extract the ZIP file, and upload `athlete_events.csv` through the DataLens interface.

The application is designed to accept other single-table CSV datasets, although some question-generation features remain limited by the available field types and supported query patterns.

## How I Used AI

I used AI as a development partner throughout this project, particularly for implementation, debugging, and iterating on the interface.

I started by sharing my product requirements and asking for a step-by-step implementation process rather than requesting the entire application at once.

This allowed me to control and review smaller parts of the development, test functionality as it was added, and make product decisions throughout the process.

My initial requirements were based on my previous experience with conversational analytics. I specifically wanted dataset profiling, a reviewed data dictionary, suggested questions, editable SQL, and transparent processing notes.

AI helped translate these requirements into React components, CSV profiling logic, a natural-language query interpreter, and a DuckDB-based analytics engine.

I tested each stage using the Olympics dataset and worked through implementation issues, including dependency conflicts, TypeScript build errors, and CSV parsing warnings.

One of the most important iterations was related to usability.

The initial implementation was functionally complete but difficult to navigate. AI had focused primarily on building a working tool rather than making it intuitive for the target audience.

I had to reiterate my UX requirements and push for a redesign that reduced scrolling, improved navigation, and made technical information available on demand.

This reinforced the importance of using AI to support product decisions rather than allowing it to make those decisions independently.

### Major AI Prompts and Decisions

| My direction to AI | Outcome |
|---|---|
| Build a SQL-free analytics experience based on conversational analytics | Established the core product direction |
| Profile uploaded data and require a data dictionary review before analysis | Introduced a data-understanding stage before analytics |
| Suggest questions based on the dataset | Added guided exploration for users unfamiliar with their data |
| Make the SQL visible, editable, and rerunnable | Added transparency and power-user functionality |
| Build the application step by step | Enabled incremental testing and debugging |
| The interface requires too much scrolling and is difficult to navigate | Redesigned the application around three focused workspaces |

## Limitations

DataLens is a prototype built within the scope of this challenge. Some capabilities are intentionally limited.

**Natural-language interpretation**

The current implementation supports a constrained set of analytical patterns, including record counts, averages, unique-athlete counts, medal-record counts, and simple equality filters.

It does not yet support arbitrary conversational questions.

**Single-table analysis**

DataLens currently works with one CSV dataset at a time. It does not support joins or relationships between multiple datasets.

**Limited data transformations**

The application detects potential data-quality issues and supports SQL-based filtering and aggregation, but it does not yet provide a complete visual data-cleaning workflow.

**CSV processing performance**

CSV profiling currently runs on the browser's main thread. Background processing was disabled to address an issue encountered during production testing. This may affect responsiveness when working with larger datasets.

**Result size limits**

Query results are limited to 5,000 rows for display and export in the current implementation.

## Future Improvements

Given more time, I would focus on making the application more flexible and improving the overall analytics experience.

**1. AI-assisted data dictionary**

Use natural-language capabilities to suggest field descriptions, business meanings, units, and potential relationships between fields, while keeping users in control of final definitions.

**2. More flexible natural-language queries**

Extend the question interpreter with an LLM-backed query planner so users can ask more complex questions without following predefined patterns. Generated queries would still need validation before execution.

**3. No-code data transformations**

Allow users to clean, filter, standardize, and transform datasets through simple UI interactions without writing SQL.

**4. Multi-table analytics**

Support multiple datasets and relationships between tables, enabling more realistic business analysis workflows.

**5. Performance improvements**

Move CSV profiling into a dedicated background worker and improve handling of larger files.

## Closing Thoughts

DataLens started with a simple observation from my experience in decision analytics: many business questions are straightforward, but getting answers often takes more effort than it should.

The aim of this project was to reduce that friction while keeping the results understandable and verifiable.

Building the application also highlighted how important usability is to self-service analytics. A tool can have all the right features, but if users find it difficult to navigate, it doesn't fully solve the problem.

That was the most important consideration behind the final design of DataLens.

# PMO Portfolio Suite

A single-deploy, client-side PMO (Project Management Office) suite that presents as three progressively richer editions from one codebase: **PMO Core**, **PMO + ITIL**, and **PMO + ITIL + DevOps**. Everything runs in the browser on `localStorage`, so it deploys as a static site (for example on GitHub Pages) with no backend and no build step.

## What it is

The suite links a full project lifecycle across connected pages: intake and portfolio, planning and status, governance, financials, and (in the higher editions) IT service management and CI/CD delivery. All pages read and write a shared data store (`assets/js/store.js`), so a change made on one page shows up live on the others.

Key characteristics:

- No backend. State lives in `localStorage`; demo data is seeded once on first load.
- One deploy, three editions. A tier switch reveals more of the same suite rather than swapping builds.
- Single shared store. `store.js` is the source of truth for data and for the tier and navigation model.
- Static and portable. Open `index.html` directly, or serve the folder with any static file server.

## Editions (tiers)

The active edition is chosen from the pill next to the **PMO Suite** logo in the top navigation. Switching editions is instant and persists on the device.

| Edition | Tier | Adds |
|---------|------|------|
| PMO Core | 1 | Project and portfolio management: intake, portfolio, WBS, capacity, financials, status |
| PMO + ITIL | 2 | ITIL request typing, change/CAB gate, governance linkage, service catalog and CI map, value realization |
| PMO + ITIL + DevOps | 3 | Simulated CI/CD deployment intake, pipeline and deployment events, GitHub Actions payload spec |

Higher tiers never remove anything; they only reveal more. Views, navigation entries, and in-page sections declare a minimum tier and appear once the active edition reaches it.

## Delivered backlog

Every item below is implemented in this build. Feature IDs are tagged inline in the source (for example `[I2]`, `[C1]`) so each change is easy to locate.

| ID | Item | Tier | Priority | Status |
|----|------|------|----------|--------|
| F1 | Tier (edition) mode system | All | P0 | Done |
| F2 | Navigation refactor to a single rendered component | All | P0 | Done |
| W1 | Work Breakdown Structure view | Core (1) | P0 | Done |
| I1 | ITIL request typing on Intake | ITIL (2) | P1 | Done |
| I2 | Change Request to ITIL change / CAB gate | ITIL (2) | P1 | Done |
| I3 | Governance status linkage | ITIL (2) | P1 | Done |
| I4 | Repository to Service Catalog / CI map | ITIL (2) | P1 | Done |
| I5 | Financial Dashboard to Value Realization | ITIL (2) | P1 | Done |
| C1 | Simulated CI/CD deployment intake | DevOps (3) | P1 | Done |
| C2 | Pipeline / deployment events view | DevOps (3) | P2 | Done |
| C3 | Real GitHub Actions payload spec | DevOps (3) | P2 | Done |

### Notes on selected items

- **I1** captures an ITIL request type on the Intake Form (ITIL edition) and surfaces it as a gated column on the Intake Report.
- **I2** adds an ITIL change classification (Standard, Normal, Emergency) and a CAB decision to the Change Implementation Form. A Normal change cannot be submitted until the CAB records an Approved decision.
- **I3** reads the CAB position that I2 writes and shows it in the Scorecard's Linked Governance Records panel.
- **I4** maps repository artifacts to service catalog entries and configuration items (CIs) on the Repository page.
- **I5** adds a benefits-realization view (expected value vs realized to date) to the Financial Dashboard.
- **C1** logs a simulated deployment and runs a simulated Build, Test, Deploy pipeline, storing the run.
- **C2** lists pipeline and deployment events and, via its Change Gate column, links each deployment back to the I2 change / CAB position for its project.
- **C3** documents how a real GitHub Actions `workflow_run` webhook payload maps onto the deployment record, so the intake can later be fed by a webhook instead of the form.

## Pages and navigation

Navigation is generated from a single config in `store.js` and is filtered by the active edition.

Core (Tier 1):

- **Project Intake Process**: Intake Form (`intake-form.html`), Intake Report (`intake-report.html`)
- **Portfolio Review** (`portfolio-review.html`)
- **Resource Capacity** (`capacity.html`)
- **Financial Dashboard** (`financial-dashboard.html`)
- **Project Status**: Project Scorecard (`scorecard.html`), Risk & Decision (`risk-decision-log.html`), Repository (`repository.html`), Change Request (`change-request-form.html`), Project Financials (`financials.html`), Resource Management (`resources.html`), Work Breakdown (`wbs.html`)

DevOps (Tier 3):

- **CI/CD Delivery**: Deployment Intake (`deployment-intake.html`), Pipeline & Deployment Events (`deployment-events.html`)

The landing page is `index.html`.

## Architecture

- **`assets/js/store.js`** is the shared glue. It holds the low-level storage helpers, the seeded demo data, all read and write APIs (exposed on `window.PPS`), the tier system `[F1]`, and the navigation model and renderer `[F2]`.
- **Tier gating.** Any element that should appear only from a given edition carries `data-min-tier="itil"` or `data-min-tier="devops"`. `PPS.applyTier()` sets `body[data-tier]` and toggles a `pps-tier-off` class (which hides the element) on every gated node. Pages that inject content re-call `PPS.applyTier()` after render so newly added nodes are gated correctly.
- **Navigation.** Adding a view is one entry in the `NAV_CONFIG` array in `store.js`; the nav renders itself into an empty `<nav id="ppsNav">` on every page.
- **Cross-page reactivity.** Pages listen for the `storage` event and for custom events (for example `cif:updated`, `deploy:updated`) to re-render when shared data changes.

## Data and storage

All data is stored under these `localStorage` keys:

| Key | Holds |
|-----|-------|
| `crRequestCounter` | Running counter for intake Request IDs |
| `crSubmissionsLog` | Intake register (request records) |
| `ppsPortfolio` | Portfolio projects |
| `ppsScorecards` | Per-project scorecard detail |
| `ppsRisks`, `ppsDecisions` | Risk and decision logs |
| `ppsResources`, `ppsAllocations` | Resources and their allocations |
| `ppsFinancialMetrics` | Per-project financials |
| `ppsWbs` | Work Breakdown Structure nodes |
| `cifCounter`, `cifSubmissionsLog` | Change Implementation Form counter and log (includes ITIL change type and CAB decision) |
| `ppsDeployments`, `ppsDeployCounter` | Simulated deployments and their counter |
| `ppsTier` | Active edition |
| `ppsSeededV1` | One-time seed flag |

Seeding is per-key and additive: each guard writes only when its key is absent, so real data you enter is never overwritten, and blocks added in a later version still reach existing users. A key you clear on purpose is stored as an empty array, so intentional deletions are respected and never re-seeded.

## Running locally

No build is required.

- Quickest: open `index.html` in a browser.
- Recommended (so relative paths and the `storage` event behave like production), serve the folder statically, for example:

```
# Python 3
python3 -m http.server 8080

# or Node
npx serve .
```

Then open `http://localhost:8080`.

## Deploying

Push the folder to any static host. For GitHub Pages, publish the repository (or the `docs/` folder) and the suite runs as-is. There is nothing to compile and no environment configuration.

## Resetting demo data

Demo data seeds automatically on first load. To start clean, clear the site's `localStorage` in the browser dev tools, or call `PPS.resetAll()` from the console, which removes the seeded keys and re-seeds fresh data.

## Project structure

```
pmo-suite-updates/
  index.html                  Landing page
  intake-form.html            Project intake (captures ITIL request type in ITIL edition)
  intake-report.html          Intake register (gated ITIL Type column)
  portfolio-review.html       Portfolio
  wbs.html                    Work Breakdown Structure
  capacity.html               Resource capacity vs demand
  financial-dashboard.html    Portfolio financials + Value Realization (ITIL)
  scorecard.html              Project scorecard + governance linkage (ITIL)
  risk-decision-log.html      Risks and decisions
  repository.html             Document repository + Service Catalog / CI map (ITIL)
  change-request-form.html    Change Implementation Form + CAB gate (ITIL)
  financials.html             Per-project financials
  resources.html              Resource management
  deployment-intake.html      Simulated CI/CD deployment intake + GitHub Actions payload spec (DevOps)
  deployment-events.html      Pipeline & deployment events + change gate (DevOps)
  assets/
    css/app.css               Shared styles and design tokens
    js/store.js               Shared data store, tier system, navigation model
  README.md
```

## Limitations

This is a demonstration suite, not a production system. It runs entirely in the browser, uses seeded sample data, and simulates pipeline runs and file uploads rather than calling real services. The GitHub Actions payload mapping on the Deployment Intake page is a reference specification only; nothing on that page calls GitHub.

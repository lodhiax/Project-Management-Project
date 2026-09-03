# PMO Portfolio Suite

Four linked HTML pages for project intake and weekly portfolio governance. The suite is fully static (HTML, CSS, and vanilla JavaScript), so it deploys to GitHub Pages with no backend.

## The four pages

1. **Project Intake Form** (`intake-form.html`) — always active. It auto-generates the Request ID and the submission date from the system clock, enforces the required (\*) fields before a request is accepted, and keeps the review section (Section 2) locked until the request is submitted.
2. **Project Intake Report** (`intake-report.html`) — a locked, display-only register of every intake submission, each shown with the correct status colour.
3. **Weekly Portfolio Review** (`portfolio-review.html`) — the current reporting cycle's project data set only. This is the master source of project data.
4. **Weekly Scorecard** (`scorecard.html`) — pick a project from the portfolio and its scorecard is rendered with the manager, dates, phase, % complete and schedule status pulled live from the portfolio review.

## How they are linked

```
Intake Form        --->  Intake Report      (submissions populate the read-only register)
Portfolio Review   --->  Weekly Scorecard   (portfolio data drives the derived scorecard values)
```

All four pages share a single client-side data layer in `assets/js/store.js`, backed by the browser's `localStorage`. Demo data is seeded on first load; new intake submissions are added on top of it.

## Project structure

```
project-portfolio-suite/
├── index.html              Landing hub + reset control
├── intake-form.html        1. Project Intake Form
├── intake-report.html      2. Project Intake Report (display only)
├── portfolio-review.html   3. Weekly Portfolio Review (current data set)
├── scorecard.html          4. Weekly Scorecard (derived from portfolio)
├── assets/
│   ├── css/app.css         Shared navigation and helper styles
│   └── js/store.js         Shared data store, seed data, status maps
├── .nojekyll               Tells GitHub Pages to serve /assets as-is
└── README.md
```

## Run locally

Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Deploy to GitHub Pages

1. Create a new repository on GitHub (for example `pmo-portfolio-suite`).
2. Upload the contents of this folder to the repository root (so `index.html` is at the top level).
3. In the repo, go to **Settings → Pages**.
4. Under **Build and deployment**, set **Source** to **Deploy from a branch**, pick the `main` branch and the `/ (root)` folder, and save.
5. Wait a minute, then open the published URL GitHub shows on that page.

Command-line alternative:

```bash
cd project-portfolio-suite
git init
git add .
git commit -m "PMO Portfolio Suite"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
# then enable Pages in Settings as above
```

## A note on data storage

Data lives in each visitor's own browser via `localStorage`. That is ideal for a single-user demo or a personal PMO tool: it needs no server and works on GitHub Pages. It is **not** a shared database, so intake requests submitted on one device are not visible on another. If you later need multiple people to share the same live data, the `store.js` read/write functions are the single place to swap `localStorage` for a hosted API or a service such as Firebase.

Use **Reset demo data** on the home page to clear everything back to the seeded set.

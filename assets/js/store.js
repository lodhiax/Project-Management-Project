/* ============================================================
   PMO Portfolio Suite — shared data store
   ------------------------------------------------------------
   This single file is the "glue" that links all four pages.
   Everything is client-side (localStorage), so it deploys as a
   static site on GitHub Pages with no backend required.

   Data flow / relationships:
     Intake Form   --writes-->  register  --reads-->  Intake Report
     Portfolio Review  --is the source-->  Scorecard (derived values)

   Storage keys (kept compatible with the intake form's own script):
     crRequestCounter  : running counter for auto Request IDs
     crSubmissionsLog  : the intake register (array of request records)
     ppsPortfolio      : the current portfolio data set (array of projects)
     ppsScorecards     : per-project scorecard detail, keyed by project code
     ppsSeededV1       : flag so we seed demo data only once
   ============================================================ */
(function () {
  "use strict";

  var KEYS = {
    counter:    "crRequestCounter",
    register:   "crSubmissionsLog",
    portfolio:  "ppsPortfolio",
    scorecards: "ppsScorecards",
    seeded:     "ppsSeededV1"
  };

  /* ---------- low-level storage helpers (fail-safe) ---------- */
  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { return false; }
  }

  /* ---------- date helper (shared "Report Date") ---------- */
  var MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  function today() {
    var n = new Date();
    return n.getDate() + "-" + MONTHS[n.getMonth()] + "-" + String(n.getFullYear()).slice(-2);
  }

  /* ============================================================
     STATUS MAPS
     ============================================================ */

  // Intake request status  ->  legend dot + clean label
  function intakeStatus(raw) {
    var s = String(raw || "").toLowerCase();
    if (s.indexOf("approve") > -1)  return { dot: "dot-green",  label: "Approved" };
    if (s.indexOf("reject") > -1)   return { dot: "dot-red",    label: "Rejected" };
    if (s.indexOf("hold") > -1)     return { dot: "dot-purple", label: "On Hold" };
    if (s.indexOf("more info") > -1 || s.indexOf("sent back") > -1 || s.indexOf("information") > -1)
                                    return { dot: "dot-yellow", label: "Needs More Info" };
    return { dot: "dot-grey", label: "Submitted" };
  }

  // Portfolio project status key  ->  legend dot + clean label
  var PORTFOLIO_STATUS = {
    notStarted: { dot: "dot-black",  label: "Not Started" },
    onTrack:    { dot: "dot-green",  label: "On Track" },
    atRisk:     { dot: "dot-yellow", label: "At Risk" },
    delayed:    { dot: "dot-red",    label: "Delayed" },
    onHold:     { dot: "dot-purple", label: "On Hold" },
    completed:  { dot: "dot-blue",   label: "Completed" }
  };
  function portfolioStatus(key) {
    return PORTFOLIO_STATUS[key] || { dot: "dot-grey", label: key || "Unknown" };
  }

  /* ============================================================
     SEED DATA  (demo content so the deployed site is alive)
     ============================================================ */

  // --- Intake register: mirrors the 6 example intake rows ---
  var SEED_REGISTER = [
    { requestId:"CR-20260805-0001", title:"Automate month-end billing reconciliation", initiator:"Michael Turner", department:"Finance",       typeOfChange:"Modification", importance:"High",   dateSubmitted:"5-Aug-26",  ownerTeam:"Data & Integrations", finalTimeline:"30-Sep-26", approverComments:"Approved. Cleared for scheduling by IT.",          status:"Approved" },
    { requestId:"CR-20260812-0002", title:"Customer self-service tariff portal",        initiator:"James Carter",   department:"Corporate",     typeOfChange:"New Software", importance:"High",   dateSubmitted:"12-Aug-26", ownerTeam:"Digital Platforms",   finalTimeline:"15-Nov-26", approverComments:"Approved. Requirements complete, no clarifications needed.", status:"Approved" },
    { requestId:"CR-20260814-0003", title:"Add VAT breakdown to OMS invoice format",    initiator:"David Bennett",  department:"Operations",    typeOfChange:"MIS/Report",  importance:"Medium", dateSubmitted:"14-Aug-26", ownerTeam:"Reporting Team",      finalTimeline:"26-Sep-26", approverComments:"On hold pending Finance sign-off on tax fields.",           status:"On Hold" },
    { requestId:"CR-20260818-0004", title:"Duplicate courier records cleanup utility",  initiator:"Robert Hughes",  department:"ECom",          typeOfChange:"New Software", importance:"Low",    dateSubmitted:"18-Aug-26", ownerTeam:"Unassigned",          finalTimeline:"",          approverComments:"Rejected. Overlaps with existing de-duplication job.",      status:"Rejected" },
    { requestId:"CR-20260825-0005", title:"Weekly EMPOST volume dashboard",             initiator:"Emily Watson",   department:"International",  typeOfChange:"MIS/Report",  importance:"Medium", dateSubmitted:"25-Aug-26", ownerTeam:"Unassigned",          finalTimeline:"",          approverComments:"Submitted. Awaiting intake review.",                        status:"Submitted" },
    { requestId:"CR-20260901-0006", title:"SMS delivery notifications for consumers",   initiator:"Daniel Foster",  department:"Consumer",      typeOfChange:"Modification", importance:"High",   dateSubmitted:"1-Sep-26",  ownerTeam:"Unassigned",          finalTimeline:"",          approverComments:"Sent back to requestor: clarify target customer segments.", status:"Needs More Info" }
  ];

  // --- Portfolio: the current data set (active + completed) ---
  var SEED_PORTFOLIO = [
    { code:"P2606-01", name:"Import Billing Automation",              pm:"Michael Turner", phase:"UAT",         start:"15-Jun-26", end:"30-Sep-26", percent:75,  progress:"UAT cycle 2 complete; 3 low-severity defects open.",             remarks:"Business sign-off targeted next week.",       status:"onTrack",   section:"active" },
    { code:"P2607-02", name:"Customer Tariff Portal",                 pm:"James Carter",   phase:"Development", start:"12-Jul-26", end:"15-Nov-26", percent:40,  progress:"Core portal screens built; tariff API integration underway.",    remarks:"Waiting on SSO config from InfoSec.",         status:"atRisk",    section:"active" },
    { code:"P2608-03", name:"OMS VAT Invoice Format",                 pm:"David Bennett",  phase:"Development", start:"14-Aug-26", end:"26-Oct-26", percent:30,  progress:"Tax calculation module in progress.",                            remarks:"Blocked: final VAT rules not yet confirmed by Finance.", status:"delayed", section:"active" },
    { code:"P2608-04", name:"Cash Reconciliation Engine",             pm:"Emily Watson",   phase:"Analysis",    start:"1-Aug-26",  end:"20-Dec-26", percent:15,  progress:"Requirements workshops complete; solution design drafting.",      remarks:"On track for design gate review.",            status:"onTrack",   section:"active" },
    { code:"P2607-05", name:"EMPOST Reporting Revamp",                pm:"Robert Hughes",  phase:"On Hold",     start:"5-Jul-26",  end:"TBD",       percent:20,  progress:"Paused pending budget re-approval.",                             remarks:"Resume decision expected end of month.",      status:"onHold",    section:"active" },
    { code:"P2609-06", name:"SMS Notification Service",               pm:"Daniel Foster",  phase:"Not Started", start:"15-Sep-26", end:"31-Jan-27", percent:0,   progress:"Kickoff scheduled; vendor shortlisting in progress.",            remarks:"Awaiting resource allocation.",               status:"notStarted",section:"active" },
    { code:"P2601-07", name:"Re-rating Utility (OMS & Coloader)",     pm:"David Bennett",  phase:"Live",        start:"25-Jan-26", end:"30-Jun-26", percent:100, progress:"Deployed to production; hypercare period closed.",               remarks:"Closed.",                                     status:"completed", section:"completed" },
    { code:"P2602-08", name:"Duty & Tax Reconciliation Dashboard",    pm:"Emily Watson",   phase:"Live",        start:"10-Feb-26", end:"15-Jul-26", percent:100, progress:"Live and adopted by the operations team.",                       remarks:"Closed.",                                     status:"completed", section:"completed" }
  ];

  // --- Scorecard detail, keyed by project code. ---
  // The flagship project has full detail (ported from Project_Scorecard.html).
  // Other projects carry a light record; their header values are derived live
  // from the portfolio, and detail sections show an honest empty state.
  var SEED_SCORECARDS = {
    "P2606-01": {
      sponsor: "Sarah Whitfield, Director, Innovation & CS",
      category: "Efficiency",
      scopeStatus: "onTrack",
      budgetStatus: "onTrack",
      objective: "Right now, import billing is reconciled by hand in spreadsheets, which is slow and easy to get wrong. This project builds an automated engine that connects the Order Management System (OMS) to Finance. It pulls in carrier and customs charges, applies the duty and VAT rules, and routes reconciled invoices through for approval. The aim is to cut out the manual matching, put a clear approval chain in place, and give Operations and Finance one shared view of charges, exceptions, and what has been closed.",
      changeRequests: { approved: 1, rejected: 0, lastCycle: 1 },
      financials: { budgeted: "$180,000", spent: "$96,000", etc: "$75,000" },
      milestones: [
        { phase:"Planning", name:"Requirement gathering sessions",               start:"15-Jun-26", planned:"30-Jun-26", actual:"28-Jun-26", status:"completed" },
        { phase:"Planning", name:"Business Requirements (Prep / Review / Sign-off)", start:"1-Jul-26", planned:"18-Jul-26", actual:"20-Jul-26", status:"completed" },
        { phase:"Analysis", name:"Functional Requirements (Prep / Review / Sign-off)", start:"21-Jul-26", planned:"8-Aug-26", actual:"", status:"onTrack" },
        { phase:"Build",    name:"Build the billing and reconciliation engine",   start:"11-Aug-26", planned:"12-Sep-26", actual:"", status:"atRisk" },
        { phase:"Test",     name:"UAT cycles 1 & 2",                              start:"15-Sep-26", planned:"25-Sep-26", actual:"", status:"notStarted" },
        { phase:"Deploy",   name:"Go-live & hypercare",                           start:"28-Sep-26", planned:"30-Sep-26", actual:"", status:"notStarted" }
      ],
      risks: [
        { desc:"If Finance changes the VAT rules, we may have to rebuild part of the tax calculation module.", owner:"David Bennett",  severity:"Medium", finalStatus:"Open" },
        { desc:"The people we need for UAT are also tied up with the quarter-end close, so testing could slip.", owner:"Michael Turner", severity:"Low",   finalStatus:"Monitoring" }
      ],
      issues: [
        { desc:"Single sign-on setup is stuck waiting in the InfoSec queue, and it is holding up the portal integration.", owner:"Michael Turner", due:"10-Sep-26", status:"atRisk" }
      ],
      keyUpdates: [
        "We settled on how OMS will hand data to the reconciliation engine. It passes charge data into a staging table, Finance signs off there before anything is posted, and the results flow back to OMS afterward.",
        "We got test access to the billing sandbox and confirmed that two-way integration between OMS and the engine will work. The team is now pulling together the data set the approved workflows need.",
        "We redrew the future process flow and walked through it as a group so it now covers import billing reconciliation from start to finish."
      ],
      changeRequestDetails: [
        { desc:"Requested multi-currency support in the reconciliation output for co-loader invoices.", raisedBy:"James Carter", date:"22-Aug-26", status:"onHold" }
      ]
    }
  };

  /* ============================================================
     SEEDING  (runs once; never wipes real submissions)
     ============================================================ */
  function ensureSeed() {
    if (read(KEYS.seeded, false) === true) {
      // Already seeded — just make sure the ID counter never regresses.
      if (Number(read(KEYS.counter, 0)) < SEED_REGISTER.length) {
        write(KEYS.counter, SEED_REGISTER.length);
      }
      return;
    }
    if (read(KEYS.register, null) === null)  write(KEYS.register, SEED_REGISTER);
    if (read(KEYS.portfolio, null) === null) write(KEYS.portfolio, SEED_PORTFOLIO);
    if (read(KEYS.scorecards, null) === null) write(KEYS.scorecards, SEED_SCORECARDS);
    if (Number(read(KEYS.counter, 0)) < SEED_REGISTER.length) write(KEYS.counter, SEED_REGISTER.length);
    write(KEYS.seeded, true);
  }

  function resetAll() {
    [KEYS.counter, KEYS.register, KEYS.portfolio, KEYS.scorecards, KEYS.seeded]
      .forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} });
    ensureSeed();
  }

  /* ============================================================
     PUBLIC READERS
     ============================================================ */
  function getRegister() {
    var arr = read(KEYS.register, []);
    return Array.isArray(arr) ? arr : [];
  }
  function getPortfolio() {
    var arr = read(KEYS.portfolio, []);
    return Array.isArray(arr) ? arr : [];
  }
  function getProject(code) {
    return getPortfolio().filter(function (p) { return p.code === code; })[0] || null;
  }
  function getScorecardDetail(code) {
    var all = read(KEYS.scorecards, {}) || {};
    return all[code] || null;
  }

  /* Small DOM helper used by the pages */
  function esc(s) {
    return String(s === undefined || s === null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // Seed immediately (synchronously) so pages that read on load have data,
  // and so the intake form's ID counter is correct before its own script runs.
  ensureSeed();

  /* Expose API */
  window.PPS = {
    KEYS: KEYS,
    today: today,
    intakeStatus: intakeStatus,
    portfolioStatus: portfolioStatus,
    getRegister: getRegister,
    getPortfolio: getPortfolio,
    getProject: getProject,
    getScorecardDetail: getScorecardDetail,
    resetAll: resetAll,
    esc: esc,
    _seedRegisterCount: SEED_REGISTER.length
  };

  /* ============================================================
     NAV DROPDOWNS  (Project Intake Process / Project Status)
     Runs immediately: this script is always included after the
     <nav> markup in every page, so the elements already exist.
     ============================================================ */
  function closeAllDropdowns(except) {
    document.querySelectorAll(".pps-dropdown.open").forEach(function (d) {
      if (d !== except) d.classList.remove("open");
    });
  }
  document.querySelectorAll(".pps-dropdown-toggle").forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      var dd = btn.closest(".pps-dropdown");
      var wasOpen = dd.classList.contains("open");
      closeAllDropdowns();
      if (!wasOpen) dd.classList.add("open");
    });
  });
  document.addEventListener("click", function () { closeAllDropdowns(); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeAllDropdowns();
  });
})();

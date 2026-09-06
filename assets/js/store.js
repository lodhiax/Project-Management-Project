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
    counter:     "crRequestCounter",
    register:    "crSubmissionsLog",
    portfolio:   "ppsPortfolio",
    scorecards:  "ppsScorecards",
    risks:       "ppsRisks",
    decisions:   "ppsDecisions",
    resources:   "ppsResources",
    allocations: "ppsAllocations",
    financials:  "ppsFinancialMetrics",
    wbs:         "ppsWbs",
    seeded:      "ppsSeededV1"
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
  function assign(a, b) {
    var o = {}, k;
    if (a) { for (k in a) { if (a.hasOwnProperty(k)) o[k] = a[k]; } }
    if (b) { for (k in b) { if (b.hasOwnProperty(k)) o[k] = b[k]; } }
    return o;
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

  // --- Risk / Issue log (tagged to the flagship project) ---
  var FLAGSHIP = "P2606-01";
  var SEED_RISKS = [
    { id:1,  project:FLAGSHIP, desc:"Delay in hardware delivery & infrastructure readiness", type:"Issue", prob:"High",   impact:"High",   action:"Development started in a temporary environment to minimize impact; full impact to be reassessed after hardware commissioning at the client data center. Critical path item, ~1 month impact across workstreams.", by:"Client IT",        date:"5-Mar-22",  status:"Open" },
    { id:2,  project:FLAGSHIP, desc:"Delay in resource onboarding", type:"Risk", prob:"Low",    impact:"Medium", action:"Delivery squads mobilized and operational; hiring for remaining slots in progress.", by:"Client / Vendor", date:"On-going", status:"Open" },
    { id:3,  project:FLAGSHIP, desc:"Design language for backend web interfaces", type:"Risk", prob:"Low", impact:"Medium", action:"Art direction (CX/UI) for back-office systems agreed between client and vendor.", by:"Client / Vendor", date:"31-Jan-22", status:"Closed" },
    { id:4,  project:FLAGSHIP, desc:"Native vs hybrid app decision", type:"Risk", prob:"High", impact:"Medium", action:"Decision taken; see Decision Log.", by:"Client", date:"31-Jan-22", status:"Closed" },
    { id:5,  project:FLAGSHIP, desc:"Backend API architecture and development", type:"Risk", prob:"Low", impact:"High", action:"Identification and prioritization of APIs jointly agreed, aligned to critical path.", by:"Client / Vendor", date:"18-Mar-22", status:"Open" },
    { id:6,  project:FLAGSHIP, desc:"Document management system upgrade dependency", type:"Risk", prob:"Low", impact:"High", action:"Client upgrading its document management system; any delay directly impacts downstream workstreams. APIs to be made available by end of March to de-risk timeline.", by:"Client", date:"31-Mar-22", status:"Open" },
    { id:7,  project:FLAGSHIP, desc:"Data migration strategy", type:"Risk", prob:"Medium", impact:"Medium", action:"Slightly behind schedule; fast-tracking stakeholder engagement to formalize strategy and plan.", by:"Client / Vendor", date:"31-Mar-22", status:"Open" },
    { id:8,  project:FLAGSHIP, desc:"Training & rollout strategy and plan", type:"Risk", prob:"Medium", impact:"Medium", action:"Slightly behind schedule; fast-tracking stakeholder engagement to formalize strategy and plan.", by:"Client / Vendor", date:"31-Mar-22", status:"Open" },
    { id:9,  project:FLAGSHIP, desc:"Software architecture per workstream", type:"Risk", prob:"Medium", impact:"Medium", action:"Core platform supports a microservices approach; architecture for each workstream still needs to be finalized with the client.", by:"Client / Vendor", date:"1-Aug-22", status:"Open" },
    { id:10, project:FLAGSHIP, desc:"CI/CD pipelining", type:"Risk", prob:"Medium", impact:"Medium", action:"Implementation of CI/CD in progress to enable automated deployment.", by:"Client", date:"1-Aug-22", status:"Open" },
    { id:11, project:FLAGSHIP, desc:"Stress testing", type:"Risk", prob:"Medium", impact:"Medium", action:"Approach needs finalizing so application performance can be validated ahead of production deployment.", by:"Client", date:"1-Aug-22", status:"Open" },
    { id:12, project:FLAGSHIP, desc:"Scope creep across workstreams", type:"Risk", prob:"Medium", impact:"Medium", action:"Additional requirements identified across workstreams during UAT; being centrally logged and managed by the core team rather than absorbed silently.", by:"Client", date:"1-Aug-22", status:"Open" },
    { id:13, project:FLAGSHIP, desc:"SDK limitations for a responsive onboarding app", type:"Risk", prob:"Medium", impact:"High", action:"The onboarding solution's web-responsive approach introduced challenges accessing device-native biometric and camera hardware on tablets.", by:"Client", date:"23-Aug-22", status:"Open" },
    { id:14, project:FLAGSHIP, desc:"UAT timeline slippage", type:"Risk", prob:"Medium", impact:"Medium", action:"UAT start delayed due to stakeholder availability; original start date pushed back roughly one week.", by:"Client", date:"5-Sep-22", status:"Open" }
  ];

  var SEED_DECISIONS = [
    { id:1,  project:FLAGSHIP, point:"Hardware sizing", owner:"Core Platform Vendor", comments:"Hardware sizing concluded with the client team; current hardware confirmed sufficient for the application, including test environments.", date:"10-Mar-22", status:"Closed" },
    { id:2,  project:FLAGSHIP, point:"Test environment / API access to vendor dev cloud", owner:"Client (InfoSec)", comments:"InfoSec requires data masking before approval. Site-to-site VPN request submitted for dev environment API access.", date:"", status:"Open" },
    { id:3,  project:FLAGSHIP, point:"Active-Active architecture", owner:"Core Platform Vendor", comments:"Two application and fabric deployments across separate locations to enable active-active at the application layer.", date:"10-Mar-22", status:"Closed" },
    { id:4,  project:FLAGSHIP, point:"Prioritization and delivery of backend APIs", owner:"Client / Vendor", comments:"Discussion underway to align on API delivery priority order.", date:"", status:"Open" },
    { id:5,  project:FLAGSHIP, point:"Tooling selection and implementation", owner:"Client", comments:"Tool list finalized; procurement to be initiated by the client where applicable.", date:"", status:"Open" },
    { id:6,  project:FLAGSHIP, point:"Identity management for external customers", owner:"Client", comments:"Client to confirm whether to use the platform's built-in identity module or a third-party provider for consumer-facing apps.", date:"", status:"Open" },
    { id:7,  project:FLAGSHIP, point:"SSO for back-office users", owner:"Core Platform Vendor", comments:"SSO to be used as identity broker with the client's directory service; customization handled by the delivery vendor with no timeline impact.", date:"11-Mar-22", status:"Closed" },
    { id:8,  project:FLAGSHIP, point:"Master app scope (retail + omni-channel)", owner:"Client Steering Committee", comments:"Decided at steering committee review.", date:"7-Sep-21", status:"Closed" },
    { id:9,  project:FLAGSHIP, point:"Branchless additional sales app", owner:"Client Steering Committee", comments:"Decided at steering committee review.", date:"14-Jan-22", status:"Closed" },
    { id:10, project:FLAGSHIP, point:"OCR approach", owner:"Client Steering Committee", comments:"Decided at steering committee review.", date:"25-Feb-22", status:"Closed" },
    { id:11, project:FLAGSHIP, point:"Tablet vs. responsive web for onboarding", owner:"Client", comments:"Client accepted the web-based approach for tablet onboarding, conditional on smooth customer experience, biometric verification support, rooted-device detection, and reliable image capture.", date:"13-May-22", status:"Closed" },
    { id:12, project:FLAGSHIP, point:"Core transaction engine scope", owner:"Client", comments:"Core engine to handle all transactions going forward; general ledger entries forwarded to the client's core banking system.", date:"10-May-22", status:"Closed" },
    { id:13, project:FLAGSHIP, point:"Development code access for client resources", owner:"Client", comments:"Client resources granted the same code access as the delivery vendor's development team, in line with a one-team delivery model.", date:"3-Jul-22", status:"Closed" },
    { id:14, project:FLAGSHIP, point:"Architecture finalization", owner:"Client / Core Platform Vendor / Delivery Vendor", comments:"Architecture submitted by the platform vendor; a joint technical review is still required to formally close this item.", date:"", status:"Open" },
    { id:15, project:FLAGSHIP, point:"Multi-factor authentication approach", owner:"Client", comments:"To be presented at the technical review committee, since it falls outside current scope; design vs. MFA trade-off needs sign-off.", date:"7-Jul-22", status:"Closed" }
  ];

  // --- Resource roster: named leads plus a few shared delivery pools.
  //     "capacity" is weekly hours available for project work. ---
  var SEED_RESOURCES = [
    { name:"Michael Turner",             role:"Delivery Lead", capacity:40 },
    { name:"James Carter",                role:"Delivery Lead", capacity:40 },
    { name:"David Bennett",               role:"Delivery Lead", capacity:40 },
    { name:"Emily Watson",                role:"Delivery Lead", capacity:40 },
    { name:"Robert Hughes",               role:"Delivery Lead", capacity:40 },
    { name:"Daniel Foster",               role:"Delivery Lead", capacity:40 },
    { name:"Data & Integrations Team",    role:"Shared Pool",   capacity:60 },
    { name:"Digital Platforms Team",      role:"Shared Pool",   capacity:60 },
    { name:"Reporting Team",              role:"Shared Pool",   capacity:40 }
  ];

  // --- Allocations: weekly hours each resource is committed to a
  //     project. Only projects in the "active" portfolio section
  //     count toward demand (see getCapacityView below). ---
  var SEED_ALLOCATIONS = [
    { project:"P2606-01", resource:"Michael Turner",          hours:22 },
    { project:"P2606-01", resource:"Data & Integrations Team", hours:30 },
    { project:"P2607-02", resource:"James Carter",            hours:26 },
    { project:"P2607-02", resource:"Digital Platforms Team",  hours:34 },
    { project:"P2607-02", resource:"David Bennett",           hours:18 },
    { project:"P2608-03", resource:"David Bennett",           hours:30 },
    { project:"P2608-03", resource:"Reporting Team",          hours:22 },
    { project:"P2608-04", resource:"Emily Watson",            hours:18 },
    { project:"P2608-04", resource:"Data & Integrations Team", hours:14 },
    { project:"P2607-05", resource:"Robert Hughes",           hours:6  },
    { project:"P2609-06", resource:"Daniel Foster",           hours:8  }
  ];

  // --- Financial metrics, keyed by project code. This is the single
  //     source of truth for a project's money figures. Every code here
  //     exists in SEED_PORTFOLIO, so each record joins to a real project.
  //     budget / spent / etc are first-class fields here (not duplicated
  //     as strings on the scorecard) -- the Scorecard's Financials panel
  //     and the Project Financials page both read and write this same
  //     record, so the two can never drift apart. Scalars are the latest
  //     (q4) values; the trend arrays end exactly at each scalar so the
  //     sparkline and the headline number always agree. categories[].
  //     costReduction sums to the record's costReduction (feeds the
  //     donut); suppliers[] sum to <= costReduction (feeds the Top-5
  //     table). ---
  var SEED_FINANCIALS = {
    "P2606-01": {
      budget:180000, spent:96000, etc:75000,
      costOfPurchase:60000, costReduction:18000, costSaving:12000, costAvoidance:8300,
      procurementCost:60000, procurementReturn:78000,
      categories: [
        { name:"Software Licenses", costReduction:7000, savingsPct:34, avoidancePct:22, roiPct:40 },
        { name:"Integration & Dev", costReduction:5000, savingsPct:28, avoidancePct:18, roiPct:33 },
        { name:"Infrastructure", costReduction:3500, savingsPct:24, avoidancePct:15, roiPct:30 },
        { name:"Vendor Services", costReduction:2500, savingsPct:20, avoidancePct:12, roiPct:25 }
      ],
      suppliers: [
        { name:"Nimbus Cloud Services", costReduction:6500 },
        { name:"Datalink Integrators", costReduction:5200 },
        { name:"TaxLogic Systems", costReduction:3100 }
      ],
      trend: {
        costOfPurchase:[33000,43200,52800,60000],
        costReduction:[9900,12960,15840,18000],
        costSaving:[6600,8640,10560,12000],
        costAvoidance:[4565,5976,7304,8300],
        procurementCost:[33000,43200,52800,60000],
        procurementReturn:[42900,56160,68640,78000]
      }
    },
    "P2607-02": {
      budget:135000, spent:72000, etc:56000,
      costOfPurchase:45000, costReduction:12500, costSaving:8000, costAvoidance:5400,
      procurementCost:45000, procurementReturn:56000,
      categories: [
        { name:"Software Licenses", costReduction:4500, savingsPct:44, avoidancePct:24, roiPct:38 },
        { name:"Integration & Dev", costReduction:4000, savingsPct:30, avoidancePct:20, roiPct:30 },
        { name:"Vendor Services", costReduction:4000, savingsPct:26, avoidancePct:16, roiPct:26 }
      ],
      suppliers: [
        { name:"Brightpath Software", costReduction:5000 },
        { name:"Datalink Integrators", costReduction:3800 },
        { name:"Optima Vendor Group", costReduction:2400 }
      ],
      trend: {
        costOfPurchase:[27000,33300,40500,45000],
        costReduction:[7500,9250,11250,12500],
        costSaving:[4800,5920,7200,8000],
        costAvoidance:[3240,3996,4860,5400],
        procurementCost:[27000,33300,40500,45000],
        procurementReturn:[33600,41440,50400,56000]
      }
    },
    "P2608-03": {
      budget:84000, spent:45000, etc:35000,
      costOfPurchase:28000, costReduction:6000, costSaving:3500, costAvoidance:2600,
      procurementCost:28000, procurementReturn:32000,
      categories: [
        { name:"Integration & Dev", costReduction:3500, savingsPct:26, avoidancePct:16, roiPct:22 },
        { name:"Vendor Services", costReduction:2500, savingsPct:22, avoidancePct:12, roiPct:18 }
      ],
      suppliers: [
        { name:"Meridian Consulting", costReduction:3300 },
        { name:"TaxLogic Systems", costReduction:1900 }
      ],
      trend: {
        costOfPurchase:[14560,19600,24080,28000],
        costReduction:[3120,4200,5160,6000],
        costSaving:[1820,2450,3010,3500],
        costAvoidance:[1352,1820,2236,2600],
        procurementCost:[14560,19600,24080,28000],
        procurementReturn:[16640,22400,27520,32000]
      }
    },
    "P2608-04": {
      budget:66000, spent:35000, etc:27000,
      costOfPurchase:22000, costReduction:4200, costSaving:2500, costAvoidance:1800,
      procurementCost:22000, procurementReturn:25000,
      categories: [
        { name:"Integration & Dev", costReduction:2400, savingsPct:24, avoidancePct:15, roiPct:22 },
        { name:"Infrastructure", costReduction:1800, savingsPct:20, avoidancePct:12, roiPct:18 }
      ],
      suppliers: [
        { name:"Datalink Integrators", costReduction:2300 },
        { name:"CoreServe Infra", costReduction:1400 }
      ],
      trend: {
        costOfPurchase:[12760,17160,20020,22000],
        costReduction:[2436,3276,3822,4200],
        costSaving:[1450,1950,2275,2500],
        costAvoidance:[1044,1404,1638,1800],
        procurementCost:[12760,17160,20020,22000],
        procurementReturn:[14500,19500,22750,25000]
      }
    },
    "P2607-05": {
      budget:27000, spent:14000, etc:11000,
      costOfPurchase:9000, costReduction:1500, costSaving:800, costAvoidance:600,
      procurementCost:9000, procurementReturn:9800,
      categories: [
        { name:"Vendor Services", costReduction:900, savingsPct:16, avoidancePct:10, roiPct:14 },
        { name:"Infrastructure", costReduction:600, savingsPct:14, avoidancePct:8, roiPct:12 }
      ],
      suppliers: [
        { name:"Optima Vendor Group", costReduction:900 },
        { name:"CoreServe Infra", costReduction:500 }
      ],
      trend: {
        costOfPurchase:[4500,6120,7560,9000],
        costReduction:[750,1020,1260,1500],
        costSaving:[400,544,672,800],
        costAvoidance:[300,408,504,600],
        procurementCost:[4500,6120,7560,9000],
        procurementReturn:[4900,6664,8232,9800]
      }
    },
    "P2609-06": {
      budget:0, spent:0, etc:0,
      costOfPurchase:0, costReduction:0, costSaving:0, costAvoidance:0,
      procurementCost:0, procurementReturn:0,
      categories: [],
      suppliers: [],
      trend: {
        costOfPurchase:[0,0,0,0],
        costReduction:[0,0,0,0],
        costSaving:[0,0,0,0],
        costAvoidance:[0,0,0,0],
        procurementCost:[0,0,0,0],
        procurementReturn:[0,0,0,0]
      }
    },
    "P2601-07": {
      budget:150000, spent:150000, etc:0,
      costOfPurchase:52000, costReduction:16000, costSaving:11000, costAvoidance:7200,
      procurementCost:52000, procurementReturn:71000,
      categories: [
        { name:"Software Licenses", costReduction:6000, savingsPct:40, avoidancePct:24, roiPct:40 },
        { name:"Integration & Dev", costReduction:5500, savingsPct:32, avoidancePct:20, roiPct:34 },
        { name:"Infrastructure", costReduction:4500, savingsPct:28, avoidancePct:16, roiPct:30 }
      ],
      suppliers: [
        { name:"Nimbus Cloud Services", costReduction:7000 },
        { name:"CoreServe Infra", costReduction:4200 },
        { name:"Brightpath Software", costReduction:3300 }
      ],
      trend: {
        costOfPurchase:[32240,41600,48360,52000],
        costReduction:[9920,12800,14880,16000],
        costSaving:[6820,8800,10230,11000],
        costAvoidance:[4464,5760,6696,7200],
        procurementCost:[32240,41600,48360,52000],
        procurementReturn:[44020,56800,66030,71000]
      }
    },
    "P2602-08": {
      budget:110000, spent:110000, etc:0,
      costOfPurchase:38000, costReduction:10500, costSaving:7000, costAvoidance:4800,
      procurementCost:38000, procurementReturn:49000,
      categories: [
        { name:"Software Licenses", costReduction:4000, savingsPct:38, avoidancePct:22, roiPct:36 },
        { name:"Vendor Services", costReduction:3500, savingsPct:28, avoidancePct:16, roiPct:28 },
        { name:"Internal Labor", costReduction:3000, savingsPct:22, avoidancePct:12, roiPct:22 }
      ],
      suppliers: [
        { name:"TaxLogic Systems", costReduction:4500 },
        { name:"Meridian Consulting", costReduction:3200 },
        { name:"Optima Vendor Group", costReduction:2000 }
      ],
      trend: {
        costOfPurchase:[21660,28500,33820,38000],
        costReduction:[5985,7875,9345,10500],
        costSaving:[3990,5250,6230,7000],
        costAvoidance:[2736,3600,4272,4800],
        procurementCost:[21660,28500,33820,38000],
        procurementReturn:[27930,36750,43610,49000]
      }
    }
  };

  // --- Work Breakdown Structure, keyed by project code. Nodes are stored
  //     flat, each carrying a parentId (null = top level). Order in the array
  //     is display order among siblings. Leaf effort (hrs) and percent are
  //     entered; a parent's effort and percent are DERIVED live from its
  //     leaves (see the WBS rollup API), so they are never stored and can't
  //     drift. Only the flagship project ships with a full breakdown; others
  //     start empty and show a "start the breakdown" prompt. ---
  var SEED_WBS = {
    "P2606-01": [
      { id:1,  parentId:null, name:"Planning",  owner:"Michael Turner", start:"15-Jun-26", end:"20-Jul-26", effort:0,   percent:0,   status:"completed" },
      { id:2,  parentId:1,    name:"Requirement gathering sessions",                  owner:"David Bennett",  start:"15-Jun-26", end:"28-Jun-26", effort:40,  percent:100, status:"completed" },
      { id:3,  parentId:1,    name:"Business Requirements (prep, review, sign-off)",  owner:"Michael Turner", start:"1-Jul-26",  end:"20-Jul-26", effort:80,  percent:100, status:"completed" },
      { id:4,  parentId:null, name:"Analysis", owner:"David Bennett",  start:"21-Jul-26", end:"8-Aug-26",  effort:0,   percent:0,   status:"completed" },
      { id:5,  parentId:4,    name:"Functional Requirements (prep, review, sign-off)",owner:"David Bennett",  start:"21-Jul-26", end:"8-Aug-26",  effort:100, percent:100, status:"completed" },
      { id:6,  parentId:null, name:"Build", owner:"Michael Turner", start:"11-Aug-26", end:"12-Sep-26", effort:0,   percent:0,   status:"atRisk" },
      { id:7,  parentId:6,    name:"Billing & reconciliation engine",                 owner:"Michael Turner", start:"11-Aug-26", end:"12-Sep-26", effort:160, percent:80,  status:"onTrack" },
      { id:8,  parentId:6,    name:"OMS \u2194 engine integration",                   owner:"James Carter",   start:"18-Aug-26", end:"12-Sep-26", effort:120, percent:75,  status:"atRisk" },
      { id:9,  parentId:null, name:"Test", owner:"Emily Watson", start:"15-Sep-26", end:"25-Sep-26", effort:0,   percent:0,   status:"onTrack" },
      { id:10, parentId:9,    name:"UAT cycle 1",                                      owner:"Emily Watson",   start:"15-Sep-26", end:"20-Sep-26", effort:60,  percent:40,  status:"onTrack" },
      { id:11, parentId:9,    name:"UAT cycle 2",                                      owner:"Emily Watson",   start:"21-Sep-26", end:"25-Sep-26", effort:60,  percent:20,  status:"onTrack" },
      { id:12, parentId:null, name:"Deploy", owner:"Michael Turner", start:"28-Sep-26", end:"30-Sep-26", effort:0,   percent:0,   status:"notStarted" },
      { id:13, parentId:12,   name:"Go-live & hypercare",                             owner:"Michael Turner", start:"28-Sep-26", end:"30-Sep-26", effort:40,  percent:0,   status:"notStarted" }
    ]
  };

  /* ============================================================
     SEEDING  (runs once; never wipes real submissions)
     ============================================================ */
  function ensureSeed() {
    // Per-key backfill. Each guard writes ONLY when its key is absent, so it
    // never clobbers real data you've entered — and, crucially, seed blocks
    // ADDED in a later version (resources, allocations, financials, ...) still
    // reach existing users whose global "seeded" flag was set on an earlier
    // visit. A key emptied on purpose via the UI is stored as [] (not null),
    // so intentional deletions are respected and never re-seeded.
    if (read(KEYS.register, null) === null)   write(KEYS.register, SEED_REGISTER);
    if (read(KEYS.portfolio, null) === null)  write(KEYS.portfolio, SEED_PORTFOLIO);
    if (read(KEYS.scorecards, null) === null) write(KEYS.scorecards, SEED_SCORECARDS);
    if (read(KEYS.risks, null) === null)      write(KEYS.risks, SEED_RISKS);
    if (read(KEYS.decisions, null) === null)  write(KEYS.decisions, SEED_DECISIONS);
    if (read(KEYS.resources, null) === null)   write(KEYS.resources, SEED_RESOURCES);
    if (read(KEYS.allocations, null) === null) write(KEYS.allocations, SEED_ALLOCATIONS);
    if (read(KEYS.financials, null) === null)  write(KEYS.financials, SEED_FINANCIALS);
    if (read(KEYS.wbs, null) === null)         write(KEYS.wbs, SEED_WBS);
    if (Number(read(KEYS.counter, 0)) < SEED_REGISTER.length) write(KEYS.counter, SEED_REGISTER.length);
    write(KEYS.seeded, true);
  }

  function resetAll() {
    [KEYS.counter, KEYS.register, KEYS.portfolio, KEYS.scorecards, KEYS.risks, KEYS.decisions,
     KEYS.resources, KEYS.allocations, KEYS.financials, KEYS.wbs, KEYS.seeded]
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

  /* ============================================================
     PORTFOLIO WRITE API  (add / edit / delete projects)
     Backs the editable Portfolio Review page. Code is the primary
     key that links a project to its scorecard, so it is set once
     at creation and never changes on edit. Deleting a project also
     drops its scorecard detail so nothing is left orphaned.
     ============================================================ */
  var STATUS_ORDER = ["notStarted", "onTrack", "atRisk", "delayed", "onHold", "completed"];
  function statusList() {
    return STATUS_ORDER.map(function (k) {
      var s = PORTFOLIO_STATUS[k] || {};
      return { value: k, label: s.label || k, dot: s.dot || "dot-grey" };
    });
  }

  var PROJECT_FIELDS = ["code","name","pm","phase","start","end","percent","progress","remarks","status","section","sourceRequestId"];

  function savePortfolio(arr) { return write(KEYS.portfolio, arr); }

  function cleanProject(input) {
    input = input || {};
    var p = {};
    PROJECT_FIELDS.forEach(function (f) {
      p[f] = (input[f] === undefined || input[f] === null) ? "" : input[f];
    });
    ["code","name","pm","phase","start","end","progress","remarks","sourceRequestId"].forEach(function (f) {
      p[f] = String(p[f]).trim();
    });
    var pct = parseInt(p.percent, 10);
    if (isNaN(pct)) pct = 0;
    p.percent = Math.max(0, Math.min(100, pct));
    if (!PORTFOLIO_STATUS[p.status]) p.status = "notStarted";
    p.section = (p.section === "completed") ? "completed" : "active";
    return p;
  }

  function addProject(input) {
    var p = cleanProject(input);
    if (!p.code) return { ok: false, error: "A project code is required." };
    if (!p.name) return { ok: false, error: "A project name is required." };
    var clash = getPortfolio().some(function (x) { return x.code === p.code; });
    if (clash) return { ok: false, error: "Project code \"" + p.code + "\" already exists. Codes must be unique." };
    var arr = getPortfolio();
    arr.push(p);
    if (!savePortfolio(arr)) return { ok: false, error: "Could not save. Browser storage may be full." };
    return { ok: true, project: p };
  }

  function updateProject(code, input) {
    var arr = getPortfolio();
    var idx = -1;
    for (var i = 0; i < arr.length; i++) { if (arr[i].code === code) { idx = i; break; } }
    if (idx === -1) return { ok: false, error: "Project \"" + code + "\" was not found." };
    var merged = cleanProject(assign(arr[idx], input));
    merged.code = code;                 // code is immutable once created
    if (!merged.name) return { ok: false, error: "A project name is required." };
    arr[idx] = merged;
    if (!savePortfolio(arr)) return { ok: false, error: "Could not save. Browser storage may be full." };
    return { ok: true, project: merged };
  }

  function deleteProject(code) {
    var arr = getPortfolio().filter(function (p) { return p.code !== code; });
    if (!savePortfolio(arr)) return { ok: false, error: "Could not save. Browser storage may be full." };
    var sc = read(KEYS.scorecards, {}) || {};
    if (sc && sc[code]) { delete sc[code]; write(KEYS.scorecards, sc); }
    return { ok: true };
  }

  /* Intake -> Portfolio promotion helpers */
  function getPortfolioByRequest(requestId) {
    if (!requestId) return null;
    return getPortfolio().filter(function (p) { return p.sourceRequestId === requestId; })[0] || null;
  }
  function suggestProjectCode() {
    var d = new Date();
    var yy = ("0" + (d.getFullYear() % 100)).slice(-2);
    var mm = ("0" + (d.getMonth() + 1)).slice(-2);
    var prefix = "P" + yy + mm + "-";
    var arr = getPortfolio();
    var codes = arr.map(function (p) { return p.code; });
    var maxSeq = 0;
    arr.forEach(function (p) {
      var m = /-(\d+)\s*$/.exec(p.code || "");
      if (m) { var v = parseInt(m[1], 10); if (!isNaN(v) && v > maxSeq) maxSeq = v; }
    });
    var seq = maxSeq + 1, code;
    do { code = prefix + ("0" + seq).slice(-2); seq++; } while (codes.indexOf(code) !== -1);
    return code;
  }

  /* ============================================================
     RISK / ISSUE + DECISION LOG WRITE API
     Persisted to localStorage; each entry is tagged with a project
     code. Ids are per-log auto-increment and never reused.
     ============================================================ */
  function getRisks()     { var a = read(KEYS.risks, []);     return Array.isArray(a) ? a : []; }
  function getDecisions() { var a = read(KEYS.decisions, []); return Array.isArray(a) ? a : []; }
  function nextId(arr) {
    var max = 0;
    arr.forEach(function (x) { var n = Number(x.id); if (!isNaN(n) && n > max) max = n; });
    return max + 1;
  }
  function normStatus(s) { return String(s).toLowerCase().indexOf("closed") > -1 ? "Closed" : "Open"; }
  function oneOf(v, list, dflt) {
    v = String(v || "").trim();
    for (var i = 0; i < list.length; i++) { if (list[i].toLowerCase() === v.toLowerCase()) return list[i]; }
    return dflt;
  }

  function cleanRisk(input) {
    input = input || {};
    return {
      project: String(input.project || "").trim(),
      desc:    String(input.desc || "").trim(),
      type:    oneOf(input.type, ["Risk","Issue"], "Risk"),
      prob:    oneOf(input.prob, ["Low","Medium","High"], "Medium"),
      impact:  oneOf(input.impact, ["Low","Medium","High"], "Medium"),
      action:  String(input.action || "").trim(),
      by:      String(input.by || "").trim(),
      date:    String(input.date || "").trim(),
      status:  normStatus(input.status)
    };
  }
  function addRisk(input) {
    var r = cleanRisk(input);
    if (!r.desc) return { ok:false, error:"A description is required." };
    var arr = getRisks();
    r.id = nextId(arr);
    arr.push(r);
    if (!write(KEYS.risks, arr)) return { ok:false, error:"Could not save. Browser storage may be full." };
    return { ok:true, risk:r };
  }
  function updateRisk(id, input) {
    var arr = getRisks(), idx = -1;
    for (var i = 0; i < arr.length; i++) { if (String(arr[i].id) === String(id)) { idx = i; break; } }
    if (idx === -1) return { ok:false, error:"Risk not found." };
    var merged = cleanRisk(assign(arr[idx], input));
    if (!merged.desc) return { ok:false, error:"A description is required." };
    merged.id = arr[idx].id;
    arr[idx] = merged;
    if (!write(KEYS.risks, arr)) return { ok:false, error:"Could not save. Browser storage may be full." };
    return { ok:true, risk:merged };
  }
  function setRiskStatus(id, status) { return updateRisk(id, { status: status }); }
  function deleteRisk(id) {
    var arr = getRisks().filter(function (x) { return String(x.id) !== String(id); });
    if (!write(KEYS.risks, arr)) return { ok:false, error:"Could not save." };
    return { ok:true };
  }

  function cleanDecision(input) {
    input = input || {};
    return {
      project:  String(input.project || "").trim(),
      point:    String(input.point || "").trim(),
      owner:    String(input.owner || "").trim(),
      comments: String(input.comments || "").trim(),
      date:     String(input.date || "").trim(),
      status:   normStatus(input.status)
    };
  }
  function addDecision(input) {
    var d = cleanDecision(input);
    if (!d.point) return { ok:false, error:"A decision point is required." };
    var arr = getDecisions();
    d.id = nextId(arr);
    arr.push(d);
    if (!write(KEYS.decisions, arr)) return { ok:false, error:"Could not save. Browser storage may be full." };
    return { ok:true, decision:d };
  }
  function updateDecision(id, input) {
    var arr = getDecisions(), idx = -1;
    for (var i = 0; i < arr.length; i++) { if (String(arr[i].id) === String(id)) { idx = i; break; } }
    if (idx === -1) return { ok:false, error:"Decision not found." };
    var merged = cleanDecision(assign(arr[idx], input));
    if (!merged.point) return { ok:false, error:"A decision point is required." };
    merged.id = arr[idx].id;
    arr[idx] = merged;
    if (!write(KEYS.decisions, arr)) return { ok:false, error:"Could not save. Browser storage may be full." };
    return { ok:true, decision:merged };
  }
  function setDecisionStatus(id, status) { return updateDecision(id, { status: status }); }
  function deleteDecision(id) {
    var arr = getDecisions().filter(function (x) { return String(x.id) !== String(id); });
    if (!write(KEYS.decisions, arr)) return { ok:false, error:"Could not save." };
    return { ok:true };
  }

  /* ============================================================
     DASHBOARD ROLLUP  (Home page KPI tiles)
     ------------------------------------------------------------
     Pure read-side aggregation over the same four stores used
     elsewhere (portfolio, register, risks). Nothing here writes
     data; it just summarizes what's already there so the home
     page can show live counts instead of static copy.
     ============================================================ */

  // "D-Mon-YY" (e.g. "30-Sep-26") -> Date, or null if not a real date
  // (handles blanks and placeholders like "TBD" the same way: no date).
  function parseDMY(s) {
    s = String(s || "").trim();
    var m = /^(\d{1,2})-([A-Za-z]{3})-(\d{2})$/.exec(s);
    if (!m) return null;
    var monIdx = MONTHS.indexOf(m[2].charAt(0).toUpperCase() + m[2].slice(1).toLowerCase());
    if (monIdx === -1) return null;
    var d = new Date(2000 + parseInt(m[3], 10), monIdx, parseInt(m[1], 10));
    return isNaN(d.getTime()) ? null : d;
  }

  function getDashboardStats() {
    var portfolio = getPortfolio();
    var register  = getRegister();
    var risks     = getRisks();
    var now = new Date();
    now.setHours(0, 0, 0, 0);

    // --- Projects by status (same order/colors as the shared legend) ---
    var counts = {};
    STATUS_ORDER.forEach(function (k) { counts[k] = 0; });
    portfolio.forEach(function (p) {
      counts[p.status] = (counts[p.status] || 0) + 1;
    });
    var statusBreakdown = statusList().map(function (s) {
      return { value: s.value, label: s.label, dot: s.dot, count: counts[s.value] || 0 };
    });

    // --- Open risks & issues ---
    var openRisks  = risks.filter(function (r) { return r.status === "Open" && r.type === "Risk"; }).length;
    var openIssues = risks.filter(function (r) { return r.status === "Open" && r.type === "Issue"; }).length;

    // --- Pending intakes: anything not yet decided either way ---
    var pending = register.filter(function (r) {
      var label = intakeStatus(r.status).label;
      return label !== "Approved" && label !== "Rejected";
    });

    // --- Overdue: active (not completed, not on hold) projects whose
    //     end date is a real, parseable date that has already passed ---
    var overdueProjects = portfolio.filter(function (p) {
      if (p.section === "completed" || p.status === "onHold") return false;
      var end = parseDMY(p.end);
      return end !== null && end < now;
    });

    return {
      statusBreakdown: statusBreakdown,
      totalActive:    portfolio.filter(function (p) { return p.section === "active"; }).length,
      totalCompleted: portfolio.filter(function (p) { return p.section === "completed"; }).length,
      openRisks:       openRisks,
      openIssues:      openIssues,
      openRisksTotal:  openRisks + openIssues,
      pendingIntakes:  pending.length,
      overdueProjects: overdueProjects,
      overdueCount:    overdueProjects.length
    };
  }

  /* ============================================================
     PROJECT LINKAGE  (risks, decisions, change requests -> project)
     ------------------------------------------------------------
     Risks and decisions already carry a `project` code (set from
     the Add/Edit modals on the Risk & Decision Log page). Change
     Requests are logged by the CIF form under its own key
     (kept as-is, since that form owns its own CSV export flow);
     this section just gives the rest of the app a read-only way
     to pull that same data by project code, so one project's
     full governance picture — risks, decisions, and change
     requests — can be viewed together.
     ============================================================ */
  var CIF_LOG_KEY = "cifSubmissionsLog";

  function getChangeRequests() {
    var arr = read(CIF_LOG_KEY, []);
    return Array.isArray(arr) ? arr : [];
  }
  function byProject(arr, code, field) {
    code = String(code || "");
    return arr.filter(function (x) { return String(x[field] || "") === code; });
  }
  function getRisksByProject(code)          { return byProject(getRisks(), code, "project"); }
  function getDecisionsByProject(code)      { return byProject(getDecisions(), code, "project"); }
  function getChangeRequestsByProject(code) { return byProject(getChangeRequests(), code, "projectCode"); }

  // CIFs have no single "status" the way risks/decisions do: they're
  // "open" (not yet implemented) until Part D's implementation status
  // is recorded as Successful or Rollback.
  function isCrOpen(c) { return !c.implStatus; }

  // Every project code that shows up anywhere (portfolio, or tagged on
  // a risk/decision/CIF even if that project isn't in the portfolio),
  // for building "by project" filter dropdowns consistently.
  function allProjectCodesInUse() {
    var set = {};
    getPortfolio().forEach(function (p) { if (p.code) set[p.code] = true; });
    getRisks().forEach(function (r) { if (r.project) set[r.project] = true; });
    getDecisions().forEach(function (d) { if (d.project) set[d.project] = true; });
    getChangeRequests().forEach(function (c) { if (c.projectCode) set[c.projectCode] = true; });
    return Object.keys(set).sort();
  }

  /* ============================================================
     RESOURCE CAPACITY vs. DEMAND  (lightweight, read-only)
     ------------------------------------------------------------
     Weekly hours only. Demand is summed only from allocations
     tagged to a project in the "active" portfolio section, so a
     completed or removed project stops counting automatically.
     Bands: <70% capacity free, 70-100% fully loaded, >100% over-
     allocated. This is intentionally simple for a demo, not a
     real resource-management system.
     ============================================================ */
  function getResources()   { var a = read(KEYS.resources, []);   return Array.isArray(a) ? a : []; }
  function getAllocations() { var a = read(KEYS.allocations, []); return Array.isArray(a) ? a : []; }

  function capacityBand(pct) {
    if (pct > 100) return { key:"over",   label:"Over-allocated",   dot:"dot-red" };
    if (pct >= 70)  return { key:"full",   label:"Fully Loaded",     dot:"dot-yellow" };
    return             { key:"available", label:"Capacity Available", dot:"dot-green" };
  }

  function getCapacityView() {
    var resources = getResources();
    var allocations = getAllocations();
    var activeCodes = {};
    getPortfolio().forEach(function (p) { if (p.section === "active") activeCodes[p.code] = p; });

    var byResource = resources.map(function (r) {
      var mine = allocations.filter(function (a) {
        return a.resource === r.name && activeCodes.hasOwnProperty(a.project);
      });
      var demand = mine.reduce(function (sum, a) { return sum + (Number(a.hours) || 0); }, 0);
      var pct = r.capacity > 0 ? Math.round((demand / r.capacity) * 100) : 0;
      return {
        name: r.name,
        role: r.role,
        capacity: r.capacity,
        demand: demand,
        pct: pct,
        band: capacityBand(pct),
        allocations: mine.map(function (a) {
          var p = activeCodes[a.project];
          return { project: a.project, projectName: p ? p.name : a.project, hours: Number(a.hours) || 0 };
        }).sort(function (x, y) { return y.hours - x.hours; })
      };
    }).sort(function (x, y) { return y.pct - x.pct; });

    var byProject = Object.keys(activeCodes).map(function (code) {
      var p = activeCodes[code];
      var mine = allocations.filter(function (a) { return a.project === code; });
      var demand = mine.reduce(function (sum, a) { return sum + (Number(a.hours) || 0); }, 0);
      return {
        code: code,
        name: p.name,
        status: p.status,
        demand: demand,
        allocations: mine.map(function (a) {
          return { resource: a.resource, hours: Number(a.hours) || 0 };
        }).sort(function (x, y) { return y.hours - x.hours; })
      };
    }).sort(function (x, y) { return y.demand - x.demand; });

    return {
      byResource: byResource,
      byProject: byProject,
      overCount:     byResource.filter(function (r) { return r.band.key === "over"; }).length,
      fullCount:     byResource.filter(function (r) { return r.band.key === "full"; }).length,
      availableCount:byResource.filter(function (r) { return r.band.key === "available"; }).length
    };
  }

  /* ============================================================
     FINANCIAL METRICS  (lightweight, read-only, additive)
     ------------------------------------------------------------
     Per-project records live under KEYS.financials, keyed by the
     same project `code` used everywhere else. getFinancials(code)
     returns one raw record; getAllFinancials() rolls the records
     up over the CURRENT portfolio (so an added/removed project is
     reflected automatically, exactly like the capacity view).

     Consistency by construction (seeded and preserved on rollup):
       - donut segments sum to each record's costReduction
       - supplier contributions sum to <= costReduction
       - a metric's headline == the last (q4) point of its trend
       - Procurement ROI is DERIVED from cost & return, never stored
         as a free-floating figure
     budget / spent / etc live on this same record (see the write API
     below), so the Scorecard's Financials panel and this page can
     never disagree -- there is only one number to edit.
     ============================================================ */
  var FIN_METRICS = ["costOfPurchase","costReduction","costSaving","costAvoidance","procurementCost","procurementReturn"];

  function getFinancials(code) {
    var all = read(KEYS.financials, {}) || {};
    return all[code] || null;
  }

  function roiPct(ret, cost) {
    ret = Number(ret) || 0; cost = Number(cost) || 0;
    return cost > 0 ? ((ret - cost) / cost * 100) : 0;
  }

  function getAllFinancials() {
    var all = read(KEYS.financials, {}) || {};
    var portfolio = getPortfolio();

    var totals = {};  FIN_METRICS.forEach(function (m) { totals[m] = 0; });
    var qTot   = {};  FIN_METRICS.forEach(function (m) { qTot[m] = [0,0,0,0]; });
    var catRed = {};              // category -> summed costReduction (donut)
    var catRate = {};             // category -> costReduction-weighted rate accumulators
    var supRoll = {};             // supplier -> summed costReduction
    var perProject = [];

    portfolio.forEach(function (p) {
      var r = all[p.code];
      if (!r) return;
      FIN_METRICS.forEach(function (m) {
        totals[m] += Number(r[m]) || 0;
        var t = (r.trend && r.trend[m]) || [0,0,0,0];
        for (var i = 0; i < 4; i++) qTot[m][i] += Number(t[i]) || 0;
      });
      (r.categories || []).forEach(function (c) {
        var w = Number(c.costReduction) || 0;
        catRed[c.name] = (catRed[c.name] || 0) + w;
        if (!catRate[c.name]) catRate[c.name] = { s:0, a:0, roi:0, w:0 };
        catRate[c.name].s   += (Number(c.savingsPct)   || 0) * w;
        catRate[c.name].a   += (Number(c.avoidancePct) || 0) * w;
        catRate[c.name].roi += (Number(c.roiPct)       || 0) * w;
        catRate[c.name].w   += w;
      });
      (r.suppliers || []).forEach(function (s) {
        supRoll[s.name] = (supRoll[s.name] || 0) + (Number(s.costReduction) || 0);
      });
      perProject.push({
        code: p.code, name: p.name, status: p.status, section: p.section,
        budget: Number(r.budget) || 0,
        spent:  Number(r.spent)  || 0,
        etc:    Number(r.etc)    || 0,
        costOfPurchase: Number(r.costOfPurchase) || 0,
        costReduction:  Number(r.costReduction)  || 0,
        costSaving:     Number(r.costSaving)     || 0,
        costAvoidance:  Number(r.costAvoidance)  || 0,
        procurementCost:   Number(r.procurementCost)   || 0,
        procurementReturn: Number(r.procurementReturn) || 0,
        roiPct: roiPct(r.procurementReturn, r.procurementCost)
      });
    });

    var donut = Object.keys(catRed).map(function (k) { return { name:k, value:catRed[k] }; })
      .sort(function (a, b) { return b.value - a.value; });

    var categoryRates = Object.keys(catRate).map(function (k) {
      var acc = catRate[k], w = acc.w || 1;
      return { name:k, savingsPct:Math.round(acc.s/w), avoidancePct:Math.round(acc.a/w), roiPct:Math.round(acc.roi/w), weight:acc.w };
    }).sort(function (a, b) { return b.savingsPct - a.savingsPct; });

    var suppliers = Object.keys(supRoll).map(function (k) { return { name:k, costReduction:supRoll[k] }; })
      .sort(function (a, b) { return b.costReduction - a.costReduction; });

    return {
      perProject: perProject,
      count: perProject.length,
      totals: totals,
      roiPct: roiPct(totals.procurementReturn, totals.procurementCost),
      trend: {
        costOfPurchase: qTot.costOfPurchase,
        costReduction:  qTot.costReduction,
        costSaving:     qTot.costSaving,
        costAvoidance:  qTot.costAvoidance,
        procurementROI: [0,1,2,3].map(function (i) { return roiPct(qTot.procurementReturn[i], qTot.procurementCost[i]); })
      },
      donut: donut,
      categoryRates: categoryRates,
      suppliers: suppliers,
      topSuppliers: suppliers.slice(0, 5)
    };
  }

  /* ============================================================
     FINANCIAL METRICS — WRITE API  (backs the Project Financials page)
     ------------------------------------------------------------
     Enforces the same invariants the seed guarantees, so provenance
     survives human edits:
       - costReduction is DERIVED (sum of the category rows), never typed
       - procurementCost is tied to costOfPurchase (as in the seed)
       - each metric's 4-quarter trend is regenerated to end exactly on
         its headline, so sparkline and headline never disagree
       - supplier attribution may not exceed the derived costReduction
     budget / spent / etc are saved on this same record. The Scorecard
     reads them straight from here (PPS.getFinancials), so editing them
     on this page is the only way to change them and both pages always
     agree -- there is no separate scorecard copy left to drift.
     Records are keyed by project code (must be a real portfolio code).
     ============================================================ */
  var FIN_CATEGORY_LIST = ["Software Licenses", "Integration & Dev", "Infrastructure", "Vendor Services", "Internal Labor"];
  function finNum(v)   { var n = parseFloat(String(v == null ? "" : v).replace(/[^0-9.\-]/g, "")); return isNaN(n) ? 0 : n; }
  function finMoney(v) { return Math.max(0, Math.round(finNum(v))); }
  function finPct(v)   { return Math.max(0, Math.min(100, Math.round(finNum(v)))); }
  function finCap(v)   { return Math.max(0, Math.min(400, Math.round(finNum(v)))); }

  var RAMP = [[0.55,0.72,0.88],[0.60,0.74,0.90],[0.52,0.70,0.86],[0.58,0.78,0.91],
              [0.50,0.68,0.84],[0.62,0.80,0.93],[0.57,0.75,0.89],[0.54,0.71,0.87]];
  function rampSeries(scalar, idx) {
    scalar = Number(scalar) || 0;
    if (!scalar) return [0, 0, 0, 0];
    var f = RAMP[((idx >= 0 ? idx : 0) % RAMP.length)];
    return [Math.round(scalar * f[0]), Math.round(scalar * f[1]), Math.round(scalar * f[2]), scalar];
  }
  function portfolioIndex(code) {
    var arr = getPortfolio();
    for (var i = 0; i < arr.length; i++) { if (arr[i].code === code) return i; }
    return 0;
  }
  function financialCategoryList() { return FIN_CATEGORY_LIST.slice(); }

  function cleanFinancials(input, idx) {
    input = input || {};
    var cats = (input.categories || []).map(function (c) {
      return { name:String(c.name || "").trim(), costReduction:finMoney(c.costReduction),
               savingsPct:finPct(c.savingsPct), avoidancePct:finPct(c.avoidancePct), roiPct:finPct(c.roiPct) };
    }).filter(function (c) { return c.name; });
    var sups = (input.suppliers || []).map(function (s) {
      return { name:String(s.name || "").trim(), costReduction:finMoney(s.costReduction) };
    }).filter(function (s) { return s.name; });

    var costOfPurchase = finMoney(input.costOfPurchase);
    var costReduction = cats.reduce(function (a, c) { return a + c.costReduction; }, 0);  // derived
    var rec = {
      budget: finMoney(input.budget),
      spent: finMoney(input.spent),
      etc: finMoney(input.etc),
      costOfPurchase: costOfPurchase,
      costReduction: costReduction,
      costSaving: finMoney(input.costSaving),
      costAvoidance: finMoney(input.costAvoidance),
      procurementCost: costOfPurchase,            // tied to purchase, matching the seed
      procurementReturn: finMoney(input.procurementReturn),
      categories: cats,
      suppliers: sups,
      trend: {}
    };
    FIN_METRICS.forEach(function (m) { rec.trend[m] = rampSeries(rec[m], idx); });
    return rec;
  }

  function saveFinancials(code, input) {
    code = String(code || "").trim();
    if (!code) return { ok:false, error:"A project must be selected." };
    var rec = cleanFinancials(input, portfolioIndex(code));
    var supSum = rec.suppliers.reduce(function (a, s) { return a + s.costReduction; }, 0);
    if (supSum > rec.costReduction) {
      return { ok:false, error:"Supplier cost reduction ($" + supSum.toLocaleString() +
        ") exceeds the total from categories ($" + rec.costReduction.toLocaleString() +
        "). Lower a supplier figure or raise a category reduction." };
    }
    var all = read(KEYS.financials, {}) || {};
    all[code] = rec;
    if (!write(KEYS.financials, all)) return { ok:false, error:"Could not save. Browser storage may be full." };
    return { ok:true, financials:rec };
  }
  function deleteFinancials(code) {
    var all = read(KEYS.financials, {}) || {};
    if (all[code]) { delete all[code]; if (!write(KEYS.financials, all)) return { ok:false, error:"Could not save." }; }
    return { ok:true };
  }

  /* ============================================================
     RESOURCES + ALLOCATIONS — WRITE API  (backs Resource Management)
     ------------------------------------------------------------
     Resources are identified by name (the same key allocations join
     on). Renaming a resource cascades into its allocations; deleting
     a resource removes its allocations so nothing is orphaned. An
     allocation is unique per (project, resource) pair.
     ============================================================ */
  function saveResources(arr)   { return write(KEYS.resources, arr); }
  function saveAllocations(arr)  { return write(KEYS.allocations, arr); }

  function cleanResource(input) {
    input = input || {};
    return { name:String(input.name || "").trim(), role:String(input.role || "").trim() || "Team", capacity:finCap(input.capacity) };
  }
  function addResource(input) {
    var r = cleanResource(input);
    if (!r.name) return { ok:false, error:"A resource name is required." };
    var arr = getResources();
    if (arr.some(function (x) { return x.name.toLowerCase() === r.name.toLowerCase(); }))
      return { ok:false, error:"A resource named \"" + r.name + "\" already exists." };
    arr.push(r);
    if (!saveResources(arr)) return { ok:false, error:"Could not save. Browser storage may be full." };
    return { ok:true, resource:r };
  }
  function updateResource(oldName, input) {
    var arr = getResources(), idx = -1;
    for (var i = 0; i < arr.length; i++) { if (arr[i].name === oldName) { idx = i; break; } }
    if (idx === -1) return { ok:false, error:"Resource not found." };
    var r = cleanResource(input);
    if (!r.name) return { ok:false, error:"A resource name is required." };
    if (r.name.toLowerCase() !== oldName.toLowerCase() &&
        arr.some(function (x) { return x.name.toLowerCase() === r.name.toLowerCase(); }))
      return { ok:false, error:"A resource named \"" + r.name + "\" already exists." };
    arr[idx] = r;
    if (!saveResources(arr)) return { ok:false, error:"Could not save." };
    if (r.name !== oldName) {
      var al = getAllocations(), changed = false;
      al.forEach(function (a) { if (a.resource === oldName) { a.resource = r.name; changed = true; } });
      if (changed) saveAllocations(al);
    }
    return { ok:true, resource:r };
  }
  function deleteResource(name) {
    var arr = getResources().filter(function (x) { return x.name !== name; });
    if (!saveResources(arr)) return { ok:false, error:"Could not save." };
    saveAllocations(getAllocations().filter(function (a) { return a.resource !== name; }));
    return { ok:true };
  }

  function cleanAllocation(input) {
    input = input || {};
    return { project:String(input.project || "").trim(), resource:String(input.resource || "").trim(), hours:finCap(input.hours) };
  }
  function addAllocation(input) {
    var a = cleanAllocation(input);
    if (!a.project)  return { ok:false, error:"Choose a project." };
    if (!a.resource) return { ok:false, error:"Choose a resource." };
    var arr = getAllocations();
    if (arr.some(function (x) { return x.project === a.project && x.resource === a.resource; }))
      return { ok:false, error:"That resource is already allocated to that project. Edit the existing row instead." };
    arr.push(a);
    if (!saveAllocations(arr)) return { ok:false, error:"Could not save." };
    return { ok:true, allocation:a };
  }
  function updateAllocation(project, resource, input) {
    var arr = getAllocations(), idx = -1;
    for (var i = 0; i < arr.length; i++) { if (arr[i].project === project && arr[i].resource === resource) { idx = i; break; } }
    if (idx === -1) return { ok:false, error:"Allocation not found." };
    var a = cleanAllocation(input);
    if (!a.project || !a.resource) return { ok:false, error:"Project and resource are required." };
    if ((a.project !== project || a.resource !== resource) &&
        arr.some(function (x) { return x.project === a.project && x.resource === a.resource; }))
      return { ok:false, error:"That resource is already allocated to that project." };
    arr[idx] = a;
    if (!saveAllocations(arr)) return { ok:false, error:"Could not save." };
    return { ok:true, allocation:a };
  }
  function deleteAllocation(project, resource) {
    saveAllocations(getAllocations().filter(function (a) { return !(a.project === project && a.resource === resource); }));
    return { ok:true };
  }

  function getProjectGovernance(code) {
    var risks = getRisksByProject(code);
    var decisions = getDecisionsByProject(code);
    var crs = getChangeRequestsByProject(code);
    var finRec = getFinancials(code);
    var capRec = getCapacityView().byProject.filter(function (p) { return p.code === code; })[0] || null;
    return {
      risks: risks,
      decisions: decisions,
      changeRequests: crs,
      openRisks: risks.filter(function (r) { return r.status === "Open"; }).length,
      openDecisions: decisions.filter(function (d) { return d.status === "Open"; }).length,
      openChangeRequests: crs.filter(isCrOpen).length,
      // Added so the Scorecard's linked-records panel can show the same
      // project's procurement/cost-reduction figures (from Project Financials)
      // and weekly resource demand (from Resource Management) alongside its
      // risks, decisions and change requests -- read-only, same shared data.
      financials: finRec,
      financialsRoiPct: finRec ? roiPct(finRec.procurementReturn, finRec.procurementCost) : null,
      capacity: capRec
    };
  }

  /* ============================================================
     WORK BREAKDOWN STRUCTURE (WBS)  — write + rollup API
     ------------------------------------------------------------
     Per-project hierarchical task breakdown, keyed by the same
     project `code` used everywhere else. Nodes are stored flat,
     each with a parentId (null = top level); array order is the
     display order among siblings. The tree, the outline numbers
     (1, 1.1, 1.1.1) and every rolled-up figure are DERIVED live
     from that flat list — a single source of truth with nothing
     to keep in sync.

     Rollup rule (bottom-up, effort-weighted):
       - a LEAF contributes  effort  and  effort * percent/100
       - a PARENT's effort  = sum of its descendant leaves' effort
       - a PARENT's percent = effort-weighted completion of them
       - the PROJECT figure treats the top-level nodes as the
         children of a virtual root
     Leaf effort/percent are entered; parent effort/percent are
     computed and never stored, so the two can never disagree.
     ============================================================ */
  function getWbsMap() { return read(KEYS.wbs, {}) || {}; }
  function getWbs(code) {
    var arr = getWbsMap()[String(code || "")];
    return Array.isArray(arr) ? arr : [];
  }
  function saveWbs(code, arr) {
    var all = getWbsMap();
    all[String(code || "")] = arr;
    return write(KEYS.wbs, all);
  }
  function wbsNextId(arr) {
    var max = 0;
    arr.forEach(function (n) { var v = Number(n.id); if (!isNaN(v) && v > max) max = v; });
    return max + 1;
  }
  function cleanWbsNode(input) {
    input = input || {};
    var pct = parseInt(input.percent, 10); if (isNaN(pct)) pct = 0;
    var eff = parseInt(input.effort, 10);  if (isNaN(eff)) eff = 0;
    var pid = (input.parentId === undefined || input.parentId === null || input.parentId === "")
                ? null : Number(input.parentId);
    if (isNaN(pid)) pid = null;
    return {
      name:     String(input.name || "").trim(),
      owner:    String(input.owner || "").trim(),
      start:    String(input.start || "").trim(),
      end:      String(input.end || "").trim(),
      effort:   Math.max(0, eff),
      percent:  Math.max(0, Math.min(100, pct)),
      status:   PORTFOLIO_STATUS[input.status] ? input.status : "notStarted",
      parentId: pid
    };
  }
  function addWbsNode(code, input) {
    code = String(code || "").trim();
    if (!code) return { ok:false, error:"A project must be selected." };
    var node = cleanWbsNode(input);
    if (!node.name) return { ok:false, error:"A task name is required." };
    var arr = getWbs(code);
    if (node.parentId !== null && !arr.some(function (n) { return n.id === node.parentId; }))
      node.parentId = null;                               // orphan guard
    node.id = wbsNextId(arr);
    arr.push(node);
    if (!saveWbs(code, arr)) return { ok:false, error:"Could not save. Browser storage may be full." };
    return { ok:true, node:node };
  }
  function wbsIsAncestor(arr, ancestorId, nodeId) {
    // true if ancestorId sits on nodeId's parent chain (cycle guard)
    var byId = {};
    arr.forEach(function (n) { byId[n.id] = n; });
    var seen = {}, cur = byId[nodeId];
    while (cur && cur.parentId !== null && cur.parentId !== undefined) {
      if (cur.parentId === ancestorId) return true;
      if (seen[cur.parentId]) break;
      seen[cur.parentId] = true;
      cur = byId[cur.parentId];
    }
    return false;
  }
  function updateWbsNode(code, id, input) {
    var arr = getWbs(code), idx = -1;
    for (var i = 0; i < arr.length; i++) { if (String(arr[i].id) === String(id)) { idx = i; break; } }
    if (idx === -1) return { ok:false, error:"Task not found." };
    var merged = cleanWbsNode(assign(arr[idx], input));
    if (!merged.name) return { ok:false, error:"A task name is required." };
    merged.id = arr[idx].id;
    // a node may not become its own parent or a child of its own descendant
    if (merged.parentId !== null &&
        (merged.parentId === merged.id ||
         !arr.some(function (n) { return n.id === merged.parentId; }) ||
         wbsIsAncestor(arr, merged.id, merged.parentId))) {
      merged.parentId = arr[idx].parentId;
    }
    arr[idx] = merged;
    if (!saveWbs(code, arr)) return { ok:false, error:"Could not save. Browser storage may be full." };
    return { ok:true, node:merged };
  }
  function deleteWbsNode(code, id) {
    var arr = getWbs(code);
    var kill = {}; kill[String(id)] = true;
    var changed = true;
    while (changed) {                                     // sweep out descendants too
      changed = false;
      arr.forEach(function (n) {
        if (n.parentId !== null && kill[String(n.parentId)] && !kill[String(n.id)]) {
          kill[String(n.id)] = true; changed = true;
        }
      });
    }
    var next = arr.filter(function (n) { return !kill[String(n.id)]; });
    if (!saveWbs(code, next)) return { ok:false, error:"Could not save." };
    return { ok:true, removed: arr.length - next.length };
  }

  // Ordered, numbered tree with rolled-up effort/percent on every node.
  function getWbsTree(code) {
    var arr = getWbs(code);
    var byParent = {};
    arr.forEach(function (n) {
      var k = (n.parentId === null || n.parentId === undefined) ? "root" : String(n.parentId);
      (byParent[k] = byParent[k] || []).push(n);
    });
    function build(parentKey, prefix, level) {
      return (byParent[parentKey] || []).map(function (n, i) {
        var no = prefix ? prefix + "." + (i + 1) : String(i + 1);
        var kids = build(String(n.id), no, level + 1);
        var isLeaf = kids.length === 0, effort, percent;
        if (isLeaf) {
          effort = Number(n.effort) || 0;
          percent = Number(n.percent) || 0;
        } else {
          effort = kids.reduce(function (a, c) { return a + c.effort; }, 0);
          var done = kids.reduce(function (a, c) { return a + c.effort * (c.percent / 100); }, 0);
          percent = effort > 0 ? Math.round(done / effort * 100)
                    : Math.round(kids.reduce(function (a, c) { return a + c.percent; }, 0) / (kids.length || 1));
        }
        return {
          id:n.id, wbs:no, level:level, name:n.name, owner:n.owner,
          start:n.start, end:n.end, status:n.status,
          effort:effort, percent:percent, isLeaf:isLeaf,
          rawEffort:Number(n.effort) || 0, rawPercent:Number(n.percent) || 0,
          parentId:(n.parentId === undefined ? null : n.parentId),
          children:kids
        };
      });
    }
    return build("root", "", 1);
  }
  // Pre-order flatten of the tree, for straight table rendering.
  function getWbsRows(code) {
    var out = [];
    (function walk(nodes) { nodes.forEach(function (n) { out.push(n); walk(n.children); }); })(getWbsTree(code));
    return out;
  }
  function getWbsRollup(code) {
    var tree = getWbsTree(code);
    var effort = tree.reduce(function (a, n) { return a + n.effort; }, 0);
    var done   = tree.reduce(function (a, n) { return a + n.effort * (n.percent / 100); }, 0);
    var rows = getWbsRows(code);
    var byStatus = {}; STATUS_ORDER.forEach(function (k) { byStatus[k] = 0; });
    rows.forEach(function (n) { if (n.isLeaf) byStatus[n.status] = (byStatus[n.status] || 0) + 1; });
    return {
      packages: rows.filter(function (n) { return n.isLeaf; }).length,
      groups:   rows.filter(function (n) { return !n.isLeaf; }).length,
      nodes:    rows.length,
      effort:   effort,
      percent:  effort > 0 ? Math.round(done / effort * 100)
                : (tree.length ? Math.round(tree.reduce(function (a, n) { return a + n.percent; }, 0) / tree.length) : 0),
      byStatus: byStatus
    };
  }
  // Rollup for every current portfolio project that has a breakdown.
  function getWbsRollupAll() {
    var out = {};
    getPortfolio().forEach(function (p) { if (getWbs(p.code).length) out[p.code] = getWbsRollup(p.code); });
    return out;
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
    statusList: statusList,
    addProject: addProject,
    updateProject: updateProject,
    deleteProject: deleteProject,
    getPortfolioByRequest: getPortfolioByRequest,
    suggestProjectCode: suggestProjectCode,
    getRisks: getRisks,
    addRisk: addRisk,
    updateRisk: updateRisk,
    setRiskStatus: setRiskStatus,
    deleteRisk: deleteRisk,
    getDecisions: getDecisions,
    addDecision: addDecision,
    updateDecision: updateDecision,
    setDecisionStatus: setDecisionStatus,
    deleteDecision: deleteDecision,
    resetAll: resetAll,
    parseDMY: parseDMY,
    getDashboardStats: getDashboardStats,
    getChangeRequests: getChangeRequests,
    getRisksByProject: getRisksByProject,
    getDecisionsByProject: getDecisionsByProject,
    getChangeRequestsByProject: getChangeRequestsByProject,
    isCrOpen: isCrOpen,
    allProjectCodesInUse: allProjectCodesInUse,
    getProjectGovernance: getProjectGovernance,
    getResources: getResources,
    getAllocations: getAllocations,
    getCapacityView: getCapacityView,
    capacityBand: capacityBand,
    getFinancials: getFinancials,
    getAllFinancials: getAllFinancials,
    saveFinancials: saveFinancials,
    deleteFinancials: deleteFinancials,
    financialCategoryList: financialCategoryList,
    addResource: addResource,
    updateResource: updateResource,
    deleteResource: deleteResource,
    addAllocation: addAllocation,
    updateAllocation: updateAllocation,
    deleteAllocation: deleteAllocation,
    getWbs: getWbs,
    getWbsTree: getWbsTree,
    getWbsRows: getWbsRows,
    getWbsRollup: getWbsRollup,
    getWbsRollupAll: getWbsRollupAll,
    addWbsNode: addWbsNode,
    updateWbsNode: updateWbsNode,
    deleteWbsNode: deleteWbsNode,
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

  /* ============================================================
     UNSAVED-CHANGES NAV GUARD
     ------------------------------------------------------------
     Warns before leaving a page that has an edited <form> on it
     (Intake Form and Change Request Form). It fires when the user
     clicks ANY top-nav link, including the dropdown items under
     "Project Intake Process" and "Project Status". Controls that
     sit OUTSIDE a <form> (the scorecard project picker, the
     repository search box, etc.) are view filters, not data, so
     they never trigger the prompt. Same-page and in-page (#) links
     are ignored. Add data-noguard to any link or field to opt out.
     ============================================================ */
  var navDirty = false;

  function isGuardedField(el) {
    if (!el || !el.tagName) return false;
    var tag = el.tagName;
    if (tag !== "INPUT" && tag !== "SELECT" && tag !== "TEXTAREA") return false;
    if (el.disabled || el.readOnly) return false;
    var t = (el.type || "").toLowerCase();
    if (t === "hidden" || t === "button" || t === "submit" || t === "reset") return false;
    if (el.hasAttribute("data-noguard")) return false;
    return !!el.closest("form");            /* only genuine forms count as "changes" */
  }

  document.addEventListener("input", function (e) {
    if (isGuardedField(e.target)) navDirty = true;
  }, true);
  document.addEventListener("change", function (e) {
    if (isGuardedField(e.target)) navDirty = true;
  }, true);
  /* A submit means the form was saved/logged, so there is nothing to lose. */
  document.addEventListener("submit", function () { navDirty = false; }, true);

  function isSamePageLink(href) {
    if (!href) return true;
    if (href.charAt(0) === "#") return true;
    var target = href.split("#")[0].split("?")[0];
    if (target === "") return true;
    var current = location.pathname.split("/").pop() || "index.html";
    return target === current;
  }

  /* Shared gate: true = OK to leave (clears the flag), false = stay put. */
  function confirmLeaveIfDirty() {
    if (!navDirty) return true;
    var ok = window.confirm(
      "You have unsaved changes on this page.\n\n" +
      "If you leave now, those changes will be lost.\n\nContinue anyway?"
    );
    if (ok) navDirty = false;
    return ok;
  }

  /* Capture phase: intercept the click before the browser follows the link. */
  document.addEventListener("click", function (e) {
    var a = (e.target && e.target.closest) ? e.target.closest("a[href]") : null;
    if (!a || !a.closest(".pps-nav")) return;      /* only guard the top nav */
    if (a.hasAttribute("data-noguard")) return;
    if (isSamePageLink(a.getAttribute("href"))) return;
    if (!confirmLeaveIfDirty()) {                   /* stay on the page */
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  /* ============================================================
     CLICKABLE STEP BARS  (.crm-flow / .crm-stage)
     ------------------------------------------------------------
     The chevron progress bars ("Intake Form -> Intake Report" and
     "Project Scorecard -> Risk & Decision -> Repository ->
     Change Request") are plain <div>s in the markup. Here we make
     each stage that maps to a DIFFERENT page clickable (mouse +
     keyboard), routing through the same unsaved-changes guard. The
     stage for the current page is left as a non-clickable marker.
     ============================================================ */
  var STAGE_TARGETS = {
    "intake form": "intake-form.html",
    "intake report": "intake-report.html",
    "portfolio review": "portfolio-review.html",
    "project scorecard": "scorecard.html",
    "risk & decision": "risk-decision-log.html",
    "repository": "repository.html",
    "change request": "change-request-form.html",
    "project financials": "financials.html",
    "resource management": "resources.html",
    "work breakdown": "wbs.html"
  };
  function normStageLabel(s) {
    return (s || "").replace(/\s+/g, " ").trim().toLowerCase();
  }
  (function initStageNav() {
    var current = location.pathname.split("/").pop() || "index.html";
    document.querySelectorAll(".crm-flow .crm-stage").forEach(function (stage) {
      var labelEl = stage.querySelector(".crm-stage-label");
      if (!labelEl) return;
      var target = STAGE_TARGETS[normStageLabel(labelEl.textContent)];
      if (!target || target === current) return;   /* unknown, or this very page */
      stage.classList.add("is-link");
      stage.setAttribute("role", "link");
      stage.setAttribute("tabindex", "0");
      stage.setAttribute("title", "Go to " + labelEl.textContent.trim());
      function go() { if (confirmLeaveIfDirty()) window.location.href = target; }
      stage.addEventListener("click", go);
      stage.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " " || e.key === "Spacebar") {
          e.preventDefault();
          go();
        }
      });
    });
  })();

  /* Optional manual hooks for page scripts. */
  if (window.PPS) {
    window.PPS.navGuard = {
      markDirty: function () { navDirty = true; },
      markClean: function () { navDirty = false; },
      isDirty:   function () { return navDirty; }
    };
  }
})();

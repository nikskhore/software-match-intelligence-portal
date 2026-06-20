const { useEffect, useMemo, useState } = React;
const h = React.createElement;

const icons = {
  dashboard: '<path d="M4 13h6V4H4v9Zm0 7h6v-4H4v4Zm10 0h6v-9h-6v9Zm0-16v4h6V4h-6Z"/>',
  inventory: '<path d="m21 8-9-5-9 5v8l9 5 9-5V8ZM12 5.3 17 8l-5 2.7L7 8l5-2.7ZM5 10l6 3.3v5.1L5 15v-5Zm8 8.4v-5.1l6-3.3v5l-6 3.4Z"/>',
  inbox: '<path d="M4 4h16v13h-5l-2 3h-2l-2-3H4V4Zm2 2v9h4l2 3 2-3h4V6H6Z"/>',
  spark: '<path d="m12 2 1.6 5.4L19 9l-5.4 1.6L12 16l-1.6-5.4L5 9l5.4-1.6L12 2Zm7 12 .9 3.1L23 18l-3.1.9L19 22l-.9-3.1L15 18l3.1-.9L19 14ZM5 13l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3Z"/>',
  search: '<path d="m20.5 19-4.4-4.4a7 7 0 1 0-1.5 1.5l4.4 4.4 1.5-1.5ZM5 10.5a5.5 5.5 0 1 1 11 0 5.5 5.5 0 0 1-11 0Z"/>',
  logout: '<path d="M10 4H4v16h6v-2H6V6h4V4Zm5.5 3.5L14 9l2 2H9v2h7l-2 2 1.5 1.5L20 12l-4.5-4.5Z"/>',
};

function Icon({ name, size = 20 }) {
  return h("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "currentColor", dangerouslySetInnerHTML: { __html: icons[name] || icons.spark } });
}

function Brand({ compact = false }) {
  return h("div", { className: `brand-logo ${compact ? "compact" : ""}` },
    h("img", { src: "/assets/lean2automate-logo.svg", alt: "lean2automate" })
  );
}

const money = (value, currency = "INR") => new Intl.NumberFormat("en-IN", {
  style: "currency", currency, maximumFractionDigits: 0, notation: value > 9999999 ? "compact" : "standard"
}).format(value || 0);

async function api(path, user, options = {}) {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", "X-User-Id": user?.id || "USR-001", ...(options.headers || {}) },
  });
  if (!response.ok) throw new Error((await response.json()).detail || "Request failed");
  return response.json();
}

function Login({ onLogin }) {
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState("admin@lean2automate.demo");
  const [error, setError] = useState("");
  useEffect(() => { fetch("/api/demo-users").then(r => r.json()).then(setUsers); }, []);
  const submit = async e => {
    e.preventDefault();
    try {
      const user = await api("/auth/login", null, { method: "POST", body: JSON.stringify({ email: selected, password: "demo123" }) });
      localStorage.setItem("portalUser", JSON.stringify(user));
      onLogin(user);
    } catch (err) { setError(err.message); }
  };
  return h("div", { className: "login-page" },
    h("div", { className: "login-art" },
      h(Brand),
      h("div", { className: "login-copy" },
        h("div", { className: "eyebrow light" }, "INDUSTRIAL INTELLIGENCE, ONLINE"),
        h("h1", null, "Make software selection ", h("span", null, "think.")),
        h("p", null, "One connected intelligence layer for software inventory, customer demand, and explainable recommendations."),
        h("div", { className: "signal-row" }, ["Inventory intelligence", "Explainable scoring", "Commercial visibility"].map(x => h("span", { key: x }, "+ ", x)))
      ),
      h("div", { className: "orb orb-one" }), h("div", { className: "orb orb-two" })
    ),
    h("div", { className: "login-panel" },
      h("form", { className: "login-card", onSubmit: submit },
        h("div", { className: "mobile-brand" }, h(Brand)),
        h("div", { className: "eyebrow" }, "PROTOTYPE ACCESS"),
        h("h2", null, "Welcome back"),
        h("p", { className: "muted" }, "Choose a role to explore its portal experience."),
        h("label", null, "Demo role"),
        h("div", { className: "role-grid" }, users.map(user =>
          h("button", { type: "button", key: user.id, onClick: () => setSelected(user.email), className: `role-option ${selected === user.email ? "selected" : ""}` },
            h("strong", null, user.role), h("small", null, user.name)
          )
        )),
        error && h("p", { className: "error" }, error),
        h("button", { className: "primary wide", type: "submit" }, "Enter portal", h("span", null, "→")),
        h("small", { className: "login-note" }, "Demo password is preconfigured. No production authentication is used.")
      )
    )
  );
}

function Sidebar({ page, setPage, user, logout }) {
  const items = [
    ["dashboard", "Dashboard", "dashboard"],
    ["inventory", "Software inventory", "inventory"],
    ["queries", user.role === "customer" ? "My requests" : "Customer queries", "inbox"],
    ...(["admin", "sales"].includes(user.role) ? [["operations", "Sales operations", "dashboard"]] : []),
    ...(["admin", "sales", "viewer"].includes(user.role) ? [["procurement", "Procurement & ROI", "inventory"]] : []),
    ["insights", "AI insights", "spark"],
    ...(user.role === "admin" ? [["admin", "Administration", "inventory"]] : []),
  ];
  return h("aside", { className: "sidebar" },
    h(Brand, { compact: true }),
    h("div", { className: "workspace-label" }, "INTELLIGENCE PORTAL"),
    h("nav", null, items.map(([id, label, icon]) =>
      h("button", { key: id, onClick: () => setPage(id), className: page === id ? "active" : "" }, h(Icon, { name: icon }), h("span", null, label))
    )),
    h("div", { className: "side-bottom" },
      h("div", { className: "user-block" },
        h("div", { className: "avatar" }, user.name.split(" ").map(x => x[0]).join("").slice(0, 2)),
        h("div", null, h("strong", null, user.name), h("span", null, user.role))
      ),
      h("button", { className: "logout", onClick: logout, title: "Log out" }, h(Icon, { name: "logout" }))
    )
  );
}

function Header({ title, subtitle, user }) {
  return h("header", { className: "topbar" },
    h("div", null, h("h1", null, title), h("p", null, subtitle)),
    h("div", { className: "top-actions" },
      h("span", { className: "ai-status" }, h("i"), "AI matching ready"),
      h("span", { className: "role-chip" }, user.role)
    )
  );
}

function MetricCard({ label, value, meta, tone, icon }) {
  return h("div", { className: `metric-card ${tone || ""}` },
    h("div", { className: "metric-head" }, h("span", null, label), h("div", { className: "metric-icon" }, h(Icon, { name: icon || "spark" }))),
    h("strong", null, value), h("small", null, meta)
  );
}

function Dashboard({ user }) {
  const [data, setData] = useState(null);
  const [insights, setInsights] = useState([]);
  useEffect(() => { api("/dashboard", user).then(setData); api("/insights", user).then(setInsights); }, [user.id]);
  if (!data) return h(Loader);
  const m = data.metrics;
  const categoryCosts = data.category_costs || [];
  const categoryRevenue = data.category_revenue || [];
  const productPerformance = data.product_performance || [];
  const max = Math.max(...categoryCosts.map(x => x.value), 1);
  const topProducts = productPerformance.slice(0, 6);
  const maxProductValue = Math.max(...topProducts.map(x => x.revenue_inr + x.pipeline_inr), 1);
  const revenueTotal = categoryRevenue.reduce((sum, item) => sum + item.value, 0);
  const revenueColors = ["#2563eb", "#2dd4bf", "#5be4ff", "#9d76ff", "#ffbf69", "#ff6b7d", "#6b8afd", "#19a896", "#8ac7d5", "#8493a4"];
  let revenueAngle = 0;
  const revenueGradient = categoryRevenue.map((item, index) => {
    const start = revenueAngle;
    revenueAngle += item.value / Math.max(revenueTotal, 1) * 100;
    return `${revenueColors[index % revenueColors.length]} ${start}% ${revenueAngle}%`;
  }).join(", ");
  return h(React.Fragment, null,
    h(Header, { title: user.role === "customer" ? "Customer workspace" : "Portfolio overview", subtitle: user.role === "customer" ? "Track your requests and recommended solutions." : "Commercial health and demand signals across your software portfolio.", user }),
    h("main", { className: "content" },
      h("section", { className: "metrics-grid" },
        h(MetricCard, { label: "Software products", value: m.products, meta: "Across 10 solution categories", icon: "inventory" }),
        h(MetricCard, { label: "Inventory value", value: money(m.inventory_value_inr), meta: "Normalized portfolio value", tone: "blue", icon: "dashboard" }),
        h(MetricCard, { label: "Annual maintenance", value: money(m.annual_maintenance_inr), meta: "Expected maintenance exposure", tone: "violet", icon: "spark" }),
        h(MetricCard, { label: "License utilization", value: `${m.utilization}%`, meta: `${m.open_queries} open customer requests`, tone: "green", icon: "inbox" })
      ),
      h("section", { className: "commercial-kpis" },
        h("div", { className: "commercial-kpi primary-kpi" }, h("span", null, "Current-year revenue"), h("strong", null, money(m.current_year_revenue_inr)), h("small", null, "Closed-won product revenue, normalized to INR")),
        h("div", { className: "commercial-kpi" }, h("span", null, "Open sales pipeline"), h("strong", null, money(m.pipeline_value_inr)), h("small", null, `${Math.round(m.pipeline_coverage * 100)}% of current-year revenue`)),
        h("div", { className: "commercial-kpi" }, h("span", null, "Lifetime portfolio revenue"), h("strong", null, money(m.lifetime_revenue_inr)), h("small", null, "Synthetic CRM history across all products"))
      ),
      h("section", { className: "dashboard-grid" },
        h("div", { className: "panel chart-panel" },
          h("div", { className: "panel-title" }, h("div", null, h("h3", null, "Portfolio value by category"), h("p", null, "Current inventory exposure in INR")), h("span", { className: "pill" }, "LIVE DATA")),
          h("div", { className: "bar-chart" }, categoryCosts.slice(0, 7).map(item =>
            h("div", { className: "bar-row", key: item.category },
              h("span", null, item.category), h("div", { className: "bar-track" }, h("i", { style: { width: `${Math.max(8, item.value / max * 100)}%` } })), h("strong", null, money(item.value))
            )
          ))
        ),
        h("div", { className: "panel ai-panel" },
          h("div", { className: "panel-title" }, h("div", null, h("div", { className: "eyebrow light" }, "AI PORTFOLIO ADVISOR"), h("h3", null, "What needs attention"))),
          h("div", { className: "insight-list" }, insights.map((item, i) =>
            h("div", { className: `insight ${item.type}`, key: i }, h("span", { className: "insight-index" }, `0${i + 1}`), h("div", null, h("strong", null, item.title), h("p", null, item.message), h("small", null, item.impact)))
          ))
        )
      ),
      h("section", { className: "commercial-grid" },
        h("div", { className: "panel performance-panel" },
          h("div", { className: "panel-title" },
            h("div", null, h("h3", null, "Product revenue and pipeline"), h("p", null, "Top products by current-year commercial value")),
            h("div", { className: "chart-key" }, h("span", null, h("i", { className: "revenue-key" }), "Revenue"), h("span", null, h("i", { className: "pipeline-key" }), "Pipeline"))
          ),
          h("div", { className: "performance-chart" }, topProducts.map(item =>
            h("div", { className: "performance-row", key: item.id },
              h("div", { className: "performance-name" }, h("strong", null, item.name), h("span", null, `${item.closed_won_deals} won / ${item.open_opportunities} open`)),
              h("div", { className: "performance-tracks" },
                h("div", { className: "performance-track" }, h("i", { className: "revenue-bar", style: { width: `${item.revenue_inr / maxProductValue * 100}%` } })),
                h("div", { className: "performance-track pipeline" }, h("i", { className: "pipeline-bar", style: { width: `${item.pipeline_inr / maxProductValue * 100}%` } }))
              ),
              h("div", { className: "performance-values" }, h("strong", null, money(item.revenue_inr)), h("span", null, `+ ${money(item.pipeline_inr)}`))
            )
          ))
        ),
        h("div", { className: "panel revenue-mix-panel" },
          h("div", { className: "panel-title" }, h("div", null, h("h3", null, "Revenue mix"), h("p", null, "Current-year contribution by category"))),
          h("div", { className: "revenue-mix-content" },
            h("div", { className: "revenue-donut", style: { background: `conic-gradient(${revenueGradient})` } },
              h("div", null, h("strong", null, money(revenueTotal)), h("span", null, "total revenue"))
            ),
            h("div", { className: "revenue-legend" }, categoryRevenue.slice(0, 6).map((item, index) =>
              h("div", { key: item.category }, h("i", { style: { background: revenueColors[index] } }), h("span", null, item.category), h("strong", null, `${Math.round(item.value / revenueTotal * 100)}%`))
            ))
          )
        )
      ),
      h("section", { className: "lower-grid" },
        h("div", { className: "panel" },
          h("div", { className: "panel-title" }, h("div", null, h("h3", null, "Renewal watchlist"), h("p", null, "Contracts due within 90 days"))),
          h("div", { className: "renewal-list" }, data.renewals.map(row => h("div", { key: row.name }, h("span", null, row.name), h("strong", { className: row.days < 30 ? "urgent" : "" }, `${row.days} days`))))
        ),
        h("div", { className: "panel query-meter" },
          h("div", { className: "panel-title" }, h("div", null, h("h3", null, "Inquiry pipeline"), h("p", null, "Current analysis workload"))),
          h("div", { className: "donut", style: { "--percent": `${100 * data.query_status.analyzed / Math.max(data.query_status.new + data.query_status.analyzed, 1)}%` } }, h("div", null, h("strong", null, data.query_status.new + data.query_status.analyzed), h("span", null, "requests"))),
          h("div", { className: "legend" }, h("span", null, h("i", { className: "new" }), `${data.query_status.new} New`), h("span", null, h("i", { className: "done" }), `${data.query_status.analyzed} Analyzed`))
        )
      )
    )
  );
}

function SoftwareForm({ product, user, close, saved }) {
  const fields = ["name", "vendor", "category", "description", "capabilities", "industries", "deployment", "compliance", "license_model", "currency", "unit_license_cost", "maintenance_pct", "available_licenses", "assigned_licenses", "renewal_date", "status"];
  const defaults = { currency: "INR", status: "Active", maintenance_pct: 15, available_licenses: 100, assigned_licenses: 0 };
  const [form, setForm] = useState({ ...defaults, ...(product || {}) });
  const submit = async e => {
    e.preventDefault();
    const payload = Object.fromEntries(fields.map(key => [key, ["unit_license_cost", "maintenance_pct", "available_licenses", "assigned_licenses"].includes(key) ? Number(form[key] || 0) : form[key] || ""]));
    await api(product ? `/software/${product.id}` : "/software", user, { method: product ? "PUT" : "POST", body: JSON.stringify(payload) });
    saved(); close();
  };
  return h("div", { className: "drawer-backdrop", onClick: close },
    h("form", { className: "drawer software-form", onClick: e => e.stopPropagation(), onSubmit: submit },
      h("button", { type: "button", className: "drawer-close", onClick: close }, "x"),
      h("div", { className: "eyebrow" }, product ? "EDIT INVENTORY RECORD" : "NEW INVENTORY RECORD"),
      h("h2", null, product ? product.name : "Add software"),
      h("div", { className: "form-grid" }, fields.map(key =>
        h("label", { key, className: ["description", "capabilities", "industries", "deployment", "compliance"].includes(key) ? "wide" : "" },
          key.replaceAll("_", " "),
          key === "description"
            ? h("textarea", { value: form[key] || "", onChange: e => setForm({ ...form, [key]: e.target.value }), required: true })
            : key === "currency"
              ? h("select", { value: form[key] || "INR", onChange: e => setForm({ ...form, [key]: e.target.value }) }, h("option", null, "INR"), h("option", null, "USD"))
              : h("input", { type: key === "renewal_date" ? "date" : ["unit_license_cost", "maintenance_pct", "available_licenses", "assigned_licenses"].includes(key) ? "number" : "text", value: form[key] || "", onChange: e => setForm({ ...form, [key]: e.target.value }), required: !["compliance"].includes(key) })
        )
      )),
      h("button", { className: "primary", type: "submit" }, product ? "Save changes" : "Add software")
    )
  );
}

function ComparisonDrawer({ products, close }) {
  if (!products.length) return null;
  const rows = [["Vendor", "vendor"], ["Category", "category"], ["License", "unit_license_cost"], ["Deployment", "deployment"], ["Compliance", "compliance"], ["Capabilities", "capabilities"], ["Utilization", "assigned_licenses"]];
  return h("div", { className: "drawer-backdrop", onClick: close },
    h("aside", { className: "drawer comparison-drawer", onClick: e => e.stopPropagation() },
      h("button", { className: "drawer-close", onClick: close }, "x"),
      h("div", { className: "eyebrow" }, "SIDE-BY-SIDE ANALYSIS"), h("h2", null, "Product comparison"),
      h("div", { className: "comparison-table" },
        h("div", { className: "comparison-row heading" }, h("strong", null, "Specification"), products.map(p => h("strong", { key: p.id }, p.name))),
        rows.map(([label, key]) => h("div", { className: "comparison-row", key },
          h("span", null, label),
          products.map(p => h("div", { key: p.id }, key === "unit_license_cost" ? money(p[key], p.currency) : key === "assigned_licenses" ? `${Math.round(p.assigned_licenses / p.available_licenses * 100)}%` : String(p[key]).replaceAll("|", ", ")))
        ))
      )
    )
  );
}

function ProductDrawer({ product, close, user, edit, remove }) {
  if (!product) return null;
  const capabilities = String(product.capabilities || "").split("|").filter(Boolean);
  const industries = String(product.industries || "").split("|").filter(Boolean);
  const deployment = String(product.deployment || "").split("|").filter(Boolean);
  const compliance = String(product.compliance || "").split("|").filter(Boolean);
  const utilization = Math.round(product.assigned_licenses / Math.max(product.available_licenses, 1) * 100);
  const maintenanceCost = product.unit_license_cost * product.maintenance_pct / 100;
  const renewal = new Date(product.renewal_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const revenueCurrency = product.revenue_currency || product.currency;
  const averageDeal = product.current_year_revenue / Math.max(product.closed_won_deals, 1);
  const crmLastSync = new Date(product.crm_last_sync).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

  return h("div", { className: "drawer-backdrop", onClick: close },
    h("aside", { className: "drawer product-drawer", onClick: e => e.stopPropagation(), role: "dialog", "aria-modal": "true", "aria-label": `${product.name} specifications` },
      h("button", { className: "drawer-close", onClick: close, "aria-label": "Close product specifications" }, "x"),
      h("div", { className: "eyebrow" }, `${product.id} / ${product.category}`),
      h("div", { className: "product-detail-heading" },
        h("div", null, h("h2", null, product.name), h("p", null, `By ${product.vendor}`)),
        h("span", { className: `status ${product.status.toLowerCase()}` }, product.status)
      ),
      h("p", { className: "drawer-summary" }, product.description),
      h("section", { className: "detail-metrics" },
        h("div", null, h("span", null, "Unit license"), h("strong", null, money(product.unit_license_cost, product.currency)), h("small", null, product.license_model)),
        h("div", null, h("span", null, "Maintenance"), h("strong", null, `${product.maintenance_pct}%`), h("small", null, `${money(maintenanceCost, product.currency)} per unit`)),
        h("div", null, h("span", null, "Renewal date"), h("strong", null, renewal), h("small", null, "Current agreement")),
        h("div", null, h("span", null, "License utilization"), h("strong", null, `${utilization}%`), h("small", null, `${product.assigned_licenses} of ${product.available_licenses} assigned`))
      ),
      h("section", { className: "revenue-panel" },
        h("div", { className: "revenue-heading" },
          h("div", null, h("div", { className: "eyebrow light" }, "COMMERCIAL PERFORMANCE"), h("h3", null, "Revenue generated")),
          h("span", { className: "crm-ready" }, h("i"), "Salesforce ready")
        ),
        h("div", { className: "revenue-metrics" },
          h("div", null, h("span", null, "Lifetime revenue"), h("strong", null, money(product.lifetime_revenue, revenueCurrency)), h("small", null, "Closed business to date")),
          h("div", null, h("span", null, "Current-year revenue"), h("strong", null, money(product.current_year_revenue, revenueCurrency)), h("small", null, `${product.closed_won_deals} closed-won deals`)),
          h("div", null, h("span", null, "Open pipeline"), h("strong", null, money(product.pipeline_value, revenueCurrency)), h("small", null, `${product.open_opportunities} active opportunities`)),
          h("div", null, h("span", null, "Average deal size"), h("strong", null, money(averageDeal, revenueCurrency)), h("small", null, "Current year average"))
        ),
        h("div", { className: "crm-mapping" },
          h("div", null, h("span", null, "CRM product ID"), h("strong", null, product.crm_product_id)),
          h("div", null, h("span", null, "Last demo sync"), h("strong", null, crmLastSync)),
          h("p", null, "Prepared for mapping to Salesforce Product2, Opportunity, and OpportunityLineItem records.")
        )
      ),
      h("section", { className: "utilization-panel" },
        h("div", null, h("strong", null, "Available capacity"), h("span", null, `${product.available_licenses - product.assigned_licenses} licenses unassigned`)),
        h("div", { className: "detail-capacity" }, h("i", { style: { width: `${utilization}%` } }))
      ),
      h("div", { className: "spec-grid" },
        h("section", { className: "spec-section" }, h("h3", null, "Core capabilities"), h("div", { className: "spec-tags" }, capabilities.map(x => h("span", { key: x }, x)))),
        h("section", { className: "spec-section" }, h("h3", null, "Deployment options"), h("div", { className: "spec-tags accent" }, deployment.map(x => h("span", { key: x }, x)))),
        h("section", { className: "spec-section" }, h("h3", null, "Supported industries"), h("div", { className: "spec-tags" }, industries.map(x => h("span", { key: x }, x)))),
        h("section", { className: "spec-section" }, h("h3", null, "Compliance and assurance"), h("div", { className: "spec-tags compliance" }, compliance.map(x => h("span", { key: x }, x))))
      ),
      h("div", { className: "detail-note" }, h(Icon, { name: "spark", size: 18 }), h("p", null, "These inventory specifications are used by the matching engine when scoring customer requirements."))
      , user?.role === "admin" && h("div", { className: "drawer-actions" },
        h("button", { className: "secondary", onClick: () => edit(product) }, "Edit product"),
        h("button", { className: "danger-button", onClick: () => remove(product) }, "Delete product")
      )
    )
  );
}

function Inventory({ user }) {
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [editing, setEditing] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [compareIds, setCompareIds] = useState([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const load = () => api("/software", user).then(setRows);
  useEffect(() => { load(); }, [user.id]);
  const categories = ["All", ...new Set(rows.map(x => x.category))];
  const filtered = rows.filter(x => (category === "All" || x.category === category) && `${x.name} ${x.vendor} ${x.capabilities}`.toLowerCase().includes(search.toLowerCase()));
  return h(React.Fragment, null,
    h(Header, { title: "Software inventory", subtitle: "Products, commercial terms, capacity, compliance, and renewals.", user }),
    h("main", { className: "content" },
      h("div", { className: "toolbar" },
        h("div", { className: "search-box" }, h(Icon, { name: "search" }), h("input", { placeholder: "Search products or capabilities", value: search, onChange: e => setSearch(e.target.value) })),
        h("select", { value: category, onChange: e => setCategory(e.target.value) }, categories.map(x => h("option", { key: x }, x))),
        h("span", { className: "result-count" }, `${filtered.length} products`),
        compareIds.length > 1 && h("button", { className: "secondary", onClick: () => setCompareOpen(true) }, `Compare ${compareIds.length}`),
        h("button", { className: "secondary", onClick: async () => { const r = await fetch("/api/software-export", { headers: { "X-User-Id": user.id } }); const b = await r.blob(); const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "software_inventory.xlsx"; a.click(); } }, "Export Excel"),
        user.role === "admin" && h("label", { className: "secondary upload-button" }, "Import Excel", h("input", { type: "file", accept: ".xlsx", onChange: async e => { const body = new FormData(); body.append("file", e.target.files[0]); await fetch("/api/software-import", { method: "POST", headers: { "X-User-Id": user.id }, body }); load(); } })),
        user.role === "admin" && h("button", { className: "primary", onClick: () => { setEditing(null); setFormOpen(true); } }, "+ Add software")
      ),
      h("div", { className: "inventory-grid" }, filtered.map(item =>
        h("article", {
          className: "product-card clickable", key: item.id, role: "button", tabIndex: 0,
          "aria-label": `View specifications for ${item.name}`,
          onClick: () => setSelectedProduct(item),
          onKeyDown: e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelectedProduct(item); } }
        },
          h("button", { className: `compare-toggle ${compareIds.includes(item.id) ? "selected" : ""}`, onClick: e => { e.stopPropagation(); setCompareIds(compareIds.includes(item.id) ? compareIds.filter(id => id !== item.id) : compareIds.length < 3 ? [...compareIds, item.id] : compareIds); } }, compareIds.includes(item.id) ? "Selected" : "Compare"),
          h("div", { className: "product-top" }, h("span", { className: "category-tag" }, item.category), h("span", { className: `status ${item.status.toLowerCase()}` }, item.status)),
          h("h3", null, item.name), h("p", { className: "vendor" }, item.vendor), h("p", { className: "description" }, item.description),
          h("div", { className: "tags" }, String(item.capabilities).split("|").slice(0, 4).map(x => h("span", { key: x }, x))),
          h("div", { className: "product-stats" },
            h("div", null, h("span", null, "License"), h("strong", null, money(item.unit_license_cost, item.currency))),
            h("div", null, h("span", null, "Utilization"), h("strong", null, `${Math.round(item.assigned_licenses / item.available_licenses * 100)}%`)),
            h("div", null, h("span", null, "Deployment"), h("strong", null, String(item.deployment).split("|")[0]))
          ),
          h("div", { className: "capacity" }, h("i", { style: { width: `${item.assigned_licenses / item.available_licenses * 100}%` } })),
          h("div", { className: "view-spec" }, h("span", null, "View specifications"), h("strong", null, "->"))
        )
      ))
    ),
    h(ProductDrawer, { product: selectedProduct, user, close: () => setSelectedProduct(null), edit: p => { setSelectedProduct(null); setEditing(p); setFormOpen(true); }, remove: async p => { await api(`/software/${p.id}`, user, { method: "DELETE" }); setSelectedProduct(null); load(); } }),
    formOpen && h(SoftwareForm, { product: editing, user, close: () => setFormOpen(false), saved: load }),
    compareOpen && h(ComparisonDrawer, { products: rows.filter(p => compareIds.includes(p.id)), close: () => setCompareOpen(false) })
  );
}

function MatchDrawer({ result, close, user }) {
  if (!result) return null;
  const downloadProposal = async () => {
    const response = await fetch(`/api/proposals/${result.query_id}`, { headers: { "X-User-Id": user.id } });
    if (!response.ok) return alert("Analyze this request before generating a proposal.");
    const blob = await response.blob(); const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob); anchor.download = `proposal-${result.query_id}.pdf`; anchor.click();
  };
  const rate = async (match, rating) => {
    await api("/feedback", user, { method: "POST", body: JSON.stringify({ query_id: result.query_id, software_id: match.software_id, rating, comment: `${rating} from recommendation panel` }) });
    alert(`Recommendation ${rating}. Feedback was recorded.`);
  };
  return h("div", { className: "drawer-backdrop", onClick: close },
    h("aside", { className: "drawer", onClick: e => e.stopPropagation() },
      h("button", { className: "drawer-close", onClick: close }, "×"),
      h("div", { className: "eyebrow" }, `${result.source.toUpperCase()} ANALYSIS`),
      h("h2", null, "Recommendation results"),
      h("p", { className: "drawer-summary" }, result.summary),
      h("div", { className: "confidence" }, h("span", null, "Analysis confidence"), h("strong", null, `${result.confidence}%`)),
      h("button", { className: "primary proposal-button", onClick: downloadProposal }, "Download customer proposal PDF"),
      h("div", { className: "requirement-tags" }, result.extracted_requirements.map(x => h("span", { key: x }, x))),
      h("div", { className: "matches" }, result.matches.map((match, index) =>
        h("article", { className: "match-card", key: match.software_id },
          h("div", { className: "rank" }, `#${index + 1}`),
          h("div", { className: "score-ring", style: { "--score": `${match.score * 3.6}deg` } }, h("span", null, match.score)),
          h("div", { className: "match-main" },
            h("div", { className: "match-title" }, h("h3", null, match.software_name), h("strong", null, money(match.annual_cost, match.currency), h("small", null, " est."))),
            h("div", { className: "score-bars" }, [
              ["Capabilities", match.capability_score, 55], ["Industry", match.industry_score, 12],
              ["Deployment", match.deployment_score, 10], ["Budget", match.budget_score, 13], ["Compliance", match.compliance_score, 10]
            ].map(([label, value, max]) => h("div", { key: label }, h("span", null, label), h("i", null, h("b", { style: { width: `${value / max * 100}%` } })), h("em", null, value)))),
            h("ul", null, match.reasons.map(x => h("li", { key: x }, x))),
            match.gaps.length > 0 && h("p", { className: "gaps" }, h("strong", null, "Validate: "), match.gaps.join(", ")),
            ["admin", "sales"].includes(user.role) && h("div", { className: "feedback-actions" },
              h("button", { onClick: () => rate(match, "approved") }, "Approve match"),
              h("button", { onClick: () => rate(match, "rejected") }, "Reject match")
            )
          )
        )
      ))
    )
  );
}

function Queries({ user }) {
  const [rows, setRows] = useState([]);
  const [loadingId, setLoadingId] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const load = () => api("/queries", user).then(setRows);
  useEffect(() => { load(); }, [user.id]);
  const analyze = async row => {
    setLoadingId(row.id); setError("");
    try {
      const data = row.status === "Analyzed"
        ? await api(`/analyses/${row.id}`, user)
        : await api(`/queries/${row.id}/analyze`, user, { method: "POST" });
      setResult(data); load();
    } catch (err) { setError(err.message); }
    finally { setLoadingId(""); }
  };
  return h(React.Fragment, null,
    h(Header, { title: user.role === "customer" ? "My requests" : "Customer queries", subtitle: user.role === "customer" ? "Review your submitted requirements and recommendations." : "Simulated inbox with requirement analysis and product matching.", user }),
    h("main", { className: "content" },
      h("div", { className: "inbox-banner" }, h("div", { className: "inbox-icon" }, h(Icon, { name: "inbox", size: 24 })), h("div", null, h("strong", null, "Simulated email inbox"), h("p", null, "New messages are parsed into structured requirements for analysis.")), h("span", null, `${rows.filter(x => x.status === "New").length} awaiting analysis`)),
      error && h("div", { className: "error-banner" }, error),
      h("div", { className: "query-list" }, rows.map(row =>
        h("article", { className: "query-card", key: row.id },
          h("div", { className: `priority ${row.priority.toLowerCase()}` }),
          h("div", { className: "query-customer" }, h("div", { className: "customer-logo" }, row.customer_name.split(" ").map(x => x[0]).join("").slice(0,2)), h("div", null, h("strong", null, row.customer_name), h("span", null, row.received_at))),
          h("div", { className: "query-body" }, h("div", null, h("h3", null, row.subject), h("p", null, row.email_body)), h("div", { className: "query-tags" }, String(row.requirements).split("|").slice(0,4).map(x => h("span", { key: x }, x)))),
          h("div", { className: "query-commercial" }, h("span", null, "Budget"), h("strong", null, money(row.budget, row.currency)), h("small", null, row.preferred_deployment)),
          h("div", { className: "query-action" },
            h("span", { className: `query-status ${row.status.toLowerCase()}` }, row.status),
            user.role === "viewer"
              ? h("small", null, "Read only")
              : h("button", { className: row.status === "Analyzed" ? "secondary" : "primary", disabled: loadingId === row.id || (user.role === "customer" && row.status !== "Analyzed"), onClick: () => analyze(row) }, loadingId === row.id ? "Analyzing..." : row.status === "Analyzed" ? "View match" : "Analyze match")
          )
        )
      ))
    ),
    h(MatchDrawer, { result, user, close: () => setResult(null) })
  );
}

function Operations({ user }) {
  const [forecast, setForecast] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [emails, setEmails] = useState([]);
  const [integrations, setIntegrations] = useState(null);
  const [queries, setQueries] = useState([]);
  const [software, setSoftware] = useState([]);
  const [form, setForm] = useState({ query_id: "QRY-1001", software_id: "SW-001", name: "New software opportunity", owner: user.name, stage: "Qualification", probability: 25, amount: 1000000, currency: "INR", expected_close: "2026-09-30" });
  const load = () => Promise.all([
    api("/forecast", user).then(setForecast), api("/alerts", user).then(setAlerts),
    api("/email-inbox", user).then(setEmails), api("/integrations", user).then(setIntegrations),
    api("/queries", user).then(setQueries), api("/software", user).then(setSoftware)
  ]);
  useEffect(() => { load(); }, [user.id]);
  if (!forecast || !integrations) return h(Loader);
  const maxStage = Math.max(...forecast.stages.map(x => x.amount_inr), 1);
  const create = async e => { e.preventDefault(); await api("/opportunities", user, { method: "POST", body: JSON.stringify({ ...form, probability: Number(form.probability), amount: Number(form.amount) }) }); load(); };
  return h(React.Fragment, null,
    h(Header, { title: "Sales operations", subtitle: "Pipeline, forecast, inbox automation, renewals, and connected systems.", user }),
    h("main", { className: "content" },
      h("section", { className: "ops-kpis" },
        h(MetricCard, { label: "Total pipeline", value: money(forecast.total_pipeline_inr), meta: `${forecast.opportunities.length} opportunities`, tone: "blue" }),
        h(MetricCard, { label: "Weighted forecast", value: money(forecast.weighted_forecast_inr), meta: "Probability-adjusted outlook", tone: "green" }),
        h(MetricCard, { label: "Inbox awaiting import", value: emails.filter(x => x.status === "Unread").length, meta: "Simulated Gmail / Outlook feed", tone: "violet" }),
        h(MetricCard, { label: "Open alerts", value: alerts.filter(x => x.status === "Open").length, meta: "Renewals and utilization", icon: "inbox" })
      ),
      h("section", { className: "ops-grid" },
        h("div", { className: "panel" }, h("div", { className: "panel-title" }, h("div", null, h("h3", null, "Weighted pipeline by stage"), h("p", null, "Opportunity values normalized to INR"))),
          h("div", { className: "stage-chart" }, forecast.stages.map(row => h("div", { key: row.stage }, h("span", null, row.stage), h("i", null, h("b", { style: { width: `${row.amount_inr / maxStage * 100}%` } })), h("strong", null, money(row.weighted_inr)))))
        ),
        h("form", { className: "panel quick-form", onSubmit: create }, h("div", { className: "panel-title" }, h("div", null, h("h3", null, "Create opportunity"), h("p", null, "Convert a request into a managed sales motion"))),
          h("select", { value: form.query_id, onChange: e => setForm({ ...form, query_id: e.target.value }) }, queries.map(q => h("option", { key: q.id, value: q.id }, `${q.id} - ${q.subject}`))),
          h("select", { value: form.software_id, onChange: e => setForm({ ...form, software_id: e.target.value }) }, software.map(p => h("option", { key: p.id, value: p.id }, p.name))),
          h("input", { value: form.name, onChange: e => setForm({ ...form, name: e.target.value }), placeholder: "Opportunity name" }),
          h("div", { className: "inline-fields" }, h("input", { type: "number", value: form.amount, onChange: e => setForm({ ...form, amount: e.target.value }) }), h("select", { value: form.currency, onChange: e => setForm({ ...form, currency: e.target.value }) }, h("option", null, "INR"), h("option", null, "USD"))),
          h("button", { className: "primary" }, "Create opportunity")
        )
      ),
      h("section", { className: "panel ops-table-panel" }, h("div", { className: "panel-title" }, h("div", null, h("h3", null, "Opportunity pipeline"), h("p", null, "Update deal stages and probabilities"))),
        h("div", { className: "data-table" }, forecast.opportunities.map(o => h("div", { className: "data-row", key: o.id }, h("strong", null, o.name), h("span", null, o.owner), h("span", null, money(o.amount, o.currency)), h("select", { value: o.stage, onChange: async e => { await api(`/opportunities/${o.id}`, user, { method: "PUT", body: JSON.stringify({ stage: e.target.value }) }); load(); } }, ["Qualification", "Proposal", "Negotiation", "Closed Won", "Closed Lost"].map(s => h("option", { key: s }, s))), h("span", null, `${o.probability}%`))))
      ),
      h("section", { className: "ops-grid triple" },
        h("div", { className: "panel" }, h("div", { className: "panel-title" }, h("div", null, h("h3", null, "Connected inbox"), h("p", null, "Import customer emails as inquiries"))),
          h("div", { className: "compact-list" }, emails.map(mail => h("div", { key: mail.id }, h("span", null, h("strong", null, mail.subject), h("small", null, mail.sender)), h("button", { className: "secondary", disabled: mail.status !== "Unread", onClick: async () => { await api(`/email-inbox/${mail.id}/ingest`, user, { method: "POST" }); load(); } }, mail.status === "Unread" ? "Import" : "Imported"))))
        ),
        h("div", { className: "panel" }, h("div", { className: "panel-title" }, h("div", null, h("h3", null, "Renewal alerts"), h("p", null, "Action upcoming commercial events")), h("button", { className: "secondary", onClick: async () => { await api("/alerts/generate", user, { method: "POST" }); load(); } }, "Refresh")),
          h("div", { className: "compact-list" }, alerts.slice(0, 5).map(a => h("div", { key: a.id }, h("span", null, h("strong", null, a.title), h("small", null, a.message)), h("button", { className: "secondary", disabled: a.status !== "Open", onClick: async () => { await api(`/alerts/${a.id}`, user, { method: "PUT", body: JSON.stringify({ status: "Resolved" }) }); load(); } }, a.status))))
        ),
        h("div", { className: "panel integrations-panel" }, h("div", { className: "panel-title" }, h("div", null, h("h3", null, "Integrations"), h("p", null, "Configuration-gated live connectors"))),
          Object.entries(integrations).map(([name, value]) => h("div", { className: "integration-row", key: name }, h("strong", null, name), h("span", { className: value.configured ? "connected" : "" }, value.mode))),
          user.role === "admin" && h("button", { className: "primary wide", onClick: async () => { const result = await api("/integrations/salesforce/sync", user, { method: "POST" }); alert(result.message); load(); } }, "Synchronize Salesforce")
        )
      )
    )
  );
}

function Admin({ user }) {
  const [users, setUsers] = useState([]); const [auditRows, setAudit] = useState([]); const [settings, setSettings] = useState([]);
  const load = () => Promise.all([api("/admin/users", user).then(setUsers), api("/admin/audit", user).then(setAudit), api("/admin/settings", user).then(setSettings)]);
  useEffect(() => { load(); }, []);
  return h(React.Fragment, null,
    h(Header, { title: "Administration", subtitle: "Access control, connector settings, and activity history.", user }),
    h("main", { className: "content admin-grid" },
      h("section", { className: "panel" }, h("div", { className: "panel-title" }, h("div", null, h("h3", null, "Users and roles"), h("p", null, "Manage role-based portal access"))),
        h("div", { className: "admin-list" }, users.map(row => h("div", { key: row.id }, h("span", null, h("strong", null, row.name), h("small", null, row.email)), h("select", { value: row.role, onChange: async e => { await api(`/admin/users/${row.id}`, user, { method: "PUT", body: JSON.stringify({ role: e.target.value }) }); load(); } }, ["admin", "sales", "viewer", "customer"].map(role => h("option", { key: role }, role))), h("button", { className: row.active ? "secondary" : "primary", onClick: async () => { await api(`/admin/users/${row.id}`, user, { method: "PUT", body: JSON.stringify({ active: !row.active }) }); load(); } }, row.active ? "Deactivate" : "Activate"))))
      ),
      h("section", { className: "panel" }, h("div", { className: "panel-title" }, h("div", null, h("h3", null, "Portal settings"), h("p", null, "Prototype configuration stored in Excel"))),
        h("div", { className: "settings-list" }, settings.map(s => h("label", { key: s.key }, h("span", null, h("strong", null, s.key.replaceAll("_", " ")), h("small", null, s.description)), h("input", { value: s.value, onChange: e => setSettings(settings.map(x => x.key === s.key ? { ...x, value: e.target.value } : x)), onBlur: e => api(`/admin/settings/${s.key}`, user, { method: "PUT", body: JSON.stringify({ value: e.target.value }) }) }))))
      ),
      h("section", { className: "panel audit-panel" }, h("div", { className: "panel-title" }, h("div", null, h("h3", null, "Audit trail"), h("p", null, "Latest privileged and commercial actions"))),
        h("div", { className: "audit-list" }, auditRows.map(row => h("div", { key: row.id }, h("strong", null, row.action), h("span", null, `${row.entity_type} / ${row.entity_id}`), h("small", null, `${row.user_id} - ${row.created_at}`))))
      )
    )
  );
}

function Procurement({ user }) {
  const [analysis, setAnalysis] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [orders, setOrders] = useState([]);
  const [licenseOps, setLicenseOps] = useState({ pools: [], allocations: [], picking_policy: "" });
  const [channelRows, setChannels] = useState([]);
  const [plans, setPlans] = useState([]);
  const [roiInputs, setRoiInputs] = useState({ holding_reduction: 20, stockout_reduction: 35, utilization_gain: 10 });
  const [roi, setRoi] = useState(null);
  const load = () => Promise.all([
    api("/procurement/analysis", user).then(setAnalysis),
    api("/procurement/vendors", user).then(setVendors),
    api("/procurement/purchase-orders", user).then(setOrders),
    api("/license-operations", user).then(setLicenseOps),
    api("/channels", user).then(setChannels),
    api("/subscription-plans", user).then(setPlans),
    api("/roi", user, { method: "POST", body: JSON.stringify(roiInputs) }).then(setRoi),
  ]);
  useEffect(() => { load(); }, [user.id]);
  if (!roi) return h(Loader);
  const vendorByName = Object.fromEntries(vendors.map(v => [v.name, v]));
  const reorder = analysis.filter(row => row.reorder_required);
  const dead = analysis.filter(row => row.dead_stock);
  const expiring = licenseOps.pools.filter(row => row.days_to_expiry <= 60);
  const makePo = async row => {
    const vendor = vendorByName[row.vendor];
    if (!vendor) return alert("Vendor profile is not available.");
    await api("/procurement/purchase-orders", user, { method: "POST", body: JSON.stringify({ software_id: row.software_id, vendor_id: vendor.id, quantity: Math.max(row.recommended_order, 1), unit_price: row.unit_price, currency: row.currency }) });
    load();
  };
  const downloadPo = async po => {
    const response = await fetch(`/api/procurement/purchase-orders/${po.id}/pdf`, { headers: { "X-User-Id": user.id } });
    const blob = await response.blob(); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `${po.id}.pdf`; a.click();
  };
  const recalc = async values => { setRoiInputs(values); setRoi(await api("/roi", user, { method: "POST", body: JSON.stringify(values) })); };
  return h(React.Fragment, null,
    h(Header, { title: "Procurement & profitability", subtitle: "Optimize license purchasing, expiry, allocation, suppliers, channels, and monetization.", user }),
    h("main", { className: "content" },
      h("section", { className: "ops-kpis" },
        h(MetricCard, { label: "Reorder actions", value: reorder.length, meta: "Products at or below reorder point", tone: "blue" }),
        h(MetricCard, { label: "Dead stock exposure", value: dead.length, meta: "No sales activity for 90+ days", tone: "violet" }),
        h(MetricCard, { label: "Expiring pools", value: expiring.length, meta: "License pools expiring within 60 days", tone: "green" }),
        h(MetricCard, { label: "Reclaimable cash", value: money(roi.total_reclaimed_cash_inr), meta: `${roi.annual_roi_percent}% modeled annual ROI`, icon: "spark" })
      ),
      h("section", { className: "panel" },
        h("div", { className: "panel-title" }, h("div", null, h("h3", null, "Intelligent reorder and EOQ"), h("p", null, "EOQ = square root of (2 x annual demand x order cost / holding cost)")), h("span", { className: "pill" }, `${reorder.length} ACTIONS`)),
        h("div", { className: "procurement-table" }, analysis.map(row => h("div", { className: `procurement-row ${row.reorder_required ? "needs-order" : ""}`, key: row.software_id },
          h("div", null, h("strong", null, row.software_name), h("small", null, row.vendor)),
          h("div", null, h("span", null, "Available"), h("strong", null, row.available_units)),
          h("div", null, h("span", null, "Reorder point"), h("strong", null, row.reorder_point)),
          h("div", null, h("span", null, "Calculated EOQ"), h("strong", null, row.eoq)),
          h("div", null, h("span", null, "Annual holding"), h("strong", null, money(row.annual_holding_cost))),
          h("button", { className: row.reorder_required ? "primary" : "secondary", disabled: !row.reorder_required || user.role === "viewer", onClick: () => makePo(row) }, row.reorder_required ? `Create PO (${row.recommended_order})` : "Healthy")
        )))
      ),
      h("section", { className: "procurement-grid" },
        h("div", { className: "panel" }, h("div", { className: "panel-title" }, h("div", null, h("h3", null, "Purchase order approval queue"), h("p", null, "Pre-filled vendor purchase orders"))),
          h("div", { className: "compact-list" }, orders.length ? orders.map(po => h("div", { key: po.id }, h("span", null, h("strong", null, `${po.id} / ${po.quantity} licenses`), h("small", null, `${money(po.total, po.currency)} / ${po.status}`)), h("span", { className: "po-actions" }, user.role === "admin" && po.status === "Pending Approval" && h("button", { className: "primary", onClick: async () => { await api(`/procurement/purchase-orders/${po.id}/approve`, user, { method: "POST" }); load(); } }, "Approve"), h("button", { className: "secondary", onClick: () => downloadPo(po) }, "PDF")))) : h("p", { className: "empty-state" }, "No purchase orders queued yet."))
        ),
        h("div", { className: "panel" }, h("div", { className: "panel-title" }, h("div", null, h("h3", null, "Dead stock & holding cost"), h("p", null, "Unmoving licenses and working-capital exposure"))),
          h("div", { className: "dead-stock-list" }, dead.map(row => h("div", { key: row.software_id }, h("span", null, h("strong", null, row.software_name), h("small", null, `${row.days_since_sale} days since last sale`)), h("strong", null, money(row.annual_holding_cost)))))
        )
      ),
      h("section", { className: "procurement-grid" },
        h("div", { className: "panel" }, h("div", { className: "panel-title" }, h("div", null, h("h3", null, "License pools & expiry"), h("p", null, licenseOps.picking_policy))),
          h("div", { className: "pool-list" }, licenseOps.pools.map(pool => h("div", { className: pool.days_to_expiry <= 60 ? "expiring" : "", key: pool.id }, h("span", null, h("strong", null, `${pool.batch_code} / ${pool.software_name}`), h("small", null, `${pool.available} available / ${pool.allocation_method}`)), h("strong", null, `${pool.days_to_expiry} days`))))
        ),
        h("div", { className: "panel" }, h("div", { className: "panel-title" }, h("div", null, h("h3", null, "Customer, site & tenant map"), h("p", null, "Exact allocation location for every license pool"))),
          h("div", { className: "allocation-list" }, licenseOps.allocations.map(row => h("div", { key: row.id }, h("strong", null, row.customer_name), h("span", null, `${row.site} -> ${row.tenant} -> ${row.environment}`), h("b", null, `${row.quantity} licenses`))))
        )
      ),
      h("section", { className: "procurement-grid" },
        h("div", { className: "panel" }, h("div", { className: "panel-title" }, h("div", null, h("h3", null, "Supplier performance scorecards"), h("p", null, "Delivery, fulfillment, quality, and price movement"))),
          h("div", { className: "vendor-list" }, vendors.map(v => h("div", { key: v.id }, h("div", null, h("strong", null, v.name), h("small", null, `${v.fulfillment_rate}% fulfillment / ${v.actual_lead_days} day actual lead`)), h("div", { className: "vendor-score" }, h("strong", null, v.overall_score), h("span", null, "score")), h("div", { className: v.price_fluctuation > 5 ? "price-up" : "" }, `${v.price_fluctuation > 0 ? "+" : ""}${v.price_fluctuation}% price`))))
        ),
        h("div", { className: "panel" }, h("div", { className: "panel-title" }, h("div", null, h("h3", null, "Multi-channel source of truth"), h("p", null, "CRM, portal, marketplace, and ERP synchronization"))),
          h("div", { className: "channel-list" }, channelRows.map(channel => h("div", { key: channel.id }, h("span", null, h("strong", null, channel.name), h("small", null, `${channel.type} / ${channel.sync_mode}`)), h("span", { className: channel.status === "Connected" ? "connected" : "attention" }, channel.status), h("button", { className: "secondary", disabled: user.role === "viewer", onClick: async () => { await api(`/channels/${channel.id}/sync`, user, { method: "POST" }); load(); } }, "Sync"))))
        )
      ),
      h("section", { className: "roi-panel" },
        h("div", null, h("div", { className: "eyebrow light" }, "INTERACTIVE ROI EXPLORER"), h("h2", null, "Turn inventory improvements into reclaimed cash."), h("p", null, "Adjust the operating levers to model annual financial impact.")),
        h("div", { className: "roi-controls" }, [["holding_reduction", "Holding cost reduction"], ["stockout_reduction", "Stockout prevention"], ["utilization_gain", "Utilization improvement"]].map(([key, label]) => h("label", { key }, h("span", null, label, h("strong", null, `${roiInputs[key]}%`)), h("input", { type: "range", min: 0, max: 60, value: roiInputs[key], onChange: e => recalc({ ...roiInputs, [key]: Number(e.target.value) }) })))),
        h("div", { className: "roi-result" }, h("span", null, "Estimated annual cash reclaimed"), h("strong", null, money(roi.total_reclaimed_cash_inr)), h("small", null, `${roi.annual_roi_percent}% ROI on idle inventory value`))
      ),
      h("section", { className: "panel" }, h("div", { className: "panel-title" }, h("div", null, h("h3", null, "Monetization plans"), h("p", null, "Tiered SaaS, per-user/location licensing, and integration add-ons"))),
        h("div", { className: "plan-grid" }, plans.map(plan => h("article", { key: plan.id, className: plan.name === "Growth" ? "featured" : "" }, h("span", null, plan.name), h("strong", null, `${money(plan.monthly_price, plan.currency)}/mo`), h("p", null, `${plan.users_included} users / ${plan.locations_included} locations`), h("div", { className: "plan-features" }, String(plan.features).split("|").map(x => h("small", { key: x }, `+ ${x}`))), h("b", null, `Integration add-on: ${money(plan.integration_addon_price, plan.currency)}`))))
      )
    )
  );
}

function InsightDrawer({ item, user, close, status, applied }) {
  if (!item) return null;
  return h("div", { className: "drawer-backdrop", onClick: close },
    h("aside", { className: "drawer insight-drawer", onClick: e => e.stopPropagation() },
      h("button", { className: "drawer-close", onClick: close }, "x"),
      h("div", { className: "insight-detail-top" },
        h("div", null, h("div", { className: "eyebrow" }, `${item.priority.toUpperCase()} PRIORITY`), h("h2", null, item.title)),
        h("div", { className: `confidence-orb ${item.type}` }, h("strong", null, `${item.confidence}%`), h("span", null, "confidence"))
      ),
      h("p", { className: "drawer-summary" }, item.message),
      h("div", { className: "insight-meta" },
        h("div", null, h("span", null, "Recommended owner"), h("strong", null, item.owner)),
        h("div", null, h("span", null, "Target date"), h("strong", null, new Date(item.target_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }))),
        h("div", null, h("span", null, "Estimated impact"), h("strong", null, item.impact))
      ),
      h("section", { className: "insight-section" }, h("h3", null, "Supporting evidence"),
        h("div", { className: "evidence-grid" }, item.evidence.map(row => h("div", { key: row.label }, h("span", null, row.label), h("strong", null, row.value))))
      ),
      h("section", { className: "insight-section" }, h("h3", null, "Affected products"),
        h("div", { className: "spec-tags accent" }, item.affected_products.map(name => h("span", { key: name }, name)))
      ),
      h("section", { className: "insight-section" }, h("h3", null, "Recommended action plan"),
        h("ol", { className: "action-plan" }, item.actions.map(action => h("li", { key: action }, action)))
      ),
      status && h("div", { className: "action-status" }, h("strong", null, status.status), h("span", null, `${status.owner} / target ${status.target_date}`)),
      ["admin", "sales"].includes(user.role) && h("button", { className: "primary wide", disabled: !!status, onClick: () => applied(item) }, status ? "Action already started" : "Start recommended action")
    )
  );
}

function Insights({ user }) {
  const [status, setStatus] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [forecast, setForecast] = useState([]);
  const [question, setQuestion] = useState("Compare our software inventory, license utilization, and vendors.");
  const [answer, setAnswer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState("");
  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [statusData, analyticsData, recommendationData, anomalyData, forecastData] = await Promise.all([
        api("/inventory-ai/status", user),
        api("/inventory-ai/analytics", user),
        api("/inventory-ai/recommendations", user),
        api("/inventory-ai/anomalies", user),
        api("/inventory-ai/forecast?horizon_days=90", user),
      ]);
      setStatus(statusData);
      setAnalytics(analyticsData);
      setRecommendations(recommendationData.recommendations || []);
      setAnomalies(anomalyData.anomalies || []);
      setForecast(forecastData.items || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [user.id]);
  const ask = async e => {
    e.preventDefault();
    if (!question.trim()) return;
    setAsking(true);
    setError("");
    try {
      setAnswer(await api("/inventory-ai/chat", user, {
        method: "POST",
        body: JSON.stringify({ question, include_reasoning: true, max_results: 15 }),
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setAsking(false);
    }
  };
  if (loading) return h(Loader);
  const healthy = status?.status === "healthy";
  const forecastTotal = forecast.reduce((sum, item) => sum + Number(item.predicted_replacements || 0), 0);
  return h(React.Fragment, null,
    h(Header, { title: "AI inventory advisor", subtitle: "Live answers, recommendations, anomalies, and forecasts from the inventory intelligence service.", user }),
    h("main", { className: "content" },
      h("div", { className: "advisor-hero live-ai-hero" },
        h("div", null,
          h("div", { className: "eyebrow light" }, "LIVE INVENTORY INTELLIGENCE"),
          h("h2", null, healthy ? "Your AI service is online and grounded in indexed inventory data." : "The AI service needs attention."),
          h("p", null, healthy ? "Ask operational questions or review live recommendations, anomalies, and replacement forecasts." : (error || "Check the inventory AI service configuration."))
        ),
        h("div", { className: `advisor-score ${healthy ? "healthy" : "degraded"}` },
          h("strong", null, healthy ? "LIVE" : "OFF"),
          h("span", null, `${status?.pending_jobs || 0} pending jobs`)
        )
      ),
      error && h("div", { className: "ai-error" }, error, h("button", { onClick: load }, "Retry")),
      h("section", { className: "ai-metrics" },
        h(MetricCard, { label: "Assets indexed", value: analytics?.assets_total || 0, meta: `${analytics?.assets_available || 0} currently available`, icon: "inventory" }),
        h(MetricCard, { label: "Unused license seats", value: analytics?.unused_license_seats || 0, meta: "Potential optimization capacity", tone: "blue", icon: "spark" }),
        h(MetricCard, { label: "Missing assets", value: analytics?.assets_missing || 0, meta: "Records requiring investigation", tone: "violet", icon: "search" }),
        h(MetricCard, { label: "90-day replacements", value: forecastTotal, meta: `${forecast.length} forecast categories`, tone: "green", icon: "dashboard" })
      ),
      h("section", { className: "ai-workspace-grid" },
        h("form", { className: "panel ai-chat-panel", onSubmit: ask },
          h("div", { className: "panel-title" }, h("div", null, h("h3", null, "Ask the inventory AI"), h("p", null, "Answers use indexed assets, software, licenses, and vendors.")), h("span", { className: "pill" }, "RAG")),
          h("textarea", { value: question, onChange: e => setQuestion(e.target.value), rows: 4, placeholder: "Ask about inventory, licenses, vendors, anomalies, or forecasts..." }),
          h("button", { className: "primary", type: "submit", disabled: asking }, asking ? "Analyzing..." : "Ask AI"),
          answer && h("div", { className: "ai-answer" },
            h("div", { className: "ai-answer-meta" }, h("strong", null, answer.intent), h("span", null, `${Math.round(answer.confidence * 100)}% confidence`)),
            h("p", null, answer.answer),
            answer.reasoning?.length > 0 && h("ul", null, answer.reasoning.map(item => h("li", { key: item }, item))),
            answer.citations?.length > 0 && h("div", { className: "citation-list" }, answer.citations.map(item =>
              h("span", { key: `${item.source}:${item.record_id}` }, `${item.source}: ${item.label}`)
            ))
          )
        ),
        h("div", { className: "panel" },
          h("div", { className: "panel-title" }, h("div", null, h("h3", null, "Recommended actions"), h("p", null, "Generated from current inventory analytics"))),
          h("div", { className: "live-advice-list" }, recommendations.length ? recommendations.map((item, index) =>
            h("div", { key: `${item.action}-${index}`, className: `live-advice ${item.priority || "medium"}` },
              h("span", null, String(item.priority || "medium").toUpperCase()),
              h("strong", null, item.action),
              h("small", null, `${item.quantity || 0} affected`)
            )
          ) : h("p", { className: "empty-state" }, "No recommendations currently require action."))
        )
      ),
      h("section", { className: "ai-workspace-grid" },
        h("div", { className: "panel" },
          h("div", { className: "panel-title" }, h("div", null, h("h3", null, "Detected anomalies"), h("p", null, "Rule and statistical checks over inventory data"))),
          h("div", { className: "live-advice-list" }, anomalies.length ? anomalies.map(item =>
            h("div", { key: `${item.type}:${item.record_id}`, className: `live-advice ${item.severity}` },
              h("span", null, item.severity.toUpperCase()),
              h("strong", null, item.type.replaceAll("_", " ")),
              h("small", null, item.detail)
            )
          ) : h("p", { className: "empty-state" }, "No anomalies detected."))
        ),
        h("div", { className: "panel" },
          h("div", { className: "panel-title" }, h("div", null, h("h3", null, "Replacement forecast"), h("p", null, "Assets due within the next 90 days"))),
          h("div", { className: "forecast-list" }, forecast.length ? forecast.map(item =>
            h("div", { key: item.category }, h("span", null, item.category), h("strong", null, item.predicted_replacements))
          ) : h("p", { className: "empty-state" }, "No replacements are scheduled in this period."))
        )
      )
    )
  );
}

function Loader() { return h("div", { className: "loader-wrap" }, h("div", { className: "loader" }), h("span", null, "Loading intelligence...")); }

function App() {
  const [user, setUser] = useState(() => { try { return JSON.parse(localStorage.getItem("portalUser")); } catch { return null; } });
  const [page, setPage] = useState("dashboard");
  if (!user) return h(Login, { onLogin: setUser });
  const logout = () => { localStorage.removeItem("portalUser"); setUser(null); };
  const view = page === "inventory" ? h(Inventory, { user })
    : page === "queries" ? h(Queries, { user })
    : page === "operations" ? h(Operations, { user })
    : page === "procurement" ? h(Procurement, { user })
    : page === "admin" ? h(Admin, { user })
    : page === "insights" ? h(Insights, { user })
    : h(Dashboard, { user });
  return h("div", { className: "app-shell" }, h(Sidebar, { page, setPage, user, logout }), h("div", { className: "main-shell" }, view));
}

ReactDOM.createRoot(document.getElementById("root")).render(h(App));

const money = (value) =>
  Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const dateBR = (value) => {
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
};

const categoryStyles = {
  Hospedagem: "#3f91d6",
  Alimentação: "#57b26f",
  Transporte: "#f4a32b",
  Passeios: "#9271bf",
  Compras: "#e57b9c",
  Outros: "#e3bd35"
};

// Escapa HTML de dados vindos da API (proteção contra XSS)
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function apiErrorMessage(json) {
  const err = json?.error || {};
  const details = Array.isArray(err.details) ? err.details.map((d) => d.field ? `${d.field}: ${d.message}` : d.message).filter(Boolean) : [];
  return [err.message || "Erro na API", ...details].join(" • ");
}

async function apiFull(path, options = {}) {
  const init = { ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) } };
  if (init.body && typeof init.body !== "string") init.body = JSON.stringify(init.body);
  let response;
  try { response = await fetch(path, init); }
  catch (_e) { throw new Error("Não foi possível conectar ao servidor."); }
  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json.success) throw new Error(apiErrorMessage(json));
  return json;
}
async function api(path, options) { return (await apiFull(path, options)).data; }

let currentTripId = Number(localStorage.getItem("travelcashTrip")) || 1;
let lastDashboard = null;

function renderCategories(data) {
  if (!data.summary.totalSpent) {
    document.querySelector("#pie").style.background = "#e6e6e6";
    document.querySelector("#categoryLegend").innerHTML = `<div class="empty-state">Sem despesas nesta viagem.</div>`;
    return;
  }
  const total = data.summary.totalSpent;
  const categories = Object.entries(data.categoryTotals)
    .sort((a, b) => b[1] - a[1]);

  let cursor = 0;
  const segments = categories.map(([name, amount]) => {
    const start = cursor;
    cursor += (amount / total) * 100;
    return `${categoryStyles[name] || "#8c9aa0"} ${start}% ${cursor}%`;
  }).join(", ");

  document.querySelector("#pie").style.background = `conic-gradient(${segments})`;

  document.querySelector("#categoryLegend").innerHTML = categories.map(([name, amount]) => `
    <div class="legend-item">
      <i class="legend-dot" style="background:${categoryStyles[name] || "#8c9aa0"}"></i>
      <span class="name">${esc(name)}</span>
      <span class="value">${money(amount)}</span>
    </div>
  `).join("") + `<div class="legend-total"><b>Total</b><b>${money(total)}</b></div>`;
}

function renderAlerts(alerts) {
  const icons = { warning: "⚠", danger: "⚠", info: "ⓘ" };
  document.querySelector("#alertBadge").textContent = alerts.length;
  document.querySelector("#alertsList").innerHTML = alerts.map(a => `
    <div class="alert-box ${esc(a.type)}">
      <div class="alert-symbol">${icons[a.type] || "ⓘ"}</div>
      <div><b>${esc(a.title)}${a.auto ? '<span class="auto-tag">AUTOMÁTICO</span>' : ""}</b><small>${esc(a.message)}</small></div>
    </div>
  `).join("") || `<div class="empty-state">Nenhum alerta para esta viagem. 🎉</div>`;
}

function renderItinerary(items) {
  document.querySelector("#itineraryList").innerHTML = items.map(item => `
    <div class="itinerary-item">
      <div class="date-box"><b>${item.date.slice(8,10)}</b><span>${["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"][Number(item.date.slice(5,7))-1]}</span></div>
      <div><div class="item-title">${esc(item.title)}</div><div class="item-sub">⌖ ${esc(item.location || "Destino da viagem")}</div></div>
      <div class="item-cost"><span>Custo previsto</span>${money(item.estimatedCost)}</div>
    </div>
  `).join("") || `<div class="empty-state">Nenhuma atividade no roteiro.</div>`;
}

function renderGoals(goals) {
  document.querySelector("#goalsList").innerHTML = goals.map((goal, index) => {
    const progress = Number(goal.targetAmount) ? (Number(goal.currentAmount) / Number(goal.targetAmount)) * 100 : 0;
    return `
      <div class="goal-item">
        <div class="goal-head">
          <div class="goal-icon">${index === 0 ? "✈" : "🐷"}</div>
          <div class="goal-name">${esc(goal.name)}</div>
          <div class="goal-values">${money(goal.currentAmount)} (${progress.toFixed(1).replace(".", ",")}%)</div>
        </div>
        <div class="goal-values" style="margin-left:49px;margin-top:4px">Meta: ${money(goal.targetAmount)}</div>
        <div class="progress"><i style="width:${Math.min(progress,100)}%"></i></div>
      </div>
    `;
  }).join("");
}

function renderExpenses(expenses) {
  const tagClass = {
    Alimentação: "food",
    Transporte: "transport",
    Passeios: "fun",
    Compras: "shopping"
  };
  document.querySelector("#expensesTable").innerHTML = expenses.map(e => `
    <tr>
      <td>${dateBR(e.date)}</td>
      <td>${esc(e.description)}</td>
      <td><span class="tag ${tagClass[e.category] || "fun"}">${esc(e.category)}</span></td>
      <td>${money(e.amount)}</td>
    </tr>
  `).join("") || `<tr><td colspan="4" class="empty-cell">Nenhuma despesa nesta viagem.</td></tr>`;
}

function renderEvolution(data) {
  const box = document.querySelector("#evolutionChart");
  const mode = document.querySelector("#evolutionMode").value;
  const daily = data.dailySpending || [];
  document.querySelector("#evolutionLegend").textContent = mode === "daily" ? "Gasto por dia (R$)" : "Gasto acumulado (R$)";
  if (!daily.length) { box.innerHTML = `<div class="empty-state" style="width:100%">Ainda não há despesas para montar o gráfico.</div>`; return; }

  let acc = 0;
  const points = daily.map((d) => ({ date: d.date, value: mode === "daily" ? d.total : (acc += d.total) }));
  const budget = mode === "daily" ? Number(data.budget?.dailyBudget || 0) : Number(data.summary.totalBudget || 0);
  const max = Math.max(...points.map((p) => p.value), budget, 1) * 1.1;
  const W = 680, H = 220, n = points.length;
  const x = (i) => n === 1 ? W / 2 : (i / (n - 1)) * W;
  const y = (v) => H - (v / max) * (H - 10);
  const short = (v) => v >= 1000 ? `${(v / 1000).toFixed(1).replace(".0", "")}k` : Math.round(v);
  const ticks = [0, .25, .5, .75, 1].map((t) => max * t).reverse();

  let marks;
  if (mode === "daily") {
    const bw = Math.min(40, (W / n) * 0.6);
    marks = points.map((p, i) => `<rect class="bar" x="${x(i) - bw / 2}" y="${y(p.value)}" width="${bw}" height="${H - y(p.value)}" rx="3"><title>${dateBR(p.date)}: ${money(p.value)}</title></rect>`).join("");
  } else {
    const line = points.map((p, i) => `${x(i)},${y(p.value)}`).join(" ");
    marks = `<polygon class="area" points="${x(0)},${H} ${line} ${x(n - 1)},${H}"/><polyline class="spent" points="${line}"/>` +
      points.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.value)}" r="3.5" fill="#4eaaa0"><title>${dateBR(p.date)}: ${money(p.value)}</title></circle>`).join("");
  }
  const budgetLine = budget ? `<line class="budget-line" x1="0" x2="${W}" y1="${y(budget)}" y2="${y(budget)}"/>` : "";
  const step = Math.max(1, Math.ceil(n / 8));
  box.innerHTML = `
    <div class="y-axis">${ticks.map((t) => `<span>${short(t)}</span>`).join("")}</div>
    <div class="chart-area">
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-label="Evolução dos gastos">
        <g class="gridlines">${ticks.map((t) => `<line x1="0" x2="${W}" y1="${y(t)}" y2="${y(t)}"/>`).join("")}</g>
        ${budgetLine}${marks}
      </svg>
      <div class="x-axis">${points.filter((_, i) => i % step === 0).map((p) => `<span>${dateBR(p.date).slice(0, 5)}</span>`).join("")}</div>
    </div>`;
}

function financialScore(summary) {
  if (!summary.totalBudget) return { value: 50, label: "Defina um orçamento" };
  let score = 100 - Math.max(0, summary.utilization - 60) * 1.5;
  if (summary.projectedTotal > summary.totalBudget) score -= 15;
  if (lastDashboard?.budget?.dailyBudget && summary.dailyAverage > lastDashboard.budget.dailyBudget) score -= 10;
  score = Math.max(0, Math.min(100, Math.round(score)));
  const label = score >= 80 ? "Muito bom! 🌟" : score >= 60 ? "Atenção aos gastos" : "Situação crítica ⚠";
  return { value: score, label };
}

async function loadTripSelector() {
  const trips = await api("/api/trips?limit=100&sort=startDate");
  const sel = document.querySelector("#dashTripSelect");
  sel.innerHTML = trips.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join("");
  if (!trips.some((t) => t.id === currentTripId) && trips[0]) currentTripId = trips[0].id;
  sel.value = currentTripId;
}

async function loadProfile() {
  try {
    const user = await api("/api/users/1");
    document.querySelector("#profileName").textContent = user.name;
    document.querySelector("#profileAvatar").textContent = user.avatar || user.name.split(" ").map((p) => p[0]).slice(0, 2).join("");
    document.querySelector("#welcomeText").textContent = `Bem-vindo(a), ${user.name.split(" ")[0]}! 👋`;
    if (document.querySelector("#settingsName")) { settingsName.value = user.name; settingsEmail.value = user.email; }
  } catch (_e) { /* perfil é opcional na tela */ }
}

async function loadDashboard(tripId = currentTripId) {
  currentTripId = Number(tripId);
  localStorage.setItem("travelcashTrip", currentTripId);
  const sel = document.querySelector("#dashTripSelect"); if (sel) sel.value = currentTripId;
  const data = await api(`/api/dashboard?tripId=${currentTripId}`);
  lastDashboard = data;
  const { trip, summary } = data;
  const pctTxt = `${summary.utilization.toFixed(1).replace(".", ",")}%`;

  document.querySelector("#dashEndpoint").textContent = `/api/dashboard?tripId=${currentTripId}`;
  document.querySelector("#tripName").textContent = trip.name;
  document.querySelector("#tripMeta").innerHTML =
    `${dateBR(trip.startDate)} até ${dateBR(trip.endDate)} <span>•</span> ${esc(trip.travelers)} viajante(s) <span>•</span> ${esc(trip.destination || "")}`;
  document.querySelector("#tripStatus").textContent = trip.status;
  document.querySelector("#periodText").textContent = `${dateBR(trip.startDate)} - ${dateBR(trip.endDate)}`;

  document.querySelector("#budgetTotal").textContent = money(summary.totalBudget);
  document.querySelector("#budgetSpent").textContent = money(summary.totalSpent);
  document.querySelector("#budgetRemaining").textContent = money(summary.remaining);
  document.querySelector("#budgetUtilization").textContent = pctTxt;
  document.querySelector("#donutPercent").textContent = pctTxt;
  document.querySelector("#pieUsage").textContent = pctTxt;
  const donutColor = summary.utilization >= 100 ? "#c84242" : "#ec9118";
  document.querySelector("#donutPercent").parentElement.parentElement.style.background =
    `conic-gradient(${donutColor} 0 ${Math.min(summary.utilization, 100)}%, #e6e6e6 ${Math.min(summary.utilization, 100)}% 100%)`;

  const today = new Date().toISOString().slice(0, 10);
  const daysLeft = today < trip.startDate ? summary.days
    : today > trip.endDate ? 0
    : Math.round((new Date(trip.endDate) - new Date(today)) / 86400000) + 1;
  document.querySelector("#dailyRemaining").textContent = daysLeft ? `${money(summary.remaining / daysLeft)} (${daysLeft} dia(s))` : "viagem encerrada";

  document.querySelector("#totalSpentCard").textContent = money(summary.totalSpent);
  document.querySelector("#totalSpentOf").textContent = `de ${money(summary.totalBudget)} • ${summary.expenseCount} lançamento(s)`;
  document.querySelector("#dailyAverage").textContent = money(summary.dailyAverage);
  document.querySelector("#dailyAverageHint").textContent = data.budget?.dailyBudget ? `limite: ${money(data.budget.dailyBudget)}/dia` : "por dia de viagem";
  const top = data.categories?.[0];
  document.querySelector("#topCategory").textContent = top ? top.category : "—";
  document.querySelector("#topCategoryValue").textContent = top ? `${money(top.total)} (${top.share.toFixed(0)}%)` : "sem despesas";
  const score = financialScore(summary);
  document.querySelector("#scoreValue").textContent = `${score.value} / 100`;
  document.querySelector("#scoreLabel").textContent = score.label;

  renderCategories(data);
  renderEvolution(data);
  renderAlerts(data.alerts);
  renderItinerary(data.itinerary);
  renderGoals(data.goals);
  renderExpenses(data.expenses);
  resetInsightsPanel();
}

// ---------- IA: análise da viagem ----------
function resetInsightsPanel() {
  document.querySelector("#aiBody").innerHTML = `<p class="muted">Clique em <b>Gerar análise</b> para que a IA avalie orçamento, categorias e projeção desta viagem e sugira ações.</p>`;
  document.querySelector("#aiDataSent").textContent = "—";
  const badge = document.querySelector("#aiSource"); badge.className = "ai-badge"; badge.textContent = "IA";
}

async function generateInsights(refresh = false) {
  const btn = document.querySelector("#aiGenerate"), body = document.querySelector("#aiBody");
  btn.disabled = true; btn.textContent = "Analisando…";
  body.innerHTML = `<div class="skeleton" style="width:80%"></div><div class="skeleton" style="width:65%"></div><div class="skeleton" style="width:72%"></div>`;
  try {
    const r = await api(`/api/trips/${currentTripId}/insights${refresh ? "?refresh=true" : ""}`);
    const i = r.insights;
    const health = { boa: "Saudável", atencao: "Atenção", critica: "Crítica" }[i.saude] || i.saude;
    body.innerHTML = `
      <p><span class="ai-health ${esc(i.saude)}">${esc(health)}</span> ${esc(i.resumo)}</p>
      <div class="ai-grid">
        <div><h4>⚠ Pontos de atenção</h4><ul>${i.pontosDeAtencao.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>
        <div><h4>✅ Recomendações</h4><ul>${i.recomendacoes.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></div>
      </div>
      <p class="muted" style="margin-top:10px">🔮 ${esc(i.previsao)}</p>
      <p class="muted" style="font-size:10px">Gerado em ${new Date(r.generatedAt).toLocaleString("pt-BR")}${r.cached ? " • resposta em cache" : ""}${r.fallbackReason ? ` • fallback: ${esc(r.fallbackReason)}` : ""}</p>`;
    document.querySelector("#aiDataSent").textContent = JSON.stringify(r.dataSent, null, 2);
    const badge = document.querySelector("#aiSource");
    badge.className = `ai-badge ${r.source}`;
    badge.textContent = r.source === "llm" ? `LLM • ${r.model}` : "Regras locais (sem LLM)";
    toast(r.source === "llm" ? "Análise gerada pela IA." : "Análise gerada por regras locais (LLM não configurada).");
  } catch (e) {
    body.innerHTML = `<p style="color:#c84242">Não foi possível gerar a análise: ${esc(e.message)}</p>`;
    toast(e.message, true);
  } finally {
    btn.disabled = false; btn.textContent = "Gerar novamente";
  }
}

async function init() {
  try {
    await loadTripSelector();
    await loadDashboard();
    loadProfile();
    document.querySelector("#apiStatus").textContent = "● conectado";
  } catch (error) {
    console.error(error);
    document.querySelector("#apiStatus").textContent = "● erro na API";
    document.querySelector("#apiStatus").style.color = "#c84242";
  }
}


const sectionNames = {
  dashboard: "Dashboard", trips: "Minhas Viagens", budgets: "Orçamentos", expenses: "Despesas",
  itinerary: "Roteiro", goals: "Metas de Economia", reports: "Relatórios", alerts: "Alertas", settings: "Configurações"
};

function toast(message, error = false) {
  document.querySelector(".toast")?.remove();
  const el = document.createElement("div"); el.className = "toast"; el.textContent = message;
  el.setAttribute("role", error ? "alert" : "status");
  if (error) el.style.borderLeftColor = "#c84242";
  document.body.appendChild(el); setTimeout(() => el.remove(), error ? 5000 : 2600);
}

// Otimização: uma única chamada a /api/overview substitui N chamadas por viagem nos relatórios;
// listas usam limit=100 (paginação no servidor).
async function allResources() {
  const L = "?limit=100";
  const [trips, budgets, expenses, itinerary, goals, alerts, overview] = await Promise.all([
    api(`/api/trips${L}`), api(`/api/budgets${L}`), api(`/api/expenses${L}`), api(`/api/itinerary${L}`),
    api(`/api/goals${L}`), api(`/api/alerts${L}`), api("/api/overview")
  ]);
  return { trips, budgets, expenses, itinerary, goals, alerts, overview };
}
function tripNameById(trips, id) { return trips.find(t => Number(t.id) === Number(id))?.name || `Viagem #${id}`; }
function pct(value, total) { return total ? Math.max(0, Math.min(100, value / total * 100)) : 0; }
function statusForTrip(t) {
  if (t.status) return t.status;
  const now = new Date(), start = new Date(t.startDate + "T00:00:00"), end = new Date(t.endDate + "T23:59:59");
  if (now < start) return "Planejamento"; if (now > end) return "Concluída"; return "Em andamento";
}
const tagFor = (c) => ({ Alimentação: "food", Transporte: "transport", Compras: "shopping" }[c] || "fun");
const tripOptions = (trips, all = true) => (all ? `<option value="all">Todas as viagens</option>` : "") + trips.map(t => `<option value="${t.id}">${esc(t.name)}</option>`).join("");

function renderTripsFull(rows) {
  const search = (document.querySelector("#tripSearch")?.value || "").toLowerCase();
  const filter = document.querySelector("#tripStatusFilter")?.value || "all";
  const filtered = rows.filter(t => (!search || `${t.name} ${t.destination || ""}`.toLowerCase().includes(search)) && (filter === "all" || statusForTrip(t) === filter));
  const active = rows.filter(t => statusForTrip(t) === "Em andamento").length;
  const next = rows.filter(t => new Date(t.startDate) >= new Date()).sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
  document.querySelector("#tripCount").textContent = rows.length;
  document.querySelector("#tripActive").textContent = active;
  document.querySelector("#tripNext").textContent = next ? dateBR(next.startDate) : "—";
  document.querySelector("#tripTravelers").textContent = rows.reduce((s, t) => s + Number(t.travelers || 0), 0);
  document.querySelector("#tripsCards").innerHTML = filtered.map(t => `<div class="feature-card"><span class="status-pill">${esc(statusForTrip(t))}</span><h3>${esc(t.name)}</h3><p>📍 ${esc(t.destination || "Destino não informado")}</p><p>📅 ${dateBR(t.startDate)} até ${dateBR(t.endDate)}</p><p>👥 ${esc(t.travelers || 1)} viajante(s)</p><div class="card-actions"><button class="text-btn" onclick="loadDashboard(${t.id});navigate('dashboard')">Abrir viagem</button><button class="text-btn danger-btn" onclick="removeItem('trips',${t.id})">Excluir</button></div></div>`).join("") || `<div class="empty-state">Nenhuma viagem encontrada com esses filtros.</div>`;
}

function renderBudgetsFull(budgets, trips, overview) {
  const spentOf = (tripId) => Number(overview.find(o => o.id === Number(tripId))?.totalSpent || 0);
  const currentBudget = budgets.find(b => Number(b.tripId) === currentTripId) || budgets[0];
  if (currentBudget) {
    const spent = spentOf(currentBudget.tripId), total = Number(currentBudget.totalBudget || 0), used = pct(spent, total);
    document.querySelector("#budgetMainTotal").textContent = money(total); document.querySelector("#budgetMainTrip").textContent = tripNameById(trips, currentBudget.tripId);
    document.querySelector("#budgetMainSpent").textContent = money(spent); document.querySelector("#budgetMainRemaining").textContent = money(total - spent); document.querySelector("#budgetMainBar").style.width = used + "%";
    document.querySelector("#budgetAdvice").textContent = used >= 80 ? "Você já consumiu uma parcela alta do orçamento. Priorize as categorias essenciais." : "Seu orçamento está sob controle. Continue registrando cada gasto para manter a previsão atualizada.";
  }
  document.querySelector("#budgetsTable").innerHTML = budgets.map(b => { const spent = spentOf(b.tripId), total = Number(b.totalBudget || 0), used = pct(spent, total); return `<tr><td>${esc(tripNameById(trips, b.tripId))}</td><td>${money(total)}</td><td>${money(b.dailyBudget)}</td><td>${money(spent)}</td><td>${used.toFixed(1).replace(".", ",")}%</td><td>${money(total - spent)}</td><td><button class="text-btn danger-btn" onclick="removeItem('budgets',${b.id})">Excluir</button></td></tr>` }).join("") || `<tr><td colspan="7" class="empty-cell">Nenhum orçamento cadastrado.</td></tr>`;
}

// ---------- Despesas: filtros, ordenação e paginação feitos no servidor ----------
let expensePage = 1;
const EXPENSE_PAGE_SIZE = 8;

function renderExpenseStats(expenses) {
  const total = expenses.reduce((s, e) => s + Number(e.amount || 0), 0), byCat = {};
  expenses.forEach(e => byCat[e.category] = (byCat[e.category] || 0) + Number(e.amount || 0));
  const top = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0], largest = [...expenses].sort((a, b) => Number(b.amount) - Number(a.amount))[0];
  document.querySelector("#expenseCount").textContent = expenses.length; document.querySelector("#expenseTotal").textContent = money(total);
  document.querySelector("#expenseTopCategory").textContent = top ? top[0] : "—"; document.querySelector("#expenseLargest").textContent = largest ? money(largest.amount) : "R$ 0,00";
}

async function loadExpensesTable(trips) {
  const params = new URLSearchParams({ page: expensePage, limit: EXPENSE_PAGE_SIZE, sort: document.querySelector("#expenseSort")?.value || "-date" });
  const search = document.querySelector("#expenseSearch")?.value.trim(), cat = document.querySelector("#expenseCategoryFilter")?.value, trip = document.querySelector("#expenseTripFilter")?.value;
  if (search) params.set("search", search); if (cat && cat !== "all") params.set("category", cat); if (trip && trip !== "all") params.set("tripId", trip);
  const { data, meta } = await apiFull(`/api/expenses?${params}`);
  if (meta.page > meta.totalPages) { expensePage = meta.totalPages; return loadExpensesTable(trips); }
  document.querySelector("#expensesFullTable").innerHTML = data.map(e => `<tr><td>${dateBR(e.date)}</td><td>${esc(e.description)}</td><td><span class="tag ${tagFor(e.category)}">${esc(e.category)}</span></td><td>${esc(tripNameById(trips, e.tripId))}</td><td>${money(e.amount)}</td><td><button class="text-btn" onclick='editExpense(${e.id})'>Editar</button> <button class="text-btn danger-btn" onclick="removeItem('expenses',${e.id})">Excluir</button></td></tr>`).join("") || `<tr><td colspan="6" class="empty-cell">Nenhuma despesa corresponde aos filtros.</td></tr>`;
  document.querySelector("#expensesPager").innerHTML = `<span>${meta.total} resultado(s) • página ${meta.page} de ${meta.totalPages}</span><button ${meta.page <= 1 ? "disabled" : ""} onclick="expensePage--;refreshSections()">‹ Anterior</button><button ${meta.page >= meta.totalPages ? "disabled" : ""} onclick="expensePage++;refreshSections()">Próxima ›</button>`;
}

function renderItineraryFull(rows, trips) {
  const sel = document.querySelector("#itineraryTripFilter"), filter = sel?.value || "all";
  sel.innerHTML = tripOptions(trips); if (filter !== "all") sel.value = filter;
  const filtered = rows.filter(i => filter === "all" || Number(i.tripId) === Number(filter)).sort((a, b) => a.date.localeCompare(b.date));
  const cost = filtered.reduce((s, i) => s + Number(i.estimatedCost || 0), 0); document.querySelector("#itineraryCount").textContent = filtered.length; document.querySelector("#itineraryCost").textContent = money(cost); document.querySelector("#itineraryNext").textContent = filtered[0]?.title || "—";
  document.querySelector("#itineraryTimeline").innerHTML = filtered.map(i => `<div class="timeline-item"><div class="timeline-date"><b>${i.date.slice(8, 10)}</b><span>${dateBR(i.date).slice(3, 5)}/${dateBR(i.date).slice(6)}</span></div><div class="timeline-dot"></div><div class="timeline-content"><span class="status-pill">${esc(tripNameById(trips, i.tripId))}</span><h3>${esc(i.title)}</h3><p>⌖ ${esc(i.location || "Local não informado")}</p><strong>Custo previsto: ${money(i.estimatedCost)}</strong><div class="card-actions"><button class="text-btn danger-btn" onclick="removeItem('itinerary',${i.id})">Excluir atividade</button></div></div></div>`).join("") || `<div class="empty-state">Nenhuma atividade cadastrada para este filtro.</div>`;
}

function renderGoalsFull(rows) {
  const totalTarget = rows.reduce((s, g) => s + Number(g.targetAmount || 0), 0), totalCurrent = rows.reduce((s, g) => s + Number(g.currentAmount || 0), 0), overall = pct(totalCurrent, totalTarget);
  document.querySelector("#goalOverallPct").textContent = overall.toFixed(1).replace(".", ",") + "%"; document.querySelector("#goalOverallBar").style.width = overall + "%"; document.querySelector("#goalOverallText").textContent = `${money(totalCurrent)} de ${money(totalTarget)}`;
  document.querySelector("#goalsFull").innerHTML = rows.map((g, index) => { const p = Number(g.progress ?? pct(g.currentAmount, g.targetAmount)); return `<div class="feature-card goal-card"><div class="goal-card-top"><div class="goal-icon-large">${index % 2 === 0 ? "✈" : "🐷"}</div><div><h3>${esc(g.name)}</h3><p>Objetivo financeiro</p></div><b>${p.toFixed(0)}%</b></div><div class="progress large"><i style="width:${Math.min(p, 100)}%"></i></div><div class="goal-money"><span>Atual <b>${money(g.currentAmount)}</b></span><span>Meta <b>${money(g.targetAmount)}</b></span></div><div class="card-actions"><button class="text-btn" onclick="contributeGoal(${g.id})">Adicionar valor</button><button class="text-btn danger-btn" onclick="removeItem('goals',${g.id})">Excluir</button></div></div>` }).join("") || `<div class="empty-state">Crie sua primeira meta de economia.</div>`;
}

async function contributeGoal(id) {
  const value = Number(String(prompt("Quanto deseja adicionar à meta?", "100") || "").replace(",", ".")); if (!value || value <= 0) return;
  try {
    const goal = await api(`/api/goals/${id}`);
    await api(`/api/goals/${id}`, { method: "PATCH", body: { currentAmount: Number(goal.currentAmount || 0) + value } });
    toast("Contribuição adicionada à meta."); refreshSections(); loadDashboard();
  } catch (e) { toast(e.message, true); }
}

function renderReports(data, all) {
  const d = data.summary; document.querySelector("#reportBudget").textContent = money(d.totalBudget); document.querySelector("#reportSpent").textContent = money(d.totalSpent); document.querySelector("#reportRemaining").textContent = money(d.remaining); document.querySelector("#reportUsage").textContent = d.utilization.toFixed(1).replace(".", ",") + "%";
  document.querySelector("#reportDaily").textContent = money(d.dailyAverage); document.querySelector("#reportDays").textContent = d.days; document.querySelector("#reportLargest").textContent = money(d.largestExpense);
  document.querySelector("#reportScore").textContent = financialScore(d).value + " / 100";
  const cats = data.categories || [], max = cats[0]?.total || 1; document.querySelector("#reportCategories").innerHTML = cats.map(c => `<div class="break-row"><div class="break-head"><span>${esc(c.category)} (${c.share.toFixed(0)}%)</span><b>${money(c.total)}</b></div><div class="break-bar"><i style="width:${c.total / max * 100}%"></i></div></div>`).join("") || `<div class="empty-state">Ainda não há despesas.</div>`;
  document.querySelector("#reportTrips").innerHTML = all.overview.map(t => `<tr><td>${esc(t.name)}</td><td>${money(t.totalBudget)}</td><td>${money(t.totalSpent)}</td><td>${money(t.remaining)}</td><td>${t.utilization.toFixed(1).replace(".", ",")}%</td></tr>`).join("");
}

function renderAlertsFull(rows, autoAlerts, trips) {
  const filter = document.querySelector("#alertFilter")?.value || "all";
  const combined = [...autoAlerts.map(a => ({ ...a, tripId: currentTripId })), ...rows];
  const filtered = combined.filter(a => filter === "all" || a.type === filter);
  const counts = { warning: 0, danger: 0, info: 0 }; combined.forEach(a => counts[a.type] = (counts[a.type] || 0) + 1);
  document.querySelector("#alertTotal").textContent = combined.length; document.querySelector("#alertWarning").textContent = counts.warning; document.querySelector("#alertDanger").textContent = counts.danger; document.querySelector("#alertInfo").textContent = counts.info;
  const icons = { warning: "⚠", danger: "⚠", info: "ⓘ" };
  document.querySelector("#alertsFull").innerHTML = filtered.map(a => `<div class="full-alert ${esc(a.type)}"><div class="alert-symbol">${icons[a.type] || "ⓘ"}</div><div style="flex:1"><b>${esc(a.title)}${a.auto ? '<span class="auto-tag">AUTOMÁTICO</span>' : ""}</b><small>${esc(a.message)}</small><small>Viagem: ${esc(tripNameById(trips, a.tripId))}</small></div>${a.auto ? "" : `<button class="text-btn danger-btn" onclick="removeItem('alerts',${a.id})">Excluir</button>`}</div>`).join("") || `<div class="empty-state">Nenhum alerta neste filtro.</div>`;
}

async function refreshSections() {
  try {
    const all = await allResources();
    const dashboard = await api(`/api/dashboard?tripId=${currentTripId}`);
    renderTripsFull(all.trips); renderBudgetsFull(all.budgets, all.trips, all.overview);
    const tripSel = document.querySelector("#expenseTripFilter"), prev = tripSel.value; tripSel.innerHTML = tripOptions(all.trips); if (prev) tripSel.value = prev;
    renderExpenseStats(all.expenses); await loadExpensesTable(all.trips);
    renderItineraryFull(all.itinerary, all.trips); renderGoalsFull(all.goals);
    renderAlertsFull(all.alerts, dashboard.alerts.filter(a => a.auto), all.trips);
    renderReports(dashboard, all);
  } catch (e) { console.error(e); toast(`Não foi possível atualizar os dados: ${e.message}`, true); }
}

async function removeItem(resource, id) {
  if (!confirm("Deseja realmente excluir este registro?")) return;
  try { await api(`/api/${resource}/${id}`, { method: "DELETE" }); toast("Registro excluído com sucesso."); await refreshSections(); if (resource === "trips") await loadTripSelector(); }
  catch (e) { toast(e.message, true); }
}

function navigate(section) {
  if (!sectionNames[section]) section = "dashboard";
  document.querySelectorAll(".nav-item").forEach(a => a.classList.toggle("active", a.dataset.section === section));
  const content = document.querySelector(".content"); content.classList.toggle("section-mode", section !== "dashboard");
  document.querySelectorAll(".app-section").forEach(s => s.classList.toggle("active", s.id === `section-${section}`));
  document.querySelector(".functional-note").style.display = section === "dashboard" ? "" : "none";
  document.querySelector(".page-title h1").textContent = sectionNames[section];
  if (section !== "dashboard") refreshSections(); else loadDashboard().catch(e => toast(e.message, true));
  if (location.hash !== `#${section}`) history.pushState({}, "", `#${section}`);
}

let searchTimer;
function bindFilters() {
  const debounced = () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { expensePage = 1; refreshSections(); }, 300); };
  ["tripSearch", "expenseSearch"].forEach(id => document.querySelector(`#${id}`)?.addEventListener("input", debounced));
  ["tripStatusFilter", "expenseCategoryFilter", "expenseTripFilter", "expenseSort", "itineraryTripFilter", "alertFilter"].forEach(id => document.querySelector(`#${id}`)?.addEventListener("change", () => { expensePage = 1; refreshSections(); }));
  document.querySelectorAll(".report-tab").forEach(btn => btn.addEventListener("click", () => { document.querySelectorAll(".report-tab").forEach(b => b.classList.remove("active")); document.querySelectorAll(".report-tab-content").forEach(c => c.classList.remove("active")); btn.classList.add("active"); document.querySelector(`#report-${btn.dataset.reportTab}`).classList.add("active"); }));
  document.querySelector("#dashTripSelect")?.addEventListener("change", (e) => loadDashboard(e.target.value).catch(err => toast(err.message, true)));
  document.querySelector("#evolutionMode")?.addEventListener("change", () => lastDashboard && renderEvolution(lastDashboard));
  document.querySelector("#aiGenerate")?.addEventListener("click", () => generateInsights(document.querySelector("#aiGenerate").textContent.includes("novamente")));
}

// ---------- Modais: criação (POST) e edição (PUT) ----------
const NUMERIC = ["tripId", "travelers", "amount", "estimatedCost", "targetAmount", "currentAmount", "totalBudget", "dailyBudget"];

function openModal(id) {
  const modal = document.querySelector(`#${id}`);
  const form = modal.querySelector("form");
  if (form && form.elements.tripId && !form.elements.tripId.value) form.elements.tripId.value = currentTripId;
  modal.classList.add("open");
}
function closeModal(modal) {
  modal.classList.remove("open");
  const form = modal.querySelector("form");
  if (form) { form.reset(); if (form.elements.id) form.elements.id.value = ""; form.querySelectorAll(".field-error").forEach(el => el.classList.remove("field-error")); }
  if (modal.id === "expenseModal") { document.querySelector("#expenseModalTitle").textContent = "Nova despesa"; document.querySelector("#categoryHint").textContent = ""; }
}

async function editExpense(id) {
  try {
    const e = await api(`/api/expenses/${id}`);
    const form = document.querySelector("#expenseForm");
    for (const k of ["id", "tripId", "category", "description", "amount", "date"]) form.elements[k].value = e[k];
    document.querySelector("#expenseModalTitle").textContent = `Editar despesa #${id}`;
    document.querySelector("#expenseModal").classList.add("open");
  } catch (err) { toast(err.message, true); }
}

async function suggestCategory() {
  const form = document.querySelector("#expenseForm"), hint = document.querySelector("#categoryHint");
  const description = form.elements.description.value.trim();
  if (!description) { hint.textContent = "Digite a descrição primeiro."; return; }
  hint.textContent = "✨ Consultando IA…";
  try {
    const r = await api("/api/ai/classify-expense", { method: "POST", body: { description, amount: Number(form.elements.amount.value) || undefined } });
    form.elements.category.value = r.category;
    hint.textContent = `✨ Sugestão: ${r.category} (${Math.round(r.confidence * 100)}% • ${r.source === "llm" ? r.model : "regras locais"}) — ${r.reason}`;
  } catch (e) { hint.textContent = ""; toast(e.message, true); }
}

function bindModals() {
  document.querySelectorAll("[data-open-modal]").forEach(btn => btn.addEventListener("click", () => openModal(btn.dataset.openModal)));
  document.querySelectorAll(".modal-close").forEach(btn => btn.addEventListener("click", () => closeModal(btn.closest(".modal"))));
  document.querySelectorAll(".modal").forEach(m => m.addEventListener("click", e => { if (e.target === m) closeModal(m); }));
  document.querySelector("#suggestCategory")?.addEventListener("click", suggestCategory);
  document.querySelectorAll(".modal form").forEach(form => form.addEventListener("submit", async e => {
    e.preventDefault();
    const payload = {}; let id = null;
    new FormData(form).forEach((v, k) => { if (k === "id") { id = v || null; return; } if (v !== "") payload[k] = NUMERIC.includes(k) ? Number(v) : v; });
    const btn = form.querySelector("[type=submit]"); btn.disabled = true;
    form.querySelectorAll(".field-error").forEach(el => el.classList.remove("field-error"));
    try {
      const resource = form.dataset.resource;
      const res = await apiFull(id ? `/api/${resource}/${id}` : `/api/${resource}`, { method: id ? "PUT" : "POST", body: payload });
      closeModal(form.closest(".modal"));
      const ai = res.meta?.categorizedBy;
      toast(ai ? `Salvo! Categoria "${res.data.category}" definida automaticamente (${ai === "llm" ? "IA" : "regras"}).` : id ? "Registro atualizado com sucesso." : "Registro salvo com sucesso.");
      await refreshSections(); if (resource === "trips") await loadTripSelector(); await loadDashboard();
    } catch (err) {
      toast(err.message, true);
      err.message.split(" • ").slice(1).forEach(part => form.elements[part.split(":")[0]]?.classList.add("field-error"));
    } finally { btn.disabled = false; }
  }));
}

async function saveProfile() {
  try {
    const name = document.querySelector("#settingsName").value.trim(), email = document.querySelector("#settingsEmail").value.trim();
    await api("/api/users/1", { method: "PATCH", body: { name, email } });
    toast("Perfil atualizado com sucesso."); loadProfile();
  } catch (e) { toast(e.message, true); }
}
function savePreferences() { localStorage.setItem("travelcashPreferences", JSON.stringify({ budget: prefBudget.checked, daily: prefDaily.checked, route: prefRoute.checked })); toast("Preferências de notificações salvas."); }
function saveFinance() { localStorage.setItem("travelcashFinance", JSON.stringify({ currency: settingsCurrency.value, dailyLimit: settingsDailyLimit.value })); toast("Regras financeiras salvas."); }
function loadPreferences() {
  try {
    const p = JSON.parse(localStorage.getItem("travelcashPreferences") || "null"), f = JSON.parse(localStorage.getItem("travelcashFinance") || "null");
    if (p) { prefBudget.checked = !!p.budget; prefDaily.checked = !!p.daily; prefRoute.checked = !!p.route; }
    if (f) { settingsCurrency.value = f.currency || "BRL"; settingsDailyLimit.value = f.dailyLimit || 250; }
  } catch (_e) { }
}

async function downloadReport() {
  try {
    const all = await allResources(), lines = [["Viagem", "Categoria", "Descrição", "Data", "Valor"], ...all.expenses.map(e => [tripNameById(all.trips, e.tripId), e.category, e.description, e.date, Number(e.amount || 0).toFixed(2)])];
    const csv = lines.map(row => row.map(v => `"${String(v).replaceAll('"', '""')}"`).join(",")).join("\n"), blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }), url = URL.createObjectURL(blob), a = document.createElement("a"); a.href = url; a.download = "relatorio-travelcash.csv"; a.click(); URL.revokeObjectURL(url); toast("Relatório CSV gerado.");
  } catch (e) { toast(e.message, true); }
}

document.querySelectorAll(".nav-item").forEach(item => item.addEventListener("click", e => { e.preventDefault(); navigate(item.dataset.section); }));
document.querySelector("#saveProfile")?.addEventListener("click", saveProfile); document.querySelector("#savePreferences")?.addEventListener("click", savePreferences); document.querySelector("#saveFinance")?.addEventListener("click", saveFinance); document.querySelector("#downloadReport")?.addEventListener("click", downloadReport); document.querySelector("#printReport")?.addEventListener("click", () => window.print()); document.querySelector("#recalculateBudget")?.addEventListener("click", refreshSections);
document.querySelector("#clearReadAlerts")?.addEventListener("click", async () => {
  try { const rows = await api(`/api/alerts?tripId=${currentTripId}&type=info&limit=100`); await Promise.all(rows.map(a => api(`/api/alerts/${a.id}`, { method: "DELETE" }))); toast("Avisos informativos removidos."); refreshSections(); }
  catch (e) { toast("Não foi possível limpar os avisos.", true); }
});
bindFilters(); bindModals(); loadPreferences();
window.addEventListener("hashchange", () => navigate(location.hash.replace("#", "") || "dashboard"));

init().then(() => { const initial = location.hash.replace("#", "") || "dashboard"; if (initial !== "dashboard") navigate(initial); });

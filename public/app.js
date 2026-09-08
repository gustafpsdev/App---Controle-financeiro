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

async function api(path) {
  const response = await fetch(path);
  const json = await response.json();
  if (!response.ok || !json.success) throw new Error(json.error?.message || "Erro na API");
  return json.data;
}

function renderCategories(data) {
  const total = data.summary.totalSpent || 1;
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
      <span class="name">${name}</span>
      <span class="value">${money(amount)}</span>
    </div>
  `).join("") + `<div class="legend-total"><b>Total</b><b>${money(total)}</b></div>`;
}

function renderAlerts(alerts) {
  const icons = { warning: "⚠", danger: "⚠", info: "ⓘ" };
  document.querySelector("#alertsList").innerHTML = alerts.map(a => `
    <div class="alert-box ${a.type}">
      <div class="alert-symbol">${icons[a.type] || "ⓘ"}</div>
      <div><b>${a.title}</b><small>${a.message}</small></div>
    </div>
  `).join("");
}

function renderItinerary(items) {
  document.querySelector("#itineraryList").innerHTML = items.map(item => `
    <div class="itinerary-item">
      <div class="date-box"><b>${item.date.slice(8,10)}</b><span>${item.date.slice(5,7) === "06" ? "JUN" : item.date.slice(5,7)}</span></div>
      <div><div class="item-title">${item.title}</div><div class="item-sub">⌖ ${item.location || "Destino da viagem"}</div></div>
      <div class="item-cost"><span>Custo previsto</span>${money(item.estimatedCost)}</div>
    </div>
  `).join("");
}

function renderGoals(goals) {
  document.querySelector("#goalsList").innerHTML = goals.map((goal, index) => {
    const progress = Number(goal.targetAmount) ? (Number(goal.currentAmount) / Number(goal.targetAmount)) * 100 : 0;
    return `
      <div class="goal-item">
        <div class="goal-head">
          <div class="goal-icon">${index === 0 ? "✈" : "🐷"}</div>
          <div class="goal-name">${goal.name}</div>
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
      <td>${e.description}</td>
      <td><span class="tag ${tagClass[e.category] || "fun"}">${e.category}</span></td>
      <td>${money(e.amount)}</td>
    </tr>
  `).join("");
}

async function loadDashboard(tripId = 1) {
  const data = await api(`/api/dashboard?tripId=${tripId}`);
  const { trip, summary } = data;

  document.querySelector("#tripName").textContent = trip.name;
  document.querySelector("#tripMeta").innerHTML =
    `${dateBR(trip.startDate)} até ${dateBR(trip.endDate)} <span>•</span> ${trip.travelers} viajantes`;
  document.querySelector("#tripStatus").textContent = trip.status;

  document.querySelector("#budgetTotal").textContent = money(summary.totalBudget);
  document.querySelector("#budgetSpent").textContent = money(summary.totalSpent);
  document.querySelector("#budgetRemaining").textContent = money(summary.remaining);
  document.querySelector("#budgetUtilization").textContent = `${summary.utilization.toFixed(1).replace(".", ",")}%`;
  document.querySelector("#donutPercent").textContent = `${summary.utilization.toFixed(1).replace(".", ",")}%`;
  document.querySelector("#donutPercent").parentElement.parentElement.style.background =
    `conic-gradient(#ec9118 0 ${summary.utilization}%, #e6e6e6 ${summary.utilization}% 100%)`;

  document.querySelector("#totalSpentCard").textContent = money(summary.totalSpent);
  document.querySelector("#dailyAverage").textContent = money(summary.dailyAverage);

  renderCategories(data);
  renderAlerts(data.alerts);
  renderItinerary(data.itinerary);
  renderGoals(data.goals);
  renderExpenses(data.expenses);
}

async function init() {
  try {
    await loadDashboard();
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
  if (error) el.style.borderLeftColor = "#c84242";
  document.body.appendChild(el); setTimeout(() => el.remove(), 2600);
}

async function allResources() {
  const [trips,budgets,expenses,itinerary,goals,alerts,transports,insurances] = await Promise.all([
    api("/api/trips"), api("/api/budgets"), api("/api/expenses"), api("/api/itinerary"), api("/api/goals"),
    api("/api/alerts"), api("/api/transports"), api("/api/insurances")
  ]);
  return {trips,budgets,expenses,itinerary,goals,alerts,transports,insurances};
}
function tripNameById(trips,id){ return trips.find(t=>Number(t.id)===Number(id))?.name || `Viagem #${id}`; }
function pct(value,total){ return total ? Math.max(0, Math.min(100, value/total*100)) : 0; }
function statusForTrip(t){
  if(t.status) return t.status;
  const now=new Date(), start=new Date(t.startDate+"T00:00:00"), end=new Date(t.endDate+"T23:59:59");
  if(now<start) return "Planejamento"; if(now>end) return "Concluída"; return "Em andamento";
}

function renderTripsFull(rows){
  const search=(document.querySelector("#tripSearch")?.value||"").toLowerCase();
  const filter=document.querySelector("#tripStatusFilter")?.value||"all";
  const filtered=rows.filter(t=>(!search || `${t.name} ${t.destination||""}`.toLowerCase().includes(search)) && (filter==="all" || statusForTrip(t)===filter));
  const active=rows.filter(t=>statusForTrip(t)==="Em andamento").length;
  const next=rows.filter(t=>new Date(t.startDate)>=new Date()).sort((a,b)=>a.startDate.localeCompare(b.startDate))[0];
  document.querySelector("#tripCount").textContent=rows.length;
  document.querySelector("#tripActive").textContent=active;
  document.querySelector("#tripNext").textContent=next?dateBR(next.startDate):"—";
  document.querySelector("#tripTravelers").textContent=rows.reduce((s,t)=>s+Number(t.travelers||0),0);
  document.querySelector("#tripsCards").innerHTML=filtered.map(t=>`<div class="feature-card"><span class="status-pill">${statusForTrip(t)}</span><h3>${t.name}</h3><p>📍 ${t.destination||"Destino não informado"}</p><p>📅 ${dateBR(t.startDate)} até ${dateBR(t.endDate)}</p><p>👥 ${t.travelers||1} viajante(s)</p><div class="card-actions"><button class="text-btn" onclick="loadDashboard(${t.id});navigate('dashboard')">Abrir viagem</button><button class="text-btn danger-btn" onclick="removeItem('trips',${t.id})">Excluir</button></div></div>`).join("") || `<div class="empty-state">Nenhuma viagem encontrada com esses filtros.</div>`;
}

function renderBudgetsFull(budgets,trips,expenses){
  const currentBudget=budgets.find(b=>Number(b.tripId)===1)||budgets[0];
  if(currentBudget){
    const spent=expenses.filter(e=>Number(e.tripId)===Number(currentBudget.tripId)).reduce((s,e)=>s+Number(e.amount||0),0), total=Number(currentBudget.totalBudget||0);
    const used=pct(spent,total); document.querySelector("#budgetMainTotal").textContent=money(total); document.querySelector("#budgetMainTrip").textContent=tripNameById(trips,currentBudget.tripId);
    document.querySelector("#budgetMainSpent").textContent=money(spent); document.querySelector("#budgetMainRemaining").textContent=money(total-spent); document.querySelector("#budgetMainBar").style.width=used+"%";
    document.querySelector("#budgetAdvice").textContent=used>=80?"Você já consumiu uma parcela alta do orçamento. Priorize as categorias essenciais.":"Seu orçamento está sob controle. Continue registrando cada gasto para manter a previsão atualizada.";
  }
  document.querySelector("#budgetsTable").innerHTML=budgets.map(b=>{const spent=expenses.filter(e=>Number(e.tripId)===Number(b.tripId)).reduce((s,e)=>s+Number(e.amount||0),0),total=Number(b.totalBudget||0),used=pct(spent,total);return `<tr><td>${tripNameById(trips,b.tripId)}</td><td>${money(total)}</td><td>${money(b.dailyBudget)}</td><td>${money(spent)}</td><td>${used.toFixed(1).replace(".",",")}%</td><td>${money(total-spent)}</td><td><button class="text-btn danger-btn" onclick="removeItem('budgets',${b.id})">Excluir</button></td></tr>`}).join("")||`<tr><td colspan="7" class="empty-cell">Nenhum orçamento cadastrado.</td></tr>`;
}

let currentExpenses=[];
function renderExpensesFull(expenses,trips){
  currentExpenses=expenses;
  const search=(document.querySelector("#expenseSearch")?.value||"").toLowerCase(), cat=document.querySelector("#expenseCategoryFilter")?.value||"all", trip=document.querySelector("#expenseTripFilter")?.value||"all";
  const filtered=expenses.filter(e=>(!search||e.description.toLowerCase().includes(search))&&(cat==="all"||e.category===cat)&&(trip==="all"||Number(e.tripId)===Number(trip)));
  const total=expenses.reduce((s,e)=>s+Number(e.amount||0),0), byCat={}; expenses.forEach(e=>byCat[e.category]=(byCat[e.category]||0)+Number(e.amount||0));
  const top=Object.entries(byCat).sort((a,b)=>b[1]-a[1])[0], largest=[...expenses].sort((a,b)=>Number(b.amount)-Number(a.amount))[0];
  document.querySelector("#expenseCount").textContent=expenses.length; document.querySelector("#expenseTotal").textContent=money(total); document.querySelector("#expenseTopCategory").textContent=top?top[0]:"—"; document.querySelector("#expenseLargest").textContent=largest?money(largest.amount):"R$ 0,00";
  document.querySelector("#expenseTripFilter").innerHTML=`<option value="all">Todas as viagens</option>`+trips.map(t=>`<option value="${t.id}">${t.name}</option>`).join("");
  if(trip!=="all") document.querySelector("#expenseTripFilter").value=trip;
  document.querySelector("#expensesFullTable").innerHTML=filtered.sort((a,b)=>b.date.localeCompare(a.date)).map(e=>`<tr><td>${dateBR(e.date)}</td><td>${e.description}</td><td><span class="tag ${e.category==="Alimentação"?"food":e.category==="Transporte"?"transport":e.category==="Compras"?"shopping":"fun"}">${e.category}</span></td><td>${tripNameById(trips,e.tripId)}</td><td>${money(e.amount)}</td><td><button class="text-btn danger-btn" onclick="removeItem('expenses',${e.id})">Excluir</button></td></tr>`).join("")||`<tr><td colspan="6" class="empty-cell">Nenhuma despesa corresponde aos filtros.</td></tr>`;
}

function renderItineraryFull(rows,trips){
  const filter=document.querySelector("#itineraryTripFilter")?.value||"all";
  document.querySelector("#itineraryTripFilter").innerHTML=`<option value="all">Todas as viagens</option>`+trips.map(t=>`<option value="${t.id}">${t.name}</option>`).join(""); if(filter!=="all") document.querySelector("#itineraryTripFilter").value=filter;
  const filtered=rows.filter(i=>filter==="all"||Number(i.tripId)===Number(filter)).sort((a,b)=>a.date.localeCompare(b.date));
  const cost=filtered.reduce((s,i)=>s+Number(i.estimatedCost||0),0); document.querySelector("#itineraryCount").textContent=filtered.length; document.querySelector("#itineraryCost").textContent=money(cost); document.querySelector("#itineraryNext").textContent=filtered[0]?.title||"—";
  document.querySelector("#itineraryTimeline").innerHTML=filtered.map(i=>`<div class="timeline-item"><div class="timeline-date"><b>${i.date.slice(8,10)}</b><span>${dateBR(i.date).slice(3,5)}/${dateBR(i.date).slice(6)}</span></div><div class="timeline-dot"></div><div class="timeline-content"><span class="status-pill">${tripNameById(trips,i.tripId)}</span><h3>${i.title}</h3><p>⌖ ${i.location||"Local não informado"}</p><strong>Custo previsto: ${money(i.estimatedCost)}</strong><div class="card-actions"><button class="text-btn danger-btn" onclick="removeItem('itinerary',${i.id})">Excluir atividade</button></div></div></div>`).join("")||`<div class="empty-state">Nenhuma atividade cadastrada para este filtro.</div>`;
}

function renderGoalsFull(rows){
  const totalTarget=rows.reduce((s,g)=>s+Number(g.targetAmount||0),0), totalCurrent=rows.reduce((s,g)=>s+Number(g.currentAmount||0),0), overall=pct(totalCurrent,totalTarget);
  document.querySelector("#goalOverallPct").textContent=overall.toFixed(1).replace(".",",")+"%"; document.querySelector("#goalOverallBar").style.width=overall+"%"; document.querySelector("#goalOverallText").textContent=`${money(totalCurrent)} de ${money(totalTarget)}`;
  document.querySelector("#goalsFull").innerHTML=rows.map((g,index)=>{const p=pct(Number(g.currentAmount||0),Number(g.targetAmount||0));return `<div class="feature-card goal-card"><div class="goal-card-top"><div class="goal-icon-large">${index%2===0?"✈":"🐷"}</div><div><h3>${g.name}</h3><p>Objetivo financeiro</p></div><b>${p.toFixed(0)}%</b></div><div class="progress large"><i style="width:${p}%"></i></div><div class="goal-money"><span>Atual <b>${money(g.currentAmount)}</b></span><span>Meta <b>${money(g.targetAmount)}</b></span></div><div class="card-actions"><button class="text-btn" onclick="contributeGoal(${g.id})">Adicionar valor</button><button class="text-btn danger-btn" onclick="removeItem('goals',${g.id})">Excluir</button></div></div>`}).join("")||`<div class="empty-state">Crie sua primeira meta de economia.</div>`;
}

async function contributeGoal(id){
  const value=Number(prompt("Quanto deseja adicionar à meta?", "100")); if(!value||value<=0)return;
  const goal=await api(`/api/goals/${id}`); await fetch(`/api/goals/${id}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({...goal,currentAmount:Number(goal.currentAmount||0)+value})}); toast("Contribuição adicionada à meta."); refreshSections();
}

function renderReports(data,all){
  const d=data.summary; document.querySelector("#reportBudget").textContent=money(d.totalBudget); document.querySelector("#reportSpent").textContent=money(d.totalSpent); document.querySelector("#reportRemaining").textContent=money(d.remaining); document.querySelector("#reportUsage").textContent=d.utilization.toFixed(1).replace(".",",")+"%";
  document.querySelector("#reportDaily").textContent=money(d.dailyAverage); document.querySelector("#reportDays").textContent=d.days; const largest=[...all.expenses].sort((a,b)=>Number(b.amount)-Number(a.amount))[0]; document.querySelector("#reportLargest").textContent=largest?money(largest.amount):"R$ 0,00";
  document.querySelector("#reportScore").textContent=Math.max(0,Math.min(100,Math.round(100-Math.max(0,d.utilization-60)))).toString()+" / 100";
  const cats=Object.entries(data.categoryTotals).sort((a,b)=>b[1]-a[1]), max=cats[0]?.[1]||1; document.querySelector("#reportCategories").innerHTML=cats.map(([n,v])=>`<div class="break-row"><div class="break-head"><span>${n}</span><b>${money(v)}</b></div><div class="break-bar"><i style="width:${v/max*100}%"></i></div></div>`).join("")||`<div class="empty-state">Ainda não há despesas.</div>`;
  document.querySelector("#reportTrips").innerHTML=all.trips.map(t=>{const b=all.budgets.find(x=>Number(x.tripId)===Number(t.id)), spent=all.expenses.filter(e=>Number(e.tripId)===Number(t.id)).reduce((s,e)=>s+Number(e.amount||0),0), total=Number(b?.totalBudget||0), u=pct(spent,total);return `<tr><td>${t.name}</td><td>${money(total)}</td><td>${money(spent)}</td><td>${money(total-spent)}</td><td>${u.toFixed(1).replace(".",",")}%</td></tr>`}).join("");
}

function renderAlertsFull(rows){
  const filter=document.querySelector("#alertFilter")?.value||"all", filtered=rows.filter(a=>filter==="all"||a.type===filter); const counts={warning:0,danger:0,info:0}; rows.forEach(a=>counts[a.type]=(counts[a.type]||0)+1);
  document.querySelector("#alertTotal").textContent=rows.length; document.querySelector("#alertWarning").textContent=counts.warning; document.querySelector("#alertDanger").textContent=counts.danger; document.querySelector("#alertInfo").textContent=counts.info;
  const icons={warning:"⚠",danger:"⚠",info:"ⓘ"}; document.querySelector("#alertsFull").innerHTML=filtered.map(a=>`<div class="full-alert ${a.type}"><div class="alert-symbol">${icons[a.type]||"ⓘ"}</div><div style="flex:1"><b>${a.title}</b><small>${a.message}</small><small>Viagem: ${a.tripId}</small></div><button class="text-btn danger-btn" onclick="removeItem('alerts',${a.id})">Excluir</button></div>`).join("")||`<div class="empty-state">Nenhum alerta neste filtro.</div>`;
}

async function refreshSections(){
  try{
    const all=await allResources();
    renderTripsFull(all.trips); renderBudgetsFull(all.budgets,all.trips,all.expenses); renderExpensesFull(all.expenses,all.trips); renderItineraryFull(all.itinerary,all.trips); renderGoalsFull(all.goals); renderAlertsFull(all.alerts);
    const dashboard=await api("/api/dashboard?tripId=1"); renderReports(dashboard,all);
  }catch(e){console.error(e);toast("Não foi possível atualizar os dados.",true);}
}

async function removeItem(resource,id){
  if(!confirm("Deseja realmente excluir este registro?"))return;
  try{const r=await fetch(`/api/${resource}/${id}`,{method:"DELETE"}); const j=await r.json(); if(!r.ok||!j.success)throw new Error(j.error?.message||"Erro"); toast("Registro excluído com sucesso."); await refreshSections();}
  catch(e){toast(e.message,true);}
}

function navigate(section){
  if(!sectionNames[section])section="dashboard";
  document.querySelectorAll(".nav-item").forEach(a=>a.classList.toggle("active",a.dataset.section===section));
  const content=document.querySelector(".content"); content.classList.toggle("section-mode",section!=="dashboard");
  document.querySelectorAll(".app-section").forEach(s=>s.classList.toggle("active",s.id===`section-${section}`));
  document.querySelector(".functional-note").style.display=section==="dashboard"?"":"none";
  document.querySelector(".page-title h1").textContent=sectionNames[section]; document.querySelector(".page-title p").textContent=section==="dashboard"?"Bem-vinda, Giovanna! 👋":"TravelCash • Controle financeiro para viagens";
  if(section!=="dashboard")refreshSections();
  if(location.hash!==`#${section}`)history.pushState({},"",`#${section}`);
}

function bindFilters(){
  ["tripSearch","tripStatusFilter","expenseSearch","expenseCategoryFilter","expenseTripFilter","itineraryTripFilter","alertFilter"].forEach(id=>document.querySelector(`#${id}`)?.addEventListener("input",refreshSections));
  document.querySelectorAll(".report-tab").forEach(btn=>btn.addEventListener("click",()=>{document.querySelectorAll(".report-tab").forEach(b=>b.classList.remove("active"));document.querySelectorAll(".report-tab-content").forEach(c=>c.classList.remove("active"));btn.classList.add("active");document.querySelector(`#report-${btn.dataset.reportTab}`).classList.add("active");}));
}

function bindModals(){
  document.querySelectorAll("[data-open-modal]").forEach(btn=>btn.addEventListener("click",()=>document.querySelector(`#${btn.dataset.openModal}`).classList.add("open")));
  document.querySelectorAll(".modal-close").forEach(btn=>btn.addEventListener("click",()=>btn.closest(".modal").classList.remove("open")));
  document.querySelectorAll(".modal").forEach(m=>m.addEventListener("click",e=>{if(e.target===m)m.classList.remove("open")}));
  document.querySelectorAll(".modal form").forEach(form=>form.addEventListener("submit",async e=>{e.preventDefault();const payload={};new FormData(form).forEach((v,k)=>{if(v!=="")payload[k]=["tripId","travelers","amount","estimatedCost","targetAmount","currentAmount","totalBudget","dailyBudget"].includes(k)?Number(v):v});try{const r=await fetch(`/api/${form.dataset.resource}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)}),j=await r.json();if(!r.ok||!j.success)throw new Error(j.error?.message||"Erro");form.closest(".modal").classList.remove("open");form.reset();toast("Registro salvo com sucesso.");await refreshSections();}catch(err){toast(err.message,true);}}));
}

async function saveProfile(){
  try{const current=await api("/api/users/1"), name=document.querySelector("#settingsName").value.trim(), email=document.querySelector("#settingsEmail").value.trim();const r=await fetch("/api/users/1",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({...current,name,email})});const j=await r.json();if(!r.ok||!j.success)throw new Error(j.error?.message||"Erro");toast("Perfil atualizado com sucesso.");}catch(e){toast(e.message,true);}
}
function savePreferences(){ localStorage.setItem("travelcashPreferences",JSON.stringify({budget:prefBudget.checked,daily:prefDaily.checked,route:prefRoute.checked}));toast("Preferências de notificações salvas."); }
function saveFinance(){ localStorage.setItem("travelcashFinance",JSON.stringify({currency:settingsCurrency.value,dailyLimit:settingsDailyLimit.value}));toast("Regras financeiras salvas."); }
function loadPreferences(){
  try{
    const p=JSON.parse(localStorage.getItem("travelcashPreferences")||"null"), f=JSON.parse(localStorage.getItem("travelcashFinance")||"null");
    if(p){prefBudget.checked=!!p.budget;prefDaily.checked=!!p.daily;prefRoute.checked=!!p.route;}
    if(f){settingsCurrency.value=f.currency||"BRL";settingsDailyLimit.value=f.dailyLimit||250;}
  }catch(_e){}
}

async function downloadReport(){
  const all=await allResources(), lines=[["Viagem","Categoria","Descrição","Data","Valor"],...all.expenses.map(e=>[tripNameById(all.trips,e.tripId),e.category,e.description,e.date,Number(e.amount||0).toFixed(2)])];
  const csv=lines.map(row=>row.map(v=>`"${String(v).replaceAll('"','""')}"`).join(",")).join("\n"), blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8"}), url=URL.createObjectURL(blob), a=document.createElement("a"); a.href=url;a.download="relatorio-travelcash.csv";a.click();URL.revokeObjectURL(url);toast("Relatório CSV gerado.");
}

document.querySelectorAll(".nav-item").forEach(item=>item.addEventListener("click",e=>{e.preventDefault();navigate(item.dataset.section);}));
document.querySelector("#saveProfile")?.addEventListener("click",saveProfile); document.querySelector("#savePreferences")?.addEventListener("click",savePreferences); document.querySelector("#saveFinance")?.addEventListener("click",saveFinance); document.querySelector("#downloadReport")?.addEventListener("click",downloadReport); document.querySelector("#printReport")?.addEventListener("click",()=>window.print()); document.querySelector("#recalculateBudget")?.addEventListener("click",refreshSections);
document.querySelector("#clearReadAlerts")?.addEventListener("click",async()=>{
  try{const rows=await api("/api/alerts?tripId=1"); await Promise.all(rows.filter(a=>a.type==="info").map(a=>fetch(`/api/alerts/${a.id}`,{method:"DELETE"}))); toast("Avisos informativos removidos."); refreshSections();}
  catch(e){toast("Não foi possível limpar os avisos.",true);}
});
bindFilters();bindModals();loadPreferences();
window.addEventListener("hashchange",()=>navigate(location.hash.replace("#","")||"dashboard"));

init().then(()=>{ const initial=location.hash.replace("#","")||"dashboard"; if(initial!=="dashboard")navigate(initial); });

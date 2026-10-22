const root = document.getElementById("root");

const apiUrl = (path) => {
  const base = window.__SIPAT_CONFIG__?.apiBaseUrl?.replace(/\/$/, "");
  return base ? `${base}${path}` : path;
};

const escapeHtml = (value) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const formatTime = (seconds) => {
  const value = Math.max(0, Math.round(Number(seconds) || 0));
  return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
};

const parseDate = (value) => new Date(String(value).endsWith("Z") ? value : `${value}Z`);
const average = (items, field) => items.reduce((sum, item) => sum + (Number(item[field]) || 0), 0) / items.length;
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

let adminCode = "";
let records = [];
let dateFrom = "";
let dateTo = "";

function filteredRecords() {
  const from = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
  const to = dateTo ? new Date(`${dateTo}T23:59:59.999`) : null;
  return records.filter((record) => {
    const completed = parseDate(record.completedAt);
    return (!from || completed >= from) && (!to || completed <= to);
  });
}

function buildRanking(source) {
  const groups = new Map();
  source
    .filter((record) => String(record.employeeId || "").trim())
    .sort((a, b) => parseDate(a.completedAt) - parseDate(b.completedAt))
    .forEach((record) => {
      const key = String(record.employeeId).trim();
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(record);
    });

  const ranking = Array.from(groups.entries()).map(([employeeId, allAttempts]) => {
    const attempts = allAttempts.slice(0, 5);
    const avgScore = average(attempts, "score");
    const avgTime = average(attempts, "elapsedSeconds");
    const avgErrors = average(attempts, "errors");
    const scoreComponent = clamp(avgScore / 4500, 0, 1) * 50;
    const timeComponent = clamp((600 - avgTime) / 600, 0, 1) * 35;
    const attemptComponent = clamp((5 - attempts.length) / 4, 0, 1) * 15;
    return {
      employeeId,
      name: attempts.at(-1)?.name || "—",
      considered: attempts.length,
      discarded: Math.max(0, allAttempts.length - 5),
      avgScore,
      avgTime,
      avgErrors,
      index: scoreComponent + timeComponent + attemptComponent,
      lastCompletion: attempts.at(-1)?.completedAt,
    };
  });

  ranking.sort(
    (a, b) =>
      b.index - a.index ||
      b.avgScore - a.avgScore ||
      a.avgTime - b.avgTime ||
      a.considered - b.considered ||
      a.employeeId.localeCompare(b.employeeId, "pt-BR"),
  );
  return ranking.map((item, index) => ({ ...item, position: index + 1 }));
}

function downloadCsv(filename, rows) {
  const quote = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const csv = rows.map((row) => row.map(quote).join(";")).join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(href);
}

function renderLogin(message = "") {
  root.innerHTML = `
    <main class="results-page"><section class="results-shell">
      <header><div class="brand"><img src="./game/pixel/cipa-sipat-16bit.png" alt="Logo CIPA SIPAT"><div><strong>RESULTADOS DA MISSÃO</strong><span>Painel restrito da organização</span></div></div><a href="./">← Voltar ao game</a></header>
      <form class="access-card" id="login-form">
        <span class="eyebrow">ACESSO RESTRITO</span><h1>Resultados da SIPAT</h1>
        <p>Digite o código administrativo para visualizar, apurar e exportar os resultados.</p>
        <label for="admin-code">Código administrativo</label>
        <input id="admin-code" type="password" autocomplete="current-password" required placeholder="Digite o código de acesso">
        <button>Acessar resultados</button>
        ${message ? `<small role="alert">${escapeHtml(message)}</small>` : ""}
        <div class="access-security">A classificação é exclusiva da organização da SIPAT.</div>
      </form>
    </section></main>`;
  document.getElementById("login-form").addEventListener("submit", login);
}

async function login(event) {
  event.preventDefault();
  adminCode = document.getElementById("admin-code").value;
  try {
    const response = await fetch(apiUrl("/api/admin/results"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: adminCode }),
      cache: "no-store",
    });
    const data = await response.json();
    if (!response.ok) throw new Error();
    records = data.results || [];
    renderResults();
  } catch {
    renderLogin("Código inválido ou painel indisponível.");
  }
}

function renderResults() {
  const filtered = filteredRecords();
  const ranking = buildRanking(filtered);
  const discarded = ranking.reduce((sum, item) => sum + item.discarded, 0);
  const averageIndex = ranking.length ? ranking.reduce((sum, item) => sum + item.index, 0) / ranking.length : 0;

  root.innerHTML = `
    <main class="results-page"><section class="results-shell">
      <header><div class="brand"><img src="./game/pixel/cipa-sipat-16bit.png" alt="Logo CIPA SIPAT"><div><strong>RESULTADOS DA MISSÃO</strong><span>Painel restrito da organização</span></div></div><a href="./">← Voltar ao game</a></header>
      <div class="results-content">
        <div class="results-title"><div><span class="eyebrow">CLASSIFICAÇÃO ADMINISTRATIVA</span><h1>${ranking.length} participantes</h1><p>${filtered.length} conclusões no período · até 5 por matrícula</p></div>
          <div class="results-actions">
            <button id="cleanup">⌫ Limpar testes</button><button class="danger-action" id="reset">⚠ Zerar resultados</button>
            <button id="export-ranking">↓ Exportar classificação</button><button id="export-records">↓ Exportar registros</button>
          </div>
        </div>
        <div class="results-summary">
          <article><span>PARTICIPANTES</span><b>${ranking.length}</b><small>matrículas únicas</small></article>
          <article><span>CONCLUSÕES</span><b>${filtered.length}</b><small>no período filtrado</small></article>
          <article><span>ÍNDICE MÉDIO</span><b>${averageIndex.toFixed(1)}</b><small>escala de 0 a 100</small></article>
          <article><span>DESCARTADAS</span><b>${discarded}</b><small>acima da 5ª conclusão</small></article>
        </div>
        <div class="results-toolbar">
          <label><span>Jogado a partir de</span><input id="date-from" type="date" value="${dateFrom}" max="${dateTo}"></label>
          <label><span>Jogado até</span><input id="date-to" type="date" value="${dateTo}" min="${dateFrom}"></label>
          <button id="clear-filter">Limpar período</button>
        </div>
        <div class="table-wrap"><table><thead><tr><th>Posição</th><th>Matrícula</th><th>Nome</th><th>Conclusões</th><th>Média pontos</th><th>Média tempo</th><th>Média erros</th><th>Índice final</th><th>Última conclusão</th></tr></thead>
          <tbody>${ranking.length ? ranking.map((item) => `<tr${item.position <= 3 ? ' class="top-three"' : ""}><td><strong>${item.position}º</strong></td><td>${escapeHtml(item.employeeId)}</td><td><strong>${escapeHtml(item.name)}</strong></td><td>${item.considered}${item.discarded ? ` <small>(+${item.discarded} descartada${item.discarded > 1 ? "s" : ""})</small>` : ""}</td><td>${item.avgScore.toFixed(0)}</td><td>${formatTime(item.avgTime)}</td><td>${item.avgErrors.toFixed(1)}</td><td><b class="score-cell">${item.index.toFixed(2)}</b></td><td>${item.lastCompletion ? parseDate(item.lastCompletion).toLocaleString("pt-BR") : "—"}</td></tr>`).join("") : '<tr><td colspan="9" class="empty-results">Nenhum resultado encontrado no período.</td></tr>'}</tbody>
        </table></div>
        <div class="governance-note"><strong>Critério de premiação</strong><p>O índice considera as cinco primeiras conclusões de cada matrícula: 50% da média de pontuação, 35% da média de tempo e 15% da eficiência por quantidade de conclusões. A pontuação do jogo já considera os erros. Em empate: maior média de pontos, menor média de tempo e menos conclusões. A classificação é restrita à comissão da SIPAT.</p></div>
      </div>
    </section></main>`;

  document.getElementById("date-from").addEventListener("change", (event) => { dateFrom = event.target.value; renderResults(); });
  document.getElementById("date-to").addEventListener("change", (event) => { dateTo = event.target.value; renderResults(); });
  document.getElementById("clear-filter").addEventListener("click", () => { dateFrom = ""; dateTo = ""; renderResults(); });
  document.getElementById("export-ranking").addEventListener("click", () => exportRanking(ranking));
  document.getElementById("export-records").addEventListener("click", () => exportRecords(filtered));
  document.getElementById("cleanup").addEventListener("click", cleanupTests);
  document.getElementById("reset").addEventListener("click", resetResults);
}

function exportRanking(ranking) {
  const rows = [["Posição", "Matrícula", "Nome", "Conclusões consideradas", "Conclusões descartadas", "Média de pontuação", "Média de tempo", "Média de erros", "Índice final", "Última conclusão"]];
  ranking.forEach((item) => rows.push([item.position, item.employeeId, item.name, item.considered, item.discarded, item.avgScore.toFixed(2), formatTime(item.avgTime), item.avgErrors.toFixed(2), item.index.toFixed(2), parseDate(item.lastCompletion).toLocaleString("pt-BR")]));
  downloadCsv(`classificacao-sipat-${new Date().toISOString().slice(0, 10)}.csv`, rows);
}

function exportRecords(source) {
  const rows = [["Matrícula", "Nome", "Pontuação", "Erros", "Tempo", "Personagem", "Conclusão"]];
  source.forEach((item) => rows.push([item.employeeId || "", item.name, item.score, item.errors, formatTime(item.elapsedSeconds), item.character === "female" ? "Feminino" : "Masculino", parseDate(item.completedAt).toLocaleString("pt-BR")]));
  downloadCsv(`registros-sipat-${new Date().toISOString().slice(0, 10)}.csv`, rows);
}

async function cleanupTests() {
  if (!confirm("Excluir registros antigos sem matrícula? Esta ação não pode ser desfeita.")) return;
  try {
    const response = await fetch(apiUrl("/api/admin/results/cleanup"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: adminCode, confirmation: "EXCLUIR TESTES" }) });
    const data = await response.json();
    if (!response.ok) throw new Error();
    records = records.filter((item) => item.employeeId);
    alert(`${data.deleted} registro(s) de teste excluído(s).`);
    renderResults();
  } catch { alert("Não foi possível excluir a base de testes."); }
}

async function resetResults() {
  const confirmation = prompt("Esta ação apaga definitivamente todos os resultados. Antes de continuar, exporte o CSV. Para confirmar, digite: ZERAR TODOS OS RESULTADOS");
  if (confirmation !== "ZERAR TODOS OS RESULTADOS") return;
  try {
    const response = await fetch(apiUrl("/api/admin/results/reset"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: adminCode, confirmation }) });
    const data = await response.json();
    if (!response.ok) throw new Error();
    records = [];
    alert(`${data.deleted} resultado(s) excluído(s). A base foi zerada.`);
    renderResults();
  } catch { alert("Não foi possível zerar os resultados."); }
}

renderLogin();

/* Atendimento ao Cliente — FCU (MBO e NOT MBO) · Enel Brasil Grids · Gestão de Programação
 * data/base.js      -> window.FCU_ATD  (foto atual: todos os indicadores, gráficos, mapa e listas)
 * data/historico.js -> window.FCU_HIST (fotos anteriores: só para o histórico por projeto e por nota)
 */
(() => {
'use strict';
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const nf = new Intl.NumberFormat('pt-BR'), nf2 = new Intl.NumberFormat('pt-BR', {maximumFractionDigits: 2});
const num = v => v == null || v === '' ? '—' : (typeof v === 'number' ? nf2.format(v) : esc(v));
const fd = s => s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : '—';
const fdc = s => s ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : '—';
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const fmes = m => m ? `${MESES[+m.slice(5, 7) - 1]}/${m.slice(2, 4)}` : '—';
const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const isoNow = () => new Date().toLocaleString('sv-SE', {timeZone: 'America/Sao_Paulo'});
const hojeISO = () => isoNow().slice(0, 10);
const dias = iso => iso ? Math.round((Date.parse(iso + 'T00:00:00Z') - Date.parse(hojeISO() + 'T00:00:00Z')) / 864e5) : null;
const gm = (a, b) => `https://www.google.com/maps/search/?api=1&query=${a},${b}`;
const wz = (a, b) => `https://waze.com/ul?ll=${a},${b}&navigate=yes`;
const sv = (a, b) => `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${a},${b}`;
const goLinks = (a, b) => `<span class="go"><a class="gm" href="${gm(a, b)}" target="_blank" rel="noopener">Google Maps</a><a class="wz" href="${wz(a, b)}" target="_blank" rel="noopener">Waze</a><a href="${sv(a, b)}" target="_blank" rel="noopener">Street View</a></span>`;
const toast = (m, t = 3500) => { const e = $('#toast'); e.textContent = m; e.hidden = false; clearTimeout(e._t); e._t = setTimeout(() => e.hidden = true, t); };

/* ---------- cores ---------- */
const C_MBO = {'MBO': '#0b4fa8', 'NOT MBO': '#eb6834'};
const C_PRAZO = {'No prazo': '#0ca30c', 'Vencida': '#d03b3b', 'Concluída': '#7b8794', 'Sem prazo': '#c3cad6'};
const C_EXEC = {'Carteira': '#1f6fd1', 'Programado': '#0b3f80', 'Programado Parcial': '#7fb2ee', 'Paralisado': '#d03b3b', 'Concluído': '#0ca30c', 'Elétricamente Concl': '#6cc46c', 'Reparo Programado': '#fab219'};
const AGING = ['Vencida', '<=10 Dias', '11 a 15 Dias', '16 a 30 Dias', '31 a 60 Dias', '61 a 90 Dias', '91 a 120 Dias', '>120 Dias'];
const C_AGING = ['#6b7280', '#7a1f1f', '#e33b2e', '#f2562b', '#fb8c2d', '#fcd535', '#9be15d', '#2fe28a'];
const PAL = ['#0b4fa8', '#eb6834', '#0ca30c', '#fab219', '#6250d6', '#1f9bd7', '#d03b3b', '#7b8794', '#c2185b', '#2e7d6b', '#8d6e63', '#5c6bc0'];

/* ---------- dados ---------- */
function decode(obj) {
  const cols = obj.cols, n = cols[0].v.length, rows = new Array(n);
  for (let i = 0; i < n; i++) {
    const r = {};
    for (const c of cols) { const x = c.v[i]; r[c.n] = c.d ? (x < 0 ? null : c.d[x]) : x; }
    rows[i] = r;
  }
  return rows;
}
function encode(rows, names) {
  return names.map(nm => {
    const vals = rows.map(r => r[nm] ?? null);
    if (vals.every(v => v == null || typeof v === 'number')) return {n: nm, v: vals};
    const d = [], idx = new Map();
    return {n: nm, d, v: vals.map(v => { if (v == null) return -1; v = String(v); if (!idx.has(v)) { idx.set(v, d.length); d.push(v); } return idx.get(v); })};
  });
}
function refDate(rows) {
  const cnt = new Map();
  for (const r of rows) if (r.Prazo_Final_DELI && r['Qtd Dias p/ Venc'] != null) {
    const d = new Date(Date.parse(r.Prazo_Final_DELI + 'T00:00:00Z') - r['Qtd Dias p/ Venc'] * 864e5).toISOString().slice(0, 10);
    cnt.set(d, (cnt.get(d) || 0) + 1);
  }
  return [...cnt].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}

const S = {
  base: null, hist: [], rows: [], cols: [], fotos: [], byP: new Map(), byN: new Map(),
  f: {}, q: '', vis: [], mode: 'notas', sort: {notas: ['dv', 1], proj: ['dv', 1]}, page: 1, tq: '',
  mapColor: 'mbo', charts: {}, stack: [], local: null
};

/* campos acompanhados no histórico */
const HIST_P = [['Status_Projeto', 'Status do projeto'], ['KPI Projeto', 'KPI Projeto'], ['Status_Execução_Nota', 'Status de execução da nota'], ['Status_Nota', 'Status da nota'],
  ['KPI Nota', 'KPI Nota'], ['Qtde_Programacoes', 'Qtde de programações'], ['Data_Max_Prog', 'Última programação do projeto'], ['Data_Max_Prog_nota', 'Última programação da nota'],
  ['Inicio_prev', 'Início previsto'], ['Fim_prev', 'Fim previsto'], ['WL', 'WL'], ['Empreiteira_Contratos', 'Executante'], ['contrato', 'Contrato'], ['Ups_Plan', 'UPS planejado'],
  ['Ups_Exec_Projeto', 'UPS executado'], ['Prazo_Final_DELI', 'Prazo final (DELI)'], ['Qtd Dias p/ Venc', 'Dias p/ vencer'], ['STATUS_PRAZO', 'Situação do prazo'],
  ['AUX_AGING_VENC_Tabela', 'Aging'], ['dataDELI', 'Entrega (dataDELI)'], ['dataDELIPJ', 'dataDELIPJ'], ['KPI MBO', 'KPI MBO'], ['camada', 'Demanda RCO (camada)']];
const NOHL = new Set(['Qtd Dias p/ Venc', 'AUX_AGING_VENC_Tabela']); // mudam sozinhos com a data da foto
const DATE_COLS = new Set(['dataAPRO', 'dataAUTO', 'dataOLLI', 'Prazo_Final_DELI', 'dataDELI', 'Data_Max_Prog', 'Data_Max_Prog_nota', 'data_nota', 'Inicio_prev', 'Fim_prev', 'dataDELIPJ']);
const fmtF = (k, v) => v == null || v === '' ? '—' : DATE_COLS.has(k) ? fd(v) : num(v);

function load(base, hist) {
  S.base = base; S.hist = hist || [];
  S.cols = base.cols.map(c => c.n);
  S.rows = decode(base);
  const ref = base.meta.referencia || refDate(S.rows);
  S.fotos = [...S.hist.map(h => ({ref: h.meta.referencia, meta: h.meta, rows: decode(h)})), {ref, meta: base.meta, rows: S.rows, atual: true}];
  for (const f of S.fotos) { f.byP = new Map(); f.byN = new Map(); for (const r of f.rows) { f.byP.set(r.Projeto, r); const k = String(r.nota); (f.byN.get(k) || f.byN.set(k, []).get(k)).push(r); } }
  const cur = S.fotos[S.fotos.length - 1], prev = S.fotos[S.fotos.length - 2];
  S.byP = cur.byP; S.byN = cur.byN; S.prev = prev;
  for (const r of S.rows) {
    r._coord = r.Latitude != null && r.Longitude != null && Math.abs(r.Latitude) > 1 ? 'Com coordenada' : 'Sem coordenada';
    r._mes = r.data_nota ? r.data_nota.slice(0, 7) : null;
    r._prazo = r.AUX_TRATAR_NOTA === 'CONCLUÍDO' ? 'Concluída' : r.STATUS_PRAZO === 'FORA DO PRAZO' ? 'Vencida' : r.STATUS_PRAZO === 'NO PRAZO' ? 'No prazo' : 'Sem prazo';
    r._mud = mudanca(r, prev?.byP.get(r.Projeto), prev);
    r._q = norm([r.Projeto, r.nota, r.CLIENTE, r.Circuito, r.bairro, r.municipio, r.contrato, r.Empreiteira_Contratos, r.Tipo_Projeto].join(' '));
  }
  buildFilters();
}
function mudanca(r, a, prev) {
  if (!prev) return 'Sem foto anterior';
  if (!a) return 'Novo na base';
  if (r.dataDELI && !a.dataDELI) return 'Entregue (DELI) no período';
  if (String(r.Qtde_Programacoes) !== String(a.Qtde_Programacoes) || (r.Data_Max_Prog || '') !== (a.Data_Max_Prog || '')) return 'Programação alterada';
  if (['Status_Execução_Nota', 'Status_Nota', 'Status_Projeto', 'KPI Nota', 'KPI Projeto'].some(k => (r[k] ?? '') !== (a[k] ?? ''))) return 'Status alterado';
  if (HIST_P.some(([k]) => !NOHL.has(k) && String(r[k] ?? '') !== String(a[k] ?? ''))) return 'Outros campos alterados';
  return 'Sem mudança';
}

/* ---------- filtros ---------- */
let F = [];
function buildFilters() {
  const pv = S.prev ? fdc(S.prev.ref) : '';
  F = [
    {g: 'Dados da Nota', k: 'Projeto', l: 'Projeto', t: 'text'},
    {g: 'Dados da Nota', k: 'nota', l: 'Nota', t: 'text'},
    {g: 'Dados da Nota', k: 'KPI Nota', l: 'KPI Nota'},
    {g: 'Dados da Nota', k: 'KPI MBO', l: 'KPI MBO'},
    {g: 'Dados da Nota', k: 'Prazo_Final_DELI', l: 'Prazo final (DELI)', t: 'date'},
    {g: 'Dados da Nota', k: 'dataDELI', l: 'Data DELI', t: 'date'},
    {g: 'Dados da Nota', k: 'AUX_RESP_NOTA', l: 'Responsável nota'},
    {g: 'Dados da Nota', k: 'Nível_Projeto', l: 'Nível projeto'},
    {g: 'Dados da Nota', k: 'Nível_Tensão', l: 'Nível de tensão'},
    {g: 'Dados da Nota', k: 'Status_Nota', l: 'Status nota'},
    {g: 'Dados da Nota', k: 'AUX_TRATAR_NOTA', l: 'Situação da nota'},
    {g: 'Dados da Nota', k: '_prazo', l: 'Situação do prazo'},
    {g: 'Dados da Nota', k: 'AUX_AGING_VENC_Tabela', l: 'Aging (dias p/ vencer)', ord: AGING},
    {g: 'Dados da Nota', k: 'Tipo_Prazo', l: 'Tipo de prazo'},
    {g: 'Dados da Nota', k: 'camada', l: 'Demanda RCO (camada)'},
    {g: 'Dados da Nota', k: 'NEC_UPS', l: 'NEC | UPS'},
    {g: 'Dados da Nota', k: 'KPI Projeto', l: 'KPI Projeto'},
    {g: 'Dados da Nota', k: '_mes', l: 'Mês de entrada da nota', desc: true, fmt: fmes},
    {g: 'Dados da Nota', k: '_mud', l: S.prev ? `Mudança desde ${pv}` : 'Mudança'},
    {g: 'Executante', k: 'Polo', l: 'Polo'},
    {g: 'Executante', k: 'Status_Execução_Nota', l: 'KPI Execução'},
    {g: 'Executante', k: 'Empreiteira_Contratos', l: 'Executante'},
    {g: 'Executante', k: 'contrato', l: 'Contrato'},
    {g: 'Executante', k: 'Area Real', l: 'Área', numeric: true},
    {g: 'Projeto', k: 'Tipo_Projeto', l: 'Tipo de projeto'},
    {g: 'Projeto', k: 'Tipo_Obj_Nota', l: 'Tipo objeto da nota'},
    {g: 'Projeto', k: 'Status_Projeto', l: 'Status do projeto'},
    {g: 'Cliente', k: 'Tipo de Cliente', l: 'Tipo de cliente'},
    {g: 'Cliente', k: 'CLIENTE', l: 'Cliente'},
    {g: 'Localização', k: 'municipio', l: 'Município'},
    {g: 'Localização', k: 'bairro', l: 'Bairro'},
    {g: 'Localização', k: 'Circuito', l: 'Circuito'},
    {g: 'Localização', k: '_coord', l: 'Coordenada'},
    {k: '_dv', l: 'Vence em', t: 'dv', hidden: true},
    {k: '_q', l: 'Pesquisa', t: 'q', hidden: true}
  ];
  F.forEach((f, i) => {
    f.i = i; f.t = f.t || 'list';
    if (f.t !== 'list') return;
    const cnt = new Map();
    for (const r of S.rows) { const v = r[f.k] == null ? '(vazio)' : String(r[f.k]); cnt.set(v, (cnt.get(v) || 0) + 1); }
    let vals = [...cnt.keys()];
    if (f.ord) vals.sort((a, b) => (f.ord.indexOf(a) + 1 || 99) - (f.ord.indexOf(b) + 1 || 99));
    else if (f.numeric) vals.sort((a, b) => (+a || 1e9) - (+b || 1e9));
    else if (f.desc) vals.sort().reverse();
    else if (vals.length > 40) vals.sort((a, b) => cnt.get(b) - cnt.get(a));
    else vals.sort((a, b) => a.localeCompare(b, 'pt-BR'));
    f.vals = vals;
  });
  S.F = Object.fromEntries(F.map(f => [f.k, f]));
}
const active = f => {
  const v = S.f[f.k];
  if (v == null) return false;
  if (f.t === 'list') return v.size > 0;
  if (f.t === 'date') return !!(v.de || v.ate);
  if (f.t === 'dv') return true;
  return String(v).trim() !== '';
};
function test(f, r) {
  const v = S.f[f.k];
  switch (f.t) {
    case 'list': return v.has(r[f.k] == null ? '(vazio)' : String(r[f.k]));
    case 'text': { const toks = norm(v).split(/[\s,;]+/).filter(Boolean); const x = norm(r[f.k]); return toks.some(t => x.includes(t)); }
    case 'q': return norm(v).split(/\s+/).filter(Boolean).every(t => r._q.includes(t));
    case 'date': { const x = r[f.k]; if (!x) return !!v.vazio; return (!v.de || x >= v.de) && (!v.ate || x <= v.ate); }
    case 'dv': { const d = r['Qtd Dias p/ Venc']; return r.AUX_TRATAR_NOTA === 'CARTEIRA' && d != null && d >= v.min && d <= v.max; }
  }
  return true;
}
function chipText(f) {
  const v = S.f[f.k];
  if (f.t === 'list') return `${f.l}: ${[...v].map(x => f.fmt ? f.fmt(x) : x).slice(0, 3).join(', ')}${v.size > 3 ? ` +${v.size - 3}` : ''}`;
  if (f.t === 'date') return `${f.l}: ${v.de ? fd(v.de) : '…'} a ${v.ate ? fd(v.ate) : '…'}${v.vazio ? ' (+ vazios)' : ''}`;
  if (f.t === 'dv') return `Carteira que vence em ${v.min} a ${v.max} dias`;
  return `${f.l}: ${v}`;
}

/* avaliação: linhas que passam e contagens cruzadas (cada filtro ignora a si mesmo) */
function evaluate() {
  const act = F.filter(active);
  const vis = [], one = act.map(() => []);
  for (const r of S.rows) {
    let fails = 0, w = -1;
    for (let j = 0; j < act.length; j++) if (!test(act[j], r)) { if (++fails > 1) break; w = j; }
    if (fails === 0) vis.push(r); else if (fails === 1) one[w].push(r);
  }
  S.vis = vis; S.act = act;
  S.except = k => { const j = act.findIndex(f => f.k === k); return j < 0 ? vis : vis.concat(one[j]); };
  // contagem de notas por valor para cada filtro de lista
  S.counts = {};
  for (const f of F) {
    if (f.t !== 'list' || f.hidden) continue;
    const m = new Map();
    for (const r of S.except(f.k)) { const v = r[f.k] == null ? '(vazio)' : String(r[f.k]); (m.get(v) || m.set(v, new Set()).get(v)).add(r.nota); }
    S.counts[f.k] = m;
  }
}

/* ---------- barra lateral de filtros ---------- */
const openSec = (() => { try { return JSON.parse(localStorage.getItem('fcu_atd_sec') || '{}'); } catch { return {}; } })();
function renderSide() {
  const groups = [...new Set(F.filter(f => !f.hidden).map(f => f.g))];
  $('#sideBody').innerHTML = groups.map(g => `<details class="grp" data-g="${esc(g)}" ${openSec[g] === false ? '' : 'open'}><summary>${esc(g)}</summary>${
    F.filter(f => f.g === g && !f.hidden).map(f => {
      if (f.t === 'text') return `<div class="fs"><h4>${esc(f.l)}</h4><input type="text" data-k="${esc(f.k)}" placeholder="Digite para filtrar (vários: separe por espaço)" value="${esc(S.f[f.k] || '')}"></div>`;
      if (f.t === 'date') { const v = S.f[f.k] || {vazio: true}; return `<div class="fs"><h4>${esc(f.l)}<a data-clr="${esc(f.k)}">limpar</a></h4><div class="rng"><input type="date" data-k="${esc(f.k)}" data-p="de" value="${v.de || ''}" aria-label="${esc(f.l)} de"><input type="date" data-k="${esc(f.k)}" data-p="ate" value="${v.ate || ''}" aria-label="${esc(f.l)} até"></div><label class="o"><input type="checkbox" data-k="${esc(f.k)}" data-p="vazio" ${v.vazio !== false ? 'checked' : ''}><span>Incluir vazios</span></label></div>`; }
      return `<div class="fs" data-fs="${esc(f.k)}"><h4>${esc(f.l)}<a data-clr="${esc(f.k)}">limpar</a></h4>${f.vals.length > 12 ? `<input type="search" data-s="${esc(f.k)}" placeholder="Procurar na lista (${nf.format(f.vals.length)})">` : ''}<div class="opts"></div></div>`;
    }).join('')}</details>`).join('');
  $$('#sideBody .fs[data-fs]').forEach(el => renderOpts(el.dataset.fs));
}
function renderOpts(k) {
  const f = S.F[k], box = $(`#sideBody .fs[data-fs="${CSS.escape(k)}"] .opts`); if (!box) return;
  const sel = S.f[k] || new Set(), cnt = (S.counts || {})[k] || new Map();
  const qs = norm($(`#sideBody input[data-s="${CSS.escape(k)}"]`)?.value || '');
  let vals = f.vals.filter(v => !qs || norm(v).includes(qs));
  if (f.vals.length > 40) vals = [...vals.filter(v => sel.has(v)), ...vals.filter(v => !sel.has(v) && (cnt.get(v)?.size || 0) > 0), ...vals.filter(v => !sel.has(v) && !(cnt.get(v)?.size))];
  const lim = 250, more = vals.length - lim;
  box.innerHTML = vals.slice(0, lim).map(v => { const c = cnt.get(v)?.size || 0; return `<label class="o${c ? '' : ' z'}"><input type="checkbox" data-k="${esc(k)}" value="${esc(v)}" ${sel.has(v) ? 'checked' : ''}><span title="${esc(v)}">${esc(f.fmt ? f.fmt(v) : v)}</span><i>${nf.format(c)}</i></label>`; }).join('') + (more > 0 ? `<div class="more">+${nf.format(more)} valores — use a busca</div>` : '');
}
function setList(k, v, only) {
  const s = S.f[k] instanceof Set ? S.f[k] : new Set();
  if (only) { const was = s.size === 1 && s.has(v); s.clear(); if (!was) s.add(v); }
  else s.has(v) ? s.delete(v) : s.add(v);
  S.f[k] = s; if (!s.size) delete S.f[k];
}
function clearF(k) { delete S.f[k]; }

/* ---------- renderização geral ---------- */
let rT;
function apply(now) { clearTimeout(rT); S.page = 1; const run = () => { evaluate(); renderAll(); saveState(); }; now ? run() : (rT = setTimeout(run, 120)); }
function renderAll() {
  renderChips(); renderKpis(); renderMbo(); renderCharts(); renderMap(); renderTable();
  $$('#sideBody .fs[data-fs]').forEach(el => renderOpts(el.dataset.fs));
  const seg = S.f['KPI MBO'], v = seg && seg.size === 1 ? [...seg][0] : '';
  $$('#mboSeg button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
}
function renderChips() {
  const act = F.filter(active);
  $('#fCount').textContent = act.length || '';
  $('#chips').innerHTML = act.map(f => `<button class="chip" data-k="${esc(f.k)}" title="Remover filtro">${esc(chipText(f))} ✕</button>`).join('') +
    (act.length ? `<button class="chip" data-k="*">Limpar tudo</button>` : '');
}

/* ---------- KPIs ---------- */
const ICON = {
  notas: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  concl: '<path d="M5 12l5 5 9-10"/>', paral: '<path d="M6 6l12 12M18 6L6 18"/>', cart: '<circle cx="12" cy="13" r="7"/><path d="M12 9v4l3 2M9 3h6"/>',
  back: '<path d="M3 8l9-5 9 5v8l-9 5-9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>', prazo: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>', geo: '<path d="M12 21s-7-6.5-7-12a7 7 0 0114 0c0 5.5-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/>'
};
const KDEF = [
  {id: 'notas', l: 'Notas', c: '#0b4fa8', f: () => true, set: null},
  {id: 'concl', l: 'Obras concluídas', c: '#0a8a3c', f: r => r.AUX_TRATAR_NOTA === 'CONCLUÍDO', set: {AUX_TRATAR_NOTA: ['CONCLUÍDO']}},
  {id: 'paral', l: 'Obras paralisadas', c: '#d03b3b', f: r => r.Status_Execução_Nota === 'Paralisado', set: {Status_Execução_Nota: ['Paralisado']}},
  {id: 'cart', l: 'Carteira de obras', c: '#6250d6', f: r => r.AUX_TRATAR_NOTA === 'CARTEIRA', set: {AUX_TRATAR_NOTA: ['CARTEIRA']}},
  {id: 'back', l: 'Backlog (carteira vencida)', c: '#c2410c', f: r => r.AUX_TRATAR_NOTA === 'CARTEIRA' && r.STATUS_PRAZO === 'FORA DO PRAZO', set: {AUX_TRATAR_NOTA: ['CARTEIRA'], _prazo: ['Vencida']}},
  {id: 'prazo', l: 'Carteira no prazo', c: '#0ca30c', f: r => r.AUX_TRATAR_NOTA === 'CARTEIRA' && r.STATUS_PRAZO === 'NO PRAZO', set: {AUX_TRATAR_NOTA: ['CARTEIRA'], _prazo: ['No prazo']}},
  {id: 'geo', l: 'Georreferenciados', c: '#1f9bd7', f: r => r._coord === 'Com coordenada', set: {_coord: ['Com coordenada']}}
];
const isSet = set => set && Object.entries(set).every(([k, vs]) => S.f[k] && S.f[k].size === vs.length && vs.every(v => S.f[k].has(v)));
function renderKpis() {
  $('#kpis').innerHTML = KDEF.map(d => {
    const rs = S.vis.filter(d.f), n = new Set(rs.map(r => r.nota)).size;
    const pj = d.id === 'concl' ? S.vis.filter(r => r['KPI Projeto'] === 'Concluído').length : rs.length;
    return `<div class="kpi${isSet(d.set) ? ' sel' : ''}" style="--c:${d.c}" data-kpi="${d.id}" role="button" tabindex="0">
      <div class="ic"><svg viewBox="0 0 24 24">${ICON[d.id]}</svg></div>
      <div><div class="k">${esc(d.l)}</div><div class="v">${nf.format(n)}</div></div>
      <div class="pj">Projetos<b>${nf.format(pj)}</b></div></div>`;
  }).join('');
}

/* ---------- MBO × NOT MBO ---------- */
function renderMbo() {
  const base = S.except('KPI MBO');
  const sel = S.f['KPI MBO'];
  $('#mboCards').innerHTML = ['MBO', 'NOT MBO'].map(m => {
    const rs = base.filter(r => r['KPI MBO'] === m), notas = new Set(rs.map(r => r.nota));
    const nset = f => new Set(rs.filter(f).map(r => r.nota)).size;
    const conc = nset(r => r.AUX_TRATAR_NOTA === 'CONCLUÍDO'), cart = nset(r => r.AUX_TRATAR_NOTA === 'CARTEIRA');
    const venc = nset(r => r.AUX_TRATAR_NOTA === 'CARTEIRA' && r.STATUS_PRAZO === 'FORA DO PRAZO'), nop = cart - venc;
    const par = nset(r => r.Status_Execução_Nota === 'Paralisado'), novos = nset(r => r._mud === 'Novo na base'), entreg = nset(r => r._mud === 'Entregue (DELI) no período');
    const tot = notas.size || 1, pct = cart ? Math.round(nop / cart * 100) : 0;
    return `<div class="card mcard${sel && sel.size === 1 && sel.has(m) ? ' sel' : ''}" style="--c:${C_MBO[m]}" data-mbo="${m}" role="button" tabindex="0">
      <h3>${m}</h3><div class="big">${nf.format(notas.size)}<small>notas · ${nf.format(rs.length)} projetos</small></div>
      <div class="mstats"><div><b>${nf.format(cart)}</b><span>em carteira</span></div><div><b style="color:var(--crit)">${nf.format(venc)}</b><span>vencidas</span></div><div><b style="color:var(--good)">${nf.format(conc)}</b><span>concluídas</span></div>
      <div><b>${nf.format(nop)}</b><span>carteira no prazo</span></div><div><b>${nf.format(par)}</b><span>paralisadas</span></div><div><b>${pct}%</b><span>carteira no prazo</span></div></div>
      <div class="bar" title="Concluídas · Carteira no prazo · Vencidas"><i style="width:${conc / tot * 100}%;background:#0ca30c"></i><i style="width:${nop / tot * 100}%;background:#7fb2ee"></i><i style="width:${venc / tot * 100}%;background:#d03b3b"></i></div>
      <div class="mfoot"><span><b style="color:#0ca30c">■</b> concluídas <b style="color:#7fb2ee">■</b> no prazo <b style="color:#d03b3b">■</b> vencidas</span><span>${S.prev ? `desde ${fdc(S.prev.ref)}: +${nf.format(novos)} novas · ${nf.format(entreg)} entregues` : ''}</span></div></div>`;
  }).join('');
  // MBO a vencer
  const N = +$('#vencJan').value;
  const mb = base.filter(r => r['KPI MBO'] === 'MBO' && r.AUX_TRATAR_NOTA === 'CARTEIRA');
  const av = mb.filter(r => r['Qtd Dias p/ Venc'] != null && r['Qtd Dias p/ Venc'] >= 0 && r['Qtd Dias p/ Venc'] <= N);
  const notasAv = new Map(); for (const r of av) if (!notasAv.has(r.nota)) notasAv.set(r.nota, r);
  const venc = new Set(mb.filter(r => r.STATUS_PRAZO === 'FORA DO PRAZO').map(r => r.nota)).size;
  $('#vencNums').innerHTML = `<div><b>${nf.format(notasAv.size)}</b><span>notas</span></div><div><b>${nf.format(av.length)}</b><span>projetos</span></div><div class="bad"><b>${nf.format(venc)}</b><span>MBO já vencidas</span></div>`;
  const lst = [...notasAv.values()].sort((a, b) => a['Qtd Dias p/ Venc'] - b['Qtd Dias p/ Venc']).slice(0, 40);
  $('#vencList').innerHTML = lst.length ? lst.map(r => `<li><span><button class="lnk" data-n="${esc(r.nota)}">${esc(r.nota)}</button> · ${esc((r.CLIENTE || '').slice(0, 28))} <span class="muted">${esc(r.Polo || '')}</span></span><em class="${r['Qtd Dias p/ Venc'] <= 7 ? 'h' : ''}">${r['Qtd Dias p/ Venc']} d · ${fdc(r.Prazo_Final_DELI)}</em></li>`).join('') : '<li class="muted">Nenhuma nota MBO vence nesta janela.</li>';
}

/* ---------- gráficos ---------- */
const uniq = (rs, key, f = () => true) => { const m = new Map(); for (const r of rs) if (f(r)) { const k = key(r); if (k == null) continue; (m.get(k) || m.set(k, new Set()).get(k)).add(r.nota); } return m; };
const sz = (m, k) => m.get(k)?.size || 0;
function chart(id, cfg, onPick) {
  if (typeof Chart === 'undefined') return;
  S.charts[id]?.destroy();
  const o = cfg.options || {};
  cfg.options = Object.assign({responsive: true, maintainAspectRatio: false, animation: {duration: 250},
    onClick: (e, els, ch) => { if (!onPick || !els.length) return; const el = els[0]; onPick(ch.data.labels[el.index], ch.data.datasets[el.datasetIndex]?.label, el); },
    onHover: (e, els) => { e.native.target.style.cursor = onPick && els.length ? 'pointer' : 'default'; }}, o,
    {plugins: Object.assign({legend: {display: false, labels: {boxWidth: 10, font: {size: 11}}}}, o.plugins || {})});
  S.charts[id] = new Chart($('#' + id), cfg);
}
const valueLabels = {id: 'vl', afterDatasetsDraw(ch) {
  if (ch.config.type !== 'bar' || ch.options.plugins.vl === false) return;
  const {ctx} = ch; ctx.save(); ctx.font = '600 10px Segoe UI, sans-serif'; ctx.fillStyle = '#4a5874'; ctx.textAlign = 'center';
  const hz = ch.options.indexAxis === 'y', stacked = ch.options.scales?.x?.stacked;
  ch.data.datasets.forEach((ds, di) => { const meta = ch.getDatasetMeta(di); if (meta.hidden) return; meta.data.forEach((b, i) => {
    const v = ds.data[i]; if (!v) return;
    if (stacked && di !== ch.data.datasets.length - 1) return;
    const t = stacked ? ch.data.datasets.reduce((s, d) => s + (d.data[i] || 0), 0) : v;
    if (hz) { ctx.textAlign = 'left'; ctx.fillText(nf.format(t), b.x + 4, b.y + 3); } else ctx.fillText(nf.format(t), b.x, b.y - 4);
  }); }); ctx.restore(); }};
function pick(k, label, only = true) { const f = S.F[k]; let v = label; if (f && f.fmt) v = f.vals.find(x => f.fmt(x) === label) ?? label; setList(k, String(v), only); apply(true); }
function renderCharts() {
  if (typeof Chart === 'undefined') return;
  if (!Chart.registry.plugins.get('vl')) Chart.register(valueLabels);
  Chart.defaults.font.family = '"Segoe UI",system-ui,sans-serif'; Chart.defaults.color = '#4a5874';
  const V = S.vis;
  // mensal
  const ref = S.fotos[S.fotos.length - 1].ref || hojeISO();
  const months = []; { let y = +ref.slice(0, 4), m = +ref.slice(5, 7); for (let i = 0; i < 18; i++) { months.unshift(`${y}-${String(m).padStart(2, '0')}`); if (--m === 0) { m = 12; y--; } } }
  const ent = uniq(S.except('_mes'), r => r._mes), con = uniq(V, r => r.dataDELI ? r.dataDELI.slice(0, 7) : null);
  const ytd = ref.slice(0, 4);
  const sumY = (m) => [...m].filter(([k]) => k.startsWith(ytd)).reduce((s, [, v]) => s + v.size, 0);
  chart('chMes', {type: 'bar', data: {labels: months.map(fmes), datasets: [
    {label: 'Entrada (notas)', data: months.map(m => sz(ent, m)), backgroundColor: months.map(m => S.f._mes && !S.f._mes.has(m) ? '#c9d7ee' : '#1f6fd1'), borderRadius: 4},
    {label: 'Concluídas (dataDELI)', data: months.map(m => sz(con, m)), backgroundColor: '#0ca30c', borderRadius: 4}]},
    options: {plugins: {legend: {display: true, position: 'top'}, subtitle: {display: true, text: `${ytd}: ${nf.format(sumY(ent))} notas de entrada · ${nf.format(sumY(con))} concluídas`, align: 'start', padding: {bottom: 6}}}, scales: {x: {grid: {display: false}}, y: {beginAtZero: true, grid: {color: '#eef2f7'}}}}},
    (lab, ds) => { if (ds !== 'Entrada (notas)') return; pick('_mes', lab); });
  // polo MBO × NOT MBO
  const polos = ['Leste', 'Norte', 'Oeste', 'Sul', '(vazio)'];
  const pm = uniq(V, r => `${r.Polo ?? '(vazio)'}|${r['KPI MBO']}`);
  chart('chPolo', {type: 'bar', data: {labels: polos, datasets: ['MBO', 'NOT MBO'].map(m => ({label: m, data: polos.map(p => sz(pm, `${p}|${m}`)), backgroundColor: C_MBO[m], borderRadius: 4}))},
    options: {plugins: {legend: {display: true}}, scales: {x: {stacked: true, grid: {display: false}}, y: {stacked: true, beginAtZero: true, grid: {color: '#eef2f7'}}}}}, (lab, ds) => pick('Polo', lab));
  // executante carteira
  const cart = V.filter(r => r.AUX_TRATAR_NOTA === 'CARTEIRA');
  const em = uniq(cart, r => `${r.Empreiteira_Contratos ?? '(vazio)'}|${r.STATUS_PRAZO === 'FORA DO PRAZO' ? 'v' : 'p'}`);
  const et = uniq(cart, r => r.Empreiteira_Contratos ?? '(vazio)');
  const emps = [...et].sort((a, b) => b[1].size - a[1].size).slice(0, 12).map(x => x[0]);
  chart('chEmp', {type: 'bar', data: {labels: emps, datasets: [
    {label: 'No prazo', data: emps.map(e => sz(em, e + '|p')), backgroundColor: '#7fb2ee', borderRadius: 3},
    {label: 'Vencidas', data: emps.map(e => sz(em, e + '|v')), backgroundColor: '#d03b3b', borderRadius: 3}]},
    options: {indexAxis: 'y', plugins: {legend: {display: true}}, scales: {x: {stacked: true, beginAtZero: true, grid: {color: '#eef2f7'}}, y: {stacked: true, grid: {display: false}, ticks: {font: {size: 11}}}}}}, lab => pick('Empreiteira_Contratos', lab));
  // aging
  const ag = uniq(S.except('AUX_AGING_VENC_Tabela'), r => r.AUX_AGING_VENC_Tabela ?? '(vazio)');
  const agL = [...AGING, '(vazio)'];
  chart('chAging', {type: 'bar', data: {labels: agL, datasets: [{label: 'Notas', data: agL.map(a => sz(ag, a)),
    backgroundColor: agL.map((a, i) => S.f.AUX_AGING_VENC_Tabela && !S.f.AUX_AGING_VENC_Tabela.has(a) ? '#dde3ec' : C_AGING[i] || '#9aa5b5'), borderRadius: 4}]},
    options: {scales: {x: {grid: {display: false}}, y: {beginAtZero: true, grid: {color: '#eef2f7'}}}}}, lab => pick('AUX_AGING_VENC_Tabela', lab));
  // prazo por mês (carteira)
  const pz = cart.filter(r => r.Prazo_Final_DELI), pmon = [];
  { let y = +ref.slice(0, 4), m = +ref.slice(5, 7) - 6; while (m < 1) { m += 12; y--; } for (let i = 0; i < 20; i++) { pmon.push(`${y}-${String(m).padStart(2, '0')}`); if (++m > 12) { m = 1; y++; } } }
  const lo = pmon[0], hi = pmon[pmon.length - 1];
  const bucket = r => { const m = r.Prazo_Final_DELI.slice(0, 7); return m < lo ? 'antes' : m > hi ? 'depois' : m; };
  const pzm = uniq(pz, r => `${bucket(r)}|${r['KPI MBO']}`), pkeys = ['antes', ...pmon, 'depois'];
  chart('chPrazo', {type: 'bar', data: {labels: pkeys.map(k => k === 'antes' ? `< ${fmes(lo)}` : k === 'depois' ? `> ${fmes(hi)}` : fmes(k)),
    datasets: ['MBO', 'NOT MBO'].map(m => ({label: m, data: pkeys.map(k => sz(pzm, `${k}|${m}`)), backgroundColor: C_MBO[m], borderRadius: 3}))},
    options: {plugins: {legend: {display: true}}, scales: {x: {stacked: true, grid: {display: false}, ticks: {font: {size: 10}}}, y: {stacked: true, beginAtZero: true, grid: {color: '#eef2f7'}}}}},
    (lab, ds, el) => { const k = pkeys[el.index]; const f = S.f.Prazo_Final_DELI = {vazio: false};
      if (k === 'antes') f.ate = lo + '-01'; else if (k === 'depois') f.de = hi + '-31'; else { f.de = k + '-01'; f.ate = k + '-31'; }
      setList('AUX_TRATAR_NOTA', 'CARTEIRA', true); S.f.AUX_TRATAR_NOTA = new Set(['CARTEIRA']); renderSide(); apply(true); });
  // pizzas e barras de status
  const donut = (id, k, colors, opts = {}) => {
    const m = uniq(S.except(k), r => r[k] ?? null), labs = [...m].sort((a, b) => b[1].size - a[1].size).map(x => x[0]);
    const tot = labs.reduce((s, l) => s + sz(m, l), 0) || 1;
    chart(id, {type: 'doughnut', data: {labels: labs, datasets: [{data: labs.map(l => sz(m, l)), backgroundColor: labs.map((l, i) => S.f[k] && !S.f[k].has(l) ? '#dde3ec' : (colors[l] || PAL[i % PAL.length])), borderColor: '#fff', borderWidth: 2}]},
      options: {cutout: '55%', plugins: {legend: {display: true, position: 'right', labels: {boxWidth: 10, font: {size: 11}, generateLabels: ch => ch.data.labels.map((l, i) => ({text: `${l} — ${nf.format(ch.data.datasets[0].data[i])} (${Math.round(ch.data.datasets[0].data[i] / tot * 100)}%)`, fillStyle: ch.data.datasets[0].backgroundColor[i], strokeStyle: '#fff', index: i}))}, onClick: (e, it) => pick(k, labs[it.index])}}, ...opts}}, lab => pick(k, lab));
  };
  donut('chStatus', 'Status_Execução_Nota', C_EXEC);
  donut('chRco', 'camada', {'Prioridade 0 - Célula crítica & Outros': '#7fb2ee', 'Prioridade 1 - Comitê & Emuc': '#5b7ff0', 'Prioridade 2 - Antecipação de cliente de sensível': '#0b3f80', 'SP Obras - Penha de França': '#fab219'});
  const bars = (id, k, top, hz, colorFn) => {
    const m = uniq(S.except(k), r => r[k] ?? '(vazio)'); let labs = [...m].sort((a, b) => b[1].size - a[1].size).map(x => x[0]); if (top) labs = labs.slice(0, top);
    chart(id, {type: 'bar', data: {labels: labs, datasets: [{label: 'Notas', data: labs.map(l => sz(m, l)), backgroundColor: labs.map((l, i) => S.f[k] && !S.f[k].has(l) ? '#dde3ec' : colorFn ? colorFn(l, i) : PAL[i % PAL.length]), borderRadius: 4}]},
      options: {indexAxis: hz ? 'y' : 'x', scales: {x: {beginAtZero: true, grid: {display: !hz ? false : true, color: '#eef2f7'}, ticks: {font: {size: 11}}}, y: {beginAtZero: true, grid: {display: hz ? false : true, color: '#eef2f7'}, ticks: {font: {size: 11}}}}}}, lab => pick(k, lab));
  };
  bars('chNec', 'NEC_UPS', 0, false, l => l === 'NEC' ? '#5b7ff0' : l === 'UPS' ? '#eb5a46' : '#9aa5b5');
  bars('chKpi', 'KPI Nota', 0, true, l => ({'Concluído': '#0ca30c', 'Concluído_Elétricamente': '#6cc46c', 'Execução': '#1f6fd1', 'Pendente_Execução': '#fab219', 'Elaboração': '#7b8794'})[l] || '#9aa5b5');
  bars('chTipo', 'Tipo_Projeto', 10, true, () => '#0b4fa8');
  bars('chCli', 'Tipo de Cliente', 0, false);
}

/* ---------- mapa ---------- */
let MAP, CL;
const gTiles = l => L.tileLayer(`https://mt{s}.google.com/vt/lyrs=${l}&hl=pt-BR&x={x}&y={y}&z={z}`, {subdomains: '0123', maxZoom: 21, attribution: '© Google'});
function initMap() {
  if (typeof L === 'undefined' || MAP) return;
  MAP = L.map('map', {preferCanvas: true, zoomControl: true}).setView([-23.6, -46.65], 10);
  const base = {'Google Maps — ruas': gTiles('m'), 'Google — híbrido': gTiles('y'), 'Google — satélite': gTiles('s'),
    'OpenStreetMap': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom: 19, attribution: '© OpenStreetMap'})};
  base['Google Maps — ruas'].addTo(MAP); L.control.layers(base, null, {position: 'topright'}).addTo(MAP); L.control.scale({imperial: false}).addTo(MAP);
  CL = L.markerClusterGroup({chunkedLoading: true, maxClusterRadius: 45, showCoverageOnHover: false,
    iconCreateFunction: c => { const n = c.getChildCount(); return L.divIcon({html: `<div>${n >= 1000 ? (n / 1000).toFixed(1).replace('.', ',') + 'k' : n}</div>`, className: 'mc' + (n > 200 ? ' l' : n > 40 ? ' m' : ''), iconSize: [40, 40]}); }});
  MAP.addLayer(CL);
}
const mapCol = r => S.mapColor === 'mbo' ? C_MBO[r['KPI MBO']] || '#999' : S.mapColor === 'prazo' ? C_PRAZO[r._prazo] : C_EXEC[r.Status_Execução_Nota] || '#999';
function popup(r) {
  const d = r['Qtd Dias p/ Venc'];
  return `<div class="pp"><h5><button class="lnk" data-p="${esc(r.Projeto)}">${esc(r.Projeto)}</button></h5>
    <div class="r">Nota <button class="lnk" data-n="${esc(r.nota)}">${esc(r.nota)}</button> · <b style="color:${C_MBO[r['KPI MBO']]}">${esc(r['KPI MBO'])}</b> · ${esc(r['KPI Nota'] || '')}</div>
    <div class="r">${esc(r.CLIENTE || 'cliente não informado')}</div>
    <div class="r">${esc(r.Tipo_Projeto || '')} · ${esc(r.Empreiteira_Contratos || '—')}</div>
    <div class="r">Execução: <b>${esc(r.Status_Execução_Nota || '—')}</b> · Polo ${esc(r.Polo || '—')}</div>
    <div class="r">Prazo final: <b>${fd(r.Prazo_Final_DELI)}</b>${d != null && r.AUX_TRATAR_NOTA === 'CARTEIRA' ? ` · <span class="dd ${d < 0 ? 'neg' : d <= 15 ? 'lo' : 'ok'}">${d} dias</span>` : ''}${r.dataDELI ? ` · DELI ${fd(r.dataDELI)}` : ''}</div>
    <div class="r">${esc(r.bairro || '')} / ${esc(r.municipio || '')} · ${esc(r.Circuito || '')}</div>${goLinks(r.Latitude, r.Longitude)}</div>`;
}
function renderMap(fit) {
  initMap(); if (!MAP) return;
  CL.clearLayers();
  const pts = S.vis.filter(r => r._coord === 'Com coordenada');
  const ms = pts.map(r => { const m = L.circleMarker([r.Latitude, r.Longitude], {radius: 7, color: '#fff', weight: 1.5, fillColor: mapCol(r), fillOpacity: .95}); m.bindPopup(() => popup(r), {maxWidth: 330}); return m; });
  CL.addLayers(ms);
  const leg = S.mapColor === 'mbo' ? C_MBO : S.mapColor === 'prazo' ? C_PRAZO : C_EXEC;
  const cnt = new Map(); for (const r of pts) { const k = S.mapColor === 'mbo' ? r['KPI MBO'] : S.mapColor === 'prazo' ? r._prazo : r.Status_Execução_Nota; cnt.set(k, (cnt.get(k) || 0) + 1); }
  $('#mapLegend').innerHTML = Object.entries(leg).filter(([k]) => cnt.get(k)).map(([k, c]) => `<span><i style="background:${c}"></i>${esc(k)} (${nf.format(cnt.get(k))})</span>`).join('');
  const sem = S.vis.length - pts.length;
  $('#mapInfo').textContent = `${nf.format(pts.length)} projetos no mapa (${nf.format(new Set(pts.map(r => r.nota)).size)} notas) · ${nf.format(sem)} projetos filtrados sem coordenada na FCU.`;
  if ((fit || !S.fitted) && pts.length) { S.fitted = true; MAP.fitBounds(L.latLngBounds(pts.map(r => [r.Latitude, r.Longitude])).pad(.05)); }
}

/* ---------- tabela ---------- */
const COLS = {
  notas: [
    ['nota', 'Nota', r => `<button class="lnk" data-n="${esc(r.nota)}">${esc(r.nota)}</button>`],
    ['KPI MBO', 'KPI MBO', r => `<span class="badge" style="--c:${C_MBO[r['KPI MBO']]}">${esc(r['KPI MBO'])}</span>`],
    ['KPI Nota', 'KPI Nota'], ['Status_Nota', 'Status nota'], ['Status_Execução_Nota', 'Execução'],
    ['_prazo', 'Situação', r => `<span class="badge" style="--c:${C_PRAZO[r._prazo]}">${esc(r._prazo)}</span>`],
    ['Prazo_Final_DELI', 'Prazo final', r => fd(r.Prazo_Final_DELI)],
    ['dv', 'Dias p/ venc.', r => ddCell(r), 'n'], ['AUX_AGING_VENC_Tabela', 'Aging'], ['dataDELI', 'DELI', r => fd(r.dataDELI)],
    ['Polo', 'Polo'], ['emps', 'Executante(s)'], ['CLIENTE', 'Cliente', null, 'w'], ['Tipo de Cliente', 'Tipo cliente'], ['Tipo_Obj_Nota', 'Tipo objeto'],
    ['np', 'Projetos', r => nf.format(r.np), 'n'], ['ups', 'UPS plan.', r => nf2.format(r.ups), 'n'], ['progs', 'Programações', r => nf.format(r.progs), 'n'],
    ['Data_Max_Prog_nota', 'Últ. prog. nota', r => fd(r.Data_Max_Prog_nota)], ['camada', 'Demanda RCO'], ['municipio', 'Município'], ['bairro', 'Bairro'], ['_mud', 'Mudança']],
  proj: [
    ['Projeto', 'Projeto', r => `<button class="lnk" data-p="${esc(r.Projeto)}">${esc(r.Projeto)}</button>`],
    ['nota', 'Nota', r => `<button class="lnk" data-n="${esc(r.nota)}">${esc(r.nota)}</button>`],
    ['KPI MBO', 'KPI MBO', r => `<span class="badge" style="--c:${C_MBO[r['KPI MBO']]}">${esc(r['KPI MBO'])}</span>`],
    ['Tipo_Projeto', 'Tipo projeto'], ['Status_Projeto', 'Status projeto'], ['KPI Projeto', 'KPI projeto'], ['Status_Execução_Nota', 'Execução'],
    ['Empreiteira_Contratos', 'Executante'], ['contrato', 'Contrato'], ['Polo', 'Polo'], ['Area Real', 'Área', null, 'n'], ['Circuito', 'Circuito'],
    ['Ups_Plan', 'UPS plan.', r => num(r.Ups_Plan), 'n'], ['Ups_Exec_Projeto', 'UPS exec.', r => num(r.Ups_Exec_Projeto), 'n'], ['Qtde_Programacoes', 'Prog.', null, 'n'],
    ['Data_Max_Prog', 'Últ. programação', r => fd(r.Data_Max_Prog)], ['Prazo_Final_DELI', 'Prazo final', r => fd(r.Prazo_Final_DELI)], ['dv', 'Dias p/ venc.', r => ddCell(r), 'n'],
    ['_prazo', 'Situação', r => `<span class="badge" style="--c:${C_PRAZO[r._prazo]}">${esc(r._prazo)}</span>`], ['CLIENTE', 'Cliente', null, 'w'], ['bairro', 'Bairro'], ['municipio', 'Município'],
    ['loc', 'Localização', r => r._coord === 'Com coordenada' ? goLinks(r.Latitude, r.Longitude) : '<span class="muted">sem coordenada</span>'], ['_mud', 'Mudança']]
};
function ddCell(r) { const d = r['Qtd Dias p/ Venc']; if (d == null) return '—'; if (r.AUX_TRATAR_NOTA !== 'CARTEIRA') return `<span class="muted">${d}</span>`; return `<span class="dd ${d < 0 ? 'neg' : d <= 15 ? 'lo' : 'ok'}">${d}</span>`; }
function notasAgg(rs) {
  const m = new Map();
  for (const r of rs) {
    let a = m.get(r.nota);
    if (!a) { a = Object.assign({}, r, {np: 0, ups: 0, progs: 0, _e: new Set()}); m.set(r.nota, a); }
    a.np++; a.ups += r.Ups_Plan || 0; a.progs += r.Qtde_Programacoes || 0; if (r.Empreiteira_Contratos) a._e.add(r.Empreiteira_Contratos);
    if (r._mud !== 'Sem mudança' && a._mud === 'Sem mudança') a._mud = r._mud;
  }
  for (const a of m.values()) a.emps = [...a._e].join(', ');
  return [...m.values()];
}
function tableRows() {
  let rs = S.mode === 'notas' ? notasAgg(S.vis) : S.vis;
  if (S.tq) { const t = norm(S.tq).split(/\s+/).filter(Boolean); rs = rs.filter(r => t.every(x => r._q.includes(x) || norm(r.emps).includes(x))); }
  const [k, dir] = S.sort[S.mode];
  const val = r => k === 'dv' ? (r['Qtd Dias p/ Venc'] ?? 1e9) + (r.AUX_TRATAR_NOTA === 'CARTEIRA' ? 0 : 1e6) : r[k];
  return rs.slice().sort((a, b) => { const x = val(a), y = val(b); if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1; return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'pt-BR', {numeric: true})) * dir; });
}
function renderTable() {
  const cols = COLS[S.mode], rs = tableRows(), size = +$('#tSize').value, pages = Math.max(1, Math.ceil(rs.length / size));
  S.page = Math.min(S.page, pages); S.tableRows = rs;
  const [sk, sd] = S.sort[S.mode];
  $('#tbl thead').innerHTML = `<tr>${cols.map(([k, l]) => `<th data-k="${esc(k)}" class="${k === sk ? 'sorted' + (sd > 0 ? ' asc' : '') : ''}">${esc(l)}</th>`).join('')}</tr>`;
  $('#tbl tbody').innerHTML = rs.slice((S.page - 1) * size, S.page * size).map(r => `<tr>${cols.map(([k, , fn, cl]) => `<td class="${cl || ''}">${fn ? fn(r) : esc(r[k] ?? '—')}</td>`).join('')}</tr>`).join('') ||
    `<tr><td colspan="${cols.length}" class="muted" style="padding:24px">Nenhum registro com os filtros atuais.</td></tr>`;
  $('#tCount').textContent = `${nf.format(rs.length)} ${S.mode === 'notas' ? 'notas' : 'projetos'}`;
  const p = S.page, btn = (t, n, dis, on) => `<button class="btn sm${on ? ' primary' : ''}" data-pg="${n}" ${dis ? 'disabled' : ''}>${t}</button>`;
  const nums = [...new Set([1, p - 2, p - 1, p, p + 1, p + 2, pages])].filter(n => n >= 1 && n <= pages).sort((a, b) => a - b);
  $('#pager').innerHTML = btn('‹', p - 1, p === 1) + nums.map((n, i) => (i && n - nums[i - 1] > 1 ? '<span class="muted">…</span>' : '') + btn(n, n, false, n === p)).join('') + btn('›', p + 1, p === pages);
}

/* ---------- detalhe: projeto e nota (com histórico das fotos) ---------- */
let cdTimer;
function openModal(html, narrow) {
  $('#modalBody').innerHTML = html; $('.modal-box').classList.toggle('narrow', !!narrow);
  $('#modal').hidden = false; document.body.style.overflow = 'hidden'; $('.modal').scrollTop = 0;
}
function closeModal() {
  $('#modal').hidden = true; document.body.style.overflow = ''; clearInterval(cdTimer); S.stack = []; S.cur = null;
  if (S.pmap) { S.pmap.remove(); S.pmap = null; }
  if (/^#(projeto|nota)=/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search);
}
function countdown(r) {
  if (r.dataDELI) return `<div class="cd"><div><span class="muted">Entregue (dataDELI)</span><br><b style="color:var(--good)">${fd(r.dataDELI)}</b></div><div class="muted">Prazo final era ${fd(r.Prazo_Final_DELI)}${r.STATUS_PRAZO ? ' · ' + esc(r.STATUS_PRAZO) : ''}</div></div>`;
  if (!r.Prazo_Final_DELI) return `<div class="cd muted">Sem prazo final informado.</div>`;
  return `<div class="cd"><div><span class="muted">Contador até o prazo final (${fd(r.Prazo_Final_DELI)} 00:00, Brasília)</span><br><b id="cdv" data-prazo="${r.Prazo_Final_DELI}">—</b></div>
    <div class="muted">Na planilha (ref. ${fd(S.fotos[S.fotos.length - 1].ref)}): Qtd Dias p/ Venc = <b>${num(r['Qtd Dias p/ Venc'])}</b> · ${esc(r.STATUS_PRAZO || '—')} · ${esc(r.AUX_AGING_VENC_Tabela || '—')}</div></div>`;
}
function tickCd() {
  const e = $('#cdv'); if (!e) return clearInterval(cdTimer);
  const ms = Date.parse(e.dataset.prazo + 'T00:00:00-03:00') - Date.now(), neg = ms < 0, a = Math.abs(ms);
  const d = Math.floor(a / 864e5), h = Math.floor(a % 864e5 / 36e5), m = Math.floor(a % 36e5 / 6e4), s = Math.floor(a % 6e4 / 1e3);
  e.textContent = `${neg ? 'Vencido há ' : ''}${d}d ${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
  e.style.color = neg ? 'var(--crit)' : d <= 15 ? '#c2410c' : 'var(--good)';
}
function timeline(r) {
  const M = [['data_nota', 'Data da nota'], ['dataAPRO', 'Aprovação (dataAPRO)'], ['dataAUTO', 'Autorização (dataAUTO)'], ['dataOLLI', 'dataOLLI'], ['Inicio_prev', 'Início previsto'],
    ['Fim_prev', 'Fim previsto'], ['Data_Max_Prog', 'Última programação do projeto'], ['Data_Max_Prog_nota', 'Última programação da nota'], ['dataDELIPJ', 'dataDELIPJ'],
    ['dataDELI', 'Entrega (dataDELI)'], ['Prazo_Final_DELI', 'Prazo final (DELI)']];
  const col = {Prazo_Final_DELI: '#d03b3b', dataDELI: '#0ca30c', Data_Max_Prog: '#1f6fd1', Data_Max_Prog_nota: '#1f6fd1', hoje: '#fab219'};
  const ev = M.filter(([k]) => r[k]).map(([k, l]) => ({k, l, d: r[k]})); ev.push({k: 'hoje', l: 'Hoje', d: hojeISO()});
  ev.sort((a, b) => a.d < b.d ? -1 : a.d > b.d ? 1 : 0);
  return `<ol class="timeline">${ev.map(e => { const x = dias(e.d); return `<li style="--c:${col[e.k] || '#9aa5b5'}"><span class="d">${fd(e.d)}</span> — ${esc(e.l)} <span class="m">${e.k === 'hoje' ? '' : x === 0 ? '(hoje)' : x > 0 ? `(em ${x} dias)` : `(há ${-x} dias)`}</span></li>`; }).join('')}</ol>`;
}
const fotoLabel = f => `${fdc(f.ref)}${f.atual ? ' (atual)' : ''}`;
function histTable(fields, getRow) {
  const fs = S.fotos;
  const rows = fields.map(([k, l]) => {
    const vals = fs.map(f => { const r = getRow(f); return r === undefined ? undefined : (typeof k === 'function' ? k(r, f) : r?.[k]); });
    const shown = vals.map((v, i) => v === undefined ? '<span class="muted">não consta</span>' : typeof k === 'function' ? esc(v) : fmtF(k, v));
    const changed = !NOHL.has(k) && vals.some((v, i) => i && vals[i - 1] !== undefined && v !== undefined && String(v ?? '') !== String(vals[i - 1] ?? ''));
    return `<tr${changed ? ' style="background:#fff8e6"' : ''}><td><b>${esc(l)}</b></td>${shown.map((s, i) => { const ch = !NOHL.has(k) && i && vals[i - 1] !== undefined && vals[i] !== undefined && String(vals[i] ?? '') !== String(vals[i - 1] ?? ''); return `<td${ch ? ' style="font-weight:700;color:#9a3412"' : ''}>${s}</td>`; }).join('')}</tr>`;
  }).join('');
  return `<div class="tbl-wrap" style="max-height:none"><table class="tbl"><thead><tr><th>Campo</th>${fs.map(f => `<th>${esc(fotoLabel(f))}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>
    <p class="muted">Fotos da planilha: ${fs.map(f => `${fd(f.ref)} (${esc(f.meta.aba || '')})`).join(' · ')}. Linhas em destaque mudaram entre fotos. A planilha não registra cada programação: traz a quantidade (Qtde_Programacoes) e a data da última programação do projeto e da nota.</p>`;
}
function navBar() { return S.stack.length ? `<button class="btn sm" id="mBack">← Voltar</button> ` : ''; }
function info(pairs) { return `<div class="info">${pairs.map(([l, v]) => `<div><span>${esc(l)}</span><b>${v}</b></div>`).join('')}</div>`; }
function miniMap(pts) {
  if (S.pmap) { S.pmap.remove(); S.pmap = null; }
  const el = $('#pmap'); if (!el || typeof L === 'undefined') return;
  if (!pts.length) { el.innerHTML = '<div class="muted" style="padding:20px">Sem coordenadas na FCU para este item.</div>'; return; }
  S.pmap = L.map(el).setView([pts[0].Latitude, pts[0].Longitude], 16); gTiles('m').addTo(S.pmap);
  const b = []; for (const r of pts) { L.circleMarker([r.Latitude, r.Longitude], {radius: 8, color: '#fff', weight: 2, fillColor: C_MBO[r['KPI MBO']] || '#999', fillOpacity: 1}).bindPopup(popup(r)).addTo(S.pmap); b.push([r.Latitude, r.Longitude]); }
  if (b.length > 1) S.pmap.fitBounds(b, {padding: [30, 30], maxZoom: 17});
  setTimeout(() => S.pmap && S.pmap.invalidateSize(), 60);
}
function push() { if (S.cur) S.stack.push(S.cur); }
function openProjeto(id, fromNav) {
  const r = S.byP.get(id); if (!r) return toast('Projeto não encontrado na base atual: ' + id);
  if (!fromNav) push(); S.cur = {t: 'p', id};
  history.replaceState(null, '', '#projeto=' + encodeURIComponent(id));
  const irm = (S.byN.get(String(r.nota)) || []).filter(x => x.Projeto !== id);
  const prev = S.prev?.byP.get(id);
  const all = S.cols.map(c => { const ch = prev && String(prev[c] ?? '') !== String(r[c] ?? ''); return `<div${ch ? ' style="background:#fff8e6;border-radius:6px;padding:2px 4px"' : ''}><span>${esc(c)}</span><b>${fmtF(c, r[c])}</b>${ch ? `<div class="muted">em ${fdc(S.prev.ref)}: ${fmtF(c, prev[c])}</div>` : ''}</div>`; }).join('');
  openModal(`<div class="mh">${navBar()}<h2>${esc(r.Projeto)}</h2>
    <span class="badge" style="--c:${C_MBO[r['KPI MBO']]}">${esc(r['KPI MBO'])}</span><span class="badge" style="--c:${C_PRAZO[r._prazo]}">${esc(r._prazo)}</span>
    <span class="badge" style="--c:${C_EXEC[r.Status_Execução_Nota] || '#999'}">${esc(r.Status_Execução_Nota || '—')}</span><span class="badge" style="--c:#fab219">${esc(r._mud)}</span></div>
    <p class="muted" style="margin:6px 0 0">Nota <button class="lnk" data-n="${esc(r.nota)}">${esc(r.nota)}</button> · ${esc(r.CLIENTE || 'cliente não informado')} · ${esc(r['Tipo de Cliente'] || '')}</p>
    ${countdown(r)}
    ${info([['Tipo de projeto', esc(r.Tipo_Projeto || '—')], ['Tipo objeto da nota', esc(r.Tipo_Obj_Nota || '—')], ['Status do projeto', esc(r.Status_Projeto || '—')], ['KPI projeto / nota', `${esc(r['KPI Projeto'] || '—')} / ${esc(r['KPI Nota'] || '—')}`],
      ['Executante', esc(r.Empreiteira_Contratos || '—')], ['Contrato', esc(r.contrato || '—')], ['Polo / Área', `${esc(r.Polo || '—')} / ${esc(r['Area Real'] ?? '—')}`], ['Circuito', esc(r.Circuito || '—')],
      ['UPS plan. / exec.', `${num(r.Ups_Plan)} / ${num(r.Ups_Exec_Projeto)}`], ['Programações', `${num(r.Qtde_Programacoes)} · última ${fd(r.Data_Max_Prog)}`], ['Nível projeto / tensão', `${esc(r.Nível_Projeto || '—')} / ${esc(r.Nível_Tensão || '—')}`], ['NEC | UPS · camada', `${esc(r.NEC_UPS || '—')} · ${esc(r.camada || '—')}`],
      ['Bairro / município', `${esc(r.bairro || '—')} / ${esc(r.municipio || '—')}`], ['Coordenada', r._coord === 'Com coordenada' ? `${r.Latitude.toFixed(6)}, ${r.Longitude.toFixed(6)}` : 'sem coordenada'], ['Custo total CTO', num(r.custo_total_cto)], ['Simulação compensação REN1000', num(r['Simulação Compensação REN1000'])]])}
    <div class="mgrid"><div><h4>Linha do tempo</h4>${timeline(r)}</div><div><h4>Localização</h4><div id="pmap"></div>${r._coord === 'Com coordenada' ? `<div style="margin-top:8px">${goLinks(r.Latitude, r.Longitude)}</div>` : ''}</div></div>
    <h4>Histórico do projeto — fotos da FCU (${S.fotos.length})</h4>${histTable(HIST_P, f => f.byP.get(id))}
    <details><summary class="lnk" style="margin:10px 0;display:inline-block">Todas as informações do projeto (${S.cols.length} campos)${S.prev ? ` — destacados os que mudaram desde ${fdc(S.prev.ref)}` : ''}</summary>${info([]).replace('</div>', all + '</div>')}</details>
    <h4>Outros projetos da nota ${esc(r.nota)} (${irm.length})</h4>${irm.length ? projMini(irm) : '<p class="muted">Nenhum outro projeto nesta nota.</p>'}
    <div class="actions"><button class="btn" data-n="${esc(r.nota)}">Abrir histórico da nota</button><button class="btn" id="mCopy">Copiar link do projeto</button><button class="btn primary" id="mExp">⬇ Exportar histórico (Excel)</button></div>`);
  miniMap(r._coord === 'Com coordenada' ? [r] : []);
  clearInterval(cdTimer); tickCd(); cdTimer = setInterval(tickCd, 1000);
  $('#mExp').onclick = () => exportHist([r]);
}
function projMini(list) {
  return `<div class="tbl-wrap" style="max-height:320px"><table class="tbl"><thead><tr><th>Projeto</th><th>Tipo</th><th>Executante</th><th>Status projeto</th>${S.fotos.map(f => `<th>Prog. ${esc(fdc(f.ref))}</th>`).join('')}<th>Últ. programação</th><th>KPI projeto</th><th>Mudança</th></tr></thead><tbody>${
    list.map(p => `<tr><td><button class="lnk" data-p="${esc(p.Projeto)}">${esc(p.Projeto)}</button></td><td>${esc(p.Tipo_Projeto || '—')}</td><td>${esc(p.Empreiteira_Contratos || '—')}</td><td>${esc(p.Status_Projeto || '—')}</td>${
      S.fotos.map(f => { const x = f.byP.get(p.Projeto); return `<td class="n">${x ? num(x.Qtde_Programacoes) : '<span class="muted">—</span>'}</td>`; }).join('')}<td>${fd(p.Data_Max_Prog)}</td><td>${esc(p['KPI Projeto'] || '—')}</td><td>${esc(p._mud)}</td></tr>`).join('')}</tbody></table></div>`;
}
function openNota(n, fromNav) {
  const k = String(n), ps = S.byN.get(k); if (!ps) return toast('Nota não encontrada na base atual: ' + k);
  if (!fromNav) push(); S.cur = {t: 'n', id: k};
  history.replaceState(null, '', '#nota=' + encodeURIComponent(k));
  const r = ps[0];
  const agg = (f) => f.byN.get(k);
  const NF = [
    [(x, f) => nf.format(f.byN.get(k).length), 'Projetos na nota'],
    [(x, f) => nf.format(f.byN.get(k).reduce((s, y) => s + (y.Qtde_Programacoes || 0), 0)), 'Soma de programações'],
    [(x, f) => nf2.format(f.byN.get(k).reduce((s, y) => s + (y.Ups_Plan || 0), 0)), 'UPS planejado (soma)'],
    ['Status_Nota', 'Status da nota'], ['Status_Execução_Nota', 'Status de execução'], ['KPI Nota', 'KPI Nota'], ['KPI MBO', 'KPI MBO'], ['AUX_TRATAR_NOTA', 'Situação da nota'],
    ['Data_Max_Prog_nota', 'Última programação da nota'], ['Prazo_Final_DELI', 'Prazo final (DELI)'], ['Qtd Dias p/ Venc', 'Dias p/ vencer'], ['STATUS_PRAZO', 'Situação do prazo'],
    ['AUX_AGING_VENC_Tabela', 'Aging'], ['dataDELI', 'Entrega (dataDELI)'], ['camada', 'Demanda RCO (camada)']];
  const movs = [];
  for (let i = 1; i < S.fotos.length; i++) {
    const a = S.fotos[i - 1].byN.get(k) || [], b = S.fotos[i].byN.get(k) || [];
    if (!a.length) continue;
    const ent = b.filter(x => !a.some(y => y.Projeto === x.Projeto)).map(x => x.Projeto), sai = a.filter(x => !b.some(y => y.Projeto === x.Projeto)).map(x => x.Projeto);
    if (ent.length) movs.push(`Entraram entre ${fdc(S.fotos[i - 1].ref)} e ${fdc(S.fotos[i].ref)}: ${ent.map(esc).join(', ')}`);
    if (sai.length) movs.push(`Saíram entre ${fdc(S.fotos[i - 1].ref)} e ${fdc(S.fotos[i].ref)}: ${sai.map(esc).join(', ')}`);
  }
  const execs = [...new Set(ps.map(p => p.Empreiteira_Contratos).filter(Boolean))].join(', ') || '—';
  openModal(`<div class="mh">${navBar()}<h2>Nota ${esc(k)}</h2>
    <span class="badge" style="--c:${C_MBO[r['KPI MBO']]}">${esc(r['KPI MBO'])}</span><span class="badge" style="--c:${C_PRAZO[r._prazo]}">${esc(r._prazo)}</span>
    <span class="badge" style="--c:${C_EXEC[r.Status_Execução_Nota] || '#999'}">${esc(r.Status_Execução_Nota || '—')}</span><span class="badge">${esc(r['KPI Nota'] || '—')}</span></div>
    <p class="muted" style="margin:6px 0 0">${esc(r.CLIENTE || 'cliente não informado')} · ${esc(r['Tipo de Cliente'] || '')} · ${esc(r.Tipo_Obj_Nota || '')}</p>
    ${countdown(r)}
    ${info([['Status da nota', esc(r.Status_Nota || '—')], ['Data da nota', fd(r.data_nota)], ['Projetos', nf.format(ps.length)], ['Executante(s)', esc(execs)],
      ['Polo / Área', `${esc(r.Polo || '—')} / ${esc(r['Area Real'] ?? '—')}`], ['Responsável nota', esc(r.AUX_RESP_NOTA || '—')], ['Tipo de prazo', `${esc(r.Tipo_Prazo || '—')} (${num(r.Dias_Prazo)} dias)`], ['NEC | UPS', esc([...new Set(ps.map(p => p.NEC_UPS).filter(Boolean))].join(', ') || '—')],
      ['Bairro / município', `${esc(r.bairro || '—')} / ${esc(r.municipio || '—')}`], ['Demanda RCO', esc(r.camada || '—')], ['Custo total clientes', num(r.custo_total_clientes)], ['WL', num(r.WL)]])}
    <div class="mgrid"><div><h4>Linha do tempo da nota</h4>${timeline(r)}</div><div><h4>Localização dos projetos</h4><div id="pmap"></div></div></div>
    <h4>Histórico da nota — fotos da FCU (${S.fotos.length})</h4>${histTable(NF, f => agg(f) ? agg(f)[0] : undefined)}
    ${movs.length ? `<p class="muted">${movs.join('<br>')}</p>` : ''}
    <h4>Projetos da nota (${ps.length}) e evolução das programações</h4>${projMini(ps)}
    <div class="actions"><button class="btn" id="mCopy">Copiar link da nota</button><button class="btn primary" id="mExp">⬇ Exportar histórico da nota (Excel)</button></div>`);
  miniMap(ps.filter(p => p._coord === 'Com coordenada'));
  clearInterval(cdTimer); tickCd(); cdTimer = setInterval(tickCd, 1000);
  $('#mExp').onclick = () => exportHist(ps, k);
}
function openFromHash() {
  const m = location.hash.match(/^#(projeto|nota)=(.+)$/); if (!m) return;
  const id = decodeURIComponent(m[2]); m[1] === 'projeto' ? openProjeto(id) : openNota(id);
}

/* ---------- exportação ---------- */
const stamp = () => isoNow().slice(0, 16).replace(/[-: ]/g, '').replace(/^(\d{8})(\d{4})$/, '$1_$2');
const xDate = (k, v) => DATE_COLS.has(k) && v ? new Date(v + 'T12:00:00') : v;
function sheetRows(rs) { return rs.map(r => { const o = {}; for (const c of S.cols) o[c] = xDate(c, r[c]); o['Situação do prazo (painel)'] = r._prazo; o[`Mudança desde ${S.prev ? fdc(S.prev.ref) : '-'}`] = r._mud; if (r._coord === 'Com coordenada') o['Google Maps'] = gm(r.Latitude, r.Longitude); return o; }); }
function filtrosSheet() { return XLSX.utils.aoa_to_sheet([['Exportado em', new Date().toLocaleString('pt-BR', {timeZone: 'America/Sao_Paulo'})], ['Base', S.base.meta.arquivo], ['Referência', fd(S.fotos[S.fotos.length - 1].ref)], [], ['Filtros aplicados'], ...F.filter(active).map(f => [chipText(f)])]); }
function exportXlsx(kind) {
  if (typeof XLSX === 'undefined') return toast('Biblioteca de Excel não carregada.');
  const wb = XLSX.utils.book_new();
  if (kind === 'notas') {
    const ns = notasAgg(S.vis).map(a => ({Nota: a.nota, 'KPI MBO': a['KPI MBO'], 'KPI Nota': a['KPI Nota'], Status_Nota: a.Status_Nota, 'Status execução': a.Status_Execução_Nota, 'Situação do prazo': a._prazo,
      Prazo_Final_DELI: xDate('Prazo_Final_DELI', a.Prazo_Final_DELI), 'Qtd Dias p/ Venc': a['Qtd Dias p/ Venc'], Aging: a.AUX_AGING_VENC_Tabela, dataDELI: xDate('dataDELI', a.dataDELI), Polo: a.Polo, 'Executante(s)': a.emps,
      Cliente: a.CLIENTE, 'Tipo de Cliente': a['Tipo de Cliente'], Tipo_Obj_Nota: a.Tipo_Obj_Nota, Projetos: a.np, 'UPS planejado': a.ups, 'Programações': a.progs, data_nota: xDate('data_nota', a.data_nota), camada: a.camada, municipio: a.municipio, bairro: a.bairro, 'Mudança': a._mud}));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ns), 'Notas');
  } else {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetRows(kind === 'full' ? S.rows : S.vis)), 'Projetos');
  }
  XLSX.utils.book_append_sheet(wb, filtrosSheet(), 'Filtros');
  XLSX.writeFile(wb, `FCU_Atendimento_${kind === 'notas' ? 'Notas' : kind === 'full' ? 'Base_Completa' : 'Projetos'}_${stamp()}.xlsx`);
}
function exportHist(ps, nota) {
  if (typeof XLSX === 'undefined') return;
  const wb = XLSX.utils.book_new(), out = [];
  for (const p of ps) for (const f of S.fotos) { const x = f.byP.get(p.Projeto); const o = {Foto: fd(f.ref), Projeto: p.Projeto, Consta: x ? 'sim' : 'não'}; for (const [k, l] of HIST_P) o[l] = x ? xDate(k, x[k]) : null; out.push(o); }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(out), 'Histórico (fotos)');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetRows(ps)), 'Dados atuais');
  XLSX.writeFile(wb, `Historico_${nota ? 'Nota_' + nota : ps[0].Projeto.replace(/[^\w.-]+/g, '_')}_${stamp()}.xlsx`);
}
function download(name, text) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], {type: 'text/javascript'})); a.download = name; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
function exportMenu() {
  openModal(`<h2 style="margin:0 0 12px">Exportar</h2><div class="opt">
    <button class="btn" data-x="proj">Projetos do recorte atual (Excel)<small>${nf.format(S.vis.length)} projetos · todas as ${S.cols.length} colunas da FCU + situação, mudança e link do Google Maps</small></button>
    <button class="btn" data-x="notas">Notas do recorte atual (Excel)<small>${nf.format(new Set(S.vis.map(r => r.nota)).size)} notas agregadas</small></button>
    <button class="btn" data-x="full">Base completa (Excel)<small>${nf.format(S.rows.length)} projetos, sem filtros</small></button>
    <button class="btn" data-x="basejs">data/base.js e data/historico.js para publicar no GitHub<small>use após importar uma planilha nova no site</small></button></div>`, true);
}

/* ---------- importação ---------- */
function importMenu() {
  openModal(`<h2 style="margin:0 0 6px">Importar planilha FCU</h2>
    <p class="muted">Arquivo "FCU – Ferramenta de Controle (geral atendimento)" com as colunas Projeto, nota, KPI MBO… A foto atual passa para o histórico e a planilha importada vira a nova foto atual. Fica salvo só neste navegador; para publicar para todos, exporte o base.js e o historico.js.</p>
    <div class="drop" id="drop">Arraste o .xlsx aqui ou clique para escolher</div>
    <div class="actions">${S.local ? `<button class="btn" id="restore">Restaurar base publicada</button><span class="muted">Base importada em ${new Date(S.local).toLocaleString('pt-BR')}</span>` : ''}</div>`, true);
  const d = $('#drop');
  d.onclick = () => $('#fileIn').click();
  d.ondragover = e => { e.preventDefault(); d.classList.add('over'); }; d.ondragleave = () => d.classList.remove('over');
  d.ondrop = e => { e.preventDefault(); d.classList.remove('over'); if (e.dataTransfer.files[0]) readFile(e.dataTransfer.files[0]); };
  const rs = $('#restore'); if (rs) rs.onclick = async () => { await idbDel(); location.reload(); };
}
async function readFile(file) {
  try {
    $('#loading').classList.remove('off'); $('#loading span').textContent = 'Lendo ' + file.name + '…';
    const wb = XLSX.read(await file.arrayBuffer(), {type: 'array', cellDates: true});
    let rows = null, sheet = null;
    for (const n of wb.SheetNames) { const js = XLSX.utils.sheet_to_json(wb.Sheets[n], {defval: null}); if (js.length && ['Projeto', 'nota', 'KPI MBO'].every(c => c in js[0])) { rows = js; sheet = n; break; } }
    if (!rows) throw new Error('Nenhuma aba com as colunas Projeto, nota e KPI MBO.');
    const names = Object.keys(rows[0]).filter(c => !/^__EMPTY|^Unnamed/.test(c));
    const clean = v => { if (v == null) return null; if (v instanceof Date) { if (v.getFullYear() < 1950 || v.getFullYear() >= 9999) return null; const t = new Date(v.getTime() + 12 * 36e5); return t.toISOString().slice(0, 10); } if (typeof v === 'string') { v = v.replace(/\s+/g, ' ').trim(); return v || null; } if (typeof v === 'number') return Math.round(v * 1e6) / 1e6; return v; };
    const data = rows.filter(r => r.Projeto != null).map(r => Object.fromEntries(names.map(c => [c, clean(r[c])])));
    const nb = {meta: {arquivo: file.name, aba: sheet, linhas: data.length, notas: new Set(data.map(r => r.nota)).size, referencia: refDate(data), gerado: isoNow().slice(0, 16).replace(' ', 'T')}, cols: encode(data, names)};
    let hist = S.hist.slice();
    if (S.base.meta.referencia !== nb.meta.referencia) hist = hist.filter(h => h.meta.referencia !== S.base.meta.referencia).concat([S.base]);
    hist = hist.filter(h => h.meta.referencia !== nb.meta.referencia).sort((a, b) => (a.meta.referencia || '').localeCompare(b.meta.referencia || '')).slice(-12);
    await idbSet({base: nb, hist, at: Date.now()});
    location.hash = ''; location.reload();
  } catch (e) { $('#loading').classList.add('off'); toast('Erro ao importar: ' + e.message, 7000); }
}
function idb() { return new Promise((res, rej) => { const r = indexedDB.open('fcu_atendimento_mbo', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
async function idbGet() { try { const db = await idb(); return await new Promise(res => { const q = db.transaction('kv').objectStore('kv').get('local'); q.onsuccess = () => res(q.result); q.onerror = () => res(null); }); } catch { return null; } }
async function idbSet(v) { const db = await idb(); return new Promise((res, rej) => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, 'local'); t.oncomplete = res; t.onerror = () => rej(t.error); }); }
async function idbDel() { try { const db = await idb(); return new Promise(res => { const t = db.transaction('kv', 'readwrite'); t.objectStore('kv').delete('local'); t.oncomplete = res; t.onerror = res; }); } catch {} }

/* ---------- estado salvo ---------- */
function saveState() { try { localStorage.setItem('fcu_atd_f', JSON.stringify(Object.fromEntries(Object.entries(S.f).map(([k, v]) => [k, v instanceof Set ? {s: [...v]} : v])))); } catch {} }
function loadState() { try { const o = JSON.parse(localStorage.getItem('fcu_atd_f') || '{}'); for (const [k, v] of Object.entries(o)) if (S.F[k]) S.f[k] = v && v.s ? new Set(v.s) : v; } catch {} }

/* ---------- eventos ---------- */
function bind() {
  setInterval(clock, 1000); clock();
  $('#sideBody').addEventListener('change', e => {
    const t = e.target, k = t.dataset.k; if (!k) return;
    if (t.type === 'checkbox' && t.dataset.p === 'vazio') { S.f[k] = Object.assign(S.f[k] || {}, {vazio: t.checked}); if (!active(S.F[k])) delete S.f[k]; }
    else if (t.type === 'checkbox') setList(k, t.value);
    else if (t.type === 'date') { S.f[k] = Object.assign(S.f[k] || {vazio: true}, {[t.dataset.p]: t.value}); if (!active(S.F[k])) delete S.f[k]; }
    apply();
  });
  $('#sideBody').addEventListener('input', e => {
    const t = e.target;
    if (t.dataset.s) return renderOpts(t.dataset.s);
    if (t.type === 'text' && t.dataset.k) { t.value.trim() ? S.f[t.dataset.k] = t.value : delete S.f[t.dataset.k]; apply(); }
  });
  $('#sideBody').addEventListener('click', e => { const c = e.target.closest('[data-clr]'); if (c) { clearF(c.dataset.clr); renderSide(); apply(true); } });
  $('#sideBody').addEventListener('toggle', e => { const d = e.target.closest('details[data-g]'); if (d) { openSec[d.dataset.g] = d.open; try { localStorage.setItem('fcu_atd_sec', JSON.stringify(openSec)); } catch {} } }, true);
  $('#btnClear').onclick = () => { S.f = {}; renderSide(); apply(true); };
  $('#chips').onclick = e => { const b = e.target.closest('[data-k]'); if (!b) return; b.dataset.k === '*' ? S.f = {} : clearF(b.dataset.k); renderSide(); apply(true); };
  $('#mboSeg').onclick = e => { const b = e.target.closest('button'); if (!b) return; b.dataset.v ? S.f['KPI MBO'] = new Set([b.dataset.v]) : delete S.f['KPI MBO']; apply(true); };
  $('#kpis').onclick = e => { const c = e.target.closest('[data-kpi]'); if (!c) return; const d = KDEF.find(x => x.id === c.dataset.kpi);
    if (!d.set) return; const on = isSet(d.set); for (const k of ['AUX_TRATAR_NOTA', '_prazo', 'Status_Execução_Nota', '_coord']) if (Object.keys(d.set).includes(k) || !on) {}
    for (const [k, vs] of Object.entries(d.set)) on ? delete S.f[k] : S.f[k] = new Set(vs);
    apply(true); };
  $('#kpis').onkeydown = e => { if (e.key === 'Enter') e.target.click(); };
  $('#mboCards').onclick = e => { const c = e.target.closest('[data-mbo]'); if (!c) return; const m = c.dataset.mbo; setList('KPI MBO', m, true); apply(true); };
  $('#vencJan').onchange = () => renderMbo();
  $('#vencFiltrar').onclick = () => { const N = +$('#vencJan').value; S.f['KPI MBO'] = new Set(['MBO']); S.f._dv = {min: 0, max: N}; apply(true); S.mode = 'notas'; S.sort.notas = ['dv', 1]; syncMode(); renderTable(); location.hash = '#base'; };
  $('#mapColor').onclick = e => { const b = e.target.closest('button'); if (!b) return; S.mapColor = b.dataset.v; $$('#mapColor button').forEach(x => x.classList.toggle('on', x === b)); renderMap(); };
  $('#mapFit').onclick = () => renderMap(true);
  $('#tblMode').onclick = e => { const b = e.target.closest('button'); if (!b) return; S.mode = b.dataset.v; S.page = 1; syncMode(); renderTable(); };
  let tt; $('#tQ').oninput = e => { clearTimeout(tt); tt = setTimeout(() => { S.tq = e.target.value; S.page = 1; renderTable(); }, 200); };
  $('#tSize').onchange = () => { S.page = 1; renderTable(); };
  $('#tbl thead').onclick = e => { const th = e.target.closest('th'); if (!th) return; const s = S.sort[S.mode]; s[1] = s[0] === th.dataset.k ? -s[1] : 1; s[0] = th.dataset.k; renderTable(); };
  $('#pager').onclick = e => { const b = e.target.closest('[data-pg]'); if (!b || b.disabled) return; S.page = +b.dataset.pg; renderTable(); $('#base').scrollIntoView(); };
  $('#btnExportTbl').onclick = () => exportXlsx(S.mode === 'notas' ? 'notas' : 'proj');
  $('#btnExport').onclick = exportMenu; $('#btnImport').onclick = importMenu;
  $('#fileIn').onchange = e => { if (e.target.files[0]) readFile(e.target.files[0]); e.target.value = ''; };
  document.addEventListener('click', e => {
    const p = e.target.closest('[data-p]'), n = e.target.closest('[data-n]'), x = e.target.closest('[data-x]');
    if (p) { e.preventDefault(); openProjeto(p.dataset.p); }
    else if (n) { e.preventDefault(); openNota(n.dataset.n); }
    else if (x) { const k = x.dataset.x; closeModal(); if (k === 'basejs') { download('base.js', 'window.FCU_ATD=' + JSON.stringify(S.base) + ';\n'); setTimeout(() => download('historico.js', 'window.FCU_HIST=' + JSON.stringify(S.hist) + ';\n'), 600); } else exportXlsx(k); }
    if (e.target.id === 'mBack') { const c = S.stack.pop(); S.cur = null; c.t === 'p' ? openProjeto(c.id, true) : openNota(c.id, true); }
    if (e.target.id === 'mCopy') { navigator.clipboard?.writeText(location.href).then(() => toast('Link copiado.'), () => toast(location.href, 6000)); }
  });
  $('#modalX').onclick = closeModal; $('#modal').onclick = e => { if (e.target.id === 'modal') closeModal(); };
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (!$('#modal').hidden) closeModal(); else closeSide(); } });
  $('#btnFilters').onclick = () => { $('#side').classList.add('open'); $('#scrim').hidden = false; };
  const closeSide = () => { $('#side').classList.remove('open'); $('#scrim').hidden = true; };
  $('#sideX').onclick = closeSide; $('#scrim').onclick = closeSide;
  window.addEventListener('hashchange', openFromHash);
  // menu ativo conforme rolagem
  const secs = ['painel', 'mbo', 'aging', 'status', 'mapa', 'base'].map(id => document.getElementById(id));
  const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) $$('#tabs a').forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + en.target.id)); }), {rootMargin: '-45% 0px -50% 0px'});
  secs.forEach(s => io.observe(s));
  new IntersectionObserver(es => { if (es[0].isIntersecting && MAP) MAP.invalidateSize(); }).observe($('#map'));
}
function syncMode() { $$('#tblMode button').forEach(x => x.classList.toggle('on', x.dataset.v === S.mode)); }
function clock() {
  const now = new Date();
  $('#clockTime').textContent = now.toLocaleTimeString('pt-BR', {timeZone: 'America/Sao_Paulo'});
  $('#clockDate').textContent = now.toLocaleDateString('pt-BR', {timeZone: 'America/Sao_Paulo', weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'});
}

/* ---------- início ---------- */
async function start() {
  try {
    if (!window.FCU_ATD) throw new Error('Arquivo data/base.js não encontrado na pasta do site.');
    const loc = await idbGet();
    if (loc && loc.base) { S.local = loc.at; load(loc.base, loc.hist); toast(`Usando a base importada neste navegador (${new Date(loc.at).toLocaleString('pt-BR')}). Para voltar à publicada: Importar Excel → Restaurar.`, 7000); }
    else load(window.FCU_ATD, window.FCU_HIST || []);
    const cur = S.fotos[S.fotos.length - 1], m = S.base.meta;
    const hs = S.fotos.slice(0, -1).map(f => fd(f.ref));
    $('#subRef').textContent = `Base FCU de ${fd(cur.ref)} · ${nf.format(new Set(S.rows.map(r => r.nota)).size)} notas · ${nf.format(S.rows.length)} projetos${hs.length ? ' · histórico: ' + hs.join(', ') : ''}`;
    $('#footMeta').innerHTML = `Base atual: <b>${esc(m.arquivo)}</b> (aba ${esc(m.aba || '—')}, referência ${fd(cur.ref)}, ${nf.format(S.rows.length)} projetos)${hs.length ? ` · Fotos anteriores usadas só no histórico: ${hs.join(', ')}` : ''}`;
    loadState(); evaluate(); renderSide(); bind(); renderAll();
    openFromHash();
  } catch (e) {
    console.error(e);
    $('#main').innerHTML = `<div class="card" style="padding:20px;border-color:#f5c2c0;background:#fef3f2"><b>Não foi possível carregar o painel.</b><br>${esc(e.message)}</div>`;
  } finally { $('#loading').classList.add('off'); }
}
document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', start) : start();
})();

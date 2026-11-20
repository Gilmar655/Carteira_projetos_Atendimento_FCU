/* Carteira de Projetos — Atendimento FCU
 * Lê data/atual.json (aba Sheet1), data/anterior.json (aba Planilha1) e data/meta.json.
 * Nenhuma informação é criada: tudo vem das colunas da planilha. Contadores usam a data/hora de Brasília.
 */
(() => {
  'use strict';

  // ---------- utilitários ----------
  const TZ = 'America/Sao_Paulo';
  const $ = (s, r = document) => r.querySelector(s);
  const el = (tag, attrs = {}, ...filhos) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const f of filhos.flat()) if (f != null && f !== false) e.append(f instanceof Node ? f : String(f));
    return e;
  };
  const nf = new Intl.NumberFormat('pt-BR');
  const num = (v) => (v == null || v === '') ? '—' : (typeof v === 'number' ? nf.format(v) : String(v));
  const vazio = (v) => v == null || v === '';
  const fd = (iso) => { if (!iso) return '—'; const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
  const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
  const isoUTC = (iso) => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  // Brasil sem horário de verão desde 2019: 00:00 em Brasília = 03:00 UTC
  const instanteBR = (iso) => isoUTC(iso) + 3 * 3600e3;
  const hojeISO = () => new Intl.DateTimeFormat('en-CA', {timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit'}).format(new Date());
  const diasAte = (iso) => iso ? Math.round((isoUTC(iso) - isoUTC(hojeISO())) / 864e5) : null;
  const rel = (n) => n == null ? '' : n === 0 ? 'hoje' : n > 0 ? `em ${n} dia${n > 1 ? 's' : ''}` : `há ${-n} dia${n < -1 ? 's' : ''}`;
  const DATAS = new Set(['dataAPRO', 'dataAUTO', 'dataOLLI', 'Prazo_Final_DELI', 'dataDELI', 'Data_Max_Prog', 'Data_Max_Prog_nota', 'data_nota', 'Inicio_prev', 'Fim_prev', 'dataDELIPJ']);
  const CRUS = new Set(['nota', 'contrato', 'LocalInst', 'Latitude', 'Longitude', 'Area Real', 'Circuito']);
  const fmtCampo = (f, v) => vazio(v) ? '—' : DATAS.has(f) ? fd(v) : CRUS.has(f) ? String(v) : num(v);

  // ---------- estado ----------
  const S = {
    meta: null, rows: [], porProjeto: new Map(), porNota: new Map(),
    ant: new Map(), antPorNota: new Map(), colunas: [],
    filtros: {}, busca: '', mbo: null, aba: 'projetos', ord: {projetos: ['_dias', 1], notas: ['_dias', 1]},
    pagina: 1, porPagina: 50, pilha: []
  };

  // ---------- relógio de Brasília ----------
  const fmtHora = new Intl.DateTimeFormat('pt-BR', {timeZone: TZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false});
  const fmtData = new Intl.DateTimeFormat('pt-BR', {timeZone: TZ, weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'});
  let ultimoDia = hojeISO();
  function relogio() {
    const agora = new Date();
    $('#relogio').textContent = fmtHora.format(agora);
    const dt = fmtData.format(agora);
    $('#dataHoje').textContent = dt.charAt(0).toUpperCase() + dt.slice(1);
    document.querySelectorAll('.cd[data-prazo]').forEach(atualizaContador);
    const g = $('#contadorGrande'); if (g) atualizaGrande(g);
    const h = hojeISO();
    if (h !== ultimoDia && S.rows.length) { ultimoDia = h; derivar(); renderTudo(); }
  }

  // ---------- contadores ----------
  function partes(prazoIso) {
    let ms = instanteBR(prazoIso) - Date.now();
    const venc = ms < 0; ms = Math.abs(ms);
    return {venc, d: Math.floor(ms / 864e5), h: Math.floor(ms / 36e5) % 24, m: Math.floor(ms / 6e4) % 60, s: Math.floor(ms / 1e3) % 60};
  }
  const p2 = (n) => String(n).padStart(2, '0');
  function classeCd(p) { return p.venc ? 'vencido' : p.d <= 7 ? 'alerta' : p.d <= 30 ? 'alerta' : 'ok'; }
  function contador(prazo, entregue) {
    const s = el('span', {class: 'cd', 'data-prazo': prazo || '', 'data-entregue': entregue || ''});
    atualizaContador(s); return s;
  }
  function atualizaContador(s) {
    const prazo = s.dataset.prazo, ent = s.dataset.entregue;
    if (ent) { s.className = 'cd neutro'; s.textContent = 'Entregue ' + fd(ent); return; }
    if (!prazo) { s.className = 'cd neutro'; s.textContent = 'Sem prazo'; return; }
    const p = partes(prazo);
    s.className = 'cd ' + classeCd(p);
    s.textContent = (p.venc ? '−' : '') + `${p.d}d ${p2(p.h)}:${p2(p.m)}:${p2(p.s)}`;
  }
  function atualizaGrande(box) {
    const prazo = box.dataset.prazo; const p = partes(prazo);
    box.className = 'contador-grande ' + classeCd(p);
    box.querySelectorAll('.n').forEach((n, i) => { n.textContent = i === 0 ? p.d : p2([p.h, p.m, p.s][i - 1]); });
    const lbl = document.getElementById('contadorRotulo');
    if (lbl) { lbl.textContent = p.venc ? 'Prazo vencido há' : 'Vence em'; lbl.className = 'badge ' + (p.venc ? 'bad' : p.d <= 30 ? 'warn' : 'ok'); }
  }
  function blocoContador(r) {
    const box = el('div');
    if (r.dataDELI) {
      const n = r.Prazo_Final_DELI ? Math.round((isoUTC(r.Prazo_Final_DELI) - isoUTC(r.dataDELI)) / 864e5) : null;
      box.append(el('span', {class: 'badge ok', text: 'Entregue (dataDELI)'}),
        el('p', {text: `Entregue em ${fd(r.dataDELI)}` + (n == null ? '.' : n >= 0 ? `, ${n} dia(s) antes do prazo final (${fd(r.Prazo_Final_DELI)}).` : `, ${-n} dia(s) depois do prazo final (${fd(r.Prazo_Final_DELI)}).`)}));
      return box;
    }
    if (!r.Prazo_Final_DELI) {
      box.append(el('span', {class: 'badge warn', text: 'Sem prazo final na planilha'}), el('p', {class: 'muted', text: `Tipo_Prazo: ${r.Tipo_Prazo ?? '—'}`}));
      return box;
    }
    const g = el('div', {class: 'contador-grande', id: 'contadorGrande', 'data-prazo': r.Prazo_Final_DELI},
      ...['dias', 'horas', 'min', 'seg'].map((t) => el('div', {class: 'u'}, el('span', {class: 'n', text: '0'}), el('span', {class: 't', text: t}))));
    box.append(el('span', {id: 'contadorRotulo', class: 'badge'}), g,
      el('p', {class: 'muted', text: `Prazo final (Prazo_Final_DELI): ${fd(r.Prazo_Final_DELI)} · Tipo_Prazo ${r.Tipo_Prazo ?? '—'} · contagem até 00:00 (Brasília) do dia do prazo.`}));
    atualizaGrande(g);
    return box;
  }

  // ---------- carga ----------
  async function carregar() {
    try {
      const [meta, atual, anterior] = await Promise.all(['meta', 'atual', 'anterior'].map((n) => fetch(`data/${n}.json`, {cache: 'no-cache'}).then((r) => { if (!r.ok) throw new Error(`data/${n}.json (${r.status})`); return r.json(); })));
      S.meta = meta; S.colunas = atual.colunas;
      S.rows = atual.linhas.map((l) => Object.fromEntries(atual.colunas.map((c, i) => [c, l[i]])));
      for (const l of anterior.linhas) {
        const o = Object.fromEntries(anterior.colunas.map((c, i) => [c, l[i]]));
        S.ant.set(o.Projeto, o);
        const k = String(o.nota); if (!S.antPorNota.has(k)) S.antPorNota.set(k, []); S.antPorNota.get(k).push(o);
      }
      for (const r of S.rows) {
        S.porProjeto.set(r.Projeto, r);
        const k = String(r.nota); if (!S.porNota.has(k)) S.porNota.set(k, []); S.porNota.get(k).push(r);
      }
      derivar(); montarFiltros(); montarEventos(); cabecalhos();
      $('#loading').hidden = true; $('#app').hidden = false;
      renderTudo(); abrirPeloHash();
    } catch (e) {
      $('#loading').hidden = true;
      const box = $('#erro'); box.hidden = false;
      box.textContent = 'Não foi possível carregar os dados: ' + e.message + '. Se abriu o arquivo direto do computador, use o site publicado no GitHub Pages ou um servidor local (python -m http.server).';
    }
  }

  const SITUACOES = ['Vencido', 'Vence em até 7 dias', 'Vence em 8 a 30 dias', 'Vence em 31 a 90 dias', 'Vence em mais de 90 dias', 'Sem prazo', 'Entregue (DELI)'];
  function derivar() {
    for (const r of S.rows) {
      const d = r.dataDELI ? null : diasAte(r.Prazo_Final_DELI);
      r._dias = d;
      r._situacao = r.dataDELI ? 'Entregue (DELI)' : !r.Prazo_Final_DELI ? 'Sem prazo' : d < 0 ? 'Vencido' : d <= 7 ? 'Vence em até 7 dias' : d <= 30 ? 'Vence em 8 a 30 dias' : d <= 90 ? 'Vence em 31 a 90 dias' : 'Vence em mais de 90 dias';
      const a = S.ant.get(r.Projeto);
      r._mudou = !a ? 'Novo (não consta em 19/10)' :
        (String(a.Qtde_Programacoes) !== String(r.Qtde_Programacoes) || (a.Data_Max_Prog || '') !== (r.Data_Max_Prog || '') || a.Status_Execução_Nota !== r.Status_Execução_Nota) ? 'Programação alterada' : 'Programação sem alteração';
      r._busca = norm([r.Projeto, r.nota, r.CLIENTE, r.Circuito, r.LocalInst, r.bairro].join(' '));
    }
  }

  // ---------- filtros suspensos ----------
  const FILTROS = [
    ['_situacao', 'Situação do prazo'], ['KPI MBO', 'KPI MBO'], ['Polo', 'Polo'], ['Area Real', 'Área'],
    ['Empreiteira_Contratos', 'Empreiteira'], ['Tipo_Projeto', 'Tipo de projeto'], ['Tipo_Obj_Nota', 'Tipo da nota'],
    ['Status_Execução_Nota', 'Execução da nota'], ['Status_Nota', 'Status da nota'], ['Status_Projeto', 'Status do projeto'],
    ['KPI Nota', 'KPI Nota'], ['KPI Projeto', 'KPI Projeto'], ['Tipo de Cliente', 'Tipo de cliente'], ['municipio', 'Município'],
    ['bairro', 'Bairro'], ['camada', 'Camada'], ['Nível_Projeto', 'Nível do projeto'], ['Nível_Tensão', 'Nível de tensão'],
    ['Tipo_Prazo', 'Tipo de prazo'], ['NEC_UPS', 'NEC/UPS'], ['_mudou', 'Mudança desde 19/10']
  ];
  const SEM = '(vazio)';
  const chaveF = (r, k) => vazio(r[k]) ? SEM : String(r[k]);

  function montarFiltros() {
    const box = $('#filtros'); box.replaceChildren();
    for (const [k, rot] of FILTROS) {
      if (!k.startsWith('_') && !S.colunas.includes(k)) continue;
      const cont = new Map();
      for (const r of S.rows) { const v = chaveF(r, k); cont.set(v, (cont.get(v) || 0) + 1); }
      let ops = [...cont.keys()];
      if (k === '_situacao') ops = SITUACOES.filter((s) => cont.has(s));
      else ops.sort((a, b) => a === SEM ? 1 : b === SEM ? -1 : a.localeCompare(b, 'pt-BR', {numeric: true}));
      const painel = el('div', {class: 'dd-painel', hidden: true});
      const lista = el('div', {class: 'dd-opcoes'});
      const desenhaOps = (q = '') => {
        lista.replaceChildren(...ops.filter((o) => norm(o).includes(norm(q))).map((o) => {
          const cb = el('input', {type: 'checkbox', value: o});
          cb.checked = !!S.filtros[k]?.has(o);
          cb.addEventListener('change', () => {
            const set = S.filtros[k] || (S.filtros[k] = new Set());
            cb.checked ? set.add(o) : set.delete(o);
            if (!set.size) delete S.filtros[k];
            aplicar();
          });
          return el('label', {}, cb, el('span', {text: o}), el('span', {class: 'c', text: nf.format(cont.get(o))}));
        }));
      };
      if (ops.length > 8) painel.append(el('input', {type: 'search', placeholder: 'Procurar…', oninput: (e) => desenhaOps(e.target.value)}));
      painel.append(lista, el('div', {class: 'dd-acoes'},
        el('button', {class: 'link', type: 'button', text: 'Marcar todos', onclick: () => { S.filtros[k] = new Set(ops); desenhaOps(); aplicar(); }}),
        el('button', {class: 'link', type: 'button', text: 'Limpar', onclick: () => { delete S.filtros[k]; desenhaOps(); aplicar(); }})));
      const btn = el('button', {class: 'dd-btn', type: 'button', 'data-k': k, 'aria-expanded': 'false'}, el('span', {text: rot}));
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const abrir = painel.hidden;
        document.querySelectorAll('.dd-painel').forEach((p) => { p.hidden = true; });
        document.querySelectorAll('.dd-btn').forEach((b) => b.setAttribute('aria-expanded', 'false'));
        if (abrir) { desenhaOps(); painel.hidden = false; btn.setAttribute('aria-expanded', 'true'); }
      });
      painel.addEventListener('click', (e) => e.stopPropagation());
      box.append(el('div', {class: 'dd'}, btn, painel));
    }
    document.addEventListener('click', () => document.querySelectorAll('.dd-painel').forEach((p) => { p.hidden = true; }));
  }
  function rotuloFiltro(k) { return (FILTROS.find(([x]) => x === k) || [k, k])[1]; }

  function passa(r, ignorar) {
    if (S.busca && !r._busca.includes(S.busca)) return false;
    if (S.mbo != null && !(r['KPI MBO'] === 'MBO' && !r.dataDELI && r._dias != null && r._dias >= 0 && r._dias <= S.mbo)) return false;
    for (const [k, set] of Object.entries(S.filtros)) { if (k === ignorar) continue; if (!set.has(chaveF(r, k))) return false; }
    return true;
  }
  const filtrados = () => S.rows.filter((r) => passa(r));

  function desenhaChips() {
    const box = $('#chips'); box.replaceChildren();
    const chip = (txt, rm) => el('span', {class: 'chip'}, txt, el('button', {type: 'button', 'aria-label': 'Remover', text: '×', onclick: rm}));
    if (S.busca) box.append(chip(`Busca: “${$('#busca').value}”`, () => { $('#busca').value = ''; S.busca = ''; aplicar(); }));
    if (S.mbo != null) box.append(chip(`MBO a vencer em até ${S.mbo} dias`, () => { S.mbo = null; aplicar(); }));
    for (const [k, set] of Object.entries(S.filtros)) for (const v of set) box.append(chip(`${rotuloFiltro(k)}: ${v}`, () => { set.delete(v); if (!set.size) delete S.filtros[k]; aplicar(); }));
    document.querySelectorAll('.dd-btn').forEach((b) => {
      const n = S.filtros[b.dataset.k]?.size || 0;
      b.classList.toggle('ativo', n > 0);
      b.querySelector('.n')?.remove();
      if (n) b.append(el('span', {class: 'n', text: n}));
    });
  }

  function aplicar() { S.pagina = 1; renderTudo(); }

  // ---------- indicadores ----------
  function renderKpis() {
    const notasAbertas = new Map();
    let futura = 0;
    for (const r of S.rows) {
      if (r.Data_Max_Prog && diasAte(r.Data_Max_Prog) >= 0) futura++;
      if (!r.dataDELI) notasAbertas.set(String(r.nota), r.Prazo_Final_DELI);
    }
    let venc = 0;
    for (const p of notasAbertas.values()) if (p && diasAte(p) < 0) venc++;
    $('#kTotal').textContent = nf.format(S.rows.length);
    $('#kTotalFoot').textContent = `${nf.format(S.porNota.size)} notas`;
    $('#kCarteira').textContent = nf.format(notasAbertas.size);
    $('#kVencidas').textContent = nf.format(venc);
    $('#kProgFut').textContent = nf.format(futura);

    const jan = Number($('#mboJanela').value);
    const mboAbertos = S.rows.filter((r) => r['KPI MBO'] === 'MBO' && !r.dataDELI && r.Prazo_Final_DELI);
    const aVencer = mboAbertos.filter((r) => r._dias >= 0 && r._dias <= jan).sort((a, b) => a._dias - b._dias || a.Projeto.localeCompare(b.Projeto));
    $('#mboHoje').textContent = fd(hojeISO());
    $('#mboProj').textContent = nf.format(aVencer.length);
    $('#mboNotas').textContent = nf.format(new Set(aVencer.map((r) => String(r.nota))).size);
    $('#mboVenc').textContent = nf.format(mboAbertos.filter((r) => r._dias < 0).length);
    const ul = $('#mboLista'); ul.replaceChildren();
    if (!aVencer.length) ul.append(el('li', {text: 'Nenhum projeto MBO vence nesse período.'}));
    for (const r of aVencer.slice(0, 12)) {
      ul.append(el('li', {onclick: () => abrirProjeto(r.Projeto, true), title: 'Abrir histórico'},
        el('span', {}, el('b', {text: r.Projeto}), ` · nota ${r.nota}`),
        el('span', {class: 'd ' + (r._dias <= 7 ? 'cd vencido' : 'cd alerta'), text: r._dias === 0 ? 'vence hoje' : `${r._dias} dia(s) · ${fd(r.Prazo_Final_DELI)}`})));
    }
  }

  // ---------- gráficos ----------
  const COR_SIT = {'Vencido': 'var(--bad)', 'Vence em até 7 dias': '#f04438', 'Vence em 8 a 30 dias': 'var(--warn)', 'Vence em 31 a 90 dias': '#fdb022', 'Vence em mais de 90 dias': 'var(--ok)', 'Sem prazo': '#98a2b3', 'Entregue (DELI)': 'var(--azul)'};
  function renderGraficos() {
    const base = S.rows.filter((r) => passa(r, '_situacao'));
    const cont = new Map(SITUACOES.map((s) => [s, 0]));
    base.forEach((r) => cont.set(r._situacao, cont.get(r._situacao) + 1));
    const max = Math.max(1, ...cont.values());
    $('#chartSituacao').replaceChildren(...SITUACOES.map((s) => {
      const n = cont.get(s);
      const ativo = S.filtros._situacao?.has(s);
      return el('div', {class: 'bar', title: `${s}: ${nf.format(n)} projetos`, onclick: () => alterna('_situacao', s), style: ativo ? 'font-weight:700' : null},
        el('span', {text: s}), el('div', {class: 'bar-trilho'}, el('span', {style: `width:${(n / max) * 100}%;background:${COR_SIT[s]}`})), el('span', {class: 'bar-val', text: nf.format(n)}));
    }));

    const porPolo = new Map();
    S.rows.filter((r) => passa(r, 'Polo') && !r.dataDELI).forEach((r) => {
      const p = r.Polo || SEM; const o = porPolo.get(p) || {v: 0, n: 0};
      r._dias != null && r._dias < 0 ? o.v++ : o.n++; porPolo.set(p, o);
    });
    const polos = [...porPolo.entries()].sort((a, b) => (b[1].v + b[1].n) - (a[1].v + a[1].n));
    const mp = Math.max(1, ...polos.map(([, o]) => o.v + o.n));
    const box = $('#chartPolo');
    box.replaceChildren(...polos.map(([p, o]) => el('div', {class: 'bar', title: `${p}: ${nf.format(o.v)} vencidos, ${nf.format(o.n)} no prazo ou sem prazo`, onclick: () => alterna('Polo', p)},
      el('span', {text: p}), el('div', {class: 'bar-trilho'}, el('span', {style: `width:${(o.v / mp) * 100}%;background:var(--bad)`}), el('span', {style: `width:${(o.n / mp) * 100}%;background:var(--azul)`})),
      el('span', {class: 'bar-val', text: `${nf.format(o.v)} / ${nf.format(o.v + o.n)}`}))));
    if (!polos.length) box.append(el('p', {class: 'muted', text: 'Nenhum projeto em carteira com os filtros atuais.'}));
    box.append(el('div', {class: 'legenda'}, el('span', {}, el('i', {style: 'background:var(--bad)'}), 'Vencidos'), el('span', {}, el('i', {style: 'background:var(--azul)'}), 'No prazo ou sem prazo'), el('span', {text: 'valor: vencidos / total'})));
  }
  function alterna(k, v) {
    const set = S.filtros[k] || (S.filtros[k] = new Set());
    set.has(v) ? set.delete(v) : set.add(v);
    if (!set.size) delete S.filtros[k];
    aplicar();
  }

  // ---------- tabela ----------
  const COLS = {
    projetos: [
      ['Projeto', 'Projeto'], ['nota', 'Nota'], ['CLIENTE', 'Cliente'], ['Tipo_Projeto', 'Tipo de projeto'], ['Empreiteira_Contratos', 'Empreiteira'],
      ['Polo', 'Polo'], ['Status_Execução_Nota', 'Execução'], ['Qtde_Programacoes', 'Prog.', 'num'], ['Data_Max_Prog', 'Última prog.'],
      ['KPI MBO', 'MBO'], ['Prazo_Final_DELI', 'Prazo final'], ['_dias', 'Contador']
    ],
    notas: [
      ['nota', 'Nota'], ['CLIENTE', 'Cliente'], ['Tipo_Obj_Nota', 'Tipo da nota'], ['_nproj', 'Projetos', 'num'], ['Status_Nota', 'Status da nota'],
      ['Status_Execução_Nota', 'Execução'], ['_somaProg', 'Prog. (soma)', 'num'], ['Data_Max_Prog_nota', 'Última prog. nota'], ['KPI MBO', 'MBO'],
      ['Prazo_Final_DELI', 'Prazo final'], ['_dias', 'Contador']
    ]
  };
  function cabecalhos() {
    const [k, dir] = S.ord[S.aba];
    const tr = el('tr', {}, ...COLS[S.aba].map(([c, rot]) => el('th', {class: c === k ? ('ord' + (dir < 0 ? ' desc' : '')) : null, onclick: () => {
      const o = S.ord[S.aba]; S.ord[S.aba] = [c, o[0] === c ? -o[1] : 1]; cabecalhos(); renderTabela();
    }, text: rot})));
    $('#tabela thead').replaceChildren(tr);
  }
  function comparar(k, dir) {
    return (a, b) => {
      let x = a[k], y = b[k];
      if (k === '_dias') { x = a.dataDELI ? 1e9 : (x ?? 1e8); y = b.dataDELI ? 1e9 : (y ?? 1e8); }
      if (vazio(x) && vazio(y)) return 0; if (vazio(x)) return 1; if (vazio(y)) return -1;
      return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'pt-BR', {numeric: true})) * dir;
    };
  }
  function linhasNotas(lista) {
    const m = new Map();
    for (const r of lista) {
      const k = String(r.nota);
      if (!m.has(k)) {
        const todos = S.porNota.get(k);
        m.set(k, {nota: r.nota, CLIENTE: r.CLIENTE, Tipo_Obj_Nota: r.Tipo_Obj_Nota, Status_Nota: r.Status_Nota, Status_Execução_Nota: r.Status_Execução_Nota,
          Data_Max_Prog_nota: r.Data_Max_Prog_nota, 'KPI MBO': r['KPI MBO'], Prazo_Final_DELI: r.Prazo_Final_DELI, dataDELI: r.dataDELI, _dias: r._dias,
          _nproj: todos.length, _nfilt: 0, _somaProg: todos.reduce((s, x) => s + (Number(x.Qtde_Programacoes) || 0), 0)});
      }
      m.get(k)._nfilt++;
    }
    return [...m.values()];
  }
  function renderTabela() {
    const lista = filtrados();
    const dados = S.aba === 'projetos' ? lista : linhasNotas(lista);
    const [k, dir] = S.ord[S.aba];
    dados.sort(comparar(k, dir));
    const total = dados.length, pags = Math.max(1, Math.ceil(total / S.porPagina));
    S.pagina = Math.min(S.pagina, pags);
    const ini = (S.pagina - 1) * S.porPagina;
    $('#contagem').textContent = S.aba === 'projetos'
      ? `${nf.format(total)} projeto(s) em ${nf.format(new Set(lista.map((r) => String(r.nota))).size)} nota(s)`
      : `${nf.format(total)} nota(s) com ${nf.format(lista.length)} projeto(s) filtrado(s)`;
    const tb = $('#tabela tbody'); tb.replaceChildren();
    if (!total) tb.append(el('tr', {}, el('td', {class: 'vazio', colspan: COLS[S.aba].length, text: 'Nenhum resultado com os filtros atuais.'})));
    for (const r of dados.slice(ini, ini + S.porPagina)) {
      const tds = COLS[S.aba].map(([c, , cls]) => {
        if (c === 'Projeto') return el('td', {}, el('button', {class: 'link', type: 'button', text: r.Projeto, onclick: () => abrirProjeto(r.Projeto, true)}));
        if (c === 'nota') return el('td', {}, el('button', {class: 'link', type: 'button', text: String(r.nota), onclick: () => abrirNota(r.nota, true)}));
        if (c === '_dias') return el('td', {}, contador(r.Prazo_Final_DELI, r.dataDELI));
        if (c === 'KPI MBO') return el('td', {}, el('span', {class: 'badge ' + (r[c] === 'MBO' ? 'mag' : ''), text: r[c] ?? '—'}));
        if (c === '_nproj') return el('td', {class: 'num', text: r._nfilt === r._nproj ? nf.format(r._nproj) : `${r._nfilt} de ${r._nproj}`});
        return el('td', {class: cls || null, text: fmtCampo(c, r[c])});
      });
      tb.append(el('tr', {}, ...tds));
    }
    const pg = $('#paginacao'); pg.replaceChildren();
    if (pags > 1) {
      const ir = (p) => { S.pagina = p; renderTabela(); $('.tabela-wrap').scrollTop = 0; };
      pg.append(el('button', {class: 'btn', type: 'button', text: '‹ Anterior', disabled: S.pagina === 1, onclick: () => ir(S.pagina - 1)}),
        el('span', {text: `Página ${S.pagina} de ${pags}`}),
        el('button', {class: 'btn', type: 'button', text: 'Próxima ›', disabled: S.pagina === pags, onclick: () => ir(S.pagina + 1)}));
    }
  }

  function renderTudo() { desenhaChips(); renderKpis(); renderGraficos(); renderTabela(); }

  // ---------- painel lateral ----------
  function abrirDrawer(conteudo, empilhar, chave) {
    if (empilhar) S.pilha = []; else if (S.atual) S.pilha.push(S.atual);
    S.atual = chave;
    $('#drawerCorpo').replaceChildren(...conteudo);
    $('#voltar').hidden = !S.pilha.length;
    $('#drawer').hidden = false; document.body.style.overflow = 'hidden';
    $('.drawer-painel').scrollTop = 0;
    history.replaceState(null, '', '#' + chave.tipo + '=' + encodeURIComponent(chave.id));
  }
  function fecharDrawer() { $('#drawer').hidden = true; document.body.style.overflow = ''; S.pilha = []; S.atual = null; history.replaceState(null, '', location.pathname + location.search); }
  function voltar() { const c = S.pilha.pop(); S.atual = null; if (!c) return; (c.tipo === 'projeto' ? abrirProjeto : abrirNota)(c.id, false, true); }
  function abrirPeloHash() {
    const m = location.hash.match(/^#(projeto|nota)=(.+)$/); if (!m) return;
    const id = decodeURIComponent(m[2]); m[1] === 'projeto' ? abrirProjeto(id, true) : abrirNota(id, true);
  }
  const secao = (titulo, ...filhos) => el('section', {class: 'card'}, el('div', {class: 'secao-titulo'}, el('h2', {text: titulo})), ...filhos);
  function badgeSit(r) { const s = r._situacao; return el('span', {class: 'badge ' + (s === 'Vencido' || s === 'Vence em até 7 dias' ? 'bad' : s.startsWith('Vence em') ? (r._dias <= 30 ? 'warn' : 'ok') : s === 'Entregue (DELI)' ? 'info' : ''), text: s}); }

  function tabelaComparacao(campos, r, a) {
    const t = el('table', {class: 'comp'}, el('thead', {}, el('tr', {}, el('th', {text: 'Campo'}), el('th', {text: `19/10/2026 (Planilha1)`}), el('th', {text: `16/11/2026 (Sheet1)`}), el('th', {text: ''}))));
    const tb = el('tbody');
    for (const [f, rot] of campos) {
      const va = a ? a[f] : undefined, vn = r[f];
      const mudou = a && String(va ?? '') !== String(vn ?? '');
      let delta = '';
      if (mudou && typeof va === 'number' && typeof vn === 'number') delta = (vn - va > 0 ? '+' : '') + nf.format(vn - va);
      else if (mudou) delta = 'mudou';
      const extra = DATAS.has(f) && vn && f !== 'data_nota' ? ` (${rel(diasAte(vn))})` : '';
      tb.append(el('tr', {class: mudou ? 'mudou' : null}, el('td', {text: rot}), el('td', {text: a ? fmtCampo(f, va) : 'não consta'}), el('td', {text: fmtCampo(f, vn) + extra}), el('td', {class: 'delta', text: delta})));
    }
    t.append(tb); return el('div', {style: 'overflow-x:auto'}, t);
  }

  function alertasProgramacao(r) {
    const out = [];
    if (r.dataDELI) return out;
    if (r.Data_Max_Prog && r.Prazo_Final_DELI && r.Data_Max_Prog > r.Prazo_Final_DELI)
      out.push(el('div', {class: 'alerta-box bad', text: `A última programação do projeto (${fd(r.Data_Max_Prog)}) é posterior ao prazo final (${fd(r.Prazo_Final_DELI)}).`}));
    if (r.Prazo_Final_DELI && r._dias < 0 && !(r.Data_Max_Prog && diasAte(r.Data_Max_Prog) >= 0))
      out.push(el('div', {class: 'alerta-box bad', text: 'Prazo final vencido e sem programação futura registrada para o projeto.'}));
    if (!r.Data_Max_Prog)
      out.push(el('div', {class: 'alerta-box', text: `Sem data de programação registrada para o projeto (Data_Max_Prog vazia). Qtde_Programacoes na planilha: ${num(r.Qtde_Programacoes)}.`}));
    else if (diasAte(r.Data_Max_Prog) >= 0)
      out.push(el('div', {class: 'alerta-box info', text: `Programação registrada para ${fd(r.Data_Max_Prog)} (${rel(diasAte(r.Data_Max_Prog))}).`}));
    return out;
  }

  function linhaDoTempo(r) {
    const M = [['data_nota', 'Data da nota (data_nota)'], ['dataAPRO', 'dataAPRO'], ['dataAUTO', 'dataAUTO'], ['dataOLLI', 'dataOLLI'],
      ['Inicio_prev', 'Início previsto (Inicio_prev)'], ['Fim_prev', 'Fim previsto (Fim_prev)'], ['Data_Max_Prog', 'Última programação do projeto (Data_Max_Prog)'],
      ['Data_Max_Prog_nota', 'Última programação da nota (Data_Max_Prog_nota)'], ['dataDELIPJ', 'dataDELIPJ'], ['dataDELI', 'Entrega (dataDELI)'], ['Prazo_Final_DELI', 'Prazo final (Prazo_Final_DELI)']];
    const ev = M.filter(([f]) => r[f]).map(([f, l]) => ({f, l, d: r[f]}));
    ev.push({f: null, l: 'Hoje', d: hojeISO()});
    ev.sort((a, b) => a.d < b.d ? -1 : a.d > b.d ? 1 : a.f ? -1 : 1);
    return el('ol', {class: 'timeline'}, ...ev.map((e) => el('li', {class: e.f === null ? 'hoje' : e.f === 'Prazo_Final_DELI' ? 'prazo' : e.f === 'dataDELI' ? 'entrega' : /Prog/.test(e.f) ? 'prog' : null},
      el('span', {class: 'data', text: fd(e.d)}), e.l + ' ', el('span', {class: 'rel', text: e.f ? rel(diasAte(e.d)) : ''}))));
  }

  const CAMPOS_PROG = [['Status_Execução_Nota', 'Status de execução da nota'], ['Qtde_Programacoes', 'Qtde de programações do projeto'], ['Data_Max_Prog', 'Última programação do projeto'],
    ['Data_Max_Prog_nota', 'Última programação da nota'], ['Inicio_prev', 'Início previsto'], ['Fim_prev', 'Fim previsto'], ['WL', 'WL'], ['Status_Projeto', 'Status do projeto'],
    ['Empreiteira_Contratos', 'Empreiteira'], ['KPI Nota', 'KPI Nota'], ['KPI Projeto', 'KPI Projeto']];

  function abrirProjeto(id, novo, voltando) {
    const r = S.porProjeto.get(id); if (!r) return;
    const a = S.ant.get(id);
    const irmaos = (S.porNota.get(String(r.nota)) || []).filter((x) => x.Projeto !== id);
    const head = el('div', {class: 'det-head'},
      el('div', {class: 'det-tipo', text: 'Histórico do projeto'}), el('h2', {id: 'drawerTitulo', text: r.Projeto}),
      el('p', {}, 'Nota ', el('button', {class: 'link', type: 'button', text: String(r.nota), onclick: () => abrirNota(r.nota)}), ` · ${r.CLIENTE ?? 'cliente não informado'} · ${r.Tipo_Projeto ?? '—'}`),
      el('p', {text: `${r.Empreiteira_Contratos ?? 'empreiteira não informada'} · Polo ${r.Polo ?? '—'} · Área ${r['Area Real'] ?? '—'} · ${r.bairro ?? ''}${r.municipio ? ' / ' + r.municipio : ''}`}),
      el('div', {class: 'det-badges'}, badgeSit(r), el('span', {class: 'badge ' + (r['KPI MBO'] === 'MBO' ? 'mag' : ''), text: r['KPI MBO'] ?? '—'}),
        el('span', {class: 'badge', text: `Execução: ${r.Status_Execução_Nota ?? '—'}`}), el('span', {class: 'badge', text: `KPI Projeto: ${r['KPI Projeto'] ?? '—'}`}),
        el('span', {class: 'badge info', text: r._mudou})));

    const mapa = (r.Latitude != null && r.Longitude != null)
      ? el('a', {class: 'btn', href: `https://www.google.com/maps?q=${r.Latitude},${r.Longitude}`, target: '_blank', rel: 'noopener', text: 'Ver local no mapa'}) : null;

    const todos = el('dl', {class: 'todos'}, ...S.colunas.map((c) => {
      const mudou = a && c in a && String(a[c] ?? '') !== String(r[c] ?? '');
      return el('div', {class: 'campo' + (mudou ? ' mudou' : '')}, el('dt', {text: c}), el('dd', {}, fmtCampo(c, r[c]), mudou ? el('span', {class: 'antes', text: `em 19/10: ${fmtCampo(c, a[c])}`}) : null));
    }));

    const listaIrmaos = irmaos.length
      ? el('div', {style: 'overflow-x:auto'}, el('table', {class: 'comp'}, el('thead', {}, el('tr', {}, ...['Projeto', 'Tipo', 'Empreiteira', 'Prog.', 'Última prog.', 'Status do projeto'].map((t) => el('th', {text: t})))),
        el('tbody', {}, ...irmaos.map((x) => el('tr', {}, el('td', {}, el('button', {class: 'link', type: 'button', text: x.Projeto, onclick: () => abrirProjeto(x.Projeto)})),
          el('td', {text: x.Tipo_Projeto ?? '—'}), el('td', {text: x.Empreiteira_Contratos ?? '—'}), el('td', {text: num(x.Qtde_Programacoes)}), el('td', {text: fd(x.Data_Max_Prog)}), el('td', {text: x.Status_Projeto ?? '—'}))))))
      : el('p', {class: 'muted', text: 'Nenhum outro projeto nesta nota.'});

    abrirDrawer([
      head,
      el('div', {class: 'grid2'},
        secao('Contador de prazo', blocoContador(r), el('p', {class: 'muted', text: `Na planilha (16/11): Qtd Dias p/ Venc = ${num(r['Qtd Dias p/ Venc'])} · STATUS_PRAZO = ${r.STATUS_PRAZO ?? '—'} · faixa = ${r.AUX_AGING_VENC_Tabela ?? '—'}`})),
        secao('Linha do tempo', linhaDoTempo(r))),
      secao('Histórico de programação — 19/10 × 16/11', tabelaComparacao(CAMPOS_PROG, r, a), ...alertasProgramacao(r),
        el('p', {class: 'muted', text: 'A planilha não registra cada programação separadamente: informa a quantidade (Qtde_Programacoes), a data da última programação do projeto (Data_Max_Prog) e da nota (Data_Max_Prog_nota), além de início/fim previstos. O histórico compara a aba Planilha1 (19/10/2026) com a Sheet1 (16/11/2026).'})),
      secao(`Todas as informações do projeto (${S.colunas.length} campos)`, el('p', {class: 'muted', text: 'Campos destacados mudaram entre 19/10 e 16/11.'}), todos, mapa),
      secao(`Outros projetos da nota ${r.nota} (${irmaos.length})`, listaIrmaos, el('button', {class: 'btn', type: 'button', text: 'Abrir histórico da nota', onclick: () => abrirNota(r.nota), style: 'margin-top:10px'}))
    ], novo && !voltando, {tipo: 'projeto', id});
    if (voltando) $('#voltar').hidden = !S.pilha.length;
  }

  function abrirNota(nota, novo, voltando) {
    const k = String(nota);
    const projs = S.porNota.get(k); if (!projs) return;
    const antes = S.antPorNota.get(k) || [];
    const r = projs[0];
    // campos iguais em todos os projetos da nota = dados da nota
    const constantes = S.colunas.filter((c) => projs.every((p) => String(p[c] ?? '') === String(r[c] ?? '')) && c !== 'nota');
    const variaveis = S.colunas.filter((c) => !constantes.includes(c) && c !== 'nota' && c !== 'Projeto');
    const somaAgora = projs.reduce((s, x) => s + (Number(x.Qtde_Programacoes) || 0), 0);
    const somaAntes = antes.reduce((s, x) => s + (Number(x.Qtde_Programacoes) || 0), 0);
    const ra = antes[0];
    const novos = projs.filter((p) => !antes.some((x) => x.Projeto === p.Projeto));
    const sairam = antes.filter((x) => !projs.some((p) => p.Projeto === x.Projeto));

    const head = el('div', {class: 'det-head'},
      el('div', {class: 'det-tipo', text: 'Histórico da nota'}), el('h2', {id: 'drawerTitulo', text: `Nota ${k}`}),
      el('p', {text: `${r.CLIENTE ?? 'cliente não informado'} · ${r.Tipo_Obj_Nota ?? '—'} · ${r['Tipo de Cliente'] ?? '—'}`}),
      el('p', {text: `${projs.length} projeto(s) · Status da nota: ${r.Status_Nota ?? '—'} · Data da nota: ${fd(r.data_nota)}`}),
      el('div', {class: 'det-badges'}, badgeSit(r), el('span', {class: 'badge ' + (r['KPI MBO'] === 'MBO' ? 'mag' : ''), text: r['KPI MBO'] ?? '—'}),
        el('span', {class: 'badge', text: `Execução: ${r.Status_Execução_Nota ?? '—'}`}), el('span', {class: 'badge', text: `KPI Nota: ${r['KPI Nota'] ?? '—'}`})));

    const resumo = el('table', {class: 'comp'}, el('thead', {}, el('tr', {}, el('th', {text: 'Indicador da nota'}), el('th', {text: '19/10/2026'}), el('th', {text: '16/11/2026'}))),
      el('tbody', {}, ...[
        ['Projetos na nota', ra ? nf.format(antes.length) : 'não consta', nf.format(projs.length)],
        ['Soma de Qtde_Programacoes', ra ? nf.format(somaAntes) : '—', nf.format(somaAgora)],
        ['Status_Nota', ra?.Status_Nota ?? (ra ? '—' : 'não consta'), r.Status_Nota ?? '—'],
        ['Status_Execução_Nota', ra?.Status_Execução_Nota ?? (ra ? '—' : 'não consta'), r.Status_Execução_Nota ?? '—'],
        ['Última programação da nota', ra ? fd(ra.Data_Max_Prog_nota) : 'não consta', fd(r.Data_Max_Prog_nota)],
        ['Prazo_Final_DELI', ra ? fd(ra.Prazo_Final_DELI) : 'não consta', fd(r.Prazo_Final_DELI)],
        ['dataDELI', ra ? fd(ra.dataDELI) : 'não consta', fd(r.dataDELI)],
        ['KPI Nota', ra?.['KPI Nota'] ?? (ra ? '—' : 'não consta'), r['KPI Nota'] ?? '—']
      ].map(([a, b, c]) => el('tr', {class: ra && b !== c ? 'mudou' : null}, el('td', {text: a}), el('td', {text: b}), el('td', {text: c})))));

    const movs = [];
    if (novos.length && ra) movs.push(el('div', {class: 'alerta-box info', text: `Entraram na nota depois de 19/10: ${novos.map((p) => p.Projeto).join(', ')}.`}));
    if (sairam.length) movs.push(el('div', {class: 'alerta-box', text: `Constavam em 19/10 e não aparecem em 16/11: ${sairam.map((p) => p.Projeto).join(', ')}.`}));

    const cab = ['Projeto', 'Tipo_Projeto', 'Empreiteira_Contratos', 'Status_Projeto', 'Qtde_Programacoes', 'Data_Max_Prog', 'Inicio_prev', 'Fim_prev', 'KPI Projeto'];
    const tabProj = el('div', {style: 'overflow-x:auto'}, el('table', {class: 'comp'},
      el('thead', {}, el('tr', {}, ...['Projeto', 'Tipo', 'Empreiteira', 'Status do projeto', 'Programações (19/10 → 16/11)', 'Última prog. (19/10 → 16/11)', 'Início prev.', 'Fim prev.', 'KPI Projeto'].map((t) => el('th', {text: t})))),
      el('tbody', {}, ...projs.map((p) => {
        const pa = S.ant.get(p.Projeto);
        const prog = pa ? `${num(pa.Qtde_Programacoes)} → ${num(p.Qtde_Programacoes)}` : `novo → ${num(p.Qtde_Programacoes)}`;
        const ult = pa ? `${fd(pa.Data_Max_Prog)} → ${fd(p.Data_Max_Prog)}` : `novo → ${fd(p.Data_Max_Prog)}`;
        const mud = !pa || String(pa.Qtde_Programacoes) !== String(p.Qtde_Programacoes) || (pa.Data_Max_Prog || '') !== (p.Data_Max_Prog || '');
        return el('tr', {class: mud ? 'mudou' : null}, el('td', {}, el('button', {class: 'link', type: 'button', text: p.Projeto, onclick: () => abrirProjeto(p.Projeto)})),
          el('td', {text: p.Tipo_Projeto ?? '—'}), el('td', {text: p.Empreiteira_Contratos ?? '—'}), el('td', {text: p.Status_Projeto ?? '—'}),
          el('td', {text: prog}), el('td', {text: ult}), el('td', {text: fd(p.Inicio_prev)}), el('td', {text: fd(p.Fim_prev)}), el('td', {text: p['KPI Projeto'] ?? '—'}));
      }))));
    void cab;

    const dadosNota = el('dl', {class: 'todos'}, ...constantes.map((c) => el('div', {class: 'campo'}, el('dt', {text: c}), el('dd', {text: fmtCampo(c, r[c])}))));

    abrirDrawer([
      head,
      el('div', {class: 'grid2'},
        secao('Contador de prazo da nota', blocoContador(r)),
        secao('Comparação da nota — 19/10 × 16/11', el('div', {style: 'overflow-x:auto'}, resumo), ...movs)),
      secao(`Projetos da nota (${projs.length}) e suas programações`, el('p', {class: 'muted', text: 'Clique no projeto para ver o histórico completo. Linhas destacadas tiveram a programação alterada ou são novas desde 19/10.'}), tabProj),
      secao('Dados comuns a todos os projetos da nota', dadosNota,
        el('p', {class: 'muted', text: `Campos que variam entre os projetos desta nota: ${variaveis.join(', ') || 'nenhum'}.`}))
    ], novo && !voltando, {tipo: 'nota', id: k});
    if (voltando) $('#voltar').hidden = !S.pilha.length;
  }

  // ---------- eventos ----------
  function montarEventos() {
    let t;
    $('#busca').addEventListener('input', (e) => { clearTimeout(t); t = setTimeout(() => { S.busca = norm(e.target.value); aplicar(); }, 200); });
    $('#limpar').addEventListener('click', () => { S.filtros = {}; S.busca = ''; S.mbo = null; $('#busca').value = ''; aplicar(); });
    $('#mboJanela').addEventListener('change', () => { if (S.mbo != null) S.mbo = Number($('#mboJanela').value); renderTudo(); });
    $('#mboFiltrar').addEventListener('click', () => { S.mbo = Number($('#mboJanela').value); S.aba = 'projetos'; trocaAba('projetos'); aplicar(); document.querySelector('.lista-head').scrollIntoView({behavior: 'smooth'}); });
    document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => trocaAba(b.dataset.tab)));
    document.querySelectorAll('[data-fechar]').forEach((b) => b.addEventListener('click', fecharDrawer));
    $('#voltar').addEventListener('click', voltar);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#drawer').hidden) fecharDrawer(); });
    window.addEventListener('hashchange', abrirPeloHash);
    const a = S.meta.abas.atual, b = S.meta.abas.anterior;
    $('#subRef').textContent = `Base atual: aba ${a.aba} (ref. ${fd(a.referencia)}) · Histórico: aba ${b.aba} (ref. ${fd(b.referencia)})`;
    $('#rodape').textContent = `Fonte: ${S.meta.arquivo} — aba ${a.aba} (${nf.format(a.linhas)} projetos, ref. ${fd(a.referencia)}) e aba ${b.aba} (${nf.format(b.linhas)} projetos, ref. ${fd(b.referencia)}). Datas de referência calculadas por Prazo_Final_DELI − Qtd Dias p/ Venc. Dados gerados em ${new Date(S.meta.gerado_em).toLocaleString('pt-BR', {timeZone: TZ})} (Brasília).`;
  }
  function trocaAba(aba) {
    S.aba = aba; S.pagina = 1;
    document.querySelectorAll('.tab').forEach((b) => { const on = b.dataset.tab === aba; b.classList.toggle('active', on); b.setAttribute('aria-selected', on); });
    cabecalhos(); renderTabela();
  }

  // logo: usa assets/img/logo-enel.png se existir; senão mostra o nome em texto
  const logo = $('#logo');
  logo.addEventListener('error', () => { logo.hidden = true; $('#logoTexto').hidden = false; });
  if (logo.complete && !logo.naturalWidth) { logo.hidden = true; $('#logoTexto').hidden = false; }

  relogio(); setInterval(relogio, 1000);
  carregar();
})();

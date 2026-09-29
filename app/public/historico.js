// Secretaria IEL — Histórico escolar (4.9.0/4.10.0), no formato dos modelos Word da escola.
// As notas de cada ano entram por aluno (#/hist/<id>) ou pela turma inteira (aba "Lançar notas da turma"),
// e o histórico sai pronto em duas folhas (documento "historico": historico-doc.js).
'use strict';

const notaNum = (v) => { const t = String(v ?? '').trim(); return /^\d{1,2}([.,]\d{1,2})?$/.test(t) ? Number(t.replace(',', '.')) : null; };
const numBR = (n) => String(n).replace('.', ',');
const SERIES_HIST = [...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => ['F' + n, `${n}º ano`]), ...[1, 2, 3].map((n) => ['EM' + n, `${n}ª série EM`])];
const cursoDaSerie = (ch) => (String(ch).startsWith('EM') ? 'medio' : 'fund');

// Mesma regra do servidor: nota abaixo da média (7,0 no modelo da escola) sugere "Retido"
function sugerirResultado(notas, cf) {
  const valores = Object.entries(notas).filter(([, n]) => String(n ?? '').trim() && !/^[-–—]$/.test(String(n).trim()));
  if (!valores.length) return null;
  const abaixo = valores.filter(([, n]) => notaNum(n) != null && notaNum(n) < cf.media).map(([k]) => k);
  if (abaixo.length) return { resultado: 'Retido', motivo: `abaixo de ${numBR(cf.media)} em ${abaixo.join(', ')}` };
  return { resultado: 'Aprovado', motivo: '' };
}

// Média do ano: a mesma regra do servidor (só com os 4 bimestres numéricos; arredonda para 0,5 ou para uma casa decimal)
function mediaDoAno(b, cf) {
  const ns = ['b1', 'b2', 'b3', 'b4'].map((k) => notaNum(b?.[k]));
  if (ns.some((n) => n == null)) return null;
  const passo = cf.arredonda || 0.5;
  const r = Math.round(ns.reduce((s, n) => s + n, 0) / 4 / passo + 1e-9) * passo;
  return numBR(Number(r.toFixed(2)));
}

// Grade que se comporta como planilha: Enter desce uma linha e colar um bloco do Excel espalha pelas células.
// Cada campo tem data-r (linha) e data-c (coluna).
function comoPlanilha(raiz) {
  raiz.addEventListener('keydown', (e) => {
    const el = e.target.closest('[data-r][data-c]');
    if (!el || e.key !== 'Enter') return;
    e.preventDefault();
    const prox = $(`[data-r="${+el.dataset.r + (e.shiftKey ? -1 : 1)}"][data-c="${el.dataset.c}"]`, raiz);
    if (prox) { prox.focus(); if (prox.select) prox.select(); }
  });
  raiz.addEventListener('paste', (e) => {
    const el = e.target.closest('[data-r][data-c]');
    if (!el) return;
    const txt = (e.clipboardData || window.clipboardData).getData('text') || '';
    if (!/[\t\n]/.test(txt.replace(/\s+$/, ''))) return; // um valor só: deixa o navegador colar normalmente
    e.preventDefault();
    const linhas = txt.replace(/\r/g, '').replace(/\n+$/, '').split('\n').map((l) => l.split('\t'));
    const r0 = +el.dataset.r, c0 = +el.dataset.c;
    let n = 0;
    linhas.forEach((l, i) => l.forEach((v, j) => {
      const alvo = $(`[data-r="${r0 + i}"][data-c="${c0 + j}"]`, raiz);
      if (!alvo || alvo.disabled) return;
      const valor = v.trim();
      if (alvo.tagName === 'SELECT') {
        const op = [...alvo.options].find((o) => norm(o.value) === norm(valor));
        if (!op) return;
        alvo.value = op.value; alvo.dataset.auto = '0';
      } else alvo.value = valor;
      alvo.dispatchEvent(new Event('input', { bubbles: true }));
      n++;
    }));
    toast(`${plural(n, 'célula colada', 'células coladas')}. Confira e salve.`);
  });
}

// Pinta de vermelho a nota abaixo da média e ajusta o resultado sugerido (se a pessoa ainda não escolheu um)
function atualizarResultado(notasEls, resEl, sugEl, cf) {
  const notas = {};
  for (const el of notasEls) {
    notas[el.dataset.comp] = el.value;
    const n = notaNum(el.value);
    el.classList.toggle('baixa', n != null && n < cf.media);
  }
  const s = sugerirResultado(notas, cf);
  if (resEl.dataset.auto === '1') resEl.value = s ? s.resultado : '';
  const diverge = s && resEl.value && !['Cursando', 'Transferido', 'Aprovado pelo Conselho'].includes(resEl.value) && resEl.value !== s.resultado;
  sugEl.textContent = diverge ? `As notas indicam ${s.resultado}${s.motivo ? ' (' + s.motivo + ')' : ''}` : '';
  sugEl.hidden = !diverge;
}

let histTurmaEscolhida = '', histBimEscolhido = '';

TELAS.historico = async (c, aba = 'alunos') => {
  const ABAS = { alunos: 'Alunos', turma: 'Lançar notas da turma', ...(EU.perfil === 'admin' ? { disciplinas: 'Disciplinas e regras' } : {}) };
  if (!ABAS[aba]) aba = 'alunos';
  c.innerHTML = `<h1>Histórico escolar</h1>
    <p class="sub">Digite as notas de cada ano — aluno por aluno ou a turma inteira de uma vez — e o histórico sai pronto, igual ao modelo da escola.</p>
    <div class="abas">${Object.entries(ABAS).map(([k, v]) => `<button data-aba="${k}" class="${aba === k ? 'on' : ''}">${v}</button>`).join('')}</div><div id="aba"></div>`;
  $$('[data-aba]', c).forEach((b) => (b.onclick = () => (location.hash = '#/historico/' + b.dataset.aba)));
  await ({ alunos: abaHistAlunos, turma: abaHistTurma, disciplinas: abaHistDisciplinas }[aba])($('#aba', c));
};

async function abaHistAlunos(el) {
  const d = await api('GET', '/api/historico');
  const r = d.resumo;
  el.innerHTML = `<div class="grade g4">
      <div class="cartao kpi destaque"><div class="rot">Alunos do Fund. e do Médio</div><div class="val">${r.alunos}</div><div class="det">ano letivo de ${d.ano_atual} em andamento</div></div>
      <div class="cartao kpi ${r.alunos && r.em_dia === r.alunos ? 'ok' : ''}"><div class="rot">Histórico em dia</div><div class="val">${r.em_dia}</div><div class="det">todos os anos anteriores lançados</div></div>
      <div class="cartao kpi ${r.faltando ? 'alerta' : ''}"><div class="rot">Com ano faltando</div><div class="val">${r.faltando}</div><div class="det">algum ano sem notas ou sem situação</div></div>
      <div class="cartao kpi"><div class="rot">Anos lançados</div><div class="val">${r.anos_lancados}</div><div class="det">colunas de histórico já preenchidas</div></div>
    </div>
    <div class="dica">Cada ano cursado é uma coluna do histórico. Clique em <b>Notas</b> para digitar os anos de um aluno (quem veio de outra escola:
      copie do histórico que a família trouxe). No fim do ano, use <b>Lançar notas da turma</b> — dá para colar direto do Excel.
      O botão <b>Histórico</b> monta o documento na hora.</div>
    <div class="cartao" style="margin-top:14px"><div class="filtros">
      <select id="ft"><option value="">Todas as turmas</option>${d.turmas.map((t) => `<option>${esc(t.rotulo)}</option>`).join('')}</select>
      <label class="chk"><input type="checkbox" id="ff"> Só quem tem ano faltando</label>
      <input id="fq" placeholder="Buscar aluno ou matrícula…" style="flex:1;min-width:200px">
      <button class="btn peq" id="imp">${icone('documentos')}Imprimir lista</button></div>
    <div class="tabela-wrap"><table><thead><tr><th>Aluno</th><th>Turma</th><th>Anos no histórico</th><th>Falta lançar</th><th></th></tr></thead><tbody id="tb"></tbody></table></div></div>`;
  const desenhar = () => {
    const ft = $('#ft', el).value, ff = $('#ff', el).checked, q = norm($('#fq', el).value);
    const f = d.alunos.filter((a) => (!ft || a.turma_rotulo === ft) && (!ff || a.faltam.length) && (!q || norm(a.nome + ' ' + (a.mat || '')).includes(q)));
    emPartes($('#tb', el), f.map((a) => `<tr><td><a href="#/hist/${a.id}"><b>${esc(titulo(a.nome))}</b></a><br><small class="dado">Mat. ${esc(a.mat || '—')}${a.novo ? ' · aluno novo' : ''}</small></td>
      <td>${esc(a.turma_rotulo)}</td>
      <td>${a.esperadas ? `<span class="progresso"><span class="trilho"><i style="width:${Math.round((100 * a.feitas) / a.esperadas)}%"></i></span>${a.feitas} de ${a.esperadas}</span>` : '<span class="dado">primeiro ano do curso</span>'}
        ${a.atual ? '<br><span class="tag t-novo">ano atual já lançado</span>' : ''}</td>
      <td>${a.faltam.length ? `<span class="anos-faltam">${a.faltam.map((r, i) => `<a class="tag t-vencendo" href="#/hist/${a.id}/${esc((a.faltam_ch || [])[i] || '')}" title="Abrir as notas do ${esc(r)}">${esc(r)}</a>`).join('')}</span>` : '<span class="tag t-concluida">em dia</span>'}</td>
      <td class="acoes" style="justify-content:flex-end"><a class="btn peq" href="#/hist/${a.id}">Notas</a><button class="btn peq" data-doc="${a.id}">${icone('documentos')}Histórico</button></td></tr>`), {
      colunas: 5,
      vazio: `<tr><td colspan="5">${d.alunos.length ? '<p class="vazio">Ninguém com esse filtro.</p>' : vazio('historico', 'Nenhum aluno do Fundamental ou do Médio',
        'O histórico escolar começa no 1º ano. Importe os alunos do ACADESC em Configurações (ou carregue a demonstração) e eles aparecem aqui.')}</td></tr>`,
      ligar: (tb) => $$('[data-doc]', tb).forEach((b) => (b.onclick = () => abrirDoc({ tipo: 'historico', aluno: b.dataset.doc }))),
    });
  };
  ['ft', 'ff', 'fq'].forEach((id) => ($('#' + id, el).oninput = desenhar));
  $('#imp', el).onclick = () => window.print();
  desenhar();
}

async function abaHistTurma(el) {
  const lista = await api('GET', '/api/historico');
  if (!lista.turmas.length) { el.innerHTML = `<div class="cartao">${vazio('historico', 'Nenhuma turma do Fundamental ou do Médio', 'Importe os alunos do ACADESC em Configurações.')}</div>`; return; }
  if (!lista.turmas.some((t) => t.rotulo === histTurmaEscolhida)) histTurmaEscolhida = lista.turmas[0].rotulo;
  if (!histBimEscolhido) histBimEscolhido = String(bimestreAtual());
  el.innerHTML = `<div class="cartao"><div class="filtros">
      <label class="dado">Turma <select id="ht">${lista.turmas.map((t) => `<option ${t.rotulo === histTurmaEscolhida ? 'selected' : ''}>${esc(t.rotulo)}</option>`).join('')}</select></label>
      <label class="dado">O que lançar <select id="hb">${[1, 2, 3, 4].map((n) => `<option value="${n}" ${histBimEscolhido === String(n) ? 'selected' : ''}>Notas do ${n}º bimestre</option>`).join('')}
        <option value="final" ${histBimEscolhido === 'final' ? 'selected' : ''}>Nota final do ano (anos antigos)</option></select></label>
      <label class="dado">Ano letivo <input type="number" id="ha" style="width:90px"></label>
      <span id="cargasTurma" class="acoes"></span>
    </div><div id="dicaTurma"></div><div class="tabela-wrap" id="gradeTurma"></div>
    <div class="acoes" style="justify-content:flex-end;margin-top:12px"><button class="btn" id="htImp">${icone('documentos')}Históricos desta turma</button><button class="btn pri" id="htSalvar">Salvar notas da turma</button></div></div>`;
  let d = null, sujo = false;
  const grade = $('#gradeTurma', el);
  comoPlanilha(grade);
  const carregar = tentar(async () => {
    const t = lista.turmas.find((x) => x.rotulo === $('#ht', el).value);
    histTurmaEscolhida = t.rotulo;
    const modo = $('#hb', el).value, bim = modo === 'final' ? null : +modo;
    d = await api('GET', `/api/historico/turma?serie=${encodeURIComponent(t.serie)}&turma=${encodeURIComponent(t.turma)}`);
    const medio = d.curso === 'medio';
    const ja = d.alunos.find((a) => a.ano)?.ano || {};
    $('#ha', el).value = ja.ano_letivo || d.ano_letivo;
    // Totais de carga do ano (os mesmos para a turma inteira), como no rodapé do quadro de notas do modelo
    const campoCarga = (id, rot, v, ph) => `<label class="dado">${rot} <input type="number" id="${id}" value="${esc(v ?? '')}" placeholder="${esc(ph ?? '')}" style="width:80px"></label>`;
    $('#cargasTurma', el).innerHTML = (medio ? '' : campoCarga('hcb', 'Carga Base Nacional', ja.carga_bnc))
      + campoCarga('hcp', 'Carga Parte Diversificada', ja.carga_pd) + campoCarga('hct', 'Carga total', ja.carga, d.config.carga[d.curso]);
    $('#dicaTurma', el).innerHTML = `<div class="dica">${bim
      ? `Você está lançando as notas do <b>${bim}º bimestre</b> de ${esc(d.rotulo)}. Quando os <b>4 bimestres</b> estiverem lançados, o sistema calcula sozinho
        a <b>média do ano</b> (arredondada para ${d.config.arredonda === 0.5 ? '0,5' : 'uma casa decimal'}) e a coloca no histórico, na coluna do ${esc(d.rotulo.replace(/ [A-Z]$/, ''))}.
        A coluna "Média do ano" mostra a média quando já dá para calcular.`
      : 'Nota final de cada disciplina, para anos antigos ou quando só existe a nota final. A situação vem sugerida pelas notas e não sai no papel.'}
      "-" ou vazio quando a turma não tem a disciplina. <b>Enter</b> desce para o próximo aluno; para trazer do Excel ou da SED, copie o bloco das notas
      (mesma ordem das colunas) e cole na primeira célula.${medio ? ' No Médio, a primeira linha é a carga horária de cada disciplina no ano (vale para a turma toda).' : ''}</div>`;
    const comps = d.componentes;
    const valor = (a, comp) => (bim ? a.ano?.bims?.[comp]?.['b' + bim] : a.ano?.notas?.[comp]) ?? '';
    const cab = comps.map((x) => `<th title="${esc(x.area || '')}" style="white-space:normal;max-width:78px;font-size:10.5px">${esc(x.nome)}</th>`).join('');
    grade.innerHTML = d.alunos.length ? `<table class="grade-notas"><thead><tr><th class="comp">Aluno</th>${cab}<th>${bim ? 'Média do ano' : 'Situação'}</th></tr></thead><tbody>
      ${medio ? `<tr class="info"><td class="aluno-nome"><b>Carga horária (h)</b></td>${comps.map((x) => `<td><input data-carga="${esc(x.nome)}" value="${esc(d.cargas[x.nome] ?? '')}" aria-label="Carga de ${esc(x.nome)}"></td>`).join('')}<td></td></tr>` : ''}
      ${d.alunos.map((a, i) => `<tr data-aluno="${a.id}"><td class="aluno-nome"><b>${esc(titulo(a.nome))}</b><br><small class="dado">Mat. ${esc(a.mat || '—')}</small></td>
        ${comps.map((x, j) => `<td><input data-r="${i}" data-c="${j}" data-comp="${esc(x.nome)}" value="${esc(valor(a, x.nome))}" aria-label="${esc(x.nome)} de ${esc(a.nome)}"></td>`).join('')}
        ${bim ? '<td class="dado" data-medias></td>' : `<td><select data-r="${i}" data-c="${comps.length}" data-res data-auto="${a.ano?.resultado ? '0' : '1'}"><option value=""></option>
          ${d.resultados.map((x) => `<option ${a.ano?.resultado === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select><small class="sug" hidden></small></td>`}</tr>`).join('')}
      </tbody></table>` : vazio('alunos', 'Turma sem alunos', 'Nenhum aluno ativo nesta turma.');
    $$('tr[data-aluno]', grade).forEach((tr) => {
      const a = d.alunos.find((x) => x.id === +tr.dataset.aluno);
      const upd = () => {
        if (!bim) return atualizarResultado($$('[data-comp]', tr), $('[data-res]', tr), $('.sug', tr), d.config);
        // Nota baixa em vermelho e quantas médias do ano já dá para calcular com o que está na tela
        let prontas = 0, abaixo = 0;
        for (const inp of $$('[data-comp]', tr)) {
          const n = notaNum(inp.value);
          inp.classList.toggle('baixa', n != null && n < d.config.media);
          const b = { ...(a.ano?.bims?.[inp.dataset.comp] || {}), ['b' + bim]: inp.value };
          const m = mediaDoAno(b, d.config);
          if (m != null) { prontas++; if (notaNum(m) < d.config.media) abaixo++; }
        }
        $('[data-medias]', tr).innerHTML = prontas ? `${prontas} calculada${prontas > 1 ? 's' : ''}${abaixo ? `<br><span style="color:var(--vermelho)">${abaixo} abaixo de ${numBR(d.config.media)}</span>` : ''}` : 'falta bimestre';
      };
      tr.addEventListener('input', (e) => { sujo = true; if (e.target.matches('[data-res]')) e.target.dataset.auto = '0'; upd(); });
      tr.addEventListener('change', (e) => { if (e.target.matches('[data-res]')) { e.target.dataset.auto = e.target.value ? '0' : '1'; sujo = true; upd(); } });
      upd();
    });
    $$('[data-carga], #cargasTurma input', el).forEach((i) => i.addEventListener('input', () => { sujo = true; }));
    sujo = false;
  });
  const trocar = async (sel, voltar) => {
    if (sujo && !(await confirmar('Há notas digitadas que ainda não foram salvas. Trocar e perder o que foi digitado?', 'Trocar mesmo assim'))) { voltar(); return; }
    histBimEscolhido = $('#hb', el).value;
    carregar();
  };
  $('#ht', el).onchange = () => trocar($('#ht', el), () => { $('#ht', el).value = histTurmaEscolhida; });
  $('#hb', el).onchange = () => trocar($('#hb', el), () => { $('#hb', el).value = histBimEscolhido; });
  $('#ha', el).oninput = () => { sujo = true; };
  $('#htSalvar', el).onclick = tentar(async () => {
    if (!d) return;
    const modo = $('#hb', el).value;
    const alunos = $$('tr[data-aluno]', grade).map((tr) => ({
      aluno_id: +tr.dataset.aluno, resultado: $('[data-res]', tr)?.value,
      notas: Object.fromEntries($$('[data-comp]', tr).map((i) => [i.dataset.comp, i.value])),
    }));
    const val = (id) => ($('#' + id, el) ? $('#' + id, el).value : undefined);
    const cargas = d.curso === 'medio' ? Object.fromEntries($$('[data-carga]', grade).map((i) => [i.dataset.carga, i.value])) : undefined;
    const r = await api('PUT', '/api/historico/turma', { serie: d.serie, bimestre: modo === 'final' ? undefined : +modo, ano_letivo: val('ha'),
      carga_bnc: val('hcb'), carga_pd: val('hcp'), carga: val('hct'), cargas, alunos });
    sujo = false;
    toast(`${modo === 'final' ? 'Notas finais' : `Notas do ${modo}º bimestre`} salvas: ${plural(r.alunos, 'aluno', 'alunos')} de ${d.rotulo}`);
    carregar();
  });
  $('#htImp', el).onclick = () => {
    if (!d || !d.alunos.length) return;
    if (sujo) return toast('Salve as notas antes de gerar os históricos', true);
    abrirDoc({ tipo: 'historico', ids: d.alunos.map((a) => a.id).join(',') });
  };
  await carregar();
}

async function abaHistDisciplinas(el) {
  const [d, adm] = await Promise.all([api('GET', '/api/historico/componentes'), api('GET', '/api/admin')]);
  const cf = adm.config;
  el.innerHTML = `<div class="grade g2">${['fund', 'medio'].map((k) => `<div class="cartao"><h2>${esc(d.cursos[k].nome)}</h2>
      <p class="dado">Cada disciplina é uma linha do histórico, nesta ordem. A "área" é o bloco da esquerda no papel (Base Nacional Comum, Parte Diversificada…).
        "Tirar" esconde a linha sem apagar as notas já lançadas.</p>
      <table><thead><tr><th>Área</th><th>Disciplina</th><th></th></tr></thead><tbody>
      ${d.componentes.filter((x) => x.curso === k).map((x) => `<tr><td class="dado">${esc(x.area || '')}</td>
        <td>${x.ativo ? esc(x.nome) : `<s>${esc(x.nome)}</s> <span class="dado">fora do histórico</span>`}</td>
        <td class="acoes" style="justify-content:flex-end;flex-wrap:nowrap"><button class="btn peq" data-mv="${x.id}" data-d="cima" title="Subir" aria-label="Subir ${esc(x.nome)}">↑</button>
          <button class="btn peq" data-mv="${x.id}" data-d="baixo" title="Descer" aria-label="Descer ${esc(x.nome)}">↓</button>
          <button class="btn peq" data-ed="${x.id}">Editar</button><button class="btn peq" data-at="${x.id}" data-v="${x.ativo ? 0 : 1}">${x.ativo ? 'Tirar' : 'Voltar'}</button></td></tr>`).join('')}
      </tbody></table>
      <form class="acoes" data-novo="${k}" style="margin-top:10px"><input name="area" placeholder="Área (ex.: Parte Diversificada e Eletivas)" style="width:220px">
        <input name="nome" placeholder="Nova disciplina" required style="flex:1;min-width:140px"><button class="btn">${icone('mais')}Adicionar</button></form></div>`).join('')}</div>
    <div class="cartao" style="margin-top:14px"><h2>Regras e assinaturas</h2>
      <form id="regras"><div class="campos">
        <div class="campo"><label>Média para aprovação</label><input id="r_media" value="${esc(numBR(cf.hist_media))}"></div>
        <div class="campo"><label>Média do ano (4 bimestres) arredonda para</label><select id="r_arr"><option value="0.5" ${cf.hist_arredonda !== '0.1' ? 'selected' : ''}>0,5 mais próximo (7,25 → 7,5)</option>
          <option value="0.1" ${cf.hist_arredonda === '0.1' ? 'selected' : ''}>uma casa decimal (7,25 → 7,3)</option></select></div>
        <div class="campo"><label>Carga horária anual — Fundamental (h)</label><input id="r_cf" type="number" value="${esc(cf.hist_carga_fund)}"></div>
        <div class="campo"><label>Carga horária anual — Médio (h)</label><input id="r_cm" type="number" value="${esc(cf.hist_carga_medio)}"></div>
        <div class="campo"><label>Assina no meio (Diretor)</label><input id="r_dir" value="${esc(cf.hist_diretor)}"></div>
        <div class="campo"><label>Assina à direita (Secretaria)</label><input id="r_sec" value="${esc(cf.hist_secretario)}"></div>
      </div>
      <p class="dado" style="margin-top:8px">A média aparece na "Definição operacional" do histórico, pinta de vermelho a nota baixa e faz o sistema sugerir "Aprovado" ou "Retido".
        A carga é só a sugestão que aparece ao lançar; em cada ano vale o que foi digitado.</p>
      <div class="rodape"><button class="btn pri">Salvar regras</button></div></form></div>`;
  $$('[data-mv]', el).forEach((b) => (b.onclick = tentar(async () => { await api('PUT', '/api/historico/componentes/' + b.dataset.mv, { mover: b.dataset.d }); rotear(); })));
  $$('[data-at]', el).forEach((b) => (b.onclick = tentar(async () => { await api('PUT', '/api/historico/componentes/' + b.dataset.at, { ativo: b.dataset.v === '1' }); toast('Salvo'); rotear(); })));
  $$('[data-ed]', el).forEach((b) => (b.onclick = () => {
    const x = d.componentes.find((y) => y.id === +b.dataset.ed);
    modal('Editar disciplina', `<form id="fe"><div class="campos"><div class="campo"><label>Área</label><input id="e_area" value="${esc(x.area || '')}"></div>
      <div class="campo"><label>Nome *</label><input id="e_nome" value="${esc(x.nome)}" required></div></div>
      <p class="dado" style="margin-top:8px">Ao trocar o nome, as notas já lançadas acompanham.</p>
      <div class="rodape"><button type="button" class="btn" data-fechar>Cancelar</button><button class="btn pri">Salvar</button></div></form>`,
    { onAbrir: (m, fechar) => { $('#fe', m).onsubmit = tentar(async (e) => {
      e.preventDefault();
      await api('PUT', '/api/historico/componentes/' + x.id, { nome: $('#e_nome', m).value, area: $('#e_area', m).value });
      fechar(); toast('Salvo'); rotear();
    }); } });
  }));
  $$('[data-novo]', el).forEach((f) => (f.onsubmit = tentar(async (e) => {
    e.preventDefault();
    await api('POST', '/api/historico/componentes', { curso: f.dataset.novo, area: f.area.value, nome: f.nome.value });
    toast('Disciplina incluída'); rotear();
  })));
  $('#regras', el).onsubmit = tentar(async (e) => {
    e.preventDefault();
    const media = Number($('#r_media', el).value.replace(',', '.'));
    if (!(media >= 0 && media <= 10)) throw new Error('A média precisa ser um número de 0 a 10');
    await api('PUT', '/api/admin/config', { hist_media: String(media), hist_arredonda: $('#r_arr', el).value, hist_carga_fund: $('#r_cf', el).value, hist_carga_medio: $('#r_cm', el).value,
      hist_secretario: $('#r_sec', el).value.trim(), hist_diretor: $('#r_dir', el).value.trim() });
    toast('Regras salvas');
  });
}

// ───────────── Notas de um aluno ─────────────
// Um quadro só: escolhe-se a série e ali ficam as notas de cada bimestre, a nota final do ano (calculada sozinha com os
// 4 bimestres, ou digitada quando só existe a nota final — anos antigos ou de outra escola) e o que o documento precisa
// daquele ano (ano letivo, escola, carga horária, situação). O resto do histórico se monta sozinho a partir disso.
const HIST_ONDE = [['ano_letivo', 'Ano letivo', 'number'], ['escola', 'Escola', 'text'], ['cidade', 'Cidade', 'text'], ['uf', 'UF', 'text']];
const HIST_TOTAIS = {
  fund: [['carga_bnc', 'Carga horária — Base Nacional Comum'], ['carga_pd', 'Carga horária — Parte Diversificada'], ['carga', 'Carga horária total do ano']],
  medio: [['carga_pd', 'Carga horária — Parte Diversificada'], ['carga', 'Carga horária total (vazio = soma das disciplinas)']],
};
const BIMS = ['b1', 'b2', 'b3', 'b4'];

TELAS.hist = async (c, id) => {
  const d = await api('GET', '/api/historico/aluno/' + encodeURIComponent(id || ''));
  const a = d.aluno, cf = d.config, dd = d.dados || {};
  const doBanco = new Map(d.anos.map((x) => [x.serie_chave, x]));
  const CURSOS_K = ['fund', 'medio'];
  const serieInfo = (ch) => d.cursos[cursoDaSerie(ch)].series.find((s) => s.chave === ch);

  // Monta a lista de anos do mesmo jeito para o que veio do banco e para o que está na tela (assim dá para comparar)
  function montarAnos(ler) {
    const saida = [];
    for (const k of CURSOS_K) for (const s of d.cursos[k].series) {
      const o = { serie_chave: s.chave };
      for (const [f] of HIST_ONDE) o[f] = ler(s.chave, f);
      for (const [f] of HIST_TOTAIS[k]) o[f] = ler(s.chave, f);
      o.resultado = ler(s.chave, 'resultado');
      o.notas = {};
      for (const comp of d.cursos[k].componentes) o.notas[comp.nome] = ler(s.chave, 'n:' + comp.nome);
      if (k === 'medio') { o.cargas = {}; for (const comp of d.cursos[k].componentes) o.cargas[comp.nome] = ler(s.chave, 'h:' + comp.nome); }
      o.bims = {};
      for (const comp of d.cursos[k].componentes) o.bims[comp.nome] = Object.fromEntries(BIMS.map((b) => [b, ler(s.chave, `b:${comp.nome}|${b}`)]));
      const tem = [...Object.entries(o).filter(([key]) => !['serie_chave', 'notas', 'cargas', 'bims'].includes(key)).map(([, v]) => v),
        ...Object.values(o.notas), ...Object.values(o.cargas || {}), ...Object.values(o.bims).flatMap((x) => Object.values(x))].some(Boolean);
      if (tem || doBanco.has(s.chave)) saida.push(o);
    }
    return saida;
  }
  const doBancoTxt = (ch, f) => {
    const x = doBanco.get(ch); if (!x) return '';
    if (f.startsWith('b:')) { const i = f.lastIndexOf('|'); return String(x.bims?.[f.slice(2, i)]?.[f.slice(i + 1)] ?? ''); }
    const v = f.startsWith('n:') ? x.notas[f.slice(2)] : f.startsWith('h:') ? x.cargas?.[f.slice(2)] : x[f];
    return String(v ?? '');
  };

  // Tudo o que está na tela, de todas as séries: "F5|ano_letivo", "F5|n:Arte", "F5|b:Arte|b2"…
  const V = new Map();
  const todosCampos = (k) => [...HIST_ONDE.map(([f]) => f), ...HIST_TOTAIS[k].map(([f]) => f), 'resultado',
    ...d.cursos[k].componentes.flatMap((comp) => ['n:' + comp.nome, 'h:' + comp.nome, ...BIMS.map((b) => `b:${comp.nome}|${b}`)])];
  for (const k of CURSOS_K) for (const s of d.cursos[k].series) for (const f of todosCampos(k)) V.set(`${s.chave}|${f}`, doBancoTxt(s.chave, f));
  const ler = (ch, f) => V.get(`${ch}|${f}`) ?? '';
  // Situação que ninguém escolheu à mão: o sistema vai preenchendo pela média
  const autoRes = new Set([...CURSOS_K.flatMap((k) => d.cursos[k].series.map((s) => s.chave))].filter((ch) => !ler(ch, 'resultado') || ler(ch, 'resultado') === 'Cursando'));

  // Transferência no meio do ano (página 2 do histórico)
  const CAMPOS_T = ['serie_chave', 'ano_letivo', 'bimestres', 'periodo', 'turma', 'turno', 'faltas', 'dias_letivos'];
  function montarTransf(t) {
    if (!t) return '';
    const o = {};
    for (const k of CAMPOS_T) o[k] = String(t[k] ?? '').trim();
    o.notas = {};
    for (const [comp, x] of Object.entries(t.notas || {})) {
      const l = {};
      for (const k of [...BIMS, 'faltas', 'aulas']) l[k] = String(x?.[k] ?? '').trim();
      if (Object.values(l).some(Boolean)) o.notas[comp] = l;
    }
    return JSON.stringify(o);
  }

  const dadosOrig = { rg: a.rg, rg_expedicao: dd.rg_expedicao, rg_orgao: dd.rg_orgao, rg_uf: dd.rg_uf, naturalidade: dd.naturalidade, uf_nasc: dd.uf_nasc,
    nacionalidade: dd.nacionalidade, fund_ano: dd.fund_ano, fund_escola: dd.fund_escola, fund_cidade: dd.fund_cidade, fund_uf: dd.fund_uf, obs: dd.obs };
  const original = { ...Object.fromEntries(Object.entries(dadosOrig).map(([k, v]) => [k, v ?? ''])), anos_json: JSON.stringify(montarAnos(doBancoTxt)),
    transf_json: montarTransf(d.transf), atualizado_em: d.atualizado_em };

  const campoDado = (id2, rot, valor, extra = '') => `<div class="campo"><label for="${id2}">${esc(rot)}</label><input id="${id2}" value="${esc(valor ?? '')}" ${extra}></div>`;
  const fc = d.fund_conclusao || {};
  const t0 = d.transf;
  const serieInicial = /^(F\d|EM\d)$/.test(a.serie_chave || '') ? a.serie_chave : 'F1';
  // "#/hist/<id>/F3" abre direto no 3º ano (vem das etiquetas "falta lançar" da lista)
  const serieDoLink = (location.hash.split('?')[0].split('/')[3] || '');
  const serieAbrir = /^(F\d|EM\d)$/.test(serieDoLink) ? serieDoLink : serieInicial;
  // Anos que aparecem nos botões: os do curso do aluno (quem está no Médio vê as 3 séries; no Fundamental, do 1º ao 9º)
  const cursoAluno = cursoDaSerie(serieInicial);
  const seriesDoCurso = SERIES_HIST.filter(([k]) => cursoDaSerie(k) === cursoAluno);
  const idxAtual = seriesDoCurso.findIndex(([k]) => k === a.serie_chave);
  c.innerHTML = `<div class="acoes" style="justify-content:space-between;align-items:flex-start"><div><h1>Histórico de ${esc(titulo(a.nome))}</h1>
      <p class="sub">${esc(a.turma_rotulo)} · Mat. ${esc(a.mat || '—')}${a.novo ? ' · aluno novo' : ''} · <a href="#/aluno/${a.id}">abrir a ficha</a></p></div>
    <div class="acoes"><a class="btn" href="#/historico">← Voltar</a><button class="btn" id="hDoc">${icone('documentos')}Gerar histórico</button><button class="btn pri" id="hSalvar">Salvar</button></div></div>
    <div class="cartao"><h2>Identificação (cabeçalho do histórico)</h2><div class="campos">
      ${campoDado('h_nat', 'Local de nascimento — cidade', dd.naturalidade)}${campoDado('h_uf', 'UF de nascimento', dd.uf_nasc, 'maxlength="2" placeholder="SP"')}
      ${campoDado('h_nac', 'Nacionalidade', dd.nacionalidade, 'placeholder="Brasileira"')}
      <div class="campo"><label>Data de nascimento</label><input value="${esc(dataBR(a.dt_nasc))}" disabled title="Vem do cadastro do aluno"></div>
      ${campoDado('h_rg', 'RG', a.rg)}${campoDado('h_rg_exp', 'Data de expedição do RG', dd.rg_expedicao, 'type="date"')}
      ${campoDado('h_rg_org', 'Órgão expedidor', dd.rg_orgao, 'placeholder="SSP"')}${campoDado('h_rg_uf', 'Estado do RG', dd.rg_uf, 'maxlength="2" placeholder="SP"')}
    </div>
    <div class="campo" style="margin-top:10px"><label for="h_obs">Observações (saem no quadro "Observações" do histórico)</label><textarea id="h_obs" style="min-height:54px">${esc(dd.obs || '')}</textarea></div>
    <p class="dado" style="margin-top:6px">O RG corrigido aqui fica corrigido também na ficha do aluno. A filiação não sai no histórico (deliberação CEE 04/95).</p></div>

    <div class="cartao" style="margin-top:14px">
      <h2 style="margin-bottom:4px">Notas de cada ano</h2>
      <p style="margin:0 0 12px;font-size:13px;color:var(--texto-2)">O histórico traz <b>todos os anos</b> que o aluno já cursou. <b>Clique em um ano</b> para lançar as notas dele —
        os anteriores também (inclusive os feitos em outra escola, copiando do histórico que a família trouxe).</p>
      <div class="anos-hist" id="b_anos" role="tablist" aria-label="Ano do histórico"></div>
      <select id="b_serie" hidden aria-hidden="true" tabindex="-1"></select>
      <div class="acoes" style="margin:14px 0 8px;justify-content:space-between">
        <h3 id="b_titulo" style="margin:0;font-size:15px"></h3>
        <button type="button" class="btn peq perigo" id="b_apagar" hidden>Apagar este ano do histórico</button></div>
      <p style="margin:0 0 10px;font-size:12.5px;color:var(--texto-2)">Com os <b>4 bimestres</b>, a <b>nota final do ano</b> é calculada sozinha
        (média arredondada para ${cf.arredonda === 0.5 ? '0,5' : 'uma casa decimal'}) e é ela que sai no histórico. Ano antigo sem as notas de cada bimestre: digite direto a nota final.
        Nota abaixo de ${numBR(cf.media)} fica vermelha; <b>Enter</b> desce; colar um bloco do Excel espalha pelas células.</p>
      <div class="campos" id="b_info"></div>
      <div class="campos" id="blocoFundConc" style="margin-top:12px">
        <div class="campo"><label for="h_fano">Ensino Fundamental — ano de conclusão</label><input id="h_fano" value="${esc(dd.fund_ano || '')}" placeholder="${esc(fc.ano || '')}"></div>
        <div class="campo"><label for="h_fesc">Escola onde concluiu o Fundamental</label><input id="h_fesc" value="${esc(dd.fund_escola || '')}" placeholder="${esc(fc.escola || '')}"></div>
        <div class="campo"><label for="h_fcid">Município</label><input id="h_fcid" value="${esc(dd.fund_cidade || '')}" placeholder="${esc(fc.cidade || '')}"></div>
        <div class="campo"><label for="h_fuf">Estado</label><input id="h_fuf" value="${esc(dd.fund_uf || '')}" maxlength="2" placeholder="${esc(fc.uf || '')}"></div>
      </div>
      <div class="tabela-wrap" id="b_grade" style="margin-top:12px"></div>
    </div>

    <div class="cartao" style="margin-top:14px">
      <h2 style="margin-bottom:6px">Transferência durante o ano letivo</h2>
      <label class="chk"><input type="checkbox" id="t_on" ${t0 ? 'checked' : ''}> Este aluno está saindo no meio do ano (preenche a 2ª folha do histórico com as notas de cada bimestre)</label>
      <div id="t_bloco" style="margin-top:12px" ${t0 ? '' : 'hidden'}>
        <div class="campos">
          <div class="campo"><label for="t_serie">Série que está deixando</label><select id="t_serie">${SERIES_HIST.map(([k, r]) => `<option value="${k}" ${(t0?.serie_chave || serieInicial) === k ? 'selected' : ''}>${r}</option>`).join('')}</select></div>
          <div class="campo"><label for="t_ano">Ano letivo</label><input id="t_ano" type="number" value="${esc(t0?.ano_letivo || d.ano_atual)}"></div>
          <div class="campo"><label for="t_bim">Até qual bimestre ficou</label><select id="t_bim">${[1, 2, 3, 4].map((n) => `<option value="${n}" ${+(t0?.bimestres || bimestreAtual()) === n ? 'selected' : ''}>até o ${n}º bimestre</option>`).join('')}</select></div>
          <div class="campo"><label for="t_per">Período (sai no papel)</label><input id="t_per" value="${esc(t0?.periodo || '')}" placeholder="29/01 a 30 de abril de ${esc(d.ano_atual)}"></div>
          <div class="campo"><label for="t_turma">Turma</label><input id="t_turma" value="${esc(t0?.turma ?? (a.turma_rotulo || ''))}"></div>
          <div class="campo"><label for="t_turno">Turno</label><input id="t_turno" value="${esc(t0?.turno ?? (a.turno === 'M' ? 'Manhã' : a.turno === 'T' ? 'Tarde' : ''))}" list="t_turnos"><datalist id="t_turnos"><option value="Manhã"><option value="Tarde"><option value="Integral"></datalist></div>
          <div class="campo" data-fundI><label for="t_faltas">Faltas no período (1º ao 5º ano)</label><input id="t_faltas" value="${esc(t0?.faltas || '')}"></div>
          <div class="campo" data-fundI><label for="t_dias">Dias letivos no período (1º ao 5º ano)</label><input id="t_dias" value="${esc(t0?.dias_letivos || '')}"></div>
        </div>
        <p class="dado" style="margin:10px 0 6px">As notas dos bimestres saem sozinhas do quadro "Notas do ano por bimestre" (aparecem em cinza abaixo); só digite aqui se precisar de outra nota.
          Os bimestres depois do escolhido ficam bloqueados e saem riscados no papel. Do 6º ano em diante, cada disciplina tem também as faltas e as aulas dadas.</p>
        <div class="tabela-wrap" id="t_grade"></div>
      </div>
    </div>`;

  const bGrade = $('#b_grade', c), bInfo = $('#b_info', c), selSerie = $('#b_serie', c);
  const temDados = (ch) => todosCampos(cursoDaSerie(ch)).some((f) => (f.startsWith('n:') || f.startsWith('b:')) && ler(ch, f));
  const bAnos = $('#b_anos', c);
  const desenharOpcoes = () => {
    const atual = selSerie.value || serieAbrir;
    selSerie.innerHTML = SERIES_HIST.map(([k, r]) => `<option value="${k}" ${k === atual ? 'selected' : ''}>${r}</option>`).join('');
    // Um botão por ano: ✓ já tem notas · "cursando" é o ano de agora · "falta" é ano já cursado sem notas · os seguintes ficam apagados
    const lista = seriesDoCurso.some(([k]) => k === atual) ? seriesDoCurso : [...seriesDoCurso, SERIES_HIST.find(([k]) => k === atual)];
    bAnos.innerHTML = lista.map(([k, r], i) => {
      const tem = temDados(k), eAtual = k === a.serie_chave, futuro = idxAtual >= 0 && i > idxAtual, cursado = idxAtual >= 0 && i < idxAtual;
      // Aluno novo está cadastrado na série do ano que vem: a anterior ele ainda está cursando na outra escola
      const naOutra = a.novo && idxAtual >= 0 && i === idxAtual - 1;
      const estado = tem ? 'tem' : eAtual ? 'agora' : naOutra ? '' : cursado ? 'falta' : futuro ? 'futuro' : '';
      const sub = tem ? '✓ com notas' : eAtual ? 'cursando' : naOutra ? 'na outra escola' : cursado ? 'falta lançar' : futuro ? 'ainda não' : '';
      return `<button type="button" role="tab" class="ano-hist ${estado} ${k === atual ? 'on' : ''}" data-serie="${k}" aria-selected="${k === atual}"
        ${futuro ? 'title="O aluno ainda não chegou a este ano"' : ''}><b>${esc(r)}</b><small>${sub}</small></button>`;
    }).join('');
    $('#b_titulo', c).textContent = `Notas do ${SERIES_HIST.find(([k]) => k === atual)[1]}${atual === a.serie_chave ? ' (ano atual)' : ''} — por bimestre`;
  };
  bAnos.onclick = (e) => {
    const b = e.target.closest('[data-serie]');
    if (!b || b.dataset.serie === selSerie.value) return;
    selSerie.value = b.dataset.serie;
    desenharSerie();
  };

  // Ao abrir uma série que o aluno já cursou (ou está cursando), o que dá para saber vem preenchido
  function preencherSozinho(ch) {
    const s = serieInfo(ch), k = cursoDaSerie(ch);
    if (!s || s.ano_provavel == null) return;
    const por = (f, v) => { if (!ler(ch, f) && v != null && v !== '') V.set(`${ch}|${f}`, String(v)); };
    por('ano_letivo', s.ano_provavel);
    por('carga', cf.carga[k]);
    // Aluno novo fez os anos anteriores em outra escola: a escola fica para digitar
    if (!a.novo) { por('escola', d.escola.escola); por('cidade', d.escola.cidade); por('uf', d.escola.uf); }
    if (s.ano_provavel === d.ano_atual) por('resultado', 'Cursando');
  }

  const desenharSerie = () => {
    const ch = selSerie.value, k = cursoDaSerie(ch), medio = k === 'medio';
    preencherSozinho(ch);
    $('#blocoFundConc', c).hidden = !medio;
    $('#b_apagar', c).hidden = !doBanco.has(ch);
    const res = ler(ch, 'resultado');
    bInfo.innerHTML = [...HIST_ONDE, ...HIST_TOTAIS[k].map(([f, r]) => [f, r, 'number'])].map(([f, rot, tipo]) =>
      `<div class="campo"><label>${esc(rot)}</label><input type="${tipo}" data-f="${f}" value="${esc(ler(ch, f))}" ${f === 'uf' ? 'maxlength="2"' : ''}></div>`).join('')
      + `<div class="campo"><label>Situação no ano <small class="dado">(não sai no papel)</small></label><select data-f="resultado"><option value=""></option>
        ${d.resultados.map((x) => `<option ${res === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select><small class="sug" id="b_sug" hidden></small></div>`;
    const comps = d.cursos[k].componentes;
    let areaAnt = null;
    bGrade.innerHTML = `<table class="grade-notas"><thead><tr><th class="comp">Disciplina</th>${BIMS.map((b, i) => `<th>${i + 1}º bim</th>`).join('')}
      <th>Nota final do ano</th>${medio ? '<th>Carga (h)</th>' : ''}</tr></thead><tbody>
      ${comps.map((comp, i) => {
        const cab = comp.area !== areaAnt ? `<tr><td class="area" colspan="${medio ? 7 : 6}">${esc(comp.area || 'Outras')}</td></tr>` : '';
        areaAnt = comp.area;
        return cab + `<tr><td class="comp">${esc(comp.nome)}</td>${BIMS.map((b, j) => `<td><input data-r="${i}" data-c="${j}" data-f="b:${esc(comp.nome)}|${b}"
          value="${esc(ler(ch, `b:${comp.nome}|${b}`))}" aria-label="${j + 1}º bimestre de ${esc(comp.nome)}"></td>`).join('')}
          <td><input data-r="${i}" data-c="4" data-f="n:${esc(comp.nome)}" data-comp="${esc(comp.nome)}" value="${esc(ler(ch, 'n:' + comp.nome))}" aria-label="Nota final de ${esc(comp.nome)}"></td>
          ${medio ? `<td><input class="ch" data-r="${i}" data-c="5" data-f="h:${esc(comp.nome)}" value="${esc(ler(ch, 'h:' + comp.nome))}" aria-label="Carga horária de ${esc(comp.nome)}"></td>` : ''}</tr>`;
      }).join('')}</tbody></table>`;
    comps.forEach((comp) => recalcular(ch, comp.nome));
    atualizarSituacao(ch);
    desenharOpcoes();
  };

  // Nota final = média dos 4 bimestres (fica travada, porque é calculada); sem os 4, pode ser digitada
  function recalcular(ch, comp) {
    const m = mediaDoAno(Object.fromEntries(BIMS.map((b) => [b, ler(ch, `b:${comp}|${b}`)])), cf);
    const fin = $(`[data-f="n:${CSS.escape(comp)}"]`, bGrade);
    if (m != null) V.set(`${ch}|n:${comp}`, m);
    if (fin) {
      if (m != null) fin.value = m;
      fin.readOnly = m != null;
      fin.title = m != null ? 'Calculada pela média dos 4 bimestres' : 'Sem os 4 bimestres: digite a nota final do ano';
    }
    $$(`[data-f^="b:"], [data-f^="n:"]`, bGrade).forEach((inp) => { const n = notaNum(inp.value); inp.classList.toggle('baixa', n != null && n < cf.media); });
  }
  // Situação sugerida pelas notas finais; só entra sozinha quando nenhuma disciplina está com bimestre pela metade
  function atualizarSituacao(ch) {
    const k = cursoDaSerie(ch), comps = d.cursos[k].componentes;
    const finais = Object.fromEntries(comps.map((comp) => [comp.nome, ler(ch, 'n:' + comp.nome)]).filter(([, v]) => v));
    const pelaMetade = comps.some((comp) => BIMS.some((b) => ler(ch, `b:${comp.nome}|${b}`)) && !ler(ch, 'n:' + comp.nome));
    const s = sugerirResultado(finais, cf);
    const sel = $('[data-f="resultado"]', bInfo), sug = $('#b_sug', c);
    if (s && !pelaMetade && autoRes.has(ch)) { V.set(`${ch}|resultado`, s.resultado); if (sel) sel.value = s.resultado; }
    const diverge = s && !pelaMetade && sel && sel.value && !['Cursando', 'Transferido', 'Aprovado pelo Conselho'].includes(sel.value) && sel.value !== s.resultado;
    if (sug) { sug.textContent = diverge ? `As notas indicam ${s.resultado}${s.motivo ? ' (' + s.motivo + ')' : ''}` : ''; sug.hidden = !diverge; }
  }

  const aoDigitar = (e) => {
    const el = e.target.closest('[data-f]');
    if (!el) return;
    const ch = selSerie.value, f = el.dataset.f;
    V.set(`${ch}|${f}`, el.value.trim());
    if (f === 'resultado') { if (el.value && el.value !== 'Cursando') autoRes.delete(ch); else autoRes.add(ch); }
    if (f.startsWith('b:')) recalcular(ch, f.slice(2, f.lastIndexOf('|')));
    else if (f.startsWith('n:')) recalcular(ch, f.slice(2));
    atualizarSituacao(ch);
  };
  [bGrade, bInfo].forEach((x) => { x.addEventListener('input', aoDigitar); x.addEventListener('change', aoDigitar); });
  comoPlanilha(bGrade);
  selSerie.onchange = desenharSerie;
  desenharOpcoes();
  desenharSerie();
  $('#b_apagar', c).onclick = tentar(async () => {
    const ch = selSerie.value, x = doBanco.get(ch);
    if (!x || !(await confirmar(`Apagar tudo do ${serieInfo(ch).rotulo} deste aluno (notas, bimestres, cargas)? Vai para a Lixeira e dá para desfazer.`, 'Apagar'))) return;
    await api('DELETE', '/api/historico/ano/' + x.id);
    rotear();
  });

  // ── Grade da transferência: disciplinas da série escolhida × 4 bimestres + faltas e aulas dadas ──
  const valoresT = new Map(Object.entries(t0?.notas || {}).flatMap(([comp, x]) => [...BIMS, 'faltas', 'aulas'].map((k) => [comp + '|' + k, String(x?.[k] ?? '')])));
  const tGrade = $('#t_grade', c);
  const desenharTransf = () => {
    $$('[data-t]', tGrade).forEach((i) => valoresT.set(i.dataset.t, i.value));
    const serie = $('#t_serie', c).value, curso = cursoDaSerie(serie), bim = +$('#t_bim', c).value;
    const fundI = curso === 'fund' && +serie.slice(1) <= 5;
    $$('[data-fundI]', c).forEach((x) => { x.hidden = !fundI; });
    const comps = d.cursos[curso].componentes;
    const cols = [...BIMS.map((k, i) => [k, `${i + 1}º Bim`, i + 1 > bim]), ...(fundI ? [] : [['faltas', 'Faltas', false], ['aulas', 'Aulas dadas', false]])];
    tGrade.innerHTML = `<table class="grade-notas"><thead><tr><th class="comp">Disciplina</th>${cols.map(([, r, off]) => `<th class="${off ? 'dado' : ''}">${r}</th>`).join('')}</tr></thead><tbody>
      ${comps.map((comp, i) => `<tr><td class="comp">${esc(comp.nome)}</td>${cols.map(([k, r, off], j) => `<td><input data-r="${i}" data-c="${j}" data-t="${esc(comp.nome)}|${k}"
        value="${esc(valoresT.get(comp.nome + '|' + k) || '')}" placeholder="${esc(BIMS.includes(k) ? ler(serie, `b:${comp.nome}|${k}`) : '')}" ${off ? 'disabled title="O aluno não chegou a este bimestre"' : ''} aria-label="${esc(r)} de ${esc(comp.nome)}"></td>`).join('')}</tr>`).join('')}
    </tbody></table>`;
  };
  comoPlanilha(tGrade);
  $('#t_on', c).onchange = () => { $('#t_bloco', c).hidden = !$('#t_on', c).checked; if ($('#t_on', c).checked) desenharTransf(); };
  $('#t_serie', c).onchange = desenharTransf;
  $('#t_bim', c).onchange = desenharTransf;
  desenharTransf();

  const lerTransf = () => {
    if (!$('#t_on', c).checked) return '';
    $$('[data-t]', tGrade).forEach((i) => valoresT.set(i.dataset.t, i.value));
    const serie = $('#t_serie', c).value, bim = +$('#t_bim', c).value;
    const notas = {};
    for (const comp of d.cursos[cursoDaSerie(serie)].componentes) {
      const x = {};
      // Bimestre que o aluno não cursou não vai para o papel, mesmo que tenha sido digitado antes de trocar
      BIMS.forEach((k, i) => { x[k] = i + 1 <= bim ? valoresT.get(comp.nome + '|' + k) || '' : ''; });
      x.faltas = valoresT.get(comp.nome + '|faltas') || ''; x.aulas = valoresT.get(comp.nome + '|aulas') || '';
      notas[comp.nome] = x;
    }
    return montarTransf({ serie_chave: serie, ano_letivo: $('#t_ano', c).value, bimestres: String(bim), periodo: $('#t_per', c).value, turma: $('#t_turma', c).value,
      turno: $('#t_turno', c).value, faltas: $('#t_faltas', c).value, dias_letivos: $('#t_dias', c).value, notas });
  };

  const lerTela = () => {
    const v = (id2) => $('#' + id2, c).value.trim();
    return {
      rg: v('h_rg'), rg_expedicao: v('h_rg_exp'), rg_orgao: v('h_rg_org').toUpperCase(), rg_uf: v('h_rg_uf').toUpperCase(), naturalidade: v('h_nat'),
      uf_nasc: v('h_uf').toUpperCase(), nacionalidade: v('h_nac'), fund_ano: v('h_fano'), fund_escola: v('h_fesc'), fund_cidade: v('h_fcid'),
      fund_uf: v('h_fuf').toUpperCase(), obs: v('h_obs'),
      anos_json: JSON.stringify(montarAnos(ler)), transf_json: lerTransf(),
    };
  };
  const salvar = async () => !(await salvarComVersao('/api/historico/aluno/' + a.id, lerTela(), original)).nada;

  $('#hSalvar', c).onclick = tentar(async () => {
    if (await salvar()) { toast('Histórico salvo'); rotear(); } else toast('Nada mudou desde a última vez que foi salvo');
  });
  $('#hDoc', c).onclick = tentar(async () => {
    // Salva antes, para o documento sair com o que está na tela
    const mudou = await salvar();
    abrirDoc({ tipo: 'historico', aluno: a.id, curso: cursoDaSerie(selSerie.value) });
    if (mudou) { toast('Salvo e aberto para imprimir'); rotear(); }
  });
};

// Bimestre em que a escola está hoje (sugestão para a transferência)
function bimestreAtual() { const m = new Date().getMonth() + 1; return m <= 4 ? 1 : m <= 7 ? 2 : m <= 9 ? 3 : 4; }

// Secretaria IEL — Histórico escolar (4.9.0)
// As notas de cada ano entram por aluno (#/hist/<id>) ou pela turma inteira (aba "Lançar notas da turma"),
// e o histórico sai pronto no papel timbrado (documento "historico" em doc.js).
'use strict';

const notaNum = (v) => { const t = String(v ?? '').trim(); return /^\d{1,2}([.,]\d{1,2})?$/.test(t) ? Number(t.replace(',', '.')) : null; };
const numBR = (n) => String(n).replace('.', ',');

// Mesma regra do servidor: nota abaixo da média ou frequência abaixo do mínimo sugerem "Retido"
function sugerirResultado(notas, freq, cf) {
  const valores = Object.entries(notas).filter(([, n]) => String(n ?? '').trim());
  if (!valores.length) return null;
  const f = String(freq ?? '').trim() ? Number(String(freq).replace(',', '.')) : null;
  if (f != null && f < cf.frequencia) return { resultado: 'Retido', motivo: `frequência abaixo de ${cf.frequencia}%` };
  const abaixo = valores.filter(([, n]) => notaNum(n) != null && notaNum(n) < cf.media).map(([k]) => k);
  if (abaixo.length) return { resultado: 'Retido', motivo: `abaixo de ${numBR(cf.media)} em ${abaixo.join(', ')}` };
  return { resultado: 'Aprovado', motivo: '' };
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
      if (!alvo) return;
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
function atualizarResultado(notasEls, freqEl, resEl, sugEl, cf) {
  const notas = {};
  for (const el of notasEls) {
    notas[el.dataset.comp] = el.value;
    const n = notaNum(el.value);
    el.classList.toggle('baixa', n != null && n < cf.media);
  }
  const s = sugerirResultado(notas, freqEl.value, cf);
  if (resEl.dataset.auto === '1') resEl.value = s ? s.resultado : '';
  const diverge = s && resEl.value && !['Cursando', 'Transferido', 'Aprovado pelo Conselho'].includes(resEl.value) && resEl.value !== s.resultado;
  sugEl.textContent = diverge ? `As notas indicam ${s.resultado}${s.motivo ? ' (' + s.motivo + ')' : ''}` : '';
  sugEl.hidden = !diverge;
}

let histTurmaEscolhida = '';

TELAS.historico = async (c, aba = 'alunos') => {
  const ABAS = { alunos: 'Alunos', turma: 'Lançar notas da turma', ...(EU.perfil === 'admin' ? { disciplinas: 'Disciplinas e regras' } : {}) };
  if (!ABAS[aba]) aba = 'alunos';
  c.innerHTML = `<h1>Histórico escolar</h1>
    <p class="sub">Digite as notas de cada ano — aluno por aluno ou a turma inteira de uma vez — e o histórico sai pronto, no papel timbrado.</p>
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
      <div class="cartao kpi ${r.faltando ? 'alerta' : ''}"><div class="rot">Com ano faltando</div><div class="val">${r.faltando}</div><div class="det">algum ano sem notas ou sem resultado</div></div>
      <div class="cartao kpi"><div class="rot">Anos lançados</div><div class="val">${r.anos_lancados}</div><div class="det">colunas de histórico já preenchidas</div></div>
    </div>
    <div class="dica">Cada ano cursado é uma coluna do histórico. Clique em <b>Notas</b> para digitar os anos de um aluno (quem veio de outra escola:
      copie do histórico que a família trouxe). No fim do ano, use <b>Lançar notas da turma</b> — dá para colar direto do Excel.
      O botão <b>🖨️ Histórico</b> monta o documento na hora.</div>
    <div class="cartao" style="margin-top:14px"><div class="filtros">
      <select id="ft"><option value="">Todas as turmas</option>${d.turmas.map((t) => `<option>${esc(t.rotulo)}</option>`).join('')}</select>
      <label class="chk"><input type="checkbox" id="ff"> Só quem tem ano faltando</label>
      <input id="fq" placeholder="Buscar aluno ou matrícula…" style="flex:1;min-width:200px">
      <button class="btn peq" id="imp">🖨️ Imprimir lista</button></div>
    <div class="tabela-wrap"><table><thead><tr><th>Aluno</th><th>Turma</th><th>Anos no histórico</th><th>Falta lançar</th><th></th></tr></thead><tbody id="tb"></tbody></table></div></div>`;
  const desenhar = () => {
    const ft = $('#ft', el).value, ff = $('#ff', el).checked, q = norm($('#fq', el).value);
    const f = d.alunos.filter((a) => (!ft || a.turma_rotulo === ft) && (!ff || a.faltam.length) && (!q || norm(a.nome + ' ' + (a.mat || '')).includes(q)));
    emPartes($('#tb', el), f.map((a) => `<tr><td><a href="#/hist/${a.id}"><b>${esc(titulo(a.nome))}</b></a><br><small class="dado">Mat. ${esc(a.mat || '—')}${a.novo ? ' · aluno novo' : ''}</small></td>
      <td>${esc(a.turma_rotulo)}</td>
      <td>${a.esperadas ? `<span class="progresso"><span class="trilho"><i style="width:${Math.round((100 * a.feitas) / a.esperadas)}%"></i></span>${a.feitas} de ${a.esperadas}</span>` : '<span class="dado">primeiro ano do curso</span>'}
        ${a.atual ? '<br><span class="tag t-novo">ano atual já lançado</span>' : ''}</td>
      <td>${a.faltam.length ? `<span class="tag t-vencendo">${esc(a.faltam.join(', '))}</span>` : '<span class="tag t-concluida">em dia</span>'}</td>
      <td class="acoes" style="justify-content:flex-end"><a class="btn peq" href="#/hist/${a.id}">Notas</a><button class="btn peq" data-doc="${a.id}">🖨️ Histórico</button></td></tr>`), {
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
  el.innerHTML = `<div class="cartao"><div class="filtros">
      <label class="dado">Turma <select id="ht">${lista.turmas.map((t) => `<option ${t.rotulo === histTurmaEscolhida ? 'selected' : ''}>${esc(t.rotulo)}</option>`).join('')}</select></label>
      <label class="dado">Ano letivo <input type="number" id="ha" style="width:90px"></label>
      <label class="dado">Carga horária anual (h) <input type="number" id="hc" style="width:90px"></label>
      <label class="dado">Dias letivos <input type="number" id="hd" style="width:80px"></label>
    </div><div id="dicaTurma"></div><div class="tabela-wrap" id="gradeTurma"></div>
    <div class="acoes" style="justify-content:flex-end;margin-top:12px"><button class="btn" id="htImp">🖨️ Históricos desta turma</button><button class="btn pri" id="htSalvar">Salvar notas da turma</button></div></div>`;
  let d = null, sujo = false;
  const grade = $('#gradeTurma', el);
  comoPlanilha(grade);
  const carregar = tentar(async () => {
    const t = lista.turmas.find((x) => x.rotulo === $('#ht', el).value);
    histTurmaEscolhida = t.rotulo;
    d = await api('GET', `/api/historico/turma?serie=${encodeURIComponent(t.serie)}&turma=${encodeURIComponent(t.turma)}`);
    const ja = d.alunos.find((a) => a.ano) || {};
    $('#ha', el).value = ja.ano?.ano_letivo || d.ano_letivo;
    $('#hc', el).value = ja.ano?.carga || d.config.carga[d.curso] || '';
    $('#hd', el).value = ja.ano?.dias_letivos || d.config.dias || '';
    $('#dicaTurma', el).innerHTML = `<div class="dica">Nota final de cada disciplina (0 a 10, ou conceito). <b>Enter</b> desce para o próximo aluno.
      Para trazer do Excel ou da SED: copie o bloco das notas (mesma ordem das colunas) e cole na primeira célula — o app espalha sozinho.
      O resultado vem sugerido pelas notas e pela frequência (média ${numBR(d.config.media)}, frequência mínima ${d.config.frequencia}%); dá para trocar.</div>`;
    const comps = d.componentes;
    grade.innerHTML = d.alunos.length ? `<table class="grade-notas"><thead><tr><th class="comp">Aluno</th>${comps.map((x) => `<th title="${esc(x.area || '')}" style="white-space:normal;max-width:80px;font-size:10.5px">${esc(x.nome)}</th>`).join('')}
      <th>Freq. %</th><th>Resultado</th></tr></thead><tbody>
      ${d.alunos.map((a, i) => `<tr data-aluno="${a.id}"><td class="aluno-nome"><b>${esc(titulo(a.nome))}</b><br><small class="dado">Mat. ${esc(a.mat || '—')}</small></td>
        ${comps.map((x, j) => `<td><input data-r="${i}" data-c="${j}" data-comp="${esc(x.nome)}" value="${esc(a.ano?.notas?.[x.nome] ?? '')}" aria-label="${esc(x.nome)} de ${esc(a.nome)}"></td>`).join('')}
        <td><input data-r="${i}" data-c="${comps.length}" data-freq value="${esc(a.ano?.frequencia ?? '')}" aria-label="Frequência de ${esc(a.nome)}"></td>
        <td><select data-r="${i}" data-c="${comps.length + 1}" data-res data-auto="${a.ano?.resultado ? '0' : '1'}"><option value=""></option>
          ${d.resultados.map((x) => `<option ${a.ano?.resultado === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select><small class="sug" hidden></small></td></tr>`).join('')}
      </tbody></table>` : vazio('alunos', 'Turma sem alunos', 'Nenhum aluno ativo nesta turma.');
    const ligarLinha = (tr) => {
      const upd = () => atualizarResultado($$('[data-comp]', tr), $('[data-freq]', tr), $('[data-res]', tr), $('.sug', tr), d.config);
      tr.addEventListener('input', (e) => { sujo = true; if (e.target.matches('[data-res]')) e.target.dataset.auto = '0'; upd(); });
      tr.addEventListener('change', (e) => { if (e.target.matches('[data-res]')) { e.target.dataset.auto = e.target.value ? '0' : '1'; sujo = true; upd(); } });
      upd();
    };
    $$('tr[data-aluno]', grade).forEach(ligarLinha);
    sujo = false;
  });
  $('#ht', el).onchange = async () => {
    if (sujo && !(await confirmar('Há notas digitadas nesta turma que ainda não foram salvas. Trocar de turma e perder o que foi digitado?', 'Trocar mesmo assim'))) {
      $('#ht', el).value = histTurmaEscolhida; return;
    }
    carregar();
  };
  ['ha', 'hc', 'hd'].forEach((id) => ($('#' + id, el).oninput = () => { sujo = true; }));
  $('#htSalvar', el).onclick = tentar(async () => {
    if (!d) return;
    const alunos = $$('tr[data-aluno]', grade).map((tr) => ({
      aluno_id: +tr.dataset.aluno, frequencia: $('[data-freq]', tr).value, resultado: $('[data-res]', tr).value,
      notas: Object.fromEntries($$('[data-comp]', tr).map((i) => [i.dataset.comp, i.value])),
    }));
    const r = await api('PUT', '/api/historico/turma', { serie: d.serie, ano_letivo: $('#ha', el).value, carga: $('#hc', el).value, dias_letivos: $('#hd', el).value, alunos });
    sujo = false;
    toast(`Notas salvas: ${plural(r.alunos, 'aluno', 'alunos')} de ${d.rotulo}`);
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
      <p class="dado">Cada disciplina é uma linha do histórico, nesta ordem. "Tirar" esconde a linha sem apagar as notas já lançadas.</p>
      <table><thead><tr><th>Área</th><th>Disciplina</th><th></th></tr></thead><tbody>
      ${d.componentes.filter((x) => x.curso === k).map((x) => `<tr><td class="dado">${esc(x.area || '')}</td>
        <td>${x.ativo ? esc(x.nome) : `<s>${esc(x.nome)}</s> <span class="dado">fora do histórico</span>`}</td>
        <td class="acoes" style="justify-content:flex-end;flex-wrap:nowrap"><button class="btn peq" data-mv="${x.id}" data-d="cima" title="Subir" aria-label="Subir ${esc(x.nome)}">↑</button>
          <button class="btn peq" data-mv="${x.id}" data-d="baixo" title="Descer" aria-label="Descer ${esc(x.nome)}">↓</button>
          <button class="btn peq" data-ed="${x.id}">Editar</button><button class="btn peq" data-at="${x.id}" data-v="${x.ativo ? 0 : 1}">${x.ativo ? 'Tirar' : 'Voltar'}</button></td></tr>`).join('')}
      </tbody></table>
      <form class="acoes" data-novo="${k}" style="margin-top:10px"><input name="area" placeholder="Área (ex.: Linguagens)" style="width:170px">
        <input name="nome" placeholder="Nova disciplina" required style="flex:1;min-width:140px"><button class="btn">＋ Adicionar</button></form></div>`).join('')}</div>
    <div class="cartao" style="margin-top:14px"><h2>Regras e assinaturas</h2>
      <form id="regras"><div class="campos">
        <div class="campo"><label>Média mínima para aprovação</label><input id="r_media" value="${esc(cf.hist_media)}"></div>
        <div class="campo"><label>Frequência mínima (%)</label><input id="r_freq" type="number" value="${esc(cf.hist_frequencia)}"></div>
        <div class="campo"><label>Carga horária anual — Fundamental (h)</label><input id="r_cf" type="number" value="${esc(cf.hist_carga_fund)}"></div>
        <div class="campo"><label>Carga horária anual — Médio (h)</label><input id="r_cm" type="number" value="${esc(cf.hist_carga_medio)}"></div>
        <div class="campo"><label>Dias letivos</label><input id="r_dias" type="number" value="${esc(cf.hist_dias)}"></div>
        <div class="campo"><label>Secretário(a) de escola (assina)</label><input id="r_sec" value="${esc(cf.hist_secretario)}"></div>
        <div class="campo"><label>Diretor(a) de escola (assina)</label><input id="r_dir" value="${esc(cf.hist_diretor)}"></div>
      </div>
      <p class="dado" style="margin-top:8px">A média e a frequência servem para o app sugerir "Aprovado" ou "Retido" e pintar de vermelho a nota baixa. A carga e os dias letivos
        são só a sugestão que aparece ao lançar; em cada ano vale o que foi digitado.</p>
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
    await api('PUT', '/api/admin/config', { hist_media: String(media), hist_frequencia: $('#r_freq', el).value, hist_carga_fund: $('#r_cf', el).value,
      hist_carga_medio: $('#r_cm', el).value, hist_dias: $('#r_dias', el).value, hist_secretario: $('#r_sec', el).value.trim(), hist_diretor: $('#r_dir', el).value.trim() });
    toast('Regras salvas');
  });
}

// ───────────── Notas de um aluno (todas as séries) ─────────────
const CAMPOS_ANO_HIST = [
  ['ano_letivo', 'Ano letivo', 'number', ''], ['escola', 'Escola', 'text', 'largo'], ['cidade', 'Cidade', 'text', 'medio'], ['uf', 'UF', 'text', ''],
  ['carga', 'Carga horária (h)', 'number', ''], ['dias_letivos', 'Dias letivos', 'number', ''],
];

TELAS.hist = async (c, id) => {
  const d = await api('GET', '/api/historico/aluno/' + encodeURIComponent(id || ''));
  const a = d.aluno, cf = d.config;
  const doBanco = new Map(d.anos.map((x) => [x.serie_chave, x]));
  const CURSOS_K = ['fund', 'medio'];

  // Monta a lista de anos do mesmo jeito para o que veio do banco e para o que está na tela (assim dá para comparar)
  function montarAnos(ler) {
    const saida = [];
    for (const k of CURSOS_K) for (const s of d.cursos[k].series) {
      const o = { serie_chave: s.chave };
      for (const [f] of CAMPOS_ANO_HIST) o[f] = ler(s.chave, f);
      o.frequencia = ler(s.chave, 'frequencia');
      o.resultado = ler(s.chave, 'resultado');
      o.notas = {};
      for (const comp of d.cursos[k].componentes) o.notas[comp.nome] = ler(s.chave, 'n:' + comp.nome);
      const tem = [...CAMPOS_ANO_HIST.map(([f]) => o[f]), o.frequencia, o.resultado, ...Object.values(o.notas)].some(Boolean);
      if (tem || doBanco.has(s.chave)) saida.push(o);
    }
    return saida;
  }
  const doBancoTxt = (ch, f) => { const x = doBanco.get(ch); if (!x) return ''; return String((f.startsWith('n:') ? x.notas[f.slice(2)] : x[f]) ?? ''); };
  const dadosOrig = { ra: a.ra, rg: a.rg, rg_uf: d.dados.rg_uf, naturalidade: d.dados.naturalidade, uf_nasc: d.dados.uf_nasc, nacionalidade: d.dados.nacionalidade, obs: d.dados.obs };
  const original = { ...Object.fromEntries(Object.entries(dadosOrig).map(([k, v]) => [k, v ?? ''])), anos_json: JSON.stringify(montarAnos(doBancoTxt)), atualizado_em: d.atualizado_em };

  const gradeCurso = (k) => {
    const cur = d.cursos[k];
    let r = 0;
    const linhaCampo = ([f, rot, tipo, cls]) => {
      const lin = r++;
      return `<tr class="info"><td class="comp"><b>${esc(rot)}</b></td>${cur.series.map((s, j) => {
        const ph = f === 'ano_letivo' ? s.ano_provavel || '' : f === 'carga' ? cf.carga[k] || '' : f === 'dias_letivos' ? cf.dias || '' : '';
        return `<td><input type="${tipo}" class="${cls}" data-r="${lin}" data-c="${j}" data-s="${s.chave}" data-f="${f}" value="${esc(doBancoTxt(s.chave, f))}" placeholder="${esc(ph)}" aria-label="${esc(rot)} do ${esc(s.rotulo)}"></td>`;
      }).join('')}</tr>`;
    };
    let areaAnt = null;
    const linhasNotas = cur.componentes.map((comp) => {
      const lin = r++;
      const cab = comp.area !== areaAnt ? `<tr><td class="area" colspan="${cur.series.length + 1}">${esc(comp.area || 'Outras')}</td></tr>` : '';
      areaAnt = comp.area;
      return cab + `<tr><td class="comp">${esc(comp.nome)}</td>${cur.series.map((s, j) => `<td><input data-r="${lin}" data-c="${j}" data-s="${s.chave}" data-f="n:${esc(comp.nome)}" data-comp="${esc(comp.nome)}"
        value="${esc(doBancoTxt(s.chave, 'n:' + comp.nome))}" aria-label="${esc(comp.nome)} do ${esc(s.rotulo)}"></td>`).join('')}</tr>`;
    }).join('');
    const linFreq = r++, linRes = r++;
    return `<div class="tabela-wrap" data-curso="${k}"><table class="grade-notas"><thead><tr><th class="comp">${esc(cur.nome)}</th>${cur.series.map((s) => {
      const salvo = doBanco.get(s.chave);
      return `<th>${esc(s.rotulo)}${salvo ? ` <button type="button" class="btn peq" data-limpar="${salvo.id}" data-rot="${esc(s.rotulo)}" title="Apagar este ano do histórico" aria-label="Apagar o ${esc(s.rotulo)}">×</button>` : ''}</th>`;
    }).join('')}</tr></thead><tbody>
      ${CAMPOS_ANO_HIST.map(linhaCampo).join('')}
      ${linhasNotas}
      <tr class="info"><td class="comp"><b>Frequência (%)</b></td>${cur.series.map((s, j) => `<td><input data-r="${linFreq}" data-c="${j}" data-s="${s.chave}" data-f="frequencia" data-freq value="${esc(doBancoTxt(s.chave, 'frequencia'))}" aria-label="Frequência do ${esc(s.rotulo)}"></td>`).join('')}</tr>
      <tr class="info"><td class="comp"><b>Resultado</b></td>${cur.series.map((s, j) => {
        const v = doBancoTxt(s.chave, 'resultado');
        return `<td><select data-r="${linRes}" data-c="${j}" data-s="${s.chave}" data-f="resultado" data-res data-auto="${v ? '0' : '1'}" aria-label="Resultado do ${esc(s.rotulo)}"><option value=""></option>
          ${d.resultados.map((x) => `<option ${v === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select><small class="sug" hidden></small></td>`;
      }).join('')}</tr>
    </tbody></table></div>`;
  };

  const campoDado = (id2, rot, valor, extra = '') => `<div class="campo"><label for="${id2}">${esc(rot)}</label><input id="${id2}" value="${esc(valor ?? '')}" ${extra}></div>`;
  c.innerHTML = `<div class="acoes" style="justify-content:space-between"><div><h1>Histórico de ${esc(titulo(a.nome))}</h1>
      <p class="sub">${esc(a.turma_rotulo)} · Mat. ${esc(a.mat || '—')}${a.novo ? ' · aluno novo' : ''} · <a href="#/aluno/${a.id}">abrir a ficha</a></p></div>
    <div class="acoes"><a class="btn" href="#/historico">← Voltar</a><button class="btn" id="hAuto">✨ Preencher o que dá sozinho</button>
      <button class="btn" id="hDoc">🖨️ Gerar histórico</button><button class="btn pri" id="hSalvar">Salvar</button></div></div>
    <div class="cartao"><h2>Dados que saem no histórico</h2><div class="campos">
      ${campoDado('h_ra', 'R.A.', a.ra)}${campoDado('h_rg', 'RG', a.rg)}${campoDado('h_rg_uf', 'UF do RG', d.dados.rg_uf, 'maxlength="2" placeholder="SP"')}
      <div class="campo"><label>Nascimento</label><input value="${esc(dataBR(a.dt_nasc))}" disabled></div>
      ${campoDado('h_nat', 'Naturalidade (cidade)', d.dados.naturalidade)}${campoDado('h_uf', 'UF de nascimento', d.dados.uf_nasc, 'maxlength="2" placeholder="SP"')}
      ${campoDado('h_nac', 'Nacionalidade', d.dados.nacionalidade, 'placeholder="Brasileira"')}
      <div class="campo"><label>Filiação</label><input value="${esc([a.nome_mae, a.nome_pai].filter(Boolean).map(titulo).join(' e ') || '—')}" disabled title="Vem do cadastro do aluno"></div>
    </div>
    <div class="campo" style="margin-top:10px"><label for="h_obs">Observações que saem no histórico</label><textarea id="h_obs" style="min-height:54px">${esc(d.dados.obs || '')}</textarea></div>
    <p class="dado" style="margin-top:6px">R.A. e RG corrigidos aqui ficam corrigidos também na ficha do aluno.</p></div>
    <div class="cartao" style="margin-top:14px">
      <div class="abas" style="margin-bottom:10px">${CURSOS_K.map((k) => `<button type="button" data-cur="${k}" class="${d.curso === k ? 'on' : ''}">${esc(d.cursos[k].nome)}</button>`).join('')}</div>
      <div class="dica" style="margin-top:0">Uma coluna por ano. Digite a nota final de cada disciplina (0 a 10 ou conceito); nota abaixo de ${numBR(cf.media)} fica vermelha.
        O resultado aparece sozinho pelas notas e pela frequência (mínimo ${cf.frequencia}%) — dá para trocar. <b>Enter</b> desce; colar um bloco do Excel espalha pelas células.
        Em cinza, a sugestão: "Preencher o que dá sozinho" coloca o ano, a carga e a escola.</div>
      <div id="grades">${CURSOS_K.map(gradeCurso).join('')}</div>
    </div>`;

  const grades = $('#grades', c);
  const mostrarCurso = (k) => {
    $$('[data-curso]', grades).forEach((g) => { g.hidden = g.dataset.curso !== k; });
    $$('[data-cur]', c).forEach((b) => b.classList.toggle('on', b.dataset.cur === k));
  };
  mostrarCurso(d.curso);
  $$('[data-cur]', c).forEach((b) => (b.onclick = () => mostrarCurso(b.dataset.cur)));
  $$('[data-curso]', grades).forEach(comoPlanilha);

  // Resultado de cada coluna acompanha as notas
  const coluna = (ch) => $$(`[data-s="${ch}"]`, grades);
  const atualizarColuna = (ch) => {
    const els = coluna(ch);
    const res = els.find((e) => e.dataset.res !== undefined);
    atualizarResultado(els.filter((e) => e.dataset.comp !== undefined), els.find((e) => e.dataset.freq !== undefined), res, res.nextElementSibling, cf);
  };
  grades.addEventListener('input', (e) => { const el = e.target.closest('[data-s]'); if (el) { if (el.dataset.res !== undefined) el.dataset.auto = '0'; atualizarColuna(el.dataset.s); } });
  grades.addEventListener('change', (e) => { const el = e.target.closest('[data-res]'); if (el) { el.dataset.auto = el.value ? '0' : '1'; atualizarColuna(el.dataset.s); } });
  for (const k of CURSOS_K) for (const s of d.cursos[k].series) atualizarColuna(s.chave);

  const lerTela = () => {
    const m = new Map($$('[data-s][data-f]', grades).map((e) => [e.dataset.s + '|' + e.dataset.f, e.value.trim()]));
    return {
      ra: $('#h_ra', c).value.trim(), rg: $('#h_rg', c).value.trim(), rg_uf: $('#h_rg_uf', c).value.trim().toUpperCase(), naturalidade: $('#h_nat', c).value.trim(),
      uf_nasc: $('#h_uf', c).value.trim().toUpperCase(), nacionalidade: $('#h_nac', c).value.trim(), obs: $('#h_obs', c).value.trim(),
      anos_json: JSON.stringify(montarAnos((ch, f) => m.get(ch + '|' + f) ?? '')),
    };
  };
  const salvar = async () => {
    const r = await salvarComVersao('/api/historico/aluno/' + a.id, lerTela(), original);
    return !r.nada;
  };

  $('#hSalvar', c).onclick = tentar(async () => {
    if (await salvar()) { toast('Histórico salvo'); rotear(); } else toast('Nada mudou desde a última vez que foi salvo');
  });
  $('#hDoc', c).onclick = tentar(async () => {
    // Salva antes, para o documento sair com o que está na tela
    const curso = $('[data-cur].on', c).dataset.cur;
    const mudou = await salvar();
    abrirDoc({ tipo: 'historico', aluno: a.id, curso });
    if (mudou) { toast('Salvo e aberto para imprimir'); rotear(); }
  });
  $('#hAuto', c).onclick = () => {
    const k = $('[data-cur].on', c).dataset.cur;
    let n = 0;
    const por = (ch, f) => $(`[data-s="${ch}"][data-f="${f}"]`, grades);
    for (const s of d.cursos[k].series) {
      if (s.ano_provavel == null) continue; // série que o aluno ainda não cursou
      const colocar = (f, v) => { const el = por(s.chave, f); if (el && !el.value && v) { el.value = v; n++; } };
      colocar('ano_letivo', s.ano_provavel); colocar('carga', cf.carga[k]); colocar('dias_letivos', cf.dias);
      // Aluno novo fez os anos anteriores em outra escola: a escola fica para digitar
      if (!a.novo) { colocar('escola', d.escola.escola); colocar('cidade', d.escola.cidade); colocar('uf', d.escola.uf); }
      if (s.ano_provavel === d.ano_atual) { const res = por(s.chave, 'resultado'); if (res && !res.value) { res.value = 'Cursando'; res.dataset.auto = '0'; n++; } }
    }
    toast(n ? `${plural(n, 'campo preenchido', 'campos preenchidos')}. Se o aluno fez algum ano em outra escola, troque o nome da escola nessa coluna.`
      : 'Não havia nada em branco para preencher.');
  };
  $$('[data-limpar]', grades).forEach((b) => (b.onclick = tentar(async () => {
    if (!(await confirmar(`Apagar o ${b.dataset.rot} do histórico (notas, frequência e resultado)? Vai para a Lixeira e dá para desfazer.`, 'Apagar'))) return;
    await api('DELETE', '/api/historico/ano/' + b.dataset.limpar);
    rotear();
  })));
};

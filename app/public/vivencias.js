// Secretaria IEL — Vivências (4.9.0)
// Controle de quem agendou, quem veio, quando, se a família foi contatada depois e se virou matrícula.
// Substitui a planilha "Controle de Vivência" do Google (mesmas colunas e o mesmo painel).
'use strict';

const TAG_VIV = { Agendada: 't-novo', Realizada: 't-concluida', Faltou: 't-vencida', Remarcada: 't-vencendo', Cancelada: 't-nao_renova' };
const TAG_EFETIVOU = { Sim: 't-concluida', 'Não': 't-vencida', 'Em análise': 't-pendente' };
const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
let abaVivencias = 'registro';

// Número de WhatsApp a partir do telefone digitado na vivência ("(11) 95767-0177" → 5511957670177)
function whatsDe(tel) {
  let n = String(tel || '').replace(/\D/g, '');
  if (n.startsWith('55') && n.length >= 12) return n;
  if (n.startsWith('0')) n = n.slice(1);
  if (n.length === 9) n = '11' + n;
  return n.length === 11 ? '55' + n : '';
}

TELAS.vivencias = async (c, ano) => {
  const d = await api('GET', '/api/vivencias' + (ano ? '?ano=' + encodeURIComponent(ano) : ''));
  const p = d.painel, h = hojeIso();
  c.innerHTML = `<div class="acoes" style="justify-content:space-between"><div><h1>Vivências</h1>
      <p class="sub">Crianças que vêm passar um período na escola antes da matrícula: quem agendou, quem veio, se a família foi contatada e se matriculou.</p></div>
    <div class="acoes"><button class="btn peq" id="vAnt" aria-label="Ano anterior">←</button><b>${d.ano}</b><button class="btn peq" id="vProx" aria-label="Ano seguinte">→</button>
      <button class="btn" id="vImp">📥 Importar planilha</button><button class="btn ama" id="vNova">＋ Agendar vivência</button></div></div>
  <div class="grade g4">
    <div class="cartao kpi destaque"><div class="rot">Total de vivências</div><div class="val">${p.total}</div><div class="det">${p.a_realizar} a realizar${p.hoje ? ` · <b>${p.hoje} hoje</b>` : ''}</div></div>
    <div class="cartao kpi"><div class="rot">Realizadas</div><div class="val">${p.realizadas}</div><div class="det">${p.ausencias} faltas ou cancelamentos</div></div>
    <div class="cartao kpi ${p.efetivadas ? 'ok' : ''}"><div class="rot">Matrículas efetivadas</div><div class="val">${p.efetivadas}</div><div class="det">${p.nao_efetivadas} não matricularam</div></div>
    <div class="cartao kpi"><div class="rot">% de efetivação</div><div class="val">${String(p.pct_efetivacao).replace('.', ',')}%</div><div class="det">das vivências realizadas</div></div>
  </div>
  <div class="acoes" style="margin-top:10px">
    <button class="btn peq" data-atalho="sem_contato">${p.sem_contato ? '🔴' : '🟢'} Sem contato depois da vivência: <b>${p.sem_contato}</b></button>
    <button class="btn peq" data-atalho="aguardando">Aguardando resposta da família: <b>${p.aguardando}</b></button>
    <button class="btn peq" data-atalho="atrasadas">${p.atrasadas ? '🟠' : ''} Agendadas com data que já passou: <b>${p.atrasadas}</b></button>
  </div>
  <div class="abas" style="margin-top:14px"><button data-vaba="registro">Registro</button><button data-vaba="painel">Painel do ano</button></div>
  <div id="vRegistro"><div class="cartao">
    <div class="filtros">
      <select id="fs" aria-label="Status"><option value="">Todos os status</option>${d.listas.status.map((x) => `<option>${esc(x)}</option>`).join('')}</select>
      <select id="fe" aria-label="Matrícula"><option value="">Matrícula: todas</option>${d.listas.efetivou.map((x) => `<option>${esc(x)}</option>`).join('')}</select>
      <select id="fx" aria-label="Situação"><option value="">Qualquer situação</option><option value="sem_contato">Sem contato depois da vivência</option>
        <option value="aguardando">Aguardando resposta da família</option><option value="atrasadas">Data já passou e não foi marcada</option><option value="hoje">Vivências de hoje</option></select>
      <input id="fq" placeholder="Buscar criança, responsável ou telefone…" style="flex:1;min-width:200px">
      <button class="btn peq" id="vPrint">🖨️ Imprimir</button>
    </div>
    <div class="tabela-wrap"><table><thead><tr><th>Data</th><th>Criança</th><th>Responsável</th><th>Vivência na turma</th><th>Status</th><th>Contato depois</th><th>Matrícula</th><th></th></tr></thead>
      <tbody id="tb"></tbody></table></div></div></div>
  <div id="vPainel" hidden></div>`;

  const passou = (v) => v.data && v.data < h && ['Agendada', 'Remarcada'].includes(v.status);
  const semContato = (v) => v.status === 'Realizada' && v.efetivou === 'Em análise' && !v.contato_em;
  const situacao = { sem_contato: semContato, aguardando: (v) => v.status === 'Realizada' && v.efetivou === 'Em análise', atrasadas: passou,
    hoje: (v) => v.data === h };
  const desenhar = () => {
    const fs = $('#fs', c).value, fe = $('#fe', c).value, fx = $('#fx', c).value, q = norm($('#fq', c).value);
    const qd = $('#fq', c).value.replace(/\D/g, '');
    const f = d.vivencias.filter((v) => (!fs || v.status === fs) && (!fe || v.efetivou === fe) && (!fx || situacao[fx](v))
      && (!q || norm([v.aluno, v.responsavel, v.escola_atual, v.obs].join(' ')).includes(q) || (qd.length >= 3 && String(v.telefone || '').replace(/\D/g, '').includes(qd))));
    emPartes($('#tb', c), f.map((v) => {
      const zap = whatsDe(v.telefone);
      return `<tr class="${passou(v) || semContato(v) ? 'linha-alerta' : ''}">
        <td class="dado">${v.data ? `<b>${dataBR(v.data)}</b>` : '<b>sem data</b>'}${v.periodo ? esc(v.periodo) : ''}${v.data === h ? '<br><span class="tag t-novo">hoje</span>' : ''}</td>
        <td><b>${esc(v.aluno)}</b><br><small class="dado">${esc([v.ano_escolar, v.escola_atual].filter(Boolean).join(' · '))}</small></td>
        <td>${esc(v.responsavel || '—')}<br><small class="dado">${esc(v.telefone || '')}${zap ? ` · <a href="${esc(linkWhats(zap, `Olá${v.responsavel ? ', ' + v.responsavel.split(' ')[0] : ''}! Aqui é da secretaria do Instituto Educacional Luterano.`))}" target="_blank" rel="noopener">WhatsApp</a>` : ''}</small></td>
        <td>${esc(v.classe || '—')}</td>
        <td><span class="tag ${TAG_VIV[v.status] || ''}">${esc(v.status)}</span>${passou(v) ? '<br><small style="color:var(--laranja)">a data já passou</small>' : ''}</td>
        <td>${v.contato_em ? `<span class="dado"><b>${dataBR(v.contato_em)}</b>${esc(nomePessoa(v.contato_por))}</span>` : v.status === 'Realizada' ? '<span class="tag t-vencendo">falta contatar</span>' : '<span class="dado">—</span>'}</td>
        <td><span class="tag ${TAG_EFETIVOU[v.efetivou] || ''}">${esc(v.efetivou)}</span>${v.data_matricula ? `<br><small class="dado">${dataBR(v.data_matricula)}</small>` : ''}</td>
        <td class="acoes nao-imprimir" style="justify-content:flex-end">
          ${['Agendada', 'Remarcada'].includes(v.status) && (!v.data || v.data <= h) ? `<button class="btn peq" data-veio="${v.id}">Veio</button><button class="btn peq" data-faltou="${v.id}">Faltou</button>` : ''}
          ${v.status === 'Realizada' && !v.contato_em ? `<button class="btn peq" data-contato="${v.id}">Contatei</button>` : ''}
          <button class="btn peq" data-ver="${v.id}">Ver</button></td></tr>`;
    }), {
      colunas: 8,
      vazio: `<tr><td colspan="8">${d.vivencias.length ? '<p class="vazio">Nenhuma vivência com esse filtro.</p>' : vazio('vivencias', `Nenhuma vivência em ${d.ano}`,
        'Quando uma família marcar para a criança passar um período na escola, registre aqui. Se vocês já usam a planilha do Google, baixe-a como Excel e use "Importar planilha".',
        '<div class="acoes" style="justify-content:center"><button class="btn pri" id="vPrimeira">Agendar a primeira</button></div>')}</td></tr>`,
      ligar: (tb) => {
        const achar = (id) => d.vivencias.find((x) => x.id === +id);
        const rapido = (sel, corpo, msg) => $$(sel, tb).forEach((b) => (b.onclick = tentar(async () => {
          const v = achar(Object.values(b.dataset)[0]);
          await api('PUT', '/api/vivencias/' + v.id, corpo(v)); toast(msg); rotear();
        })));
        rapido('[data-veio]', () => ({ status: 'Realizada' }), 'Marcada como realizada. Lembre de ligar para a família depois.');
        rapido('[data-faltou]', () => ({ status: 'Faltou' }), 'Marcada como falta');
        $$('[data-contato]', tb).forEach((b) => (b.onclick = () => janelaContato(achar(b.dataset.contato))));
        $$('[data-ver]', tb).forEach((b) => (b.onclick = () => formVivencia(d, achar(b.dataset.ver))));
        if ($('#vPrimeira', tb)) $('#vPrimeira', tb).onclick = () => formVivencia(d);
      },
    });
  };
  ['fs', 'fe', 'fx', 'fq'].forEach((id) => ($('#' + id, c).oninput = desenhar));
  $$('[data-atalho]', c).forEach((b) => (b.onclick = () => { mostrarAba('registro'); $('#fx', c).value = b.dataset.atalho; desenhar(); }));
  $('#vAnt', c).onclick = () => (location.hash = '#/vivencias/' + (d.ano - 1));
  $('#vProx', c).onclick = () => (location.hash = '#/vivencias/' + (d.ano + 1));
  $('#vNova', c).onclick = () => formVivencia(d);
  $('#vImp', c).onclick = () => importarVivencias();
  $('#vPrint', c).onclick = () => window.print();

  // Painel: os mesmos quadros da aba "Dashboard" da planilha
  const quadro = (tituloQ, itens, cor) => `<div class="cartao"><h2>${esc(tituloQ)}</h2>${itens.length ? barras(itens, cor) : '<p class="vazio">Nada ainda.</p>'}</div>`;
  $('#vPainel', c).innerHTML = `<div class="grade g2">
    ${quadro('Status das vivências', p.por_status, 'var(--azul-2)')}
    ${quadro('Efetivação de matrícula', p.por_efetivou, 'var(--verde)')}
    ${quadro('Como a família conheceu a escola', p.por_origem, 'var(--amarelo)')}
    ${quadro('Ano escolar da criança', p.por_ano_escolar.filter(([, n]) => n), 'var(--roxo)')}
    ${quadro('Turma em que fez a vivência', p.por_classe.filter(([, n]) => n), 'var(--azul-2)')}
    <div class="cartao"><h2>Vivências por mês em ${d.ano}</h2>${barras(p.por_mes.map((m) => [`${MESES_CURTOS[m.mes - 1]} · ${m.efetivadas} matric.`, m.total]), 'var(--azul-2)')}
      <p class="dado" style="margin-top:8px">Pela data da vivência. Ao lado do mês, quantas daquele mês viraram matrícula.</p></div>
  </div>`;
  const mostrarAba = (k) => {
    abaVivencias = k;
    $$('[data-vaba]', c).forEach((b) => b.classList.toggle('on', b.dataset.vaba === k));
    $('#vRegistro', c).hidden = k !== 'registro';
    $('#vPainel', c).hidden = k !== 'painel';
  };
  $$('[data-vaba]', c).forEach((b) => (b.onclick = () => mostrarAba(b.dataset.vaba)));
  mostrarAba(abaVivencias);
  desenhar();
};

function formVivencia(d, v) {
  const novo = !v;
  v = v || { status: 'Agendada', efetivou: 'Em análise' };
  const opcoes = (lista, atual, vazioTxt = '') => `<option value="">${esc(vazioTxt)}</option>${[...new Set([...lista, ...(atual && !lista.includes(atual) ? [atual] : [])])]
    .map((x) => `<option ${x === atual ? 'selected' : ''}>${esc(x)}</option>`).join('')}`;
  modal(novo ? 'Agendar vivência' : 'Vivência de ' + v.aluno, `<form id="fv">
    <div class="campos">
      <div class="campo"><label for="v_aluno">Nome da criança *</label><input id="v_aluno" value="${esc(v.aluno || '')}" required></div>
      <div class="campo"><label for="v_resp">Responsável</label><input id="v_resp" value="${esc(v.responsavel || '')}"></div>
      <div class="campo"><label for="v_tel">Telefone / WhatsApp</label><input id="v_tel" value="${esc(v.telefone || '')}" placeholder="(11) 99999-9999"></div>
      <div class="campo"><label for="v_anoesc">Ano escolar hoje</label><select id="v_anoesc">${opcoes(d.listas.ano_escolar, v.ano_escolar)}</select></div>
      <div class="campo"><label for="v_escola">Escola atual</label><input id="v_escola" value="${esc(v.escola_atual || '')}"></div>
      <div class="campo"><label for="v_como">Como conheceu a escola</label><select id="v_como">${opcoes(d.listas.como_conheceu, v.como_conheceu)}</select></div>
    </div>
    <h3 style="margin-top:14px">A vivência</h3>
    <div class="campos">
      <div class="campo"><label for="v_data">Data</label><input type="date" id="v_data" value="${esc(v.data || '')}"></div>
      <div class="campo"><label for="v_per">Período</label><select id="v_per">${opcoes(d.listas.periodo, v.periodo)}</select></div>
      <div class="campo"><label for="v_classe">Turma em que vai ficar</label><input id="v_classe" list="v_classes" value="${esc(v.classe || '')}" placeholder="Jardim II, 5º ano…">
        <datalist id="v_classes">${d.listas.classe.map((x) => `<option value="${esc(x)}">`).join('')}</datalist></div>
      <div class="campo"><label for="v_status">Status</label><select id="v_status">${opcoes(d.listas.status, v.status).replace('<option value=""></option>', '')}</select></div>
    </div>
    <h3 style="margin-top:14px">Depois da vivência</h3>
    <div class="campos">
      <div class="campo"><label for="v_cont">Contatamos a família em</label><input type="date" id="v_cont" value="${esc(v.contato_em || '')}"></div>
      <div class="campo"><label for="v_efet">Efetivou a matrícula?</label><select id="v_efet">${opcoes(d.listas.efetivou, v.efetivou).replace('<option value=""></option>', '')}</select></div>
      <div class="campo"><label for="v_dmat">Data da matrícula</label><input type="date" id="v_dmat" value="${esc(v.data_matricula || '')}"></div>
    </div>
    <div class="campo" style="margin-top:10px"><label for="v_cobs">O que a família disse no contato</label><input id="v_cobs" value="${esc(v.contato_obs || '')}" placeholder="Vai pensar, achou caro, gostou muito…"></div>
    <div class="campo" style="margin-top:10px"><label for="v_obs">Observação</label><textarea id="v_obs" style="min-height:60px">${esc(v.obs || '')}</textarea></div>
    ${v.criado_por ? `<p class="dado" style="margin-top:8px">Registrada por ${esc(nomePessoa(v.criado_por))}${v.contato_por ? ` · contato feito por ${esc(nomePessoa(v.contato_por))}` : ''}</p>` : ''}
    <div class="rodape">${novo ? '' : '<button type="button" class="btn perigo" id="delV" style="margin-right:auto">Excluir</button>'}
      <button type="button" class="btn" data-fechar>Fechar</button><button class="btn pri">Salvar</button></div></form>`,
  { onAbrir: (el, fechar) => {
    // Matriculou: já sugere a data de hoje
    $('#v_efet', el).onchange = () => { if ($('#v_efet', el).value === 'Sim' && !$('#v_dmat', el).value) $('#v_dmat', el).value = hojeIso(); };
    $('#fv', el).onsubmit = tentar(async (ev) => {
      ev.preventDefault();
      const corpo = { aluno: $('#v_aluno', el).value, responsavel: $('#v_resp', el).value, telefone: $('#v_tel', el).value, ano_escolar: $('#v_anoesc', el).value,
        escola_atual: $('#v_escola', el).value, como_conheceu: $('#v_como', el).value, data: $('#v_data', el).value, periodo: $('#v_per', el).value,
        classe: $('#v_classe', el).value, status: $('#v_status', el).value, contato_em: $('#v_cont', el).value, efetivou: $('#v_efet', el).value,
        data_matricula: $('#v_dmat', el).value, contato_obs: $('#v_cobs', el).value, obs: $('#v_obs', el).value };
      if (novo) await api('POST', '/api/vivencias', corpo); else await salvarComVersao('/api/vivencias/' + v.id, corpo, v);
      fechar(); toast(novo ? 'Vivência agendada' : 'Salvo'); rotear();
    });
    if ($('#delV', el)) $('#delV', el).onclick = tentar(async () => {
      if (!(await confirmar(`Excluir a vivência de ${v.aluno}?`, 'Excluir'))) return;
      await api('DELETE', '/api/vivencias/' + v.id); fechar(); rotear();
    });
  } });
}

// "Contatei": registra a ligação depois da vivência e o que a família respondeu
function janelaContato(v) {
  modal('Contato com a família de ' + v.aluno, `<form id="fc">
    <div class="campos"><div class="campo"><label for="c_data">Data do contato</label><input type="date" id="c_data" value="${hojeIso()}" required></div>
      <div class="campo"><label for="c_efet">Vai matricular?</label><select id="c_efet">${['Em análise', 'Sim', 'Não'].map((x) => `<option ${x === v.efetivou ? 'selected' : ''}>${x}</option>`).join('')}</select></div></div>
    <div class="campo" style="margin-top:10px"><label for="c_obs">O que a família disse</label><input id="c_obs" value="${esc(v.contato_obs || '')}" placeholder="Vai pensar, achou caro, gostou muito…"></div>
    <div class="rodape"><button type="button" class="btn" data-fechar>Cancelar</button><button class="btn pri">Salvar contato</button></div></form>`,
  { onAbrir: (el, fechar) => { $('#fc', el).onsubmit = tentar(async (e) => {
    e.preventDefault();
    await api('PUT', '/api/vivencias/' + v.id, { contato_em: $('#c_data', el).value, efetivou: $('#c_efet', el).value, contato_obs: $('#c_obs', el).value });
    fechar(); toast('Contato registrado'); rotear();
  }); } });
}

function importarVivencias() {
  modal('Importar a planilha de vivências', `<p>Traz as vivências da planilha <b>Controle de Vivência</b> do Google para cá.</p>
    <ol class="dado" style="padding-left:18px"><li>Abra a planilha no Google.</li><li>Menu <b>Arquivo › Fazer download › Microsoft Excel (.xlsx)</b>.</li><li>Escolha o arquivo baixado aqui embaixo.</li></ol>
    <div class="campo" style="margin-top:10px"><input type="file" id="i_arq" accept=".xlsx,.csv"></div>
    <p class="dado" style="margin-top:8px">Quem já está aqui com o mesmo nome e a mesma data não é importado de novo. Depois de importar, apague o arquivo baixado (tem dados das famílias).</p>
    <div class="rodape"><button type="button" class="btn" data-fechar>Cancelar</button><button class="btn pri" id="i_ok">Importar</button></div>`,
  { onAbrir: (el, fechar) => { $('#i_ok', el).onclick = tentar(async () => {
    const f = $('#i_arq', el).files[0];
    if (!f) throw new Error('Escolha o arquivo .xlsx');
    const r = await api('POST', '/api/vivencias/importar?arquivo=' + encodeURIComponent(f.name), undefined, f);
    fechar(); toast(`${plural(r.importadas, 'vivência importada', 'vivências importadas')}${r.repetidas ? ` · ${r.repetidas} já estavam aqui` : ''}`); rotear();
  }); } });
}

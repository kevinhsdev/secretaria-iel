// Secretaria IEL 5.1 — telas no modelo do protótipo (pasta prototipo/): Boletos, Atividades extras, Portão, Atendimentos,
// Calendário, Relatórios, Mensagens, Lixeira e Configurações. Só o desenho mudou: as rotas do servidor e as janelas de
// cadastro (formAviso, formAtendimento, formCalendario, formInscricao, cancelarInscricao, abaBackup, abaLgpd,
// abaAtualizacao) são as mesmas de antes e continuam nos arquivos das etapas.
'use strict';

// (MESES_CURTOS vem de vivencias.js: jan, fev, mar…)
const CHECK_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>';
// Cor e ícone de cada canal de atendimento (as cores de situação, não a da marca)
const CANAL_VISUAL = { balcao: ['balcao', 'var(--azul-fundo)', 'var(--azul-2)'], telefone: ['atendimentos', 'var(--amarelo-claro)', 'var(--aviso-txt)'],
  whatsapp: ['mensagens', 'var(--verde-claro)', 'var(--verde)'], email: ['email', 'var(--roxo-claro)', 'var(--roxo)'] };
const iniciais = (nome) => { const p = String(nome || '?').trim().split(/\s+/); return (p[0][0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase(); };
const cabecalho = (tituloTela, subHtml, acoesHtml = '') => `<div class="cabeca"><div><h1>${esc(tituloTela)}</h1>${subHtml ? `<p class="sub">${subHtml}</p>` : ''}</div>
  ${acoesHtml ? `<div class="acoes">${acoesHtml}</div>` : ''}</div>`;
const pctBarra = (n, total) => (total ? Math.min(100, (100 * n) / total) : 0);

// ═════════════ BOLETOS ═════════════
let remessaEscolhida = null;
const turmasAbertas = new Set();
TELAS.boletos = async (c) => {
  const remessas = await api('GET', '/api/remessas');
  if (!remessas.some((r) => r.id === remessaEscolhida)) remessaEscolhida = remessas[0] ? remessas[0].id : null;
  const d = remessaEscolhida ? await api('GET', '/api/remessas/' + remessaEscolhida) : null;
  const venc = EU.config.boletos_dia_venc || 10;
  c.innerHTML = cabecalho('Boletos', 'Entrega dos boletos em papel, turma por turma. Cada remessa é um lote impresso.',
    `${d ? `<button class="btn" id="rimp">${icone('documentos')}Protocolo de entrega</button>` : ''}<button class="btn ama" id="nova">${icone('mais')}Nova remessa</button>`)
    + (remessas.length > 1 ? `<div class="remessas" role="group" aria-label="Remessa">${remessas.map((r) => `<button data-r="${r.id}" aria-pressed="${r.id === remessaEscolhida}">
        <b>${esc(r.nome)}</b><small>${r.entregues} de ${r.total} entregues${r.criado_por ? ' · ' + esc(nomePessoa(r.criado_por)) : ''}</small></button>`).join('')}</div>` : '')
    + (d ? `<div class="grade g4 numeros" id="bNum"></div>
      <div class="barra-filtros"><label class="procura"><input id="rq" placeholder="Buscar aluno ou responsável" aria-label="Buscar aluno ou responsável"></label>
        <div class="seg" id="rs" role="group" aria-label="Situação">${[['', 'Todos'], ['pendente', 'Falta entregar'], ['entregue', 'Entregues']].map(([k, n]) => `<button data-s="${k}" aria-pressed="${k === ''}">${n}</button>`).join('')}</div>
        <select id="rt" aria-label="Turma"><option value="">Todas as turmas</option>${porTurma(d.alunos).map((t) => `<option>${esc(t.turma)}</option>`).join('')}</select>
        ${EU.perfil === 'admin' ? `<button class="btn peq perigo" id="rdel">Excluir remessa</button>` : ''}</div>
      <div id="bTurmas"></div>`
      : `<div class="cartao">${vazio('boletos', 'Nenhuma remessa ainda', 'Crie a primeira quando imprimir a massa de boletos: aqui vocês marcam quem recebeu e imprimem o protocolo de cada turma.')}</div>`);

  $('#nova').onclick = () => modal('Nova remessa de boletos', `<form id="fr">
    <div class="campo"><label for="r_nome">Nome *</label><input id="r_nome" value="Boletos ${esc(EU.config.ano_matricula)} — massa anual" required></div>
    <div class="campos" style="margin-top:10px"><div class="campo"><label for="r_ano">Ano</label><input type="number" id="r_ano" value="${esc(EU.config.ano_matricula)}"></div>
      <div class="campo"><label for="r_ref">Referência</label><input id="r_ref" placeholder="Mensalidades de ${esc(EU.config.ano_matricula)}"></div></div>
    <div class="rodape"><button type="button" class="btn" data-fechar>Cancelar</button><button class="btn pri">Criar</button></div></form>`,
  { onAbrir: (m, fechar) => { $('#fr', m).onsubmit = tentar(async (ev) => {
    ev.preventDefault();
    const r = await api('POST', '/api/remessas', { nome: $('#r_nome', m).value, ano: $('#r_ano', m).value, referencia: $('#r_ref', m).value });
    if (r && r.id) remessaEscolhida = r.id;
    fechar(); toast('Remessa criada'); rotear();
  }); } });
  $$('[data-r]', c).forEach((b) => (b.onclick = () => { remessaEscolhida = +b.dataset.r; turmasAbertas.clear(); rotear(); }));
  if (!d) return;

  let situacao = '';
  const CANAIS_ENTREGA = { balcao: 'Na secretaria', aluno: 'Pela agenda do aluno', portao: 'No portão', correio: 'Correio/e-mail' };
  const numeros = () => {
    const ok = d.alunos.filter((a) => a.entregue_em).length, total = d.alunos.length;
    $('#bNum').innerHTML = `<div class="cartao kpi ok"><div class="rot">Entregues</div><div class="val">${ok}<small>/ ${total}</small></div><div class="det">${Math.round(pctBarra(ok, total))}% de ${esc(d.remessa.nome)}</div></div>
      <div class="cartao kpi ${total - ok ? 'alerta' : ''}"><div class="rot">Falta entregar</div><div class="val">${total - ok}</div><div class="det">${plural(porTurma(d.alunos.filter((a) => !a.entregue_em)).length, 'turma', 'turmas')} com pendência</div></div>
      <div class="cartao kpi"><div class="rot">Vencimento</div><div class="val">dia ${esc(venc)}</div><div class="det">${esc(d.remessa.referencia || 'mensalidades')}</div></div>`;
  };
  const linhaAluno = (a) => `<div class="entrega" data-a="${a.aluno_id}">
      <span><a href="#/aluno/${a.aluno_id}"><b>${esc(titulo(a.nome))}</b></a><small>Resp.: ${esc(titulo(a.responsavel))}${a.entregue_em ? ' · entregue em ' + dataBR(a.entregue_em) : ''}</small></span>
      <input data-k="recebido_por" value="${esc(a.recebido_por || '')}" placeholder="quem retirou" aria-label="Quem retirou o boleto de ${esc(titulo(a.nome))}">
      <select data-k="canal" aria-label="Como foi entregue"><option value="">como?</option>${Object.entries(CANAIS_ENTREGA).map(([k, v]) => `<option value="${k}" ${a.canal === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
      <input data-k="obs" value="${esc(a.obs || '')}" placeholder="observação" aria-label="Observação">
      <button class="liga" data-k="entregue" aria-pressed="${!!a.entregue_em}" aria-label="Boleto entregue para ${esc(titulo(a.nome))}" title="Entregue"></button></div>`;
  const filtrados = () => {
    const t = $('#rt').value, q = norm($('#rq').value);
    return d.alunos.filter((a) => (!t || a.turma_rotulo === t) && (!q || norm(a.nome + ' ' + a.responsavel).includes(q))
      && (!situacao || (situacao === 'entregue' ? a.entregue_em : !a.entregue_em)));
  };
  // Turma fechada não desenha as linhas (com 535 alunos a tela continua leve); abre sozinha quando se busca um nome
  const desenhar = () => {
    const lista = filtrados(), grupos = porTurma(lista), abrirTudo = !!$('#rq').value.trim() || !!$('#rt').value;
    $('#bTurmas').innerHTML = grupos.length ? grupos.map((g) => {
      const todos = d.alunos.filter((a) => a.turma_rotulo === g.turma), ok = todos.filter((a) => a.entregue_em).length, aberta = abrirTudo || turmasAbertas.has(g.turma);
      return `<details class="turma-bloco" data-t="${esc(g.turma)}" ${aberta ? 'open' : ''}><summary><b>${esc(g.turma)}</b>
        <span class="barra" role="img" aria-label="${ok} de ${todos.length} entregues"><i class="b-concl" style="width:${pctBarra(ok, todos.length)}%;animation:none"></i></span>
        <span class="mono">${ok}/${todos.length}</span></summary><div class="entregas">${aberta ? g.itens.map(linhaAluno).join('') : ''}</div></details>`;
    }).join('') : `<div class="cartao"><p class="vazio">Ninguém com esses filtros.</p></div>`;
    numeros();
  };
  $('#bTurmas').addEventListener('toggle', (e) => {
    const det = e.target; if (!det.matches || !det.matches('details.turma-bloco')) return;
    if (det.open) { turmasAbertas.add(det.dataset.t); const box = $('.entregas', det); if (!box.children.length) box.innerHTML = filtrados().filter((a) => a.turma_rotulo === det.dataset.t).map(linhaAluno).join(''); }
    else turmasAbertas.delete(det.dataset.t);
  }, true);
  const salvar = tentar(async (el) => {
    const aid = +el.closest('.entrega').dataset.a, a = d.alunos.find((x) => x.aluno_id === aid);
    const corpo = { entregue: !!a.entregue_em, recebido_por: a.recebido_por, canal: a.canal, obs: a.obs };
    corpo[el.dataset.k] = el.classList.contains('liga') ? el.getAttribute('aria-pressed') !== 'true' : el.value;
    if (el.classList.contains('liga')) el.setAttribute('aria-pressed', String(corpo.entregue));
    const r = await api('PUT', `/api/remessas/${remessaEscolhida}/entregas/${aid}`, corpo);
    Object.assign(a, { entregue_em: r.entregue_em, recebido_por: corpo.recebido_por, canal: corpo.canal, obs: corpo.obs });
    toast(el.dataset.k === 'entregue' ? (corpo.entregue ? 'Entregue' : 'Entrega desfeita') : 'Salvo');
    if (el.dataset.k === 'entregue') await entregaMudou(el.closest('.entrega'), a);
  });
  // Entrega marcada: só a linha, a barra da turma e os números mudam — a lista não é redesenhada (nada pisca,
  // a turma continua aberta onde estava). Com o filtro "Falta entregar"/"Entregues", a linha encolhe e sai.
  const entregaMudou = async (linha, a) => {
    $('small', linha).innerHTML = `Resp.: ${esc(titulo(a.responsavel))}${a.entregue_em ? ' · entregue em ' + dataBR(a.entregue_em) : ''}`;
    const det = linha.closest('details.turma-bloco'), todos = d.alunos.filter((x) => x.turma_rotulo === a.turma_rotulo), ok = todos.filter((x) => x.entregue_em).length;
    if (det) {
      $('.barra i', det).style.width = pctBarra(ok, todos.length) + '%';
      $('.barra', det).setAttribute('aria-label', `${ok} de ${todos.length} entregues`);
      $('summary .mono', det).textContent = `${ok}/${todos.length}`;
    }
    numeros();
    if (situacao) {
      await new Promise((r) => setTimeout(r, 250)); // deixa o interruptor terminar de andar
      await sumirLinha(linha);
      desenhar();
    }
  };
  $('#bTurmas').addEventListener('click', (e) => { const b = e.target.closest('.liga[data-k]'); if (b) salvar(b); });
  $('#bTurmas').addEventListener('change', (e) => { if (e.target.matches('.entrega [data-k]:not(.liga)')) salvar(e.target); });
  $('#rq').oninput = desenhar; $('#rt').onchange = desenhar;
  $('#rs').onclick = (e) => { const b = e.target.closest('[data-s]'); if (!b) return; situacao = b.dataset.s; $$('#rs button').forEach((x) => x.setAttribute('aria-pressed', x === b)); desenhar(); };
  $('#rimp').onclick = () => abrirDoc({ tipo: 'protocolo_boletos', remessa: remessaEscolhida, turma: $('#rt').value });
  if ($('#rdel')) $('#rdel').onclick = tentar(async () => {
    if (!(await confirmar(`Excluir a remessa "${d.remessa.nome}" e o registro de entregas dela?`, 'Excluir'))) return;
    await api('DELETE', '/api/remessas/' + remessaEscolhida); remessaEscolhida = null; toast('Remessa excluída'); rotear();
  });
  desenhar();
};

// ═════════════ ATIVIDADES EXTRAS ═════════════
TELAS.extras = async (c, aba = 'inscricoes') => {
  const ano = new Date().getFullYear();
  const ABAS = { inscricoes: 'Inscrições', eventos: 'Ingressos e eventos', atividades: 'Atividades e valores' };
  c.innerHTML = cabecalho('Atividades extras', `Ballet, judô, futsal, recreação e apresentações · ${ano}`, `<button class="btn ama" id="novaInsc">${icone('mais')}Nova inscrição</button>`)
    + `<div class="abas" role="tablist">${Object.entries(ABAS).map(([k, v]) => `<button role="tab" data-aba="${k}" class="${aba === k ? 'on' : ''}" aria-selected="${aba === k}">${v}</button>`).join('')}</div><div id="aba"></div>`;
  $$('[data-aba]', c).forEach((b) => (b.onclick = () => (location.hash = '#/extras/' + b.dataset.aba)));
  $('#novaInsc').onclick = () => formInscricao();
  const el = $('#aba');

  if (aba === 'inscricoes') {
    const [ativs, lista] = await Promise.all([api('GET', '/api/atividades?ano=' + ano), api('GET', '/api/inscricoes?ano=' + ano)]);
    let sel = null;
    // Um cartão por atividade: vagas, dias, horário, valor e professor. Clicar filtra a lista de inscrições.
    el.innerHTML = `<div class="atividades">${ativs.filter((t) => t.ativo).map((t) => { const cheia = t.vagas && t.inscritos >= t.vagas;
      return `<button class="atividade" data-at="${t.id}" aria-pressed="false"><div class="topo-at"><h3>${esc(t.nome)}</h3>
          ${t.vagas ? `<span class="tag ${cheia ? 't-vencida' : 't-concluida'}">${cheia ? 'lotada' : plural(t.vagas - t.inscritos, 'vaga', 'vagas')}</span>` : `<span class="tag t-sem_prazo">${plural(t.inscritos, 'inscrito', 'inscritos')}</span>`}</div>
        <div class="info-at">${esc(t.publico || '')}${t.dias ? ' · ' + esc(t.dias) : ''}${t.horario ? ' · <span class="mono">' + esc(t.horario) + '</span>' : ''}</div>
        ${t.vagas ? `<span class="barra" role="img" aria-label="${t.inscritos} de ${t.vagas} vagas"><i style="width:${pctBarra(t.inscritos, t.vagas)}%;background:${cheia ? 'var(--vermelho)' : 'var(--azul-2)'}"></i></span>` : ''}
        <div class="pe-at"><span class="preco">${t.valor == null || t.valor === '' ? '<small>valor a definir</small>' : moedaBR(t.valor) + '<small> /mês</small>'}</span><small class="info-at">Prof. ${esc(t.professor || '—')}</small></div></button>`; }).join('')}</div>
      <div class="cartao"><div class="barra-filtros"><h2 style="margin:0;flex:1" id="tl">Todas as inscrições</h2>
        <div class="seg" id="fs" role="group" aria-label="Situação">${[['ativa', 'Ativas'], ['cancelada', 'Canceladas'], ['', 'Todas']].map(([k, n]) => `<button data-s="${k}" aria-pressed="${k === 'ativa'}">${n}</button>`).join('')}</div>
        <button class="btn peq" id="chamada" hidden>${icone('documentos')}Lista de chamada</button><button class="btn peq" id="todas" hidden>Todas as atividades</button></div>
        <div class="tabela-wrap"><table><thead><tr><th>Aluno</th><th>Turma</th><th>Atividade</th><th>Inscrição</th><th>Parcelas</th><th>Situação</th><th></th></tr></thead><tbody id="tb"></tbody></table></div></div>`;
    let fs = 'ativa';
    const desenhar = () => {
      const f = lista.filter((i) => (!sel || i.atividade_id === sel) && (!fs || i.status === fs));
      $('#tl').textContent = sel ? ativs.find((t) => t.id === sel).nome : 'Todas as inscrições';
      $('#chamada').hidden = !sel; $('#todas').hidden = !sel;
      $$('.atividade', el).forEach((b) => { const on = +b.dataset.at === sel; b.classList.toggle('escolhida', on); b.setAttribute('aria-pressed', on); });
      $('#tb').innerHTML = f.length ? f.map((i) => `<tr><td><a href="#/aluno/${i.aluno_id}"><b>${esc(titulo(i.aluno))}</b></a>${i.filho_funcionario ? ' <span class="tag t-func">func.</span>' : ''}</td>
        <td>${esc(i.turma_rotulo)}</td><td>${esc(i.atividade)}</td><td class="mono">${dataBR(i.data_inscricao)}</td>
        <td><span class="mono">${i.parcelas || '?'}×</span> ${moedaBR(i.valor_parcela)}${i.desconto_folha ? ' <span class="dado">(folha)</span>' : ''}</td>
        <td>${i.status === 'ativa' ? '<span class="tag t-concluida">ativa</span>' : `<span class="tag t-nao_renova">cancelada</span><br><small class="dado">${dataBR(i.data_cancelamento)}</small>`}</td>
        <td class="acoes">${i.status === 'ativa' ? `<button class="btn peq" data-contrato="${i.id}">Contrato</button><button class="btn peq perigo" data-cancelar="${i.id}">Cancelar</button>`
          : `<button class="btn peq" data-reativar="${i.id}">Reativar</button>`}</td></tr>`).join('') : '<tr><td colspan="7" class="vazio">Nenhuma inscrição com esse filtro.</td></tr>';
      $$('[data-contrato]', el).forEach((b) => (b.onclick = tentar(async () => {
        const i = lista.find((x) => x.id === +b.dataset.contrato);
        await baixar(`/api/inscricoes/${i.id}/contrato`, `CONTRATO ${i.atividade.toUpperCase()} ${i.ano} - ${titulo(i.aluno)}.xlsx`); toast('Contrato gerado! Abra no Excel, confira e imprima.');
      })));
      $$('[data-cancelar]', el).forEach((b) => (b.onclick = () => cancelarInscricao(lista.find((x) => x.id === +b.dataset.cancelar))));
      $$('[data-reativar]', el).forEach((b) => (b.onclick = tentar(async () => { await api('POST', `/api/inscricoes/${b.dataset.reativar}/reativar`); toast('Reativada'); rotear(); })));
    };
    $$('.atividade', el).forEach((b) => (b.onclick = () => { sel = sel === +b.dataset.at ? null : +b.dataset.at; desenhar(); }));
    $('#todas').onclick = () => { sel = null; desenhar(); };
    $('#fs').onclick = (e) => { const b = e.target.closest('[data-s]'); if (!b) return; fs = b.dataset.s; $$('#fs button').forEach((x) => x.setAttribute('aria-pressed', x === b)); desenhar(); };
    $('#chamada').onclick = () => abrirDoc({ tipo: 'chamada', atividade: sel, ano });
    desenhar();
  }

  if (aba === 'eventos') {
    const evs = await api('GET', '/api/eventos');
    el.innerHTML = `<div class="acoes" style="margin-bottom:14px"><button class="btn" id="novoEv">${icone('mais')}Novo evento</button></div>
      ${evs.length ? `<div class="atividades">${evs.map((e) => `<button class="atividade" data-ev="${e.id}"><div class="topo-at"><h3>${esc(e.nome)}</h3>
          ${e.data ? `<span class="tag t-novo">${dataBR(e.data)}</span>` : ''}</div>
        <div class="pe-at"><span class="preco">${e.total}<small> ingressos</small></span><small class="info-at">${plural(e.retirados, 'família retirou', 'famílias retiraram')}</small></div>
        ${e.limite_por_aluno ? `<div class="info-at">até ${e.limite_por_aluno} por aluno</div>` : ''}</button>`).join('')}</div>`
        : `<div class="cartao">${vazio('extras', 'Nenhum evento ainda', 'Crie a apresentação do balé ou a festa junina para controlar os ingressos de cada família.')}</div>`}
      <div id="evDet"></div>`;
    $('#novoEv').onclick = () => modal('Novo evento', `<form id="fe"><div class="campos"><div class="campo"><label for="en">Nome *</label><input id="en" required placeholder="Apresentação de Balé ${ano}"></div>
      <div class="campo"><label for="ed">Data</label><input type="date" id="ed"></div><div class="campo"><label for="el">Limite de ingressos por aluno</label><input type="number" id="el" min="1"></div></div>
      <div class="rodape"><button type="button" class="btn" data-fechar>Cancelar</button><button class="btn pri">Criar</button></div></form>`,
    { onAbrir: (m, fechar) => { $('#fe', m).onsubmit = tentar(async (ev) => { ev.preventDefault(); await api('POST', '/api/eventos', { nome: $('#en', m).value, data: $('#ed', m).value, limite_por_aluno: $('#el', m).value }); fechar(); rotear(); }); } });
    const abrirEvento = (id) => { $$('[data-ev]', el).forEach((b) => b.classList.toggle('escolhida', +b.dataset.ev === id)); return ingressosEvento(id, 'ballet'); };
    $$('[data-ev]', el).forEach((k) => (k.onclick = tentar(() => abrirEvento(+k.dataset.ev))));
    if (evs[0]) await abrirEvento(evs[0].id);
  }

  if (aba === 'atividades') {
    const ativs = await api('GET', '/api/atividades?ano=' + ano);
    const adm = EU.perfil === 'admin';
    el.innerHTML = `<div class="cartao"><p class="dado" style="margin:0 0 12px">${adm ? 'Edite direto na tabela: salva sozinho ao sair do campo.' : 'Só a administração altera valores e horários.'} Estes dados vão para o contrato da atividade.</p>
      <div class="tabela-wrap"><table><thead><tr><th>Atividade</th><th>Público</th><th>Dias</th><th>Horário</th><th>Valor/mês</th><th>Professor(a)</th><th>Vagas</th><th>Ativa</th></tr></thead><tbody>
      ${ativs.map((t) => `<tr data-t="${t.id}">${['nome', 'publico', 'dias', 'horario'].map((k) => `<td><input data-k="${k}" value="${esc(t[k] || '')}" ${adm ? '' : 'disabled'} style="width:100%" aria-label="${k}"></td>`).join('')}
        <td><input type="number" step="0.01" data-k="valor" value="${t.valor ?? ''}" ${adm ? '' : 'disabled'} style="width:96px" aria-label="Valor por mês"></td><td><input data-k="professor" value="${esc(t.professor || '')}" ${adm ? '' : 'disabled'} style="width:120px" aria-label="Professor"></td>
        <td><input type="number" data-k="vagas" value="${t.vagas ?? ''}" ${adm ? '' : 'disabled'} style="width:72px" aria-label="Vagas"></td>
        <td><input type="checkbox" class="interruptor" data-k="ativo" ${t.ativo ? 'checked' : ''} ${adm ? '' : 'disabled'} aria-label="Atividade ativa"></td></tr>`).join('')}
      </tbody></table></div>${adm ? `<div class="acoes" style="margin-top:12px"><button class="btn" id="novaAt">${icone('mais')}Nova atividade</button></div>` : ''}</div>`;
    $$('[data-t] [data-k]', el).forEach((i) => (i.onchange = tentar(async () => {
      await api('PUT', '/api/atividades/' + i.closest('tr').dataset.t, { [i.dataset.k]: i.type === 'checkbox' ? i.checked : i.value }); toast('Salvo');
    })));
    if ($('#novaAt')) $('#novaAt').onclick = tentar(async () => { await api('POST', '/api/atividades', { nome: 'Nova atividade' }); rotear(); });
  }
};

// Ingressos de um evento: quantidade por aluno, quem já retirou e a lista para assinatura
async function ingressosEvento(id, filtro) {
  const d = await api('GET', `/api/eventos/${id}/ingressos?filtro=${encodeURIComponent(filtro)}`);
  const box = $('#evDet');
  if (!box) return;
  box.innerHTML = `<div class="cartao" style="margin-top:4px"><div class="barra-filtros"><h2 style="margin:0;flex:1">${esc(d.evento.nome)}</h2>
    <select id="evF" aria-label="Quem aparece"><option value="ballet" ${filtro === 'ballet' ? 'selected' : ''}>Alunos do ballet</option><option value="extras" ${filtro === 'extras' ? 'selected' : ''}>Todas as atividades extras</option><option value="todos" ${filtro === 'todos' ? 'selected' : ''}>Todos os alunos</option></select>
    <label class="procura" style="flex:0 1 240px"><input id="evQ" placeholder="Filtrar nome" aria-label="Filtrar nome"></label><button class="btn peq" id="evImp">${icone('documentos')}Lista para assinatura</button></div>
    <div class="tabela-wrap"><table><thead><tr><th>Aluno</th><th>Turma</th><th>Ingressos</th><th>Retirou?</th></tr></thead><tbody id="evTb"></tbody></table></div></div>`;
  const desenhar = () => {
    const q = norm($('#evQ').value);
    $('#evTb').innerHTML = d.alunos.filter((a) => !q || norm(a.nome).includes(q)).map((a) => `<tr><td>${esc(titulo(a.nome))}</td><td>${esc(a.turma_rotulo)}</td>
      <td><input type="number" min="0" ${d.evento.limite_por_aluno ? `max="${d.evento.limite_por_aluno}"` : ''} value="${a.quantidade || 0}" data-q="${a.id}" style="width:74px" aria-label="Ingressos de ${esc(titulo(a.nome))}"></td>
      <td><label class="chk"><input type="checkbox" class="interruptor" data-r="${a.id}" ${a.retirado_em ? 'checked' : ''} aria-label="Retirou"> <span class="mono">${a.retirado_em ? dataBR(a.retirado_em) : ''}</span></label></td></tr>`).join('')
      || '<tr><td colspan="4" class="vazio">Ninguém nesta lista.</td></tr>';
    const salvar = (aid, corpo) => tentar(async () => {
      const al = d.alunos.find((x) => x.id === aid);
      await api('PUT', `/api/eventos/${id}/ingressos/${aid}`, { quantidade: al.quantidade || 0, ...corpo });
      Object.assign(al, corpo, corpo.retirado !== undefined ? { retirado_em: corpo.retirado ? hojeIso() : null } : {});
      toast('Salvo');
    })();
    $$('[data-q]', box).forEach((i) => (i.onchange = () => salvar(+i.dataset.q, { quantidade: +i.value })));
    $$('[data-r]', box).forEach((i) => (i.onchange = () => salvar(+i.dataset.r, { retirado: i.checked })));
  };
  $('#evF').onchange = tentar(() => ingressosEvento(id, $('#evF').value));
  $('#evQ').oninput = desenhar;
  $('#evImp').onclick = () => abrirDoc({ tipo: 'ingressos', evento: id, filtro: $('#evF').value });
  desenhar();
}

// ═════════════ PORTÃO · SAÍDA ═════════════
TELAS.portao = async (c) => {
  const d = await api('GET', '/api/saida/avisos');
  const avisos = [...d.avisos].sort((a, b) => !!a.conferido_em - !!b.conferido_em || String(a.horario || '99').localeCompare(String(b.horario || '99')));
  c.innerHTML = cabecalho('Portão · Saída', `Quem pode buscar cada aluno e os avisos de hoje, ${dataBR(d.data)}.`,
    `<button class="btn ama" id="novoAviso">${icone('mais')}Aviso de hoje</button><button class="btn" id="impSaida">${icone('documentos')}Lista por turma</button>`)
    + `<label class="portao-busca"><input id="qPortao" placeholder="Quem vai buscar? Nome do aluno, da mãe, do responsável ou matrícula" autocomplete="off" aria-label="Buscar aluno para conferir quem pode buscar"></label>
    <div id="resPortao"><p class="dica-portao">Digite o nome do aluno para ver quem está autorizado a buscar.</p></div>
    <h2 style="margin:26px 0 12px">Avisos de hoje <span class="mono dado">${avisos.filter((v) => !v.conferido_em).length} aguardando · ${avisos.length} no total</span></h2>
    ${avisos.length ? `<div class="saidas" id="saidas">${avisos.map((v) => `<article class="saida ${v.conferido_em ? 'ok' : ''}">
        <div class="saida-topo"><div><h3><a href="#/aluno/${v.aluno_id}">${esc(titulo(v.aluno))}</a></h3>
          <small>${esc(v.turma_rotulo)} · avisou por ${esc(CANAIS_SAIDA[v.canal] || v.canal || '—')}${v.quem_avisou ? ' (' + esc(v.quem_avisou) + ')' : ''}</small></div>
          ${v.horario ? `<span class="hora">${esc(v.horario)}</span>` : ''}</div>
        <div class="quem-busca"><span class="inicial">${esc(iniciais(v.quem))}</span><div><b>${esc(titulo(v.quem))}${v.parentesco ? ` <small>(${esc(v.parentesco)})</small>` : ''}</b>
          <span class="doc">${esc(v.documento || 'sem documento anotado')}</span>${v.obs ? `<small>${esc(v.obs)}</small>` : ''}</div></div>
        ${v.conferido_em ? `<div class="liberado"><span>✓ Liberado${v.conferido_por ? ' por ' + esc(nomePessoa(v.conferido_por)) : ''}${v.conferido_em.length > 10 ? ' às ' + esc(new Date(v.conferido_em).toTimeString().slice(0, 5)) : ''}</span>
            <button data-reabrir="${v.id}">Desfazer</button></div>`
          : `<button class="segurar" data-liberar="${v.id}" aria-label="Segure para liberar a saída de ${esc(titulo(v.aluno))} com ${esc(titulo(v.quem))}">${icone('alvo')}Segure para liberar a saída
            <span class="enche" aria-hidden="true">${icone('ok')}Liberando ${esc(titulo(v.aluno).split(' ')[0])}…</span></button>`}
        <div class="rodape-saida"><span>Confira o documento antes de liberar.</span><button data-delv="${v.id}">Excluir aviso</button></div></article>`).join('')}</div>`
      : `<div class="cartao">${vazio('portao', 'Nenhum aviso para hoje', 'Quando a família avisar que hoje quem busca é outra pessoa, registre aqui: na saída, o portão confere em segundos.',
        '<div class="acoes" style="justify-content:center"><button class="btn pri" id="vazioAviso">Registrar aviso de hoje</button></div>')}</div>`}
    <p class="dica" style="margin-top:18px">Autorização <b>só por telefone não vale</b> (regra do termo de saída): peça por WhatsApp, bilhete na agenda ou pessoalmente.</p>`;

  let espera;
  $('#qPortao').oninput = () => {
    clearTimeout(espera);
    const q = $('#qPortao').value.trim();
    if (q.length < 2) { $('#resPortao').innerHTML = '<p class="dica-portao">Digite o nome do aluno para ver quem está autorizado a buscar.</p>'; return; }
    espera = setTimeout(tentar(async () => {
      const r = await api('GET', '/api/saida/portao?q=' + encodeURIComponent(q));
      const cx = $('#resPortao');
      cx.innerHTML = r.achados.length ? r.achados.map(cartaoPortao).join('') : '<div class="achado"><p class="vazio" style="padding:10px">Nenhum aluno com esse nome.</p></div>';
      $$('[data-aviso]', cx).forEach((b) => (b.onclick = () => { const f = r.achados.find((x) => x.aluno.id === +b.dataset.aviso); formAviso({ id: f.aluno.id, nome: f.aluno.nome }); }));
    }), 300);
  };
  $('#novoAviso').onclick = () => formAviso();
  if ($('#vazioAviso')) $('#vazioAviso').onclick = () => formAviso();
  $('#impSaida').onclick = () => abrirDoc({ tipo: 'saida_turma' });

  const liberar = tentar(async (id) => {
    await api('PUT', '/api/saida/avisos/' + id, { conferido: true });
    toast('Saída liberada e registrada'); rotear();
  });
  const grade = $('#saidas');
  if (grade) {
    // Segurar: começa no aperto; soltou antes de encher, volta rápido e nada acontece. No teclado, segurar Espaço ou Enter.
    grade.addEventListener('pointerdown', (e) => { const b = e.target.closest('[data-liberar]'); if (!b) return; b.setPointerCapture(e.pointerId); b.classList.add('segurando'); });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((ev) => grade.addEventListener(ev, (e) => { const b = e.target.closest && e.target.closest('[data-liberar]'); if (b) b.classList.remove('segurando'); }));
    grade.addEventListener('keydown', (e) => { const b = e.target.closest('[data-liberar]'); if (b && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); if (!e.repeat) b.classList.add('segurando'); } });
    grade.addEventListener('keyup', (e) => { const b = e.target.closest('[data-liberar]'); if (b && (e.key === ' ' || e.key === 'Enter')) b.classList.remove('segurando'); });
    grade.addEventListener('transitionend', (e) => {
      if (e.propertyName !== 'clip-path' || !e.target.classList.contains('enche')) return;
      const b = e.target.closest('[data-liberar]');
      if (b && b.classList.contains('segurando')) { b.classList.remove('segurando'); b.disabled = true; liberar(b.dataset.liberar); }
    });
    grade.addEventListener('click', tentar(async (e) => {
      const r = e.target.closest('[data-reabrir]');
      if (r) { await api('PUT', '/api/saida/avisos/' + r.dataset.reabrir, { conferido: false }); toast('Saída voltou para "aguardando"'); rotear(); return; }
      const x = e.target.closest('[data-delv]');
      if (x) { if (!(await confirmar('Excluir este aviso?', 'Excluir'))) return; await api('DELETE', '/api/saida/avisos/' + x.dataset.delv); toast('Aviso excluído'); rotear(); }
    }));
  }
};

// O aluno achado na procura do portão: aviso de hoje, quem pode buscar e se sai sozinho
function cartaoPortao(f) {
  const a = f.aluno;
  return `<div class="achado">
    ${f.avisos.length ? `<div class="faixa-demo" style="margin:0">${icone('portao')}<span><b>Aviso de hoje:</b> quem busca é
      ${f.avisos.map((v) => `<b>${esc(titulo(v.quem))}</b>${v.parentesco ? ` (${esc(v.parentesco)})` : ''}${v.documento ? ` · ${esc(v.documento)}` : ''}${v.conferido_em ? ' <span class="tag t-concluida">já liberado</span>' : ''}`).join(' · ')}</span></div>` : ''}
    <div class="achado-topo"><div><h2>${esc(titulo(a.nome))}</h2>
      <p>${esc(a.turma_rotulo)}${a.turno ? ` · ${a.turno === 'M' ? 'manhã' : 'tarde'}` : ''} · Mat. <span class="mono">${esc(a.mat || '—')}</span></p></div>
      <div class="acoes"><span class="tag ${f.sai_sozinho ? 't-concluida' : 't-sem_prazo'}">${f.sai_sozinho ? 'pode sair sozinho' : 'não sai sozinho'}</span>
        <button class="btn peq" data-aviso="${a.id}">${icone('mais')}Aviso de hoje</button><a class="btn peq" href="#/aluno/${a.id}">Abrir ficha</a></div></div>
    ${f.transporte ? `<p class="dado" style="margin:0">Transporte: <b style="display:inline">${esc(f.transporte)}</b></p>` : ''}
    <div><h3>Pode buscar</h3>
      ${f.autorizados.length ? `<div class="lista">${f.autorizados.map((x) => `<div class="linha" style="grid-template-columns:auto minmax(0,1fr)"><span class="inicial redonda">${esc(iniciais(x.nome))}</span>
        <span><b>${esc(titulo(x.nome))}</b><small>${esc(x.parentesco || 'autorizado')}${x.documento ? ' · <span class="mono">' + esc(x.documento) + '</span>' : ''}${x.telefone ? ' · ' + esc(x.telefone) : ''}</small></span></div>`).join('')}</div>`
        : `<p class="dado">Ninguém cadastrado. ${f.sai_sozinho ? 'O aluno tem autorização para sair sozinho.' : 'Só o responsável legal pode buscar.'}</p>`}</div>
    <p class="dado" style="margin:0">Responsáveis: ${esc(titulo(a.nome_resp || a.nome_mae || a.nome_pai || '—'))}${f.termo_em ? ` · termo assinado em ${dataBR(f.termo_em)}` : ''}</p>
    ${f.obs ? `<p class="dica" style="margin:0">${esc(f.obs)}</p>` : ''}</div>`;
}

// ═════════════ ATENDIMENTOS ═════════════
TELAS.atendimentos = async (c) => {
  const d = await api('GET', '/api/atendimentos');
  const hoje = hojeIso(), doDia = d.atendimentos.filter((a) => a.data === hoje);
  let canal = '';
  const icCanal = (k) => { const v = CANAL_VISUAL[k] || ['atendimentos', 'var(--superficie-2)', 'var(--texto-2)']; return `<span class="ic-canal" style="background:${v[1]};color:${v[2]}">${icone(v[0])}</span>`; };
  c.innerHTML = cabecalho('Atendimentos', 'Quem procurou a secretaria, por onde, o assunto e se ficou resolvido.',
    `<button class="btn" id="imp">${icone('documentos')}Imprimir</button><button class="btn ama" id="novo">${icone('mais')}Registrar atendimento</button>`)
    + `<div class="grade g4 numeros">
      <div class="cartao kpi destaque"><div class="rot">Hoje</div><div class="val">${doDia.length}</div><div class="det">${plural(doDia.filter((a) => !a.resolvido).length, 'em aberto', 'em aberto')}</div></div>
      ${Object.entries(d.canais).map(([k, v]) => `<button class="cartao kpi" data-filtro="${k}" aria-pressed="false"><div class="rot">${icCanal(k)}${esc(v)}</div>
        <div class="val">${d.atendimentos.filter((a) => a.canal === k).length}</div><div class="det">últimos registros · clique para filtrar</div></button>`).join('')}</div>
    <div class="barra-filtros"><label class="procura"><input id="fq" placeholder="Buscar aluno, pessoa ou assunto" aria-label="Buscar aluno, pessoa ou assunto"></label>
      <div class="seg" id="fc" role="group" aria-label="Canal"><button data-c="" aria-pressed="true">Todos</button>${Object.entries(d.canais).map(([k, v]) => `<button data-c="${k}" aria-pressed="false">${esc(v)}</button>`).join('')}</div>
      <label class="chk"><input type="checkbox" class="interruptor" id="fp"> Só em aberto</label>
      <input type="date" id="fd" title="A partir de" aria-label="A partir de"></div>
    <div class="cartao" style="padding:0;overflow:hidden"><div class="tabela-wrap"><table><thead><tr><th>Quando</th><th>Canal</th><th>Aluno / pessoa</th><th>Assunto</th><th>Situação</th><th>Atendeu</th><th></th></tr></thead><tbody id="tb"></tbody></table></div></div>`;
  const desenhar = () => {
    const fp = $('#fp').checked, fd = $('#fd').value, q = norm($('#fq').value);
    $$('[data-filtro]', c).forEach((b) => { const on = b.dataset.filtro === canal; b.classList.toggle('escolhido', on); b.setAttribute('aria-pressed', on); });
    $$('#fc button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.c === canal));
    const f = d.atendimentos.filter((a) => (!canal || a.canal === canal) && (!fp || !a.resolvido) && (!fd || a.data >= fd)
      && (!q || norm([a.aluno, a.pessoa, a.assunto, a.categoria, a.detalhe].join(' ')).includes(q)));
    $('#tb').innerHTML = f.length ? f.map((a) => `<tr data-i="${a.id}"><td class="mono" style="white-space:nowrap">${dataBR(a.data)}<br><span class="dado">${esc(a.hora || '')}</span></td>
      <td><span class="tag" style="background:${(CANAL_VISUAL[a.canal] || [])[1] || 'var(--superficie-2)'};color:${(CANAL_VISUAL[a.canal] || [])[2] || 'var(--texto-2)'}">${esc(d.canais[a.canal] || a.canal)}</span></td>
      <td>${a.aluno_id ? `<a href="#/aluno/${a.aluno_id}"><b>${esc(titulo(a.aluno))}</b></a><br><small class="dado">${esc(a.turma_rotulo)} · ${esc(titulo(a.pessoa || ''))}</small>`
        : `<b>${esc(titulo(a.pessoa || '—'))}</b><br><small class="dado">${esc(a.telefone || '')}</small>`}</td>
      <td><b style="font-weight:600">${esc(a.assunto)}</b>${a.categoria ? `<br><small class="dado">${esc(a.categoria)}</small>` : ''}</td>
      <td>${a.resolvido ? '<span class="tag t-concluida">resolvido</span>' : `<span class="tag t-vencendo">em aberto</span>${a.encaminhado ? `<br><small class="dado">com ${esc(a.encaminhado)}</small>` : ''}`}</td>
      <td class="dado">${esc(nomePessoa(a.usuario))}</td>
      <td class="acoes">${a.resolvido ? '' : `<button class="btn peq" data-ok="${a.id}">Resolvido</button>`}<button class="btn peq" data-ed="${a.id}">Ver</button></td></tr>`).join('')
      : `<tr><td colspan="7">${vazio('atendimentos', 'Nenhum atendimento por aqui', 'Cada vez que alguém procurar a secretaria — pessoalmente, por telefone ou no WhatsApp — registre aqui. Em um mês isso vira o retrato do que mais consome o tempo de vocês.',
        '<div class="acoes" style="justify-content:center"><button class="btn pri" id="vazioAt">Registrar o primeiro</button></div>')}</td></tr>`;
    $$('[data-ok]', c).forEach((b) => (b.onclick = tentar(async () => { await api('PUT', '/api/atendimentos/' + b.dataset.ok, { resolvido: true }); toast('Marcado como resolvido'); rotear(); })));
    $$('[data-ed]', c).forEach((b) => (b.onclick = () => formAtendimento(d, d.atendimentos.find((x) => x.id === +b.dataset.ed))));
    if ($('#vazioAt')) $('#vazioAt').onclick = () => formAtendimento(d);
  };
  $('#fc').onclick = (e) => { const b = e.target.closest('[data-c]'); if (!b) return; canal = b.dataset.c; desenhar(); };
  $$('[data-filtro]', c).forEach((b) => (b.onclick = () => { canal = canal === b.dataset.filtro ? '' : b.dataset.filtro; desenhar(); }));
  ['fp', 'fd', 'fq'].forEach((id) => ($('#' + id).oninput = desenhar));
  $('#fp').onchange = desenhar;
  $('#novo').onclick = () => formAtendimento(d);
  $('#imp').onclick = () => window.print();
  desenhar();
};

// ═════════════ CALENDÁRIO ═════════════
TELAS.calendario = async (c, ano) => {
  ano = +ano || new Date().getFullYear();
  const d = await api('GET', '/api/calendario?ano=' + ano);
  const agora = new Date(), mesAtual = agora.getMonth() + 1, anoAtual = agora.getFullYear();
  const porMes = {};
  d.itens.forEach((i) => (porMes[i.mes] ??= []).push(i));
  const adm = EU.perfil === 'admin';
  const itemHtml = (i) => `<div class="lembrete ${i.feito ? 'feito' : ''}" data-item="${i.id}"><button class="marcar" data-i="${i.id}" aria-pressed="${!!i.feito}" aria-label="Feito: ${esc(i.titulo)}">${CHECK_SVG}</button>
    <span><b>${esc(i.titulo)}</b>${i.atrasado && !i.feito ? ' <span class="tag t-vencida">atrasado</span>' : ''}
      <small>${i.dia ? 'até ' + dataBR(i.limite) : 'durante o mês'} · ${esc(nomePessoa(i.responsavel))}${i.categoria ? ' · ' + esc(i.categoria) : ''}${i.feito && i.feito_por ? ' · feito por ' + esc(nomePessoa(i.feito_por)) : ''}</small>
      ${i.detalhe ? `<small>${esc(i.detalhe)}</small>` : ''}</span>
    ${adm ? `<button class="editar" data-ed="${i.id}" aria-label="Editar ${esc(i.titulo)}" title="Editar">${icone('rematricula')}</button>` : '<span></span>'}</div>`;
  const resumoHtml = () => `<div class="cartao kpi destaque"><div class="rot">Lembretes de ${ano}</div><div class="val">${d.resumo.feitos}<small>/ ${d.resumo.total}</small></div><div class="det">concluídos neste ano</div></div>
    <div class="cartao kpi ${d.resumo.atrasados ? 'alerta' : ''}"><div class="rot">Atrasados</div><div class="val">${d.resumo.atrasados}</div><div class="det">passaram da data e não foram marcados</div></div>
    <div class="cartao kpi"><div class="rot">Deste mês</div><div class="val">${d.resumo.do_mes}</div><div class="det">${esc(d.meses[mesAtual - 1])} ainda em aberto</div></div>`;
  c.innerHTML = cabecalho('Calendário', 'O que acontece em cada época do ano. Marque conforme for fazendo: a marcação vale só para este ano.',
    `<span class="ano-nav"><button class="btn" id="ant" aria-label="Ano anterior">←</button><b>${ano}</b><button class="btn" id="prox" aria-label="Próximo ano">→</button></span>
     ${adm ? `<button class="btn ama" id="novo">${icone('mais')}Lembrete</button>` : ''}`)
    + `<div class="grade g4 numeros" id="calNum">${resumoHtml()}</div>
    <div class="meses">${d.meses.map((m, i) => { const mes = i + 1, itens = porMes[mes] || [];
      const passado = ano < anoAtual || (ano === anoAtual && mes < mesAtual), atual = ano === anoAtual && mes === mesAtual;
      return `<section class="mes ${atual ? 'atual' : ''} ${passado ? 'passado' : ''}" aria-label="${esc(m)}"><h2>${esc(m)}${atual ? ' <span class="tag t-novo">mês atual</span>' : ''}
          <small data-conta="${mes}">${itens.filter((x) => x.feito).length}/${itens.length}</small></h2>
        ${itens.length ? itens.map(itemHtml).join('') : '<p class="nada-mes">Nada marcado para este mês.</p>'}</section>`; }).join('')}</div>`;
  $('#ant').onclick = () => (location.hash = '#/calendario/' + (ano - 1));
  $('#prox').onclick = () => (location.hash = '#/calendario/' + (ano + 1));
  // Marcar feito sem recarregar a tela (a rolagem fica onde está). Um ouvinte só para todos os itens.
  const marcar = tentar(async (b) => {
    const it = d.itens.find((x) => x.id === +b.dataset.i), feito = b.getAttribute('aria-pressed') !== 'true';
    b.setAttribute('aria-pressed', String(feito)); b.disabled = true;
    try { await api('PUT', `/api/calendario/${it.id}/feito`, { feito, ano }); } catch (e) { b.setAttribute('aria-pressed', String(!feito)); b.disabled = false; throw e; }
    const eraAtrasado = it.atrasado && !it.feito;
    it.feito = feito; it.feito_por = feito ? EU.login : null;
    d.resumo.feitos += feito ? 1 : -1;
    if (eraAtrasado && feito) d.resumo.atrasados--; else if (!feito && it.atrasado) d.resumo.atrasados++;
    if (it.mes === mesAtual && ano === anoAtual) d.resumo.do_mes += feito ? -1 : 1;
    setTimeout(() => { // deixa o ✓ terminar de se desenhar
      const linha = $(`[data-item="${it.id}"]`, c); if (linha) linha.outerHTML = itemHtml(it);
      $(`[data-conta="${it.mes}"]`, c).textContent = `${(porMes[it.mes] || []).filter((x) => x.feito).length}/${(porMes[it.mes] || []).length}`;
      $('#calNum').innerHTML = resumoHtml();
    }, 280);
    toast(feito ? 'Concluído' : 'Reaberto');
  });
  // O ouvinte fica na grade dos meses (recriada a cada visita), nunca no #conteudo: lá ele se somaria a cada vez que a tela abre
  $('.meses', c).addEventListener('click', (e) => {
    const b = e.target.closest('.meses [data-i]'); if (b) return marcar(b);
    const ed = e.target.closest('.meses [data-ed]'); if (ed) formCalendario(d, d.itens.find((x) => x.id === +ed.dataset.ed));
  });
  if ($('#novo')) $('#novo').onclick = () => formCalendario(d);
};

// ═════════════ RELATÓRIOS ═════════════
// Linha com área (atendimentos por mês) e rosca (por canal), desenhadas com uma escala só
function graficoMeses(porMes) {
  const W = 560, x0 = 34, y0 = 170, max = Math.max(10, Math.ceil(Math.max(...porMes.map((m) => m.n)) / 10) * 10);
  const px = (i) => x0 + (i * (W - x0 - 14)) / (porMes.length - 1), py = (n) => y0 - (n / max) * 150;
  const linha = porMes.map((m, i) => `${i ? 'L' : 'M'}${px(i).toFixed(1)} ${py(m.n).toFixed(1)}`).join(' ');
  const pico = porMes.reduce((a, b, i) => (b.n > porMes[a].n ? i : a), 0);
  const marcas = [0, max / 2, max].map((t) => Math.round(t));
  return `<svg class="grafico" viewBox="0 0 ${W} 200" role="img" aria-label="${porMes.map((m) => `${m.mes}: ${m.n}`).join(', ')}">
    <defs><linearGradient id="gArea" x1="0" x2="0" y1="0" y2="1"><stop offset="0" style="stop-color:var(--azul-2);stop-opacity:.22"/><stop offset="1" style="stop-color:var(--azul-2);stop-opacity:0"/></linearGradient></defs>
    ${marcas.map((t) => `<line class="grade-linha" x1="${x0}" x2="${W - 8}" y1="${py(t)}" y2="${py(t)}"/><text x="${x0 - 8}" y="${py(t) + 4}" text-anchor="end">${t}</text>`).join('')}
    <path d="${linha} L${px(porMes.length - 1)} ${y0} L${x0} ${y0} Z" fill="url(#gArea)"/>
    <path d="${linha}" fill="none" style="stroke:var(--azul-2)" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    ${porMes.map((m, i) => `<text x="${px(i)}" y="${y0 + 20}" text-anchor="middle">${MESES_CURTOS[i] || esc(String(m.mes).slice(0, 3))}</text>`).join('')}
    ${porMes[pico].n ? `<circle cx="${px(pico)}" cy="${py(porMes[pico].n)}" r="5" style="fill:var(--azul-2);stroke:var(--superficie)" stroke-width="2.5"/>
      <text class="valor" x="${px(pico)}" y="${py(porMes[pico].n) - 12}" text-anchor="middle">${porMes[pico].n}</text>` : ''}</svg>`;
}
function graficoRosca(itens) {
  const total = itens.reduce((s, [, n]) => s + n, 0), R = 60, C = 2 * Math.PI * R, cores = ['var(--azul-2)', 'var(--verde)', 'var(--amarelo)', 'var(--roxo)', 'var(--laranja)'];
  if (!total) return '<p class="vazio">Nenhum atendimento neste ano.</p>';
  let ang = 0;
  return `<div class="rosca-caixa"><svg viewBox="0 0 160 160" role="img" aria-label="${itens.map(([r, n]) => `${r}: ${n}`).join(', ')}">
      <circle cx="80" cy="80" r="${R}" fill="none" stroke-width="20" style="stroke:var(--superficie-2)"/>
      ${itens.map(([, n], i) => { const len = (n / total) * C, el = `<circle cx="80" cy="80" r="${R}" fill="none" stroke-width="20" style="stroke:${cores[i % cores.length]}" stroke-dasharray="${Math.max(len - 2, 0)} ${C}" stroke-dashoffset="${-ang}"/>`; ang += len; return el; }).join('')}</svg>
    <div class="rosca-leg">${itens.map(([r, n], i) => `<span><i style="background:${cores[i % cores.length]}"></i>${esc(r)}<b>${Math.round((100 * n) / total)}%</b></span>`).join('')}</div></div>`;
}
TELAS.relatorios = async (c, ano) => {
  if (EU.perfil !== 'admin') { c.innerHTML = '<div class="cartao">Os relatórios reúnem dados de todas as áreas e ficam com a administração.</div>'; return; }
  const d = await api('GET', '/api/relatorios' + (ano ? '?ano=' + ano : ''));
  const r = d.rematricula, a = d.alunos, at = d.atendimentos;
  const rotuloStatus = { pendente: 'Não iniciadas', reservada: 'Em andamento', concluida: 'Concluídas', nao_renova: 'Não renovam', transferido: 'Transferidos' };
  const rotuloBolsa = { inscrito: 'Requerimento entregue', conferido: 'Documentos conferidos', assistente: 'Com a assistente social', visita: 'Visita domiciliar',
    ofertada: 'Ofertada', concedida: 'Concedida', indeferida: 'Indeferida', sem_oferta: 'Sem oferta', desistiu: 'Desistiu' };
  const canais = { balcao: 'Secretaria', telefone: 'Telefone', whatsapp: 'WhatsApp', email: 'E-mail' };
  const kpi = (rot, val, det, cls = '') => `<div class="cartao kpi ${cls}"><div class="rot">${esc(rot)}</div><div class="val">${val}</div><div class="det">${det}</div></div>`;
  const painel = (tit, corpo, extra = '') => `<div class="cartao"><div class="acoes" style="justify-content:space-between;margin-bottom:12px"><h2 style="margin:0">${esc(tit)}</h2>${extra}</div>${corpo}</div>`;
  c.innerHTML = cabecalho('Relatórios', `Retrato do ano para levar à Samara e à Diretoria · gerado em ${dataBR(d.gerado_em)}`,
    `<span class="ano-nav"><button class="btn" id="relAnoAnt" aria-label="Ano anterior">←</button><b>${d.ano}</b><button class="btn" id="relAnoProx" aria-label="Próximo ano">→</button></span>
     <button class="btn pri" id="relImp">${icone('documentos')}Folha de fechamento</button>`)
    + `<div class="grade g4 numeros">
      ${kpi('Alunos ativos', a.ativos, `${a.novos} novos em ${d.ano} · ${a.concluintes} concluintes`, 'destaque')}
      ${kpi('Rematrícula', r.percentual + '%', `${r.concluidas} de ${r.veteranos} veteranos`, 'ok')}
      ${kpi('Atendimentos no ano', at.total, `${at.resolvidos} resolvidos na hora (${PCT(at.resolvidos, at.total)}%)`)}
      ${kpi('Documentos emitidos', d.documentos.emitidos, 'declarações, termos e listas')}</div>
    <div class="duas-larga">${painel('Atendimentos mês a mês', graficoMeses(at.por_mes), `<span class="mono dado">pico: ${esc(at.pico.mes)} (${at.pico.n})</span>`)}
      ${painel('Por canal', graficoRosca(at.por_canal.map(([k, n]) => [canais[k] || k, n])), `<span class="mono dado">${at.em_aberto} em aberto</span>`)}</div>

    <h2 class="titulo-secao">A escola hoje</h2>
    <div class="grade g4 numeros">${kpi('Filhos de funcionários', a.filhos_funcionarios, 'isentos na conferência dos boletos')}
      ${kpi('Interessados (SIG)', d.interessados.total, `${d.interessados.matriculados} viraram matrícula`)}
      ${kpi('Fichas anonimizadas', a.anonimizados, 'ex-alunos com dados descartados (LGPD)')}
      ${kpi('Fotos nos 3 sistemas', d.fotos.completos, `${d.fotos.faltando} alunos ainda faltando`)}</div>
    <div class="duas">${painel('Alunos por segmento', barras(Object.entries(a.por_segmento), 'var(--azul-2)'))}${painel('Alunos por série', barras(a.por_serie.map((s) => [s.rotulo, s.n]), 'var(--azul-2)'))}</div>

    <h2 class="titulo-secao">Matrícula e rematrícula ${d.ano}</h2>
    <div class="grade g4 numeros">${kpi('Rematrículas concluídas', `${r.concluidas}<small>/ ${r.veteranos}</small>`, `${r.percentual}% dos veteranos`, 'destaque')}
      ${kpi('Em andamento', r.reservada || 0, 'pagaram a matrícula')}${kpi('Ainda não iniciaram', r.pendente || 0, 'famílias a contatar')}
      ${kpi('Não renovam', (r.nao_renova || 0) + (r.transferido || 0), 'saídas declaradas')}</div>
    ${painel('Situação das rematrículas', barras(Object.entries(rotuloStatus).map(([k, v]) => [v, r[k] || 0]), 'var(--verde)')
      + `<p class="dado" style="margin:12px 0 0">${r.vagas_definidas ? `Capacidade cadastrada: ${r.capacidade_total} vagas em ${r.vagas_definidas} séries.` : 'Vagas por série ainda não cadastradas (Configurações › Vagas).'}</p>`)}

    <h2 class="titulo-secao">A secretaria em números (${at.ano})</h2>
    <div class="duas">${painel('Assuntos mais procurados', at.por_categoria.length ? barras(at.por_categoria.map(([k, n]) => [k, n]), 'var(--laranja)') : '<p class="vazio">Sem categorias ainda.</p>')}
      ${painel('Documentos emitidos por tipo', d.documentos.por_tipo.length ? barras(d.documentos.por_tipo.map((t) => [t.chave, t.n]), 'var(--amarelo)') : '<p class="vazio">Nenhum documento emitido neste ano.</p>')}</div>

    <h2 class="titulo-secao">Financeiro e bolsas</h2>
    <div class="grade g4 numeros">${kpi('Atividades extras', d.extras.inscricoes_ativas, `inscrições ativas · ${d.extras.canceladas} canceladas`)}
      ${kpi('Receita mensal das extras', moedaBR(d.extras.receita_mensal), 'soma das parcelas ativas')}
      ${kpi('Bolsas ' + d.bolsas.ano, `${d.bolsas.concedidas}<small>/ ${d.bolsas.total}</small>`, `${d.bolsas.cem_por_cento} de 100% · ${d.bolsas.cinquenta} de 50%`)}</div>
    <div class="duas">${painel('Inscrições por atividade', d.extras.por_atividade.length ? barras(d.extras.por_atividade.map((x) => [x.nome, x.ativas || 0]), 'var(--roxo)') : '<p class="vazio">Nenhuma inscrição.</p>')}
      ${painel('Bolsas por etapa', (d.bolsas.por_status.length ? barras(d.bolsas.por_status.map((x) => [rotuloBolsa[x.chave] || x.chave, x.n]), 'var(--verde)') : '<p class="vazio">Nenhum processo.</p>')
        + `<p class="dado" style="margin:12px 0 0">Prestação de contas do CEBAS: <b style="display:inline">${dataBR(d.bolsas.prestacao_contas)}</b> · ${plural(d.bolsas.contratos, 'contrato assinado', 'contratos assinados')}.</p>`)}</div>

    <h2 class="titulo-secao">Cuidado com os dados e rotina</h2>
    <div class="grade g4 numeros">${kpi('Autorizações de saída', d.saida.alunos_com_autorizado, `${d.saida.autorizados} pessoas autorizadas · ${d.saida.sai_sozinho} saem sozinhos`)}
      ${kpi('Avisos de saída no ano', d.saida.avisos_ano, '"hoje quem busca é outra pessoa"')}
      ${kpi('Lembretes do calendário', `${d.equipe.lembretes_concluidos}<small>/ ${d.equipe.lembretes_total}</small>`, `${d.equipe.tarefas_concluidas} tarefas do dia concluídas`)}</div>
    ${d.equipe.por_pessoa.length ? painel('Tarefas concluídas por pessoa', barras(d.equipe.por_pessoa.map((p) => [nomePessoa(p.chave), p.n]), 'var(--azul-2)')) : ''}`;
  $('#relImp').onclick = () => abrirDoc({ tipo: 'fechamento', ano: d.ano });
  $('#relAnoAnt').onclick = () => (location.hash = '#/relatorios/' + (d.ano - 1));
  $('#relAnoProx').onclick = () => (location.hash = '#/relatorios/' + (d.ano + 1));
};

// ═════════════ MENSAGENS ═════════════
// Lista de modelos à esquerda; à direita o editor e a prévia de como a família vai ver no WhatsApp
const EXEMPLO_MSG = { aluno: 'Ana Lima', responsavel: 'Diego', serie: '5º ano do Fundamental I', serie_destino: '6º ano do Fundamental II', documentos: 'Contrato 2027, Ficha de saúde', prazo: '07/11' };
let modeloAberto = null;
TELAS.mensagens = async (c) => {
  const modelos = await api('GET', '/api/modelos');
  if (modeloAberto !== 'novo' && !modelos.some((m) => m.id === modeloAberto)) modeloAberto = modelos[0] ? modelos[0].id : 'novo';
  const CAMPOS_MSG = ['{aluno}', '{responsavel}', '{serie}', '{serie_destino}', '{documentos}', '{prazo}'];
  c.innerHTML = cabecalho('Mensagens', 'Textos prontos para o WhatsApp. O app troca as palavras entre chaves pelos dados do aluno.',
    `<button class="btn ama" id="novo">${icone('mais')}Novo modelo</button>`)
    + `<div class="mensagens"><div class="modelos" id="lista" role="listbox" aria-label="Modelos"></div>
      <form class="cartao" id="fm"><div class="campo"><label for="mt">Título</label><input id="mt" required></div>
        <div class="campo" style="margin-top:12px"><label for="mx">Texto</label><textarea id="mx" required style="min-height:150px"></textarea></div>
        <div class="variaveis" aria-label="Colocar no texto">${CAMPOS_MSG.map((x) => `<button type="button" data-var="${x}" title="Colocar ${x} no texto">${x}</button>`).join('')}</div>
        <div class="titulo-secao" style="margin:20px 0 8px">Como a família vai ver · exemplo</div>
        <div class="conversa"><div class="balao" id="mPrev"></div></div>
        <div class="rodape"><button type="button" class="btn perigo" id="del" style="margin-right:auto">Excluir</button>
          <button type="button" class="btn" id="copiar">${icone('copia')}Copiar exemplo</button><button class="btn pri">Salvar</button></div></form></div>`;
  let alterado = false;
  const atual = () => modelos.find((m) => m.id === modeloAberto);
  const lista = () => { $('#lista').innerHTML = modelos.map((m) => `<button type="button" role="option" data-m="${m.id}" aria-pressed="${m.id === modeloAberto}" aria-selected="${m.id === modeloAberto}">
      <b>${esc(m.titulo)}</b><small>${esc(m.texto)}</small></button>`).join('') + (modeloAberto === 'novo' ? '<button type="button" aria-pressed="true"><b>Novo modelo</b><small>ainda não salvo</small></button>' : ''); };
  const previa = () => { $('#mPrev').textContent = preencherModelo($('#mx').value, EXEMPLO_MSG); };
  const abrir = () => { const m = atual(); $('#mt').value = m ? m.titulo : ''; $('#mx').value = m ? m.texto : 'Olá, {responsavel}! '; $('#del').hidden = !m; alterado = false; previa(); lista(); };
  const trocar = async (id) => { if (alterado && !(await confirmar('Descartar o que foi mudado neste modelo?', 'Descartar'))) return; modeloAberto = id; abrir(); };
  abrir();
  $('#lista').onclick = (e) => { const b = e.target.closest('[data-m]'); if (b && +b.dataset.m !== modeloAberto) trocar(+b.dataset.m); };
  $('#mx').oninput = () => { alterado = true; previa(); };
  $('#mt').oninput = () => { alterado = true; };
  $$('[data-var]', c).forEach((b) => (b.onclick = () => {
    const t = $('#mx'), p = t.selectionStart ?? t.value.length;
    t.value = t.value.slice(0, p) + b.dataset.var + t.value.slice(t.selectionEnd ?? p); t.focus(); t.selectionStart = t.selectionEnd = p + b.dataset.var.length;
    alterado = true; previa();
  }));
  $('#copiar').onclick = async () => { try { await navigator.clipboard.writeText($('#mPrev').textContent); toast('Texto copiado'); } catch { toast('Não deu para copiar. Selecione o texto e copie.', true); } };
  $('#novo').onclick = () => trocar('novo');
  $('#fm').onsubmit = tentar(async (ev) => {
    ev.preventDefault();
    const b = { titulo: $('#mt').value, texto: $('#mx').value };
    if (atual()) await api('PUT', '/api/modelos/' + modeloAberto, b);
    else { const r = await api('POST', '/api/modelos', b); if (r && r.id) modeloAberto = r.id; }
    alterado = false; toast('Modelo salvo'); rotear();
  });
  $('#del').onclick = tentar(async () => {
    const m = atual(); if (!m || !(await confirmar('Excluir o modelo "' + m.titulo + '"?', 'Excluir'))) return;
    await api('DELETE', '/api/modelos/' + m.id); modeloAberto = null; rotear();
  });
};

// ═════════════ LIXEIRA ═════════════
TELAS.lixeira = async (c) => {
  const d = await api('GET', '/api/lixeira');
  const admin = EU.perfil === 'admin';
  const diasAte = (iso) => Math.max(0, Math.ceil((Date.parse(iso) - Date.now()) / 86400000));
  const tipos = [...new Set(d.itens.map((i) => i.tipo))];
  c.innerHTML = cabecalho('Lixeira', `${admin ? 'Tudo o que foi excluído' : 'O que você excluiu'} fica aqui por <b>${d.dias} dias</b> e pode voltar com um clique. Depois disso, some de vez.`,
    admin && d.itens.length ? '<button class="btn perigo" id="esvaziar">Esvaziar a lixeira</button>' : '')
    + (d.itens.length ? `<div class="barra-filtros"><label class="procura"><input id="lq" placeholder="Procurar pelo nome ou assunto" aria-label="Procurar na lixeira"></label>
        <select id="lt" aria-label="Tipo"><option value="">Tudo (${d.itens.length})</option>${tipos.map((t) => `<option value="${esc(t)}">${esc(d.tipos[t] || t)} (${d.itens.filter((i) => i.tipo === t).length})</option>`).join('')}</select></div>
      <div class="cartao" style="padding:0;overflow:hidden" id="lLista"></div>`
      : `<div class="cartao">${vazio('lixeira', 'A lixeira está vazia', 'Quando alguém excluir um atendimento, um aviso de saída, uma tarefa ou outro registro, ele vem para cá e pode ser restaurado.')}</div>`)
    + (admin ? `<form class="cartao" id="lcfg" style="margin-top:14px"><h2>Quanto tempo guardar</h2>
      <div class="acoes"><label>Apagar de vez depois de <input type="number" id="ldias" min="1" max="365" value="${d.dias}" style="width:84px"> dias</label><button class="btn">Salvar</button></div>
      <p class="dado" style="margin:10px 0 0">O descarte de ex-alunos da LGPD não passa pela lixeira: ali a exclusão é para valer, e o que estava na lixeira sobre aquele aluno também some.</p></form>` : '');
  const desenhar = () => {
    const ft = $('#lt').value, q = norm($('#lq').value);
    const f = d.itens.filter((i) => (!ft || i.tipo === ft) && (!q || norm(`${i.rotulo} ${i.tipo_nome} ${i.usuario}`).includes(q)));
    $('#lLista').innerHTML = f.length ? f.map((i) => { const n = diasAte(i.some_em);
      return `<div class="lixo"><span class="inicial">${icone('lixeira')}</span>
        <span><b>${i.aluno_id ? `<a href="#/aluno/${i.aluno_id}">${esc(titulo(i.rotulo || ''))}</a>` : esc(i.rotulo || '—')}</b>
          <small>${esc(i.tipo_nome)} · excluído${admin ? ' por ' + esc(nomeUsuario(i.usuario)) : ''} em ${new Date(i.excluido_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</small></span>
        <span class="vida">${n ? `some em ${plural(n, 'dia', 'dias')}` : 'some hoje'}<span class="barra"><i style="width:${pctBarra(n, d.dias)}%;background:${n <= 3 ? 'var(--vermelho)' : 'var(--texto-2)'};animation:none"></i></span></span>
        <span class="botoes"><button class="btn peq pri" data-rest="${i.id}">${icone('volta')}Restaurar</button>${admin ? `<button class="btn peq perigo" data-apagar="${i.id}">Apagar de vez</button>` : ''}</span></div>`; }).join('')
      : '<p class="vazio">Nada encontrado com esse filtro.</p>';
    $$('[data-rest]', c).forEach((b) => (b.onclick = tentar(async () => {
      b.disabled = true;
      try { await api('POST', `/api/lixeira/${b.dataset.rest}/restaurar`); } finally { b.disabled = false; }
      invalidar(); toast('Restaurado: voltou para o lugar de antes'); rotear();
    })));
    $$('[data-apagar]', c).forEach((b) => (b.onclick = tentar(async () => {
      if (!(await confirmar('Apagar de vez? Depois disso não tem como recuperar (só por uma cópia de segurança).', 'Apagar de vez'))) return;
      await api('DELETE', '/api/lixeira/' + b.dataset.apagar); toast('Apagado de vez'); rotear();
    })));
  };
  if (d.itens.length) { $('#lt').onchange = desenhar; $('#lq').oninput = desenhar; desenhar(); }
  if ($('#esvaziar')) $('#esvaziar').onclick = tentar(async () => {
    if (!(await confirmar(`Apagar de vez os ${d.itens.length} itens da lixeira? Não tem como desfazer.`, 'Esvaziar'))) return;
    await api('DELETE', '/api/lixeira'); toast('Lixeira esvaziada'); rotear();
  });
  if ($('#lcfg')) $('#lcfg').onsubmit = tentar(async (e) => {
    e.preventDefault();
    const n = Math.max(1, Math.min(365, +$('#ldias').value || 30));
    await api('PUT', '/api/admin/config', { lixeira_dias: n });
    EU.config.lixeira_dias = String(n); toast('Salvo'); rotear();
  });
};
// ───────────── Configurações › Celular e rede ─────────────
// Liberar o SEK para os aparelhos do mesmo Wi-Fi (grava rede_liberada e reinicia) e mostrar o endereço com um QR Code.
async function abaCelular(el) {
  const r = await api('GET', '/api/admin/rede');
  const principal = r.enderecos.find((e) => e.provavel) || r.enderecos[0];
  const urlDe = (ip) => `http://${ip}:${r.porta}`;
  const pendente = r.liberada !== r.ativa && !r.pelo_bat;
  const botao = r.pelo_bat ? '<span></span>'
    : pendente ? `<button class="btn pri" id="redeReiniciar">${icone('volta')}Reiniciar agora</button>`
    : r.ativa ? '<button class="btn" id="redeFechar">Fechar o acesso pela rede</button>'
    : `<button class="btn pri" id="redeLiberar">${icone('celular')}Liberar para o celular</button>`;
  const situacao = pendente
    ? ['info', 'volta', 'Falta reiniciar', r.liberada ? 'O acesso pela rede foi ligado e passa a valer quando o sistema reiniciar.' : 'O acesso pela rede foi desligado e para de valer quando o sistema reiniciar.']
    : r.ativa ? ['', 'celular', 'Liberado para o celular', r.pelo_bat ? 'Ligado pelo "Iniciar Secretaria.bat" (IEL_REDE=1). Para desligar, tire essa linha do .bat.' : 'Celulares e computadores no mesmo Wi-Fi conseguem abrir o SEK (com usuário e senha).']
    : ['info', 'cadeado', 'Só este computador abre o SEK', 'Libere para usar o SEK no celular ou em outro computador conectado ao mesmo Wi-Fi.'];
  el.innerHTML = `
  <div class="situacao ${situacao[0]}"><span class="selo">${icone(situacao[1])}</span>
    <span><b>${situacao[2]}</b><span>${esc(situacao[3])}</span></span>${botao}</div>
  ${r.ativa ? (principal ? `<div class="cartao celular-qr">
      <div class="qr-caixa" id="qrCaixa">${gerarQR(urlDe(principal.ip))}</div>
      <div class="celular-passos">
        <h2>${icone('celular')}Abra no celular</h2>
        <div class="endereco-rede"><span class="mono" id="qrUrl">${esc(urlDe(principal.ip))}</span>
          <button class="btn peq" id="qrCopiar">${icone('copia')}Copiar</button></div>
        <ol class="passos-rede">
          <li>Conecte o celular no <b>mesmo Wi-Fi</b> deste computador.</li>
          <li>Abra a câmera e aponte para o código, ou digite o endereço no navegador.</li>
          <li>Entre com o seu usuário e a sua senha.</li>
        </ol>
        <p class="dado">Dica: no Chrome do celular, o menu ⋮ › "Adicionar à tela inicial" deixa o SEK com ícone, como um aplicativo.</p>
        ${r.enderecos.length > 1 ? `<div class="campo" style="margin-top:12px"><label for="qrRede">Este computador está em mais de uma rede. Não abriu? Tente outra:</label>
          <select id="qrRede">${r.enderecos.map((e) => `<option value="${esc(e.ip)}" ${e === principal ? 'selected' : ''}>${esc(e.ip)} · ${esc(e.nome)}</option>`).join('')}</select></div>` : ''}
      </div></div>`
    : '<div class="cartao"><p class="vazio">Este computador não está conectado a nenhuma rede agora. Conecte o Wi-Fi ou o cabo e abra esta tela de novo.</p></div>') : ''}
  <div class="cartao" style="margin-top:14px"><h2>${icone('escudo')}Cuidados</h2>
    <ul class="lista-cuidados">
      <li>Use só na <b>rede da secretaria</b>. Nunca libere no Wi-Fi de visitantes ou de alunos.</li>
      <li>A conexão pela rede não tem o cadeado (é <span class="mono">http</span>): qualquer aparelho do mesmo Wi-Fi vê a tela de entrada. Todos ainda precisam de usuário e senha.</li>
      <li>Fora do Wi-Fi da escola (no 4G, por exemplo) não abre. É de propósito: os dados não vão para a internet.</li>
      <li>Na primeira vez, o Windows pergunta sobre o Firewall: marque <b>Redes privadas</b> e clique em Permitir. Se o celular não abrir, o Firewall ou a rede marcada como "pública" costumam ser o motivo.</li>
      <li>"Abrir pasta" do prontuário só funciona neste computador.</li>
    </ul></div>`;

  const remoto = !['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  const trocar = (liberar) => tentar(async () => {
    const aviso = liberar
      ? 'Liberar o SEK para celulares e computadores deste Wi-Fi? O sistema vai reiniciar e volta em alguns segundos.'
      : 'Fechar o acesso pela rede? Só este computador vai abrir o SEK. O sistema vai reiniciar e volta em alguns segundos.'
        + (remoto ? ' Atenção: você está num celular ou outro computador — depois disso, este aparelho perde o acesso.' : '');
    if (!(await confirmar(aviso, liberar ? 'Liberar e reiniciar' : 'Fechar e reiniciar'))) return;
    const res = await api('PUT', '/api/admin/rede', { liberada: liberar });
    if (res.precisa_reiniciar) await reiniciarSistema(false);
    else { toast('Salvo'); rotear(); }
  });
  if ($('#redeLiberar', el)) $('#redeLiberar', el).onclick = trocar(true);
  if ($('#redeFechar', el)) $('#redeFechar', el).onclick = trocar(false);
  if ($('#redeReiniciar', el)) $('#redeReiniciar', el).onclick = tentar(() => reiniciarSistema(false));
  if ($('#qrRede', el)) $('#qrRede', el).onchange = (e) => {
    $('#qrCaixa', el).innerHTML = gerarQR(urlDe(e.target.value));
    $('#qrUrl', el).textContent = urlDe(e.target.value);
  };
  if ($('#qrCopiar', el)) $('#qrCopiar', el).onclick = async () => {
    const txt = $('#qrUrl', el).textContent;
    try { await navigator.clipboard.writeText(txt); toast('Endereço copiado'); }
    catch { getSelection().selectAllChildren($('#qrUrl', el)); toast('Selecionei o endereço: aperte Ctrl+C para copiar'); }
  };
}

// Nome bonito de quem excluiu ("samara" → "Samara"); "sistema" fica como está
function nomeUsuario(login) { return login ? titulo(login) : '—'; }

// ═════════════ CONFIGURAÇÕES ═════════════
TELAS.config = async (c, aba = 'geral') => {
  if (EU.perfil !== 'admin') { c.innerHTML = '<div class="cartao">Somente a administração acessa as configurações.</div>'; return; }
  const d = await api('GET', '/api/admin');
  const ABAS = { geral: 'Geral', importar: 'Importar dados', vagas: 'Vagas', documentos: 'Documentos', usuarios: 'Usuários',
    backup: 'Cópias de segurança', celular: 'Celular e rede', atualizacao: 'Atualizações', lgpd: 'LGPD e acessos', log: 'Auditoria' };
  if (!ABAS[aba]) aba = 'geral';
  c.innerHTML = cabecalho('Configurações', 'Só a administração vê esta área.')
    + `<div class="config"><nav class="config-nav" aria-label="Assuntos">${Object.entries(ABAS).map(([k, v]) => `<a href="#/config/${k}" class="${aba === k ? 'ativo' : ''}" ${aba === k ? 'aria-current="page"' : ''}>${v}</a>`).join('')}</nav>
      <div id="aba"></div></div>`;
  const el = $('#aba');
  const cfg = d.config;

  if (aba === 'geral') {
    const campo = (k, rot, tipo = 'date') => `<div class="campo"><label for="c_${k}">${rot}</label><input id="c_${k}" type="${tipo}" value="${esc(cfg[k] || '')}"></div>`;
    el.innerHTML = `<form class="cartao" id="fg">
      <section><h2>Matrícula ${esc(cfg.ano_matricula)}</h2><div class="campos">
        ${campo('ano_matricula', 'Ano da matrícula', 'number')}${campo('prazo_dias', 'Prazo para documentos (dias)', 'number')}
        ${campo('data_inicio', 'Início das matrículas')}${campo('data_desconto', 'Fim do desconto')}${campo('data_garantia_vaga', 'Fim da garantia de vaga')}${campo('data_fim', 'Encerramento')}</div></section>
      <section><h2>Pastas deste computador</h2>
        <div class="campo"><label for="c_pasta_prontuario">Pasta dos prontuários (Contratos)</label><input id="c_pasta_prontuario" value="${esc(cfg.pasta_prontuario)}" style="width:100%"></div>
        <p class="dado">O app procura as pastas assim: <span class="mono">Pasta\\&lt;turma&gt;\\&lt;nome do aluno&gt;\\*.pdf</span>, com os nomes do PDF Renamer.</p>
        <div class="campo" style="margin-top:10px"><label for="c_pastas_fotos">Pastas das fotos dos alunos (separe com ;)</label><input id="c_pastas_fotos" value="${esc(cfg.pastas_fotos || '')}" style="width:100%"></div></section>
      <section><h2>Declarações e horários</h2><div class="campos">
        ${campo('inep', 'Código INEP', 'text')}${campo('horario_infantil', 'Horário Ed. Infantil', 'text')}${campo('horario_fund1', 'Horário Fund. I', 'text')}
        ${campo('horario_fund2', 'Horário Fund. II', 'text')}${campo('horario_medio', 'Horário Ensino Médio', 'text')}</div>
        <p class="dado">Estes horários também desenham as faixas da Linha do dia, na tela de Início.</p></section>
      <section><h2>Atividades extras e olimpíada</h2><div class="campos">
        ${campo('extras_dia_venc', 'Dia de vencimento das parcelas', 'number')}${campo('extras_ultimo_mes', 'Último mês de parcela (11 = novembro)', 'number')}
        ${campo('olimpiada_titulo', 'Título da olimpíada', 'text')}${campo('olimpiada_validade', 'Validade da carteirinha')}</div></section>
      <section><h2>Bolsa social (CEBAS)</h2><div class="campos">
        ${campo('cebas_ano', 'Ano das bolsas', 'number')}${campo('cebas_retirada', 'Retirada do requerimento')}${campo('cebas_entrega_ini', 'Entrega: início')}
        ${campo('cebas_entrega_fim', 'Entrega: fim')}${campo('cebas_resultado', 'Divulgação do resultado')}${campo('cebas_prestacao', 'Prestação de contas')}</div></section>
      <section><h2>Boletos, fotos e saída</h2><div class="campos">
        ${campo('desconto_funcionario', 'Desconto do filho de funcionário (%)', 'number')}${campo('boletos_dia_venc', 'Dia de vencimento das mensalidades', 'number')}
        ${campo('boletos_mes_massa', 'Mês da massa de boletos (11 = novembro)', 'number')}${campo('fotos_sistemas', 'Sistemas do mutirão de fotos (separe com ;)', 'text')}
        <div class="campo"><label for="c_saida_aviso_telefone">Aviso de saída só por telefone</label><select id="c_saida_aviso_telefone">
          <option value="0" ${cfg.saida_aviso_telefone !== '1' ? 'selected' : ''}>Não aceitar (regra do termo)</option>
          <option value="1" ${cfg.saida_aviso_telefone === '1' ? 'selected' : ''}>Aceitar sem avisar</option></select></div></div></section>
      <section><h2>Aparência (vale só neste computador)</h2>
        <label class="chk"><input type="checkbox" class="interruptor" id="c_compacto"> Modo compacto: linhas mais juntas, cabe mais aluno na tela</label>
        <p class="dado">O claro/escuro e o modo compacto também ficam no menu da sua conta (a bolinha amarela, embaixo à esquerda).</p></section>
      <div class="rodape" style="display:flex;justify-content:flex-end"><button class="btn pri">Salvar</button></div></form>`;
    $('#c_compacto').checked = densidadeAtual() === 'compacta';
    $('#c_compacto').onchange = (ev) => aplicarDensidade(ev.target.checked ? 'compacta' : 'normal', true);
    $('#fg').onsubmit = tentar(async (ev) => {
      ev.preventDefault();
      const b = {}; ['ano_matricula', 'prazo_dias', 'data_inicio', 'data_desconto', 'data_garantia_vaga', 'data_fim', 'pasta_prontuario', 'pastas_fotos', 'inep',
        'horario_infantil', 'horario_fund1', 'horario_fund2', 'horario_medio', 'extras_dia_venc', 'extras_ultimo_mes', 'olimpiada_titulo', 'olimpiada_validade',
        'cebas_ano', 'cebas_retirada', 'cebas_entrega_ini', 'cebas_entrega_fim', 'cebas_resultado', 'cebas_prestacao',
        'desconto_funcionario', 'boletos_dia_venc', 'boletos_mes_massa', 'fotos_sistemas', 'saida_aviso_telefone'].forEach((k) => { b[k] = $('#c_' + k).value.trim(); });
      await api('PUT', '/api/admin/config', b); EU = await api('GET', '/api/eu'); toast('Configurações salvas');
    });
  }

  if (aba === 'importar') {
    const p = await api('GET', '/api/painel');
    el.innerHTML = `<div class="duas">
      <div class="cartao"><h2>Importar alunos do ACADESC</h2>
        <p>Use a exportação de alunos do ACADESC em Excel (.xlsx) com as colunas <span class="mono">Mat, Nome, AnoLetivo, Descricao, Serie, Turma, Turno, FilhoFuncionario, NomeMae, NomePai, NomeResp, Email, CelularMae, CelularPai, DtNascimento, CPF…</span>
        É o mesmo formato da aba <b>Planilha1</b> do contrato.</p>
        <p class="dica">Os alunos são identificados pela matrícula: quem já existe é atualizado e quem não existe é criado. Nada é apagado. Rematrículas e documentos já marcados continuam.</p>
        <label class="btn pri">Escolher arquivo…<input type="file" id="arqA" accept=".xlsx,.csv" hidden></label>
        <div id="resA" style="margin-top:12px"></div></div>
      <div class="cartao"><h2>Dados de demonstração</h2>
        <p>Cria alunos <b>fictícios</b> para testar e apresentar o sistema sem expor dados reais (LGPD): cerca de 160, ou uns 535 no tamanho real da escola.</p>
        ${p.demo ? '<p><span class="tag t-demo">Demonstração carregada</span></p><button class="btn perigo" id="apagarDemo">Apagar dados de demonstração</button>'
          : '<div class="acoes"><button class="btn" id="carregarDemo">Carregar demonstração</button><button class="btn" id="carregarDemoReal" title="Uns 535 alunos fictícios, como a escola de verdade">Demonstração no tamanho real</button></div>'}
        <p class="dado" style="margin-top:12px">Antes de importar os alunos reais, apague a demonstração.</p></div></div>`;
    $('#arqA').onchange = tentar(async (e) => {
      const file = e.target.files[0]; if (!file) return;
      $('#resA').textContent = 'Importando…';
      const r = await api('POST', '/api/admin/importar-alunos?arquivo=' + encodeURIComponent(file.name), undefined, file);
      invalidar();
      $('#resA').innerHTML = `<div class="situacao"><span class="selo">${icone('ok')}</span><span><b>${r.novos} novos · ${r.atualizados} atualizados</b>
        <span>${r.ignorados} linhas ignoradas${r.sem_serie.length ? ` · ${r.sem_serie.length} sem série reconhecida: ${esc(r.sem_serie.slice(0, 10).join(', '))}${r.sem_serie.length > 10 ? '…' : ''}` : ''}</span></span><span></span></div>`;
    });
    const demo = (tam) => tentar(async () => { const r = await api('POST', '/api/admin/demo' + (tam ? '?tamanho=' + tam : '')); invalidar(); toast(r.alunos + ' alunos fictícios criados'); location.hash = '#/'; });
    if ($('#carregarDemo')) $('#carregarDemo').onclick = demo('');
    if ($('#carregarDemoReal')) $('#carregarDemoReal').onclick = demo('real');
    if ($('#apagarDemo')) $('#apagarDemo').onclick = tentar(async () => {
      if (!(await confirmar('Apagar todos os alunos e contatos fictícios da demonstração?', 'Apagar'))) return;
      await api('DELETE', '/api/admin/demo'); invalidar(); toast('Demonstração apagada'); rotear();
    });
  }

  if (aba === 'vagas') {
    el.innerHTML = `<form class="cartao" id="fv"><h2>Vagas por série em ${esc(cfg.ano_matricula)}</h2>
      <p class="dado">Capacidade máxima de alunos por série (somando todas as turmas). Deixe em branco se não houver limite definido.</p>
      <div class="campos">${d.vagas.map((v) => `<div class="campo"><label for="vg_${v.chave}">${esc(v.rotulo)}</label><input type="number" min="0" id="vg_${v.chave}" data-v="${v.chave}" value="${v.capacidade ?? ''}"></div>`).join('')}</div>
      <div class="rodape" style="display:flex;justify-content:flex-end"><button class="btn pri">Salvar vagas</button></div></form>`;
    $('#fv').onsubmit = tentar(async (ev) => { ev.preventDefault(); const b = {}; $$('[data-v]', el).forEach((i) => { b[i.dataset.v] = i.value; }); await api('PUT', '/api/admin/vagas', b); toast('Vagas salvas'); });
  }

  if (aba === 'documentos') {
    el.innerHTML = `<div class="cartao"><h2>Documentos da matrícula</h2><p class="dado">A lista pode ser ajustada a qualquer momento. O "arquivo PDF" é o nome padronizado do PDF Renamer ({ano} vira o ano da matrícula). Salva sozinho.</p>
      <div class="tabela-wrap"><table><thead><tr><th>Documento</th><th>Arquivo PDF</th><th>Obrigatório</th><th>Vale para</th><th>Ativo</th></tr></thead><tbody>
      ${d.documentos.map((x) => `<tr data-doc="${x.id}"><td><input data-k="nome" value="${esc(x.nome)}" style="width:100%" aria-label="Nome do documento"></td><td><input data-k="arquivo" value="${esc(x.arquivo || '')}" style="width:100%" aria-label="Arquivo PDF"></td>
        <td><input type="checkbox" class="interruptor" data-k="obrigatorio" ${x.obrigatorio ? 'checked' : ''} aria-label="Obrigatório"></td>
        <td><select data-k="aplica" aria-label="Vale para"><option value="todos" ${x.aplica === 'todos' ? 'selected' : ''}>Todos</option><option value="novos" ${x.aplica === 'novos' ? 'selected' : ''}>Só novos</option></select></td>
        <td><input type="checkbox" class="interruptor" data-k="ativo" ${x.ativo ? 'checked' : ''} aria-label="Ativo"></td></tr>`).join('')}
      </tbody></table></div>
      <div class="acoes" style="margin-top:12px"><button class="btn" id="addDoc">${icone('mais')}Adicionar documento</button></div></div>`;
    $$('[data-doc] [data-k]', el).forEach((i) => (i.onchange = tentar(async () => {
      const v = i.type === 'checkbox' ? i.checked : i.value;
      await api('PUT', '/api/admin/documentos/' + i.closest('tr').dataset.doc, { [i.dataset.k]: v }); toast('Salvo');
    })));
    $('#addDoc').onclick = tentar(async () => { await api('POST', '/api/admin/documentos', { nome: 'Novo documento', obrigatorio: true }); rotear(); });
  }

  if (aba === 'usuarios') {
    el.innerHTML = `<div class="cartao"><div class="acoes" style="justify-content:space-between;margin-bottom:12px"><h2 style="margin:0">Quem usa o sistema</h2></div>
      <div class="lista">${d.usuarios.map((u) => `<div class="linha" data-u="${u.id}" style="grid-template-columns:auto minmax(0,1fr) auto auto">
        <span class="inicial redonda" style="background:var(--amarelo);color:#3a2b00">${esc(iniciais(u.nome))}</span>
        <span><b>${esc(u.nome)}</b><small class="mono">${esc(u.login)}</small></span>
        <span>${u.ativo ? (u.trocar_senha ? '<span class="tag t-reservada">aguardando 1º acesso</span>' : '<span class="tag t-concluida">ativo</span>') : '<span class="tag t-nao_renova">desativado</span>'}</span>
        <span class="acoes" style="justify-content:flex-end"><select data-k="perfil" aria-label="Perfil de ${esc(u.nome)}"><option value="admin" ${u.perfil === 'admin' ? 'selected' : ''}>Administração</option><option value="aprendiz" ${u.perfil === 'aprendiz' ? 'selected' : ''}>Aprendiz</option></select>
          <button class="btn peq" data-reset>Resetar senha</button><button class="btn peq" data-ativo="${u.ativo ? 0 : 1}">${u.ativo ? 'Desativar' : 'Reativar'}</button></span></div>`).join('')}</div>
      <p class="dica">Senha inicial e senha resetada: <b class="mono">luterano</b>. No primeiro acesso a pessoa é obrigada a criar uma senha própria.<br>
        <b>Administração</b> acessa as configurações, a importação e a auditoria. <b>Aprendiz</b> usa todo o resto.</p>
      <form id="fu" class="acoes" style="margin-top:10px"><input id="un" placeholder="Nome" required aria-label="Nome"><input id="ul" placeholder="login (ex.: maria)" required aria-label="Login">
        <select id="up" aria-label="Perfil"><option value="aprendiz">Aprendiz</option><option value="admin">Administração</option></select><button class="btn pri">${icone('mais')}Criar usuário</button></form></div>`;
    $$('[data-u]', el).forEach((tr) => {
      const id = tr.dataset.u;
      $('[data-k=perfil]', tr).onchange = tentar(async (e) => { await api('PUT', '/api/admin/usuarios/' + id, { perfil: e.target.value }); toast('Perfil alterado'); });
      $('[data-reset]', tr).onclick = tentar(async () => { await api('PUT', '/api/admin/usuarios/' + id, { resetar_senha: true }); toast('Senha resetada para "luterano"'); rotear(); });
      $('[data-ativo]', tr).onclick = tentar(async (e) => { await api('PUT', '/api/admin/usuarios/' + id, { ativo: e.target.dataset.ativo === '1' }); rotear(); });
    });
    $('#fu').onsubmit = tentar(async (ev) => { ev.preventDefault(); await api('POST', '/api/admin/usuarios', { nome: $('#un').value, login: $('#ul').value, perfil: $('#up').value }); toast('Usuário criado. Senha inicial: luterano'); rotear(); });
  }

  if (aba === 'backup' && window.abaBackup) await window.abaBackup(el);
  if (aba === 'atualizacao' && window.abaAtualizacao) await window.abaAtualizacao(el);
  if (aba === 'lgpd' && window.abaLgpd) await window.abaLgpd(el);
  if (aba === 'celular') await abaCelular(el);

  if (aba === 'log') {
    const log = await api('GET', '/api/admin/log');
    el.innerHTML = `<div class="cartao"><div class="acoes" style="justify-content:space-between;margin-bottom:12px"><h2 style="margin:0">Auditoria</h2><span class="mono dado">${log.length} registros</span></div>
      <label class="procura" style="display:block;margin-bottom:14px"><input id="logQ" placeholder="Filtrar por pessoa, ação ou detalhe" aria-label="Filtrar auditoria"></label>
      <div class="linha-tempo" id="logLista"></div></div>`;
    const linhas = log.map((l) => { let det = l.detalhe; try { const o = JSON.parse(l.detalhe); det = o.nome || o.login || Object.entries(o).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' · '); } catch { /* texto */ }
      return { l, det: String(det || '').slice(0, 160) }; });
    const desenhar = () => {
      const q = norm($('#logQ').value);
      const f = linhas.filter((x) => !q || norm(`${x.l.usuario} ${x.l.acao} ${x.det}`).includes(q));
      $('#logLista').innerHTML = f.length ? f.map((x) => `<div class="marco"><span><b>${esc(x.l.usuario)}</b> ${esc(x.l.acao)}${x.det ? ` <span class="dado">· ${esc(x.det)}</span>` : ''}
        <small>${new Date(x.l.quando).toLocaleString('pt-BR')}</small></span></div>`).join('') : '<p class="vazio">Nada com esse filtro.</p>';
    };
    $('#logQ').oninput = desenhar; desenhar();
  }
};

// ═════════════ MUTIRÃO DE FOTOS ═════════════
// Um cartão por aluno: a foto (quando está na pasta), foto tirada e os 3 sistemas. Marcar não recarrega a tela.
const FOTOS_PASSO = 60;
TELAS.fotos = async (c) => {
  const d = await api('GET', '/api/fotos/mutirao');
  const [S1, S2, S3] = d.sistemas;
  const SIS = [['tirada', 'Foto tirada'], ['acadesc', S1], ['sed', S2], ['lanche', S3]];
  const turmas = porTurma(d.linhas);
  let situacao = '', mostrar = FOTOS_PASSO, filtrados = [];
  c.innerHTML = cabecalho('Mutirão de fotos', `A foto precisa estar nos 3 sistemas: ${esc(S1)}, ${esc(S2)} e ${esc(S3)}.`,
    `<button class="btn" id="imp">${icone('documentos')}Lista para o mutirão</button><button class="btn ama" id="lote">${icone('ok')}Marcar filtrados…</button>`)
    + `<div class="grade g4 numeros" id="fNum"></div>
    ${d.resumo.com_arquivo ? '' : `<p class="dica" style="margin:0 0 14px">O app não encontrou nenhum arquivo de foto ${d.pastas ? 'nas pastas configuradas' : '(as pastas ainda não foram configuradas em Configurações › Geral)'} —
      é o normal fora do computador da escola. A conferência continua valendo pelas marcações dos cartões.</p>`}
    <div class="barra-filtros"><label class="procura"><input id="fq" placeholder="Buscar aluno ou matrícula" aria-label="Buscar aluno ou matrícula"></label>
      <div class="seg" id="fs" role="group" aria-label="Situação">${[['', 'Todos'], ['sem', 'Sem foto'], ['incompleto', 'Falta em algum sistema'], ['completo', 'Completos']]
        .map(([k, n]) => `<button data-s="${k}" aria-pressed="${k === ''}">${n}</button>`).join('')}</div>
      <select id="ft" aria-label="Turma"><option value="">Todas as turmas</option>${turmas.map((t) => `<option>${esc(t.turma)}</option>`).join('')}</select></div>
    <div class="fotos-grade" id="fGrade"></div><div class="mais-fotos" id="fMais"></div>`;

  const numeros = () => {
    const L = d.linhas, total = L.length, comp = L.filter((l) => l.completo).length, sem = L.filter((l) => !l.tirada).length, falt = L.filter((l) => l.tirada && !l.completo).length;
    $('#fNum').innerHTML = `<div class="cartao kpi ok"><div class="rot">Completos</div><div class="val">${comp}<small>/ ${total}</small></div><div class="det">foto nos 3 sistemas · ${d.resumo.com_arquivo} com arquivo na pasta</div></div>
      <div class="cartao kpi ${sem ? 'alerta' : ''}"><div class="rot">Ainda sem foto</div><div class="val">${sem}</div><div class="det">precisam ser fotografados</div></div>
      <div class="cartao kpi"><div class="rot">Falta em algum sistema</div><div class="val">${falt}</div><div class="det">já têm foto</div></div>
      ${SIS.slice(1).map(([k, n]) => `<div class="cartao kpi"><div class="rot">${esc(n)}</div><div class="val">${L.filter((l) => l[k]).length}</div><div class="det">com foto</div></div>`).join('')}`;
  };
  const cartao = (l) => `<article class="foto-cartao ${l.completo ? 'completo' : ''}" data-a="${l.aluno_id}">
      <div class="foto-quadro ${l.tem_arquivo || l.tirada ? '' : 'sem'}">${l.tem_arquivo ? `<img src="/api/foto/${encodeURIComponent(l.mat)}" alt="Foto de ${esc(titulo(l.nome))}" loading="lazy">`
        : l.tirada ? esc(iniciais(l.nome)) : 'Sem foto<br>tirar no mutirão'}${l.data_foto ? `<span class="selo-foto">${dataBR(l.data_foto)}</span>` : ''}</div>
      <div class="quem-foto"><b><a href="#/aluno/${l.aluno_id}">${esc(titulo(l.nome))}</a></b><small>${esc(l.turma_rotulo)} · <span class="mono">${esc(l.mat || '—')}</span></small></div>
      <div class="sistemas">${SIS.map(([k, n]) => `<button type="button" data-k="${k}" aria-pressed="${!!l[k]}" aria-label="${esc(n)}: ${esc(titulo(l.nome))}">${esc(n)}</button>`).join('')}</div>
      <input data-k="obs" value="${esc(l.obs || '')}" placeholder="observação" aria-label="Observação sobre a foto de ${esc(titulo(l.nome))}"></article>`;
  const desenhar = () => {
    const ft = $('#ft').value, q = norm($('#fq').value);
    filtrados = d.linhas.filter((l) => (!ft || l.turma_rotulo === ft) && (!q || norm(l.nome + ' ' + (l.mat || '')).includes(q))
      && (!situacao || (situacao === 'sem' && !l.tirada) || (situacao === 'completo' && l.completo) || (situacao === 'incompleto' && l.tirada && !l.completo)));
    $('#fGrade').innerHTML = filtrados.length ? filtrados.slice(0, mostrar).map(cartao).join('') : '<div class="cartao" style="grid-column:1/-1"><p class="vazio">Ninguém com esses filtros.</p></div>';
    const resta = filtrados.length - mostrar;
    $('#fMais').innerHTML = resta > 0 ? `<button class="btn" id="maisF">Mostrar mais ${Math.min(resta, FOTOS_PASSO)}</button><button class="btn" id="todosF">Mostrar todos (${filtrados.length})</button>` : '';
    if ($('#maisF')) { $('#maisF').onclick = () => { mostrar += FOTOS_PASSO; desenhar(); }; $('#todosF').onclick = () => { mostrar = filtrados.length; desenhar(); }; }
    numeros();
  };
  const salvar = tentar(async (el) => {
    const card = el.closest('[data-a]'), id = +card.dataset.a, l = d.linhas.find((x) => x.aluno_id === id), k = el.dataset.k;
    const botao = el.tagName === 'BUTTON', v = botao ? el.getAttribute('aria-pressed') !== 'true' : el.value;
    if (botao) el.setAttribute('aria-pressed', String(v));
    try { await api('PUT', '/api/fotos/mutirao/' + id, { [k]: v }); } catch (e) { if (botao) el.setAttribute('aria-pressed', String(!v)); throw e; }
    l[k] = botao ? !!v : v;
    // Mesma regra do servidor: se já foi para algum sistema, a foto existe; completo = nos 3 sistemas
    l.tirada = !!(l.tirada || l.acadesc || l.sed || l.lanche);
    l.completo = !!(l.acadesc && l.sed && l.lanche);
    toast('Salvo');
    if (botao) setTimeout(() => { const atual = $(`.foto-cartao[data-a="${id}"]`, c); if (atual) atual.outerHTML = cartao(l); numeros(); }, 200);
  });
  $('#fGrade').addEventListener('click', (e) => { const b = e.target.closest('.sistemas [data-k]'); if (b) salvar(b); });
  $('#fGrade').addEventListener('change', (e) => { if (e.target.matches('input[data-k="obs"]')) salvar(e.target); });
  $('#fq').oninput = () => { mostrar = FOTOS_PASSO; desenhar(); };
  $('#ft').onchange = () => { mostrar = FOTOS_PASSO; desenhar(); };
  $('#fs').onclick = (e) => { const b = e.target.closest('[data-s]'); if (!b) return; situacao = b.dataset.s; mostrar = FOTOS_PASSO; $$('#fs button').forEach((x) => x.setAttribute('aria-pressed', x === b)); desenhar(); };
  $('#lote').onclick = () => {
    if (!filtrados.length) return toast('Nenhum aluno filtrado', true);
    modal(`Marcar ${filtrados.length} aluno(s)`, `<p>Vale para todos os alunos da lista filtrada agora (inclusive os que ainda não apareceram na tela).</p>
      ${SIS.map(([k, n]) => `<label class="chk" style="display:flex;margin:8px 0"><input type="checkbox" class="interruptor" id="m_${k}"> ${k === 'tirada' ? 'Foto tirada' : 'Inserida no ' + esc(n)}</label>`).join('')}
      <p class="dica">Só o que você ligar aqui será alterado.</p>
      <div class="rodape"><button type="button" class="btn" data-fechar>Cancelar</button><button class="btn pri" id="ok">Marcar</button></div>`,
    { onAbrir: (el, fechar) => {
      $('#ok', el).onclick = tentar(async () => {
        const corpo = { alunos: filtrados.map((l) => l.aluno_id) };
        SIS.forEach(([k]) => { if ($('#m_' + k, el).checked) corpo[k] = true; });
        if (Object.keys(corpo).length === 1) return toast('Escolha ao menos uma marcação', true);
        await api('POST', '/api/fotos/mutirao/lote', corpo);
        fechar(); toast('Marcados'); rotear();
      });
    } });
  };
  $('#imp').onclick = () => abrirDoc({ tipo: 'mutirao_fotos', turma: $('#ft').value, filtro: situacao });
  desenhar();
};

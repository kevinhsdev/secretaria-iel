// Secretaria IEL — Etapa 2: documentos, atividades extras, ingressos e bolsas (CEBAS)
'use strict';

const abrirDoc = (params) => window.open('doc.html?' + new URLSearchParams(params), '_blank');
const moedaBR = (n) => (n == null || n === '' ? '—' : 'R$ ' + Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2 }));

async function baixar(url, nomeArquivo) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error((await resp.json().catch(() => ({}))).erro || 'Erro ao gerar arquivo');
  const link = document.createElement('a');
  link.href = URL.createObjectURL(await resp.blob());
  link.download = nomeArquivo;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 5000);
}

const TIPOS_DOC = [
  ['escolaridade', '📄 Declaração de escolaridade'], ['vaga', '📄 Declaração de vaga'], ['transferencia', '📄 Declaração de transferência'],
  ['conclusao', '📄 Declaração de conclusão'], ['comparecimento', '📄 Declaração de comparecimento'], ['pagamento', '💲 Declaração de pagamento', true],
  ['termo_saida', '✍️ Autorização de saída'], ['termo_canc_matricula', '✍️ Cancelamento de matrícula'], ['termo_canc_extra', '✍️ Cancelamento de atividade extra'],
  ['termo_canc_bolsa', '✍️ Cancelamento de bolsa'], ['carteirinha', '🪪 Carteirinha olímpica'],
];

// Campo de busca de aluno reaproveitável (retorna o aluno escolhido)
function seletorAluno(el, aoEscolher, placeholder = 'Digite o nome do aluno…') {
  el.innerHTML = `<div class="busca" style="width:100%;margin:0"><input placeholder="${esc(placeholder)}" autocomplete="off" style="width:100%;padding:8px 10px 8px 34px;border:1px solid var(--borda);border-radius:8px">
    <div class="resultados" hidden></div></div>`;
  const inp = $('input', el), res = $('.resultados', el);
  inp.oninput = tentar(async () => {
    const q = norm(inp.value.trim());
    if (q.length < 2) { res.hidden = true; return; }
    const l = (await alunosBusca()).filter((a) => [a.nome, a.mat, a.nome_mae, a.nome_resp].some((v) => norm(v).includes(q))).slice(0, 10);
    res.innerHTML = l.map((a) => `<a href="#" data-id="${a.id}"><b>${esc(titulo(a.nome))}</b><br><small>${esc(a.turma_rotulo)} · Mat. ${esc(a.mat || '—')}</small></a>`).join('') || '<div class="vazio">Nenhum aluno</div>';
    res.hidden = false;
    $$('a', res).forEach((x) => (x.onclick = (e) => {
      e.preventDefault();
      const a = l.find((y) => y.id === +x.dataset.id);
      inp.value = titulo(a.nome); res.hidden = true; aoEscolher(a);
    }));
  });
}

// ───────────── Ficha do aluno: documentos + atividades extras ─────────────
window.fichaEtapa2 = async (el, a) => {
  const ano = new Date().getFullYear();
  const inscr = await api('GET', `/api/inscricoes?aluno=${a.id}`);
  el.innerHTML = `<div class="grade g2" style="margin-top:14px">
    <div class="cartao"><h2>🖨️ Documentos</h2><div class="acoes">
      ${TIPOS_DOC.filter((t) => !t[2] || EU.perfil === 'admin').map(([t, n]) => `<button class="btn peq" data-doc="${t}">${n}</button>`).join('')}</div>
      <p class="dado" style="margin-top:10px">O documento abre numa nova aba, já preenchido. Confira, ajuste se precisar e imprima.</p></div>
    <div class="cartao"><div class="acoes" style="justify-content:space-between"><h2 style="margin:0">🩰 Atividades extras</h2><button class="btn peq ama" id="insc">＋ Inscrever</button></div>
      ${inscr.length ? `<table style="margin-top:10px"><tbody>${inscr.map((i) => `<tr><td><b>${esc(i.atividade)}</b> <span class="dado">${i.ano}</span><br>
        <small class="dado">${i.parcelas || '?'}x ${moedaBR(i.valor_parcela)} · 1º venc. ${dataBR(i.primeiro_venc)}${i.desconto_folha ? ' · desconto em folha' : ''}</small>
        ${i.status === 'cancelada' ? `<br><small style="color:var(--vermelho)">Cancelada em ${dataBR(i.data_cancelamento)}${i.motivo ? ' — ' + esc(i.motivo) : ''}</small>` : ''}</td>
        <td class="acoes" style="justify-content:flex-end">${i.status === 'ativa' ? `<button class="btn peq" data-contrato="${i.id}">Contrato</button><button class="btn peq perigo" data-cancelar="${i.id}">Cancelar</button>`
          : `<span class="tag t-nao_renova">cancelada</span><button class="btn peq" data-termo="${i.id}">Termo</button>`}</td></tr>`).join('')}</tbody></table>`
        : `<p class="vazio">Nenhuma atividade extra em ${ano}.</p>`}
    </div></div>`;
  $$('[data-doc]', el).forEach((b) => (b.onclick = () => abrirDoc({ tipo: b.dataset.doc, aluno: a.id })));
  $('#insc', el).onclick = () => formInscricao(a);
  $$('[data-contrato]', el).forEach((b) => (b.onclick = tentar(async () => {
    const i = inscr.find((x) => x.id === +b.dataset.contrato);
    await baixar(`/api/inscricoes/${i.id}/contrato`, `CONTRATO ${i.atividade.toUpperCase()} ${i.ano} - ${titulo(a.nome)}.xlsx`);
    toast('Contrato gerado! Abra no Excel, confira e imprima.');
  })));
  $$('[data-cancelar]', el).forEach((b) => (b.onclick = () => cancelarInscricao(inscr.find((x) => x.id === +b.dataset.cancelar), a)));
  $$('[data-termo]', el).forEach((b) => (b.onclick = () => { const i = inscr.find((x) => x.id === +b.dataset.termo); abrirDoc({ tipo: 'termo_canc_extra', aluno: a.id, atividade_nome: i.atividade, motivo: i.motivo || '' }); }));
};

async function formInscricao(alunoFixo, atividadeFixa) {
  const ativs = (await api('GET', '/api/atividades')).filter((t) => t.ativo);
  let aluno = alunoFixo;
  modal('Inscrição em atividade extra', `<form id="fi">
    ${alunoFixo ? `<p><b>${esc(titulo(alunoFixo.nome))}</b> · ${esc(alunoFixo.turma_rotulo || '')}</p>` : '<div class="campo"><label>Aluno *</label><div id="selAl"></div></div>'}
    <div class="campos" style="margin-top:10px">
      <div class="campo"><label>Atividade *</label><select id="i_at">${ativs.map((t) => `<option value="${t.id}" ${atividadeFixa === t.id ? 'selected' : ''}>${esc(t.nome)} (${esc(t.publico || '')})${t.vagas ? ` · ${t.inscritos}/${t.vagas}` : ''}</option>`).join('')}</select></div>
      <div class="campo"><label>Data da inscrição</label><input type="date" id="i_dt" value="${hojeIso()}"></div>
      <div class="campo"><label>Nº de parcelas</label><input type="number" id="i_pa" min="1" max="12"></div>
      <div class="campo"><label>Valor da parcela (R$)</label><input type="number" step="0.01" id="i_va"></div>
      <div class="campo"><label>1º vencimento</label><input type="date" id="i_pv"></div>
    </div>
    <label style="display:block;margin-top:10px"><input type="checkbox" id="i_df"> Desconto em folha de pagamento (filho de funcionário)</label>
    <div class="campo" style="margin-top:10px"><label>Observação</label><input id="i_ob"></div>
    <p class="dica" id="i_info"></p>
    <div class="rodape"><button type="button" class="btn" data-fechar>Cancelar</button><button class="btn pri">Inscrever</button></div></form>`,
  { onAbrir: (el, fechar) => {
    if (!alunoFixo) seletorAluno($('#selAl', el), (x) => { aluno = x; });
    const recalc = tentar(async () => {
      const t = ativs.find((x) => x.id === +$('#i_at', el).value);
      const c = await api('GET', `/api/inscricoes/calculo?atividade=${t.id}&data=${$('#i_dt', el).value}`);
      $('#i_pa', el).value = c.parcelas; $('#i_va', el).value = c.valor_parcela ?? ''; $('#i_pv', el).value = c.primeiro_venc;
      $('#i_info', el).innerHTML = `${esc(t.nome)}: ${esc(t.dias || '')} ${t.horario ? '· ' + esc(t.horario) : ''} · prof. ${esc(t.professor || '—')}.<br>
        Pela regra da planilha: parcelas do mês da inscrição até ${['', 'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'][+EU.config.extras_ultimo_mes || 11]}, vencimento dia ${esc(EU.config.extras_dia_venc || 10)}. Pode ajustar.`;
    });
    $('#i_at', el).onchange = recalc; $('#i_dt', el).onchange = recalc; recalc();
    $('#fi', el).onsubmit = tentar(async (ev) => {
      ev.preventDefault();
      if (!aluno) return toast('Escolha o aluno', true);
      const corpo = { aluno_id: aluno.id, atividade_id: +$('#i_at', el).value, data_inscricao: $('#i_dt', el).value, parcelas: $('#i_pa', el).value,
        valor_parcela: $('#i_va', el).value, primeiro_venc: $('#i_pv', el).value, desconto_folha: $('#i_df', el).checked, obs: $('#i_ob', el).value };
      try { await api('POST', '/api/inscricoes', corpo); }
      catch (e) {
        if (!/vagas preenchidas/.test(e.message) || !(await confirmar(e.message + '. Inscrever mesmo assim?', 'Inscrever'))) throw e;
        await api('POST', '/api/inscricoes', { ...corpo, ignorar_vagas: true });
      }
      fechar(); toast('Inscrição feita! Gere o contrato e lance os boletos no ACADESC.'); rotear();
    });
  } });
}

function cancelarInscricao(i, a) {
  modal('Cancelar ' + i.atividade, `<form id="fc"><p>${esc(titulo(a?.nome || i.aluno))}</p>
    <div class="campos"><div class="campo"><label>Data do cancelamento</label><input type="date" id="c_dt" value="${hojeIso()}"></div></div>
    <div class="campo" style="margin-top:10px"><label>Motivo</label><input id="c_mo" placeholder="Ex.: horário não compatível"></div>
    <p class="dica">Depois de cancelar, <b>cancele os boletos em aberto no ACADESC</b>. O termo de cancelamento abre para o responsável assinar.</p>
    <div class="rodape"><button type="button" class="btn" data-fechar>Voltar</button><button class="btn perigo">Cancelar inscrição</button></div></form>`,
  { onAbrir: (el, fechar) => {
    $('#fc', el).onsubmit = tentar(async (ev) => {
      ev.preventDefault();
      const motivo = $('#c_mo', el).value.trim();
      await api('POST', `/api/inscricoes/${i.id}/cancelar`, { data: $('#c_dt', el).value, motivo });
      fechar(); toast('Inscrição cancelada');
      abrirDoc({ tipo: 'termo_canc_extra', aluno: i.aluno_id, atividade_nome: i.atividade, motivo });
      rotear();
    });
  } });
}

// ───────────── Documentos ─────────────
TELAS.documentos = async (c) => {
  const [turmas, emissoes] = await Promise.all([api('GET', '/api/documentos/turmas'), api('GET', '/api/emissoes')]);
  const d = new Date();
  c.innerHTML = `<h1>Documentos</h1><p class="sub">Declarações, termos, carteirinhas e livro ponto com 1 clique. Tudo sai com o papel timbrado da OASE.</p>
  <div class="grade g2">
    <div class="cartao"><h2>📄 Documento de um aluno</h2>
      <div class="campo"><label>Aluno</label><div id="selDoc"></div></div>
      <div class="acoes" style="margin-top:12px" id="botoesDoc"><p class="dado">Escolha o aluno para ver os documentos.</p></div></div>
    <div class="cartao"><h2>🪪 Carteirinhas olímpicas por turma</h2>
      <div class="acoes"><select id="turmaCart">${turmas.map((t) => `<option value="${t.serie_chave}|${esc(t.turma)}">${esc(t.rotulo)} (${t.n})</option>`).join('')}</select>
      <button class="btn pri" id="gerarCart">Gerar carteirinhas</button></div>
      <p class="dado" style="margin-top:8px">8 por folha A4, com foto quando houver. Dá para escolher alunos e categorias antes de imprimir.</p>
      <h2 style="margin-top:20px">🕒 Livro ponto</h2>
      <div class="acoes"><select id="lpMes">${['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'].map((m, i) => `<option value="${i + 1}" ${i === d.getMonth() ? 'selected' : ''}>${m}</option>`).join('')}</select>
        <input type="number" id="lpAno" value="${d.getFullYear()}" style="width:90px"><button class="btn pri" id="gerarLp">Gerar folhas</button>
        ${EU.perfil === 'admin' ? '<button class="btn" id="func">Funcionários e feriados</button>' : ''}</div></div>
  </div>
  <div class="cartao" style="margin-top:14px"><h2>Documentos emitidos recentemente</h2>
    <div class="tabela-wrap"><table><thead><tr><th>Quando</th><th>Quem</th><th>Documento</th><th>Aluno</th></tr></thead><tbody>
    ${emissoes.length ? emissoes.slice(0, 60).map((e) => `<tr><td class="dado">${new Date(e.quando).toLocaleString('pt-BR')}</td><td>${esc(e.usuario)}</td><td>${esc(e.tipo)}${e.descricao ? ` <span class="dado">${esc(e.descricao)}</span>` : ''}</td>
      <td>${e.aluno_id ? `<a href="#/aluno/${e.aluno_id}">${esc(titulo(e.aluno || ''))}</a>` : '—'}</td></tr>`).join('') : '<tr><td colspan="4" class="vazio">Nenhum documento emitido ainda.</td></tr>'}
    </tbody></table></div></div>`;
  seletorAluno($('#selDoc'), (a) => {
    $('#botoesDoc').innerHTML = TIPOS_DOC.filter((t) => !t[2] || EU.perfil === 'admin').map(([t, n]) => `<button class="btn peq" data-doc="${t}">${n}</button>`).join('');
    $$('[data-doc]').forEach((b) => (b.onclick = () => abrirDoc({ tipo: b.dataset.doc, aluno: a.id })));
  });
  $('#gerarCart').onclick = () => { const [serie, turma] = $('#turmaCart').value.split('|'); abrirDoc({ tipo: 'carteirinha', serie, turma }); };
  $('#gerarLp').onclick = () => abrirDoc({ tipo: 'ponto', mes: $('#lpMes').value, ano: $('#lpAno').value });
  if ($('#func')) $('#func').onclick = tentar(janelaFuncionarios);
};

async function janelaFuncionarios() {
  const [func, fer] = await Promise.all([api('GET', '/api/funcionarios'), api('GET', '/api/feriados')]);
  const ano = new Date().getFullYear();
  modal('Funcionários e feriados', `<h3>Funcionários (livro ponto)</h3>
    <table><tbody>${func.map((f) => `<tr><td>${esc(f.nome)}</td><td><input data-cargo="${f.id}" value="${esc(f.cargo || '')}" placeholder="cargo" style="width:130px"></td>
      <td><button class="btn peq" data-ativo="${f.id}" data-v="${f.ativo ? 0 : 1}">${f.ativo ? 'Desativar' : 'Reativar'}</button></td></tr>`).join('')}</tbody></table>
    <form id="nf" class="acoes" style="margin-top:8px"><input id="nfn" placeholder="Nome completo" required style="flex:1"><button class="btn">Adicionar</button></form>
    <h3 style="margin-top:18px">Feriados de ${ano} e ${ano + 1}</h3>
    <p class="dado">Já vêm os nacionais e o 9 de julho (SP). Inclua os municipais de Ferraz de Vasconcelos e as pontes/recessos da escola.</p>
    <div style="max-height:200px;overflow:auto"><table><tbody>${fer.filter((f) => f.data >= `${ano}-01-01`).map((f) => `<tr><td>${dataBR(f.data)}</td><td>${esc(f.nome)}</td><td><button class="btn peq perigo" data-delf="${f.data}">Excluir</button></td></tr>`).join('')}</tbody></table></div>
    <form id="nfe" class="acoes" style="margin-top:8px"><input type="date" id="fd" required><input id="fn" placeholder="Nome do feriado" required style="flex:1"><button class="btn">Adicionar</button></form>`,
  { onAbrir: (el, fechar) => {
    const reabrir = () => { fechar(); janelaFuncionarios(); };
    $$('[data-cargo]', el).forEach((i) => (i.onchange = tentar(async () => { await api('PUT', '/api/funcionarios/' + i.dataset.cargo, { cargo: i.value }); toast('Salvo'); })));
    $$('[data-ativo]', el).forEach((b) => (b.onclick = tentar(async () => { await api('PUT', '/api/funcionarios/' + b.dataset.ativo, { ativo: b.dataset.v === '1' }); reabrir(); })));
    $('#nf', el).onsubmit = tentar(async (e) => { e.preventDefault(); await api('POST', '/api/funcionarios', { nome: $('#nfn', el).value }); reabrir(); });
    $$('[data-delf]', el).forEach((b) => (b.onclick = tentar(async () => { await api('DELETE', '/api/feriados/' + b.dataset.delf); reabrir(); })));
    $('#nfe', el).onsubmit = tentar(async (e) => { e.preventDefault(); await api('POST', '/api/feriados', { data: $('#fd', el).value, nome: $('#fn', el).value }); reabrir(); });
  } });
}

// ───────────── Atividades extras ─────────────
TELAS.extras = async (c, aba = 'inscricoes') => {
  const ano = new Date().getFullYear();
  const ABAS = { inscricoes: 'Inscrições', eventos: 'Ingressos e eventos', atividades: 'Atividades e valores' };
  c.innerHTML = `<div class="acoes" style="justify-content:space-between"><div><h1>Atividades extras</h1><p class="sub">Ballet, judô, futsal, recreação e apresentações · ${ano}</p></div>
    <button class="btn ama" id="novaInsc">＋ Nova inscrição</button></div>
    <div class="abas">${Object.entries(ABAS).map(([k, v]) => `<button data-aba="${k}" class="${aba === k ? 'on' : ''}">${v}</button>`).join('')}</div><div id="aba"></div>`;
  $$('[data-aba]').forEach((b) => (b.onclick = () => (location.hash = '#/extras/' + b.dataset.aba)));
  $('#novaInsc').onclick = () => formInscricao();
  const el = $('#aba');

  if (aba === 'inscricoes') {
    const [ativs, lista] = await Promise.all([api('GET', '/api/atividades?ano=' + ano), api('GET', '/api/inscricoes?ano=' + ano)]);
    let sel = null;
    el.innerHTML = `<div class="grade g4">${ativs.filter((t) => t.ativo).map((t) => `<div class="cartao kpi" data-at="${t.id}" style="cursor:pointer" tabindex="0">
      <div class="rot">${esc(t.nome)}</div><div class="val" style="font-size:24px">${t.inscritos}${t.vagas ? `<small style="font-size:13px;color:var(--texto-2)"> / ${t.vagas}</small>` : ''}</div>
      <div class="det">${esc(t.publico || '')}<br>${esc(t.dias || '')} ${t.horario ? '· ' + esc(t.horario) : ''}<br>Prof. ${esc(t.professor || '—')} · ${moedaBR(t.valor)}/mês</div></div>`).join('')}</div>
      <div class="cartao" style="margin-top:14px"><div class="filtros"><h2 style="margin:0;flex:1" id="tl">Todas as inscrições</h2>
        <select id="fs"><option value="ativa">Ativas</option><option value="cancelada">Canceladas</option><option value="">Todas</option></select>
        <button class="btn peq" id="chamada" hidden>🖨️ Lista de chamada</button><button class="btn peq" id="todas">Todas as atividades</button></div>
        <div class="tabela-wrap"><table><thead><tr><th>Aluno</th><th>Turma</th><th>Atividade</th><th>Inscrição</th><th>Parcelas</th><th>Situação</th><th></th></tr></thead><tbody id="tb"></tbody></table></div></div>`;
    const desenhar = () => {
      const fs = $('#fs').value;
      const f = lista.filter((i) => (!sel || i.atividade_id === sel) && (!fs || i.status === fs));
      $('#tl').textContent = sel ? ativs.find((t) => t.id === sel).nome : 'Todas as inscrições';
      $('#chamada').hidden = !sel;
      $('#tb').innerHTML = f.length ? f.map((i) => `<tr><td><a href="#/aluno/${i.aluno_id}"><b>${esc(titulo(i.aluno))}</b></a>${i.filho_funcionario ? ' <span class="tag t-func">func.</span>' : ''}</td>
        <td>${esc(i.turma_rotulo)}</td><td>${esc(i.atividade)}</td><td>${dataBR(i.data_inscricao)}</td><td>${i.parcelas || '?'}x ${moedaBR(i.valor_parcela)}${i.desconto_folha ? ' <span class="dado">(folha)</span>' : ''}</td>
        <td>${i.status === 'ativa' ? '<span class="tag t-concluida">ativa</span>' : `<span class="tag t-nao_renova">cancelada</span><br><small class="dado">${dataBR(i.data_cancelamento)}</small>`}</td>
        <td class="acoes">${i.status === 'ativa' ? `<button class="btn peq" data-contrato="${i.id}">Contrato</button><button class="btn peq perigo" data-cancelar="${i.id}">Cancelar</button>`
          : `<button class="btn peq" data-reativar="${i.id}">Reativar</button>`}</td></tr>`).join('') : '<tr><td colspan="7" class="vazio">Nenhuma inscrição.</td></tr>';
      $$('[data-contrato]').forEach((b) => (b.onclick = tentar(async () => {
        const i = lista.find((x) => x.id === +b.dataset.contrato);
        await baixar(`/api/inscricoes/${i.id}/contrato`, `CONTRATO ${i.atividade.toUpperCase()} ${i.ano} - ${titulo(i.aluno)}.xlsx`); toast('Contrato gerado!');
      })));
      $$('[data-cancelar]').forEach((b) => (b.onclick = () => cancelarInscricao(lista.find((x) => x.id === +b.dataset.cancelar))));
      $$('[data-reativar]').forEach((b) => (b.onclick = tentar(async () => { await api('POST', `/api/inscricoes/${b.dataset.reativar}/reativar`); toast('Reativada'); rotear(); })));
    };
    $$('[data-at]').forEach((k) => (k.onclick = k.onkeydown = (e) => { if (e.type === 'keydown' && e.key !== 'Enter') return; sel = +k.dataset.at; desenhar(); }));
    $('#todas').onclick = () => { sel = null; desenhar(); };
    $('#fs').onchange = desenhar;
    $('#chamada').onclick = () => abrirDoc({ tipo: 'chamada', atividade: sel, ano });
    desenhar();
  }

  if (aba === 'eventos') {
    const evs = await api('GET', '/api/eventos');
    el.innerHTML = `<div class="acoes" style="margin-bottom:12px"><button class="btn" id="novoEv">＋ Novo evento</button></div>
      <div class="grade g4">${evs.map((e) => `<div class="cartao kpi" data-ev="${e.id}" style="cursor:pointer"><div class="rot">${esc(e.nome)}</div>
        <div class="val" style="font-size:24px">${e.total}<small style="font-size:13px;color:var(--texto-2)"> ingressos</small></div><div class="det">${e.data ? dataBR(e.data) + ' · ' : ''}${e.retirados} famílias já retiraram${e.limite_por_aluno ? ` · até ${e.limite_por_aluno} por aluno` : ''}</div></div>`).join('')
        || '<p class="vazio">Nenhum evento. Crie a apresentação do balé ou a festa junina.</p>'}</div><div id="evDet"></div>`;
    $('#novoEv').onclick = () => modal('Novo evento', `<form id="fe"><div class="campos"><div class="campo"><label>Nome *</label><input id="en" required placeholder="Apresentação de Balé ${ano}"></div>
      <div class="campo"><label>Data</label><input type="date" id="ed"></div><div class="campo"><label>Limite de ingressos por aluno</label><input type="number" id="el" min="1"></div></div>
      <div class="rodape"><button type="button" class="btn" data-fechar>Cancelar</button><button class="btn pri">Criar</button></div></form>`,
    { onAbrir: (m, fechar) => { $('#fe', m).onsubmit = tentar(async (ev) => { ev.preventDefault(); await api('POST', '/api/eventos', { nome: $('#en', m).value, data: $('#ed', m).value, limite_por_aluno: $('#el', m).value }); fechar(); rotear(); }); } });
    $$('[data-ev]').forEach((k) => (k.onclick = tentar(() => detalheEvento(+k.dataset.ev, 'ballet'))));
    if (evs[0]) detalheEvento(evs[0].id, 'ballet');
  }

  if (aba === 'atividades') {
    const ativs = await api('GET', '/api/atividades?ano=' + ano);
    const adm = EU.perfil === 'admin';
    el.innerHTML = `<div class="cartao tabela-wrap"><p>${adm ? 'Edite direto na tabela; salva sozinho.' : 'Só a administração altera valores e horários.'} Estes dados vão para o contrato da atividade.</p>
      <table><thead><tr><th>Atividade</th><th>Público</th><th>Dias</th><th>Horário</th><th>Valor/mês</th><th>Professor(a)</th><th>Vagas</th><th>Ativa</th></tr></thead><tbody>
      ${ativs.map((t) => `<tr data-t="${t.id}">${['nome', 'publico', 'dias', 'horario'].map((k) => `<td><input data-k="${k}" value="${esc(t[k] || '')}" ${adm ? '' : 'disabled'} style="width:100%"></td>`).join('')}
        <td><input type="number" step="0.01" data-k="valor" value="${t.valor ?? ''}" ${adm ? '' : 'disabled'} style="width:90px"></td><td><input data-k="professor" value="${esc(t.professor || '')}" ${adm ? '' : 'disabled'} style="width:110px"></td>
        <td><input type="number" data-k="vagas" value="${t.vagas ?? ''}" ${adm ? '' : 'disabled'} style="width:70px"></td><td><input type="checkbox" data-k="ativo" ${t.ativo ? 'checked' : ''} ${adm ? '' : 'disabled'}></td></tr>`).join('')}
      </tbody></table>${adm ? '<div class="acoes" style="margin-top:10px"><button class="btn" id="novaAt">＋ Nova atividade</button></div>' : ''}</div>`;
    $$('[data-t] [data-k]').forEach((i) => (i.onchange = tentar(async () => {
      await api('PUT', '/api/atividades/' + i.closest('tr').dataset.t, { [i.dataset.k]: i.type === 'checkbox' ? i.checked : i.value }); toast('Salvo');
    })));
    if ($('#novaAt')) $('#novaAt').onclick = tentar(async () => { await api('POST', '/api/atividades', { nome: 'Nova atividade' }); rotear(); });
  }
};

async function detalheEvento(id, filtro) {
  const d = await api('GET', `/api/eventos/${id}/ingressos?filtro=${encodeURIComponent(filtro)}`);
  const box = $('#evDet');
  if (!box) return;
  box.innerHTML = `<div class="cartao" style="margin-top:14px"><div class="filtros"><h2 style="margin:0;flex:1">${esc(d.evento.nome)}</h2>
    <select id="evF"><option value="ballet" ${filtro === 'ballet' ? 'selected' : ''}>Alunos do ballet</option><option value="extras" ${filtro === 'extras' ? 'selected' : ''}>Todas as atividades extras</option><option value="todos" ${filtro === 'todos' ? 'selected' : ''}>Todos os alunos</option></select>
    <input id="evQ" placeholder="Filtrar nome…"><button class="btn peq" id="evImp">🖨️ Lista para assinatura</button></div>
    <div class="tabela-wrap"><table><thead><tr><th>Aluno</th><th>Turma</th><th>Ingressos</th><th>Retirou?</th></tr></thead><tbody id="evTb"></tbody></table></div></div>`;
  const desenhar = () => {
    const q = norm($('#evQ').value);
    $('#evTb').innerHTML = d.alunos.filter((a) => !q || norm(a.nome).includes(q)).map((a) => `<tr><td>${esc(titulo(a.nome))}</td><td>${esc(a.turma_rotulo)}</td>
      <td><input type="number" min="0" ${d.evento.limite_por_aluno ? `max="${d.evento.limite_por_aluno}"` : ''} value="${a.quantidade || 0}" data-q="${a.id}" style="width:70px"></td>
      <td><label><input type="checkbox" data-r="${a.id}" ${a.retirado_em ? 'checked' : ''}> ${a.retirado_em ? dataBR(a.retirado_em) : ''}</label></td></tr>`).join('') || '<tr><td colspan="4" class="vazio">Ninguém nesta lista.</td></tr>';
    const salvar = (aid, corpo) => tentar(async () => {
      const al = d.alunos.find((x) => x.id === aid);
      await api('PUT', `/api/eventos/${id}/ingressos/${aid}`, { quantidade: al.quantidade || 0, ...corpo });
      Object.assign(al, corpo, corpo.retirado !== undefined ? { retirado_em: corpo.retirado ? hojeIso() : null } : {});
      toast('Salvo');
    })();
    $$('[data-q]').forEach((i) => (i.onchange = () => salvar(+i.dataset.q, { quantidade: +i.value })));
    $$('[data-r]').forEach((i) => (i.onchange = () => salvar(+i.dataset.r, { retirado: i.checked })));
  };
  $('#evF').onchange = tentar(() => detalheEvento(id, $('#evF').value));
  $('#evQ').oninput = desenhar;
  $('#evImp').onclick = () => abrirDoc({ tipo: 'ingressos', evento: id, filtro: $('#evF').value });
  desenhar();
}

// ───────────── Bolsas (CEBAS) ─────────────
TELAS.bolsas = async (c) => {
  if (EU.perfil !== 'admin') { c.innerHTML = '<div class="cartao">Os processos de bolsa têm dados socioeconômicos e ficam restritos à administração (LGPD).</div>'; return; }
  const d = await api('GET', '/api/bolsas');
  const cfg = EU.config;
  const cont = {};
  d.bolsas.forEach((b) => { cont[b.status] = (cont[b.status] || 0) + 1; });
  const obrig = d.checklist.filter((x) => !x.opcional);
  const completos = (b) => obrig.every((x) => b.checklist[x.id]);
  const tagStatus = (s) => `<span class="tag ${['concedida', 'ofertada'].includes(s) ? 't-concluida' : ['indeferida', 'sem_oferta', 'desistiu'].includes(s) ? 't-nao_renova' : 't-reservada'}">${esc(d.status[s])}</span>`;
  c.innerHTML = `<div class="acoes" style="justify-content:space-between"><div><h1>Bolsas de estudo (CEBAS) ${d.ano}</h1>
    <p class="sub">Requerimentos a partir de ${dataBR(cfg.cebas_retirada)} · entrega de ${dataBR(cfg.cebas_entrega_ini)} a ${dataBR(cfg.cebas_entrega_fim)} · resultado a partir de ${dataBR(cfg.cebas_resultado)} · prestação de contas até ${dataBR(cfg.cebas_prestacao)}</p></div>
    <div class="acoes"><label class="btn">📥 Importar Planilha Bolsas<input type="file" id="arqB" accept=".xlsx" hidden></label><button class="btn ama" id="novoB">＋ Novo processo</button></div></div>
  <div class="faixa-demo" style="background:#f3e8ff;border-color:#b58ad8;color:#4b2273">🔒 Dados socioeconômicos: uso exclusivo para análise da bolsa (LGPD, edital item 6.7). Não compartilhe prints desta tela.</div>
  <div class="grade g4">
    <div class="cartao kpi destaque"><div class="rot">Processos</div><div class="val">${d.bolsas.length}</div><div class="det">${d.bolsas.filter((b) => b.tipo === 'renovacao').length} renovações · ${d.bolsas.filter((b) => b.tipo === 'novo').length} pedidos novos</div></div>
    <div class="cartao kpi"><div class="rot">Em análise</div><div class="val">${['inscrito', 'conferido', 'assistente', 'visita'].reduce((s, k) => s + (cont[k] || 0), 0)}</div><div class="det">${d.bolsas.filter((b) => !completos(b) && ['inscrito', 'conferido'].includes(b.status)).length} com documentos faltando</div></div>
    <div class="cartao kpi"><div class="rot">Ofertadas / concedidas</div><div class="val">${(cont.ofertada || 0) + (cont.concedida || 0)}</div><div class="det">${d.bolsas.filter((b) => b.ofertado === 100 || b.aprovado === 100).length} de 100% · ${d.bolsas.filter((b) => b.ofertado === 50 || b.aprovado === 50).length} de 50%</div></div>
    <div class="cartao kpi"><div class="rot">Indeferidas / sem oferta</div><div class="val">${(cont.indeferida || 0) + (cont.sem_oferta || 0) + (cont.desistiu || 0)}</div><div class="det">${cont.concedida || 0} contratos assinados</div></div>
  </div>
  <div class="cartao" style="margin-top:14px"><div class="filtros">
    <select id="fs"><option value="">Todas as etapas</option>${Object.entries(d.status).map(([k, v]) => `<option value="${k}">${v} (${cont[k] || 0})</option>`).join('')}</select>
    <select id="ft"><option value="">Renovação e novos</option><option value="renovacao">Renovação</option><option value="novo">Pedido novo</option></select>
    <label><input type="checkbox" id="fd"> Só com documentos faltando</label><input id="fq" placeholder="Buscar aluno ou responsável…" style="flex:1;min-width:180px"></div>
    <div class="tabela-wrap"><table><thead><tr><th>Aluno</th><th>Série ${d.ano}</th><th>Responsável</th><th>Entregue em</th><th class="num-col">Per capita</th><th>Atual</th><th>Ofertado</th><th>Etapa</th><th>Docs</th></tr></thead><tbody id="tb"></tbody></table></div></div>`;
  const desenhar = () => {
    const fs = $('#fs').value, ft = $('#ft').value, fdoc = $('#fd').checked, q = norm($('#fq').value);
    const f = d.bolsas.filter((b) => (!fs || b.status === fs) && (!ft || b.tipo === ft) && (!fdoc || !completos(b)) && (!q || norm(b.nome_aluno + ' ' + (b.responsavel || '')).includes(q)));
    $('#tb').innerHTML = f.length ? f.map((b) => {
      const ok = obrig.filter((x) => b.checklist[x.id]).length;
      return `<tr class="clic" data-b="${b.id}"><td><b>${esc(titulo(b.nome_aluno))}</b>${b.tipo === 'novo' ? ' <span class="tag t-novo">novo</span>' : ''}${b.aluno_id ? '' : ' <span class="dado" title="Não vinculado a um aluno cadastrado">⚠︎</span>'}</td>
        <td>${esc(b.serie || '—')}</td><td>${esc(titulo(b.responsavel || ''))}<br><small class="dado">${esc(b.telefone || '')}</small></td><td>${dataBR(b.req_entregue) || '—'}</td>
        <td class="num-col">${b.per_capita != null ? moedaBR(b.per_capita) : '—'}</td><td>${b.percentual_atual != null ? b.percentual_atual + '%' : '—'}</td>
        <td>${b.ofertado != null ? '<b>' + b.ofertado + '%</b>' : '—'}</td><td>${tagStatus(b.status)}</td>
        <td><span class="tag ${ok === obrig.length ? 't-concluida' : 't-vencendo'}">${ok}/${obrig.length}</span></td></tr>`;
    }).join('') : '<tr><td colspan="9" class="vazio">Nenhum processo. Importe a Planilha Bolsas ou crie um novo processo.</td></tr>';
    $$('[data-b]').forEach((tr) => (tr.onclick = () => formBolsa(d, d.bolsas.find((b) => b.id === +tr.dataset.b))));
  };
  ['fs', 'ft', 'fd', 'fq'].forEach((id) => ($('#' + id).oninput = desenhar));
  $('#novoB').onclick = () => formBolsa(d);
  $('#arqB').onchange = tentar(async (e) => {
    const file = e.target.files[0]; if (!file) return;
    if (d.bolsas.length && !(await confirmar(`Já existem ${d.bolsas.length} processos. Importar vai ADICIONAR os da planilha (pode duplicar). Continuar?`, 'Importar'))) return;
    const r = await api('POST', '/api/bolsas/importar?arquivo=' + encodeURIComponent(file.name), undefined, file);
    toast(`${r.importados} processos importados (${r.vinculados} ligados a alunos cadastrados)`); rotear();
  });
  desenhar();
};

function formBolsa(d, b) {
  const novo = !b;
  b = b || { tipo: 'novo', status: 'inscrito', checklist: {}, ano: d.ano };
  const grupos = {};
  d.checklist.forEach((x) => (grupos[x.grupo] ??= []).push(x));
  const campo = (id, rot, tipo = 'text', extra = '') => `<div class="campo"><label>${rot}</label><input id="b_${id}" type="${tipo}" value="${esc(b[id] ?? '')}" ${extra}></div>`;
  modal(novo ? 'Novo processo de bolsa' : titulo(b.nome_aluno), `<form id="fb">
    ${novo ? '<div class="campo"><label>Aluno cadastrado (ou digite o nome abaixo, se for aluno novo)</label><div id="selB"></div></div>' : ''}
    <div class="campos" style="margin-top:8px">${campo('nome_aluno', 'Nome do aluno *')}${campo('serie', 'Série em ' + d.ano)}
      <div class="campo"><label>Tipo</label><select id="b_tipo"><option value="renovacao" ${b.tipo === 'renovacao' ? 'selected' : ''}>Renovação</option><option value="novo" ${b.tipo === 'novo' ? 'selected' : ''}>Pedido novo</option></select></div>
      ${campo('responsavel', 'Responsável')}${campo('telefone', 'Telefone')}${campo('escola_origem', 'Escola de origem')}
      ${campo('req_enviado', 'Requerimento enviado', 'date')}${campo('req_entregue', 'Requerimento entregue', 'date')}
      ${campo('per_capita', 'Renda per capita (R$)', 'number', 'step="0.01"')}${campo('percentual_atual', '% bolsa atual', 'number')}
      ${campo('ofertado', '% ofertado', 'number')}${campo('aprovado', '% aprovado', 'number')}
      <div class="campo"><label>Etapa</label><select id="b_status">${Object.entries(d.status).map(([k, v]) => `<option value="${k}" ${b.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
    </div>
    <div class="campo" style="margin-top:8px"><label>Endereço</label><input id="b_endereco" value="${esc(b.endereco || '')}"></div>
    <div class="campo" style="margin-top:8px"><label>Visitas domiciliares</label><input id="b_visitas" value="${esc(b.visitas || '')}" placeholder="Ex.: 2026: Sim 10/08"></div>
    <label style="display:block;margin-top:8px"><input type="checkbox" id="b_contrato" ${b.contrato_assinado ? 'checked' : ''}> Contrato da bolsa assinado</label>
    <h3 style="margin-top:14px">Documentos entregues (edital ${d.ano})</h3>
    ${Object.entries(grupos).map(([g, itens]) => `<p class="dado" style="margin:8px 0 2px"><b>${esc(g)}</b></p>${itens.map((x) => `<label style="display:block;margin:3px 0"><input type="checkbox" data-chk="${x.id}" ${b.checklist[x.id] ? 'checked' : ''}> ${esc(x.nome)}${x.opcional ? ' <span class="opcional">se houver</span>' : ''}</label>`).join('')}`).join('')}
    <div class="campo" style="margin-top:10px"><label>Observações (parecer da assistente social etc.)</label><textarea id="b_obs" style="min-height:80px">${esc(b.obs || '')}</textarea></div>
    ${b.atualizado_por ? `<p class="dado">Última alteração: ${esc(b.atualizado_por)} em ${new Date(b.atualizado_em).toLocaleString('pt-BR')}</p>` : ''}
    <div class="rodape">${novo ? '' : '<button type="button" class="btn perigo" id="delB" style="margin-right:auto">Excluir</button>'}
      ${!novo && b.aluno_id ? `<button type="button" class="btn" id="termoB">✍️ Termo de cancelamento</button>` : ''}
      <button type="button" class="btn" data-fechar>Fechar</button><button class="btn pri">Salvar</button></div></form>`,
  { onAbrir: (el, fechar) => {
    let alunoId = b.aluno_id || null;
    if (novo) seletorAluno($('#selB', el), (a) => { alunoId = a.id; $('#b_nome_aluno', el).value = a.nome; $('#b_responsavel', el).value = titulo(a.nome_resp || a.nome_mae || ''); $('#b_serie', el).value = a.destino || ''; $('#b_tipo', el).value = 'renovacao'; });
    $('#fb', el).onsubmit = tentar(async (ev) => {
      ev.preventDefault();
      const corpo = { aluno_id: alunoId, tipo: $('#b_tipo', el).value, status: $('#b_status', el).value, contrato_assinado: $('#b_contrato', el).checked, obs: $('#b_obs', el).value,
        checklist: Object.fromEntries($$('[data-chk]', el).filter((i) => i.checked).map((i) => [i.dataset.chk, true])) };
      ['nome_aluno', 'serie', 'responsavel', 'telefone', 'escola_origem', 'req_enviado', 'req_entregue', 'per_capita', 'percentual_atual', 'ofertado', 'aprovado', 'endereco', 'visitas'].forEach((k) => { corpo[k] = $('#b_' + k, el).value.trim(); });
      if (!corpo.nome_aluno) return toast('Informe o nome do aluno', true);
      if (novo) await api('POST', '/api/bolsas', corpo); else await api('PUT', '/api/bolsas/' + b.id, corpo);
      fechar(); toast('Processo salvo'); rotear();
    });
    if ($('#delB', el)) $('#delB', el).onclick = tentar(async () => { if (!(await confirmar('Excluir o processo de ' + b.nome_aluno + '?', 'Excluir'))) return; await api('DELETE', '/api/bolsas/' + b.id); fechar(); rotear(); });
    if ($('#termoB', el)) $('#termoB', el).onclick = () => abrirDoc({ tipo: 'termo_canc_bolsa', aluno: b.aluno_id });
  } });
}

// Secretaria IEL — Etapa 3: boletos, mutirão de fotos, autorização de saída, tarefas do dia, calendário e atendimentos
'use strict';

const PESSOAS = { todos: 'Toda a equipe', samara: 'Samara', duda: 'Duda', kevin: 'Kevin' };
const PERIODOS = { manha: 'manhã', tarde: 'tarde', dia: '' };
const DIAS_SEM = { 1: 'seg', 2: 'ter', 3: 'qua', 4: 'qui', 5: 'sex' };
const CANAIS_AT = { balcao: 'Secretaria', telefone: 'Telefone', whatsapp: 'WhatsApp', email: 'E-mail' };
const CANAIS_SAIDA = { whatsapp: 'WhatsApp', presencial: 'Presencial', bilhete: 'Bilhete na agenda', telefone: 'Telefone' };
const nomePessoa = (login) => PESSOAS[login] || titulo(login || '');
const pct = (n) => (n == null ? '—' : n + '%');

// Agrupa uma lista por turma, na ordem das séries
function porTurma(lista) {
  const g = new Map();
  for (const l of lista) {
    if (!g.has(l.turma_rotulo)) g.set(l.turma_rotulo, { turma: l.turma_rotulo, ordem: l.ordem ?? 99, itens: [] });
    g.get(l.turma_rotulo).itens.push(l);
  }
  return [...g.values()].sort((a, b) => a.ordem - b.ordem || a.turma.localeCompare(b.turma));
}

// ───────────── Meu dia ─────────────
TELAS.hoje = async (c, data) => {
  data = /^\d{4}-\d{2}-\d{2}$/.test(data || '') ? data : hojeIso();
  const ano = +data.slice(0, 4);
  const [r, h, cal] = await Promise.all([api('GET', '/api/rotina?data=' + data), api('GET', '/api/hoje?data=' + data), api('GET', '/api/calendario?ano=' + ano)]);
  const doMes = cal.itens.filter((i) => !i.feito && (i.do_mes || i.atrasado));
  const grupos = ['todos', ...r.pessoas.map((p) => p.login).filter((l) => l !== 'todos')];
  const tarefasDe = (login) => [
    ...r.fixas.filter((t) => t.responsavel === login).map((t) => ({ ...t, tipo: 'fixa' })),
    ...r.avulsas.filter((t) => (t.responsavel || 'todos') === login).map((t) => ({ ...t, tipo: 'avulsa' })),
  ];
  const cartaoTarefa = (t) => `<li class="${t.feito ? 'ok' : ''}">
    <input type="checkbox" data-t="${t.tipo}:${t.id}" ${t.feito ? 'checked' : ''} aria-label="${esc(t.titulo)}">
    <span class="nome"><span>${esc(t.titulo)}</span> ${t.periodo && PERIODOS[t.periodo] ? `<span class="opcional">${PERIODOS[t.periodo]}</span>` : ''}
      ${t.tipo === 'avulsa' ? '<span class="tag t-novo">do dia</span>' : ''}
      ${t.detalhe ? `<small>${esc(t.detalhe)}</small>` : ''}${t.feito && t.feito_por ? `<small>Feito por ${esc(nomePessoa(t.feito_por))}</small>` : ''}</span>
    ${t.tipo === 'avulsa' ? `<button class="btn peq perigo" data-del="${t.id}" title="Excluir">×</button>` : ''}</li>`;

  c.innerHTML = `<div class="acoes" style="justify-content:space-between"><div><h1>Meu dia</h1>
      <p class="sub">${esc(r.dia_nome)}, ${dataBR(data)} · ${r.resumo.feitas} de ${r.resumo.total} tarefas concluídas</p></div>
    <div class="acoes"><input type="date" id="dia" value="${data}"><button class="btn" id="hojeBtn">Hoje</button><button class="btn ama" id="novaT">${icone('mais')}Tarefa do dia</button></div></div>
  ${r.fim_de_semana ? '<div class="dica">Fim de semana: o cronograma da secretaria não roda hoje. Você ainda pode anotar tarefas avulsas.</div>' : ''}
  <div class="grade g4">
    <div class="cartao kpi destaque"><div class="rot">Minhas tarefas</div><div class="val">${h.tarefas.minhas_feitas}<small style="font-size:14px;color:var(--texto-2)"> / ${h.tarefas.minhas}</small></div><div class="det">do seu cronograma de hoje</div></div>
    <div class="cartao kpi ${h.saida.pendentes ? 'alerta' : ''}"><div class="rot">Avisos de saída</div><div class="val">${h.saida.total}</div><div class="det">${h.saida.pendentes} ainda não conferidos no portão</div></div>
    <div class="cartao kpi"><div class="rot">Atendimentos de hoje</div><div class="val">${h.atendimentos.hoje}</div><div class="det">${h.atendimentos.em_aberto} em aberto</div></div>
    <div class="cartao kpi"><div class="rot">Lembretes do mês</div><div class="val">${doMes.length}</div><div class="det">${cal.itens.filter((i) => i.atrasado).length} atrasados</div></div>
  </div>
  <div class="grade g2" style="margin-top:14px">
    <div class="cartao"><h2>${icone('dia')}Tarefas de ${esc(r.dia_nome.toLowerCase())}</h2>
      ${grupos.map((g) => { const ts = tarefasDe(g); if (!ts.length) return ''; return `<h3 style="margin-top:14px">${esc(nomePessoa(g))} <span class="dado">(${ts.filter((t) => t.feito).length}/${ts.length})</span></h3>
        <ul class="checklist">${ts.map(cartaoTarefa).join('')}</ul>`; }).join('') || '<p class="vazio">Nenhuma tarefa para hoje.</p>'}
      ${EU.perfil === 'admin' ? `<div class="acoes" style="margin-top:12px"><button class="btn peq" id="cron">${icone('config')}Editar o cronograma da semana</button></div>` : ''}
    </div>
    <div>
      <div class="cartao"><div class="acoes" style="justify-content:space-between"><h2 style="margin:0">${icone('portao')}Quem busca hoje</h2><a class="btn peq" href="#/portao">Abrir o portão</a></div>
        ${h.saida.avisos.length ? `<table style="margin-top:8px"><tbody>${h.saida.avisos.map((v) => `<tr><td><b>${esc(titulo(v.aluno))}</b><br><small class="dado">${esc(v.turma_rotulo)} · ${esc(titulo(v.quem))}${v.parentesco ? ' (' + esc(v.parentesco) + ')' : ''}${v.horario ? ' · ' + esc(v.horario) : ''}</small></td>
          <td class="num-col">${v.conferido_em ? '<span class="tag t-concluida">liberado</span>' : '<span class="tag t-vencendo">aguardando</span>'}</td></tr>`).join('')}</tbody></table>`
          : '<p class="vazio">Nenhum aviso para hoje.</p>'}</div>
      <div class="cartao" style="margin-top:14px"><div class="acoes" style="justify-content:space-between"><h2 style="margin:0">${icone('calendario')}Lembretes deste mês</h2><a class="btn peq" href="#/calendario">Ver o ano</a></div>
        ${doMes.length ? `<ul class="checklist">${doMes.slice(0, 8).map((i) => `<li><input type="checkbox" data-cal="${i.id}" aria-label="${esc(i.titulo)}">
          <span class="nome"><span>${esc(i.titulo)}</span> ${i.atrasado ? '<span class="tag t-vencida">atrasado</span>' : ''}
            <small>${i.dia ? 'até ' + dataBR(i.limite) : 'durante ' + esc(i.mes_nome)} · ${esc(nomePessoa(i.responsavel))}</small></span></li>`).join('')}</ul>`
          : '<p class="vazio">Nada pendente neste mês.</p>'}</div>
      <div class="cartao" style="margin-top:14px"><h2>Para não esquecer</h2>
        <p style="margin:0;color:var(--texto-2)">Alunos sem foto nos 3 sistemas: <b style="color:var(--texto)">${h.fotos.faltando}</b> · <a href="#/fotos">abrir o mutirão</a></p></div>
    </div>
  </div>`;

  $('#dia').onchange = (e) => (location.hash = '#/hoje/' + e.target.value);
  $('#hojeBtn').onclick = () => (location.hash = '#/hoje/' + hojeIso());
  $$('[data-t]', c).forEach((cb) => (cb.onchange = tentar(async () => {
    const [tipo, id] = cb.dataset.t.split(':');
    await marcarNaHora(cb, () => (tipo === 'fixa' ? api('PUT', '/api/rotina/feito/' + id, { data, feito: cb.checked })
      : api('PUT', '/api/tarefas-dia/' + id, { feito: cb.checked })));
    toast(cb.checked ? 'Feito!' : 'Desmarcado'); rotear();
  })));
  $$('[data-del]', c).forEach((b) => (b.onclick = tentar(async () => {
    if (!(await confirmar('Excluir esta tarefa do dia?', 'Excluir'))) return;
    await api('DELETE', '/api/tarefas-dia/' + b.dataset.del); toast('Excluída');
    await sumirLinha(b.closest('li')); rotear();
  })));
  $$('[data-cal]', c).forEach((cb) => (cb.onchange = tentar(async () => {
    await marcarNaHora(cb, () => api('PUT', `/api/calendario/${cb.dataset.cal}/feito`, { feito: cb.checked, ano }));
    toast('Lembrete concluído');
    if (cb.checked) await sumirLinha(cb.closest('li')); // concluído sai da lista de pendentes
    rotear();
  })));
  $('#novaT').onclick = () => formTarefaDia(data, r.pessoas);
  if ($('#cron')) $('#cron').onclick = tentar(janelaCronograma);
};

function formTarefaDia(data, pessoas) {
  modal('Nova tarefa do dia', `<form id="ft">
    <div class="campo"><label>O que precisa ser feito? *</label><input id="t_tit" required autofocus></div>
    <div class="campos" style="margin-top:10px">
      <div class="campo"><label>De quem é</label><select id="t_resp">${pessoas.map((p) => `<option value="${esc(p.login)}" ${p.login === EU.login ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}</select></div>
      <div class="campo"><label>Dia</label><input type="date" id="t_data" value="${data}"></div></div>
    <div class="rodape"><button type="button" class="btn" data-fechar>Cancelar</button><button class="btn pri">Anotar</button></div></form>`,
  { onAbrir: (el, fechar) => {
    $('#ft', el).onsubmit = tentar(async (ev) => {
      ev.preventDefault();
      await api('POST', '/api/tarefas-dia', { titulo: $('#t_tit', el).value, responsavel: $('#t_resp', el).value, data: $('#t_data', el).value });
      fechar(); toast('Tarefa anotada'); rotear();
    });
  } });
}

async function janelaCronograma() {
  const [tarefas, dia] = await Promise.all([api('GET', '/api/rotina/tarefas'), api('GET', '/api/rotina')]);
  // Quem pode receber tarefa: "toda a equipe" + os usuários cadastrados hoje
  const quem = { todos: PESSOAS.todos, ...Object.fromEntries(dia.pessoas.map((p) => [p.login, p.nome])) };
  const dias = (t) => Object.entries(DIAS_SEM).map(([n, r]) => `<label style="margin-right:6px"><input type="checkbox" data-dia="${n}" ${String(t.dias || '').split(',').includes(n) ? 'checked' : ''}> ${r}</label>`).join('');
  modal('Cronograma da semana', `<p class="dado">Quem faz o quê em cada dia. Some ou tire tarefas conforme a rotina mudar.</p>
    <div class="tabela-wrap" style="max-height:60vh;overflow:auto"><table><thead><tr><th>Tarefa</th><th>Quem</th><th>Dias</th><th>Período</th><th>Ativa</th></tr></thead><tbody>
    ${tarefas.map((t) => `<tr data-c="${t.id}"><td><input data-k="titulo" value="${esc(t.titulo)}" style="width:100%"></td>
      <td><select data-k="responsavel">${Object.entries(quem).map(([k, v]) => `<option value="${esc(k)}" ${t.responsavel === k ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></td>
      <td style="white-space:nowrap">${dias(t)}</td>
      <td><select data-k="periodo">${Object.entries({ dia: 'dia todo', manha: 'manhã', tarde: 'tarde' }).map(([k, v]) => `<option value="${k}" ${t.periodo === k ? 'selected' : ''}>${v}</option>`).join('')}</select></td>
      <td><input type="checkbox" data-k="ativo" ${t.ativo ? 'checked' : ''}></td></tr>`).join('')}
    </tbody></table></div>
    <form id="nt" class="acoes" style="margin-top:10px"><input id="ntt" placeholder="Nova tarefa do cronograma" required style="flex:1"><button class="btn">Adicionar</button></form>`,
  { onAbrir: (el, fechar) => {
    const salvar = tentar(async (tr, corpo) => { await api('PUT', '/api/rotina/tarefas/' + tr.dataset.c, corpo); toast('Salvo'); });
    $$('[data-c] [data-k]', el).forEach((i) => (i.onchange = () => salvar(i.closest('tr'), { [i.dataset.k]: i.type === 'checkbox' ? i.checked : i.value })));
    $$('[data-c] [data-dia]', el).forEach((i) => (i.onchange = () => {
      const tr = i.closest('tr');
      const ds = $$('[data-dia]', tr).filter((x) => x.checked).map((x) => x.dataset.dia).join(',');
      salvar(tr, { dias: ds });
    }));
    $('#nt', el).onsubmit = tentar(async (e) => {
      e.preventDefault();
      await api('POST', '/api/rotina/tarefas', { titulo: $('#ntt', el).value });
      fechar(); janelaCronograma();
    });
  } });
}

// ───────────── Boletos ─────────────
// Só a entrega dos boletos em papel (a conferência de descontos saiu na 4.11.0, a pedido da secretaria)
// A tela de Boletos está em telas5.js (5.1).

// ───────────── Mutirão de fotos ─────────────
// A tela do Mutirão de fotos está em telas5.js (5.2).

// ───────────── Portão · Saída ─────────────
// A tela do Portão está em telas5.js (5.1); aqui fica a janela de aviso, usada também na ficha do aluno.
function formAviso(alunoFixo) {
  let aluno = alunoFixo;
  modal('Hoje quem busca é outra pessoa', `<form id="fv">
    ${alunoFixo ? `<p><b>${esc(titulo(alunoFixo.nome))}</b></p>` : '<div class="campo"><label>Aluno *</label><div id="selAv"></div></div>'}
    <div class="campos" style="margin-top:10px">
      <div class="campo"><label>Quem vai buscar *</label><input id="v_quem" required></div>
      <div class="campo"><label>Parentesco</label><input id="v_par" placeholder="Avó, tia, vizinha…"></div>
      <div class="campo"><label>Documento (RG)</label><input id="v_doc" placeholder="confira no portão"></div>
      <div class="campo"><label>Data</label><input type="date" id="v_data" value="${hojeIso()}"></div>
      <div class="campo"><label>Horário previsto</label><input type="time" id="v_hora"></div>
      <div class="campo"><label>Como a família avisou</label><select id="v_canal">${Object.entries(CANAIS_SAIDA).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
      <div class="campo"><label>Quem avisou</label><input id="v_avisou" placeholder="mãe, pai, responsável…"></div>
    </div>
    <div class="campo" style="margin-top:10px"><label>Observação</label><input id="v_obs"></div>
    <p class="dica">Aviso por telefone não é aceito pelo termo de saída da escola. Se for o único jeito, o app pede confirmação e registra quem autorizou.</p>
    <div class="rodape"><button type="button" class="btn" data-fechar>Cancelar</button><button class="btn pri">Registrar aviso</button></div></form>`,
  { onAbrir: (el, fechar) => {
    if (!alunoFixo) seletorAluno($('#selAv', el), (x) => { aluno = x; });
    $('#fv', el).onsubmit = tentar(async (ev) => {
      ev.preventDefault();
      if (!aluno) return toast('Escolha o aluno', true);
      const corpo = { aluno_id: aluno.id, quem: $('#v_quem', el).value, parentesco: $('#v_par', el).value, documento: $('#v_doc', el).value,
        data: $('#v_data', el).value, horario: $('#v_hora', el).value, canal: $('#v_canal', el).value, quem_avisou: $('#v_avisou', el).value, obs: $('#v_obs', el).value };
      try { await api('POST', '/api/saida/avisos', corpo); }
      catch (e) {
        if (!/telefone/.test(e.message) || !(await confirmar(e.message, 'Registrar mesmo assim'))) throw e;
        await api('POST', '/api/saida/avisos', { ...corpo, confirmar_telefone: true });
      }
      fechar(); toast('Aviso registrado'); rotear();
    });
  } });
}

// ───────────── Atendimentos ─────────────
// A tela de Atendimentos está em telas5.js (5.1); aqui fica a janela de registrar/ver, usada também no Início e na ficha.
function formAtendimento(d, at, alunoFixo) {
  const novo = !at;
  at = at || { canal: 'balcao', resolvido: true, data: hojeIso(), hora: new Date().toTimeString().slice(0, 5), aluno_id: alunoFixo?.id };
  let alunoId = at.aluno_id || null;
  modal(novo ? 'Registrar atendimento' : 'Atendimento de ' + dataBR(at.data), `<form id="fa">
    ${novo && !alunoFixo ? '<div class="campo"><label>Aluno (se o atendimento for sobre um aluno)</label><div id="selAt"></div></div>'
      : `<p><b>${esc(titulo(alunoFixo?.nome || at.aluno || 'Sem aluno vinculado'))}</b></p>`}
    <div class="campos" style="margin-top:10px">
      <div class="campo"><label>Canal</label><select id="a_canal">${Object.entries(d.canais).map(([k, v]) => `<option value="${k}" ${at.canal === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      <div class="campo"><label>Quem procurou</label><input id="a_pessoa" value="${esc(at.pessoa || '')}" placeholder="mãe, pai, responsável…"></div>
      <div class="campo"><label>Telefone</label><input id="a_tel" value="${esc(at.telefone || '')}"></div>
      <div class="campo"><label>Data</label><input type="date" id="a_data" value="${esc(at.data)}"></div>
      <div class="campo"><label>Hora</label><input type="time" id="a_hora" value="${esc(at.hora || '')}"></div>
      <div class="campo"><label>Assunto</label><select id="a_cat"><option value=""></option>${d.categorias.map((x) => `<option ${at.categoria === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></div>
    </div>
    <div class="campo" style="margin-top:10px"><label>O que a pessoa precisava? *</label><input id="a_assunto" value="${esc(at.assunto || '')}" required></div>
    <div class="campo" style="margin-top:10px"><label>Detalhes</label><textarea id="a_det" style="min-height:70px">${esc(at.detalhe || '')}</textarea></div>
    <label class="chk" style="display:block;margin-top:10px"><input type="checkbox" id="a_res" ${at.resolvido ? 'checked' : ''}> Ficou resolvido na hora</label>
    <div class="campos" style="margin-top:8px"><div class="campo"><label>Se não, com quem ficou</label><input id="a_enc" value="${esc(at.encaminhado || '')}" placeholder="Samara, Direção…"></div>
      <div class="campo"><label>Retornar até</label><input type="date" id="a_ret" value="${esc(at.retorno_em || '')}"></div></div>
    ${at.usuario ? `<p class="dado" style="margin-top:8px">Atendido por ${esc(nomePessoa(at.usuario))}</p>` : ''}
    <div class="rodape">${novo ? '' : (EU.perfil === 'admin' ? '<button type="button" class="btn perigo" id="delA" style="margin-right:auto">Excluir</button>' : '')}
      <button type="button" class="btn" data-fechar>Fechar</button><button class="btn pri">Salvar</button></div></form>`,
  { onAbrir: (el, fechar) => {
    if (novo && !alunoFixo) seletorAluno($('#selAt', el), (a) => { alunoId = a.id; if (!$('#a_pessoa', el).value) $('#a_pessoa', el).value = titulo(a.nome_resp || a.nome_mae || ''); });
    $('#fa', el).onsubmit = tentar(async (ev) => {
      ev.preventDefault();
      const corpo = { aluno_id: alunoId, canal: $('#a_canal', el).value, pessoa: $('#a_pessoa', el).value, telefone: $('#a_tel', el).value,
        data: $('#a_data', el).value, hora: $('#a_hora', el).value, categoria: $('#a_cat', el).value, assunto: $('#a_assunto', el).value,
        detalhe: $('#a_det', el).value, resolvido: $('#a_res', el).checked, encaminhado: $('#a_enc', el).value, retorno_em: $('#a_ret', el).value };
      if (novo) await api('POST', '/api/atendimentos', corpo); else await salvarComVersao('/api/atendimentos/' + at.id, corpo, at);
      fechar(); toast('Atendimento registrado'); rotear();
    });
    if ($('#delA', el)) $('#delA', el).onclick = tentar(async () => {
      if (!(await confirmar('Excluir este registro de atendimento?', 'Excluir'))) return;
      await api('DELETE', '/api/atendimentos/' + at.id); fechar(); rotear();
    });
  } });
}

// ───────────── Calendário ─────────────
// A tela do Calendário está em telas5.js (5.1); aqui fica a janela de lembrete.
function formCalendario(d, item) {
  const novo = !item;
  item = item || { mes: new Date().getMonth() + 1, responsavel: 'todos' };
  modal(novo ? 'Novo lembrete' : 'Editar lembrete', `<form id="fc">
    <div class="campo"><label>Lembrete *</label><input id="k_tit" value="${esc(item.titulo || '')}" required></div>
    <div class="campos" style="margin-top:10px">
      <div class="campo"><label>Mês</label><select id="k_mes">${d.meses.map((m, i) => `<option value="${i + 1}" ${item.mes === i + 1 ? 'selected' : ''}>${m}</option>`).join('')}</select></div>
      <div class="campo"><label>Dia (em branco = durante o mês)</label><input type="number" id="k_dia" min="1" max="31" value="${item.dia ?? ''}"></div>
      <div class="campo"><label>Responsável</label><select id="k_resp">${Object.entries(PESSOAS).map(([k, v]) => `<option value="${k}" ${item.responsavel === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      <div class="campo"><label>Categoria</label><input id="k_cat" value="${esc(item.categoria || '')}" placeholder="Financeiro, SED, Bolsas…"></div>
    </div>
    <div class="campo" style="margin-top:10px"><label>Detalhe</label><input id="k_det" value="${esc(item.detalhe || '')}"></div>
    <div class="rodape">${novo ? '' : '<button type="button" class="btn perigo" id="delK" style="margin-right:auto">Excluir</button>'}
      <button type="button" class="btn" data-fechar>Cancelar</button><button class="btn pri">Salvar</button></div></form>`,
  { onAbrir: (el, fechar) => {
    $('#fc', el).onsubmit = tentar(async (ev) => {
      ev.preventDefault();
      const corpo = { titulo: $('#k_tit', el).value, mes: +$('#k_mes', el).value, dia: $('#k_dia', el).value, responsavel: $('#k_resp', el).value,
        categoria: $('#k_cat', el).value, detalhe: $('#k_det', el).value };
      if (novo) await api('POST', '/api/calendario', corpo); else await api('PUT', '/api/calendario/' + item.id, corpo);
      fechar(); toast('Salvo'); rotear();
    });
    if ($('#delK', el)) $('#delK', el).onclick = tentar(async () => {
      if (!(await confirmar('Excluir o lembrete "' + item.titulo + '"?', 'Excluir'))) return;
      await api('DELETE', '/api/calendario/' + item.id); fechar(); rotear();
    });
  } });
}

// ───────────── Ficha do aluno: saída, fotos e atendimentos ─────────────
window.fichaEtapa3 = async (el, a) => {
  const [f, fot, at] = await Promise.all([
    api('GET', '/api/saida/aluno/' + a.id),
    api('GET', '/api/fotos/mutirao').then((d) => d.linhas.find((l) => l.aluno_id === a.id) || {}).catch(() => ({})),
    api('GET', '/api/atendimentos?aluno=' + a.id),
  ]);
  const sist = [['acadesc', 'ACADESC'], ['sed', 'SED'], ['lanche', 'Lanche Card']];
  el.innerHTML = `<div class="grade g2" style="margin-top:14px">
    <div class="cartao"><div class="acoes" style="justify-content:space-between"><h2 style="margin:0">${icone('portao')}Saída</h2>
      <div class="acoes"><button class="btn peq" id="s_termo">${icone('rematricula')}Termo de saída</button><button class="btn peq ama" id="s_aviso">${icone('mais')}Aviso de hoje</button></div></div>
      ${f.avisos.length ? `<div class="dica" style="background:var(--amarelo-claro);border-color:var(--amarelo)">${icone('portao')}Hoje quem busca é <b>${f.avisos.map((v) => esc(titulo(v.quem))).join(', ')}</b></div>` : ''}
      <label class="chk" style="display:block;margin:10px 0"><input type="checkbox" id="s_sozinho" ${f.sai_sozinho ? 'checked' : ''}> Pode sair sozinho (termo assinado)</label>
      <ul class="checklist" id="s_lista">${f.autorizados.map((x) => `<li><span class="nome"><span>${esc(titulo(x.nome))}</span>
        <small>${esc(x.parentesco || 'autorizado')}${x.documento ? ' · ' + esc(x.documento) : ''}${x.telefone ? ' · ' + esc(x.telefone) : ''}</small></span>
        <button class="btn peq perigo" data-delaut="${x.id}">Remover</button></li>`).join('')
        || '<li><span class="nome"><span class="dado">Ninguém autorizado além do responsável legal.</span></span></li>'}</ul>
      <div class="acoes" style="margin-top:10px"><button class="btn peq" id="s_add">${icone('mais')}Quem pode buscar</button></div>
      ${f.termo_em ? `<p class="dado" style="margin-top:8px">Termo assinado em ${dataBR(f.termo_em)}</p>` : ''}</div>
    <div class="cartao"><h2>${icone('fotos')}Foto e boleto</h2>
      <p class="dado">Foto nos sistemas:</p>
      <div class="acoes">${sist.map(([k, n]) => `<span class="tag ${fot[k] ? 't-concluida' : 't-pendente'}">${n}${fot[k] ? ' ✓' : ''}</span>`).join('')}</div>
      <p class="dado" style="margin-top:10px">${fot.tirada ? `Foto tirada${fot.data_foto ? ' em ' + dataBR(fot.data_foto) : ''}.` : 'Ainda sem foto — entra no próximo mutirão.'}
        <a href="#/fotos">abrir mutirão</a></p>
      <h3 style="margin-top:16px">${icone('atendimentos')}Últimos atendimentos</h3>
      ${at.atendimentos.length ? `<table><tbody>${at.atendimentos.slice(0, 5).map((x) => `<tr><td class="dado" style="width:80px">${dataBR(x.data)}</td>
        <td>${esc(x.assunto)}<br><small class="dado">${esc(at.canais[x.canal] || x.canal)} · ${esc(nomePessoa(x.usuario))}</small></td>
        <td>${x.resolvido ? '' : '<span class="tag t-vencendo">em aberto</span>'}</td></tr>`).join('')}</tbody></table>`
        : '<p class="vazio">Nenhum atendimento registrado.</p>'}
      <div class="acoes" style="margin-top:10px"><button class="btn peq" id="s_at">${icone('mais')}Registrar atendimento</button></div></div>
  </div>`;
  $('#s_sozinho', el).onchange = tentar(async (e) => {
    await api('PUT', '/api/saida/aluno/' + a.id, { sai_sozinho: e.target.checked, termo_em: e.target.checked ? hojeIso() : '' });
    toast(e.target.checked ? 'Marcado: pode sair sozinho' : 'Desmarcado');
  });
  $('#s_termo', el).onclick = () => abrirDoc({ tipo: 'termo_saida', aluno: a.id });
  $('#s_aviso', el).onclick = () => formAviso({ id: a.id, nome: a.nome });
  $('#s_add', el).onclick = () => modal('Quem pode buscar ' + titulo(a.nome), `<form id="fq">
    <div class="campos"><div class="campo"><label>Nome completo *</label><input id="q_nome" required></div>
      <div class="campo"><label>Parentesco</label><input id="q_par" placeholder="Avó, tio, vizinha…"></div>
      <div class="campo"><label>Documento (RG)</label><input id="q_doc"></div>
      <div class="campo"><label>Telefone</label><input id="q_tel"></div></div>
    <p class="dica">Confira o documento da pessoa no portão antes de liberar o aluno.</p>
    <div class="rodape"><button type="button" class="btn" data-fechar>Cancelar</button><button class="btn pri">Autorizar</button></div></form>`,
  { onAbrir: (m, fechar) => { $('#fq', m).onsubmit = tentar(async (ev) => {
    ev.preventDefault();
    await api('POST', '/api/saida/autorizados', { aluno_id: a.id, nome: $('#q_nome', m).value, parentesco: $('#q_par', m).value, documento: $('#q_doc', m).value, telefone: $('#q_tel', m).value });
    fechar(); toast('Autorizado'); rotear();
  }); } });
  $$('[data-delaut]', el).forEach((b) => (b.onclick = tentar(async () => {
    if (!(await confirmar('Remover esta autorização?', 'Remover'))) return;
    await api('DELETE', '/api/saida/autorizados/' + b.dataset.delaut); toast('Removido'); rotear();
  })));
  $('#s_at', el).onclick = () => formAtendimento(at, null, a);
};

// Contadores amarelos do menu (nas abas e somados no grupo do trilho)
window.badgesEtapa3 = async () => {
  try {
    const h = await api('GET', '/api/hoje');
    const p = (id, n) => definirBadge(id, n);
    p('saida', h.saida.pendentes);
    p('tarefas', h.tarefas.minhas - h.tarefas.minhas_feitas);
  } catch { /* silencioso */ }
};

// Secretaria IEL — Etapa 4: cópias de segurança, LGPD, bloqueio de tela e relatórios
'use strict';

const tamanhoBR = (b) => (b == null ? '—' : b < 1024 ? b + ' B' : b < 1048576 ? (b / 1024).toFixed(0) + ' KB' : (b / 1048576).toFixed(1) + ' MB');
const quandoBR = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—');
function idadeBR(horas) {
  if (horas == null) return 'nunca';
  if (horas < 1) return 'há poucos minutos';
  if (horas < 24) return `há ${Math.round(horas)} hora(s)`;
  return `há ${Math.round(horas / 24)} dia(s)`;
}

// ───────────── aviso de backup atrasado (aparece em qualquer tela) ─────────────
window.avisosEtapa4 = async () => {
  const caixa = $('#avisos');
  if (!caixa) return;
  let e;
  try { e = await api('GET', '/api/backups/estado'); } catch { return; }
  const partes = [];
  if (e.pendente) {
    partes.push(`<div class="aviso-fixo perigo">♻️ <b>Restauração agendada:</b> o backup <span class="mono">${esc(e.pendente)}</span> entra no lugar do banco atual
      quando o sistema for reiniciado. ${EU.perfil === 'admin' ? '<button class="btn peq" id="avReiniciar">Reiniciar agora</button> <button class="btn peq" id="avCancelar">Cancelar</button>' : 'Avise a administração.'}</div>`);
  }
  if (e.atrasado) {
    partes.push(`<div class="aviso-fixo ${e.nunca ? 'perigo' : ''}">💾 <b>${e.nunca ? 'Nenhuma cópia de segurança foi feita ainda.' : 'A última cópia de segurança foi ' + idadeBR(e.idade_horas) + '.'}</b>
      Se este computador falhar, os dados da secretaria se perdem.
      ${EU.perfil === 'admin' ? '<button class="btn peq" id="avBackup">Fazer cópia agora</button> <a class="btn peq" href="#/config/backup">Configurar</a>' : 'Avise a administração.'}</div>`);
  }
  caixa.innerHTML = partes.join('');
  if ($('#avBackup')) $('#avBackup').onclick = tentar(async () => {
    const r = await api('POST', '/api/backups');
    toast('Cópia gravada: ' + r.arquivo);
    window.avisosEtapa4();
  });
  if ($('#avReiniciar')) $('#avReiniciar').onclick = tentar(reiniciarSistema);
  if ($('#avCancelar')) $('#avCancelar').onclick = tentar(async () => {
    await api('DELETE', '/api/backups/restaurar'); toast('Restauração cancelada'); window.avisosEtapa4();
  });
};

async function reiniciarSistema() {
  if (!(await confirmar('Reiniciar o sistema agora? Quem estiver usando vai precisar entrar de novo.', 'Reiniciar'))) return;
  try { await api('POST', '/api/admin/reiniciar'); } catch { /* o servidor cai no meio da resposta */ }
  $('#raiz').innerHTML = `<div class="login"><form><img src="logo.png" alt=""><h1>Reiniciando…</h1>
    <p>O sistema está subindo de novo. Esta página volta sozinha em alguns segundos.</p></form></div>`;
  const tentarVoltar = async () => {
    try { await fetch('/api/backups/estado', { headers: { 'X-IEL': '1' } }); location.reload(); }
    catch { setTimeout(tentarVoltar, 1500); }
  };
  setTimeout(tentarVoltar, 3000);
}

// ───────────── Configurações › Backup ─────────────
window.abaBackup = async (el) => {
  const d = await api('GET', '/api/backups');
  const e = d.estado;
  el.innerHTML = `
  <div class="grade g4">
    <div class="cartao kpi ${e.atrasado ? 'alerta' : 'destaque'}"><div class="rot">Última cópia</div>
      <div class="val" style="font-size:20px">${e.nunca ? 'nunca' : idadeBR(e.idade_horas)}</div>
      <div class="det">${e.ultimo ? esc(e.ultimo.data) + ' às ' + esc(e.ultimo.hora) + ' · ' + esc(e.ultimo.motivo_rotulo) : 'faça a primeira agora'}</div></div>
    <div class="cartao kpi"><div class="rot">Cópias guardadas</div><div class="val">${e.total}</div><div class="det">ocupando ${tamanhoBR(e.espaco)} · guarda as ${e.manter} mais novas</div></div>
    <div class="cartao kpi"><div class="rot">De quanto em quanto tempo</div><div class="val" style="font-size:20px">${e.intervalo_horas}h</div><div class="det">o sistema copia sozinho enquanto estiver aberto</div></div>
    <div class="cartao kpi"><div class="rot">Proteção do arquivo</div><div class="val" style="font-size:20px">${e.cifrado ? '🔒 cifrado' : 'sem senha'}</div>
      <div class="det">${e.cifrado ? 'só abre com a senha do backup' : 'qualquer um que pegar o arquivo lê tudo'}</div></div>
  </div>

  <div class="cartao" style="margin-top:14px">
    <div class="acoes" style="justify-content:space-between"><h2 style="margin:0">💾 Cópias de segurança</h2>
      <div class="acoes"><button class="btn pri" id="bkAgora">Fazer cópia agora</button><button class="btn" id="bkSenha">${e.cifrado ? 'Trocar/remover senha' : 'Proteger com senha'}</button></div></div>
    <p class="dica">O banco inteiro da secretaria cabe num arquivo só. <b>Aponte a pasta para um pen drive ou para o OneDrive</b>:
      cópia que fica no mesmo computador não salva ninguém de um HD queimado ou de um ransomware.</p>
    <form class="campos" id="bkCfg" style="margin-top:6px">
      <div class="campo" style="grid-column:1/-1"><label>Pasta das cópias</label><input id="bk_pasta" value="${esc(EU.config.backup_pasta || '')}" placeholder="${esc(d.pasta_padrao)}" style="width:100%"></div>
      <div class="campo"><label>Copiar a cada (horas)</label><input type="number" id="bk_horas" min="1" max="48" value="${esc(EU.config.backup_horas || 6)}"></div>
      <div class="campo"><label>Quantas cópias guardar</label><input type="number" id="bk_manter" min="3" max="365" value="${esc(EU.config.backup_manter || 30)}"></div>
      <div class="campo"><label>Avisar se passar de (dias)</label><input type="number" id="bk_avisar" min="1" max="30" value="${esc(EU.config.backup_avisar_dias || 2)}"></div>
      <div class="campo" style="display:flex;align-items:flex-end"><button class="btn">Salvar</button></div>
    </form>
    <p class="dado">Pasta em uso: <span class="mono">${esc(e.pasta || d.pasta_padrao)}</span>${e.acessivel ? '' : ' <b style="color:var(--vermelho)">(não consegui acessar esta pasta!)</b>'}</p>
  </div>

  <div class="cartao" style="margin-top:14px"><h2>Restaurar</h2>
    <p class="dica">⚠️ Restaurar substitui <b>tudo</b> pelo conteúdo da cópia escolhida: o que foi feito depois dela se perde.
      Antes de trocar, o sistema guarda automaticamente uma cópia do banco atual. A troca acontece ao reiniciar.</p>
    <div class="tabela-wrap"><table><thead><tr><th>Quando</th><th>Motivo</th><th>Tamanho</th><th>Protegida</th><th></th></tr></thead><tbody>
      ${d.lista.length ? d.lista.map((b) => `<tr><td>${esc(b.data ? b.data.split('-').reverse().join('/') : '—')} <span class="dado">${esc(b.hora || '')}</span></td>
        <td>${esc(b.motivo_rotulo || b.motivo)}</td><td class="num-col">${tamanhoBR(b.tamanho)}</td><td>${b.cifrado ? '🔒 sim' : 'não'}</td>
        <td class="acoes"><button class="btn peq" data-rest="${esc(b.arquivo)}">Restaurar</button><button class="btn peq perigo" data-del="${esc(b.arquivo)}">Apagar</button></td></tr>`).join('')
        : '<tr><td colspan="5" class="vazio">Nenhuma cópia ainda.</td></tr>'}
    </tbody></table></div>
    <div class="acoes" style="margin-top:12px"><button class="btn" id="bkReiniciar">Reiniciar o sistema</button>
      <span class="dado">Use depois de restaurar, ou quando o sistema estiver estranho.</span></div>
  </div>`;

  $('#bkAgora').onclick = tentar(async () => {
    const r = await api('POST', '/api/backups');
    toast(`Cópia gravada (${tamanhoBR(r.tamanho)})${r.cifrado ? ' e protegida com senha' : ''}`);
    rotear();
  });
  $('#bkCfg').onsubmit = tentar(async (ev) => {
    ev.preventDefault();
    await api('PUT', '/api/admin/config', { backup_pasta: $('#bk_pasta').value.trim(), backup_horas: $('#bk_horas').value, backup_manter: $('#bk_manter').value, backup_avisar_dias: $('#bk_avisar').value });
    EU = await api('GET', '/api/eu');
    toast('Configuração salva'); rotear();
  });
  $('#bkSenha').onclick = () => janelaSenhaBackup(e.cifrado);
  $('#bkReiniciar').onclick = tentar(reiniciarSistema);
  $$('[data-rest]').forEach((b) => (b.onclick = () => janelaRestaurar(b.dataset.rest, d.lista.find((x) => x.arquivo === b.dataset.rest))));
  $$('[data-del]').forEach((b) => (b.onclick = tentar(async () => {
    if (!(await confirmar('Apagar esta cópia de segurança?', 'Apagar'))) return;
    await api('DELETE', '/api/backups/' + encodeURIComponent(b.dataset.del)); toast('Cópia apagada'); rotear();
  })));
};

function janelaSenhaBackup(temSenha) {
  modal('Senha das cópias de segurança', `<form id="fs">
    <p>Com senha, o arquivo do backup sai <b>cifrado</b>: se o pen drive se perder, ninguém lê os dados dos alunos.</p>
    <div class="campo"><label>Nova senha (mínimo 8 caracteres)</label><input type="password" id="s_nova" autocomplete="new-password" minlength="8"></div>
    <p class="dica">⚠️ <b>Anote esta senha num lugar seguro.</b> Sem ela, nem vocês conseguem restaurar o backup —
      não existe "esqueci minha senha" aqui. A senha fica guardada no sistema para as cópias automáticas saírem protegidas.</p>
    <div class="rodape">${temSenha ? '<button type="button" class="btn perigo" id="s_remover" style="margin-right:auto">Remover senha</button>' : ''}
      <button type="button" class="btn" data-fechar>Cancelar</button><button class="btn pri">Salvar senha</button></div></form>`,
  { onAbrir: (el, fechar) => {
    $('#fs', el).onsubmit = tentar(async (ev) => {
      ev.preventDefault();
      const r = await api('PUT', '/api/backups/senha', { senha: $('#s_nova', el).value });
      fechar(); toast(r.cifrado ? 'Pronto: as próximas cópias saem protegidas' : 'Senha removida'); rotear();
    });
    if ($('#s_remover', el)) $('#s_remover', el).onclick = tentar(async () => {
      if (!(await confirmar('Remover a senha? As próximas cópias vão sair sem proteção.', 'Remover'))) return;
      await api('PUT', '/api/backups/senha', { senha: '' }); fechar(); toast('Senha removida'); rotear();
    });
  } });
}

function janelaRestaurar(arquivo, info) {
  modal('Restaurar cópia de segurança', `<form id="fr">
    <p>Vai voltar tudo para como estava em <b>${esc(info ? (info.data || '').split('-').reverse().join('/') + ' às ' + info.hora : arquivo)}</b>.</p>
    <p class="dica">Tudo o que foi lançado depois dessa data <b>se perde</b>. O banco de agora fica guardado como
      <span class="mono">antes-da-restauracao-…</span>, então dá para voltar atrás.</p>
    ${info && info.cifrado ? '<div class="campo"><label>Senha do backup</label><input type="password" id="r_senha" autocomplete="off" required></div>' : ''}
    <div class="rodape"><button type="button" class="btn" data-fechar>Cancelar</button><button class="btn perigo">Restaurar e reiniciar</button></div></form>`,
  { onAbrir: (el, fechar) => {
    $('#fr', el).onsubmit = tentar(async (ev) => {
      ev.preventDefault();
      await api('POST', '/api/backups/restaurar', { arquivo, senha: $('#r_senha', el) ? $('#r_senha', el).value : undefined });
      fechar();
      toast('Restauração agendada. Reiniciando…');
      await api('POST', '/api/admin/reiniciar').catch(() => {});
      $('#raiz').innerHTML = `<div class="login"><form><img src="logo.png" alt=""><h1>Restaurando…</h1>
        <p>O sistema está trocando o banco pela cópia escolhida e subindo de novo.</p></form></div>`;
      const voltar = async () => { try { await fetch('/api/backups/estado', { headers: { 'X-IEL': '1' } }); location.reload(); } catch { setTimeout(voltar, 1500); } };
      setTimeout(voltar, 3500);
    });
  } });
}

// ───────────── Configurações › LGPD e acessos ─────────────
window.abaLgpd = async (el) => {
  const [ac, lg] = await Promise.all([api('GET', '/api/admin/acessos?dias=30'), api('GET', '/api/admin/lgpd')]);
  el.innerHTML = `
  <div class="faixa-lgpd">🔒 Esta área existe para cumprir a LGPD: saber quem viu o quê, entregar à família tudo o que guardamos
    sobre o aluno e apagar o que não precisa mais ser guardado.</div>
  <div class="grade g2">
    <div class="cartao"><h2>📄 Dados de um aluno (direito da família)</h2>
      <p class="dado">A família pode pedir, por escrito, tudo o que a escola guarda sobre o aluno. Aqui sai pronto para entregar.</p>
      <div class="campo" style="margin-top:8px"><label>Aluno</label><div id="lgAluno"></div></div>
      <div class="acoes" style="margin-top:10px" id="lgBotoes"><span class="dado">Escolha o aluno acima.</span></div></div>
    <div class="cartao"><h2>👀 Quem consultou fichas (30 dias)</h2>
      <div class="grade g2" style="gap:8px">
        <div><div class="rot dado">Fichas abertas</div><div class="val" style="font-size:22px;font-weight:700;color:var(--titulo)">${ac.resumo.fichas}</div></div>
        <div><div class="rot dado">Consultas</div><div class="val" style="font-size:22px;font-weight:700;color:var(--titulo)">${ac.resumo.consultas}</div></div>
      </div>
      <p class="dado" style="margin-top:8px">${ac.resumo.por_pessoa.map(([p, n]) => `${esc(p)}: <b>${n}</b>`).join(' · ') || 'ninguém abriu fichas ainda'}</p>
      <div class="tabela-wrap" style="max-height:260px;overflow:auto;margin-top:8px"><table><thead><tr><th>Quando</th><th>Quem</th><th>Ficha</th><th>Vezes</th></tr></thead><tbody>
        ${ac.acessos.length ? ac.acessos.slice(0, 100).map((a) => `<tr><td class="dado">${esc(a.data.split('-').reverse().join('/'))}</td><td>${esc(a.usuario)}</td>
          <td><a href="#/aluno/${a.aluno_id}">${esc(titulo(a.aluno))}</a> <span class="dado">${esc(a.turma_rotulo)}</span></td><td class="num-col">${a.vezes}</td></tr>`).join('')
          : '<tr><td colspan="4" class="vazio">Nenhuma consulta registrada.</td></tr>'}
      </tbody></table></div></div>
  </div>

  <div class="cartao" style="margin-top:14px"><h2>🗑️ Descarte de dados de ex-alunos</h2>
    <p class="dica">A LGPD manda guardar dado pessoal só enquanto houver motivo. Aqui o sistema <b>apaga os dados pessoais</b> de quem já saiu
      e <b>mantém os números</b> (série, ano, situação) para as estatísticas da escola. Alunos matriculados nunca aparecem nesta lista.</p>
    <div class="filtros"><label>Sem matrícula há mais de <input type="number" id="lgAnos" value="${lg.anos}" min="1" max="30" style="width:70px"> anos</label>
      <button class="btn peq" id="lgBuscar">Ver quem está nessa situação</button>
      <span class="dado">${lg.ja_anonimizados} aluno(s) já anonimizado(s) de ${lg.total_alunos}</span></div>
    <div class="grade g2" style="gap:10px;margin-bottom:10px">
      <div><p class="dado"><b>Some:</b> ${lg.campos_apagados.map(esc).join(', ')}.</p></div>
      <div><p class="dado"><b>Fica:</b> ${lg.campos_mantidos.map(esc).join(', ')}.</p></div>
    </div>
    <div id="lgLista"></div>
  </div>`;

  seletorAluno($('#lgAluno'), (a) => {
    $('#lgBotoes').innerHTML = `<button class="btn pri" id="lgVer">📄 Abrir relatório para imprimir</button>
      <button class="btn" id="lgBaixar">⬇️ Baixar arquivo (JSON)</button>`;
    $('#lgVer').onclick = () => abrirDoc({ tipo: 'dados_aluno', aluno: a.id });
    $('#lgBaixar').onclick = tentar(async () => {
      const d = await api('GET', `/api/alunos/${a.id}/dados-pessoais`);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' }));
      link.download = `dados-${titulo(a.nome).replace(/\s+/g, '-')}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 5000);
      toast('Arquivo gerado');
    });
  }, 'Nome do aluno…');

  const desenharCandidatos = (dados) => {
    $('#lgLista').innerHTML = dados.candidatos.length ? `
      <div class="acoes" style="margin-bottom:8px"><button class="btn perigo" id="lgAnon">Anonimizar os marcados</button>
        <label><input type="checkbox" id="lgTodos"> marcar todos (${dados.candidatos.length})</label></div>
      <div class="tabela-wrap" style="max-height:320px;overflow:auto"><table><thead><tr><th></th><th>Aluno</th><th>Turma</th><th>Motivo</th></tr></thead><tbody>
      ${dados.candidatos.map((c) => `<tr><td><input type="checkbox" data-anon="${c.aluno_id}"></td><td>${esc(titulo(c.nome))} <span class="dado">${esc(c.mat || '')}</span></td>
        <td>${esc(c.turma_rotulo)}</td><td class="dado">${esc(c.motivo)}</td></tr>`).join('')}
      </tbody></table></div>` : '<p class="vazio">Ninguém nessa situação — nada a descartar por enquanto. 👍</p>';
    if ($('#lgTodos')) $('#lgTodos').onchange = (e) => $$('[data-anon]').forEach((i) => (i.checked = e.target.checked));
    if ($('#lgAnon')) $('#lgAnon').onclick = tentar(async () => {
      const ids = $$('[data-anon]').filter((i) => i.checked).map((i) => +i.dataset.anon);
      if (!ids.length) return toast('Marque quem deve ser anonimizado', true);
      if (!(await confirmar(`Apagar em definitivo os dados pessoais de ${ids.length} ex-aluno(s)? Isto não tem volta.`, 'Anonimizar'))) return;
      const r = await api('POST', '/api/admin/lgpd/anonimizar', { alunos: ids, anos: +$('#lgAnos').value });
      toast(`${r.anonimizados} ficha(s) anonimizada(s)`); invalidar(); rotear();
    });
  };
  $('#lgBuscar').onclick = tentar(async () => desenharCandidatos(await api('GET', '/api/admin/lgpd?anos=' + $('#lgAnos').value)));
  desenharCandidatos(lg);
};

// ───────────── bloqueio de tela ─────────────
let relogioBloqueio = null;
window.ligarBloqueio = () => {
  const reiniciarRelogio = () => {
    clearTimeout(relogioBloqueio);
    const min = Number((EU && EU.config && EU.config.bloqueio_minutos) || 0);
    if (!min) return;
    relogioBloqueio = setTimeout(tentar(async () => { await api('POST', '/api/bloquear'); window.mostrarBloqueio(); }), min * 60000);
  };
  ['mousemove', 'keydown', 'click', 'touchstart'].forEach((ev) => document.addEventListener(ev, reiniciarRelogio, { passive: true }));
  reiniciarRelogio();
};

window.mostrarBloqueio = () => {
  if ($('#telaBloqueada')) return;
  clearTimeout(relogioBloqueio);
  const f = document.createElement('div');
  f.id = 'telaBloqueada';
  f.className = 'bloqueio';
  f.innerHTML = `<form class="cartao" id="fb"><img src="logo.png" alt="" style="width:76px;display:block;margin:0 auto 10px">
    <h2 style="text-align:center">Tela bloqueada</h2>
    <p class="dado" style="text-align:center">Saiu de perto do computador? Os dados ficam protegidos até você digitar sua senha.</p>
    <div class="campo" style="margin-top:12px"><label>Senha de ${esc(EU.nome)}</label><input type="password" id="b_senha" autocomplete="current-password" required></div>
    <div class="erro" id="b_erro" style="color:var(--vermelho);font-size:13px;min-height:18px"></div>
    <div class="acoes" style="margin-top:6px"><button class="btn pri" style="flex:1;justify-content:center">Desbloquear</button>
      <button type="button" class="btn" id="b_sair">Sair</button></div></form>`;
  document.body.appendChild(f);
  $('#b_senha', f).focus();
  $('#fb', f).onsubmit = async (ev) => {
    ev.preventDefault();
    try {
      await api('POST', '/api/desbloquear', { senha: $('#b_senha', f).value });
      f.remove();
      window.ligarBloqueio();
      rotear();
    } catch (e) { $('#b_erro', f).textContent = e.message; $('#b_senha', f).value = ''; $('#b_senha', f).focus(); }
  };
  $('#b_sair', f).onclick = tentar(async () => { await api('POST', '/api/logout'); location.reload(); });
};

// ───────────── Relatórios ─────────────
const PCT = (n, total) => (total ? Math.round((1000 * n) / total) / 10 : 0);

// Barrinhas simples, sem biblioteca nenhuma
function barras(itens, cor = 'var(--pri)') {
  const max = Math.max(1, ...itens.map((i) => i[1]));
  return `<div class="barras">${itens.map(([rot, n]) => `<div class="linha-barra"><span class="rot">${esc(rot)}</span>
    <span class="trilho"><i style="width:${(100 * n) / max}%;background:${cor}"></i></span><b>${n}</b></div>`).join('')}</div>`;
}

TELAS.relatorios = async (c, ano) => {
  if (EU.perfil !== 'admin') { c.innerHTML = '<div class="cartao">Os relatórios reúnem dados de todas as áreas e ficam com a administração.</div>'; return; }
  const d = await api('GET', '/api/relatorios' + (ano ? '?ano=' + ano : ''));
  const r = d.rematricula, a = d.alunos, at = d.atendimentos;
  const rotuloStatus = { pendente: 'Não iniciadas', reservada: 'Em andamento', concluida: 'Concluídas', nao_renova: 'Não renovam', transferido: 'Transferidos' };
  const rotuloBolsa = { inscrito: 'Requerimento entregue', conferido: 'Documentos conferidos', assistente: 'Com a assistente social', visita: 'Visita domiciliar',
    ofertada: 'Ofertada', concedida: 'Concedida', indeferida: 'Indeferida', sem_oferta: 'Sem oferta', desistiu: 'Desistiu' };
  const canais = { balcao: 'Balcão', telefone: 'Telefone', whatsapp: 'WhatsApp', email: 'E-mail' };

  c.innerHTML = `<div class="acoes" style="justify-content:space-between"><div><h1>Relatórios da secretaria</h1>
      <p class="sub">Retrato do ano para levar à Samara e à Diretoria · gerado em ${dataBR(d.gerado_em)}</p></div>
    <div class="acoes"><button class="btn" id="relAnoAnt">←</button><b>${d.ano}</b><button class="btn" id="relAnoProx">→</button>
      <button class="btn pri" id="relImp">🖨️ Versão para imprimir</button></div></div>

  <h2 class="titulo-secao">A escola hoje</h2>
  <div class="grade g4">
    <div class="cartao kpi destaque"><div class="rot">Alunos ativos</div><div class="val">${a.ativos}</div>
      <div class="det">${a.novos} novos em ${d.ano} · ${a.concluintes} concluintes</div></div>
    <div class="cartao kpi"><div class="rot">Filhos de funcionários</div><div class="val">${a.filhos_funcionarios}</div><div class="det">isentos na conferência dos boletos</div></div>
    <div class="cartao kpi"><div class="rot">Interessados (SIG)</div><div class="val">${d.interessados.total}</div>
      <div class="det">${d.interessados.matriculados} viraram matrícula</div></div>
    <div class="cartao kpi"><div class="rot">Fichas anonimizadas</div><div class="val">${a.anonimizados}</div><div class="det">ex-alunos com dados descartados (LGPD)</div></div>
  </div>
  <div class="grade g2" style="margin-top:14px">
    <div class="cartao"><h3>Alunos por segmento</h3>${barras(Object.entries(a.por_segmento))}</div>
    <div class="cartao"><h3>Alunos por série</h3>${barras(a.por_serie.map((s) => [s.rotulo, s.n]), 'var(--azul-2)')}</div>
  </div>

  <h2 class="titulo-secao">Matrícula e rematrícula ${d.ano}</h2>
  <div class="grade g4">
    <div class="cartao kpi destaque"><div class="rot">Rematrículas concluídas</div><div class="val">${r.concluidas}<small style="font-size:14px;color:var(--texto-2)"> / ${r.veteranos}</small></div>
      <div class="det">${r.percentual}% dos veteranos</div></div>
    <div class="cartao kpi"><div class="rot">Em andamento</div><div class="val">${r.reservada || 0}</div><div class="det">pagaram a matrícula</div></div>
    <div class="cartao kpi"><div class="rot">Ainda não iniciaram</div><div class="val">${r.pendente || 0}</div><div class="det">famílias a contatar</div></div>
    <div class="cartao kpi"><div class="rot">Não renovam</div><div class="val">${(r.nao_renova || 0) + (r.transferido || 0)}</div><div class="det">saídas declaradas</div></div>
  </div>
  <div class="cartao" style="margin-top:14px"><h3>Situação das rematrículas</h3>
    ${barras(Object.entries(rotuloStatus).map(([k, v]) => [v, r[k] || 0]), 'var(--verde)')}
    <p class="dado">${r.vagas_definidas ? `Capacidade cadastrada: ${r.capacidade_total} vagas em ${r.vagas_definidas} séries.` : 'Vagas por série ainda não cadastradas (Configurações › Vagas).'}</p></div>

  <h2 class="titulo-secao">A secretaria em números (${at.ano})</h2>
  <div class="grade g4">
    <div class="cartao kpi destaque"><div class="rot">Atendimentos registrados</div><div class="val">${at.total}</div>
      <div class="det">${at.resolvidos} resolvidos na hora (${PCT(at.resolvidos, at.total)}%)</div></div>
    <div class="cartao kpi ${at.em_aberto ? 'alerta' : ''}"><div class="rot">Em aberto</div><div class="val">${at.em_aberto}</div><div class="det">esperando retorno</div></div>
    <div class="cartao kpi"><div class="rot">Mês mais movimentado</div><div class="val" style="font-size:22px">${esc(at.pico.mes)}</div><div class="det">${at.pico.n} atendimentos</div></div>
    <div class="cartao kpi"><div class="rot">Documentos emitidos</div><div class="val">${d.documentos.emitidos}</div><div class="det">declarações, termos e listas</div></div>
  </div>
  <div class="grade g2" style="margin-top:14px">
    <div class="cartao"><h3>Atendimentos mês a mês</h3>${barras(at.por_mes.map((m) => [m.mes, m.n]), 'var(--amarelo)')}</div>
    <div>
      <div class="cartao"><h3>Por canal</h3>${barras(at.por_canal.map(([k, n]) => [canais[k] || k, n]))}</div>
      <div class="cartao" style="margin-top:14px"><h3>Assuntos mais procurados</h3>
        ${at.por_categoria.length ? barras(at.por_categoria.map(([k, n]) => [k, n]), 'var(--laranja)') : '<p class="vazio">Sem categorias ainda.</p>'}</div>
    </div>
  </div>
  <div class="cartao" style="margin-top:14px"><h3>Documentos emitidos por tipo</h3>
    ${d.documentos.por_tipo.length ? barras(d.documentos.por_tipo.map((t) => [t.chave, t.n]), 'var(--azul-2)') : '<p class="vazio">Nenhum documento emitido neste ano.</p>'}</div>

  <h2 class="titulo-secao">Financeiro e bolsas</h2>
  <div class="grade g4">
    <div class="cartao kpi"><div class="rot">Boletos ${d.boletos.ano}</div><div class="val">${d.boletos.conferidos}<small style="font-size:14px;color:var(--texto-2)"> / ${d.boletos.matriculados}</small></div>
      <div class="det">conferidos · ${d.boletos.lancados} já lançados no ACADESC</div></div>
    <div class="cartao kpi"><div class="rot">Atividades extras</div><div class="val">${d.extras.inscricoes_ativas}</div>
      <div class="det">inscrições ativas · ${d.extras.canceladas} canceladas</div></div>
    <div class="cartao kpi"><div class="rot">Receita mensal das extras</div><div class="val" style="font-size:22px">${moedaBR(d.extras.receita_mensal)}</div><div class="det">soma das parcelas ativas</div></div>
    <div class="cartao kpi"><div class="rot">Bolsas ${d.bolsas.ano}</div><div class="val">${d.bolsas.concedidas}<small style="font-size:14px;color:var(--texto-2)"> / ${d.bolsas.total}</small></div>
      <div class="det">${d.bolsas.cem_por_cento} de 100% · ${d.bolsas.cinquenta} de 50%</div></div>
  </div>
  <div class="grade g2" style="margin-top:14px">
    <div class="cartao"><h3>Inscrições por atividade</h3>
      ${d.extras.por_atividade.length ? barras(d.extras.por_atividade.map((x) => [x.nome, x.ativas || 0]), 'var(--roxo)') : '<p class="vazio">Nenhuma inscrição.</p>'}</div>
    <div class="cartao"><h3>Bolsas por etapa</h3>
      ${d.bolsas.por_status.length ? barras(d.bolsas.por_status.map((x) => [rotuloBolsa[x.chave] || x.chave, x.n]), 'var(--verde)') : '<p class="vazio">Nenhum processo.</p>'}
      <p class="dado">Prestação de contas do CEBAS: <b>${dataBR(d.bolsas.prestacao_contas)}</b> · ${d.bolsas.contratos} contrato(s) assinado(s).</p></div>
  </div>

  <h2 class="titulo-secao">Cuidado com os dados e rotina</h2>
  <div class="grade g4">
    <div class="cartao kpi"><div class="rot">Fotos nos 3 sistemas</div><div class="val">${d.fotos.completos}</div><div class="det">${d.fotos.faltando} alunos ainda faltando</div></div>
    <div class="cartao kpi"><div class="rot">Autorizações de saída</div><div class="val">${d.saida.alunos_com_autorizado}</div>
      <div class="det">${d.saida.autorizados} pessoas autorizadas · ${d.saida.sai_sozinho} saem sozinhos</div></div>
    <div class="cartao kpi"><div class="rot">Avisos de saída no ano</div><div class="val">${d.saida.avisos_ano}</div><div class="det">"hoje quem busca é outra pessoa"</div></div>
    <div class="cartao kpi"><div class="rot">Lembretes do calendário</div><div class="val">${d.equipe.lembretes_concluidos}<small style="font-size:14px;color:var(--texto-2)"> / ${d.equipe.lembretes_total}</small></div>
      <div class="det">${d.equipe.tarefas_concluidas} tarefas do dia concluídas</div></div>
  </div>
  ${d.equipe.por_pessoa.length ? `<div class="cartao" style="margin-top:14px"><h3>Tarefas concluídas por pessoa</h3>
    ${barras(d.equipe.por_pessoa.map((p) => [nomePessoa(p.chave), p.n]))}</div>` : ''}`;

  $('#relImp').onclick = () => abrirDoc({ tipo: 'fechamento', ano: d.ano });
  $('#relAnoAnt').onclick = () => (location.hash = '#/relatorios/' + (d.ano - 1));
  $('#relAnoProx').onclick = () => (location.hash = '#/relatorios/' + (d.ano + 1));
};

// ───────────── Configurações › Atualizações ─────────────
window.abaAtualizacao = async (el) => {
  const d = await api('GET', '/api/admin/atualizacao');
  desenharAtualizacao(el, d);
};

function desenharAtualizacao(el, d, resultado) {
  const impedido = !d.git || !d.repositorio;
  el.innerHTML = `
  <div class="grade g4">
    <div class="cartao kpi destaque"><div class="rot">Versão instalada</div><div class="val" style="font-size:22px">${esc(d.versao || '—')}</div>
      <div class="det">${d.atual ? 'de ' + esc(d.atual.data) : 'sem informação'}</div></div>
    <div class="cartao kpi"><div class="rot">Última mudança</div><div class="val" style="font-size:15px;line-height:1.35">${esc((d.atual && d.atual.assunto) || '—')}</div>
      <div class="det">${d.atual ? 'código ' + esc(d.atual.hash) : ''}</div></div>
    <div class="cartao kpi ${d.limpo === false ? 'alerta' : ''}"><div class="rot">Arquivos alterados aqui</div>
      <div class="val">${d.mudancas_locais ? d.mudancas_locais.length : 0}</div>
      <div class="det">${d.limpo === false ? 'a atualização fica bloqueada até resolver' : 'nada mexido à mão'}</div></div>
    <div class="cartao kpi"><div class="rot">Cópia de segurança</div><div class="val" style="font-size:15px;line-height:1.35">feita antes de atualizar</div>
      <div class="det">sempre, automaticamente</div></div>
  </div>

  <div class="cartao" style="margin-top:14px">
    <div class="acoes" style="justify-content:space-between"><h2 style="margin:0">🔄 Atualizações do sistema</h2>
      ${impedido ? '' : '<button class="btn pri" id="atVerificar">Verificar se há atualização</button>'}</div>
    ${impedido ? `<div class="dica">${esc(d.aviso || 'Não dá para atualizar automaticamente neste computador.')}</div>`
      : `<p class="dica">O sistema busca a versão nova no GitHub, <b>faz uma cópia de segurança do banco</b>, troca os arquivos e reinicia.
        Os dados da secretaria não são tocados — só o programa.</p>`}
    ${d.limpo === false ? `<div class="aviso-fixo perigo" style="border-radius:8px;margin-top:10px;display:block">
      ⚠️ <b>Há arquivos alterados nesta pasta.</b> Atualizar apagaria essas mudanças, então está bloqueado.
      Se não foi você que mexeu, chame quem cuida do sistema.
      <br><span class="mono">${d.mudancas_locais.slice(0, 8).map(esc).join(', ')}${d.mudancas_locais.length > 8 ? '…' : ''}</span></div>` : ''}
    <div id="atResultado" style="margin-top:12px">${resultado || '<p class="dado">Clique em "Verificar se há atualização" quando quiser. Não precisa ser sempre — só quando eu avisar que tem novidade.</p>'}</div>
    ${d.origem ? `<p class="dado" style="margin-top:12px">Origem: <span class="mono">${esc(d.origem)}</span> · ramo <span class="mono">${esc(d.ramo)}</span></p>` : ''}
  </div>`;

  if ($('#atVerificar')) $('#atVerificar').onclick = tentar(async () => {
    const b = $('#atVerificar');
    b.disabled = true; b.textContent = 'Procurando no GitHub…';
    $('#atResultado').innerHTML = '<div class="carregando"><div class="bloco" style="height:64px"></div></div>';
    let r;
    try { r = await api('POST', '/api/admin/atualizacao/verificar'); }
    finally { b.disabled = false; b.textContent = 'Verificar se há atualização'; }
    if (!r.verificado) {
      $('#atResultado').innerHTML = `<div class="aviso-fixo perigo" style="border-radius:8px">😕 ${esc(r.aviso || 'Não consegui verificar agora.')}</div>`;
      return;
    }
    if (!r.disponivel) {
      $('#atResultado').innerHTML = `<div class="dica">✅ <b>O sistema já está na versão mais nova.</b> Nada a fazer.</div>`;
      return;
    }
    $('#atResultado').innerHTML = `<div class="dica" style="background:var(--amarelo-claro);border-left-color:var(--amarelo);color:var(--aviso-txt)">
        🎁 <b>Existe atualização disponível</b> — ${r.novidades.length} mudança(s) desde a sua versão.</div>
      <ul class="checklist">${r.novidades.map((n) => `<li><span class="nome"><span>${esc(n.assunto)}</span><small>${esc(n.data)} · ${esc(n.hash)}</small></span></li>`).join('')}</ul>
      <div class="acoes" style="margin-top:12px">${r.limpo === false ? '<span class="dado">Resolva os arquivos alterados acima antes de atualizar.</span>'
        : '<button class="btn pri" id="atAplicar">Atualizar agora</button><span class="dado">Faz cópia de segurança, troca os arquivos e reinicia o sistema.</span>'}</div>`;
    if ($('#atAplicar')) $('#atAplicar').onclick = tentar(() => aplicarAtualizacao(r.novidades.length));
  });
}

async function aplicarAtualizacao(quantas) {
  if (!(await confirmar(`Atualizar o sistema agora (${quantas} mudança(s))? Vou fazer uma cópia de segurança antes e reiniciar no fim. ` +
    'Quem estiver usando em outro computador vai precisar entrar de novo.', 'Atualizar'))) return;
  $('#atResultado').innerHTML = '<div class="dica">⏳ Fazendo cópia de segurança e baixando a versão nova…</div>';
  const r = await api('POST', '/api/admin/atualizacao/aplicar');
  if (!r.ok) {
    $('#atResultado').innerHTML = `<div class="aviso-fixo perigo" style="border-radius:8px">😕 ${esc(r.aviso || 'A atualização não foi aplicada.')}
      ${r.copia ? `<br><small>Sua cópia de segurança foi gravada assim mesmo: <span class="mono">${esc(r.copia)}</span></small>` : ''}</div>`;
    return;
  }
  if (!r.atualizou) {
    $('#atResultado').innerHTML = '<div class="dica">✅ Já estava tudo em dia — nada mudou.</div>';
    return;
  }
  toast('Atualizado! Reiniciando o sistema…');
  try { await api('POST', '/api/admin/reiniciar'); } catch { /* o servidor cai no meio da resposta */ }
  $('#raiz').innerHTML = `<div class="login"><form><img src="logo.png" alt=""><h1>Atualizando…</h1>
    <p>O sistema baixou a versão nova (${esc(r.de)} → ${esc(r.para)}) e está reiniciando.<br>Esta página volta sozinha em alguns segundos.</p></form></div>`;
  const voltar = async () => { try { await fetch('/api/backups/estado', { headers: { 'X-IEL': '1' } }); location.reload(); } catch { setTimeout(voltar, 1500); } };
  setTimeout(voltar, 4000);
}

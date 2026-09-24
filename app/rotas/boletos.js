// Etapa 3 — Boletos: conferência de descontos antes da massa (POP 5.3) e protocolo de entrega dos boletos físicos.
'use strict';

module.exports = function boletos(ctx) {
  const { rota, db, cfg, registrar, falha, json, corpoJson, exigirAdmin, hoje, agoraIso, S, turmaRotulo, foneWhats, destinoDe, transacao, L } = ctx;
  const ordemSerie = (a) => (a.novo ? 100 : 0) + (S.SERIES.findIndex((s) => s.chave === a.serie_chave) + 1 || 50);

  // Quem vai ter boleto no ano: alunos com a matrícula em andamento ou concluída
  const alunosDoAno = (ano) => db.prepare(`SELECT a.* FROM alunos a JOIN rematriculas r ON r.aluno_id = a.id AND r.ano = ?
    WHERE a.ativo = 1 AND r.status IN ('reservada','concluida') ORDER BY a.nome`).all(ano);

  // Cruza filhos de funcionários (isentos), bolsas CEBAS e atividades extras.
  // Regra adotada: os descontos NÃO somam — vale o maior. A isenção do funcionário é configurável.
  function conferencia(ano) {
    const c = cfg();
    const pctFunc = Number(c.desconto_funcionario);
    const alunos = alunosDoAno(ano);
    const bolsas = new Map();
    for (const b of db.prepare(`SELECT id, aluno_id, status, ofertado, aprovado FROM bolsas
      WHERE ano = ? AND aluno_id IS NOT NULL AND status IN ('ofertada','concedida')`).all(ano)) {
      const pct = b.aprovado ?? b.ofertado;
      if (pct == null) continue;
      const atual = bolsas.get(b.aluno_id);
      if (!atual || pct > atual.pct) bolsas.set(b.aluno_id, { pct, status: b.status });
    }
    const extras = new Map();
    for (const i of db.prepare(`SELECT i.aluno_id, i.ano, i.parcelas, i.valor_parcela, i.desconto_folha, t.nome atividade
      FROM inscricoes i JOIN atividades t ON t.id = i.atividade_id WHERE i.status = 'ativa' AND i.ano IN (?, ?) ORDER BY t.ordem`).all(ano, ano - 1)) {
      if (!extras.has(i.aluno_id)) extras.set(i.aluno_id, []);
      extras.get(i.aluno_id).push(i);
    }
    const conf = new Map(db.prepare('SELECT * FROM boletos_conf WHERE ano = ?').all(ano).map((x) => [x.aluno_id, x]));

    const linhas = alunos.map((a) => {
      const bolsa = bolsas.get(a.id) || null;
      const todas = extras.get(a.id) || [];
      const doAno = todas.filter((x) => x.ano === ano);
      const anteriores = todas.filter((x) => x.ano === ano - 1);
      const k = conf.get(a.id) || {};
      const esperado = a.filho_funcionario ? pctFunc : bolsa ? bolsa.pct : 0;
      const origem = a.filho_funcionario ? 'Filho(a) de funcionário'
        : bolsa ? `Bolsa CEBAS ${bolsa.pct}% (${bolsa.status === 'concedida' ? 'concedida' : 'ofertada'})` : 'Sem desconto';
      const alertas = [];
      if (a.filho_funcionario && bolsa) alertas.push(`Tem isenção de funcionário e bolsa de ${bolsa.pct}%: os descontos não somam, vale ${Math.max(pctFunc, bolsa.pct)}%.`);
      if (bolsa && bolsa.status === 'ofertada') alertas.push('Bolsa ofertada, ainda sem contrato assinado: confirme antes de lançar.');
      for (const x of doAno) if (x.valor_parcela == null) alertas.push(`Atividade extra sem valor cadastrado: ${x.atividade}.`);
      if (!doAno.length && anteriores.length) alertas.push(`Tinha ${anteriores.map((x) => x.atividade).join(', ')} em ${ano - 1}: confirme se continua em ${ano}.`);
      if (k.desconto_acadesc != null && Number(k.desconto_acadesc) !== esperado) alertas.push(`No ACADESC está ${k.desconto_acadesc}% e o esperado é ${esperado}%.`);
      const destino = destinoDe(a, ano);
      return {
        aluno_id: a.id, mat: a.mat, nome: a.nome, turma_rotulo: turmaRotulo(a), destino: destino ? destino.rotulo : '', ordem: ordemSerie(a),
        responsavel: a.nome_resp || a.nome_mae || a.nome_pai || '', whatsapp: foneWhats(a),
        filho_funcionario: !!a.filho_funcionario, bolsa, desconto_esperado: esperado, origem,
        extras: doAno.map((x) => ({ atividade: x.atividade, parcelas: x.parcelas, valor_parcela: x.valor_parcela, desconto_folha: !!x.desconto_folha })),
        extras_anterior: anteriores.map((x) => x.atividade),
        conferido: !!k.conferido, lancado: !!k.lancado, desconto_acadesc: k.desconto_acadesc ?? null, obs: k.obs || '',
        atualizado_por: k.atualizado_por || '', atualizado_em: k.atualizado_em || null,
        divergencia: k.desconto_acadesc != null && Number(k.desconto_acadesc) !== esperado, alertas,
      };
    });
    const resumo = {
      total: linhas.length,
      com_desconto: linhas.filter((l) => l.desconto_esperado > 0).length,
      isentos: linhas.filter((l) => l.filho_funcionario).length,
      bolsistas: linhas.filter((l) => l.bolsa).length,
      com_extras: linhas.filter((l) => l.extras.length).length,
      // Quem tinha atividade extra no ano anterior e ainda não se inscreveu no novo: confirmar antes de gerar os boletos
      a_confirmar_extras: linhas.filter((l) => !l.extras.length && l.extras_anterior.length).length,
      conferidos: linhas.filter((l) => l.conferido).length,
      lancados: linhas.filter((l) => l.lancado).length,
      divergencias: linhas.filter((l) => l.divergencia).length,
      com_alerta: linhas.filter((l) => l.alertas.length).length,
    };
    return { ano, desconto_funcionario: pctFunc, dia_venc: c.boletos_dia_venc, mes_massa: +c.boletos_mes_massa, linhas, resumo };
  }

  rota('GET', '/api/boletos/conferencia', async (req, res, { url }) => {
    const ano = +(url.searchParams.get('ano') || cfg().ano_matricula);
    json(res, 200, conferencia(ano));
  });

  function gravarConf(alunoId, ano, b, u) {
    const a = db.prepare('SELECT id, nome FROM alunos WHERE id = ?').get(alunoId) || falha(404, 'Aluno não encontrado');
    const atual = db.prepare('SELECT * FROM boletos_conf WHERE aluno_id = ? AND ano = ?').get(a.id, ano) || {};
    const num = (v) => (v === '' || v == null ? null : Number(String(v).replace(',', '.')));
    const novo = {
      conferido: b.conferido === undefined ? atual.conferido ?? 0 : b.conferido ? 1 : 0,
      lancado: b.lancado === undefined ? atual.lancado ?? 0 : b.lancado ? 1 : 0,
      desconto_acadesc: b.desconto_acadesc === undefined ? atual.desconto_acadesc ?? null : num(b.desconto_acadesc),
      obs: b.obs === undefined ? atual.obs ?? null : String(b.obs).trim() || null,
    };
    if (novo.desconto_acadesc != null && Number.isNaN(novo.desconto_acadesc)) falha(400, 'Percentual inválido');
    db.prepare(`INSERT INTO boletos_conf (aluno_id, ano, conferido, lancado, desconto_acadesc, obs, atualizado_em, atualizado_por)
      VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(aluno_id, ano) DO UPDATE SET conferido = excluded.conferido, lancado = excluded.lancado,
      desconto_acadesc = excluded.desconto_acadesc, obs = excluded.obs, atualizado_em = excluded.atualizado_em, atualizado_por = excluded.atualizado_por`)
      .run(a.id, ano, novo.conferido, novo.lancado, novo.desconto_acadesc, novo.obs, agoraIso(), u.login);
    return a;
  }

  rota('PUT', '/api/boletos/conferencia/:aluno', async (req, res, { u, p, url }) => {
    const b = await corpoJson(req);
    const ano = +(b.ano || url.searchParams.get('ano') || cfg().ano_matricula);
    const a = gravarConf(+p.aluno, ano, b, u);
    registrar(u.login, 'conferiu desconto do boleto', { aluno_id: a.id, nome: a.nome, ano, ...b });
    json(res, 200, { ok: true });
  });

  // Marca vários de uma vez (ex.: "conferi a turma inteira")
  rota('POST', '/api/boletos/conferencia/lote', async (req, res, { u }) => {
    const b = await corpoJson(req);
    const ids = (Array.isArray(b.alunos) ? b.alunos : []).map(Number).filter(Boolean).slice(0, 800);
    if (!ids.length) falha(400, 'Nenhum aluno selecionado');
    const ano = +(b.ano || cfg().ano_matricula);
    transacao(() => { for (const id of ids) gravarConf(id, ano, b, u); });
    registrar(u.login, 'conferiu descontos em lote', { ano, qtd: ids.length, conferido: b.conferido, lancado: b.lancado });
    json(res, 200, { ok: true, alterados: ids.length });
  });

  // ── Protocolo de entrega dos boletos físicos ──
  rota('GET', '/api/remessas', async (req, res, { url }) => {
    const ano = url.searchParams.get('ano');
    const lin = db.prepare(`SELECT r.*, (SELECT COUNT(*) FROM remessa_entregas e WHERE e.remessa_id = r.id AND e.entregue_em IS NOT NULL) entregues
      FROM remessas r ${ano ? 'WHERE r.ano = ?' : ''} ORDER BY r.ano DESC, r.id DESC`).all(...(ano ? [+ano] : []));
    const cache = {};
    json(res, 200, lin.map((r) => ({ ...r, total: (cache[r.ano] ??= alunosDoAno(r.ano).length) })));
  });

  rota('POST', '/api/remessas', async (req, res, { u }) => {
    const b = await corpoJson(req);
    if (!String(b.nome || '').trim()) falha(400, 'Dê um nome à remessa (ex.: Boletos 2027 — massa anual)');
    const ano = +(b.ano || cfg().ano_matricula);
    const r = db.prepare('INSERT INTO remessas (nome, ano, referencia, obs, criado_em, criado_por) VALUES (?,?,?,?,?,?)')
      .run(String(b.nome).trim(), ano, b.referencia || null, b.obs || null, agoraIso(), u.login);
    registrar(u.login, 'criou remessa de boletos', { nome: b.nome, ano });
    json(res, 201, { id: Number(r.lastInsertRowid) });
  });

  rota('PUT', '/api/remessas/:id', async (req, res, { u, p }) => {
    const b = await corpoJson(req);
    db.prepare('UPDATE remessas SET nome = COALESCE(?, nome), referencia = COALESCE(?, referencia), obs = COALESCE(?, obs) WHERE id = ?')
      .run(b.nome ?? null, b.referencia ?? null, b.obs ?? null, +p.id);
    registrar(u.login, 'alterou remessa de boletos', { id: +p.id, ...b });
    json(res, 200, { ok: true });
  });

  rota('DELETE', '/api/remessas/:id', async (req, res, { u, p }) => {
    exigirAdmin(u);
    const r = db.prepare('SELECT nome FROM remessas WHERE id = ?').get(+p.id) || falha(404, 'Remessa não encontrada');
    const lixeira_id = L.excluir({ tipo: 'remessa', rotulo: r.nome, usuario: u.login, tabela: 'remessas', onde: 'id = ?', params: [+p.id],
      filhas: [{ tabela: 'remessa_entregas', onde: 'remessa_id = ?', params: [+p.id] }] });
    registrar(u.login, 'excluiu remessa de boletos (foi para a lixeira)', r.nome);
    json(res, 200, { ok: true, lixeira_id });
  });

  // Lista de entrega da remessa (agrupada por turma no front)
  rota('GET', '/api/remessas/:id', async (req, res, { p }) => {
    const r = db.prepare('SELECT * FROM remessas WHERE id = ?').get(+p.id) || falha(404, 'Remessa não encontrada');
    const ent = new Map(db.prepare('SELECT * FROM remessa_entregas WHERE remessa_id = ?').all(r.id).map((e) => [e.aluno_id, e]));
    const alunos = alunosDoAno(r.ano).map((a) => {
      const e = ent.get(a.id) || {};
      return {
        aluno_id: a.id, mat: a.mat, nome: a.nome, turma_rotulo: turmaRotulo(a), novo: !!a.novo, ordem: ordemSerie(a),
        responsavel: a.nome_resp || a.nome_mae || a.nome_pai || '', whatsapp: foneWhats(a),
        entregue_em: e.entregue_em || null, recebido_por: e.recebido_por || '', canal: e.canal || '', obs: e.obs || '', usuario: e.usuario || '',
      };
    });
    json(res, 200, { remessa: r, alunos, entregues: alunos.filter((a) => a.entregue_em).length });
  });

  rota('PUT', '/api/remessas/:id/entregas/:aluno', async (req, res, { u, p }) => {
    const b = await corpoJson(req);
    const r = db.prepare('SELECT * FROM remessas WHERE id = ?').get(+p.id) || falha(404, 'Remessa não encontrada');
    const a = db.prepare('SELECT id, nome FROM alunos WHERE id = ?').get(+p.aluno) || falha(404, 'Aluno não encontrado');
    const entregue = b.entregue === undefined ? true : !!b.entregue;
    const quando = entregue ? b.entregue_em || hoje() : null;
    db.prepare(`INSERT INTO remessa_entregas (remessa_id, aluno_id, entregue_em, recebido_por, canal, obs, usuario) VALUES (?,?,?,?,?,?,?)
      ON CONFLICT(remessa_id, aluno_id) DO UPDATE SET entregue_em = excluded.entregue_em, recebido_por = COALESCE(excluded.recebido_por, recebido_por),
      canal = COALESCE(excluded.canal, canal), obs = COALESCE(excluded.obs, obs), usuario = excluded.usuario`)
      .run(r.id, a.id, quando, b.recebido_por ?? null, b.canal ?? null, b.obs ?? null, u.login);
    registrar(u.login, entregue ? 'entregou boleto' : 'desmarcou entrega de boleto', { aluno_id: a.id, nome: a.nome, remessa: r.nome });
    json(res, 200, { ok: true, entregue_em: quando });
  });
};

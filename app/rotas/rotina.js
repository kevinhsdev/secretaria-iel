// Etapa 3 — Tarefas do dia por pessoa, calendário anual/sazonal com lembretes e registro de atendimentos.
'use strict';

module.exports = function rotina(ctx) {
  const { rota, db, cfg, registrar, falha, json, corpoJson, exigirAdmin, hoje, agoraIso, S, turmaRotulo } = ctx;

  const DIAS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const CANAIS = { balcao: 'Balcão', telefone: 'Telefone', whatsapp: 'WhatsApp', email: 'E-mail' };
  const CATEGORIAS = ['Matrícula / rematrícula', 'Documentos e declarações', 'Financeiro / boletos', 'Bolsa (CEBAS)', 'Atividades extras',
    'Saída / portão', 'Lanche Card', 'Transporte escolar', 'Pedagógico', 'Outros'];
  const diaSemana = (iso) => new Date(iso + 'T12:00:00').getDay();
  const valido = (iso) => /^\d{4}-\d{2}-\d{2}$/.test(String(iso || ''));

  const pessoas = () => db.prepare('SELECT login, nome FROM usuarios WHERE ativo = 1 ORDER BY nome').all();

  // ── Tarefas do dia ──
  function tarefasDoDia(data) {
    const d = diaSemana(data);
    const feitos = new Map(db.prepare('SELECT * FROM rotina_feito WHERE data = ?').all(data).map((x) => [x.tarefa_id, x]));
    const fixas = db.prepare('SELECT * FROM rotina_tarefas WHERE ativo = 1 ORDER BY ordem, id').all()
      .filter((t) => !t.dias || t.dias.split(',').map(Number).includes(d))
      .map((t) => {
        const f = feitos.get(t.id) || {};
        return { ...t, tipo: 'fixa', feito: !!f.feito, feito_por: f.usuario || '', feito_em: f.quando || null };
      });
    const avulsas = db.prepare('SELECT * FROM tarefas_dia WHERE data = ? ORDER BY feito, id').all(data)
      .map((t) => ({ ...t, tipo: 'avulsa', feito: !!t.feito }));
    return { fixas, avulsas };
  }

  rota('GET', '/api/rotina', async (req, res, { url }) => {
    const data = url.searchParams.get('data') || hoje();
    if (!valido(data)) falha(400, 'Data inválida');
    const d = diaSemana(data);
    const { fixas, avulsas } = tarefasDoDia(data);
    const todas = [...fixas, ...avulsas];
    json(res, 200, {
      data, dia_semana: d, dia_nome: DIAS[d], fim_de_semana: d === 0 || d === 6,
      pessoas: pessoas(), fixas, avulsas,
      resumo: { total: todas.length, feitas: todas.filter((t) => t.feito).length },
    });
  });

  rota('PUT', '/api/rotina/feito/:id', async (req, res, { u, p }) => {
    const b = await corpoJson(req);
    const data = b.data || hoje();
    if (!valido(data)) falha(400, 'Data inválida');
    const t = db.prepare('SELECT * FROM rotina_tarefas WHERE id = ?').get(+p.id) || falha(404, 'Tarefa não encontrada');
    if (b.feito === false) db.prepare('DELETE FROM rotina_feito WHERE tarefa_id = ? AND data = ?').run(t.id, data);
    else db.prepare(`INSERT INTO rotina_feito (tarefa_id, data, feito, quando, usuario) VALUES (?,?,1,?,?)
      ON CONFLICT(tarefa_id, data) DO UPDATE SET feito = 1, quando = excluded.quando, usuario = excluded.usuario`).run(t.id, data, agoraIso(), u.login);
    json(res, 200, { ok: true });
  });

  // Cronograma (quem faz o quê em cada dia da semana) — só a administração altera
  rota('GET', '/api/rotina/tarefas', async (req, res) => json(res, 200, db.prepare('SELECT * FROM rotina_tarefas ORDER BY ordem, id').all()));
  rota('POST', '/api/rotina/tarefas', async (req, res, { u }) => {
    exigirAdmin(u);
    const b = await corpoJson(req);
    if (!String(b.titulo || '').trim()) falha(400, 'Informe o que precisa ser feito');
    db.prepare('INSERT INTO rotina_tarefas (titulo, detalhe, responsavel, dias, periodo, ordem) VALUES (?,?,?,?,?,99)')
      .run(String(b.titulo).trim(), b.detalhe || null, b.responsavel || 'todos', b.dias || '1,2,3,4,5', b.periodo || 'dia');
    registrar(u.login, 'criou tarefa no cronograma', b.titulo);
    json(res, 201, { ok: true });
  });
  rota('PUT', '/api/rotina/tarefas/:id', async (req, res, { u, p }) => {
    exigirAdmin(u);
    const b = await corpoJson(req);
    const ks = ['titulo', 'detalhe', 'responsavel', 'dias', 'periodo', 'ordem', 'ativo'].filter((k) => b[k] !== undefined);
    if (ks.length) db.prepare(`UPDATE rotina_tarefas SET ${ks.map((k) => k + ' = ?').join(', ')} WHERE id = ?`)
      .run(...ks.map((k) => (typeof b[k] === 'boolean' ? (b[k] ? 1 : 0) : b[k] === '' ? null : b[k])), +p.id);
    registrar(u.login, 'alterou tarefa do cronograma', { id: +p.id, ...b });
    json(res, 200, { ok: true });
  });

  // Tarefas avulsas do dia ("hoje ainda preciso…")
  rota('POST', '/api/tarefas-dia', async (req, res, { u }) => {
    const b = await corpoJson(req);
    if (!String(b.titulo || '').trim()) falha(400, 'Escreva a tarefa');
    const data = b.data || hoje();
    if (!valido(data)) falha(400, 'Data inválida');
    const r = db.prepare('INSERT INTO tarefas_dia (data, responsavel, titulo, detalhe, criado_em, criado_por) VALUES (?,?,?,?,?,?)')
      .run(data, b.responsavel || u.login, String(b.titulo).trim(), b.detalhe || null, agoraIso(), u.login);
    registrar(u.login, 'anotou tarefa do dia', { data, titulo: b.titulo });
    json(res, 201, { id: Number(r.lastInsertRowid) });
  });
  rota('PUT', '/api/tarefas-dia/:id', async (req, res, { u, p }) => {
    const b = await corpoJson(req);
    const t = db.prepare('SELECT * FROM tarefas_dia WHERE id = ?').get(+p.id) || falha(404, 'Tarefa não encontrada');
    if (b.feito !== undefined) db.prepare('UPDATE tarefas_dia SET feito = ?, feito_em = ? WHERE id = ?').run(b.feito ? 1 : 0, b.feito ? agoraIso() : null, t.id);
    const ks = ['titulo', 'detalhe', 'responsavel', 'data'].filter((k) => b[k] !== undefined);
    if (ks.length) db.prepare(`UPDATE tarefas_dia SET ${ks.map((k) => k + ' = ?').join(', ')} WHERE id = ?`).run(...ks.map((k) => b[k] || null), t.id);
    json(res, 200, { ok: true });
  });
  rota('DELETE', '/api/tarefas-dia/:id', async (req, res, { u, p }) => {
    db.prepare('DELETE FROM tarefas_dia WHERE id = ?').run(+p.id);
    registrar(u.login, 'excluiu tarefa do dia', p.id);
    json(res, 200, { ok: true });
  });

  // ── Calendário anual / sazonal ──
  function calendario(ano) {
    const feitos = new Map(db.prepare('SELECT * FROM calendario_feito WHERE ano = ?').all(ano).map((x) => [x.item_id, x]));
    const h = hoje();
    return db.prepare('SELECT * FROM calendario WHERE ativo = 1 ORDER BY mes, COALESCE(dia, 99), ordem, id').all().map((i) => {
      const f = feitos.get(i.id) || {};
      const data = i.dia ? `${ano}-${String(i.mes).padStart(2, '0')}-${String(i.dia).padStart(2, '0')}` : null;
      const fimDoMes = `${ano}-${String(i.mes).padStart(2, '0')}-${String(new Date(ano, i.mes, 0).getDate()).padStart(2, '0')}`;
      const limite = data || fimDoMes;
      return {
        ...i, mes_nome: MESES[i.mes - 1], data, limite,
        feito: !!f.feito_em, feito_em: f.feito_em || null, feito_por: f.usuario || '',
        atrasado: !f.feito_em && limite < h, do_mes: i.mes === +h.slice(5, 7),
        dias: Math.round((Date.parse(limite) - Date.parse(h)) / 86400000),
      };
    });
  }

  rota('GET', '/api/calendario', async (req, res, { url }) => {
    const ano = +(url.searchParams.get('ano') || new Date().getFullYear());
    const itens = calendario(ano);
    json(res, 200, {
      ano, meses: MESES, itens,
      resumo: { total: itens.length, feitos: itens.filter((i) => i.feito).length, atrasados: itens.filter((i) => i.atrasado).length,
        do_mes: itens.filter((i) => i.do_mes && !i.feito).length },
    });
  });
  rota('POST', '/api/calendario', async (req, res, { u }) => {
    exigirAdmin(u);
    const b = await corpoJson(req);
    if (!String(b.titulo || '').trim()) falha(400, 'Informe o lembrete');
    const mes = +b.mes;
    if (!(mes >= 1 && mes <= 12)) falha(400, 'Mês inválido');
    db.prepare('INSERT INTO calendario (titulo, detalhe, mes, dia, responsavel, categoria, ordem) VALUES (?,?,?,?,?,?,99)')
      .run(String(b.titulo).trim(), b.detalhe || null, mes, b.dia ? +b.dia : null, b.responsavel || 'todos', b.categoria || null);
    registrar(u.login, 'criou lembrete no calendário', b.titulo);
    json(res, 201, { ok: true });
  });
  rota('PUT', '/api/calendario/:id', async (req, res, { u, p }) => {
    exigirAdmin(u);
    const b = await corpoJson(req);
    const ks = ['titulo', 'detalhe', 'mes', 'dia', 'responsavel', 'categoria', 'ordem', 'ativo'].filter((k) => b[k] !== undefined);
    if (ks.length) db.prepare(`UPDATE calendario SET ${ks.map((k) => k + ' = ?').join(', ')} WHERE id = ?`)
      .run(...ks.map((k) => (typeof b[k] === 'boolean' ? (b[k] ? 1 : 0) : b[k] === '' ? null : b[k])), +p.id);
    registrar(u.login, 'alterou lembrete do calendário', { id: +p.id, ...b });
    json(res, 200, { ok: true });
  });
  rota('DELETE', '/api/calendario/:id', async (req, res, { u, p }) => {
    exigirAdmin(u);
    const i = db.prepare('SELECT titulo FROM calendario WHERE id = ?').get(+p.id) || falha(404, 'Lembrete não encontrado');
    db.prepare('DELETE FROM calendario WHERE id = ?').run(+p.id);
    registrar(u.login, 'excluiu lembrete do calendário', i.titulo);
    json(res, 200, { ok: true });
  });
  rota('PUT', '/api/calendario/:id/feito', async (req, res, { u, p }) => {
    const b = await corpoJson(req);
    const ano = +(b.ano || new Date().getFullYear());
    const i = db.prepare('SELECT * FROM calendario WHERE id = ?').get(+p.id) || falha(404, 'Lembrete não encontrado');
    if (b.feito === false) db.prepare('DELETE FROM calendario_feito WHERE item_id = ? AND ano = ?').run(i.id, ano);
    else db.prepare(`INSERT INTO calendario_feito (item_id, ano, feito_em, usuario, obs) VALUES (?,?,?,?,?)
      ON CONFLICT(item_id, ano) DO UPDATE SET feito_em = excluded.feito_em, usuario = excluded.usuario, obs = COALESCE(excluded.obs, obs)`)
      .run(i.id, ano, hoje(), u.login, b.obs || null);
    registrar(u.login, b.feito === false ? 'reabriu lembrete do calendário' : 'concluiu lembrete do calendário', { titulo: i.titulo, ano });
    json(res, 200, { ok: true });
  });

  // ── Registro de atendimentos ──
  rota('GET', '/api/atendimentos', async (req, res, { url }) => {
    const filtros = [], args = [];
    const de = url.searchParams.get('de'), ate = url.searchParams.get('ate'), canal = url.searchParams.get('canal'), aluno = url.searchParams.get('aluno');
    if (de) { filtros.push('t.data >= ?'); args.push(de); }
    if (ate) { filtros.push('t.data <= ?'); args.push(ate); }
    if (canal) { filtros.push('t.canal = ?'); args.push(canal); }
    if (aluno) { filtros.push('t.aluno_id = ?'); args.push(+aluno); }
    if (url.searchParams.get('pendentes') === '1') filtros.push('t.resolvido = 0');
    const lin = db.prepare(`SELECT t.*, a.nome aluno, a.mat, a.serie_chave, a.turma, a.novo FROM atendimentos t
      LEFT JOIN alunos a ON a.id = t.aluno_id ${filtros.length ? 'WHERE ' + filtros.join(' AND ') : ''}
      ORDER BY t.data DESC, COALESCE(t.hora,'') DESC, t.id DESC LIMIT 500`).all(...args);
    json(res, 200, {
      canais: CANAIS, categorias: CATEGORIAS,
      atendimentos: lin.map((t) => ({ ...t, turma_rotulo: t.aluno_id ? turmaRotulo(t) : '' })),
    });
  });

  const CAMPOS_AT = ['data', 'hora', 'canal', 'aluno_id', 'pessoa', 'telefone', 'assunto', 'categoria', 'detalhe', 'resolvido', 'encaminhado', 'retorno_em'];
  rota('POST', '/api/atendimentos', async (req, res, { u }) => {
    const b = await corpoJson(req);
    if (!String(b.assunto || '').trim()) falha(400, 'Escreva o assunto do atendimento');
    if (b.canal && !CANAIS[b.canal]) falha(400, 'Canal inválido');
    if (b.aluno_id && !db.prepare('SELECT 1 FROM alunos WHERE id = ?').get(+b.aluno_id)) falha(400, 'Aluno não encontrado');
    const agora = new Date();
    const reg = {
      data: b.data || hoje(), hora: b.hora || agora.toTimeString().slice(0, 5), canal: b.canal || 'balcao',
      aluno_id: b.aluno_id ? +b.aluno_id : null, pessoa: b.pessoa || null, telefone: b.telefone || null,
      assunto: String(b.assunto).trim(), categoria: b.categoria || null, detalhe: b.detalhe || null,
      resolvido: b.resolvido === false ? 0 : 1, encaminhado: b.encaminhado || null, retorno_em: b.retorno_em || null,
      criado_em: agoraIso(), usuario: u.login,
    };
    const ks = Object.keys(reg);
    const r = db.prepare(`INSERT INTO atendimentos (${ks.join(',')}) VALUES (${ks.map(() => '?').join(',')})`).run(...ks.map((k) => reg[k]));
    registrar(u.login, 'registrou atendimento (' + (CANAIS[reg.canal] || reg.canal) + ')', { aluno_id: reg.aluno_id, assunto: reg.assunto });
    json(res, 201, { id: Number(r.lastInsertRowid) });
  });
  rota('PUT', '/api/atendimentos/:id', async (req, res, { u, p }) => {
    const b = await corpoJson(req);
    const t = db.prepare('SELECT * FROM atendimentos WHERE id = ?').get(+p.id) || falha(404, 'Atendimento não encontrado');
    if (b.canal && !CANAIS[b.canal]) falha(400, 'Canal inválido');
    const ks = CAMPOS_AT.filter((k) => b[k] !== undefined);
    if (ks.length) db.prepare(`UPDATE atendimentos SET ${ks.map((k) => k + ' = ?').join(', ')} WHERE id = ?`)
      .run(...ks.map((k) => (k === 'resolvido' ? (b[k] ? 1 : 0) : b[k] === '' ? null : b[k])), t.id);
    registrar(u.login, 'atualizou atendimento', { aluno_id: t.aluno_id, campos: ks });
    json(res, 200, { ok: true });
  });
  rota('DELETE', '/api/atendimentos/:id', async (req, res, { u, p }) => {
    exigirAdmin(u);
    db.prepare('DELETE FROM atendimentos WHERE id = ?').run(+p.id);
    registrar(u.login, 'excluiu atendimento', p.id);
    json(res, 200, { ok: true });
  });

  // ── Resumo do dia (tela "Meu dia" e faixa do painel) ──
  rota('GET', '/api/hoje', async (req, res, { u, url }) => {
    const data = url.searchParams.get('data') || hoje();
    if (!valido(data)) falha(400, 'Data inválida');
    const d = diaSemana(data);
    const { fixas, avulsas } = tarefasDoDia(data);
    const minhas = [...fixas.filter((t) => t.responsavel === u.login || t.responsavel === 'todos'), ...avulsas.filter((t) => t.responsavel === u.login)];
    const avisos = db.prepare(`SELECT v.*, a.nome aluno, a.serie_chave, a.turma, a.novo FROM saida_avisos v JOIN alunos a ON a.id = v.aluno_id
      WHERE v.data = ? ORDER BY a.nome`).all(data);
    const ano = +data.slice(0, 4);
    const lembretes = calendario(ano).filter((i) => !i.feito && (i.do_mes || i.atrasado));
    const at = db.prepare('SELECT canal, resolvido FROM atendimentos WHERE data = ?').all(data);
    const anoMat = +cfg().ano_matricula;
    json(res, 200, {
      data, dia_nome: DIAS[d], fim_de_semana: d === 0 || d === 6,
      tarefas: { minhas: minhas.length, minhas_feitas: minhas.filter((t) => t.feito).length, total: fixas.length + avulsas.length,
        feitas: [...fixas, ...avulsas].filter((t) => t.feito).length, lista: minhas },
      saida: { total: avisos.length, pendentes: avisos.filter((v) => !v.conferido_em).length,
        avisos: avisos.map((v) => ({ ...v, turma_rotulo: turmaRotulo(v) })) },
      lembretes: lembretes.slice(0, 8), lembretes_total: lembretes.length,
      atendimentos: { hoje: at.length, em_aberto: at.filter((a) => !a.resolvido).length },
      boletos: { pendentes: db.prepare(`SELECT COUNT(*) n FROM alunos a JOIN rematriculas r ON r.aluno_id = a.id AND r.ano = ?
        WHERE a.ativo = 1 AND r.status IN ('reservada','concluida')
        AND NOT EXISTS (SELECT 1 FROM boletos_conf c WHERE c.aluno_id = a.id AND c.ano = ? AND c.conferido = 1)`).get(anoMat, anoMat).n, ano: anoMat },
      fotos: { faltando: db.prepare(`SELECT COUNT(*) n FROM alunos a WHERE a.ativo = 1 AND NOT EXISTS
        (SELECT 1 FROM fotos_status f WHERE f.aluno_id = a.id AND f.acadesc = 1 AND f.sed = 1 AND f.lanche = 1)`).get().n },
    });
  });
};

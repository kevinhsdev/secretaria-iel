// Etapa 2 — Atividades extras (ballet, judô, futsal, recreação), contratos, cancelamentos e ingressos.
'use strict';
const { gerarContratoExtra } = require('../lib/contrato-extra');

module.exports = function extras(ctx) {
  const { rota, db, cfg, registrar, falha, json, corpoJson, exigirAdmin, hoje, agoraIso, turmaRotulo, transacao } = ctx;

  // Regra da planilha de vocês: parcelas mensais do mês da inscrição até novembro, vencimento dia 10
  function calcularParcelas(dataIso, c) {
    const d = new Date((dataIso || hoje()) + 'T12:00:00');
    const dia = String(Math.min(28, Math.max(1, +c.extras_dia_venc || 10))).padStart(2, '0');
    const ultimo = +c.extras_ultimo_mes || 11;
    const mes = d.getMonth() + 1;
    const parcelas = Math.max(1, ultimo - mes + 1);
    return { ano: d.getFullYear(), parcelas, primeiro_venc: `${d.getFullYear()}-${String(mes).padStart(2, '0')}-${dia}` };
  }

  const ATIV = ['nome', 'publico', 'dias', 'horario', 'valor', 'professor', 'vagas', 'ativo', 'ordem'];
  rota('GET', '/api/atividades', async (req, res, { url }) => {
    const ano = +(url.searchParams.get('ano') || new Date().getFullYear());
    json(res, 200, db.prepare(`SELECT t.*, (SELECT COUNT(*) FROM inscricoes i JOIN alunos a ON a.id = i.aluno_id WHERE i.atividade_id = t.id AND i.status = 'ativa' AND i.ano = ? AND a.ativo = 1) inscritos
      FROM atividades t ORDER BY t.ativo DESC, t.ordem, t.nome`).all(ano));
  });
  rota('POST', '/api/atividades', async (req, res, { u }) => {
    exigirAdmin(u);
    const b = await corpoJson(req);
    if (!String(b.nome || '').trim()) falha(400, 'Informe o nome da atividade');
    const ks = ATIV.filter((k) => b[k] !== undefined);
    db.prepare(`INSERT INTO atividades (${ks.join(',')}) VALUES (${ks.map(() => '?').join(',')})`).run(...ks.map((k) => (b[k] === '' ? null : b[k])));
    registrar(u.login, 'criou atividade extra', b.nome);
    json(res, 201, { ok: true });
  });
  rota('PUT', '/api/atividades/:id', async (req, res, { u, p }) => {
    exigirAdmin(u);
    const b = await corpoJson(req);
    const ks = ATIV.filter((k) => b[k] !== undefined);
    if (ks.length) db.prepare(`UPDATE atividades SET ${ks.map((k) => k + ' = ?').join(', ')} WHERE id = ?`).run(...ks.map((k) => (b[k] === '' ? null : typeof b[k] === 'boolean' ? (b[k] ? 1 : 0) : b[k])), +p.id);
    registrar(u.login, 'alterou atividade extra', { id: +p.id, ...b });
    json(res, 200, { ok: true });
  });

  rota('GET', '/api/inscricoes/calculo', async (req, res, { url }) => {
    const c = cfg();
    const at = db.prepare('SELECT valor FROM atividades WHERE id = ?').get(+url.searchParams.get('atividade')) || {};
    json(res, 200, { ...calcularParcelas(url.searchParams.get('data'), c), valor_parcela: at.valor ?? null });
  });

  rota('GET', '/api/inscricoes', async (req, res, { url }) => {
    const filtros = [], args = [];
    for (const [k, col] of [['atividade', 'i.atividade_id'], ['aluno', 'i.aluno_id'], ['ano', 'i.ano'], ['status', 'i.status']]) {
      const v = url.searchParams.get(k);
      if (v) { filtros.push(`${col} = ?`); args.push(k === 'status' ? v : +v); }
    }
    const lin = db.prepare(`SELECT i.*, t.nome atividade, t.professor, a.nome aluno, a.mat, a.serie_chave, a.turma, a.novo,
        COALESCE(a.nome_resp, a.nome_mae, a.nome_pai) responsavel, a.cel_mae, a.cel_pai, a.filho_funcionario
      FROM inscricoes i JOIN atividades t ON t.id = i.atividade_id JOIN alunos a ON a.id = i.aluno_id
      ${filtros.length ? 'WHERE ' + filtros.join(' AND ') : ''} ORDER BY t.ordem, a.nome`).all(...args);
    json(res, 200, lin.map((l) => ({ ...l, turma_rotulo: turmaRotulo(l) })));
  });

  rota('POST', '/api/inscricoes', async (req, res, { u }) => {
    const b = await corpoJson(req);
    const a = db.prepare('SELECT id, nome FROM alunos WHERE id = ?').get(+b.aluno_id) || falha(400, 'Aluno não encontrado');
    const t = db.prepare('SELECT * FROM atividades WHERE id = ?').get(+b.atividade_id) || falha(400, 'Escolha a atividade');
    const calc = calcularParcelas(b.data_inscricao, cfg());
    const ano = +(b.ano || calc.ano);
    if (db.prepare(`SELECT 1 FROM inscricoes WHERE aluno_id = ? AND atividade_id = ? AND ano = ? AND status = 'ativa'`).get(a.id, t.id, ano)) falha(400, `${a.nome} já está inscrito(a) em ${t.nome} em ${ano}`);
    if (t.vagas) {
      const n = db.prepare(`SELECT COUNT(*) n FROM inscricoes WHERE atividade_id = ? AND ano = ? AND status = 'ativa'`).get(t.id, ano).n;
      if (n >= t.vagas && !b.ignorar_vagas) falha(409, `${t.nome} está com as ${t.vagas} vagas preenchidas`);
    }
    const r = db.prepare(`INSERT INTO inscricoes (aluno_id, atividade_id, ano, data_inscricao, parcelas, valor_parcela, primeiro_venc, desconto_folha, obs, criado_por)
      VALUES (?,?,?,?,?,?,?,?,?,?)`).run(a.id, t.id, ano, b.data_inscricao || hoje(), b.parcelas === '' || b.parcelas == null ? calc.parcelas : +b.parcelas,
      b.valor_parcela === '' || b.valor_parcela == null ? t.valor : +b.valor_parcela, b.primeiro_venc || calc.primeiro_venc, b.desconto_folha ? 1 : 0, b.obs || null, u.login);
    registrar(u.login, 'inscreveu em ' + t.nome, { aluno_id: a.id, nome: a.nome });
    json(res, 201, { id: Number(r.lastInsertRowid) });
  });

  rota('PUT', '/api/inscricoes/:id', async (req, res, { u, p }) => {
    const b = await corpoJson(req);
    const i = db.prepare('SELECT * FROM inscricoes WHERE id = ?').get(+p.id) || falha(404, 'Inscrição não encontrada');
    const ks = ['data_inscricao', 'parcelas', 'valor_parcela', 'primeiro_venc', 'desconto_folha', 'obs'].filter((k) => b[k] !== undefined);
    if (ks.length) db.prepare(`UPDATE inscricoes SET ${ks.map((k) => k + ' = ?').join(', ')} WHERE id = ?`)
      .run(...ks.map((k) => (b[k] === '' ? null : typeof b[k] === 'boolean' ? (b[k] ? 1 : 0) : b[k])), i.id);
    registrar(u.login, 'alterou inscrição em atividade extra', { aluno_id: i.aluno_id, campos: ks });
    json(res, 200, { ok: true });
  });

  rota('POST', '/api/inscricoes/:id/cancelar', async (req, res, { u, p }) => {
    const b = await corpoJson(req);
    const i = db.prepare('SELECT i.*, t.nome atividade, a.nome aluno FROM inscricoes i JOIN atividades t ON t.id = i.atividade_id JOIN alunos a ON a.id = i.aluno_id WHERE i.id = ?').get(+p.id) || falha(404, 'Inscrição não encontrada');
    if (i.status === 'cancelada') falha(400, 'Esta inscrição já está cancelada');
    db.prepare(`UPDATE inscricoes SET status = 'cancelada', data_cancelamento = ?, motivo = ? WHERE id = ?`).run(b.data || hoje(), b.motivo || null, i.id);
    registrar(u.login, 'cancelou ' + i.atividade, { aluno_id: i.aluno_id, nome: i.aluno, motivo: b.motivo });
    json(res, 200, { ok: true });
  });
  rota('POST', '/api/inscricoes/:id/reativar', async (req, res, { u, p }) => {
    const i = db.prepare('SELECT * FROM inscricoes WHERE id = ?').get(+p.id) || falha(404, 'Inscrição não encontrada');
    db.prepare(`UPDATE inscricoes SET status = 'ativa', data_cancelamento = NULL WHERE id = ?`).run(i.id);
    registrar(u.login, 'reativou inscrição em atividade extra', { aluno_id: i.aluno_id });
    json(res, 200, { ok: true });
  });
  rota('DELETE', '/api/inscricoes/:id', async (req, res, { u, p }) => {
    exigirAdmin(u);
    const i = db.prepare('SELECT * FROM inscricoes WHERE id = ?').get(+p.id) || falha(404, 'Inscrição não encontrada');
    db.prepare('DELETE FROM inscricoes WHERE id = ?').run(i.id);
    registrar(u.login, 'excluiu inscrição (lançada por engano)', { aluno_id: i.aluno_id });
    json(res, 200, { ok: true });
  });

  rota('GET', '/api/inscricoes/:id/contrato', async (req, res, { u, p }) => {
    const i = db.prepare('SELECT * FROM inscricoes WHERE id = ?').get(+p.id) || falha(404, 'Inscrição não encontrada');
    const a = db.prepare('SELECT * FROM alunos WHERE id = ?').get(i.aluno_id);
    const t = db.prepare('SELECT * FROM atividades WHERE id = ?').get(i.atividade_id);
    if (!a.mat) falha(400, 'O aluno precisa ter matrícula do ACADESC para gerar o contrato');
    const buf = gerarContratoExtra(a, t, i);
    registrar(u.login, 'gerou contrato de ' + t.nome, { aluno_id: a.id, nome: a.nome });
    res.writeHead(200, {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="contrato-extra.xlsx"; filename*=UTF-8''${encodeURIComponent(`CONTRATO ${t.nome.toUpperCase()} ${i.ano} - ${a.nome}.xlsx`)}`,
    });
    res.end(buf);
  });

  // ── Eventos e ingressos (apresentação do balé, festa junina…) ──
  rota('GET', '/api/eventos', async (req, res) => json(res, 200, db.prepare(`SELECT e.*, COALESCE(SUM(g.quantidade),0) total, COUNT(g.retirado_em) retirados
    FROM eventos e LEFT JOIN ingressos g ON g.evento_id = e.id AND g.quantidade > 0 GROUP BY e.id ORDER BY COALESCE(e.data,'9999') DESC, e.id DESC`).all()));
  rota('POST', '/api/eventos', async (req, res, { u }) => {
    const b = await corpoJson(req);
    if (!String(b.nome || '').trim()) falha(400, 'Informe o nome do evento');
    const r = db.prepare('INSERT INTO eventos (nome, data, limite_por_aluno, obs) VALUES (?, ?, ?, ?)').run(b.nome.trim(), b.data || null, b.limite_por_aluno ? +b.limite_por_aluno : null, b.obs || null);
    registrar(u.login, 'criou evento', b.nome);
    json(res, 201, { id: Number(r.lastInsertRowid) });
  });
  rota('PUT', '/api/eventos/:id', async (req, res, { u, p }) => {
    const b = await corpoJson(req);
    db.prepare('UPDATE eventos SET nome = COALESCE(?, nome), data = COALESCE(?, data), limite_por_aluno = ?, obs = COALESCE(?, obs) WHERE id = ?')
      .run(b.nome ?? null, b.data ?? null, b.limite_por_aluno ? +b.limite_por_aluno : null, b.obs ?? null, +p.id);
    registrar(u.login, 'alterou evento', { id: +p.id, ...b });
    json(res, 200, { ok: true });
  });
  rota('DELETE', '/api/eventos/:id', async (req, res, { u, p }) => {
    exigirAdmin(u);
    db.prepare('DELETE FROM eventos WHERE id = ?').run(+p.id);
    registrar(u.login, 'excluiu evento', p.id);
    json(res, 200, { ok: true });
  });
  // Lista de alunos para o evento. "atividade" limita aos inscritos (ex.: só alunas de ballet)
  rota('GET', '/api/eventos/:id/ingressos', async (req, res, { p, url }) => {
    const ev = db.prepare('SELECT * FROM eventos WHERE id = ?').get(+p.id) || falha(404, 'Evento não encontrado');
    const filtro = url.searchParams.get('filtro') || 'ballet';
    let alunos;
    if (filtro === 'todos') alunos = db.prepare('SELECT id, nome, serie_chave, turma, novo, mat FROM alunos WHERE ativo = 1 ORDER BY nome').all();
    else alunos = db.prepare(`SELECT DISTINCT a.id, a.nome, a.serie_chave, a.turma, a.novo, a.mat FROM alunos a JOIN inscricoes i ON i.aluno_id = a.id AND i.status = 'ativa'
      JOIN atividades t ON t.id = i.atividade_id WHERE a.ativo = 1 AND (? = 'extras' OR t.nome LIKE ?) ORDER BY a.nome`).all(filtro, `%${filtro}%`);
    const ing = Object.fromEntries(db.prepare('SELECT * FROM ingressos WHERE evento_id = ?').all(ev.id).map((g) => [g.aluno_id, g]));
    // Inclui também quem já tem ingresso lançado mesmo fora do filtro
    const ids = new Set(alunos.map((a) => a.id));
    for (const g of Object.values(ing)) if (!ids.has(g.aluno_id)) {
      const a = db.prepare('SELECT id, nome, serie_chave, turma, novo, mat FROM alunos WHERE id = ?').get(g.aluno_id);
      if (a) alunos.push(a);
    }
    json(res, 200, { evento: ev, alunos: alunos.sort((x, y) => x.nome.localeCompare(y.nome)).map((a) => ({ ...a, turma_rotulo: turmaRotulo(a), ...(ing[a.id] || { quantidade: 0 }) })) });
  });
  rota('PUT', '/api/eventos/:id/ingressos/:aluno', async (req, res, { u, p }) => {
    const b = await corpoJson(req);
    const ev = db.prepare('SELECT * FROM eventos WHERE id = ?').get(+p.id) || falha(404, 'Evento não encontrado');
    const qtd = Math.max(0, +b.quantidade || 0);
    if (ev.limite_por_aluno && qtd > ev.limite_por_aluno) falha(400, `Limite de ${ev.limite_por_aluno} ingressos por aluno`);
    const retirado = b.retirado === undefined ? undefined : b.retirado ? hoje() : null;
    transacao(() => {
      db.prepare(`INSERT INTO ingressos (evento_id, aluno_id, quantidade) VALUES (?, ?, ?) ON CONFLICT(evento_id, aluno_id) DO UPDATE SET quantidade = excluded.quantidade`).run(ev.id, +p.aluno, qtd);
      if (retirado !== undefined) db.prepare('UPDATE ingressos SET retirado_em = ?, retirado_por = ? WHERE evento_id = ? AND aluno_id = ?').run(retirado, retirado ? u.login : null, ev.id, +p.aluno);
    });
    json(res, 200, { ok: true, quando: agoraIso() });
  });
};

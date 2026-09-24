// Etapa 2 — Documentos com 1 clique: declarações, termos, carteirinhas e livro ponto.
'use strict';
const fs = require('fs');
const path = require('path');
const { fotoDe } = require('../lib/fotos');

module.exports = function documentos(ctx) {
  const { rota, db, cfg, registrar, falha, json, corpoJson, lerCorpo, exigirAdmin, S, turmaRotulo, destinoDe, lerPlanilha, serialParaIso, agoraIso, L } = ctx;

  const horarioDe = (c, chave) => ({ infantil: c.horario_infantil, fund1: c.horario_fund1, fund2: c.horario_fund2, medio: c.horario_medio }[S.segmento(chave)] || '');

  function dadosAluno(a, c) {
    const ano = +c.ano_matricula;
    const destino = destinoDe(a, ano);
    const inscr = db.prepare(`SELECT i.*, t.nome atividade FROM inscricoes i JOIN atividades t ON t.id = i.atividade_id WHERE i.aluno_id = ? ORDER BY i.id DESC`).all(a.id);
    return {
      ...a, turma_rotulo: turmaRotulo(a),
      serie_extenso: S.extenso(a.serie_chave), horario: horarioDe(c, a.serie_chave),
      destino_chave: destino?.chave || null, destino_extenso: destino && destino.chave !== 'CONC' ? S.extenso(destino.chave) : '',
      destino_horario: destino ? horarioDe(c, destino.chave) : '', ano_letivo_atual: ano - 1, ano_matricula: ano,
      tem_foto: !!fotoDe(c.pastas_fotos, a.mat), inscricoes: inscr,
    };
  }

  // Dados de um ou vários alunos para montar documentos
  rota('GET', '/api/documentos/alunos', async (req, res, { url }) => {
    const c = cfg();
    const ids = String(url.searchParams.get('ids') || '').split(',').map(Number).filter(Boolean).slice(0, 400);
    if (!ids.length) falha(400, 'Nenhum aluno informado');
    const alunos = db.prepare(`SELECT * FROM alunos WHERE id IN (${ids.map(() => '?').join(',')}) ORDER BY nome`).all(...ids);
    json(res, 200, { config: c, alunos: alunos.map((a) => dadosAluno(a, c)) });
  });

  // Todos os alunos de uma turma (carteirinhas, listas)
  rota('GET', '/api/documentos/turma', async (req, res, { url }) => {
    const c = cfg();
    const chave = url.searchParams.get('serie'), turma = url.searchParams.get('turma');
    const alunos = db.prepare(`SELECT * FROM alunos WHERE ativo = 1 AND novo = 0 AND serie_chave = ? AND COALESCE(turma,'') = ? ORDER BY nome`).all(chave, turma || '');
    json(res, 200, { config: c, alunos: alunos.map((a) => dadosAluno(a, c)) });
  });

  rota('GET', '/api/documentos/turmas', async (req, res) => {
    const ordem = Object.fromEntries(S.SERIES.map((s, i) => [s.chave, i]));
    const t = db.prepare(`SELECT serie_chave, COALESCE(turma,'') turma, COUNT(*) n FROM alunos WHERE ativo = 1 AND novo = 0 AND serie_chave IS NOT NULL GROUP BY 1, 2`).all()
      .sort((a, b) => ordem[a.serie_chave] - ordem[b.serie_chave] || a.turma.localeCompare(b.turma))
      .map((x) => ({ ...x, rotulo: `${S.porChave(x.serie_chave).rotulo}${x.turma ? ' ' + x.turma : ''}` }));
    json(res, 200, t);
  });

  // Registro de documentos emitidos (substitui o "Livro de controle de solicitação de documentos")
  rota('POST', '/api/emissoes', async (req, res, { u }) => {
    const b = await corpoJson(req);
    if (!b.tipo) falha(400, 'Tipo obrigatório');
    const ids = Array.isArray(b.alunos) ? b.alunos : [b.aluno_id ?? null];
    const ins = db.prepare('INSERT INTO emissoes (quando, usuario, tipo, aluno_id, descricao) VALUES (?, ?, ?, ?, ?)');
    for (const id of ids.slice(0, 400)) ins.run(agoraIso(), u.login, String(b.tipo).slice(0, 80), id, String(b.descricao || '').slice(0, 300));
    registrar(u.login, 'emitiu ' + b.tipo, { aluno_id: ids.length === 1 ? ids[0] : undefined, qtd: ids.length, descricao: b.descricao });
    json(res, 201, { ok: true });
  });
  rota('GET', '/api/emissoes', async (req, res) => {
    json(res, 200, db.prepare(`SELECT e.*, a.nome aluno FROM emissoes e LEFT JOIN alunos a ON a.id = e.aluno_id ORDER BY e.id DESC LIMIT 200`).all());
  });

  // Foto do aluno (pastas configuradas)
  rota('GET', '/api/foto/:mat', async (req, res, { p }) => {
    const f = fotoDe(cfg().pastas_fotos, p.mat);
    if (!f) { res.writeHead(404, { 'Cache-Control': 'no-store' }); return res.end(); }
    const ext = path.extname(f.arquivo).toLowerCase();
    res.writeHead(200, { 'Content-Type': ext === '.png' ? 'image/png' : 'image/jpeg', 'Cache-Control': 'private, max-age=300' });
    fs.createReadStream(f.arquivo).pipe(res);
  });

  // Lê a exportação "Consulta Pagamentos" do ACADESC (para declaração de pagamento)
  rota('POST', '/api/documentos/ler-pagamentos', async (req, res, { u, url }) => {
    exigirAdmin(u);
    const abas = lerPlanilha(await lerCorpo(req), url.searchParams.get('arquivo') || 'x.xlsx');
    const mat = String(url.searchParams.get('mat') || '');
    for (const a of abas) {
      const i = a.linhas.findIndex((l) => l.some((c) => S.norm(c) === 'dtpagto') && l.some((c) => S.norm(c) === 'mat'));
      if (i < 0) continue;
      const col = {}; a.linhas[i].forEach((c, j) => { col[S.norm(c)] = j; });
      const g = (l, k) => (col[k] == null ? null : l[col[k]]);
      const linhas = a.linhas.slice(i + 1).filter((l) => g(l, 'mat') != null && (!mat || String(g(l, 'mat')) === mat)).map((l) => ({
        mat: String(g(l, 'mat')), nome: g(l, 'nome'), parcela: g(l, 'parcela'), descricao: g(l, 'descricao'),
        venc: serialParaIso(g(l, 'dtvenc')), pagto: serialParaIso(g(l, 'dtpagto')), valor: Number(g(l, 'valor')) || 0,
        juros: Number(g(l, 'juros')) || 0, desconto: Number(g(l, 'desconto')) || 0, recebido: Number(g(l, 'valorrecebido')) || 0,
        responsavel: g(l, 'nomeresp'), cpf_resp: g(l, 'cpfresp'), classe: g(l, 'descclasse'), ano: g(l, 'anoletivo'),
      }));
      return json(res, 200, { linhas });
    }
    falha(400, 'Não encontrei as colunas "Mat" e "DtPagto". Use a exportação "Consulta Pagamentos" do ACADESC.');
  });

  // Funcionários e feriados (livro ponto)
  rota('GET', '/api/funcionarios', async (req, res) => json(res, 200, db.prepare('SELECT * FROM funcionarios ORDER BY ativo DESC, nome').all()));
  rota('POST', '/api/funcionarios', async (req, res, { u }) => {
    exigirAdmin(u);
    const b = await corpoJson(req);
    if (!String(b.nome || '').trim()) falha(400, 'Informe o nome');
    db.prepare('INSERT INTO funcionarios (nome, cargo) VALUES (?, ?)').run(String(b.nome).trim().toUpperCase(), b.cargo || null);
    registrar(u.login, 'cadastrou funcionário', b.nome);
    json(res, 201, { ok: true });
  });
  rota('PUT', '/api/funcionarios/:id', async (req, res, { u, p }) => {
    exigirAdmin(u);
    const b = await corpoJson(req);
    db.prepare('UPDATE funcionarios SET nome = COALESCE(?, nome), cargo = COALESCE(?, cargo), ativo = COALESCE(?, ativo) WHERE id = ?')
      .run(b.nome ? String(b.nome).toUpperCase() : null, b.cargo ?? null, b.ativo == null ? null : b.ativo ? 1 : 0, +p.id);
    registrar(u.login, 'alterou funcionário', { id: +p.id, ...b });
    json(res, 200, { ok: true });
  });
  rota('GET', '/api/feriados', async (req, res) => json(res, 200, db.prepare('SELECT * FROM feriados ORDER BY data').all()));
  rota('POST', '/api/feriados', async (req, res, { u }) => {
    exigirAdmin(u);
    const b = await corpoJson(req);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.data || '')) falha(400, 'Data inválida');
    db.prepare('INSERT INTO feriados (data, nome) VALUES (?, ?) ON CONFLICT(data) DO UPDATE SET nome = excluded.nome').run(b.data, b.nome || 'Feriado');
    registrar(u.login, 'cadastrou feriado', b);
    json(res, 201, { ok: true });
  });
  rota('DELETE', '/api/feriados/:data', async (req, res, { u, p }) => {
    exigirAdmin(u);
    const f = db.prepare('SELECT nome FROM feriados WHERE data = ?').get(p.data) || falha(404, 'Feriado não encontrado');
    const lixeira_id = L.excluir({ tipo: 'feriado', rotulo: `${p.data.split('-').reverse().join('/')} · ${f.nome || ''}`, usuario: u.login, tabela: 'feriados', onde: 'data = ?', params: [p.data] });
    registrar(u.login, 'excluiu feriado (foi para a lixeira)', p.data);
    json(res, 200, { ok: true, lixeira_id });
  });
};

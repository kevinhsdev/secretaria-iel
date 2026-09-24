// Etapa 4 — LGPD: quem consultou a ficha de quem, o que o sistema sabe sobre um aluno
// (direito de acesso da família) e o descarte dos dados de quem já saiu da escola.
'use strict';

module.exports = function lgpd(ctx) {
  const { rota, db, cfg, registrar, falha, json, corpoJson, exigirAdmin, hoje, agoraIso, turmaRotulo, transacao } = ctx;

  // ── Registro de consultas (só a administração vê) ──
  rota('GET', '/api/admin/acessos', async (req, res, { u, url }) => {
    exigirAdmin(u);
    const dias = Math.min(365, Math.max(1, +(url.searchParams.get('dias') || 30)));
    const de = new Date(Date.now() - dias * 86400000).toLocaleDateString('sv-SE');
    const lin = db.prepare(`SELECT c.*, a.nome aluno, a.mat, a.serie_chave, a.turma, a.novo FROM acessos c
      JOIN alunos a ON a.id = c.aluno_id WHERE c.data >= ? ORDER BY c.data DESC, c.ultima DESC LIMIT 500`).all(de);
    json(res, 200, {
      dias,
      acessos: lin.map((l) => ({ ...l, turma_rotulo: turmaRotulo(l) })),
      resumo: {
        fichas: new Set(lin.map((l) => l.aluno_id)).size,
        consultas: lin.reduce((s, l) => s + l.vezes, 0),
        por_pessoa: Object.entries(lin.reduce((o, l) => ({ ...o, [l.usuario]: (o[l.usuario] || 0) + l.vezes }), {})),
      },
    });
  });

  // ── Tudo o que o sistema guarda sobre um aluno (art. 18 da LGPD) ──
  rota('GET', '/api/alunos/:id/dados-pessoais', async (req, res, { u, p }) => {
    exigirAdmin(u);
    const id = +p.id;
    const a = db.prepare('SELECT * FROM alunos WHERE id = ?').get(id) || falha(404, 'Aluno não encontrado');
    const todos = (sql, ...args) => db.prepare(sql).all(...args);
    const dados = {
      gerado_em: agoraIso(), gerado_por: u.login,
      cadastro: a,
      matriculas: todos('SELECT * FROM rematriculas WHERE aluno_id = ? ORDER BY ano', id),
      documentos_entregues: todos(`SELECT e.*, t.nome documento FROM entregas e JOIN doc_tipos t ON t.id = e.doc_id WHERE e.aluno_id = ? ORDER BY e.ano`, id),
      atividades_extras: todos(`SELECT i.*, t.nome atividade FROM inscricoes i JOIN atividades t ON t.id = i.atividade_id WHERE i.aluno_id = ? ORDER BY i.ano`, id),
      ingressos: todos(`SELECT g.*, e.nome evento FROM ingressos g JOIN eventos e ON e.id = g.evento_id WHERE g.aluno_id = ?`, id),
      bolsas: todos('SELECT * FROM bolsas WHERE aluno_id = ? ORDER BY ano', id),
      boletos_conferencia: todos('SELECT * FROM boletos_conf WHERE aluno_id = ? ORDER BY ano', id),
      boletos_entregues: todos(`SELECT e.*, r.nome remessa FROM remessa_entregas e JOIN remessas r ON r.id = e.remessa_id WHERE e.aluno_id = ?`, id),
      foto: db.prepare('SELECT * FROM fotos_status WHERE aluno_id = ?').get(id) || null,
      saida: db.prepare('SELECT * FROM saida_config WHERE aluno_id = ?').get(id) || null,
      quem_pode_buscar: todos('SELECT * FROM saida_autorizados WHERE aluno_id = ? ORDER BY nome', id),
      avisos_de_saida: todos('SELECT * FROM saida_avisos WHERE aluno_id = ? ORDER BY data DESC LIMIT 200', id),
      atendimentos: todos('SELECT * FROM atendimentos WHERE aluno_id = ? ORDER BY data DESC', id),
      documentos_emitidos: todos('SELECT * FROM emissoes WHERE aluno_id = ? ORDER BY id DESC', id),
      quem_consultou: todos('SELECT usuario, data, vezes FROM acessos WHERE aluno_id = ? ORDER BY data DESC LIMIT 200', id),
      alteracoes: todos(`SELECT quando, usuario, acao FROM log WHERE detalhe LIKE ? ORDER BY id DESC LIMIT 300`, `%"aluno_id":${id},%`),
    };
    registrar(u.login, 'exportou os dados pessoais do aluno (LGPD)', { aluno_id: id, nome: a.nome });
    json(res, 200, dados);
  });

  // ── Descarte de dados de quem já saiu ──
  // Candidato = aluno desativado, ou concluinte/sem matrícula há mais de N anos. Nunca alguém matriculado agora.
  function candidatos(anos) {
    const anoMat = +cfg().ano_matricula;
    const limite = anoMat - anos;
    return db.prepare(`SELECT a.*, (SELECT MAX(ano) FROM rematriculas r WHERE r.aluno_id = a.id) ultimo_ano
      FROM alunos a WHERE COALESCE(a.anonimizado, '') = ''
      AND NOT EXISTS (SELECT 1 FROM rematriculas r WHERE r.aluno_id = a.id AND r.ano = ? AND r.status IN ('reservada','concluida'))`).all(anoMat)
      .map((a) => ({ ...a, referencia: a.ultimo_ano || a.ano_letivo || null }))
      .filter((a) => a.ativo === 0 || (a.referencia && a.referencia <= limite))
      .map((a) => ({
        aluno_id: a.id, mat: a.mat, nome: a.nome, turma_rotulo: turmaRotulo(a), ativo: !!a.ativo,
        referencia: a.referencia, motivo: a.ativo === 0 ? 'Marcado como inativo' : `Sem matrícula desde ${a.referencia}`,
      }));
  }

  rota('GET', '/api/admin/lgpd', async (req, res, { u, url }) => {
    exigirAdmin(u);
    const c = cfg();
    const anos = Math.max(1, +(url.searchParams.get('anos') || c.lgpd_anos_descarte || 5));
    const lista = candidatos(anos);
    json(res, 200, {
      anos, candidatos: lista,
      ja_anonimizados: db.prepare(`SELECT COUNT(*) n FROM alunos WHERE COALESCE(anonimizado,'') <> ''`).get().n,
      total_alunos: db.prepare('SELECT COUNT(*) n FROM alunos').get().n,
      campos_apagados: ['nome', 'nome social', 'CPF', 'NIS', 'RG', 'R.A.', 'endereço completo', 'telefones', 'e-mails',
        'nome da mãe, do pai e do responsável', 'CPF e RG do responsável', 'quem pode buscar', 'avisos de saída', 'quem procurou nos atendimentos'],
      campos_mantidos: ['série e turma', 'ano letivo', 'datas de matrícula', 'ano de nascimento', 'situação da rematrícula', 'assuntos dos atendimentos (sem nomes)'],
    });
  });

  rota('POST', '/api/admin/lgpd/anonimizar', async (req, res, { u }) => {
    exigirAdmin(u);
    const b = await corpoJson(req);
    const pedidos = (Array.isArray(b.alunos) ? b.alunos : []).map(Number).filter(Boolean);
    if (!pedidos.length) falha(400, 'Escolha quais ex-alunos anonimizar');
    const anos = Math.max(1, +(b.anos || cfg().lgpd_anos_descarte || 5));
    const permitidos = new Set(candidatos(anos).map((c) => c.aluno_id));
    const alvos = pedidos.filter((id) => permitidos.has(id));
    if (!alvos.length) falha(400, 'Nenhum dos alunos escolhidos pode ser anonimizado (alunos matriculados nunca são).');
    const quando = agoraIso();
    let n = 0;
    transacao(() => {
      for (const id of alvos) {
        const a = db.prepare('SELECT mat, nome, dt_nasc FROM alunos WHERE id = ?').get(id);
        if (!a) continue;
        const apelido = `EX-ALUNO ${a.mat || id}`;
        db.prepare(`UPDATE alunos SET nome = ?, nome_social = NULL, cpf = NULL, nis = NULL, rg = NULL, ra = NULL,
          endereco = NULL, bairro = NULL, cidade = NULL, uf = NULL, cep = NULL, telefone = NULL,
          nome_mae = NULL, nome_pai = NULL, nome_resp = NULL, email = NULL, email_mae = NULL, email_pai = NULL,
          tel_mae = NULL, cel_mae = NULL, tel_pai = NULL, cel_pai = NULL, cpf_resp = NULL, rg_resp = NULL, tel_resp = NULL,
          dt_nasc = ?, obs = NULL, ativo = 0, anonimizado = ? WHERE id = ?`)
          .run(apelido, a.dt_nasc ? a.dt_nasc.slice(0, 4) + '-01-01' : null, quando, id);
        db.prepare('DELETE FROM saida_autorizados WHERE aluno_id = ?').run(id);
        db.prepare('DELETE FROM saida_avisos WHERE aluno_id = ?').run(id);
        db.prepare('DELETE FROM saida_config WHERE aluno_id = ?').run(id);
        db.prepare('UPDATE atendimentos SET pessoa = NULL, telefone = NULL, detalhe = NULL WHERE aluno_id = ?').run(id);
        db.prepare(`UPDATE bolsas SET nome_aluno = ?, responsavel = NULL, telefone = NULL, endereco = NULL, obs = NULL WHERE aluno_id = ?`).run(apelido, id);
        db.prepare('DELETE FROM acessos WHERE aluno_id = ?').run(id);
        n++;
      }
    });
    registrar(u.login, 'anonimizou dados de ex-alunos (LGPD)', { quantidade: n, alunos: alvos.slice(0, 50) });
    json(res, 200, { anonimizados: n, ignorados: pedidos.length - alvos.length });
  });
};

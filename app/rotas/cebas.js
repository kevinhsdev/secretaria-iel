// Etapa 2 — Bolsa Social (CEBAS). Dados socioeconômicos: somente a administração acessa (LGPD).
'use strict';

// Relação de documentos do edital 2027 ("(NOVOS PEDIDOS) RELAÇÃO DE DOCUMENTOS BOLSA 2027.pdf")
const CHECKLIST = [
  { id: 'pessoais', grupo: 'Documentos pessoais', nome: 'Certidões (nascimento, casamento, união estável, divórcio) de todos da casa' },
  { id: 'rg_cpf', grupo: 'Documentos pessoais', nome: 'RG, CPF e Título de Eleitor de todos da casa' },
  { id: 'vacina', grupo: 'Documentos pessoais', nome: 'Carteira de vacinação do aluno' },
  { id: 'ctps', grupo: 'Documentos pessoais', nome: 'Carteira de trabalho digital (a partir de 16 anos) + print dos contratos' },
  { id: 'renda', grupo: 'Renda familiar', nome: 'Comprovantes de renda dos 3 últimos meses (holerites, extratos, INSS…)' },
  { id: 'irpf', grupo: 'Renda familiar', nome: 'Declaração de IR completa com recibo, ou informe de isento com firma reconhecida' },
  { id: 'pensao', grupo: 'Renda familiar', nome: 'Pensão alimentícia (se houver)', opcional: true },
  { id: 'bolsa_familia', grupo: 'Renda familiar', nome: 'Bolsa Família — 3 últimos meses (se beneficiado)', opcional: true },
  { id: 'despesas', grupo: 'Despesas', nome: '3 contas de água, luz, gás e faturas de cartão' },
  { id: 'moradia', grupo: 'Moradia', nome: 'Comprovante da moradia (IPTU, financiamento, aluguel ou cedido)' },
  { id: 'adimplencia', grupo: 'Despesas', nome: 'Carta anual de adimplência escolar (emitida pela escola)' },
  { id: 'declaracoes', grupo: 'Firma reconhecida', nome: 'Declarações com firma reconhecida (autônomo, desemprego, subsistência…)', opcional: true },
  { id: 'laudo', grupo: 'Outros', nome: 'Laudo médico com CID (doença crônica na família)', opcional: true },
  { id: 'guarda', grupo: 'Outros', nome: 'Documentos de guarda da criança', opcional: true },
  { id: 'requerimento', grupo: 'Processo', nome: 'Requerimento preenchido e assinado' },
];
const STATUS = {
  inscrito: 'Requerimento entregue', conferido: 'Documentos conferidos', assistente: 'Com a assistente social', visita: 'Visita domiciliar',
  ofertada: 'Bolsa ofertada', concedida: 'Concedida (contrato assinado)', indeferida: 'Indeferida', sem_oferta: 'Sem oferta', desistiu: 'Desistiu / cancelada',
};

module.exports = function cebas(ctx) {
  const { rota, db, cfg, registrar, falha, json, corpoJson, lerCorpo, exigirAdmin, S, agoraIso, transacao, lerPlanilha } = ctx;
  const CAMPOS = ['ano', 'tipo', 'aluno_id', 'nome_aluno', 'serie', 'responsavel', 'telefone', 'endereco', 'escola_origem', 'req_enviado', 'req_entregue',
    'visitas', 'percentual_atual', 'per_capita', 'ofertado', 'aprovado', 'contrato_assinado', 'status', 'checklist', 'obs'];

  const limpar = (b) => {
    const r = {};
    for (const k of CAMPOS) {
      if (b[k] === undefined) continue;
      let v = b[k] === '' ? null : b[k];
      if (k === 'checklist' && v && typeof v !== 'string') v = JSON.stringify(v);
      if (k === 'contrato_assinado') v = v ? 1 : 0;
      if (['percentual_atual', 'per_capita', 'ofertado', 'aprovado'].includes(k) && v != null) { v = Number(String(v).replace(',', '.')); if (Number.isNaN(v)) falha(400, 'Valor numérico inválido em ' + k); }
      if (k === 'status' && !STATUS[v]) falha(400, 'Status inválido');
      if (k === 'tipo' && !['renovacao', 'novo'].includes(v)) falha(400, 'Tipo inválido');
      r[k] = v;
    }
    return r;
  };

  rota('GET', '/api/bolsas', async (req, res, { u, url }) => {
    exigirAdmin(u);
    const ano = +(url.searchParams.get('ano') || cfg().cebas_ano);
    const lin = db.prepare(`SELECT b.*, a.mat, a.serie_chave, a.turma FROM bolsas b LEFT JOIN alunos a ON a.id = b.aluno_id WHERE b.ano = ? ORDER BY b.nome_aluno`).all(ano);
    json(res, 200, { ano, status: STATUS, checklist: CHECKLIST, bolsas: lin.map((b) => ({ ...b, checklist: b.checklist ? JSON.parse(b.checklist) : {} })) });
  });
  rota('POST', '/api/bolsas', async (req, res, { u }) => {
    exigirAdmin(u);
    const b = limpar(await corpoJson(req));
    if (!b.nome_aluno && b.aluno_id) b.nome_aluno = (db.prepare('SELECT nome FROM alunos WHERE id = ?').get(b.aluno_id) || {}).nome;
    if (!b.nome_aluno) falha(400, 'Informe o aluno');
    b.ano = b.ano || +cfg().cebas_ano;
    b.atualizado_em = agoraIso(); b.atualizado_por = u.login;
    const ks = Object.keys(b);
    const r = db.prepare(`INSERT INTO bolsas (${ks.join(',')}) VALUES (${ks.map(() => '?').join(',')})`).run(...ks.map((k) => b[k]));
    registrar(u.login, 'abriu processo de bolsa', { nome: b.nome_aluno });
    json(res, 201, { id: Number(r.lastInsertRowid) });
  });
  rota('PUT', '/api/bolsas/:id', async (req, res, { u, p }) => {
    exigirAdmin(u);
    const atual = db.prepare('SELECT * FROM bolsas WHERE id = ?').get(+p.id) || falha(404, 'Processo não encontrado');
    const b = limpar(await corpoJson(req));
    b.atualizado_em = agoraIso(); b.atualizado_por = u.login;
    const ks = Object.keys(b);
    db.prepare(`UPDATE bolsas SET ${ks.map((k) => k + ' = ?').join(', ')} WHERE id = ?`).run(...ks.map((k) => b[k]), atual.id);
    registrar(u.login, b.status && b.status !== atual.status ? `bolsa: ${STATUS[atual.status]} → ${STATUS[b.status]}` : 'atualizou processo de bolsa', { nome: atual.nome_aluno });
    json(res, 200, { ok: true });
  });
  rota('DELETE', '/api/bolsas/:id', async (req, res, { u, p }) => {
    exigirAdmin(u);
    const atual = db.prepare('SELECT nome_aluno FROM bolsas WHERE id = ?').get(+p.id) || falha(404, 'Processo não encontrado');
    db.prepare('DELETE FROM bolsas WHERE id = ?').run(+p.id);
    registrar(u.login, 'excluiu processo de bolsa', { nome: atual.nome_aluno });
    json(res, 200, { ok: true });
  });

  // Importa a "Planilha Bolsas" (abas "Processos (Renovação)" e "Processos 2º fase")
  rota('POST', '/api/bolsas/importar', async (req, res, { u, url }) => {
    exigirAdmin(u);
    const abas = lerPlanilha(await lerCorpo(req), url.searchParams.get('arquivo') || 'x.xlsx');
    const ano = +cfg().cebas_ano;
    const alunos = db.prepare('SELECT id, nome FROM alunos WHERE ativo = 1').all();
    const porNome = new Map(alunos.map((a) => [S.norm(a.nome), a.id]));
    const dataBr = (v) => { const m = String(v ?? '').match(/(\d{2})[./](\d{2})[./](\d{4})/); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };
    const pct = (v) => (typeof v === 'number' ? (v <= 1 ? Math.round(v * 100) : v) : null);
    const res2 = { importados: 0, vinculados: 0, abas: [] };
    transacao(() => {
      for (const a of abas) {
        const h = a.linhas.findIndex((l) => l.some((c) => S.norm(c).startsWith('aluno')) && l.some((c) => S.norm(c).startsWith('responsavel')));
        if (h < 0) continue;
        const idx = {};
        a.linhas[h].forEach((c, j) => { if (c != null) idx[S.norm(c)] = j; });
        const col = (prefixo) => { const k = Object.keys(idx).find((x) => x.startsWith(prefixo)); return k == null ? null : idx[k]; };
        const novo = /2.?\s*fase|novo/i.test(a.nome);
        const c = { aluno: col('aluno'), serie: col('ano 20'), resp: col('responsavel'), tel: col('telefone'), end: col('endereco'), env: col('requerimento enviado'),
          ent: col('requerimento entregue'), novo: col('aluno novo'), escola: col('instituicao'), pct: col('porcetagem') ?? col('porcentagem'), pc: col('per cap'),
          ofe: col('ofertado'), apr: col('aprovado'), ass: col('contrato assinado'), obs: col('observac') };
        const visitas = Object.keys(idx).filter((k) => k.startsWith('visitas'));
        let n = 0;
        for (const l of a.linhas.slice(h + 1)) {
          const nome = String(l[c.aluno] ?? '').trim();
          if (!nome) continue;
          const txtOfe = typeof l[c.ofe] === 'string' ? l[c.ofe] : '';
          const ofe = pct(l[c.ofe]);
          const alunoId = porNome.get(S.norm(nome.replace(/\(.*\)/, ''))) || null;
          if (alunoId) res2.vinculados++;
          const alunoNovo = c.novo != null && /^s/i.test(String(l[c.novo] ?? '').trim()) ? 'Aluno novo na escola' : null;
          const obs = [alunoNovo, l[c.obs], typeof l[c.pct] === 'string' ? l[c.pct] : null, txtOfe].filter(Boolean).join(' · ') || null;
          const status = /reprov|indefer/i.test(txtOfe) ? 'indeferida' : l[c.ass] ? 'concedida' : ofe != null ? 'ofertada' : 'inscrito';
          db.prepare(`INSERT INTO bolsas (ano, tipo, aluno_id, nome_aluno, serie, responsavel, telefone, endereco, escola_origem, req_enviado, req_entregue, visitas,
            percentual_atual, per_capita, ofertado, aprovado, contrato_assinado, status, obs, atualizado_em, atualizado_por) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
            .run(ano, novo ? 'novo' : 'renovacao', alunoId, nome.replace(/\s+/g, ' '),
              String(l[c.serie] ?? '').trim() || null, String(l[c.resp] ?? '').trim() || null, String(l[c.tel] ?? '').trim() || null, String(l[c.end] ?? '').trim() || null,
              c.escola != null ? String(l[c.escola] ?? '').trim() || null : null, c.env != null ? dataBr(l[c.env]) : null, dataBr(l[c.ent]),
              visitas.map((k) => `${k.replace('visitas ', '')}: ${String(l[idx[k]] ?? '—').trim()}`).join(' · ') || null,
              pct(l[c.pct]), typeof l[c.pc] === 'number' ? Math.round(l[c.pc] * 100) / 100 : null, ofe, pct(l[c.apr]), l[c.ass] ? 1 : 0, status, obs, agoraIso(), u.login);
          n++;
        }
        res2.abas.push(`${a.nome.trim()}: ${n}`);
        res2.importados += n;
      }
    });
    if (!res2.importados) falha(400, 'Não encontrei processos. Use a "Planilha Bolsas" (colunas Aluno (a), Responsável…).');
    registrar(u.login, 'importou planilha de bolsas', res2);
    json(res, 200, res2);
  });
};

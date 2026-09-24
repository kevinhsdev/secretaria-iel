// Etapa 4 — Números do ano para a Samara e a Diretoria: um retrato do que a secretaria fez.
'use strict';

module.exports = function relatorios(ctx) {
  const { rota, db, cfg, json, exigirAdmin, S, hoje } = ctx;

  const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const contar = (sql, ...args) => db.prepare(sql).get(...args).n;
  const agrupar = (linhas, chave = 'chave', valor = 'n') => Object.fromEntries(linhas.map((l) => [l[chave], l[valor]]));

  rota('GET', '/api/relatorios', async (req, res, { u, url }) => {
    exigirAdmin(u);
    const c = cfg();
    const ano = +(url.searchParams.get('ano') || c.ano_matricula);
    const anoLetivo = ano - 1;
    const civil = +(url.searchParams.get('civil') || new Date().getFullYear());

    // ── Alunos ──
    const porSerie = db.prepare(`SELECT serie_chave chave, COUNT(*) n FROM alunos WHERE ativo = 1 AND COALESCE(anonimizado,'') = '' GROUP BY 1`).all();
    const segmentos = {};
    for (const l of porSerie) {
      const seg = { infantil: 'Educação Infantil', fund1: 'Fundamental I', fund2: 'Fundamental II', medio: 'Ensino Médio' }[S.segmento(l.chave)] || 'Sem série';
      segmentos[seg] = (segmentos[seg] || 0) + l.n;
    }
    const alunos = {
      ativos: contar(`SELECT COUNT(*) n FROM alunos WHERE ativo = 1 AND COALESCE(anonimizado,'') = ''`),
      novos: contar(`SELECT COUNT(*) n FROM alunos a JOIN rematriculas r ON r.aluno_id = a.id AND r.ano = ?
        WHERE a.novo = 1 AND a.ativo = 1 AND r.status IN ('reservada','concluida')`, ano),
      concluintes: contar(`SELECT COUNT(*) n FROM alunos WHERE ativo = 1 AND serie_chave = 'EM3'`),
      filhos_funcionarios: contar(`SELECT COUNT(*) n FROM alunos WHERE ativo = 1 AND filho_funcionario = 1`),
      anonimizados: contar(`SELECT COUNT(*) n FROM alunos WHERE COALESCE(anonimizado,'') <> ''`),
      por_segmento: segmentos,
      por_serie: S.SERIES.map((s) => ({ rotulo: s.rotulo, n: (porSerie.find((x) => x.chave === s.chave) || {}).n || 0 })).filter((x) => x.n),
    };

    // ── Rematrícula ──
    const st = agrupar(db.prepare(`SELECT COALESCE(r.status,'pendente') chave, COUNT(*) n FROM alunos a
      LEFT JOIN rematriculas r ON r.aluno_id = a.id AND r.ano = ?
      WHERE a.ativo = 1 AND a.novo = 0 AND COALESCE(a.serie_chave,'') <> 'EM3' GROUP BY 1`).all(ano));
    const veteranos = Object.values(st).reduce((s, n) => s + n, 0);
    const vagas = db.prepare('SELECT serie_chave, capacidade FROM vagas WHERE ano = ? AND capacidade IS NOT NULL').all(ano);
    const rematricula = {
      ano, veteranos, ...st,
      concluidas: st.concluida || 0,
      percentual: veteranos ? Math.round((1000 * (st.concluida || 0)) / veteranos) / 10 : 0,
      vagas_definidas: vagas.length, capacidade_total: vagas.reduce((s, v) => s + v.capacidade, 0),
    };

    // ── Documentos ──
    const documentos = {
      tipos_obrigatorios: contar('SELECT COUNT(*) n FROM doc_tipos WHERE ativo = 1 AND obrigatorio = 1'),
      entregues: contar('SELECT COUNT(*) n FROM entregas WHERE ano = ? AND entregue = 1', ano),
      emitidos: contar(`SELECT COUNT(*) n FROM emissoes WHERE quando >= ?`, `${civil}-01-01`),
      por_tipo: db.prepare(`SELECT tipo chave, COUNT(*) n FROM emissoes WHERE quando >= ? GROUP BY 1 ORDER BY n DESC LIMIT 12`).all(`${civil}-01-01`),
    };

    // ── Atividades extras ──
    const ativs = db.prepare(`SELECT t.nome, t.valor, COUNT(i.id) n,
        SUM(CASE WHEN i.status = 'ativa' THEN 1 ELSE 0 END) ativas
      FROM atividades t LEFT JOIN inscricoes i ON i.atividade_id = t.id AND i.ano = ?
      GROUP BY t.id ORDER BY ativas DESC, t.ordem`).all(civil);
    const extras = {
      ano: civil,
      inscricoes_ativas: ativs.reduce((s, a) => s + (a.ativas || 0), 0),
      canceladas: contar(`SELECT COUNT(*) n FROM inscricoes WHERE ano = ? AND status = 'cancelada'`, civil),
      receita_mensal: Math.round(db.prepare(`SELECT COALESCE(SUM(valor_parcela),0) v FROM inscricoes WHERE ano = ? AND status = 'ativa'`).get(civil).v * 100) / 100,
      por_atividade: ativs.filter((a) => a.n),
      eventos: db.prepare(`SELECT e.nome, COALESCE(SUM(g.quantidade),0) ingressos, COUNT(g.retirado_em) retirados
        FROM eventos e LEFT JOIN ingressos g ON g.evento_id = e.id GROUP BY e.id ORDER BY e.id DESC LIMIT 6`).all(),
    };

    // ── Bolsas (CEBAS) ──
    const bolsasAno = +c.cebas_ano;
    const bolsas = {
      ano: bolsasAno,
      total: contar('SELECT COUNT(*) n FROM bolsas WHERE ano = ?', bolsasAno),
      por_status: db.prepare('SELECT status chave, COUNT(*) n FROM bolsas WHERE ano = ? GROUP BY 1').all(bolsasAno),
      concedidas: contar(`SELECT COUNT(*) n FROM bolsas WHERE ano = ? AND status = 'concedida'`, bolsasAno),
      cem_por_cento: contar(`SELECT COUNT(*) n FROM bolsas WHERE ano = ? AND COALESCE(aprovado, ofertado) = 100`, bolsasAno),
      cinquenta: contar(`SELECT COUNT(*) n FROM bolsas WHERE ano = ? AND COALESCE(aprovado, ofertado) = 50`, bolsasAno),
      contratos: contar('SELECT COUNT(*) n FROM bolsas WHERE ano = ? AND contrato_assinado = 1', bolsasAno),
      prestacao_contas: c.cebas_prestacao,
    };

    // ── Boletos ──
    const matriculados = contar(`SELECT COUNT(*) n FROM alunos a JOIN rematriculas r ON r.aluno_id = a.id AND r.ano = ?
      WHERE a.ativo = 1 AND r.status IN ('reservada','concluida')`, ano);
    const boletos = {
      ano, matriculados,
      conferidos: contar('SELECT COUNT(*) n FROM boletos_conf WHERE ano = ? AND conferido = 1', ano),
      lancados: contar('SELECT COUNT(*) n FROM boletos_conf WHERE ano = ? AND lancado = 1', ano),
      remessas: db.prepare(`SELECT r.nome, r.ano, COUNT(e.entregue_em) entregues FROM remessas r
        LEFT JOIN remessa_entregas e ON e.remessa_id = r.id AND e.entregue_em IS NOT NULL GROUP BY r.id ORDER BY r.id DESC LIMIT 6`).all(),
    };

    // ── Fotos ──
    const fotos = {
      completos: contar('SELECT COUNT(*) n FROM fotos_status WHERE acadesc = 1 AND sed = 1 AND lanche = 1'),
      com_foto: contar('SELECT COUNT(*) n FROM fotos_status WHERE tirada = 1'),
      faltando: contar(`SELECT COUNT(*) n FROM alunos a WHERE a.ativo = 1 AND NOT EXISTS
        (SELECT 1 FROM fotos_status f WHERE f.aluno_id = a.id AND f.acadesc = 1 AND f.sed = 1 AND f.lanche = 1)`),
    };

    // ── Saída ──
    const saida = {
      sai_sozinho: contar('SELECT COUNT(*) n FROM saida_config WHERE sai_sozinho = 1'),
      autorizados: contar('SELECT COUNT(*) n FROM saida_autorizados WHERE ativo = 1'),
      alunos_com_autorizado: contar('SELECT COUNT(DISTINCT aluno_id) n FROM saida_autorizados WHERE ativo = 1'),
      avisos_ano: contar('SELECT COUNT(*) n FROM saida_avisos WHERE data >= ?', `${civil}-01-01`),
    };

    // ── Atendimentos ──
    const at = db.prepare('SELECT * FROM atendimentos WHERE data >= ?').all(`${civil}-01-01`);
    const contaPor = (campo) => {
      const o = {};
      for (const a of at) { const k = a[campo] || '(sem)'; o[k] = (o[k] || 0) + 1; }
      return Object.entries(o).sort((x, y) => y[1] - x[1]);
    };
    const porMes = MESES.map((m, i) => ({ mes: m, n: at.filter((a) => +a.data.slice(5, 7) === i + 1).length }));
    const atendimentos = {
      ano: civil, total: at.length,
      resolvidos: at.filter((a) => a.resolvido).length,
      em_aberto: at.filter((a) => !a.resolvido).length,
      por_canal: contaPor('canal'), por_categoria: contaPor('categoria').slice(0, 10), por_pessoa: contaPor('usuario'), por_mes: porMes,
      pico: porMes.reduce((a, b) => (b.n > a.n ? b : a), { mes: '—', n: 0 }),
    };

    // ── Interessados (SIG) ──
    const interessados = {
      total: contar('SELECT COUNT(*) n FROM interessados'),
      por_status: db.prepare('SELECT status chave, COUNT(*) n FROM interessados GROUP BY 1').all(),
      matriculados: contar(`SELECT COUNT(*) n FROM interessados WHERE status = 'matriculado'`),
    };

    // ── Equipe ──
    const equipe = {
      tarefas_concluidas: contar('SELECT COUNT(*) n FROM rotina_feito WHERE data >= ?', `${civil}-01-01`),
      por_pessoa: db.prepare(`SELECT usuario chave, COUNT(*) n FROM rotina_feito WHERE data >= ? GROUP BY 1 ORDER BY n DESC`).all(`${civil}-01-01`),
      lembretes_concluidos: contar('SELECT COUNT(*) n FROM calendario_feito WHERE ano = ?', civil),
      lembretes_total: contar('SELECT COUNT(*) n FROM calendario WHERE ativo = 1'),
    };

    json(res, 200, {
      gerado_em: hoje(), ano, ano_letivo: anoLetivo, civil, escola: { inep: c.inep },
      alunos, rematricula, documentos, extras, bolsas, boletos, fotos, saida, atendimentos, interessados, equipe,
    });
  });
};

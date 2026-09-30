// 4.9.0/4.10.0 — Histórico escolar no formato dos modelos Word da escola ("HISTORICO FUNDAMENTAL I e II",
// "HISTÓRICO ENSINO MÉDIO" e "HISTORICO ESCOLAR-TRANSFERÊNCIA BIMESTRE").
// Cada ano cursado é uma coluna do histórico (hist_anos) com as notas — e, no Médio, a carga — de cada disciplina (hist_notas).
// As linhas (disciplinas) vêm da matriz curricular (hist_componentes), que a administração ajusta.
// Quem sai no meio do ano tem a página 2 preenchida: notas por bimestre, faltas e aulas dadas (hist_transf).
'use strict';

module.exports = function historico(ctx) {
  const { rota, db, cfg, registrar, falha, conferirVersao, json, corpoJson, lerCorpo, exigirAdmin, agoraIso, S, turmaRotulo, transacao, L } = ctx;
  const B = require('../lib/boletim');

  const CURSOS = {
    fund: { nome: 'Ensino Fundamental', series: ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9'] },
    medio: { nome: 'Ensino Médio', series: ['EM1', 'EM2', 'EM3'] },
  };
  const RESULTADOS = ['Aprovado', 'Aprovado pelo Conselho', 'Retido', 'Cursando', 'Transferido'];
  const BIMS = ['b1', 'b2', 'b3', 'b4'];
  const ESCOLA = { escola: 'Instituto Educacional Luterano', cidade: 'Ferraz de Vasconcelos', uf: 'SP' };
  const cursoDe = (chave) => (CURSOS.fund.series.includes(chave) ? 'fund' : CURSOS.medio.series.includes(chave) ? 'medio' : null);
  const rotuloSerie = (chave) => (chave.startsWith('EM') ? `${chave.slice(2)}ª série` : `${chave.slice(1)}º ano`);
  const anoAtual = () => +cfg().ano_matricula - 1; // o ano letivo em andamento (a matrícula aberta é a do ano seguinte)
  const ordemSerie = (chave) => S.SERIES.findIndex((s) => s.chave === chave);
  const vazioTxt = (v) => v == null || /^\s*[-–—]?\s*$/.test(String(v)); // "-" é como o modelo da escola marca "não teve"
  const texto = (v) => (vazioTxt(v) ? null : String(v).trim());
  const inteiro = (v) => (vazioTxt(v) ? null : Math.round(Number(String(v).replace(',', '.'))));

  const componentes = (curso, todos) => db.prepare(`SELECT * FROM hist_componentes WHERE curso = ? ${todos ? '' : 'AND ativo = 1'} ORDER BY ordem, id`).all(curso);

  // Nota digitada: número de 0 a 10 (vírgula ou ponto) ou um conceito curto (A, B, MB, S…). Vazio ou "-" apaga.
  function normalizarNota(v, comp) {
    if (vazioTxt(v)) return null;
    const t = String(v).trim();
    if (/^\d{1,2}([.,]\d{1,2})?$/.test(t)) {
      const n = Number(t.replace(',', '.'));
      if (n > 10) falha(400, `Nota ${t} em ${comp}: as notas vão de 0 a 10.`);
      return t.replace('.', ',');
    }
    if (t.length > 12) falha(400, `"${t}" em ${comp} não parece uma nota. Use número (0 a 10) ou conceito (A, B, C…).`);
    return t.toUpperCase();
  }
  const numero = (nota) => (nota != null && /^\d/.test(nota) ? Number(String(nota).replace(',', '.')) : null);

  // O "automático": olha as notas (e a frequência, se houver) e diz qual deve ser o resultado
  function sugerirResultado(notas, frequencia, c = cfg()) {
    const media = Number(c.hist_media) || 7, minFreq = Number(c.hist_frequencia) || 75;
    const valores = Object.entries(notas || {}).filter(([, n]) => n != null && n !== '');
    if (!valores.length) return null;
    const abaixo = valores.filter(([, n]) => numero(n) != null && numero(n) < media).map(([k]) => k);
    if (frequencia != null && frequencia !== '' && Number(frequencia) < minFreq) return { resultado: 'Retido', motivo: `frequência abaixo de ${minFreq}%` };
    if (abaixo.length) return { resultado: 'Retido', motivo: `abaixo de ${String(media).replace('.', ',')} em ${abaixo.join(', ')}` };
    return { resultado: 'Aprovado', motivo: '' };
  }

  function anosDoAluno(alunoId) {
    const anos = db.prepare('SELECT * FROM hist_anos WHERE aluno_id = ?').all(alunoId);
    const notas = db.prepare('SELECT componente, nota, carga, b1, b2, b3, b4 FROM hist_notas WHERE ano_id = ?');
    return anos.map((a) => ({ ...a, ...notasDoAno(notas.all(a.id)) })).sort((a, b) => ordemSerie(a.serie_chave) - ordemSerie(b.serie_chave));
  }
  // Linhas de hist_notas → { notas: nota final, cargas, bims: notas de cada bimestre }
  function notasDoAno(ns) {
    return {
      notas: Object.fromEntries(ns.filter((n) => n.nota != null).map((n) => [n.componente, n.nota])),
      cargas: Object.fromEntries(ns.filter((n) => n.carga != null).map((n) => [n.componente, n.carga])),
      bims: Object.fromEntries(ns.filter((n) => BIMS.some((k) => n[k] != null)).map((n) => [n.componente, Object.fromEntries(BIMS.map((k) => [k, n[k]]))])),
    };
  }

  // Nota final do ano = média dos 4 bimestres, arredondada como a escola faz (0,5 mais próximo, ou uma casa decimal).
  // Só calcula com os 4 bimestres lançados e todos numéricos; senão devolve null (o ano ainda está em andamento).
  function mediaDoAno(b, c = cfg()) {
    const ns = BIMS.map((k) => numero(b[k]));
    if (ns.some((n) => n == null)) return null;
    const m = ns.reduce((s, n) => s + n, 0) / 4;
    const passo = Number(c.hist_arredonda) || 0.5;
    const r = Math.round(m / passo + 1e-9) * passo;
    return String(Number(r.toFixed(2))).replace('.', ',');
  }

  function transfDoAluno(alunoId) {
    const t = db.prepare('SELECT * FROM hist_transf WHERE aluno_id = ?').get(alunoId);
    if (!t) return null;
    let notas = {};
    try { notas = JSON.parse(t.notas_json || '{}') || {}; } catch { /* registro estragado: volta vazio */ }
    return { ...t, notas };
  }

  // Em que ano o aluno provavelmente cursou cada série (conta para trás a partir da série de hoje)
  function anoProvavel(aluno, chave) {
    const hoje = ordemSerie(aluno.serie_chave) - (aluno.novo ? 1 : 0);
    const alvo = ordemSerie(chave);
    if (hoje < 0 || alvo < 0 || alvo > hoje) return null;
    return anoAtual() - (hoje - alvo);
  }

  // Grava (ou completa) um ano do histórico. Só mexe no que veio no pedido.
  function gravarAno(alunoId, a, u) {
    const chave = a.serie_chave;
    if (!cursoDe(chave)) falha(400, 'Série inválida para o histórico: ' + chave);
    const comps = new Set(componentes(cursoDe(chave), true).map((c) => c.nome));
    const notas = {}, cargas = {};
    for (const [comp, n] of Object.entries(a.notas || {})) {
      if (comps.has(comp)) notas[comp] = normalizarNota(n, comp); // disciplina que não existe (ou foi renomeada) não entra
    }
    // Carga horária de cada disciplina no ano (coluna "Carga Horária" do histórico do Ensino Médio)
    for (const [comp, ch] of Object.entries(a.cargas || {})) {
      if (!comps.has(comp)) continue;
      const v = inteiro(ch);
      if (v != null && !(v >= 0 && v <= 2000)) falha(400, `Carga horária "${ch}" em ${comp} (${rotuloSerie(chave)}) não parece certa.`);
      cargas[comp] = v;
    }
    // Notas de cada bimestre do ano: { "Matemática": { b2: "7,5" } } — só os bimestres que vieram no pedido
    const bims = {};
    for (const [comp, x] of Object.entries(a.bims || {})) {
      if (!comps.has(comp) || !x) continue;
      bims[comp] = {};
      for (const k of BIMS) if (x[k] !== undefined) bims[comp][k] = normalizarNota(x[k], `${comp} (${k[1]}º bimestre)`);
    }
    const freq = vazioTxt(a.frequencia) ? null : Number(String(a.frequencia).replace(',', '.'));
    if (freq != null && !(freq >= 0 && freq <= 100)) falha(400, `Frequência do ${rotuloSerie(chave)} precisa estar entre 0 e 100%.`);
    if (a.resultado && !RESULTADOS.includes(a.resultado)) falha(400, 'Resultado inválido: ' + a.resultado);
    const numericos = ['ano_letivo', 'carga', 'carga_bnc', 'carga_pd', 'dias_letivos'];
    const reg = {};
    for (const k of [...numericos, 'escola', 'cidade', 'uf', 'frequencia', 'resultado']) {
      if (a[k] === undefined) continue;
      reg[k] = numericos.includes(k) ? inteiro(a[k]) : k === 'frequencia' ? freq : texto(a[k]);
      if (numericos.includes(k) && reg[k] != null && !(reg[k] >= 0 && reg[k] <= 9999)) falha(400, `Valor "${a[k]}" não parece certo (${rotuloSerie(chave)}).`);
    }
    if (reg.ano_letivo != null && (reg.ano_letivo < 1950 || reg.ano_letivo > anoAtual() + 1)) falha(400, `Ano letivo ${reg.ano_letivo} do ${rotuloSerie(chave)} não parece certo.`);
    const vazio = !Object.values(reg).some((v) => v != null) && ![...Object.values(notas), ...Object.values(cargas),
      ...Object.values(bims).flatMap((x) => Object.values(x))].some((v) => v != null);
    let ex = db.prepare('SELECT id FROM hist_anos WHERE aluno_id = ? AND serie_chave = ?').get(alunoId, chave);
    if (!ex && vazio) return false;
    if (!ex) ex = { id: Number(db.prepare('INSERT INTO hist_anos (aluno_id, serie_chave) VALUES (?, ?)').run(alunoId, chave).lastInsertRowid) };
    const ks = Object.keys(reg);
    db.prepare(`UPDATE hist_anos SET ${[...ks.map((k) => k + ' = ?'), 'atualizado_em = ?', 'atualizado_por = ?'].join(', ')} WHERE id = ?`)
      .run(...ks.map((k) => reg[k]), agoraIso(), u.login, ex.id);
    const antes = db.prepare('SELECT nota, carga, b1, b2, b3, b4 FROM hist_notas WHERE ano_id = ? AND componente = ?');
    const grava = db.prepare(`INSERT INTO hist_notas (ano_id, componente, nota, carga, b1, b2, b3, b4) VALUES (?,?,?,?,?,?,?,?)
      ON CONFLICT(ano_id, componente) DO UPDATE SET nota = excluded.nota, carga = excluded.carga,
        b1 = excluded.b1, b2 = excluded.b2, b3 = excluded.b3, b4 = excluded.b4`);
    const c = cfg();
    for (const comp of new Set([...Object.keys(notas), ...Object.keys(cargas), ...Object.keys(bims)])) {
      const x = antes.get(ex.id, comp) || {};
      const b = Object.fromEntries(BIMS.map((k) => [k, bims[comp] && k in bims[comp] ? bims[comp][k] : x[k] ?? null]));
      let nota = comp in notas ? notas[comp] : x.nota ?? null;
      // Com os 4 bimestres lançados, a nota final do ano é a média (é ela que vai para a coluna do ano no histórico)
      const media = mediaDoAno(b, c);
      if (media != null && (comp in bims || !(comp in notas))) nota = media;
      const carga = comp in cargas ? cargas[comp] : x.carga ?? null;
      if (nota == null && carga == null && BIMS.every((k) => b[k] == null)) db.prepare('DELETE FROM hist_notas WHERE ano_id = ? AND componente = ?').run(ex.id, comp);
      else grava.run(ex.id, comp, nota, carga, b.b1, b.b2, b.b3, b.b4);
    }
    // Ano fechado pelos bimestres e ninguém escolheu a situação: o sistema preenche com a sugestão (Aprovado/Retido)
    if (Object.keys(bims).length && reg.resultado === undefined) {
      const linhas = db.prepare('SELECT componente, nota, b1, b2, b3, b4 FROM hist_notas WHERE ano_id = ?').all(ex.id);
      const fechado = linhas.length && linhas.every((l) => BIMS.every((k) => l[k] == null) || l.nota != null);
      const atual = db.prepare('SELECT resultado FROM hist_anos WHERE id = ?').get(ex.id).resultado;
      if (fechado && (!atual || atual === 'Cursando')) {
        const s = sugerirResultado(Object.fromEntries(linhas.filter((l) => l.nota != null).map((l) => [l.componente, l.nota])), null, c);
        if (s) db.prepare('UPDATE hist_anos SET resultado = ? WHERE id = ?').run(s.resultado, ex.id);
      }
    }
    return true;
  }

  // Página 2: quem sai no meio do ano. Vazio = o aluno não está saindo (o registro vai para a lixeira).
  function gravarTransf(aluno, t, u) {
    const atual = db.prepare('SELECT 1 FROM hist_transf WHERE aluno_id = ?').get(aluno.id);
    if (!t) {
      if (atual) L.excluir({ tipo: 'hist_transf', rotulo: 'Transferência no meio do ano — ' + aluno.nome, usuario: u.login, aluno_id: aluno.id,
        tabela: 'hist_transf', onde: 'aluno_id = ?', params: [aluno.id] });
      return;
    }
    if (!cursoDe(t.serie_chave)) falha(400, 'Escolha a série que o aluno está deixando');
    const comps = new Set(componentes(cursoDe(t.serie_chave), true).map((c) => c.nome));
    const notas = {};
    for (const [comp, x] of Object.entries(t.notas || {})) {
      if (!comps.has(comp)) continue;
      const linha = { b1: normalizarNota(x.b1, comp), b2: normalizarNota(x.b2, comp), b3: normalizarNota(x.b3, comp), b4: normalizarNota(x.b4, comp),
        faltas: inteiro(x.faltas), aulas: inteiro(x.aulas) };
      if (Object.values(linha).some((v) => v != null)) notas[comp] = linha;
    }
    const ano = inteiro(t.ano_letivo);
    // Até qual bimestre o aluno ficou (os seguintes saem riscados no papel)
    const bim = inteiro(t.bimestres) || 4;
    if (!(bim >= 1 && bim <= 4)) falha(400, 'Bimestre inválido: escolha de 1 a 4');
    db.prepare(`INSERT INTO hist_transf (aluno_id, serie_chave, ano_letivo, bimestres, periodo, turma, turno, faltas, dias_letivos, notas_json, atualizado_em, atualizado_por)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(aluno_id) DO UPDATE SET serie_chave = excluded.serie_chave, ano_letivo = excluded.ano_letivo, bimestres = excluded.bimestres,
      periodo = excluded.periodo, turma = excluded.turma, turno = excluded.turno, faltas = excluded.faltas, dias_letivos = excluded.dias_letivos,
      notas_json = excluded.notas_json, atualizado_em = excluded.atualizado_em, atualizado_por = excluded.atualizado_por`)
      .run(aluno.id, t.serie_chave, ano, bim, texto(t.periodo), texto(t.turma), texto(t.turno), texto(t.faltas), texto(t.dias_letivos),
        JSON.stringify(notas), agoraIso(), u.login);
  }

  // Marca a ficha do histórico como alterada agora (é o que o aviso de "duas pessoas editando" compara)
  function tocar(alunoId, u) {
    db.prepare(`INSERT INTO hist_alunos (aluno_id, atualizado_em, atualizado_por) VALUES (?,?,?)
      ON CONFLICT(aluno_id) DO UPDATE SET atualizado_em = excluded.atualizado_em, atualizado_por = excluded.atualizado_por`).run(alunoId, agoraIso(), u.login);
  }

  const configHist = (c) => ({
    media: Number(c.hist_media) || 7, arredonda: Number(c.hist_arredonda) || 0.5, frequencia: Number(c.hist_frequencia) || 75,
    carga: { fund: Number(c.hist_carga_fund) || null, medio: Number(c.hist_carga_medio) || null }, dias: Number(c.hist_dias) || null,
    secretario: c.hist_secretario || '', diretor: c.hist_diretor || '',
  });

  // ── Lista: quem tem histórico em dia e quem não ──
  rota('GET', '/api/historico', async (req, res) => {
    const alunos = db.prepare(`SELECT id, mat, nome, serie_chave, turma, novo, descricao, serie FROM alunos
      WHERE ativo = 1 AND serie_chave IN (${[...CURSOS.fund.series, ...CURSOS.medio.series].map(() => '?').join(',')}) ORDER BY nome`)
      .all(...CURSOS.fund.series, ...CURSOS.medio.series);
    const feitos = new Map();
    for (const r of db.prepare(`SELECT h.aluno_id, h.serie_chave, h.resultado, (SELECT COUNT(*) FROM hist_notas n WHERE n.ano_id = h.id AND n.nota IS NOT NULL) notas FROM hist_anos h`).all()) {
      if (!feitos.has(r.aluno_id)) feitos.set(r.aluno_id, new Map());
      feitos.get(r.aluno_id).set(r.serie_chave, r);
    }
    const lista = alunos.map((a) => {
      const curso = cursoDe(a.serie_chave);
      const series = CURSOS[curso].series;
      // Anos que já deveriam estar no histórico: do início do curso até antes da série de hoje (a de hoje está em andamento).
      // Aluno novo foi cadastrado na série do ano que vem, então a série anterior à dele ainda está em andamento na outra escola.
      const esperadas = series.slice(0, Math.max(0, series.indexOf(a.serie_chave) - (a.novo ? 1 : 0)));
      const f = feitos.get(a.id) || new Map();
      const completo = (ch) => { const r = f.get(ch); return r && r.notas > 0 && r.resultado; };
      const faltam = esperadas.filter((ch) => !completo(ch));
      return {
        id: a.id, mat: a.mat, nome: a.nome, novo: !!a.novo, serie_chave: a.serie_chave, turma: a.turma, turma_rotulo: turmaRotulo(a), curso,
        ordem: ordemSerie(a.serie_chave), esperadas: esperadas.length, feitas: esperadas.length - faltam.length,
        faltam: faltam.map(rotuloSerie), faltam_ch: faltam, atual: !!completo(a.serie_chave), anos_lancados: f.size,
      };
    });
    const turmas = [...new Map(lista.map((a) => [a.turma_rotulo, { rotulo: a.turma_rotulo, serie: a.serie_chave, turma: a.turma || '', ordem: a.ordem }])).values()]
      .sort((a, b) => a.ordem - b.ordem || a.rotulo.localeCompare(b.rotulo));
    json(res, 200, {
      ano_atual: anoAtual(), cursos: CURSOS, turmas, alunos: lista,
      resumo: { alunos: lista.length, em_dia: lista.filter((a) => !a.faltam.length).length, faltando: lista.filter((a) => a.faltam.length).length,
        anos_lancados: lista.reduce((s, a) => s + a.anos_lancados, 0) },
    });
  });

  // ── Histórico de um aluno (a tela de digitar e o documento usam o mesmo) ──
  rota('GET', '/api/historico/aluno/:id', async (req, res, { p }) => {
    const c = cfg();
    const a = db.prepare('SELECT * FROM alunos WHERE id = ?').get(+p.id) || falha(404, 'Aluno não encontrado');
    const dados = db.prepare('SELECT * FROM hist_alunos WHERE aluno_id = ?').get(a.id) || {};
    const anos = anosDoAluno(a.id);
    const cursos = {};
    for (const [k, cur] of Object.entries(CURSOS)) {
      cursos[k] = {
        nome: cur.nome,
        componentes: componentes(k),
        series: cur.series.map((ch) => ({ chave: ch, rotulo: rotuloSerie(ch), ano_provavel: anoProvavel(a, ch) })),
      };
    }
    // "Estudos realizados no Ensino Fundamental" do histórico do Médio: o 9º ano lançado aqui, ou o que foi digitado à mão
    const f9 = anos.find((x) => x.serie_chave === 'F9');
    const fundConclusao = {
      ano: dados.fund_ano || (f9 && f9.ano_letivo ? String(f9.ano_letivo) : ''), escola: dados.fund_escola || f9?.escola || '',
      cidade: dados.fund_cidade || f9?.cidade || '', uf: dados.fund_uf || f9?.uf || '',
    };
    json(res, 200, {
      aluno: { id: a.id, mat: a.mat, nome: a.nome, dt_nasc: a.dt_nasc, ra: a.ra, rg: a.rg, cpf: a.cpf, nome_mae: a.nome_mae, nome_pai: a.nome_pai,
        serie_chave: a.serie_chave, turma: a.turma, turno: a.turno, novo: !!a.novo, turma_rotulo: turmaRotulo(a), cidade: a.cidade, uf: a.uf },
      dados, curso: cursoDe(a.serie_chave) || 'fund', cursos, anos: anos.map((x) => ({ ...x, sugestao: sugerirResultado(x.notas, x.frequencia, c) })),
      transf: transfDoAluno(a.id), fund_conclusao: fundConclusao, matrizes: matrizes(),
      resultados: RESULTADOS, escola: { ...ESCOLA, inep: c.inep }, config: configHist(c), ano_atual: anoAtual(),
      atualizado_em: dados.atualizado_em || null, atualizado_por: dados.atualizado_por || null,
    });
  });

  const CAMPOS_DADOS = ['naturalidade', 'uf_nasc', 'nacionalidade', 'rg_uf', 'rg_expedicao', 'rg_orgao', 'fund_ano', 'fund_escola', 'fund_cidade', 'fund_uf', 'obs'];
  rota('PUT', '/api/historico/aluno/:id', async (req, res, { u, p }) => {
    const b = await corpoJson(req);
    const a = db.prepare('SELECT id, nome, ra, rg FROM alunos WHERE id = ?').get(+p.id) || falha(404, 'Aluno não encontrado');
    const atual = db.prepare('SELECT * FROM hist_alunos WHERE aluno_id = ?').get(a.id) || {};
    conferirVersao(atual, b, u);
    const ler = (campo) => { try { return JSON.parse(b[campo]); } catch { return falha(400, 'Dados do histórico em formato inválido'); } };
    const anos = b.anos_json !== undefined ? ler('anos_json') || [] : [];
    const mudou = [];
    transacao(() => {
      const ks = CAMPOS_DADOS.filter((k) => b[k] !== undefined);
      tocar(a.id, u);
      if (ks.length) db.prepare(`UPDATE hist_alunos SET ${ks.map((k) => k + ' = ?').join(', ')} WHERE aluno_id = ?`)
        .run(...ks.map((k) => (String(b[k] ?? '').trim() || null)), a.id);
      // R.A. e RG moram no cadastro do aluno: corrigir aqui corrige lá também
      const ka = ['ra', 'rg'].filter((k) => b[k] !== undefined);
      if (ka.length) db.prepare(`UPDATE alunos SET ${ka.map((k) => k + ' = ?').join(', ')}, atualizado_em = ?, atualizado_por = ? WHERE id = ?`)
        .run(...ka.map((k) => String(b[k] ?? '').trim() || null), agoraIso(), u.login, a.id);
      for (const x of anos) if (gravarAno(a.id, x, u)) mudou.push(rotuloSerie(x.serie_chave));
      if (b.transf_json) { gravarTransf(a, ler('transf_json'), u); mudou.push('transferência'); }
      mudou.push(...ks, ...ka);
    });
    // Desmarcou a transferência: vai para a lixeira (a lixeira abre a própria transação, por isso fica fora da de cima)
    if (b.transf_json === '') { gravarTransf(a, null, u); mudou.push('transferência retirada'); }
    registrar(u.login, 'atualizou o histórico escolar', { aluno_id: a.id, nome: a.nome, campos: mudou });
    json(res, 200, { ok: true });
  });

  // 5.6.0 — Importar boletim: lê o arquivo (Excel, Word, PDF, foto…) e devolve a PROPOSTA de notas para a tela conferir.
  // Não grava nota nenhuma e não guarda o arquivo (só passa por uma pasta temporária). Quem grava é o "Salvar" da tela.
  rota('POST', '/api/historico/ler-boletim', async (req, res, { u, url }) => {
    const a = db.prepare('SELECT id, nome FROM alunos WHERE id = ?').get(+url.searchParams.get('aluno')) || falha(404, 'Aluno não encontrado');
    const arquivo = String(url.searchParams.get('arquivo') || '').slice(0, 200);
    const doc = await B.lerDocumento(await lerCorpo(req), arquivo);
    const r = B.interpretar(doc, { fund: componentes('fund').map((c) => c.nome), medio: componentes('medio').map((c) => c.nome) }, { nome: a.nome, anoMax: anoAtual() + 1 });
    registrar(u.login, 'leu um boletim para o histórico (o arquivo não fica guardado)', { aluno_id: a.id, nome: a.nome, arquivo, origem: r.origem, disciplinas: r.linhas.length });
    json(res, 200, r);
  });

  // ── 5.6.1: matriz curricular oficial → carga (aulas anuais) de cada disciplina, por série e ano de vigência ──
  // Todas as matrizes guardadas: [{ ano, series: { EM1: { "Química": 120, … } } }], da mais nova para a mais velha
  function matrizes() {
    const por = new Map();
    for (const r of db.prepare('SELECT ano, serie_chave, componente, aulas FROM hist_matriz ORDER BY ano DESC').all()) {
      if (!por.has(r.ano)) por.set(r.ano, { ano: r.ano, series: {} });
      (por.get(r.ano).series[r.serie_chave] ||= {})[r.componente] = r.aulas;
    }
    return [...por.values()];
  }
  rota('GET', '/api/historico/matriz', async (req, res) => json(res, 200, { matrizes: matrizes() }));
  rota('POST', '/api/historico/ler-matriz', async (req, res, { u, url }) => {
    exigirAdmin(u);
    const doc = await B.lerDocumento(await lerCorpo(req), String(url.searchParams.get('arquivo') || '').slice(0, 200));
    json(res, 200, B.lerMatriz(doc, { fund: componentes('fund', true).map((c) => c.nome), medio: componentes('medio', true).map((c) => c.nome) }));
  });
  // Grava a matriz de um ano: substitui o que havia daquele ano nas séries enviadas.
  // linhas: [{ comp, nova: { area } (incluir como disciplina nova), aulas: { EM1: 120, … } }]
  rota('PUT', '/api/historico/matriz', async (req, res, { u }) => {
    exigirAdmin(u);
    const b = await corpoJson(req);
    const ano = inteiro(b.ano);
    if (!(ano >= 1990 && ano <= anoAtual() + 2)) falha(400, 'Informe o ano da matriz (ex.: 2026)');
    const linhas = (Array.isArray(b.linhas) ? b.linhas : []).filter((l) => l && String(l.comp || '').trim());
    if (!linhas.length) falha(400, 'Escolha a disciplina do histórico de pelo menos uma linha');
    let novas = 0, n = 0;
    transacao(() => {
      const series = new Set();
      const grava = db.prepare('INSERT INTO hist_matriz (ano, serie_chave, componente, aulas) VALUES (?,?,?,?) ON CONFLICT(ano, serie_chave, componente) DO UPDATE SET aulas = excluded.aulas');
      for (const l of linhas) for (const s of Object.keys(l.aulas || {})) { if (!cursoDe(s)) falha(400, 'Série inválida: ' + s); series.add(s); }
      for (const s of series) db.prepare('DELETE FROM hist_matriz WHERE ano = ? AND serie_chave = ?').run(ano, s);
      for (const l of linhas) {
        const comp = String(l.comp).trim();
        const cursos = [...new Set(Object.keys(l.aulas || {}).map(cursoDe))];
        for (const curso of cursos) {
          if (!db.prepare('SELECT 1 FROM hist_componentes WHERE curso = ? AND nome = ?').get(curso, comp)) {
            if (!l.nova) falha(400, `"${comp}" não é disciplina do histórico. Marque "incluir como nova" ou escolha outra.`);
            const ordem = (db.prepare('SELECT MAX(ordem) m FROM hist_componentes WHERE curso = ?').get(curso).m || 0) + 1;
            db.prepare('INSERT INTO hist_componentes (curso, area, nome, ordem) VALUES (?,?,?,?)').run(curso, String(l.nova.area || '').trim() || null, comp, ordem);
            novas++;
          }
        }
        for (const [s, v] of Object.entries(l.aulas || {})) {
          const aulas = inteiro(v);
          if (aulas == null) continue;
          if (!(aulas > 0 && aulas <= 2000)) falha(400, `Carga "${v}" de ${comp} (${rotuloSerie(s)}) não parece certa`);
          // A mesma disciplina duas vezes na mesma série (ex.: Educação Física na base e na parte flexível): soma
          const ja = db.prepare('SELECT aulas FROM hist_matriz WHERE ano = ? AND serie_chave = ? AND componente = ?').get(ano, s, comp);
          grava.run(ano, s, comp, (ja ? ja.aulas : 0) + aulas); n++;
        }
      }
    });
    registrar(u.login, 'gravou a matriz curricular do histórico', { ano, cargas: n, disciplinas_novas: novas });
    json(res, 200, { ok: true, cargas: n, novas });
  });
  rota('DELETE', '/api/historico/matriz/:ano', async (req, res, { u, p }) => {
    exigirAdmin(u);
    const ano = +p.ano;
    if (!db.prepare('SELECT 1 FROM hist_matriz WHERE ano = ?').get(ano)) falha(404, 'Não há matriz desse ano');
    const lixeira_id = L.excluir({ tipo: 'hist_matriz', rotulo: `Matriz curricular de ${ano}`, usuario: u.login, tabela: 'hist_matriz', onde: 'ano = ?', params: [ano] });
    registrar(u.login, 'apagou a matriz curricular do histórico (foi para a lixeira)', { ano });
    json(res, 200, { ok: true, lixeira_id });
  });

  // Limpar um ano inteiro (vai para a lixeira, com as notas)
  rota('DELETE', '/api/historico/ano/:id', async (req, res, { u, p }) => {
    const h = db.prepare('SELECT h.*, a.nome FROM hist_anos h JOIN alunos a ON a.id = h.aluno_id WHERE h.id = ?').get(+p.id) || falha(404, 'Esse ano não está no histórico');
    const lixeira_id = L.excluir({ tipo: 'hist_ano', rotulo: `${rotuloSerie(h.serie_chave)}${h.ano_letivo ? ' (' + h.ano_letivo + ')' : ''} — ${h.nome}`, usuario: u.login,
      aluno_id: h.aluno_id, tabela: 'hist_anos', onde: 'id = ?', params: [h.id], filhas: [{ tabela: 'hist_notas', onde: 'ano_id = ?', params: [h.id] }] });
    tocar(h.aluno_id, u);
    registrar(u.login, 'apagou um ano do histórico escolar (foi para a lixeira)', { aluno_id: h.aluno_id, serie: rotuloSerie(h.serie_chave) });
    json(res, 200, { ok: true, lixeira_id });
  });

  // ── Lançar as notas da turma inteira de uma vez (fim do ano) ──
  rota('GET', '/api/historico/turma', async (req, res, { url }) => {
    const c = cfg();
    const serie = url.searchParams.get('serie'), turma = url.searchParams.get('turma') || '';
    const curso = cursoDe(serie) || falha(400, 'Escolha uma turma do Fundamental ou do Médio');
    const alunos = db.prepare(`SELECT id, mat, nome, novo FROM alunos WHERE ativo = 1 AND serie_chave = ? AND COALESCE(turma,'') = ? ORDER BY nome`).all(serie, turma);
    const anos = new Map(db.prepare(`SELECT * FROM hist_anos WHERE serie_chave = ? AND aluno_id IN (${alunos.map(() => '?').join(',') || 'NULL'})`)
      .all(serie, ...alunos.map((a) => a.id)).map((h) => [h.aluno_id, h]));
    const notas = db.prepare('SELECT componente, nota, carga, b1, b2, b3, b4 FROM hist_notas WHERE ano_id = ?');
    const lista = alunos.map((a) => {
      const h = anos.get(a.id);
      return { id: a.id, mat: a.mat, nome: a.nome, novo: !!a.novo, ano: h ? { ...h, ...notasDoAno(notas.all(h.id)) } : null };
    });
    // Carga de cada disciplina da turma: a que já foi lançada para algum aluno
    const cargas = {};
    for (const l of lista) for (const [k, v] of Object.entries(l.ano?.cargas || {})) if (cargas[k] == null) cargas[k] = v;
    json(res, 200, {
      serie, turma, rotulo: `${S.porChave(serie).rotulo}${turma ? ' ' + turma : ''}`, curso, ano_letivo: anoAtual(),
      componentes: componentes(curso), resultados: RESULTADOS, config: configHist(c), cargas, alunos: lista, matrizes: matrizes(),
    });
  });

  rota('PUT', '/api/historico/turma', async (req, res, { u }) => {
    const b = await corpoJson(req);
    const serie = b.serie;
    if (!cursoDe(serie)) falha(400, 'Série inválida');
    const linhas = Array.isArray(b.alunos) ? b.alunos : [];
    // bimestre 1 a 4: as notas digitadas são daquele bimestre (a nota final sai sozinha quando os 4 estiverem lançados).
    // Sem bimestre: são as notas finais do ano (para anos antigos ou quando a escola só tem a nota final).
    const bim = b.bimestre ? Number(b.bimestre) : null;
    if (bim != null && !(bim >= 1 && bim <= 4)) falha(400, 'Bimestre inválido: escolha de 1 a 4');
    let n = 0;
    transacao(() => {
      for (const l of linhas) {
        const a = db.prepare('SELECT id FROM alunos WHERE id = ?').get(+l.aluno_id);
        if (!a) continue;
        const ex = db.prepare('SELECT escola FROM hist_anos WHERE aluno_id = ? AND serie_chave = ?').get(a.id, serie);
        const temAlgo = Object.values(l.notas || {}).some((v) => !vazioTxt(v)) || l.frequencia || l.resultado;
        if (!ex && !temAlgo) continue;
        // Lançado pela turma = cursado aqui na escola; a carga de cada disciplina é a mesma para a turma inteira
        const porBim = bim ? Object.fromEntries(Object.entries(l.notas || {}).map(([comp, v]) => [comp, { ['b' + bim]: v }])) : undefined;
        const ok = gravarAno(a.id, {
          serie_chave: serie, notas: bim ? undefined : l.notas, bims: porBim, frequencia: l.frequencia, resultado: bim ? undefined : l.resultado, cargas: b.cargas,
          ano_letivo: b.ano_letivo, carga: b.carga, carga_bnc: b.carga_bnc, carga_pd: b.carga_pd, dias_letivos: b.dias_letivos,
          ...(ex && ex.escola ? {} : ESCOLA),
        }, u);
        if (ok) { tocar(a.id, u); n++; }
      }
    });
    registrar(u.login, 'lançou notas da turma no histórico', { serie, ano: b.ano_letivo, bimestre: bim || 'nota final', alunos: n });
    json(res, 200, { ok: true, alunos: n });
  });

  // ── Disciplinas (linhas do histórico) — só a administração muda ──
  rota('GET', '/api/historico/componentes', async (req, res) => json(res, 200, { cursos: CURSOS, componentes: db.prepare('SELECT * FROM hist_componentes ORDER BY curso, ordem, id').all() }));
  rota('POST', '/api/historico/componentes', async (req, res, { u }) => {
    exigirAdmin(u);
    const b = await corpoJson(req);
    const nome = String(b.nome || '').trim() || falha(400, 'Informe o nome da disciplina');
    if (!CURSOS[b.curso]) falha(400, 'Curso inválido');
    if (db.prepare('SELECT 1 FROM hist_componentes WHERE curso = ? AND nome = ?').get(b.curso, nome)) falha(400, 'Essa disciplina já existe neste curso');
    const ordem = (db.prepare('SELECT MAX(ordem) m FROM hist_componentes WHERE curso = ?').get(b.curso).m || 0) + 1;
    db.prepare('INSERT INTO hist_componentes (curso, area, nome, ordem) VALUES (?,?,?,?)').run(b.curso, String(b.area || '').trim() || null, nome, ordem);
    registrar(u.login, 'criou disciplina do histórico', { curso: b.curso, nome });
    json(res, 201, { ok: true });
  });
  rota('PUT', '/api/historico/componentes/:id', async (req, res, { u, p }) => {
    exigirAdmin(u);
    const b = await corpoJson(req);
    const c = db.prepare('SELECT * FROM hist_componentes WHERE id = ?').get(+p.id) || falha(404, 'Disciplina não encontrada');
    transacao(() => {
      if (b.nome !== undefined && String(b.nome).trim() && String(b.nome).trim() !== c.nome) {
        const novo = String(b.nome).trim();
        if (db.prepare('SELECT 1 FROM hist_componentes WHERE curso = ? AND nome = ? AND id <> ?').get(c.curso, novo, c.id)) falha(400, 'Já existe outra disciplina com esse nome');
        // As notas já lançadas acompanham o nome novo
        db.prepare(`UPDATE hist_notas SET componente = ? WHERE componente = ? AND ano_id IN
          (SELECT id FROM hist_anos WHERE serie_chave IN (${CURSOS[c.curso].series.map(() => '?').join(',')}))`).run(novo, c.nome, ...CURSOS[c.curso].series);
        db.prepare('UPDATE hist_componentes SET nome = ? WHERE id = ?').run(novo, c.id);
      }
      if (b.area !== undefined) db.prepare('UPDATE hist_componentes SET area = ? WHERE id = ?').run(String(b.area || '').trim() || null, c.id);
      if (b.ativo !== undefined) db.prepare('UPDATE hist_componentes SET ativo = ? WHERE id = ?').run(b.ativo ? 1 : 0, c.id);
      if (b.mover === 'cima' || b.mover === 'baixo') {
        const lista = componentes(c.curso, true);
        const i = lista.findIndex((x) => x.id === c.id), j = b.mover === 'cima' ? i - 1 : i + 1;
        if (j >= 0 && j < lista.length) {
          [lista[i], lista[j]] = [lista[j], lista[i]];
          lista.forEach((x, k) => db.prepare('UPDATE hist_componentes SET ordem = ? WHERE id = ?').run(k + 1, x.id));
        }
      }
    });
    registrar(u.login, 'alterou disciplina do histórico', { id: c.id, nome: c.nome, ...b });
    json(res, 200, { ok: true });
  });
};

// 5.7.0 — Importa a planilha do Google "Controle de Matrículas e Rematrículas <ano> (IE Luterano)", baixada como .xlsx.
// Estrutura da planilha (conferida com a de 2027):
//   - uma aba por série do ano que vem ("Maternal", "Jardim I", "1º Ano EF", …, "3ª Série EM"), com um resumo no alto e,
//     na linha do cabeçalho, "ID/Matrícula | Nome do Aluno | Tipo | Porcentagem de Desconto % | Plano Pagto. …| Status | …";
//   - a aba "Configurações" com "Turma | Vagas Totais";
//   - abas de resumo ("Resumo Geral", "Controle de Matrículas 2027") que não são lidas (são calculadas das outras).
// O aluno é achado pelo ID/Matrícula (= Mat do ACADESC). Situação: Efetivada → Concluída; Inadimplente → Não vai renovar;
// vazio ou Pendente → Não iniciada (decisão do Kevin, 29/09/2026). Vazio/Pendente nunca desfaz o que o sistema já avançou.
// Primeiro devolve a conferência (aplicar=0); só grava com aplicar=1.
'use strict';

module.exports = function planilhaRematricula(ctx) {
  const { rota, db, cfg, registrar, falha, json, lerCorpo, exigirAdmin, agoraIso, S, lerPlanilha, serialParaIso, transacao } = ctx;
  const STATUS_TXT = { pendente: 'Não iniciada', reservada: 'Em andamento', concluida: 'Concluída', nao_renova: 'Não vai renovar', transferido: 'Transferido' };

  // Cabeçalho da planilha → campo do sistema (comparado sem acento e sem caixa; "começa com" basta)
  const COLUNAS = [
    ['id', /^id|^matricula$/], ['nome', /^nome do aluno/], ['tipo', /^tipo$/], ['desconto', /^porcentagem de desconto/],
    ['plano_mensalidade', /^plano pagto\.? mensalidade/], ['plano_material', /^plano pagto\.? material/], ['valor_bruto', /^valor bruto/],
    ['plano_matricula', /^plano pagto\.? matricula/], ['forma', /^forma de pagamento$/], ['banco', /^banco\/instituicao$/],
    ['autorizacao', /^n.? autorizacao \/ final/], ['p1_diferente', /^1.? parcela c\/ forma/], ['p1_forma', /^forma de pagamento \(1/],
    ['p1_banco', /^banco\/instituicao \(1/], ['p1_autorizacao', /^n.? autorizacao \(1/], ['parcelas', /^parcelas/], ['valor_recebido', /^valor recebido/],
    ['status', /^status$/], ['docs', /^documentos pendentes/], ['novo', /^aluno novo/], ['categoria', /^categoria/], ['data', /^data de efetivacao/],
    ['obs', /^observac/], ['boletos', /^boletos entregues/],
  ];
  const txt = (v) => (v == null || typeof v === 'boolean' ? '' : String(typeof v === 'number' ? String(v).replace('.', ',') : v).trim());
  const sim = (v) => v === true || /^(true|sim|verdadeiro|x|1)$/i.test(String(v ?? '').trim());
  const semZeros = (v) => String(v ?? '').trim().replace(/\.0+$/, '').replace(/^0+(?=\d)/, '');
  const dinheiro = (v) => (typeof v === 'number' ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : txt(v));
  function data(v) {
    if (typeof v === 'number') return serialParaIso(v);
    const m = String(v ?? '').match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
  }
  function status(v) {
    const t = S.norm(v);
    if (t.startsWith('efetivad')) return 'concluida';
    if (t.startsWith('inadimpl')) return 'nao_renova';
    return 'pendente';
  }

  function ler(buf, ano) {
    let abas;
    try { abas = lerPlanilha(buf, 'planilha.xlsx'); } catch { falha(400, 'Este arquivo não é uma planilha do Excel (.xlsx). No Google: Arquivo › Fazer download › Microsoft Excel (.xlsx).'); }
    const linhas = [], vagas = [], avisos = [];
    for (const aba of abas) {
      const nomeAba = S.norm(aba.nome);
      // Vagas: aba "Configurações", colunas "Turma" e "Vagas Totais"
      if (nomeAba.startsWith('configurac')) {
        const i = aba.linhas.findIndex((l) => l.some((v) => S.norm(v) === 'turma') && l.some((v) => S.norm(v).startsWith('vagas totais')));
        if (i >= 0) {
          const cT = aba.linhas[i].findIndex((v) => S.norm(v) === 'turma'), cV = aba.linhas[i].findIndex((v) => S.norm(v).startsWith('vagas totais'));
          for (const l of aba.linhas.slice(i + 1)) {
            const s = l[cT] ? S.identificar(String(l[cT]), '') : null;
            if (s && typeof l[cV] === 'number' && l[cV] >= 0) vagas.push({ serie_chave: s.chave, rotulo: s.rotulo, capacidade: Math.round(l[cV]) });
          }
        }
        continue;
      }
      // Aba de série: o nome da aba é a série do ano que vem
      const serie = S.identificar(aba.nome, '');
      if (!serie || /resumo|controle|dispensa|transfer|recrea|pagina/.test(nomeAba)) continue;
      const i = aba.linhas.findIndex((l) => l.some((v) => S.norm(v).startsWith('nome do aluno')) && l.some((v) => S.norm(v) === 'status'));
      if (i < 0) continue;
      const col = {};
      aba.linhas[i].forEach((h, k) => { const n = S.norm(h); const c = COLUNAS.find(([campo, re]) => col[campo] == null && re.test(n)); if (c) col[c[0]] = k; });
      for (const l of aba.linhas.slice(i + 1)) {
        const nome = txt(l[col.nome]);
        if (!nome) continue;
        const v = (campo) => (col[campo] == null ? undefined : l[col[campo]]);
        const desc = v('desconto');
        const pag = {
          plano_mensalidade: txt(v('plano_mensalidade')), plano_material: txt(v('plano_material')), valor_bruto: dinheiro(v('valor_bruto')),
          plano_matricula: txt(v('plano_matricula')), forma: txt(v('forma')), banco: txt(v('banco')), autorizacao: txt(v('autorizacao')),
          p1_diferente: sim(v('p1_diferente')) ? 'Sim' : '', p1_forma: txt(v('p1_forma')), p1_banco: txt(v('p1_banco')), p1_autorizacao: txt(v('p1_autorizacao')),
          parcelas: txt(v('parcelas')), valor_recebido: dinheiro(v('valor_recebido')), tipo: txt(v('tipo')),
        };
        for (const k of Object.keys(pag)) if (!pag[k]) delete pag[k];
        const docs = txt(v('docs'));
        linhas.push({
          aba: aba.nome, serie_destino: serie.chave, mat: semZeros(v('id')), nome, status: status(v('status')), status_planilha: txt(v('status')) || '(vazio)',
          data: data(v('data')), desconto: typeof desc === 'number' ? Math.round((desc <= 1 ? desc * 100 : desc) * 100) / 100 : null,
          categoria: txt(v('categoria')) || null, docs: docs && !/^n(ao|ão)\.?$/i.test(docs) ? docs : null, boletos: sim(v('boletos')) ? 1 : 0,
          obs: txt(v('obs')) || null, novo: /^sim/i.test(txt(v('novo'))), pagamento: Object.keys(pag).length ? pag : null,
        });
      }
    }
    if (!linhas.length) falha(400, 'Não achei as abas das séries com as colunas "Nome do Aluno" e "Status". Baixe a planilha de controle do Google como Excel (.xlsx) e envie de novo.');
    const titulo = abas.map((a) => a.nome).join(' ');
    const anoPlan = (abas.flatMap((a) => a.linhas.slice(0, 3).flat()).map((x) => String(x ?? '')).join(' ').match(/\b(20\d\d)\b/) || [])[1];
    if (anoPlan && +anoPlan !== ano) avisos.push(`A planilha parece ser de ${anoPlan}, mas o sistema está na rematrícula de ${ano}. Confira antes de importar.`);
    return { linhas, vagas, avisos, titulo };
  }

  // Compara com o banco e monta o plano (o que muda em cada aluno)
  function planejar(p, ano) {
    const porMat = new Map(db.prepare('SELECT id, mat, nome, serie_chave FROM alunos WHERE ativo = 1').all().map((a) => [semZeros(a.mat), a]));
    const atuais = new Map(db.prepare('SELECT * FROM rematriculas WHERE ano = ?').all(ano).map((r) => [r.aluno_id, r]));
    const achados = [], nao_achados = [], vistos = new Set();
    const contagem = { pendente: 0, concluida: 0, nao_renova: 0 };
    let mudam = 0, mantidos = 0;
    const exemplosMantidos = [];
    for (const l of p.linhas) {
      const a = l.mat ? porMat.get(l.mat) : null;
      if (!a) { nao_achados.push({ nome: l.nome, mat: l.mat || '', aba: l.aba, novo: l.novo, l }); continue; }
      if (vistos.has(a.id)) { nao_achados.push({ nome: l.nome, mat: l.mat, aba: l.aba, repetido: true }); continue; }
      vistos.add(a.id);
      const atual = atuais.get(a.id) || { status: 'pendente' };
      // Vazio/Pendente na planilha não desfaz o que o sistema já avançou (Em andamento, Concluída, Transferido…)
      let novo = l.status;
      if (novo === 'pendente' && atual.status !== 'pendente') { novo = atual.status; mantidos++; if (exemplosMantidos.length < 8) exemplosMantidos.push(`${a.nome} (${STATUS_TXT[atual.status]} no sistema)`); }
      contagem[l.status] = (contagem[l.status] || 0) + 1;
      if (novo !== atual.status) mudam++;
      achados.push({ aluno_id: a.id, de: atual.status, para: novo, l, atual });
    }
    const semLinha = db.prepare(`SELECT COUNT(*) n FROM alunos WHERE ativo = 1 AND serie_chave <> 'EM3' AND id NOT IN (${[...vistos].join(',') || 'NULL'})`).get().n;
    return { achados, nao_achados, contagem, mudam, mantidos, exemplosMantidos, semLinha };
  }

  // ── 5.8.0: o app no lugar da planilha — painel, uma aba por sala e células editáveis ──
  // Listas das colunas de opção (as da aba "Configurações" da planilha de 2027). Aceitam também valor digitado.
  const LISTAS_PADRAO = {
    categoria: ['Regular', 'Filho de Funcionário', 'Bolsista 50%', 'Bolsista 100%', 'Permuta'],
    forma: ['PIX', 'Boleto', 'Cartão de Crédito', 'Cartão de Débito', 'Transferência Bancária'],
    banco: ['Santander', 'Itaú', 'Bradesco', 'Caixa', 'Banco do Brasil', 'Nubank'],
    plano_mensalidade: ['À vista', '11x', '12x', 'Filho de Funcionário', 'Bolsista'],
    plano_material: ['À vista', '10x', '1º no ato da matrícula', 'Dispensa de Material', 'Desconto em Folha de Pagamento'],
    plano_matricula: ['À vista', '2x', '3x', '4x'],
  };
  const PAG = ['plano_mensalidade', 'plano_material', 'valor_bruto', 'plano_matricula', 'forma', 'banco', 'autorizacao', 'p1_diferente', 'p1_forma',
    'p1_banco', 'p1_autorizacao', 'parcelas', 'valor_recebido'];
  const CAMPOS_TEXTO = ['categoria', 'docs_pendentes', 'obs_planilha', 'obs'];
  const destinoDe = (a, r) => (r && r.serie_destino ? S.porChave(r.serie_destino) : a.novo ? S.porChave(a.serie_chave) : S.proxima(a.serie_chave));
  // "1141,87", "R$ 1.141,87", "1141.87" → "R$ 1.141,87"; texto (ISENTO…) fica como está
  function dinheiroTxt(v) {
    const t = String(v ?? '').trim();
    if (!t) return '';
    const n = /^(r\$\s*)?[\d.]+(,\d{1,2})?$/i.test(t) ? Number(t.replace(/^r\$\s*/i, '').replace(/\./g, '').replace(',', '.'))
      : /^\d+(\.\d{1,2})?$/.test(t) ? Number(t) : null;
    return n != null && isFinite(n) ? n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : t;
  }
  function dataIso(v) {
    const t = String(v ?? '').trim();
    if (!t) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
    const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (!m) falha(400, `Data "${t}" não entendida. Use dd/mm/aaaa.`);
    const ano = m[3].length === 2 ? '20' + m[3] : m[3];
    return `${ano}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  const simNao = (v) => v === true || /^(sim|s|x|true|1|verdadeiro)$/i.test(String(v ?? '').trim());

  function linhaAluno(a, r) {
    let pag = {};
    try { pag = JSON.parse((r && r.pagamento_json) || '{}') || {}; } catch { /* registro estragado: sem pagamento */ }
    const d = destinoDe(a, r);
    return {
      id: a.id, mat: a.mat, nome: a.nome, novo: !!a.novo, turma_rotulo: ctx.turmaRotulo(a), destino: d ? d.chave : null,
      status: (r && r.status) || 'pendente', data_matricula: (r && r.data_matricula) || null, desconto: r ? r.desconto : null,
      categoria: (r && r.categoria) || null, docs_pendentes: (r && r.docs_pendentes) || null, boletos_entregues: r && r.boletos_entregues ? 1 : 0,
      obs_planilha: (r && r.obs_planilha) || null, obs: (r && r.obs) || null, pag, atualizado_em: (r && r.atualizado_em) || null, atualizado_por: (r && r.atualizado_por) || null,
    };
  }
  function listas() {
    let salvas = {};
    try { salvas = JSON.parse(cfg().rem_listas || '{}') || {}; } catch { /* config estragada: usa as padrão */ }
    return { ...LISTAS_PADRAO, ...salvas };
  }

  rota('GET', '/api/rematricula/controle', async (req, res) => {
    const ano = +cfg().ano_matricula;
    const reg = new Map(db.prepare('SELECT * FROM rematriculas WHERE ano = ?').all(ano).map((r) => [r.aluno_id, r]));
    const vagas = Object.fromEntries(db.prepare('SELECT serie_chave, capacidade FROM vagas WHERE ano = ?').all(ano).map((v) => [v.serie_chave, v.capacidade]));
    const alunos = db.prepare('SELECT * FROM alunos WHERE ativo = 1 ORDER BY nome').all().map((a) => linhaAluno(a, reg.get(a.id)))
      .filter((l) => l.destino && S.SERIES.some((s) => s.chave === l.destino)); // concluintes (depois da 3ª série, "CONC") ficam de fora
    json(res, 200, {
      ano, status: STATUS_TXT, listas: listas(),
      series: S.SERIES.map((s) => ({ chave: s.chave, rotulo: s.rotulo, capacidade: vagas[s.chave] ?? null })), alunos,
    });
  });

  // Grava uma ou várias células (colar do Excel manda várias de uma vez). Tudo numa transação: ou grava tudo, ou nada.
  rota('PUT', '/api/rematricula/celulas', async (req, res, { u }) => {
    const b = await ctx.corpoJson(req);
    const ano = +cfg().ano_matricula;
    const alteracoes = Array.isArray(b.alteracoes) ? b.alteracoes.slice(0, 2000) : [];
    if (!alteracoes.length) falha(400, 'Nada para gravar');
    const agora = agoraIso(), saida = [];
    transacao(() => {
      for (const alt of alteracoes) {
        const a = db.prepare('SELECT * FROM alunos WHERE id = ? AND ativo = 1').get(+alt.aluno_id) || falha(404, 'Aluno não encontrado');
        const atual = db.prepare('SELECT * FROM rematriculas WHERE aluno_id = ? AND ano = ?').get(a.id, ano) || { status: 'pendente' };
        const r = { ...atual };
        let pag = {};
        try { pag = JSON.parse(atual.pagamento_json || '{}') || {}; } catch { pag = {}; }
        const campo = String(alt.campo || ''), v = alt.valor, txt = String(v ?? '').trim();
        let antes;
        if (campo === 'status') {
          if (!STATUS_TXT[txt]) falha(400, 'Situação inválida');
          antes = STATUS_TXT[r.status]; r.status = txt;
          // Concluída = efetivada: precisa de data (hoje, se não tinha); sair de concluída/andamento apaga a data
          if (['concluida', 'reservada'].includes(txt)) r.data_matricula = r.data_matricula || (txt === 'concluida' ? agora.slice(0, 10) : null);
          else r.data_matricula = null;
        } else if (campo === 'data_matricula') {
          antes = r.data_matricula; r.data_matricula = dataIso(txt);
          // Como na planilha: com data de efetivação o aluno está efetivado; sem data, volta a "não iniciada"
          if (r.data_matricula && r.status !== 'concluida') r.status = 'concluida';
          if (!r.data_matricula && r.status === 'concluida') r.status = 'pendente';
        } else if (campo === 'desconto') {
          antes = r.desconto;
          if (!txt) r.desconto = null;
          else {
            const n = Number(txt.replace('%', '').replace(',', '.'));
            if (!(n >= 0 && n <= 100)) falha(400, `Desconto "${txt}" precisa ser de 0 a 100 (%)`);
            r.desconto = Math.round(n * 100) / 100;
          }
        } else if (campo === 'serie_destino') {
          if (!S.porChave(txt)) falha(400, 'Sala inválida');
          antes = r.serie_destino; r.serie_destino = txt;
        } else if (campo === 'boletos_entregues') {
          antes = r.boletos_entregues; r.boletos_entregues = simNao(v) ? 1 : 0;
        } else if (CAMPOS_TEXTO.includes(campo)) {
          if (txt.length > 500) falha(400, 'Texto grande demais (máximo 500 letras)');
          antes = r[campo]; r[campo] = txt || null;
        } else if (campo.startsWith('pag.') && PAG.includes(campo.slice(4))) {
          const k = campo.slice(4);
          antes = pag[k];
          const novo = k === 'p1_diferente' ? (simNao(v) ? 'Sim' : '') : k === 'valor_bruto' || k === 'valor_recebido' ? dinheiroTxt(txt) : txt.slice(0, 200);
          if (novo) pag[k] = novo; else delete pag[k];
          r.pagamento_json = Object.keys(pag).length ? JSON.stringify(pag) : null;
        } else falha(400, 'Coluna que não pode ser editada: ' + campo);
        db.prepare(`INSERT INTO rematriculas (aluno_id, ano, status, serie_destino, data_matricula, spc, obs, desconto, categoria, docs_pendentes, boletos_entregues,
            pagamento_json, obs_planilha, planilha_em, atualizado_em, atualizado_por) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
          ON CONFLICT(aluno_id, ano) DO UPDATE SET status=excluded.status, serie_destino=excluded.serie_destino, data_matricula=excluded.data_matricula,
            obs=excluded.obs, desconto=excluded.desconto, categoria=excluded.categoria, docs_pendentes=excluded.docs_pendentes,
            boletos_entregues=excluded.boletos_entregues, pagamento_json=excluded.pagamento_json, obs_planilha=excluded.obs_planilha,
            atualizado_em=excluded.atualizado_em, atualizado_por=excluded.atualizado_por`)
          .run(a.id, ano, r.status || 'pendente', r.serie_destino ?? null, r.data_matricula ?? null, r.spc ?? null, r.obs ?? null, r.desconto ?? null,
            r.categoria ?? null, r.docs_pendentes ?? null, r.boletos_entregues ? 1 : 0, r.pagamento_json ?? null, r.obs_planilha ?? null, r.planilha_em ?? null, agora, u.login);
        registrar(u.login, `rematrícula: editou "${campo.replace('pag.', '')}"`, { aluno_id: a.id, de: antes ?? '', para: txt });
        saida.push(linhaAluno(a, db.prepare('SELECT * FROM rematriculas WHERE aluno_id = ? AND ano = ?').get(a.id, ano)));
      }
    });
    json(res, 200, { ok: true, alunos: saida });
  });

  // Listas das colunas de opção (administração)
  rota('PUT', '/api/rematricula/listas', async (req, res, { u }) => {
    exigirAdmin(u);
    const b = await ctx.corpoJson(req);
    const novas = {};
    for (const k of Object.keys(LISTAS_PADRAO)) if (Array.isArray(b[k])) novas[k] = [...new Set(b[k].map((x) => String(x).trim()).filter(Boolean))].slice(0, 50);
    db.prepare('INSERT INTO config (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor').run('rem_listas', JSON.stringify(novas));
    registrar(u.login, 'alterou as listas da planilha de rematrícula', novas);
    json(res, 200, { ok: true, listas: listas() });
  });

  // Tudo o que a rematrícula guarda de cada aluno (visão "Completa" da tela, igual à planilha)
  rota('GET', '/api/rematricula/detalhes', async (req, res) => {
    const ano = +cfg().ano_matricula;
    const linhas = db.prepare(`SELECT aluno_id, data_matricula, desconto, categoria, docs_pendentes, boletos_entregues, pagamento_json, obs_planilha, obs, planilha_em
      FROM rematriculas WHERE ano = ?`).all(ano);
    json(res, 200, {
      importada_em: linhas.reduce((m, l) => (l.planilha_em && l.planilha_em > m ? l.planilha_em : m), '') || null,
      alunos: Object.fromEntries(linhas.map((l) => {
        let p = {};
        try { p = JSON.parse(l.pagamento_json || '{}') || {}; } catch { /* registro estragado: volta sem o pagamento */ }
        const { pagamento_json, aluno_id, ...resto } = l;
        return [aluno_id, { ...resto, pag: p }];
      })),
    });
  });

  rota('POST', '/api/rematricula/planilha', async (req, res, { u, url }) => {
    exigirAdmin(u);
    const ano = +cfg().ano_matricula;
    const p = ler(await lerCorpo(req), ano);
    const pl = planejar(p, ano);
    const aplicar = url.searchParams.get('aplicar') === '1';
    const resumo = {
      ano, linhas: p.linhas.length, achados: pl.achados.length, nao_achados: pl.nao_achados.map(({ l, ...x }) => x), mudam: pl.mudam, mantidos: pl.mantidos,
      exemplos_mantidos: pl.exemplosMantidos, sem_linha: pl.semLinha, contagem: pl.contagem, vagas: p.vagas, avisos: p.avisos,
      categorias: Object.entries(pl.achados.reduce((m, x) => { const c = x.l.categoria || '(sem categoria)'; m[c] = (m[c] || 0) + 1; return m; }, {})),
      com_docs: pl.achados.filter((x) => x.l.docs).length, com_pagamento: pl.achados.filter((x) => x.l.pagamento).length,
    };
    if (!aplicar) return json(res, 200, resumo);
    const agora = agoraIso();
    let criados = 0;
    transacao(() => {
      const grava = db.prepare(`INSERT INTO rematriculas (aluno_id, ano, status, serie_destino, data_matricula, desconto, categoria, docs_pendentes, boletos_entregues,
          pagamento_json, obs_planilha, planilha_em, atualizado_em, atualizado_por)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(aluno_id, ano) DO UPDATE SET status=excluded.status, serie_destino=excluded.serie_destino,
          data_matricula=excluded.data_matricula, desconto=excluded.desconto, categoria=excluded.categoria, docs_pendentes=excluded.docs_pendentes,
          boletos_entregues=excluded.boletos_entregues, pagamento_json=excluded.pagamento_json, obs_planilha=excluded.obs_planilha,
          planilha_em=excluded.planilha_em, atualizado_em=excluded.atualizado_em, atualizado_por=excluded.atualizado_por`);
      for (const x of pl.achados) {
        const l = x.l;
        // Data da matrícula: a de efetivação da planilha; concluída sem data mantém a que o sistema já tinha
        const dataMat = x.para === 'concluida' || x.para === 'reservada' ? l.data || x.atual.data_matricula || (x.para === 'concluida' ? agora.slice(0, 10) : null) : null;
        grava.run(x.aluno_id, ano, x.para, l.serie_destino, dataMat, l.desconto, l.categoria, l.docs, l.boletos,
          l.pagamento ? JSON.stringify(l.pagamento) : null, l.obs, agora, agora, u.login);
        if (x.para !== x.de) registrar(u.login, `rematrícula (planilha): ${STATUS_TXT[x.de]} → ${STATUS_TXT[x.para]}`, { aluno_id: x.aluno_id });
      }
      // 5.8.0: alunos novos da planilha (ainda sem cadastro no ACADESC) entram como aluno novo da sala — assim nada fica só na planilha
      if (url.searchParams.get('novos') === '1') {
        for (const x of pl.nao_achados.filter((y) => !y.repetido)) {
          const l = x.l, mat = l.mat && !db.prepare('SELECT 1 FROM alunos WHERE mat = ?').get(l.mat) ? l.mat : null;
          const s = S.porChave(l.serie_destino);
          const idNovo = Number(db.prepare(`INSERT INTO alunos (mat, nome, serie_chave, descricao, serie, novo, atualizado_em, atualizado_por)
            VALUES (?,?,?,?,?,1,?,?)`).run(mat, l.nome, s.chave, s.descricao, s.serie, agora, u.login).lastInsertRowid);
          const st = l.status === 'concluida' ? 'concluida' : l.status;
          grava.run(idNovo, ano, st, l.serie_destino, st === 'concluida' ? l.data || agora.slice(0, 10) : null, l.desconto, l.categoria, l.docs, l.boletos,
            l.pagamento ? JSON.stringify(l.pagamento) : null, l.obs, agora, agora, u.login);
          registrar(u.login, 'cadastrou aluno novo (planilha de controle)', { aluno_id: idNovo, nome: l.nome });
          criados++;
        }
      }
      const vg = db.prepare('INSERT INTO vagas (serie_chave, ano, capacidade) VALUES (?, ?, ?) ON CONFLICT(serie_chave, ano) DO UPDATE SET capacidade = excluded.capacidade');
      for (const v of p.vagas) vg.run(v.serie_chave, ano, v.capacidade);
    });
    registrar(u.login, 'importou a planilha de controle de matrículas e rematrículas', { ano, alunos: pl.achados.length, mudaram: pl.mudam, nao_achados: pl.nao_achados.length, vagas: p.vagas.length });
    json(res, 200, { ...resumo, aplicado: true, criados });
  });
};

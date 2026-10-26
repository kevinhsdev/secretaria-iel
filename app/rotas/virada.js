// Virada do ano letivo e saída de alunos (5.10.0).
// O "ano letivo atual" é sempre ano_matricula - 1. A virada leva a escola de um ano para o outro:
// quem rematriculou sobe de série, quem saiu fica inativo com o motivo guardado, e a matrícula aberta passa para o ano seguinte.
'use strict';
const B = require('../lib/backup');

const MOTIVOS = { transferido: 'Transferido', nao_renovou: 'Não renovou', desistiu: 'Desistiu', formado: 'Formado', outro: 'Outro motivo' };
const MATRICULADO = ['reservada', 'concluida'];
// Datas da campanha e do CEBAS que andam um ano junto com a virada (dá para ajustar depois em Configurações › Geral)
const DATAS_DO_ANO = ['data_inicio', 'data_desconto', 'data_garantia_vaga', 'data_fim', 'cebas_retirada', 'cebas_entrega_ini', 'cebas_entrega_fim', 'cebas_resultado', 'cebas_prestacao'];

// Feriados nacionais + 9 de julho (SP). Os móveis saem da Páscoa (algoritmo de Meeus/Butcher).
function feriadosDoAno(ano) {
  const a = ano % 19, b = Math.floor(ano / 100), c = ano % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const pascoa = Date.UTC(ano, Math.floor((h + l - 7 * m + 114) / 31) - 1, ((h + l - 7 * m + 114) % 31) + 1);
  const movel = (dias) => new Date(pascoa + dias * 86400000).toISOString().slice(0, 10);
  const fixo = (mmdd) => `${ano}-${mmdd}`;
  return [
    [fixo('01-01'), 'Confraternização Universal'], [movel(-48), 'Carnaval'], [movel(-47), 'Carnaval'], [movel(-2), 'Sexta-feira Santa'],
    [fixo('04-21'), 'Tiradentes'], [fixo('05-01'), 'Dia do Trabalho'], [movel(60), 'Corpus Christi'], [fixo('07-09'), 'Revolução Constitucionalista (SP)'],
    [fixo('09-07'), 'Independência'], [fixo('10-12'), 'Nossa Senhora Aparecida'], [fixo('11-02'), 'Finados'], [fixo('11-15'), 'Proclamação da República'],
    [fixo('11-20'), 'Consciência Negra'], [fixo('12-25'), 'Natal'],
  ];
}

const maisUmAno = (iso) => (/^\d{4}-\d{2}-\d{2}$/.test(iso || '') ? (+iso.slice(0, 4) + 1) + (iso.slice(4) === '-02-29' ? '-02-28' : iso.slice(4)) : iso);

module.exports = function virada(ctx) {
  const { rota, db, cfg, registrar, transacao, falha, json, corpoJson, exigirAdmin, hoje, agoraIso, S, turmaRotulo, PASTA_DADOS } = ctx;

  // O que o sistema sugere para cada aluno ativo. A secretaria confere e troca o que precisar antes de confirmar.
  function sugestoes() {
    const ano = +cfg().ano_matricula;
    return db.prepare(`SELECT a.id, a.mat, a.nome, a.serie_chave, a.turma, a.descricao, a.serie, a.novo, COALESCE(r.status,'pendente') status, r.serie_destino
      FROM alunos a LEFT JOIN rematriculas r ON r.aluno_id = a.id AND r.ano = ? WHERE a.ativo = 1 ORDER BY a.nome`).all(ano).map((a) => {
      const destino = a.serie_destino ? S.porChave(a.serie_destino) : a.novo ? S.porChave(a.serie_chave) : S.proxima(a.serie_chave);
      let sugestao, conferir = false;
      if (MATRICULADO.includes(a.status)) sugestao = destino?.chave === 'CONC' ? 'formado' : !a.novo && destino?.chave === a.serie_chave ? 'repete' : 'sobe';
      else if (a.novo) sugestao = 'desistiu';
      else if (a.serie_chave === 'EM3') sugestao = 'formado';
      else if (a.status === 'transferido') sugestao = 'transferido';
      else if (a.status === 'nao_renova') sugestao = 'nao_renovou';
      else { sugestao = 'nao_renovou'; conferir = true; } // não iniciou a rematrícula: decisão do Kevin (26/10/2026) — vem como saída, em destaque
      return { id: a.id, mat: a.mat, nome: a.nome, novo: !!a.novo, status: a.status, turma_rotulo: a.novo ? 'Aluno novo' : turmaRotulo(a),
        ordem: S.SERIES.findIndex((s) => s.chave === a.serie_chave), serie_chave: a.serie_chave,
        destino: destino && destino.chave !== 'CONC' ? { chave: destino.chave, rotulo: destino.rotulo } : null, sugestao, conferir };
    });
  }

  rota('GET', '/api/admin/virada', async (req, res, { u }) => {
    exigirAdmin(u);
    const ano = +cfg().ano_matricula;
    json(res, 200, { de: ano - 1, para: ano, motivos: MOTIVOS, alunos: sugestoes() });
  });

  // decisoes: { [aluno_id]: 'sobe' | 'repete' | motivo de saída }. Quem não vier na lista fica com a sugestão.
  rota('POST', '/api/admin/virada', async (req, res, { u }) => {
    exigirAdmin(u);
    const b = await corpoJson(req);
    const c = cfg(); const para = +c.ano_matricula;
    // Trava contra clicar duas vezes ou duas pessoas ao mesmo tempo: a tela manda o ano que estava vendo
    if (+b.de !== para - 1) falha(409, `A virada para ${para} já foi feita (ou o ano mudou). Recarregue a página.`);
    const decisoes = b.decisoes || {};
    const lista = sugestoes();
    for (const a of lista) {
      const d = decisoes[a.id] ?? a.sugestao;
      if (d !== 'sobe' && d !== 'repete' && !MOTIVOS[d]) falha(400, `Escolha o que acontece com ${a.nome}.`);
      if (d === 'sobe' && !a.destino) falha(400, `${a.nome} não tem série para ${para}. Marque como formado ou escolha a série na ficha.`);
    }

    // Cópia de segurança antes de mexer em todo mundo (se falhar, não faz a virada)
    let copia;
    try { copia = B.fazerBackup(db, c, PASTA_DADOS, 'virada'); } catch (e) { falha(500, 'Não consegui fazer a cópia de segurança antes da virada: ' + e.message); }

    const res_ = { subiram: 0, repetiram: 0, sairam: 0, por_motivo: {} };
    transacao(() => {
      const continua = db.prepare('UPDATE alunos SET serie_chave = ?, descricao = ?, serie = ?, novo = 0, ano_letivo = ?, atualizado_em = ?, atualizado_por = ? WHERE id = ?');
      const sai = db.prepare('UPDATE alunos SET ativo = 0, saida_motivo = ?, saida_data = ?, saida_ano = ?, atualizado_em = ?, atualizado_por = ? WHERE id = ?');
      for (const a of lista) {
        const d = decisoes[a.id] ?? a.sugestao;
        if (d === 'sobe' || d === 'repete') {
          const s = d === 'sobe' ? S.porChave(a.destino.chave) : S.porChave(a.serie_chave);
          continua.run(s.chave, s.descricao, s.serie, para, agoraIso(), u.login, a.id);
          res_[d === 'sobe' ? 'subiram' : 'repetiram']++;
        } else {
          // Aluno novo que não veio nunca cursou aqui: o "último ano" fica vazio
          sai.run(d, hoje(), a.novo ? null : String(para - 1), agoraIso(), u.login, a.id);
          res_.sairam++; res_.por_motivo[d] = (res_.por_motivo[d] || 0) + 1;
        }
      }
      const grava = db.prepare('INSERT INTO config (chave, valor) VALUES (?, ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor');
      grava.run('ano_matricula', String(para + 1));
      for (const k of DATAS_DO_ANO) if (c[k]) grava.run(k, maisUmAno(c[k]));
      if (+c.cebas_ano === para) grava.run('cebas_ano', String(para + 1));
      // Vagas do ano novo começam iguais às do ano anterior
      db.prepare('INSERT OR IGNORE INTO vagas (serie_chave, ano, capacidade) SELECT serie_chave, ano + 1, capacidade FROM vagas WHERE ano = ?').run(para);
      // Feriados do ano da próxima matrícula, para o livro ponto (só se ainda não tem nenhum daquele ano)
      if (!db.prepare("SELECT 1 FROM feriados WHERE data LIKE ? LIMIT 1").get(`${para + 1}-%`)) {
        const ins = db.prepare('INSERT OR IGNORE INTO feriados (data, nome) VALUES (?, ?)');
        for (const f of feriadosDoAno(para + 1)) ins.run(...f);
      }
    });
    registrar(u.login, `fez a virada do ano letivo ${para - 1} → ${para}`, { ...res_, copia: copia.arquivo });
    json(res, 200, { ...res_, ano_letivo: para, ano_matricula: para + 1, copia: copia.arquivo });
  });

  // ── Saída de um aluno durante o ano (transferência, desistência…) e volta ──
  rota('PUT', '/api/alunos/:id/saida', async (req, res, { u, p }) => {
    const b = await corpoJson(req);
    const a = db.prepare('SELECT id, nome, ativo FROM alunos WHERE id = ?').get(+p.id) || falha(404, 'Aluno não encontrado');
    if (!MOTIVOS[b.motivo]) falha(400, 'Escolha o motivo da saída');
    const data = /^\d{4}-\d{2}-\d{2}$/.test(b.data || '') ? b.data : hoje();
    db.prepare('UPDATE alunos SET ativo = 0, saida_motivo = ?, saida_data = ?, saida_ano = ?, saida_obs = ?, atualizado_em = ?, atualizado_por = ? WHERE id = ?')
      .run(b.motivo, data, String(+cfg().ano_matricula - 1), String(b.obs || '').trim() || null, agoraIso(), u.login, a.id);
    registrar(u.login, `registrou saída do aluno (${MOTIVOS[b.motivo].toLowerCase()})`, { aluno_id: a.id, nome: a.nome });
    json(res, 200, { ok: true });
  });

  rota('DELETE', '/api/alunos/:id/saida', async (req, res, { u, p }) => {
    const a = db.prepare('SELECT id, nome FROM alunos WHERE id = ?').get(+p.id) || falha(404, 'Aluno não encontrado');
    db.prepare('UPDATE alunos SET ativo = 1, saida_motivo = NULL, saida_data = NULL, saida_ano = NULL, saida_obs = NULL, atualizado_em = ?, atualizado_por = ? WHERE id = ?')
      .run(agoraIso(), u.login, a.id);
    registrar(u.login, 'reativou o aluno', { aluno_id: a.id, nome: a.nome });
    json(res, 200, { ok: true });
  });

  // Ex-alunos (os que saíram e ainda não tiveram os dados descartados pela LGPD)
  rota('GET', '/api/ex-alunos', async (req, res) => {
    json(res, 200, db.prepare(`SELECT id, mat, nome, serie_chave, turma, descricao, serie, nome_mae, nome_resp, saida_motivo, saida_data, saida_ano
      FROM alunos WHERE ativo = 0 AND anonimizado IS NULL ORDER BY nome`).all()
      .map((a) => ({ ...a, turma_rotulo: turmaRotulo(a), motivo_rotulo: MOTIVOS[a.saida_motivo] || 'Inativo', ordem: S.SERIES.findIndex((s) => s.chave === a.serie_chave) })));
  });
};
module.exports.feriadosDoAno = feriadosDoAno;
module.exports.MOTIVOS = MOTIVOS;

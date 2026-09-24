// Lixeira: excluir não apaga na hora. As linhas vão, em JSON, para a tabela "lixeira" e só somem de vez
// depois de lixeira_dias. Restaurar é inserir de volta com o mesmo id (os links e o histórico continuam valendo).
'use strict';

const TIPOS = {
  atendimento: 'Atendimento', aviso_saida: 'Aviso de saída', autorizado: 'Pessoa autorizada a buscar',
  tarefa: 'Tarefa do dia', lembrete: 'Lembrete do calendário', interessado: 'Interessado (SIG)', modelo: 'Modelo de mensagem',
  remessa: 'Remessa de boletos', bolsa: 'Processo de bolsa', inscricao: 'Inscrição em atividade extra', evento: 'Evento',
  feriado: 'Feriado',
};
// Só a administração vê e restaura estes (são de telas que a aprendiz não acessa)
const SO_ADMIN = new Set(['bolsa']);

module.exports = function criarLixeira({ db, transacao, agoraIso }) {
  const colunas = (tabela) => new Set(db.prepare(`PRAGMA table_info(${tabela})`).all().map((c) => c.name));

  // tabela/onde/params: o item principal. filhas: linhas que o ON DELETE CASCADE levaria junto.
  function excluir({ tipo, rotulo, usuario, aluno_id = null, tabela, onde, params, filhas = [] }) {
    const linhas = db.prepare(`SELECT * FROM ${tabela} WHERE ${onde}`).all(...params);
    if (!linhas.length) return null;
    const grupos = [{ tabela, linhas }];
    for (const f of filhas) grupos.push({ tabela: f.tabela, linhas: db.prepare(`SELECT * FROM ${f.tabela} WHERE ${f.onde}`).all(...f.params) });
    // Marca de demonstração: some junto quando alguém apaga a demonstração
    const demo = grupos.some((g) => g.linhas.some((l) => l.demo === 1)) || (tabela === 'eventos' && linhas[0].obs === 'DEMO')
      || (aluno_id && db.prepare('SELECT demo FROM alunos WHERE id = ?').get(aluno_id)?.demo === 1) ? 1 : 0;
    return transacao(() => {
      const r = db.prepare('INSERT INTO lixeira (tipo, rotulo, aluno_id, dados, usuario, excluido_em, demo) VALUES (?, ?, ?, ?, ?, ?, ?)')
        .run(tipo, rotulo || null, aluno_id, JSON.stringify(grupos), usuario, agoraIso(), demo);
      db.prepare(`DELETE FROM ${tabela} WHERE ${onde}`).run(...params);
      return Number(r.lastInsertRowid);
    });
  }

  // Devolve as linhas. Se já existir outra no mesmo lugar (ou o aluno não existir mais), explica e não mexe em nada.
  function restaurar(id) {
    const item = db.prepare('SELECT * FROM lixeira WHERE id = ?').get(id);
    if (!item) return { erro: 'Este item não está mais na lixeira.' };
    const grupos = JSON.parse(item.dados);
    try {
      transacao(() => {
        for (const g of grupos) {
          const cols = colunas(g.tabela);
          for (const l of g.linhas) {
            const ks = Object.keys(l).filter((k) => cols.has(k));
            db.prepare(`INSERT INTO ${g.tabela} (${ks.join(', ')}) VALUES (${ks.map(() => '?').join(', ')})`).run(...ks.map((k) => l[k]));
          }
        }
        db.prepare('DELETE FROM lixeira WHERE id = ?').run(id);
      });
    } catch (e) {
      const msg = String(e.message || e);
      if (/UNIQUE|PRIMARY KEY/i.test(msg)) return { erro: 'Não dá para restaurar: já existe um registro igual no lugar dele (alguém cadastrou de novo depois de excluir).' };
      if (/FOREIGN KEY/i.test(msg)) return { erro: 'Não dá para restaurar: o aluno ou o item ligado a ele não existe mais no sistema.' };
      throw e;
    }
    return { ok: true, item };
  }

  // Apaga de vez o que passou do prazo. Devolve quantos itens saíram.
  function limpar(dias) {
    const d = Math.max(1, Number(dias) || 30);
    const limite = new Date(Date.now() - d * 86400000).toISOString();
    return Number(db.prepare('DELETE FROM lixeira WHERE excluido_em < ?').run(limite).changes);
  }

  return { TIPOS, SO_ADMIN, excluir, restaurar, limpar };
};

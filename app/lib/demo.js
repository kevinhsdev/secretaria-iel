// Dados FICTÍCIOS para testar e apresentar o sistema sem expor dados reais de alunos (LGPD).
'use strict';
const S = require('./series');

const NOMES = ['Ana', 'Beatriz', 'Clara', 'Davi', 'Enzo', 'Felipe', 'Gabriela', 'Heitor', 'Isabela', 'João', 'Laura', 'Lucas', 'Manuela', 'Miguel',
  'Nicolas', 'Olívia', 'Pedro', 'Rafaela', 'Samuel', 'Sofia', 'Theo', 'Valentina', 'Vitor', 'Yasmin', 'Arthur', 'Helena', 'Bernardo', 'Lívia', 'Gael', 'Cecília'];
const SOBRENOMES = ['Almeida', 'Barbosa', 'Cardoso', 'Dias', 'Esteves', 'Ferreira', 'Gomes', 'Honorato', 'Inácio', 'Jardim', 'Lima', 'Moreira',
  'Nogueira', 'Oliveira', 'Pereira', 'Queiroz', 'Ribeiro', 'Santos', 'Teixeira', 'Vasconcelos'];
const MAES = ['Adriana', 'Camila', 'Daniela', 'Fernanda', 'Juliana', 'Patrícia', 'Renata', 'Tatiane', 'Vanessa', 'Priscila'];
const PAIS = ['Anderson', 'Bruno', 'Carlos', 'Diego', 'Eduardo', 'Fábio', 'Leandro', 'Marcelo', 'Rodrigo', 'Thiago'];

// real = true: tamanho da escola de verdade (~535 alunos), para testar desempenho e treinar sem dado real
function gerarDemo(db, ano, transacao, { real = false } = {}) {
  let semente = 20260924;
  const rnd = () => { semente = (semente * 1103515245 + 12345) % 2147483648; return semente / 2147483648; };
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const hoje = new Date();
  const diasAtras = (n) => { const d = new Date(hoje); d.setDate(d.getDate() - n); return d.toLocaleDateString('sv-SE'); };
  const cel = () => `(11) 9${String(Math.floor(rnd() * 90000000) + 10000000).replace(/(\d{4})(\d{4})/, '$1-$2')}`;

  const turmas = [['MAT', ['A']], ['JD1', ['A']], ['JD2', ['A', 'B']], ['F1', ['A', 'B']], ['F2', ['A', 'B']], ['F3', ['A', 'B']], ['F4', ['A', 'B']],
    ['F5', ['A', 'B', 'C']], ['F6', ['A', 'B']], ['F7', ['A', 'B']], ['F8', ['A', 'B']], ['F9', ['A', 'B']], ['EM1', ['A', 'B']], ['EM2', ['A']], ['EM3', ['A']]];
  const docs = db.prepare('SELECT id, aplica, obrigatorio FROM doc_tipos WHERE ativo = 1').all();
  const insAluno = db.prepare(`INSERT INTO alunos (mat, nome, dt_nasc, cpf, descricao, serie, turma, turno, serie_chave, ano_letivo, filho_funcionario,
    nome_mae, nome_pai, nome_resp, email_mae, cel_mae, cel_pai, novo, demo, atualizado_em) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?)`);
  const insRem = db.prepare('INSERT INTO rematriculas (aluno_id, ano, status, data_matricula, atualizado_em, atualizado_por) VALUES (?,?,?,?,?,?)');
  const insEnt = db.prepare('INSERT INTO entregas (aluno_id, doc_id, ano, entregue, data_entrega, atualizado_por) VALUES (?,?,?,1,?,?)');
  const insInt = db.prepare(`INSERT INTO interessados (data, tipo_contato, aluno, responsavel, contato, escola_atual, serie_interesse, status, ultimo_contato, demo)
    VALUES (?,?,?,?,?,?,?,?,?,1)`);

  let mat = 9001, n = 0;
  transacao(() => {
    for (const [chave, letras] of turmas) {
      const s = S.porChave(chave);
      const idadeBase = { MAT: 3, JD1: 4, JD2: 5 }[chave] ?? (chave.startsWith('EM') ? 14 + +chave.slice(2) : 5 + +chave.slice(1));
      for (const letra of letras) {
        const qtd = real ? 17 + Math.floor(rnd() * 6) : 4 + Math.floor(rnd() * 4);
        for (let i = 0; i < qtd; i++) {
          const sobre = pick(SOBRENOMES) + ' ' + pick(SOBRENOMES);
          const nome = (pick(NOMES) + ' ' + sobre).toUpperCase();
          const mae = (pick(MAES) + ' ' + sobre).toUpperCase();
          const pai = (pick(PAIS) + ' ' + sobre).toUpperCase();
          const nasc = `${ano - 1 - idadeBase}-${String(1 + Math.floor(rnd() * 12)).padStart(2, '0')}-${String(1 + Math.floor(rnd() * 28)).padStart(2, '0')}`;
          const turno = ['F8', 'F9', 'EM1', 'EM2', 'EM3'].includes(chave) ? 'M' : 'T';
          const r = insAluno.run(String(mat++), nome, nasc, '000.000.000-00', s.descricao, s.serie, letra, turno, chave, ano - 1,
            rnd() < 0.06 ? 1 : 0, mae, pai, rnd() < 0.5 ? mae : pai, 'exemplo@exemplo.com', cel(), cel(), 0, new Date().toISOString());
          const id = Number(r.lastInsertRowid);
          n++;
          if (chave === 'EM3') continue; // concluintes não rematriculam
          const x = rnd();
          const status = x < 0.35 ? 'pendente' : x < 0.6 ? 'reservada' : x < 0.92 ? 'concluida' : 'nao_renova';
          if (status === 'pendente') continue;
          const data = ['reservada', 'concluida'].includes(status) ? diasAtras(Math.floor(rnd() * 40)) : null;
          insRem.run(id, ano, status, data, new Date().toISOString(), 'demo');
          if (data) for (const d of docs) if (d.aplica === 'todos' && rnd() < (status === 'concluida' ? 0.85 : 0.45)) insEnt.run(id, d.id, ano, data, 'demo');
        }
      }
    }
    // Alguns alunos novos para 2027
    for (let i = 0; i < 8; i++) {
      const chave = pick(['MAT', 'JD1', 'F1', 'F6', 'EM1']);
      const s = S.porChave(chave);
      const sobre = pick(SOBRENOMES) + ' ' + pick(SOBRENOMES);
      const mae = (pick(MAES) + ' ' + sobre).toUpperCase();
      const r = insAluno.run(String(mat++), (pick(NOMES) + ' ' + sobre).toUpperCase(), null, null, s.descricao, s.serie, null, null, chave, ano, 0,
        mae, null, mae, null, cel(), null, 1, new Date().toISOString());
      const id = Number(r.lastInsertRowid);
      n++;
      const data = diasAtras(Math.floor(rnd() * 35));
      insRem.run(id, ano, rnd() < 0.5 ? 'reservada' : 'concluida', data, new Date().toISOString(), 'demo');
      for (const d of docs) if (rnd() < 0.4) insEnt.run(id, d.id, ano, data, 'demo');
    }
    const escolas = ['EE Pública do Centro', 'Recanto dos Baixinhos', 'EMEF Jardim Primavera', 'Colégio particular'];
    const st = ['novo', 'novo', 'contatado', 'contatado', 'visita', 'matriculado', 'desistiu'];
    for (let i = 0; i < 14; i++) {
      const sobre = pick(SOBRENOMES);
      insInt.run(diasAtras(Math.floor(rnd() * 60)), pick(['Presencial', 'WhatsApp', 'Telefone']), (pick(NOMES) + ' ' + sobre + ' (DEMO)'),
        pick(MAES) + ' ' + sobre, cel(), pick(escolas), pick(S.SERIES).rotulo, pick(st), diasAtras(Math.floor(rnd() * 20)));
    }
  });
  return n;
}

// Etapa 2: inscrições em atividades extras, um evento com ingressos e processos de bolsa (tudo fictício)
function gerarDemoEtapa2(db, anoBolsa, transacao) {
  let semente = 777;
  const rnd = () => { semente = (semente * 1103515245 + 12345) % 2147483648; return semente / 2147483648; };
  const alunos = db.prepare('SELECT * FROM alunos WHERE demo = 1 AND ativo = 1').all();
  const ativs = db.prepare('SELECT * FROM atividades WHERE ativo = 1').all();
  if (!alunos.length || !ativs.length) return;
  const ano = new Date().getFullYear();
  const cabe = (t, a) => {
    const seg = S.segmento(a.serie_chave);
    const n = a.serie_chave?.startsWith('F') ? +a.serie_chave.slice(1) : a.serie_chave?.startsWith('EM') ? 9 + +a.serie_chave.slice(2) : 0;
    const p = S.norm(t.publico);
    if (p.includes('infantil') && !p.includes('fund')) return seg === 'infantil';
    if (p.startsWith('1º ao 3') || p.startsWith('1o ao 3') || p.startsWith('1 ao 3')) return n >= 1 && n <= 3;
    if (p.startsWith('4')) return n === 4 || n === 5;
    if (p.startsWith('1') && p.includes('5')) return n >= 1 && n <= 5;
    if (p.startsWith('6')) return n >= 6 && n <= 9;
    if (p.startsWith('7')) return n >= 7;
    return true;
  };
  const insI = db.prepare(`INSERT INTO inscricoes (aluno_id, atividade_id, ano, data_inscricao, parcelas, valor_parcela, primeiro_venc, status, data_cancelamento, motivo, criado_por, demo)
    VALUES (?,?,?,?,?,?,?,?,?,?,'demo',1)`);
  const insB = db.prepare(`INSERT INTO bolsas (ano, tipo, aluno_id, nome_aluno, serie, responsavel, telefone, req_enviado, req_entregue, percentual_atual, per_capita, ofertado, status, checklist, atualizado_em, atualizado_por, demo)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'demo',1)`);
  transacao(() => {
    for (const a of alunos) {
      if (rnd() > 0.22) continue;
      const opcoes = ativs.filter((t) => cabe(t, a));
      if (!opcoes.length) continue;
      const t = opcoes[Math.floor(rnd() * opcoes.length)];
      const mes = 2 + Math.floor(rnd() * 5);
      const cancel = rnd() < 0.12;
      insI.run(a.id, t.id, ano, `${ano}-${String(mes + 1).padStart(2, '0')}-0${1 + Math.floor(rnd() * 9)}`, 11 - mes, t.valor, `${ano}-${String(mes + 1).padStart(2, '0')}-10`,
        cancel ? 'cancelada' : 'ativa', cancel ? `${ano}-08-1${Math.floor(rnd() * 9)}` : null, cancel ? 'Horário não compatível com a rotina da família' : null);
    }
    const ev = db.prepare(`INSERT INTO eventos (nome, data, limite_por_aluno, obs) VALUES (?, ?, 4, 'DEMO')`).run(`Apresentação de Balé ${ano}`, `${ano}-12-05`);
    const bailarinas = db.prepare(`SELECT DISTINCT i.aluno_id FROM inscricoes i JOIN atividades t ON t.id = i.atividade_id WHERE t.nome LIKE '%allet%' AND i.status = 'ativa' AND i.demo = 1`).all();
    for (const b of bailarinas) if (rnd() < 0.6) db.prepare('INSERT INTO ingressos (evento_id, aluno_id, quantidade, retirado_em, retirado_por) VALUES (?,?,?,?,?)')
      .run(ev.lastInsertRowid, b.aluno_id, 1 + Math.floor(rnd() * 4), rnd() < 0.4 ? `${ano}-11-2${Math.floor(rnd() * 8)}` : null, 'demo');
    const status = ['inscrito', 'conferido', 'assistente', 'visita', 'ofertada', 'ofertada', 'concedida', 'indeferida'];
    const itens = ['requerimento', 'pessoais', 'rg_cpf', 'vacina', 'ctps', 'renda', 'irpf', 'despesas', 'moradia', 'adimplencia'];
    for (const a of alunos) {
      if (rnd() > 0.14 || a.serie_chave === 'EM3') continue;
      const st = status[Math.floor(rnd() * status.length)];
      const chk = Object.fromEntries(itens.filter(() => rnd() < (st === 'inscrito' ? 0.5 : 0.95)).map((k) => [k, true]));
      const destino = S.proxima(a.serie_chave);
      insB.run(anoBolsa, rnd() < 0.7 ? 'renovacao' : 'novo', a.id, a.nome, destino?.rotulo || '', a.nome_resp || a.nome_mae, a.cel_mae, `${anoBolsa - 1}-06-02`,
        `${anoBolsa - 1}-06-${10 + Math.floor(rnd() * 20)}`, rnd() < 0.5 ? 100 : 50, Math.round((400 + rnd() * 1400) * 100) / 100,
        ['ofertada', 'concedida'].includes(st) ? (rnd() < 0.6 ? 100 : 50) : null, st, JSON.stringify(chk), new Date().toISOString());
    }
  });
}

const tituloNome = (s) => String(s || '').toLowerCase().replace(/(^|\s)(\S)/g, (m, a, b) => a + b.toUpperCase());

// Etapa 3: conferência de boletos, protocolo de entrega, mutirão de fotos, autorizações de saída,
// tarefas do dia, lembretes do calendário e atendimentos (tudo fictício)
function gerarDemoEtapa3(db, ano, transacao) {
  let semente = 31415;
  const rnd = () => { semente = (semente * 1103515245 + 12345) % 2147483648; return semente / 2147483648; };
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const alunos = db.prepare('SELECT * FROM alunos WHERE demo = 1 AND ativo = 1').all();
  if (!alunos.length) return;
  const hoje = new Date();
  const iso = (d) => d.toLocaleDateString('sv-SE');
  const diasAtras = (n) => { const d = new Date(hoje); d.setDate(d.getDate() - n); return iso(d); };
  const agora = hoje.toISOString();
  const cel = () => `(11) 9${String(Math.floor(rnd() * 90000000) + 10000000).replace(/(\d{4})(\d{4})/, '$1-$2')}`;
  const rg = () => `${20 + Math.floor(rnd() * 30)}.${String(Math.floor(rnd() * 900) + 100)}.${String(Math.floor(rnd() * 900) + 100)}-${Math.floor(rnd() * 10)}`;
  const matriculados = db.prepare(`SELECT a.id FROM alunos a JOIN rematriculas r ON r.aluno_id = a.id AND r.ano = ?
    WHERE a.demo = 1 AND a.ativo = 1 AND r.status IN ('reservada','concluida')`).all(ano).map((x) => x.id);

  const PARENTESCOS = ['Avó', 'Avô', 'Tia', 'Tio', 'Madrinha', 'Padrinho', 'Irmã maior de idade', 'Vizinha de confiança'];
  const ASSUNTOS = [
    ['Segunda via do boleto', 'Financeiro / boletos'], ['Declaração de escolaridade', 'Documentos e declarações'],
    ['Dúvida sobre a rematrícula', 'Matrícula / rematrícula'], ['Inscrição no ballet', 'Atividades extras'],
    ['Recarga do Lanche Card', 'Lanche Card'], ['Avisou que a avó vai buscar hoje', 'Saída / portão'],
    ['Entrega de documentos que faltavam', 'Matrícula / rematrícula'], ['Requerimento de bolsa', 'Bolsa (CEBAS)'],
    ['Pedido de histórico escolar', 'Documentos e declarações'], ['Passe escolar (SPTRANS)', 'Transporte escolar'],
    ['Reclamação sobre o horário do futsal', 'Atividades extras'], ['Conversa com a coordenação', 'Pedagógico'],
  ];

  transacao(() => {
    // Quem sai sozinho e quem pode buscar
    const insCfg = db.prepare('INSERT INTO saida_config (aluno_id, sai_sozinho, termo_em, transporte, atualizado_em, atualizado_por) VALUES (?,?,?,?,?,?)');
    const insAut = db.prepare('INSERT INTO saida_autorizados (aluno_id, nome, parentesco, documento, telefone, criado_em, criado_por) VALUES (?,?,?,?,?,?,?)');
    for (const a of alunos) {
      const grande = /^(F[6-9]|EM)/.test(a.serie_chave || '');
      const sozinho = grande && rnd() < 0.55;
      insCfg.run(a.id, sozinho ? 1 : 0, sozinho ? diasAtras(30 + Math.floor(rnd() * 200)) : null,
        rnd() < 0.15 ? 'Van escolar' : null, agora, 'demo');
      const sobre = a.nome.split(' ').slice(1).join(' ') || 'SANTOS';
      const qtd = sozinho ? (rnd() < 0.5 ? 1 : 0) : 1 + Math.floor(rnd() * 3);
      for (let i = 0; i < qtd; i++) insAut.run(a.id, `${pick([...MAES, ...PAIS]).toUpperCase()} ${sobre}`, pick(PARENTESCOS), 'RG ' + rg(), cel(), agora, 'demo');
    }
    // Avisos de saída de hoje ("hoje quem busca é outra pessoa")
    const insAviso = db.prepare(`INSERT INTO saida_avisos (aluno_id, data, quem, parentesco, documento, canal, quem_avisou, horario, obs, conferido_em, conferido_por, criado_em, criado_por)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'demo')`);
    for (let i = 0; i < 6; i++) {
      const a = pick(alunos);
      const conferido = rnd() < 0.35;
      insAviso.run(a.id, iso(hoje), `${pick([...MAES, ...PAIS]).toUpperCase()} ${pick(SOBRENOMES).toUpperCase()}`, pick(PARENTESCOS), 'RG ' + rg(),
        pick(['whatsapp', 'whatsapp', 'presencial', 'bilhete']), tituloNome((a.nome_mae || 'A mãe').split(' ')[0]),
        pick(['17:30', '18:00', '12:35', '13:20']), rnd() < 0.3 ? 'Mãe em consulta médica' : null,
        conferido ? agora : null, conferido ? 'demo' : null, agora);
    }
    // Mutirão de fotos: uns sem foto, uns só em parte dos sistemas
    const insFoto = db.prepare('INSERT INTO fotos_status (aluno_id, tirada, data_foto, acadesc, sed, lanche, atualizado_em, atualizado_por) VALUES (?,?,?,?,?,?,?,?)');
    for (const a of alunos) {
      const x = rnd();
      if (x < 0.22) continue; // ainda sem foto
      const completo = x > 0.55;
      insFoto.run(a.id, 1, diasAtras(Math.floor(rnd() * 180)), completo || rnd() < 0.8 ? 1 : 0,
        completo ? 1 : rnd() < 0.5 ? 1 : 0, completo ? 1 : rnd() < 0.35 ? 1 : 0, agora, 'demo');
    }
    // Conferência de descontos e protocolo de entrega dos boletos
    const insConf = db.prepare('INSERT INTO boletos_conf (aluno_id, ano, conferido, lancado, desconto_acadesc, obs, atualizado_em, atualizado_por) VALUES (?,?,?,?,?,?,?,?)');
    for (const id of matriculados) {
      const x = rnd();
      if (x > 0.45) continue;
      insConf.run(id, ano, 1, x < 0.3 ? 1 : 0, x < 0.04 ? 50 : null, x < 0.04 ? 'Conferir com a Samara: no ACADESC está 50%.' : null, agora, 'demo');
    }
    const rem = db.prepare('INSERT INTO remessas (nome, ano, referencia, obs, criado_em, criado_por, demo) VALUES (?,?,?,?,?,?,1)')
      .run(`Boletos ${ano} — massa anual`, ano, `Mensalidades de ${ano}`, 'Remessa fictícia da demonstração', agora, 'demo');
    const insEnt = db.prepare('INSERT INTO remessa_entregas (remessa_id, aluno_id, entregue_em, recebido_por, canal, usuario) VALUES (?,?,?,?,?,?)');
    for (const id of matriculados) {
      if (rnd() > 0.4) continue;
      const a = alunos.find((x) => x.id === id);
      insEnt.run(Number(rem.lastInsertRowid), id, diasAtras(Math.floor(rnd() * 15)),
        tituloNome(a.nome_resp || a.nome_mae || a.nome_pai || 'Responsável'), pick(['balcao', 'balcao', 'aluno', 'portao']), 'demo');
    }
    // Atendimentos dos últimos dias
    const insAt = db.prepare(`INSERT INTO atendimentos (data, hora, canal, aluno_id, pessoa, telefone, assunto, categoria, detalhe, resolvido, encaminhado, criado_em, usuario, demo)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,1)`);
    for (let i = 0; i < 34; i++) {
      const a = pick(alunos);
      const [assunto, categoria] = pick(ASSUNTOS);
      const resolvido = rnd() < 0.82;
      insAt.run(diasAtras(Math.floor(rnd() * 18)), `${9 + Math.floor(rnd() * 9)}:${pick(['05', '15', '30', '40', '50'])}`,
        pick(['balcao', 'balcao', 'telefone', 'whatsapp', 'whatsapp']), a.id,
        tituloNome(a.nome_resp || a.nome_mae || a.nome_pai || ''), a.cel_mae || cel(), assunto, categoria,
        rnd() < 0.4 ? 'Atendimento fictício da demonstração.' : null, resolvido ? 1 : 0,
        resolvido ? null : pick(['Samara', 'Direção', 'Financeiro']), agora, pick(['kevin', 'duda', 'samara']));
    }
    // Tarefas avulsas de hoje, cronograma em andamento e lembretes já concluídos
    const insTd = db.prepare('INSERT INTO tarefas_dia (data, responsavel, titulo, feito, criado_em, criado_por, demo) VALUES (?,?,?,?,?,?,1)');
    [['kevin', 'Digitalizar os contratos que chegaram ontem', 0], ['kevin', 'Levar a lista de saída atualizada para o portão', 1],
      ['duda', 'Conferir as baixas do banco de terça', 0], ['samara', 'Ligar para a Diretoria de Ensino sobre o Educacenso', 0]]
      .forEach(([resp, tit, feito]) => insTd.run(iso(hoje), resp, tit, feito, agora, 'demo'));
    const insRf = db.prepare('INSERT INTO rotina_feito (tarefa_id, data, feito, quando, usuario) VALUES (?,?,1,?,?)');
    for (const t of db.prepare('SELECT id FROM rotina_tarefas WHERE ativo = 1').all()) if (rnd() < 0.35) insRf.run(t.id, iso(hoje), agora, 'demo');
    const insCf = db.prepare('INSERT INTO calendario_feito (item_id, ano, feito_em, usuario) VALUES (?,?,?,?)');
    const mesAtual = hoje.getMonth() + 1;
    for (const i of db.prepare('SELECT id, mes FROM calendario WHERE ativo = 1').all()) {
      if (i.mes < mesAtual && rnd() < 0.75) insCf.run(i.id, hoje.getFullYear(), diasAtras(20 + Math.floor(rnd() * 120)), 'demo');
    }
  });
}

module.exports = { gerarDemo, gerarDemoEtapa2, gerarDemoEtapa3 };

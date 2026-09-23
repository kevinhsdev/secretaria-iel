// Contrato de atividade extra a partir do modelo "Contrato Atividade Extra 2026.xlsx".
// Planilha1 busca o aluno pela matrícula (C10) na Planilha3 e a atividade pela opção em Planilha2!A13.
'use strict';
const path = require('path');
const { abrirModelo, definirCelula, linhaXml } = require('./contrato');
const { isoParaSerial } = require('./planilha');
const S = require('./series');

const MODELO = path.join(__dirname, '..', 'modelos', 'contrato-atividade-extra.xlsx');

function gerarContratoExtra(aluno, atividade, insc) {
  const m = abrirModelo(MODELO);
  const pl1 = m.aba('Planilha1'), pl2 = m.aba('Planilha2'), pl3 = m.aba('Planilha3');
  const serie = S.porChave(aluno.serie_chave);

  // Planilha3: só este aluno (mesmas colunas da exportação do ACADESC)
  m.substituirLinhas(pl3, 1, linhaXml(2, [
    Number(aluno.mat) || aluno.mat || '', aluno.nome, serie ? `${serie.rotulo}${aluno.turma ? ' ' + aluno.turma : ''}` : '',
    aluno.nome_resp || aluno.nome_mae || aluno.nome_pai || '', aluno.tel_resp || aluno.cel_mae || aluno.cel_pai || '',
    aluno.cpf_resp || '', aluno.rg_resp || '', aluno.endereco || '', aluno.bairro || '', aluno.cidade || '', aluno.uf || '',
    aluno.cep || '', isoParaSerial(aluno.dt_nasc) ?? '',
  ]), 'M');

  // Planilha2: a opção 2 passa a ser a atividade do contrato
  let p2 = m.txt(pl2);
  const valor = insc.valor_parcela ?? atividade.valor ?? '';
  [['B2', atividade.nome], ['C2', atividade.publico || ''], ['D2', atividade.dias || ''], ['E2', atividade.horario || ''],
    ['F2', valor === '' ? '' : Number(valor)], ['G2', atividade.professor || ''], ['A13', 2]].forEach(([ref, v]) => { p2 = definirCelula(p2, ref, v); });
  m.z.set(pl2, Buffer.from(p2, 'utf8'));

  // Planilha1: matrícula, atividade, professor, parcelas e vencimentos
  let p1 = m.txt(pl1);
  const ultimoVenc = insc.primeiro_venc && insc.parcelas ? (() => {
    const d = new Date(insc.primeiro_venc + 'T12:00:00'); d.setMonth(d.getMonth() + insc.parcelas - 1); return d.toLocaleDateString('sv-SE');
  })() : null;
  [['C10', Number(aluno.mat) || aluno.mat], ['C30', atividade.nome], ['AR30', atividade.professor || ''], ['K4', insc.ano],
    ['N36', insc.parcelas ?? ''], ['AG36', isoParaSerial(insc.primeiro_venc) ?? ''], ['AR36', isoParaSerial(ultimoVenc) ?? '']]
    .forEach(([ref, v]) => { p1 = definirCelula(p1, ref, v); });
  m.z.set(pl1, Buffer.from(p1, 'utf8'));

  // Ano no texto da cláusula I ("período letivo de 2026")
  if (m.z.has('xl/sharedStrings.xml')) {
    const ss = m.txt('xl/sharedStrings.xml').replace(/(período\s+letivo\s+de\s+)\d{4}/g, `$1${insc.ano}`);
    m.z.set('xl/sharedStrings.xml', Buffer.from(ss, 'utf8'));
  }
  return m.finalizar();
}

module.exports = { gerarContratoExtra };

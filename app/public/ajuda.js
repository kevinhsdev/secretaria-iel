// Secretaria IEL — Ajuda dentro de cada tela (botão "? Ajuda" na barra de cima ou a tecla ?)
// Escrita para quem chega na secretaria sem conhecer o sistema: para que serve, passo a passo e cuidados.
// Ao criar uma tela nova, acrescente a ajuda dela aqui (a chave é a rota: #/rota).
'use strict';

const AJUDA = {
  '': {
    nome: 'Início',
    serve: 'Resumo do dia e da campanha de matrícula. Cada número é um link: clique para abrir a tela onde aquilo se resolve.',
    passos: [
      'Olhe primeiro o bloco "Para hoje": suas tarefas, quem vem buscar aluno, atendimentos em aberto e lembretes do mês.',
      'Use os atalhos para o que mais se faz no balcão: registrar atendimento, consultar o portão, emitir documento.',
      'No bloco da matrícula, os documentos vencidos aparecem primeiro. "Ver todas as pendências" mostra a lista por turma.',
    ],
    dicas: ['Vermelho = tem algo esperando. Verde = em dia.', 'A faixa amarela no topo aparece quando falta cópia de segurança ou ficou uma janela sem salvar.'],
  },
  hoje: {
    nome: 'Meu dia',
    serve: 'As tarefas de cada pessoa no dia, conforme a rotina da secretaria, mais os avisos do portão e os lembretes do mês.',
    passos: [
      'Marque cada tarefa quando terminar. Fica registrado quem fez.',
      'Apareceu algo fora da rotina? "+ Tarefa do dia" anota só para aquele dia.',
      'Troque a data no alto para ver ou marcar outro dia.',
    ],
    dicas: ['A administração muda o cronograma da semana em "Editar o cronograma".', 'Tarefa do dia excluída vai para a Lixeira e pode voltar.'],
  },
  alunos: {
    nome: 'Alunos',
    serve: 'Lista de todos os alunos ativos, com filtros por turma, situação da rematrícula e alunos novos.',
    passos: ['Digite parte do nome, da mãe, da matrícula ou do CPF para filtrar.', 'Clique no aluno para abrir a ficha completa.', '"+ Cadastrar aluno novo" serve para quem está entrando na escola.'],
    dicas: ['Os alunos vêm da importação do ACADESC (Configurações › Importar dados). Corrija no ACADESC e importe de novo sempre que puder.'],
  },
  aluno: {
    nome: 'Ficha do aluno',
    serve: 'Tudo sobre um aluno num lugar só: rematrícula, documentos, contatos, saída, fotos, atendimentos e histórico.',
    passos: [
      'Rematrícula: clique na situação (Não iniciada, Em andamento, Concluída…). A data da matrícula e o prazo de documentos aparecem sozinhos.',
      'Documentos: marque o que a família entregou. Os PDFs da pasta de prontuário aparecem como conferidos.',
      'Botões do alto: WhatsApp com mensagem pronta, abrir a pasta do aluno, gerar o contrato e editar os dados.',
    ],
    dicas: ['Se outra pessoa alterar a ficha enquanto você edita, o sistema avisa antes de salvar.', 'Abrir a ficha fica registrado (LGPD): abra só quando precisar.'],
  },
  rematricula: {
    nome: 'Rematrícula',
    serve: 'Andamento da rematrícula por série do ano que vem, com vagas ocupadas e quem falta contatar.',
    passos: ['Clique numa série para ver os alunos dela.', 'Mude a situação direto na lista, sem abrir a ficha.', 'Para lembrar uma família que ainda não começou, abra a ficha do aluno e use o botão WhatsApp.'],
    dicas: ['As vagas por série são definidas em Configurações › Vagas.'],
  },
  pendencias: {
    nome: 'Pendências de documentos',
    serve: 'Quem já se matriculou e ainda não entregou todos os documentos obrigatórios, turma por turma.',
    passos: ['Filtre por turma ou por situação (vencida, vencendo, no prazo).', 'Imprima a lista da turma para cobrar na saída.', 'O botão de WhatsApp já monta a mensagem com os documentos que faltam.'],
    dicas: ['O prazo é contado a partir da data da matrícula (Configurações › Geral).', 'Documento marcado como obrigatório sem necessidade gera pendência para todo mundo: confira em Configurações › Documentos.'],
  },
  interessados: {
    nome: 'Interessados (SIG)',
    serve: 'Famílias que procuraram a escola e ainda não matricularam: do primeiro contato até a matrícula.',
    passos: ['Importe a planilha "Cadastros_SIG" ou cadastre à mão em "+ Novo contato".', 'Mude a situação conforme o contato avança: contatado, visita agendada, matriculado.', 'Anote a data do último contato para não esquecer ninguém.'],
    dicas: ['Contato excluído vai para a Lixeira.'],
  },
  documentos: {
    nome: 'Documentos',
    serve: 'Declarações, termos, carteirinhas, livro ponto e listas com 1 clique, no papel timbrado da OASE.',
    passos: ['Escolha o documento e o aluno.', 'Confira e corrija os campos à esquerda — dá para mudar qualquer texto antes de imprimir.', 'Imprima. A emissão fica registrada no histórico do aluno.'],
    dicas: ['A declaração de pagamento lê a "Consulta Pagamentos" exportada do ACADESC.', 'A busca de cima também acha documentos já emitidos.'],
  },
  extras: {
    nome: 'Atividades extras',
    serve: 'Inscrições em ballet, judô, futsal e outras atividades, com parcelas, contrato, cancelamento, lista de chamada e ingressos de eventos.',
    passos: ['Aba Inscrições: inscreva o aluno. As parcelas vão do mês da inscrição até novembro, com vencimento no dia 10.', 'Gere o contrato da atividade pelo botão da linha.', 'Para cancelar, use o termo de cancelamento (não exclua).', 'Aba Ingressos e eventos: quantidade por aluno e registro de retirada.'],
    dicas: ['Valores e horários das atividades ficam na aba "Atividades e valores".'],
  },
  bolsas: {
    nome: 'Bolsas (CEBAS)',
    serve: 'Processos de bolsa de estudo, do requerimento até a concessão, com o checklist do edital. Só a administração vê.',
    passos: ['Importe a "Planilha Bolsas" ou abra um processo novo.', 'Marque os documentos entregues no checklist.', 'Avance a etapa: conferido, assistente social, visita, ofertada, concedida.'],
    dicas: ['São dados socioeconômicos (LGPD): não tire print desta tela nem mande por WhatsApp.', 'O percentual aprovado entra na conferência de descontos dos boletos.'],
  },
  boletos: {
    nome: 'Boletos',
    serve: 'Conferir os descontos antes da massa de boletos e registrar a entrega dos boletos em papel.',
    passos: ['Conferência (POP 5.3): para cada aluno, veja o desconto esperado (filho de funcionário, bolsa ou atividade extra) e compare com o do ACADESC.', 'Marque "conferido" e depois "lançado" quando corrigir no ACADESC.', 'Entrega: crie uma remessa, marque quem recebeu e imprima a folha de assinatura por turma.'],
    dicas: ['Os descontos não somam: vale o maior.', 'Bolsa só ofertada aparece com aviso "confirme antes de lançar".'],
  },
  fotos: {
    nome: 'Mutirão de fotos',
    serve: 'Quem ainda está sem foto no ACADESC, na SED e no Lanche Card.',
    passos: ['Filtre a turma do dia do mutirão.', 'Depois de colocar a foto em cada sistema, marque a caixa correspondente (dá para marcar a turma toda de uma vez).', 'Imprima a folha de controle para levar à sala.'],
    dicas: ['Marcar qualquer sistema já conta como foto tirada.'],
  },
  portao: {
    nome: 'Portão · Saída',
    serve: 'Quem pode buscar cada aluno e os avisos do dia ("hoje quem busca é a avó"). Serve também no celular, no portão.',
    passos: ['Digite o nome do aluno na consulta rápida.', 'Confira o documento de quem veio buscar com a lista de autorizados.', 'Aviso do dia: registre quem avisou, como avisou e o horário.', 'Na saída, clique em "Liberar saída": fica registrado quem conferiu.'],
    dicas: ['Aviso só por telefone é recusado, como diz o termo de saída. Exceções pedem confirmação.', 'Na dúvida, não libere: chame a coordenação.'],
  },
  atendimentos: {
    nome: 'Atendimentos',
    serve: 'Registro de quem procurou a secretaria (balcão, telefone, WhatsApp, e-mail), o que precisava e se ficou resolvido.',
    passos: ['Logo depois de atender, clique em "+ Registrar atendimento".', 'Se não resolveu na hora, desmarque "Ficou resolvido" e diga com quem ficou e até quando retornar.', 'Quando resolver, clique em "Resolvido" na linha.'],
    dicas: ['Em um mês, isto vira o retrato do que mais toma o tempo da secretaria (aparece nos Relatórios).'],
  },
  calendario: {
    nome: 'Calendário da secretaria',
    serve: 'Os lembretes do ano, mês a mês: o que precisa ser feito em cada época (Educacenso, massa de boletos, rematrícula…).',
    passos: ['Veja o mês atual em destaque e os atrasados em vermelho.', 'Marque como feito quando concluir. A marcação vale só para aquele ano.'],
    dicas: ['A administração pode criar e mudar lembretes.'],
  },
  relatorios: {
    nome: 'Relatórios',
    serve: 'Os números do ano (alunos, rematrícula, atendimentos, financeiro, bolsas, fotos, saída e equipe) para a Samara e a Direção.',
    passos: ['Escolha o ano.', 'Use "Versão para imprimir" para levar uma folha timbrada à reunião.'],
    dicas: [],
  },
  mensagens: {
    nome: 'Mensagens',
    serve: 'Textos prontos para WhatsApp e e-mail, com campos que se preenchem sozinhos.',
    passos: ['Crie ou edite um modelo.', 'Use os campos {aluno} {responsavel} {serie} {serie_destino} {documentos} {prazo} no texto.', 'O modelo aparece para escolher quando você clica em WhatsApp numa ficha ou lista.'],
    dicas: ['O sistema não manda mensagem sozinho: ele abre o WhatsApp com o texto pronto e você confere antes de enviar.'],
  },
  lixeira: {
    nome: 'Lixeira',
    serve: 'O que foi excluído fica aqui por 30 dias e pode voltar com um clique. Depois disso, some de vez.',
    passos: ['Procure pelo nome ou filtre pelo tipo.', 'Clique em "Restaurar": volta exatamente como era, no mesmo lugar.'],
    dicas: ['Logo depois de excluir, o botão "Desfazer" da mensagem faz a mesma coisa.', 'A aprendiz vê só o que ela mesma excluiu.'],
  },
  config: {
    nome: 'Configurações',
    serve: 'Datas da campanha, pastas, documentos obrigatórios, vagas, usuários, importação do ACADESC, cópias de segurança, atualizações e LGPD.',
    passos: [
      'Importar dados: exporte do ACADESC em Excel e envie aqui (alunos, responsáveis, pagamentos).',
      'Cópias de segurança: aponte a pasta para um pen drive ou o OneDrive, defina a senha e teste uma restauração.',
      'Atualizações: "Verificar atualizações" mostra o que mudou, faz cópia antes e reinicia sozinho.',
      'LGPD e acessos: relatório dos dados de um aluno para a família e descarte de ex-alunos.',
    ],
    dicas: ['Só a administração vê esta área.', 'Backup que nunca foi restaurado não é backup: faça o teste de restauração pelo menos uma vez.'],
  },
};

function janelaAjuda(rota) {
  const a = AJUDA[rota] || AJUDA[''];
  const outras = Object.entries(AJUDA).filter(([k]) => k !== 'aluno' && (EU.perfil === 'admin' || !['bolsas', 'config', 'relatorios'].includes(k)));
  modal('Ajuda · ' + a.nome, `<div class="ajuda">
    <p class="ajuda-serve">${esc(a.serve)}</p>
    <h3>Passo a passo</h3><ol>${a.passos.map((p) => `<li>${esc(p)}</li>`).join('')}</ol>
    ${a.dicas.length ? `<h3>Cuidados e dicas</h3><ul>${a.dicas.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>` : ''}
    <p class="dado" style="margin-top:14px">Atalhos: <kbd>/</kbd> busca em tudo · <kbd>?</kbd> abre esta ajuda · <kbd>Esc</kbd> fecha janelas.</p>
    <div class="rodape" style="justify-content:space-between"><label class="dado">Ajuda de outra tela:
      <select id="ajOutra"><option value=""></option>${outras.map(([k, v]) => `<option value="${k}">${esc(v.nome)}</option>`).join('')}</select></label>
      <button class="btn pri" data-fechar>Entendi</button></div></div>`,
  { onAbrir: (el, fechar) => { $('#ajOutra', el).onchange = (e) => { if (e.target.value === '') return; fechar(); janelaAjuda(e.target.value); }; } });
}

function rotaAtual() { return location.hash.replace(/^#\/?/, '').split('?')[0].split('/')[0]; }

// Botão na barra de cima e a tecla "?" (quando não se está digitando)
window.ligarAjuda = () => {
  const b = $('#ajuda');
  if (b) b.onclick = () => janelaAjuda(rotaAtual());
  if (window.__ajudaTecla) return;
  window.__ajudaTecla = true;
  document.addEventListener('keydown', (e) => {
    if (e.key !== '?' || e.ctrlKey || e.altKey || e.metaKey) return;
    const alvo = e.target;
    if (alvo.isContentEditable || (alvo.matches && alvo.matches('input, textarea, select'))) return;
    if ($('.fundo-modal') || !EU) return;
    e.preventDefault(); janelaAjuda(rotaAtual());
  });
};

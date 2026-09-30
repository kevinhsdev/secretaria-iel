# HANDOFF — Secretaria IEL

> Documento de passagem para continuar o projeto em outro computador ou em outro chat.
> Última atualização: **29/09/2026**, versão **5.8.5** (Etapa 4 + início, lixeira, busca global, queda do servidor, edição simultânea, ajuda, desempenho, **histórico escolar e vivências**, **visual premium**, **visual novo 5.0**, **importar boletim e matriz curricular**). O que vem a seguir está em §7.

---

## 1. Quem, onde e por quê

- **Usuário:** Kevin, jovem aprendiz da secretaria do **Instituto Educacional Luterano (IE Luterano / IEL)**, escola mantida pela **OASE — Ordem Auxiliadora das Senhoras Evangélicas**.
  - Endereço: Rua Herman Teles Ribeiro, 162, Centro, Ferraz de Vasconcelos/SP, CEP 08529-100. Fone (11) 4678-1461. INEP 126640.
  - Diretoria de Ensino de Suzano.
  - Kevin trabalha à tarde (13h–19h) e não vai às sextas. Escreve em **português (pt-BR)**, e as respostas devem ser em pt-BR.
- **Equipe da secretaria:**
  - **Samara** (secretária; decide e aprova).
  - **Maria Eduarda "Duda"** (aprendiz da manhã; financeiro, baixas e boletos; não vai às quintas).
  - **Kevin** (aprendiz da tarde; portão, digitalização, prontuário, fotos, Lanche Card).
  - Diretora pedagógica: **Carina Buller**.
- **Escola:** cerca de 535 alunos, do Maternal à 3ª série do EM.
  - Infantil: tarde, 13h–17h30.
  - Fund. I: tarde, 13h30–18h.
  - Fund. II: manhã, 7h–12h35.
  - EM: manhã, 7h–13h20.
- **Sistemas que a escola usa:**
  - **ACADESC**: gestão acadêmica e financeira, desktop, com banco MySQL. Ainda não se sabe se há acesso ao banco, então o app **importa as exportações em Excel**.
  - SED (Secretaria Escolar Digital), SIG (primeiro contato das famílias), SPTRANS/EMTU, Lanche Card (cantina), Educacenso.
  - Muitas planilhas Excel e documentos Word.
- **Objetivo:** um app para **facilitar a vida da secretaria**, trocando planilhas e documentos Word avulsos por um sistema único.

## 2. Decisões já tomadas (não reabrir)

| Tema | Decisão |
|---|---|
| Plataforma | App **web local**. Um PC da secretaria é o servidor e os outros acessam pelo navegador. Hoje roda em 1 PC; a meta é 3 PCs. |
| Tecnologia | **Node.js portátil**, sem npm e sem dependências externas. **node:sqlite** embutido. Front-end em **HTML/CSS/JS puro**. Funciona sem internet. |
| Usuários | Só a secretaria. **Login por pessoa + perfis**: `admin` (Samara, Kevin) e `aprendiz` (Duda). O admin acessa configurações, importação, auditoria, CEBAS e declaração de pagamento. |
| ACADESC | **Importar exportações .xlsx** (formatos já mapeados, ver §5). Ler o MySQL direto só se a TI liberar. |
| Entrega | **Por etapas**, cada uma testada antes da próxima. |
| Visual | **Menu lateral azul** (#0e3d7a) com detalhes **amarelos** (#f5c21b); logo em `app/public/logo.png`. Tem **modo claro e escuro** (ver §4). |
| LGPD | Dados reais de menores **nunca** vão para o GitHub. Testes usam **dados fictícios** ("Carregar demonstração") ou leitura **só em memória**. |
| Aprovação | Projeto pessoal do Kevin por enquanto, ainda **sem aprovação da Samara ou da Diretoria**. |

## 3. O que já existe

### Etapa 1 (pronta): matrícula e rematrícula 2027
- **Painel:** placar da rematrícula, documentos vencidos ou vencendo e datas da campanha.
  - Início 24/09/2026, desconto até 07/11, garantia de vaga até 04/12, fim 22/01/2027.
- **Alunos:** lista, busca global (nome, mãe, pai, matrícula, CPF) e cadastro de aluno novo.
- **Ficha do aluno:**
  - status da rematrícula: `pendente`, `reservada` (em andamento), `concluida`, `nao_renova`, `transferido`
  - série do próximo ano calculada sozinha (a progressão fica em `lib/series.js`)
  - data da matrícula e prazo de **30 dias** para documentos
  - checklist de documentos
  - conferência dos PDFs na pasta de prontuários, com os nomes do "PDF Renamer"
  - botões: WhatsApp, Abrir pasta, Gerar contrato 2027
- **Contrato 2027** gerado a partir do modelo oficial `.xlsx`: a matrícula vai em BF2 e os PROCV buscam na aba Planilha1, que fica só com aquele aluno.
- **Rematrícula** por série de destino, com vagas. **Pendências** por turma, imprimível, com botão de WhatsApp. **Interessados (SIG)** com funil e importação da planilha `Cadastros_SIG`.
- **Modelos de mensagem** com campos `{aluno} {responsavel} {serie} {serie_destino} {documentos} {prazo}`.
- **Configurações:** datas, prazo, pasta de prontuários, vagas, tipos de documento, usuários, importação do ACADESC, dados de demonstração e auditoria.

### Etapa 2 (pronta): documentos, atividades extras e CEBAS
- **Documentos com 1 clique** (`public/doc.html` + `doc.js`): A4 com o papel timbrado da OASE, campos editáveis à esquerda, e cada emissão fica registrada.
  - Declarações: escolaridade, vaga, transferência, conclusão, comparecimento e **pagamento** (lê a "Consulta Pagamentos" do ACADESC e escreve o valor por extenso).
  - Termos: cancelamento de matrícula, de atividade extra e de bolsa; autorização de saída sem o responsável.
  - **Carteirinha olímpica**: 8 por folha, com foto localizada pela matrícula.
  - **Livro ponto**: fins de semana e feriados marcados sozinhos.
  - Lista de chamada e lista de retirada de ingressos.
  - Os textos seguem os modelos Word da escola (pasta "ADM Luterano").
- **Atividades extras:**
  - Cadastro de atividades com público, dias, horário, valor, professor e vagas.
  - **Inscrição:** parcelas do mês da inscrição até novembro, vencimento dia 10 (regra da planilha da escola).
  - **Contrato de atividade extra** gerado pelo modelo oficial.
  - Cancelamento com termo, reativação, lista de chamada.
  - **Eventos e ingressos**: apresentação do balé, com quantidade, retirada e limite por aluno.
- **Bolsas (CEBAS)**, só para admin:
  - etapas: inscrito → conferido → assistente → visita → ofertada → concedida / indeferida / sem_oferta / desistiu
  - checklist do edital 2027
  - importação da "Planilha Bolsas" (Ofertado 1 = 100%, 0,5 = 50%)
- **Importação ampliada:** aceita também a exportação de **responsáveis** do ACADESC (DescClasse, cpfresp, RGResp, Endereco, Bairro, Cidade, Estado, CEP). Com ela, o contrato 2027 passa a sair com endereço, CPF e RG.

### Etapa 3 (pronta): boletos, fotos, saída, rotina, calendário e atendimentos
- **Boletos** (`rotas/boletos.js`, menu *Boletos*), aberto também para a aprendiz:
  - ~~**Conferência de descontos**~~ (POP 5.3) — **tela retirada na 4.11.0** (código e dados mantidos): cruza **filhos de funcionários** (isentos, % configurável), **bolsas CEBAS**
    `ofertada`/`concedida` (usa `aprovado`, senão `ofertado`) e **atividades extras** do ano e do ano anterior.
    Regra adotada: **os descontos não somam, vale o maior**. Cada linha traz o desconto esperado, a origem, as extras,
    o campo "% no ACADESC" (acusa divergência), e as marcas **conferido** e **lançado**. Tem marcação em lote e lista imprimível.
  - **Protocolo de entrega**: *remessas* de boletos; por turma, marca quem recebeu, quando, como e quem retirou.
    Imprime uma folha de assinatura por turma.
- **Mutirão de fotos** (`rotas/fotos.js`): lista quem não tem foto e o checklist dos **3 sistemas** (ACADESC, SED, Lanche Card),
  com marcação em lote por turma e folha de controle imprimível. Marcar qualquer sistema já considera a foto tirada.
  O arquivo encontrado por `lib/fotos.js` é só uma pista: sem a pasta (fora do PC da escola) tudo continua funcionando na marcação manual.
- **Autorização de saída** (`rotas/saida.js`, menu *Portão · Saída*):
  - por aluno: **sai sozinho** (com data do termo), transporte e a lista de **quem pode buscar** (nome, parentesco, documento, telefone);
  - **avisos do dia** ("hoje quem busca é outra pessoa") com canal, quem avisou e horário; no portão, o botão **Liberar saída** grava quem conferiu;
  - **aviso só por telefone é recusado** (regra do termo), com confirmação explícita para casos excepcionais (`saida_aviso_telefone`);
  - **consulta rápida do portão** por nome e lista imprimível por turma.
- **Tarefas do dia por pessoa** (`rotas/rotina.js`, menu *Meu dia*): cronograma semeado conforme a rotina da secretaria
  (seg–qua Samara/Duda/Kevin; quinta foco SED e Kevin sozinho; sexta fechamento e Duda sozinha), marcação por dia,
  tarefas avulsas e editor do cronograma (admin).
- **Calendário anual/sazonal**: 25 lembretes semeados (jan–dez), marcação **por ano**, aviso de atrasados e destaque do mês atual.
- **Registro de atendimentos**: balcão, telefone, WhatsApp e e-mail, com aluno opcional, assunto, categoria, se ficou resolvido
  e com quem ficou. Aparece também na ficha do aluno.
- **Ficha do aluno** ganhou os blocos de **saída**, **foto nos 3 sistemas** e **últimos atendimentos**; o **painel inicial**
  ganhou a faixa do dia; o menu ganhou contadores de tarefas e de avisos de saída.
- **Demonstração** (`lib/demo.js` → `gerarDemoEtapa3`): autorizações, avisos de hoje, fotos, conferência, uma remessa com entregas,
  34 atendimentos, tarefas do dia e lembretes concluídos.

### Etapa 4 (pronta): backup, segurança, LGPD, relatórios e acabamento
- **Cópias de segurança** (`lib/backup.js`, `rotas/backup.js`, Configurações › Cópias de segurança):
  - cópia a quente com `VACUUM INTO` (funciona com o sistema aberto e já inclui o WAL);
  - automática ao abrir e a cada N horas (`backup_horas`), guardando as N mais novas (`backup_manter`);
  - **pasta configurável** (`backup_pasta`) — a orientação é apontar para pen drive/OneDrive;
  - **senha opcional** (`backup_senha`): o arquivo sai cifrado em **AES-256-GCM** (marca `IELBK1` + sal + IV + tag);
  - **faixa de aviso** em qualquer tela quando o último backup passa de `backup_avisar_dias`;
  - **restauração** em duas etapas: o app decifra/valida, grava `RESTAURAR.db` + `RESTAURAR.pendente` e o
    `lib/db.js` faz a troca **na abertura seguinte**, guardando antes `antes-da-restauracao-<data>.db`;
  - `POST /api/admin/reiniciar` sai com **código 90** e o `.bat` sobe de novo sozinho (laço `:inicio`).
- **Segurança:** bloqueio de tela por inatividade (`bloqueio_minutos`) com senha no servidor (HTTP 423 enquanto bloqueada),
  política de senha (mínimo 8, recusa senhas óbvias e o próprio login), cabeçalho **CSP** (`script-src 'self'`; por isso o
  tema saiu do HTML para `public/tema.js`) e segredos nunca enviados ao navegador (`cfgPublica()` + `CHAVES_SECRETAS`).
- **LGPD** (`rotas/lgpd.js`, Configurações › LGPD e acessos):
  - **registro de consultas**: abrir a ficha de um aluno grava em `acessos` (uma linha por pessoa/aluno/dia, com contagem);
  - **direito de acesso**: `GET /api/alunos/:id/dados-pessoais` reúne tudo o que o sistema guarda, com versão
    imprimível (documento `dados_aluno`) e download em JSON;
  - **descarte**: lista candidatos (nunca quem está matriculado) e anonimiza, apagando os dados pessoais e
    mantendo série/ano/situação para a estatística (`alunos.anonimizado`).
- **Relatórios** (`rotas/relatorios.js`, menu Relatórios, admin): números do ano em cartões e barrinhas
  (alunos, rematrícula, atendimentos, financeiro, bolsas, fotos, saída, equipe) e a **versão de uma folha com o
  papel timbrado** (documento `fechamento`) para levar à Samara e à Diretoria.
- **Atualização com um botão** (`lib/atualizacao.js`, `rotas/atualizacao.js`, Configurações › Atualizações):
  usa o **Git que já baixou o projeto** para ver se há versão nova no GitHub, mostrar **o que mudou** (assunto e data de
  cada commit), fazer **cópia de segurança antes**, aplicar com `git pull --ff-only` e **reiniciar sozinho**.
  Recusa atualizar se houver arquivo alterado na pasta (para não apagar o trabalho de alguém) e explica em português
  quando falta internet, quando o GitHub pede login (`GIT_TERMINAL_PROMPT=0`, sem travar esperando digitação) ou
  quando a pasta foi copiada à mão em vez de clonada.
- **Controle de versão** (`lib/versao.js` + `VERSAO` em `app.js`): se o navegador carregar telas novas enquanto a janela
  preta ainda roda o servidor antigo, aparece uma faixa vermelha explicando — antes isso dava "Rota não encontrada".
- **Acabamento:** ícones **SVG desenhados no próprio código** (`ICONES` em `app.js`) no lugar dos emojis do menu,
  esqueleto cinza no carregamento, telas vazias que explicam o próximo passo, **modo compacto** (mais linhas na tela),
  layout de celular para o portão e atalho `/` para a busca.

### Página inicial reorganizada (versão 4.2.0, 24/09/2026)
- A tela **Início** (`TELAS['']` em `app.js`) agora tem três blocos, na ordem em que a secretaria pensa:
  1. **Para hoje:** 4 cartões que são links — minhas tarefas (→ Meu dia), portão/quem busca hoje (→ Portão), atendimentos de hoje (→ Atendimentos) e lembretes do mês (→ Calendário). Verde quando está tudo em dia, vermelho quando tem algo esperando.
  2. **Atalhos:** registrar atendimento (abre a janela direto), consultar o portão, emitir documento, achar um aluno (foca a busca, tecla /) e cadastrar aluno novo.
  3. **Matrícula e rematrícula:** os mesmos números de antes, agora clicáveis; documentos vencidos limitados a **5** (com "faltam N documentos" em vez da lista inteira; a lista completa aparece ao passar o mouse); a **próxima data** da campanha fica destacada.
- A antiga faixa do dia (`window.painelEtapa3` em `etapa3.js`) **saiu**: o Início busca `/api/hoje` sozinho e, se falhar, mostra o resto da página.
- `/api/hoje` ganhou `lembretes_atrasados`. No celular os cartões ficam 2 por linha (`.grade.g4.kpis`).
- Teste novo `t-inicio` (navegador): confere os blocos, os 8 links, os atalhos abrindo as janelas certas e todas as telas do menu, como admin (35 ok) e como aprendiz (32 ok).

### Lixeira de 30 dias e "Desfazer" (versão 4.3.0, 24/09/2026)
- **Excluir não apaga na hora.** `lib/lixeira.js` guarda uma fotografia em JSON das linhas apagadas (e das linhas filhas que o
  `ON DELETE CASCADE` levaria junto) na tabela `lixeira`, e só então apaga. Restaurar insere de volta **com o mesmo id**,
  então links, histórico da ficha e auditoria continuam valendo. Usa só as colunas que ainda existem na tabela (sobrevive a migrações).
- Passam pela lixeira: atendimento, aviso de saída, pessoa autorizada a buscar, tarefa do dia, lembrete do calendário (com as
  marcações de feito), interessado (SIG), modelo de mensagem, remessa de boletos (com as entregas), processo de bolsa,
  inscrição em atividade extra, evento (com os ingressos) e feriado. **Ao criar um DELETE novo, use `L.excluir(...)`** (vem no `ctx`).
- **Não** passam pela lixeira, de propósito: o **descarte da LGPD** (é para valer, e apaga também o que estava na lixeira sobre
  aquele aluno), **apagar a demonstração** (leva junto os itens de demonstração da lixeira) e as cópias de segurança (são arquivos).
- **Desfazer:** toda exclusão responde `lixeira_id`; o `api()` do front percebe e a mensagem seguinte ("Excluído") ganha o botão
  **Desfazer** por 8 segundos. Se a tela não mostrar mensagem nenhuma, aparece uma sozinha.
- **Tela Lixeira** (menu Ferramentas, `public/lixeira.js`, rotas em `rotas/lixeira.js`): filtro por tipo e busca, **Restaurar**,
  e para a administração **Apagar de vez**, **Esvaziar** e o prazo. A aprendiz vê e restaura **só o que ela excluiu** (e nunca bolsas).
- Restaurar com conflito (alguém cadastrou de novo no mesmo lugar) ou com o aluno que não existe mais responde **409 em português**
  e não mexe em nada. A limpeza do que passou do prazo roda ao abrir e a cada 6 horas.
- O relatório de **dados do aluno (LGPD)** agora lista também o que dele está na lixeira (`na_lixeira`).
- Testes novos: `t-lixeira` (API, **93 ok**: os 12 tipos vão e voltam idênticos, entregas da remessa voltam juntas, conflito,
  restaurar duas vezes, permissões da aprendiz, prazo, auditoria, LGPD) e `t-lixeira-tela` (navegador, 12 ok para admin e aprendiz:
  excluir → Desfazer → excluir → restaurar pela tela). Migração conferida: banco sem a tabela `lixeira` recebe a tabela ao abrir, sem perder dados.

### Busca global (versão 4.4.0, 24/09/2026)
- O campo de cima (tecla `/`) procura em **tudo** (`rotas/busca.js`, `GET /api/busca?q=`): alunos (nome, mãe, pai, responsável,
  matrícula, CPF), quem pode buscar, avisos de saída, atendimentos, interessados do SIG, documentos emitidos e bolsas
  (**bolsas só para a administração**). Sem acento e sem maiúscula (comparação no JS com `S.norm`; o LIKE do SQLite não sabe).
  Números (CPF, telefone) casam só pelos dígitos. Até 6 por grupo, com "Ver todos os N →".
- `#/tela?q=texto` preenche o filtro da tela (`#fq`, ou `#q` em Alunos) — é assim que "Ver todos" e os resultados de
  atendimento/SIG/bolsa abrem a tela já filtrada (`rotear()` separa o `?`).
- Testes: `t-busca` (API, 11) e `t-busca-tela` (navegador, 9).

### Não perder o que foi digitado quando o servidor cai (versão 4.5.0)
- **Sessões no banco** (tabela `sessoes`, só o **hash** SHA-256 do token): reiniciar o servidor (atualização, restauração,
  queda) não desloga ninguém. A memória é cache; o banco só é gravado no login, no bloqueio/desbloqueio e a cada 10 min de uso.
  Redefinir a senha de alguém encerra as sessões dessa pessoa.
- **Servidor fora do ar:** o `api()` pega a falha de rede, mostra faixa vermelha fixa (`#semConexao`) e testa `GET /api/versao`
  (pública, só devolve a versão) a cada 4 s; quando volta, some e avisa. A janela aberta continua com tudo o que foi digitado.
- **Rascunho das janelas** (`ligarRascunho` em `modal()`): o que é digitado vai para o `sessionStorage` (some ao fechar o
  navegador — LGPD); fechar a janela normalmente apaga. Se a página recarregar, aparece a faixa "Ficou sem salvar" com o
  caminho de volta e, ao abrir a mesma janela, **"Recuperar o que foi digitado"**. Senhas e arquivos nunca são guardados.
  A chave é o título da janela; janelas "Confirmar" e "Ajuda" não têm rascunho.
- Teste: `t-conexao` (19): **derruba o servidor de verdade** com a janela aberta, confere a faixa, religa e salva; recarrega a
  página e recupera o rascunho; senha redefinida derruba a sessão.

### Aviso quando duas pessoas editam a mesma ficha (versão 4.6.0)
- `conferirVersao(atual, corpo, u)` no servidor (vai no `ctx`): a tela manda `_versao` (o `atualizado_em` que carregou); se
  outra pessoa gravou depois, responde **409** com `conflito: { por, em }`. `_forcar: true` grava mesmo assim.
- Vale para **aluno, atendimento, interessado e bolsa**. Colunas novas `atualizado_por` (alunos) e `atualizado_em/por`
  (atendimentos, interessados); a importação do ACADESC grava `atualizado_por = 'importacao'`.
- Na tela, `salvarComVersao(url, corpo, original)` manda **só os campos que a pessoa mudou**: se duas pessoas mexeram em campos
  diferentes, o trabalho das duas fica. No conflito, pergunta com nome e hora; desistir mantém a janela aberta.
- Ações de um clique (marcar documento, mudar situação na lista, "Resolvido") não passam por isso: são atômicas.
- Teste: `t-conflito` (17, inclusive a tela e a junção dos campos).

### Ajuda dentro de cada tela (versão 4.7.0)
- Botão **"? Ajuda"** na barra de cima e a tecla **?** (`public/ajuda.js`): para que serve a tela, passo a passo e cuidados,
  escrita para o próximo aprendiz. Tem ajuda própria para as 18 telas do menu e a ficha do aluno; dá para ver a de outra tela.
  A aprendiz não vê a ajuda de Bolsas, Relatórios e Configurações. **Tela nova = acrescentar a ajuda dela em `AJUDA`.**
- Teste: `t-ajuda` (45: toda tela do menu abre a ajuda certa, nos dois perfis).

### Desempenho com 535 alunos (versão 4.8.0)
- **Demonstração no tamanho real** (Configurações › Importar dados, ou `POST /api/admin/demo?tamanho=real`): ~530 alunos fictícios.
- Medido com 530 alunos: a API responde tudo em menos de 30 ms e nenhuma tela passa de 0,4 s. O problema era o **tamanho**:
  Rematrícula, Fotos e Boletos passavam de 29 mil px (30 telas de rolagem).
- `emPartes(tbody, linhas, { colunas, vazio, ligar })` em `app.js`: mostra 100 linhas, com "Mostrar mais 100" e "Mostrar todas".
  Redesenhar a mesma lista mantém o quanto estava aberto. **Na impressão sai tudo** (evento `beforeprint`). Usado em Alunos,
  Rematrícula, Conferência de boletos, Entrega de boletos e Mutirão de fotos.
- **Pendências**: com mais de 100 alunos, cada turma vira um bloco que abre e fecha (`details.turma-grupo`), com o resumo
  "(N · X vencidos)"; filtrar abre tudo; imprimir abre tudo.
- **Mutirão de fotos**: marcar uma caixa não recarrega mais a tela inteira (antes voltava ao topo a cada clique, impraticável com
  535 alunos); atualiza a linha com a mesma regra do servidor. Os cartões do alto se atualizam ao reabrir a tela.
- Depois: Rematrícula 30.568 → 6.665 px, Fotos 30.742 → 6.283, Boletos 29.085 → 10.088, Pendências 23.128 → 2.141, Alunos 20.982 → 4.263.
- Testes: `t-desempenho` (mede API e telas) e `t-partes` (18: mostrar mais/todas, filtro, impressão, fotos sem voltar ao topo, turmas).
- Migração conferida (4.4–4.8): banco sem `sessoes`, `lixeira` e as colunas `atualizado_*` recebe tudo ao abrir, sem perder dados.

### Histórico escolar e vivências (versão 4.9.0, 26/09/2026)
Pedido do Kevin: "os históricos são feitos à mão; queria uma aba onde coloco as notas e ele cria sozinho" e "uma aba de vivência
com quantos agendaram, quantos realizaram, o dia, o ano e se foi contatado". A escola controlava as vivências na planilha Google
"Controle de Vivência" (abas Registro de Vivências / Dashboard / Listas) — lida só na tela para copiar a estrutura; nenhum dado foi copiado.

- **Histórico escolar** (menu Secretaria, `rotas/historico.js`, `public/historico.js`, documento `historico` em `doc.js`):
  - Tabelas: `hist_componentes` (matriz curricular: curso `fund` 1º–9º ou `medio` 1ª–3ª, área, ordem, ativo), `hist_alunos`
    (naturalidade, UF, nacionalidade, UF do RG, observações — o que o ACADESC não traz), `hist_anos` (uma coluna do histórico:
    série, ano letivo, escola, cidade/UF, carga, dias letivos, frequência, resultado; UNIQUE aluno+série) e `hist_notas` (texto:
    "7,5" ou conceito "MB"). Educação Infantil não tem histórico.
  - Aba **Alunos**: quem está em dia e quais anos faltam (esperado = do início do curso até a série anterior à atual; aluno novo, uma a menos).
  - **Notas do aluno** (`#/hist/<id>`): grade como o histórico de papel (linhas = disciplinas, colunas = anos). Enter desce,
    **colar um bloco do Excel espalha pelas células** (`comoPlanilha`), nota abaixo da média fica vermelha e o **resultado é sugerido**
    (Aprovado/Retido pela média e pela frequência; escolher à mão vira definitivo). "Preencher o que dá sozinho" põe o ano provável
    (conta para trás a partir da série atual), carga, dias e — só para veterano — a escola IEL. Salva com `salvarComVersao`
    (os anos vão como `anos_json`, texto, para a comparação campo a campo funcionar). R.A./RG corrigidos aqui vão para o cadastro.
  - Aba **Lançar notas da turma**: turma inteira × disciplinas + frequência + resultado, também com colar do Excel; grava como
    cursado no IEL. Aba **Disciplinas e regras** (admin): incluir, renomear (as notas acompanham), tirar/voltar, mudar a ordem,
    média, frequência mínima, carga, dias letivos e os nomes de quem assina (`hist_*` na config).
  - **Documento**: A4 timbrado, identificação, quadro de notas por área, carga/dias/frequência/resultado, estudos realizados,
    observações, **certificação automática** (conclusão quando todos os anos do curso estão aprovados; senão transferência/parcial,
    "com direito a matricular-se na série X") e duas assinaturas. Aceita vários alunos (`ids=`): "Históricos desta turma".
  - Apagar um ano vai para a Lixeira (tipo `hist_ano`, com as notas). LGPD: o relatório do aluno traz o histórico; o descarte
    apaga `hist_alunos` e mantém as notas sem nome. Botão "🎓 Notas do histórico" na ficha e "🎓 Histórico escolar" em Documentos.
- **Vivências** (menu Matrícula, `rotas/vivencias.js`, `public/vivencias.js`): tabela `vivencias` com as mesmas colunas da
  planilha (criança, responsável, telefone, ano escolar, turma da vivência, data, período, escola atual, como conheceu, status,
  efetivou matrícula, data da matrícula, observação) **mais o contato depois** (`contato_em/por/obs`).
  - Cartões: total, realizadas, matrículas e **% de efetivação = matrículas ÷ vivências realizadas**. Botões de atenção:
    sem contato depois da vivência, aguardando resposta da família, agendada com data que já passou.
  - Ações na linha: Veio / Faltou / Contatei; efetivou "Sim" põe a data da matrícula sozinha. Link de WhatsApp pelo telefone.
  - Aba **Painel do ano**: os quadros do Dashboard da planilha (status, efetivação, como conheceu, ano escolar, turma, por mês).
  - **Importar planilha**: a do Google baixada como .xlsx (acha o cabeçalho "Nome do Aluno" + "Status…"), não duplica
    (mesmo nome + data) e padroniza as listas. Busca global e Lixeira incluem vivências.
- Demonstração: `gerarDemoHistorico` (notas dos anos anteriores, ~12% de anos faltando de propósito, 25% vindos de outra
  escola) e `gerarDemoVivencias` (14 fictícias). Banco com demonstração antiga ganha as duas ao abrir.
- Teste `t-hist` (API, **57 ok**): lista, ano provável, notas com vírgula, conceito, validações, sugestão de resultado,
  conflito, turma, lixeira, disciplinas (renomear leva as notas), permissões, LGPD, vivências (painel, contato, conflito, busca,
  lixeira, importação sem duplicar) e a demonstração saindo junto. Migração conferida: banco da 4.8.0 abre com tudo (161 alunos,
  34 atendimentos) e ganha as tabelas novas. No navegador: as 24 telas/abas abrem sem erro; colar do Excel, resultado automático,
  "Preencher sozinho" + Salvar, documento de 1 aluno e de uma turma (cabe numa folha A4).

### Histórico igual aos modelos da escola (versão 4.10.0, 27/09/2026)
O Kevin mandou os modelos Word ("HISTORICO FUNDAMENTAL I e II.doc", "HISTÓRICO ENSINO MÉDIO.docx" e
"HISTORICO ESCOLAR-TRANSFÊRENCIA BIMESTRE.doc", na pasta `Desktop\Nova pasta` do PC de casa — **têm dados reais, nunca
copiar para o repositório**). O histórico da 4.9.0 foi refeito para sair igual a eles:
- **Documento** (`public/historico-doc.js`, carregado antes de `doc.js`; estilos `.h-*` em `doc.css`): **duas folhas por aluno**.
  - Folha 1: cabeçalho próprio (Vila Romanópolis, CRIAÇÃO: PROCESSO 2154/93; o do Médio não tem Diretoria/Criação), identificação
    com local de nascimento e RG com data de expedição/órgão/estado (Médio: RG no alto), **sem filiação** (CEE 04/95), quadro
    "Base Nacional Comum" / "Parte Diversificada e Eletivas" (Médio: "Itinerário Formativo e Eletivas" e **carga por disciplina**
    em colunas ao lado das notas), totais de carga (BNC, PD, total; no Médio o total vazio vira a soma das cargas), estudos
    realizados com as linhas que sobram **riscadas em diagonal** (Médio: também "Estudos realizados no Ensino Fundamental").
  - Folha 2: "Transferência durante o período letivo" (notas por bimestre; do 6º ano em diante faltas e aulas dadas por
    disciplina; 1º ao 5º ano faltas e dias letivos no total), observações, definição operacional (média da config por extenso),
    "não contém emenda nem rasura", **CERTIFICADO** (conclusão) ou **DECLARAÇÃO** (terminou um ano ou transfere-se), data e as
    assinaturas (Carina Buller no meio, Samara Pereira da Silva à direita — `hist_diretor`, `hist_secretario`) e o quadro da
    Resolução 25/81. Sem transferência, a tabela de bimestres sai em branco e riscada.
  - Transferência no meio do ano: a coluna do ano sai com **TRANSFERE-SE** em pé e a escola "… - Transfere-se" nos estudos.
- **Banco**: `hist_notas.carga`, `hist_anos.carga_bnc/carga_pd`, `hist_alunos.rg_expedicao/rg_orgao/fund_*` e a tabela
  `hist_transf` (uma por aluno: série, ano, **até qual bimestre** (`bimestres`), período, turma, turno, faltas, dias, notas em JSON).
  Matriz de disciplinas = a dos modelos (52); **média 7,0**; carga sugerida 1000 (Fund.) / 1600 (Médio). Banco da 4.9.0 é
  convertido ao abrir (`hist_matriz` na config marca a conversão). "-" digitado vale como vazio, igual ao modelo.
- **Tela** (`#/hist/<id>`): identificação do cabeçalho; no Médio, nota + carga lado a lado em cada série e os estudos do
  Fundamental (sugeridos pelo 9º ano lançado); linhas de totais; "Situação" (não sai no papel, decide certificado × declaração);
  cartão **Transferência durante o ano letivo** com "até qual bimestre ficou" (os seguintes ficam bloqueados e saem riscados).
  Desmarcar a transferência manda o registro para a Lixeira (tipo `hist_transf`; fora da transação principal, porque a lixeira abre a sua).
  "Lançar notas da turma": totais de carga no alto e, no Médio, uma linha de carga por disciplina que vale para a turma toda.
- Vivências: o botão amarelo "Agendar vivência" saiu de baixo do título e foi para uma barra própria, à direita do ano.
- Testes: `t-hist` (57) e `t-hist2` (18: matriz dos modelos, média 7, nota + carga no Médio, "-", RG completo, conclusão do
  Fundamental, transferência até o 3º bimestre, bimestre 5 recusado, desmarcar → lixeira → restaurar, turma do Médio com carga).
  Migração 4.9.0 → 4.10.0 conferida (22 → 52 disciplinas, média 5 → 7, 161 alunos e 399 anos intactos). No navegador: 24 telas
  sem erro; as folhas de Fundamental, Médio e transferência cabem no A4 (1123 px).

** e barras invertidas
  somem dentro de template literal — use a ferramenta de edição de arquivo ou `split/join` em vez de `replace`.
- Testes: `t-hist` 57, `t-hist2` 18, `t-hist3` 12 (bimestres 1–3 sem nota final, 4º → média 0,5, uma casa decimal, ano fechado
  com Aprovado sozinho, bimestre acima de 10 e bimestre 5 recusados). No navegador: 25 telas sem erro; média ao vivo e salvamento.

### Notas por bimestre e boletos só com a entrega (versão 4.11.0, 27/09/2026)
- **Boletos**: a pedido do Kevin, saiu a aba "Conferência de descontos"; a tela (menu Boletos) é só **Boletos entregues**.
  Saíram também a linha "boletos a conferir" do Meu dia, o cartão de boletos dos Relatórios e as duas linhas do relatório de
  fechamento. As rotas `/api/boletos/conferencia*`, a tabela `boletos_conf` e o documento `conferencia_boletos` continuam no
  código (dados antigos preservados), só sem tela. As chaves `desconto_funcionario` etc. seguem em Configurações.
- **Histórico — notas por bimestre**: o Kevin explicou que as notas lançadas no dia a dia são **do ano, por bimestre**. Agora:
  - `hist_notas` ganhou `b1..b4`. Com os **4 bimestres numéricos**, a nota final do ano (`nota`) é a **média calculada**
    (`mediaDoAno`, arredondada por `hist_arredonda`: 0,5 mais próximo — padrão — ou uma casa decimal); é ela que vai para a
    coluna do ano no histórico. Anos antigos continuam aceitando a nota final digitada direto.
  - Ano fechado pelos bimestres e sem situação (ou "Cursando"): o servidor preenche Aprovado/Retido pela média.
  - "Lançar notas da turma": seletor **"Notas do 1º…4º bimestre"** ou "Nota final do ano"; no modo bimestre a última coluna mostra
    quantas médias do ano já dá para calcular. `PUT /api/historico/turma` aceita `bimestre` (1–4).
  - Tela do aluno: quadro **"Notas do ano por bimestre"** (série escolhível, padrão = série atual) com a média ao vivo, que desce
    sozinha para a coluna do ano; o quadro de anos virou "Notas finais de cada ano (as colunas do histórico)".
  - Transferência: se as notas por bimestre já estão lançadas, a folha 2 usa essas (na tela aparecem em cinza no quadro da transferência).
  - Demonstração: ano atual com o 1º ao 3º bimestre lançados (situação "Cursando").
- Armadilha que mordeu: ao editar arquivo com `String.replace` num script, **`$` no texto novo tem significado especial** (`$&`, `$$`, `` $` ``, `$'` — foi assim que este HANDOFF ficou com uma cópia de si mesmo dentro, consertado na 5.4.0). Use sempre `texto.replace(a, () => b)`.

### Tela do aluno só com os bimestres (versão 4.12.0, 28/09/2026)
O Kevin achou inútil a grade de anos (1º ano, 2º ano…) na tela de notas do aluno e pediu para deixar só os bimestres e o que
o documento precisa. A tela `#/hist/<id>` agora tem: **Identificação**, um quadro **"Notas do ano por bimestre"** e a **Transferência**.
- No quadro: seletor de série (✓ = já tem notas; "(atual)" = série do aluno), os dados daquele ano (ano letivo, escola, cidade, UF,
  cargas — BNC/PD/total no Fund.; PD/total no Médio — e a situação, que não sai no papel), e a grade disciplina × 1º–4º bimestre +
  **Nota final do ano** (+ carga por disciplina no Médio). Com os 4 bimestres, a nota final é a média e fica **travada**; sem eles,
  pode ser digitada (anos antigos/outra escola). No Médio aparece também onde o aluno concluiu o Fundamental.
- **Preenchimento sozinho** ao abrir uma série já cursada: ano letivo provável, carga total da config, escola IEL (só veterano) e
  "Cursando" no ano atual. A situação vira Aprovado/Retido sozinha quando nenhuma disciplina está com bimestre pela metade
  (a não ser que alguém tenha escolhido outra à mão). Saiu o botão "Preencher o que dá sozinho".
- Estado da tela num `Map` só (`V`, chaves `série|campo`, `b:disciplina|b1` etc.), comparado com o banco por `montarAnos`;
  o servidor e o documento não mudaram. "Apagar esta série do histórico" usa `DELETE /api/historico/ano/:id` (lixeira).
- Testes: `t-hist` 57, `t-hist2` 18, `t-hist3` 12 continuam passando; no navegador: 4º bimestre → nota final travada e situação
  Aprovado, salvar, série antiga com nota final digitada, documento com a média na coluna do 7º ano; 24 telas sem erro.
- Armadilha: dentro de parágrafo com a classe `dado`, `<b>` vira bloco (`.dado b { display:block }`) — não usar `dado` em texto corrido com negrito.

### Acabamento "premium" do visual (versão 4.13.0, 28/09/2026)
O Kevin pediu que o app tivesse cara de sistema premium. Mesmo azul (#0e3d7a) e amarelo (#f5c21b) — só o acabamento mudou, quase tudo em `app.css`:
- **Profundidade:** sombras em camadas (`--sombra`, `--sombra-alta`, `--sombra-modal`) no lugar de borda + sombra; cartões com raio 14px (`--raio`, `--raio-p` = 10px).
- **Letra:** "Segoe UI Variable" (Windows 11; no Windows 10 cai na Segoe UI), títulos maiores com letras mais juntas, números alinhados (`tabular-nums`).
- **Menu lateral:** degradê do mesmo azul, item atual em "pílula" com um traço amarelo que brilha, contadores e avatar com relevo.
- **Barra de cima e mensagens:** vidro fosco (`--vidro` + `backdrop-filter`), o conteúdo passa desfocado por baixo.
- **Movimento** (curto, sem quicar, `--mola`): a tela chega subindo 6px (`.conteudo.entra`, ligado no `rotear`); a janela cresce de 96% ao abrir e
  encolhe ao fechar; a mensagem (toast) sobe e desce pelo mesmo caminho; botões afundam no clique; barras de progresso crescem; aba ativa com traço que se abre.
  Claro/escuro troca em 0,3s (`.trocando-tema`, só quando a pessoa clica).
- **Janela fechando (armadilha):** `modal()` tira a janela de verdade do documento **na hora**, como antes; quem anima é uma **cópia** (`sumirSuave`,
  classe `.fundo-modal-saindo`, sem ids, `inert`) que some em 0,18s. Assim nenhum código acha uma janela "fechando" nem um `#sim` repetido.
- **Acessibilidade:** respeita "Mostrar animações" desligado (`prefers-reduced-motion`), "Efeitos de transparência" desligado (vidro vira sólido) e alto contraste.
- **Consertos que vieram junto:** `td.acoes` voltou a ser célula de tabela (o `display:flex` fazia a borda e o fundo da linha pararem antes dos botões,
  em ~11 tabelas); botões de situação da ficha tinham `#fff` fixo (ficavam brancos no escuro); o logo da tela de entrada sumia no modo escuro.
- Testado no Edge headless: 22 telas no claro e no escuro sem erro de JS, celular (390px) e um teste de movimento (janela abre/fecha/reabre, toast some, tema troca).
  A impressão não mudou (o bloco `@media print` continua vencendo).

### Anos anteriores do histórico à vista (versão 4.14.0, 28/09/2026)
O Kevin não achou onde lançar as notas dos anos anteriores: existia, mas era só uma caixinha "Série" pequena no canto do quadro.
- Na tela `#/hist/<id>` o quadro virou **"Notas de cada ano"**, com **um botão por ano** do curso do aluno (1º–9º no Fundamental, 1ª–3ª no Médio).
  Cada botão diz o estado: **✓ com notas**, **cursando** (série atual), **falta lançar** (ano já cursado sem notas, em laranja),
  **na outra escola** (aluno novo: a série anterior ainda está em andamento lá) e **ainda não** (anos seguintes, apagados).
  O `<select id="b_serie">` continua existindo, escondido — o resto do código lê a série dele.
- `#/hist/<id>/<série>` (ex.: `#/hist/12/F3`) abre direto naquele ano. Na lista do Histórico, cada ano de "Falta lançar" virou um link assim
  (o servidor manda `faltam_ch` além de `faltam`).
- Testado no Edge headless com a demonstração: etiqueta → abre no ano certo, troca de ano pelos botões, 4 bimestres de um ano anterior
  → média 8,5 → salvo no banco e o ano sai de "falta lançar".

### Ícone do app: selo redondo da rosa do Luterano (versões 5.8.3 a 5.8.5, 29/09/2026)
Pedido do Kevin: "crie uma logo .icon pro app". **Duas versões foram reprovadas**: o "S" do SEK em azul (5.8.3) e a rosa com anéis
sobre um quadrado azul (5.8.4). Na 3ª vez foram feitas **4 opções lado a lado** (coração, rosa solta, selo redondo, fundo branco),
salvas numa imagem na área de trabalho dele, e ele escolheu o **selo redondo**. Lição: ícone/visual é gosto — mostrar opções antes.
- **`app/public/icone.ico`** (16, 24, 32, 48, 64, 128, 256 px, PNG dentro do .ico) e `icone-256.png`: o selo da escola em círculo
  (rosa + anel azul-claro + anel dourado), **sem as letras e sem os pontinhos**, fundo transparente em volta. Aba do navegador em
  `index.html` e `doc.html`. O anel da arte original não é um círculo perfeito: as margens transparentes ficam entre 3 e 6 px.
- **`ferramentas/gerar-icone.mjs`**: acha o anel dourado pela cor no `logo.png` (centro 224,215; raio da arte ~159 + folga de 8 px,
  antes das letras) e reduz em etapas. `--previa <pasta>` salva os PNGs. Apaga a pasta temporária com várias tentativas (o Edge demora a soltá-la).
- **`ferramentas/criar-atalho.ps1 [-Nome] [-Pasta]`**: atalho "SEK" na área de trabalho → `Iniciar Secretaria.bat`, com o ícone
  (`.bat` não aceita ícone próprio). No LEIA-ME. Na área de trabalho do Kevin: "Icone SEK - selo Luterano.ico" e "Opcoes de icone SEK.png".

### Resumo geral da rematrícula em painel (versão 5.8.2, 29/09/2026)
Pedido do Kevin: "deixe o resumo geral mais entendível, em formato de dashboard ou igual a outra tela do app".
- `painelRematricula` refeito com as peças que o app já usa (cartões `.kpis` do Início, `barras()` das Vivências/Relatórios):
  4 números (Efetivados x/total, Vagas livres, Faltam efetivar, Não vão renovar) · barra de andamento geral com legenda (cores das
  etiquetas de situação) · **cartões das salas agrupados por segmento** (Infantil, Fund. I, Fund. II, Médio) com efetivados, barra,
  vagas/livres, novos e avisos (acima da capacidade, não vão renovar, documento pendente) — clicar abre a sala · quadros de
  Categorias e Matrículas×Rematrículas · a tabela igual à planilha ficou **recolhida** (`<details>`) no fim.
- **Vagas livres e ocupação** somam só as salas com vagas definidas (antes comparava as vagas de 3 salas com os alunos de todas
  e dava "0 livres, 104%"); o cartão avisa quantas salas estão sem vagas. A linha de total da tabela usa a mesma conta.
- Teste `t-painel-rem` **11 ok** (números batem com o servidor, legenda soma todos, 15 cartões, 4 segmentos, clicar abre a sala,
  celular 420 px sem rolagem lateral). `t-sala-tela` continua 28 ok.

### Sala da rematrícula: lista + painel lateral (versão 5.8.1, 29/09/2026)
O Kevin achou a grade de 26 colunas (5.8.0) "difícil de editar, visualizar etc." e escolheu, entre três desenhos, **lista + painel lateral**.
- `salaRematricula` (app.js) refeita: à esquerda, lista limpa (aluno + tags novo/doc., situação colorida, desconto, categoria, pagamento,
  efetivação); à direita, **painel do aluno** com campos grandes em blocos (Situação em botões + data de efetivação + sala em 2027 ·
  Desconto e categoria · Planos · Pagamento da matrícula · 1ª parcela diferente, que só aparece marcada · Recebimento · Documentos e
  observações). **Cada campo grava ao sair (ou Enter)** pela mesma rota `PUT /api/rematricula/celulas`; rodapé mostra "✓ Salvo às…".
  ◀ ▶ e ↑ ↓ trocam de aluno. Abaixo de 1100 px o painel abre por cima da lista (fixo à direita, com ×). A grade e o CSS `.grade-rem` saíram.
- O Resumo geral, o servidor e a importação não mudaram.
- Teste `t-sala-tela` **28 ok** (cliques e digitação de verdade), num banco novo depois do `t-planilha-rem`. Rodar duas vezes no mesmo
  banco dá falsas falhas (o aluno já vem com os dados da rodada anterior). O `t-grade-tela` (5.8.0) foi apagado.
- Detalhe de regra: "Em andamento" mantém a data que o aluno já tinha (é a data da matrícula, usada no prazo de documentos);
  só "Concluída" conta como efetivado.

### O app no lugar da planilha de controle (versão 5.8.0, 29/09/2026)
Pedido do Kevin: "a parte resumida como o Resumo Geral da tabela, como um dashboard; a completa dividida por salas e editável como no
Google Sheets — a intenção é **substituir a planilha e usar apenas o app**". A visão Resumida/Completa da 5.7.1 foi trocada por:
- **`#/rematricula` = Resumo geral**: os 6 números da aba "Resumo Geral" + "Detalhamento por turma" (13 colunas e linha de total),
  com as **mesmas fórmulas da planilha** (lidas do .xlsx): efetivada = situação **Concluída** (a planilha conta quem tem Data de
  Efetivação); Matrícula = aluno novo, Rematrícula = veterano; cadastrados = alunos da sala menos transferidos; vagas disponíveis =
  máx(0, vagas − cadastrados); % ocupação = cadastrados ÷ vagas; pendentes = cadastrados − efetivadas; bolsistas/filhos por categoria.
  Função `estatSala` (app.js). Clicar na turma abre a sala.
- **`#/rematricula/<sala>` (F6, EM1…)**: abas das 15 salas (com contagem), o resumo da sala (os números do alto de cada aba da
  planilha + "não vão renovar") e a **grade editável** (`salaRematricula`): 26 colunas na ordem da planilha (+ turma atual, sala em
  2027 e obs. da ficha). Teclado como no Sheets: digitar substitui, Enter grava e desce, Tab vai para o lado, setas, Esc desiste,
  Delete apaga, espaço marca caixinha, **Ctrl+Z desfaz** (pilha da sessão), Ctrl+C copia, **colar bloco TSV** do Excel/Sheets
  (situação e sala casam pelo nome; "0,3" vira 30%). Colunas de lista usam `<datalist>` (escolhe ou digita). Ordena pelo título.
  "Aluno novo" usa `POST /api/alunos` com a sala como `serie_chave`. "Atualizar" rebusca (não há atualização automática entre PCs).
- **Servidor** (`rotas/planilha-rematricula.js`): `GET /api/rematricula/controle` (salas, vagas, alunos com tudo, listas);
  `PUT /api/rematricula/celulas` `{alteracoes:[{aluno_id, campo, valor}]}` — uma célula ou um bloco, **numa transação** (se uma
  falhar, nada grava), auditoria por célula. Regras: data de efetivação preenchida → Concluída; apagada → Não iniciada; situação
  Concluída sem data → hoje; desconto 0–100; valores "1141,87" → "R$ 1.141,87" (texto como ISENTO fica); datas dd/mm/aaaa.
  `PUT /api/rematricula/listas` (admin) grava `config.rem_listas` (listas padrão = aba Configurações da planilha 2027).
- **Importação**: opção "Cadastrar os alunos novos da planilha" (`&novos=1`) — os 4 sem matrícula viram aluno novo da sala.
- Concluintes (3ª série de hoje, destino `CONC`) ficam fora. Na ficha, o quadro virou **"Controle da matrícula"** e aparece também
  para quem foi preenchido no app, com link "editar na planilha da sala".
- Armadilhas: o atalho global "/" (busca) agora respeita `e.defaultPrevented` (senão "/" digitado numa célula pulava para a busca);
  classes novas conferidas com grep (`.grupos` do menu lateral já tinha mordido na 5.7.1); `<b>` dentro de `.dado` vira bloco — usar `<strong>`.
- Testes: `t-celulas` **25 ok** (API), `t-grade-tela` **25 ok** (teclado de verdade via `Input.dispatchKeyEvent`: digitar+Enter, Tab,
  Esc, R$, espaço, data→Concluída, lista de situação, Delete, Ctrl+Z, "/", colar 2×2, ordenar, nome preso, aluno novo),
  `t-planilha-rem` **22 ok**. Rodar nessa ordem num banco novo: `t-planilha-rem` primeiro (troca a senha e carrega a demonstração).
  O `t-planilha-tela` (5.7.0) ficou velho: as checagens da lista antiga não valem mais.
- **Falta para largar a planilha de vez**: importar a planilha real na escola (com os alunos novos), conferir o Resumo geral com o da
  planilha e decidir as abas que ainda não existem no app: **Dispensa de Material, Transferências e Recreação**.

### Rematrícula "como na planilha" (versão 5.7.1, 29/09/2026)
Pedido do Kevin: "todas as informações da tabela também na tela de rematrícula, como na planilha", podendo mudar o design.
- Lista de alunos da Rematrícula com **duas visões** (`#modo`, guardada em `localStorage['iel-rem-modo']`): **Resumida** (a de antes,
  com categoria/desconto/documento embaixo do nome) e **Completa (como na planilha)**: 23 colunas nos mesmos grupos da planilha
  (Aluno · Rematrícula · Desconto · Planos de pagamento · Pagamento da matrícula · 1ª parcela diferente · Recebimento · Documentos e
  observações), nome **preso à esquerda** e cabeçalho preso no alto (a tabela rola dentro de `.rolagem-planilha`, 72vh).
- Busca por nome ou matrícula (palavras em qualquer ordem), filtros de situação e categoria, **ordenar clicando no título**
  (números de verdade para %, R$ e datas; vazios sempre no fim) e **faixa de totais** do que está filtrado (alunos, por situação,
  desconto médio, valor recebido, documento pendente, boletos entregues) — o resumo que a planilha tem no alto de cada aba.
- A situação continua editável nas duas visões. O resto é só leitura (vem da planilha: mude lá e importe de novo).
- Rota nova `GET /api/rematricula/detalhes` (em `rotas/planilha-rematricula.js`): data, pagamento, observações de cada aluno.
- **Armadilha de novo**: a classe `.grupos` já é o menu lateral (flex em coluna) e empilhou os títulos da tabela — as classes da
  tabela usam prefixo `pr-` (`pr-grupos`, `pr-cols`). E `thead tr.pr-cols th` precisa perder para `thead tr th.fixa` no z-index.
- Teste `t-rem-completa` **12 ok** (23 colunas, 8 grupos, valores da planilha fictícia, totais, ordenar, busca, nome preso ao rolar,
  mudar a situação grava, lembra a visão, sem erro de JavaScript), claro e escuro.

### Importar a planilha de controle na Rematrícula (versão 5.7.0, 29/09/2026)
Pedido do Kevin: puxar "todos os dados" da planilha Google **"Controle de Matrículas e Rematrículas 2027 (IE Luterano)"** para a aba
Rematrícula. O conector do Google Drive não abriu (planilha de outra conta); o Kevin baixou o .xlsx para a área de trabalho
(**dados reais: nunca copiar para o Git nem para testes**).
- **Formato da planilha**: uma aba por série do ano que vem (Maternal … 3ª Série EM) com resumo nas linhas 1–5 e o cabeçalho na
  linha 6 (24 colunas: ID/Matrícula, Nome do Aluno, Tipo, Porcentagem de Desconto %, planos de pagamento, valor bruto, forma, banco,
  nº autorização/final do cartão, 1ª parcela diferente (+ forma/banco/autorização), parcelas, valor recebido, Status, Documentos
  Pendentes, Aluno Novo?, Categoria, Data de Efetivação, Observações, Boletos entregues). Aba **Configurações**: "Turma | Vagas Totais".
  Abas de resumo (Resumo Geral, Controle de Matrículas 2027), Dispensa de Material, Transferências e Recreação não são lidas.
- **Regras (decididas pelo Kevin)**: aluno achado pelo **ID/Matrícula = Mat do ACADESC** (518 de 522 casaram; os 4 de fora são
  alunos novos sem matrícula). Situação: **Efetivada → Concluída** (data = Data de Efetivação), **Inadimplente → Não vai renovar**,
  **vazio/Pendente → Não iniciada** — mas vazio/Pendente **nunca desfaz** o que já avançou no sistema. A série do ano que vem = a aba.
  "Não" em Documentos Pendentes = nada pendente. Desconto guardado em % (0,3 → 30).
- **Banco**: colunas novas em `rematriculas` (`desconto`, `categoria`, `docs_pendentes`, `boletos_entregues`, `pagamento_json`,
  `obs_planilha`, `planilha_em`). A observação da planilha fica separada da observação do sistema (`obs`), que não é tocada.
- **Rota** `rotas/planilha-rematricula.js`: `POST /api/rematricula/planilha` (admin) devolve a conferência; `?aplicar=1` grava
  (transação, auditoria por aluno que muda de situação + um registro geral) e atualiza as **vagas** da aba Configurações.
- **Tela**: botão "Importar planilha de controle" (admin) na Rematrícula → conferência (encontrados, mudam, não encontrados, mantidos,
  categorias, vagas) → "Importar N alunos". Lista: categoria/desconto/documento pendente embaixo do nome e filtro "Qualquer categoria"
  (inclui "Com documento pendente"). Ficha: quadro **"Da planilha de controle"** (só leitura) na rematrícula.
- Conferido com a planilha real **só em memória** (sem banco): 518 achados, 60 mudam (29 Concluída, 31 Não vai renovar), vagas de
  14 séries (Jardim II e 2º ano não estão na aba Configurações), 7 com documento pendente. Testes com planilha **fictícia** no mesmo
  formato: `t-planilha-rem` **22 ok**, `t-planilha-tela` 8 ok (a 1 falha é do teste: rótulo em maiúsculas).

### Botão do ano atual torto no histórico (versão 5.6.2, 29/09/2026)
- Na tela `#/hist/<id>`, o botão do ano que o aluno está cursando **sem notas ainda** usava a classe `agora` — a mesma da linha
  vermelha da Linha do dia no Início (`.agora { position: absolute; top: -6px; bottom: 22px … }`). O botão virava um bloco azul de
  857 px, sem texto, por cima do "1º ano". Com a demonstração quase não aparecia (o ano atual já vem com notas); com dado real, sempre.
- Trocado para `.ano-hist.cursando`. **Regra**: classe de estado nova precisa ser conferida com `grep` no `app.css` inteiro (já
  aconteceu com `.trilho` na 5.1.0). Conferido em claro/escuro, 1400/1100/800 px, aluno novo, com ano faltando, Médio e 1º ano.

### Boletim real do ACADESC e matriz curricular (versão 5.6.1, 29/09/2026)
O Kevin testou a 5.6.0 com um boletim de verdade e vieram notas vazias. Ele deixou exemplos em `Desktop\boletins` (**dados reais:
nunca copiar para o Git nem para testes**): 2 boletins do ACADESC (Fund I no meio do ano; Médio de 2024 completo, salvo como
"HISTORICO.pdf"), os modelos de histórico e as matrizes curriculares 2026 (Médio; Fund I e II).
- **Por que vinham vazias** (todas corrigidas em `lib/pdf-texto.js` / `lib/boletim.js`):
  - O PDF do ACADESC tem a fonte com `DescendantFonts [ << … >> ]` (escrita ali mesmo) e as larguras em `/W 9 0 R` (objeto que começa
    com quebra de linha): o leitor pegava a referência errada e perdia a largura das letras → textos sobrepostos.
  - O ACADESC escreve **letra por letra**: entre letras ~0, entre palavras ~0,28 da altura da letra, entre colunas ≥ 0,44. Corte em 0,36.
  - A seção **Faltas** também tem colunas "1° B 2° B 3° B 4° B": cada coluna agora pertence ao título de cima que a cobre ou, se nenhum
    cobre, ao mais perto (até 3 larguras). Embaixo de "Faltas" é falta; embaixo de "Resultado Final", "M.F." é a nota final.
  - "Méd." (média até agora) só vira nota final se não houver "M.F.". **Boletim do meio do ano** (só até o 2º bimestre, por exemplo):
    a média é parcial e NÃO entra como nota final (aviso na tela).
  - "*" antes da nota = abaixo da média (a nota vale). Linha com **0,0 em tudo** = eletiva não cursada: fica de fora, com aviso.
  - Semelhança de nomes: "lingua" não casa mais com "linguagens"; raiz comum ("biologia" ~ "biológicas"); abreviações do ACADESC
    ("Ensino Rel.", "Língua Estr. Mod. Inglês", "Língua Port.").
- **Matriz curricular** (pedido: "no ensino médio as cargas horárias são por disciplina, deveríamos automatizar"):
  - Tabela `hist_matriz (ano, serie_chave, componente, aulas)` — **aulas anuais** (é o que o modelo do histórico do Médio usa na coluna
    "Carga Horária": 160, 80, 40…). `ano` = a partir de quando a matriz vale.
  - `lerMatriz` (`lib/boletim.js`) lê o documento: título "Matriz Curricular – … – 2026" (curso e ano — só o texto depois de "Matriz
    Curricular", porque o timbre cita "ENSINO MÉDIO" até na do Fundamental), séries no cabeçalho e a coluna "Aulas Anuais"/"C.H." de cada uma.
    Lê as duas tabelas do documento do Fundamental (I e II).
  - Rotas: `GET /api/historico/matriz`, `POST /api/historico/ler-matriz` (admin), `PUT /api/historico/matriz` (admin; substitui as séries
    enviadas daquele ano; mesma disciplina duas vezes na mesma série **soma** — Educação Física está na base e na parte flexível do Médio 2026;
    disciplina que não existe entra como **nova** se a tela pedir), `DELETE /api/historico/matriz/:ano` (lixeira, tipo `hist_matriz`, só admin).
  - Tela: "Disciplinas e regras" › **Matriz curricular** (importar com conferência, ver por ano, apagar). Na tela do aluno do Médio a carga
    de cada disciplina vazia vem da matriz mais nova que já valia no ano letivo (`cargasDaMatriz`); ano mais antigo que todas usa a mais
    velha e **avisa**. Em "Lançar notas da turma" (Médio) a linha de carga também vem preenchida.
  - As matrizes 2026 têm disciplinas que o histórico não tinha (Inteligência Artificial, Cálculo, Eletiva, Preparação Enem, Ciências única
    no Fund…): a importação oferece "incluir como disciplina nova". **Ainda não importamos no banco real**: fazer na escola, conferindo.
- Testes (só a demonstração + as matrizes, que não têm dado de aluno; boletins reais só lidos no lugar): leitura dos 2 boletins reais
  certa (todas as notas nas colunas certas, faltas ignoradas); regressão dos 8 formatos fictícios; `t-matriz` **19 ok**;
  `t-matriz-tela` **10 ok**; `t-boletim` **15 ok**; `t-boletim-tela` **14 ok**.

### Importar boletim no histórico (versão 5.6.0, 29/09/2026)
Pedido do Kevin: "a tela de histórico escolar ter uma opção para importar notas: recebe um documento com o boletim do aluno e coloca
automaticamente". O boletim é **do ACADESC** e chega em **qualquer formato** (PDF do sistema, Word, Excel, papel escaneado/foto).
**Ainda não vimos um boletim de verdade do ACADESC**: tudo foi feito e testado com boletins fictícios em vários layouts. Ver §7.6.
- **Tela** (`public/historico.js`, `importarBoletim`): botão **"Importar boletim"** no quadro "Notas de cada ano" de `#/hist/<id>`.
  Passo 1 escolhe o arquivo; passo 2 é a **conferência**: cada linha do boletim → disciplina do histórico (lista para trocar ou
  "não importar"), notas dos 4 bimestres e final (editáveis), série (achada no boletim, ou a aberta na tela) e ano letivo.
  "Colocar no histórico" só **preenche a grade** (bimestres; a final só quando não há os 4; ano letivo; escola IEL se vazia) — **quem grava
  é o Salvar da tela**, com o aviso de edição simultânea de sempre. Série que já tem notas pede confirmação antes de substituir.
- **Servidor**: `POST /api/historico/ler-boletim?aluno=<id>&arquivo=<nome>` (corpo = o arquivo). Não grava nota e **não guarda o
  arquivo** (pasta temporária `iel-boletim-*`, apagada no `finally`). Registra na auditoria "leu um boletim…" com o aluno.
- **`lib/boletim.js`** — transforma qualquer formato em linhas de células `{ t, x, x0, x1 }` e interpreta:
  - `.xlsx/.csv` → `lib/planilha.js`; `.docx` → tabelas do `word/document.xml` (com `gridSpan`), parágrafos com Tab viram colunas,
    e Word que só tem a foto do boletim colada tem a imagem lida; `.doc/.rtf/.odt` e `.xls/.ods` → o **Word/Excel da escola** converte.
  - **PDF com texto** (gerado por sistema) → **`lib/pdf-texto.js`**, leitor próprio sem bibliotecas (objetos, object streams, zlib,
    fontes ToUnicode/WinAnsi/larguras, comandos Tm/Td/Tj/TJ). **PDF escaneado, foto e imagem** → reconhecimento de texto do **Windows**
    (`Windows.Media.Ocr`, pt-BR, já vem no Windows 10/11) via **`lib/ler-boletim.ps1`**, que também renderiza as páginas do PDF (`Windows.Data.Pdf`, até 6).
  - Interpretação: acha o **cabeçalho** (até 3 linhas: "1º Bimestre" em cima de "Nota | Faltas", "Média Final" mesclada) e classifica
    cada coluna (`papelDaColuna`: b1–b4, final, faltas, aulas, rec). Sem cabeçalho legível, as notas entram na ordem (1º–4º e final) com aviso.
    Disciplina ↔ histórico por semelhança com abreviações (`APELIDOS`: "L. Port.", "Ed. Fís."…), cada disciplina recebe no máximo uma linha.
    Acha também a **série** ("E.F. 9 6ª A", "E.M 1° A", "5º ano"), o **ano letivo** e **confere o nome do aluno** (aviso se não aparece).
    Linha de notas cujo nome a imagem não leu entra como "(nome não lido — veja no papel)" para a pessoa escolher a disciplina.
- **Armadilhas encontradas** (não repetir):
  - O OCR do Windows **já devolve as posições com a folha endireitada** — girar pelo `TextAngle` entortava de novo.
  - O OCR **pula números de um algarismo só** perto das bordas da tabela (em PDF renderizado): por isso PDF com texto NÃO passa pelo OCR.
  - O OCR lê "1º Bim" como "10 Bim" (tratado em `papelDaColuna`) e "3ª" como "3a".
  - **Word abrindo PDF pelo COM trava** (janela de aviso invisível) — não usar. Montar tabela no Word célula a célula também trava neste PC.
  - Word/Excel pelo COM **ficam na memória depois do `Quit()`**: o `.ps1` anota o PID do Office que ele abriu (`<saida>.pid`) e o
    servidor fecha **só esse** no fim (dando certo ou não). Um Office que a pessoa esteja usando nunca é tocado.
  - `StorageFile.GetFileFromPathAsync` só aceita caminho com contrabarra (o `.ps1` usa `GetFullPath`). `.ps1` sem acentos (PowerShell 5.1).
- **Testes** (pasta temporária, só dados fictícios): leitura de **8 formatos** (docx, doc, xlsx, xls, PDF com texto, PDF escaneado, PNG,
  foto JPG girada 2°) — todas as notas certas; API `t-boletim` **15 ok** (formatos, aviso de nome, arquivo vazio/estranho, aluno inexistente,
  **não grava nada**, auditoria); tela `t-boletim-tela` **14 ok** no Edge headless (abre, conferência, corrige uma nota, coloca, média
  calculada, Salvar grava, sem erro de JavaScript). Leitura: planilha/Word/PDF com texto < 0,1 s; imagem ~1–3 s; .doc/.xls ~5–9 s.

### Logo de letras brancas na entrada (versão 5.5.1, 29/09/2026)
- A tela de entrada (e as telas de espera, que usam a mesma arte `ARTE_LOGIN`) mostra `logo-escuro.png` direto sobre o
  azul-marinho, sem o disco branco, em 104 px. A tela de bloqueio (5.5.2) troca com o tema como o menu: `.logo-bloqueio.logo-claro` / `.logo-escuro`, sem disco branco.

### Celular e rede com QR Code (versão 5.5.0, 29/09/2026)
- **Configurações › Celular e rede** (`abaCelular` em telas5.js): botão "Liberar para o celular" grava `rede_liberada = '1'`
  (`PUT /api/admin/rede`, admin, fica na Auditoria) e reinicia (`reiniciarSistema(false)` — ganhou o parâmetro `perguntar`).
  Na subida, `HOST` = `0.0.0.0` se `IEL_REDE=1` (o .bat, que continua valendo e aí a tela não desliga) **ou** `rede_liberada`.
  Reiniciar depende do laço do .bat (código 90); rodando `node server.js` na mão, o servidor não volta sozinho.
- `GET /api/admin/rede`: `liberada`, `ativa` (o que está valendo agora), `pelo_bat`, `porta` e `enderecos` (IPv4 da máquina via
  `os.networkInterfaces()`, sem 169.254, adaptadores virtuais — Hyper-V, WSL, VirtualBox, VPN… — por último e Wi-Fi primeiro).
  A janela preta também mostra "No celular: http://IP:porta" quando a rede está liberada.
- **QR Code sem biblioteca**: `public/qr.js`, `gerarQR(texto)` → `<svg class="qr">`. Modo byte (UTF-8), nível M, versões 1–10
  (até 213 bytes), escolhe a melhor das 8 máscaras. Conferido com o leitor do **OpenCV** (Python 3.11 + cv2 deste PC): 8/8 textos
  de 3 a 210 caracteres, versões 1 a 10, e o QR tirado da tela nos temas claro e escuro. Cores em `--qr-fundo`/`--qr-ponto`
  (preto no branco nos dois temas, de propósito).
- A tela mostra o endereço com "Copiar", os passos, um seletor quando o PC está em mais de uma rede e os cuidados (só na rede da
  secretaria, é http sem cadeado, fora do Wi-Fi não abre, Firewall em "Redes privadas", "Abrir pasta" só no PC).
- Teste `t-rede` (navegador, 11 ok): o teste **não** liga a rede de verdade (o Windows abriria o aviso do Firewall no PC do Kevin);
  confere o botão, o "Falta reiniciar" com o servidor real e simula a resposta de rede liberada para testar o QR. **Falta** o teste
  real com um celular (em casa, só com a demonstração).
- `.situacao` no celular: selo e texto numa linha e o botão embaixo (antes o texto virava uma coluna fininha; valia também para
  Cópias de segurança e Atualizações).

### Nome provisório "SEK" (versão 5.4.1, 29/09/2026)
- O Kevin escolheu **SEK** por enquanto ("vamos verificar futuramente"). Fica na constante `NOME_APP` (app.js) e no `<title>`
  do index.html e do doc.html; o `doc.js` monta "<documento> — SEK". Trocar o nome = mudar esses quatro lugares.
- Tela de entrada: "SECRETARIA IEL" pequeno em amarelo (`.login-nome`) e **<em>S</em>EK** grande (S amarelo). A aba do navegador passa a
  dizer "SEK · Secretaria IEL" depois de entrar (antes ficava "Entrar — …" até recarregar).
- 5.4.2: o nome também aparece no menu lateral, embaixo da logo (`.marca-app`, primeira letra na cor `--amarelo-marca`,
  mais escura no tema claro para ler no fundo branco); some no celular junto com a logo.
- 5.4.3: a logo do menu lateral fica direto sobre o fundo (sem o disco branco) e troca com o tema: `logo.png` (letras pretas)
  no claro e `logo-escuro.png` (letras brancas) no escuro. A versão escura foi gerada da original trocando para branco só os
  pixels cinza/pretos fora do anel amarelo (centro 224,215; raio > 163 px), então a cruz e os contornos da rosa não mudam.
- Apresentação para a direção: documento "SEK — Apresentação à Direção" no claude.ai (Claude Docs, do Kevin).
### Polimento total (versão 5.4.0, 29/09/2026)
- **Tela que se atualiza não pula mais**: `rotear()` sabe se é navegação (endereço novo) ou atualização (mesmo endereço,
  depois de salvar/marcar/excluir — `hashNaTela`). Na atualização: sem esqueleto, sem animação de entrada, mesma rolagem,
  altura segurada (`minHeight`) e o foco volta ao mesmo campo (`seletorDoFoco`: id ou 1º atributo `data-*`). A classe
  `.quieta` no `#conteudo` impede as barras de crescerem de novo a cada atualização (só crescem ao chegar na tela).
- **Caixinhas respondem na hora**: `marcarNaHora(cb, acao)` (app.js) pinta a linha como feita no clique, desfaz se o
  servidor recusar e espera a marquinha terminar antes de atualizar. Usado nos documentos da ficha e no Meu dia.
  `sumirLinha(el)` encolhe a linha que sai da lista (lembrete concluído, tarefa excluída, entrega fora do filtro).
- **Boletos**: marcar entrega não redesenha mais a lista — muda só a linha, a barra da turma (que anda até o novo
  tamanho) e os números (`entregaMudou`, telas5.js). Com filtro ativo, a linha encolhe e sai.
- **Caixinha de marcar própria** (app.css, bloco 5.4): igual em todo PC, marquinha que "se desenha", afunda no aperto;
  verde nas listas `.checklist`, azul no resto. O interruptor (`input.interruptor`) não é afetado.
- **Turmas abrem deslizando** (`details.turma-bloco`/`turma-grupo`), só em navegador que já anima até `auto`
  (`interpolate-size`); nos outros abre como antes.
- Corrigido: o Calendário ligava o clique no `#conteudo` (que nunca é trocado) — na 2ª visita, cada clique abria e
  fechava o lembrete (dois ouvintes). Agora o ouvinte fica na `.meses`, que é redesenhada junto com a tela.
- Corrigido: este HANDOFF tinha uma cópia inteira de si mesmo no meio (bug do `$` no `replace`, ver armadilha na 4.11).
### Polimento (versão 5.3.0, 29/09/2026)
- **Sem emoji nas telas:** ~95 emojis das telas antigas (ficha, documentos, bolsas, histórico, vivências, LGPD, atualizações, Meu dia)
  viraram ícones do `ICONES` (novos: `arquivo`, `lupa`, `importar`, `carteira`). `TIPOS_DOC` (etapa2) ganhou o 4º item = ícone do botão.
  Os ✓ e ⚠︎ de texto ficaram (são caracteres, não emoji). Atalhos de Vivências usam `.bolinha` (vermelha/verde/laranja).
- **Janelas (`modal()`):** Esc fecha **só a janela de cima**; o foco entra no 1º campo (ou no botão principal / "Entendi" da Ajuda)
  e volta para onde estava ao fechar.
- **Aviso de baixo (`toast()`):** `role=status`; pausa com o mouse em cima ou com a janela escondida (`pausarToast`/`retomarToast`);
  aviso novo com um ainda na tela troca com desfoque rápido (`.toast.troca`).
- **Movimento:** troca de tela 0,2 s e 4 px (era 0,32 s/8 px — acontece dezenas de vezes por dia); barras 0,5 s; o esqueleto cinza só
  aparece se a tela demorar mais de 0,15 s (`.carregando` com `animation-delay`); `:active` (afundar no clique) em abas, filtros, menu
  da conta, menu das Configurações; `:hover` de campos, etiquetas e resultados da busca só em mouse (`@media (hover: hover)`).
- **Cores e tamanhos:** `--texto-2` claro #56647a (contraste melhor nas etiquetas pequenas); nomes nas tabelas na cor do texto,
  sublinhado só no mouse; barras de rolagem finas da cor do tema; números `tabular-nums`; alvos maiores em tela de toque (`pointer: coarse`).
- Testado com `t-v53` (64 ok de 66; as 2 falhas eram do teste: Alunos não tem link no nome — a linha é clicável — e `.click()` por
  código não dá foco ao botão). **Falta:** rodar `t-v5` e `t-v53` de novo (o PC ficou sem memória e o servidor de teste foi derrubado)
  e olhar os prints das telas com ícones (ficha, documentos, vivências, Meu dia).

### Mutirão de fotos no modelo do protótipo e "Balcão" → "Secretaria" (versão 5.2.0, 29/09/2026)
- **Mutirão de fotos** (`TELAS.fotos` em telas5.js; saiu da etapa3): um cartão por aluno com a **foto de verdade** quando o arquivo está
  na pasta (`/api/foto/<mat>`, `loading="lazy"`), iniciais quando a foto foi tirada mas não achada, listras quando não tem foto; botões
  "Foto tirada" + os 3 sistemas (ficam verdes), observação, data da foto num selo, contorno verde = completo. 60 cartões por vez
  ("Mostrar mais"/"Mostrar todos"). Mantidos: números, aviso de pasta não encontrada, filtros, "Marcar filtrados…" (vale para a lista
  filtrada inteira, não só o que aparece) e a lista para imprimir. Marcar atualiza só o cartão e os números (não volta ao topo).
- **"Balcão" virou "Secretaria"** em tudo o que aparece: canal de atendimento (servidor `rotas/rotina.js`, `CANAIS_AT`, Relatórios e a
  folha de fechamento em `doc.js`), "como foi entregue" dos Boletos ("Na secretaria"), ajuda e protótipo. **A chave guardada continua
  `balcao`**, então os registros antigos aparecem com o nome novo sem migração. As tarefas que o app cria no 1º uso também mudaram
  ("Atendimento sozinho"…); num banco que já existe, elas mantêm o nome antigo até alguém renomear em "Editar o cronograma".
- Testado: `t-v52` (57 ok = as 45 da 5.1 + fotos e "Secretaria": nenhuma tela mostra "Balcão") e `t-v5` (28 ok), 0 erros de JS.

### Nove telas no modelo do protótipo (versão 5.1.0, 29/09/2026)
O Kevin gostou do desenho do protótipo e pediu igual em **Boletos, Atividades extras, Portão · Saída, Atendimentos, Calendário** e toda a
**Gestão** (Relatórios, Mensagens, Lixeira, Configurações) — sem perder função.
- As 9 telas estão em **`public/telas5.js`** (carregado depois de `etapa4.js`). Das etapas saiu **só o desenho** dessas telas; as janelas
  continuam onde estavam e são reaproveitadas: `formAviso`, `formAtendimento`, `formCalendario`, `formInscricao`, `cancelarInscricao` (etapa2/3),
  `abaBackup`, `abaLgpd`, `abaAtualizacao`, `janelaSenhaBackup`, `janelaRestaurar`, `reiniciarSistema` (etapa4). `barras()`/`PCT()` ficaram
  na etapa4 porque Vivências também usa. `lixeira.js` foi apagado (a Lixeira está no telas5.js, com `nomeUsuario`).
- **Portão:** cartões dos avisos de hoje com **"Segure para liberar a saída"** (1,1 s segurando; soltou antes, nada acontece; teclado:
  segurar Espaço/Enter). Mesmo com "animações reduzidas" o botão continua exigindo segurar (regra no `@media prefers-reduced-motion`).
  "Desfazer" e "Excluir aviso" no próprio cartão; a procura mostra o aluno com quem pode buscar (`cartaoPortao`).
- **Boletos:** turmas que abrem e fecham (a turma fechada não desenha as linhas — leve com 535 alunos), interruptor de entregue,
  quem retirou/como/observação salvos na hora, filtros, protocolo e excluir remessa (admin).
- **Atividades extras:** um cartão por atividade (vagas, dias, horário, valor, professor) que filtra as inscrições; eventos em cartões.
- **Atendimentos:** cartões por canal que filtram; **Calendário:** 12 meses em cartões, marcar feito **sem recarregar a tela**;
  **Relatórios:** gráfico de linha (mês a mês) e rosca (por canal) em SVG, mais todas as seções de antes; **Mensagens:** lista + editor com
  prévia no "balão" do WhatsApp e campos clicáveis; **Configurações:** assuntos num menu à esquerda (`#/config/<aba>`), situação das
  cópias/atualização numa faixa colorida, Auditoria em linha do tempo com filtro.
- Telas de espera (reiniciando/restaurando/atualizando) usam `telaAguarde()` (app.js) com a arte da entrada.
- **Armadilha resolvida:** na 5.0 a coluna da esquerda se chamava `.trilho`, o mesmo nome das barrinhas (`.linha-barra .trilho`,
  `.progresso .trilho`) — as barrinhas de Relatórios, Vivências e Histórico ficaram vazias. Agora o estilo da coluna é só `nav.trilho`.
  **Não crie classe com nome genérico sem conferir `grep` no app.css.** Idem para constantes globais: `MESES_CURTOS` já existe em vivencias.js.
- Ajuda (`ajuda.js`) atualizada para os controles novos. Testado: `t-v51` (45 ok: remessa, entregue e quem retirou no servidor, filtros,
  atividade filtra, evento novo, interruptor "Ativa", procura do portão, soltar antes NÃO libera, segurar libera, Desfazer, Espaço libera,
  excluir aviso, filtro por canal, "só em aberto", Resolvido, registrar, 12 meses, marcar/desmarcar o mesmo lembrete, editar, ano anterior,
  gráficos, prévia e campos da mensagem, salvar/criar/excluir modelo, lixeira e restaurar, as 9 abas de Configurações, salvar Geral,
  filtro da Auditoria, celular sem rolagem lateral) e `t-v5` de novo (28 ok), 0 erros de JS.

### Visual novo no app de verdade (versão 5.0.0, 29/09/2026)
O Kevin pediu o design do protótipo no app **sem perder função nenhuma**. As telas (`TELAS.*`) não mudaram; mudaram o esqueleto e o CSS.
- **`app.css` reescrito** com o visual do protótipo, mantendo **todas as classes antigas** e **os nomes das variáveis de cor**
  (`--azul`, `--superficie`, `--texto-2`…): só os valores mudaram, então as cores escritas nas telas (`var(--…)`) continuam valendo.
  Regras de antes mantidas: nada de cor fixa, impressão sempre clara (`:root, :root[data-tema="escuro"]` no `@media print`),
  modo compacto, animação/transparência reduzidas e alto contraste. `--azul` agora é a cor da marca (não é mais o fundo do menu).
- **Letras dentro do app** (`public/fontes/*.woff2`, licença OFL): Bricolage Grotesque (títulos), Onest (texto), IBM Plex Mono (números).
  Nada vem da internet — a CSP (`default-src 'self'`) e o "funciona sem internet" continuam valendo.
- **Esqueleto (`iniciar()` em app.js):** o menu lateral virou um **trilho** com o **logo da escola** e **6 grupos** (`GRUPOS`: Hoje, Alunos,
  Matrícula, Secretaria, Dia a dia, Gestão — mesmas telas e ordem do `MENU` antigo, com `admin: true` onde já havia). As telas do grupo
  viram **abas no alto** (`desenharNavegacao`, com um marcador que desliza). `ROTA_PAI` põe `#/aluno/…` em Alunos e `#/hist/…` em Histórico.
  No celular o trilho vira barra de abas embaixo e aparece o botão da conta (`#conta2`).
- **Contadores:** use sempre **`definirBadge(id, n)`** (guarda em `BADGES`, porque as abas são redesenhadas a cada tela; o grupo no trilho
  mostra a soma). `badgesEtapa3` e `atualizarBadge` já usam. Os ids continuam `badge-tarefas`, `badge-pend`, `badge-saida`.
- **Menu da conta** (avatar amarelo, `#menuConta`): claro/escuro, **modo compacto** (antes só em Configurações, que é de admin),
  **bloquear a tela agora** (`POST /api/bloquear` + `mostrarBloqueio`), trocar senha (agora com "Voltar sem trocar") e Sair (`#sair`).
  `#tema`, `#ajuda`, `#busca`/`#res`, `#avisos`, `#rascunhos`, `#conteudo` e `#saudacao` continuam existindo com os mesmos ids.
- **Início:** frase do dia ("Boa tarde, Kevin. N coisas pedem você.") e **Linha do dia** com dados reais: faixas dos horários de
  Configurações › Geral (`horario_fund2`, `horario_medio`, `horario_infantil`, `horario_fund1`) e os avisos de saída de hoje no `horario`
  de cada um (`/api/hoje`); agulha vermelha na hora atual (some fora das 7h–19h). O resto da tela ficou igual.
- **Entrada e troca de senha** em duas metades (arte com o logo + formulário); o texto passou a dizer "mín. 8 caracteres", como o servidor exige.
- Documentos (`doc.html`/`doc.css`/`doc.js`) **não mudaram** — o Kevin quer os documentos no padrão antigo.
- Testado no Edge headless com a demonstração (`t-v5`, 28 ok, 0 erros de JS): entrada e 1ª senha pela tela, logo e 6 grupos, frase e Linha do
  dia, fontes carregadas, contadores, **as 20 telas + ficha + notas** sem "Ops!" e com a aba certa, marcador andando, `/` e busca,
  ajuda e Esc, janela de atendimento, menu da conta (tema, compacto, bloquear/desbloquear, sair), impressão no escuro sai branca e sem
  menu, celular sem rolagem lateral, e **aprendiz sem Bolsas/Relatórios/Configurações**.

### Protótipo "Secretaria IEL 2.0" (pasta `prototipo/`, 28/09/2026)
Pedido do Kevin: ver o app inteiro num visual completamente novo. **Não é o app** e não grava nada: é uma página solta, com dados fictícios.
- `prototipo/index.html`: as 20 telas, ficha do aluno em gaveta, busca (`/`), ajuda (`?`), entrada/bloqueio/troca de senha, claro e escuro.
  Abre com dois cliques, sem servidor. Navegação em 6 grupos (os mesmos do menu atual) com abas no topo.
- **Documentos iguais aos do app:** `prototipo/documento.html` carrega o `doc.js`, o `doc.css` e o `historico-doc.js` **do próprio app**
  (`<base href="../app/public/">`); só o servidor é trocado pelo `prototipo/dados-demo.js`, que intercepta o `fetch` e responde com
  a demonstração. Por isso a pasta `prototipo/` tem de ficar ao lado de `app/`. Mudou um documento no app, muda no protótipo.
- `dados-demo.js` foi **gravado do servidor com "Carregar demonstração"** (18 alunos fictícios, `demo = 1` conferido, históricos e
  relatórios); tirei da config as pastas e as chaves de backup. Para refazer: subir o servidor de teste com a demonstração e gravar as
  respostas de `/api/documentos/alunos`, `/api/historico/aluno/:id` e `/api/relatorios`.
- A tela de notas do protótipo usa as disciplinas e notas da demonstração, e o que se digita ali fica no `localStorage`
  (`iel2-hist-<id>`), que o `documento.html` lê: o histórico impresso sai com as notas digitadas.
- Também publicado como Artifact (claude.ai), sem os documentos do app (lá aparece uma folha de exemplo).

### Estado dos dados no PC de origem (23/09)
- O banco real (`dados/secretaria.db`, **fora do Git**) tinha **0 alunos** e **519 interessados reais do SIG**.
- Kevin **achava** que tinha carregado a demonstração, mas não tinha.
- "Capa financeiro" e "Atestado de inaptidão para Ed. Física" foram marcados como **obrigatórios**. O atestado não deveria ser, pois gera pendência para todos. **Avisar o Kevin.**
- Num PC novo o banco começa **vazio**, e é preciso **Carregar demonstração** para testar.
- O Kevin **já foi avisado** do atestado de Ed. Física; falta ele desmarcar em Configurações › Documentos no PC da escola.

### Segundo computador (casa) — 23/09
- A Etapa 3 foi feita no PC de casa do Kevin, em `C:\Users\Kevin\OneDrive\Desktop\secretaria-iel` (o Git já estava instalado).
- Lá **não existem** o banco real, as fotos nem as pastas de prontuário: tudo isso fica só no PC da escola.
  Por isso, qualquer coisa que dependa de pasta ou arquivo precisa continuar funcionando (ou ser marcável à mão) quando a pasta não existe.

## 4. Arquitetura

```
SecretariaIEL/
├─ Iniciar Secretaria.bat     → baixa o Node (1ª vez) e sobe o servidor em http://localhost:3000
├─ LEIA-ME.txt                → guia para a secretaria (backup, 3 PCs, modelos)
├─ HANDOFF.md / PROMPT-PROXIMO-CHAT.md
├─ ferramentas/
│  ├─ instalar-node.ps1       → baixa o Node LTS portátil para node/
│  └─ sanitizar-modelos.js    → REMOVE dados reais dos modelos .xlsx (rodar antes de qualquer commit de modelo)
├─ node/  (ignorado)          dados/ (ignorado: secretaria.db)
└─ app/
   ├─ server.js               → HTTP, sessões, CSRF (header X-IEL: 1), rotas da Etapa 1, importação ACADESC/SIG
   ├─ rotas/documentos.js     → dados p/ documentos, emissões, fotos, Consulta Pagamentos, funcionários, feriados
   ├─ rotas/extras.js         → atividades, inscrições, contrato extra, cancelamento, eventos/ingressos
   ├─ rotas/cebas.js          → bolsas (admin), checklist do edital, importação da Planilha Bolsas
   ├─ rotas/boletos.js        → conferência de descontos e protocolo de entrega (Etapa 3)
   ├─ rotas/fotos.js          → mutirão de fotos e checklist dos 3 sistemas (Etapa 3)
   ├─ rotas/saida.js          → autorização de saída, avisos do dia e consulta do portão (Etapa 3)
   ├─ rotas/rotina.js         → tarefas do dia, calendário, atendimentos e /api/hoje (Etapa 3)
   ├─ rotas/backup.js         → cópias de segurança, restauração e reinício (Etapa 4)
   ├─ rotas/lgpd.js           → registro de consultas, dados do aluno e descarte (Etapa 4)
   ├─ rotas/relatorios.js     → números do ano para a Direção (Etapa 4)
   ├─ rotas/atualizacao.js    → verificar e aplicar versão nova pelo Git (Etapa 4)
   ├─ rotas/lixeira.js        → listar, restaurar, apagar de vez e limpeza automática da lixeira (4.3.0)
   ├─ lib/lixeira.js          → excluir guardando a fotografia das linhas, restaurar e limpar (4.3.0)
   ├─ rotas/busca.js          → busca global em todos os tipos de registro (4.4.0)
   ├─ rotas/historico.js      → histórico escolar: notas e cargas por aluno e por turma, transferência, disciplinas (4.9.0/4.10.0)
   ├─ rotas/vivencias.js      → vivências: registro, painel, contato e importação da planilha (4.9.0)
   ├─ lib/atualizacao.js      → conversa com o Git; nada aqui lança erro, tudo volta explicado (Etapa 4)
   ├─ lib/versao.js           → a constante VERSAO, repetida em public/app.js (Etapa 4)
   ├─ lib/backup.js           → VACUUM INTO, cifra AES-256-GCM, retenção e restauração agendada (Etapa 4)
   ├─ lib/db.js               → schema SQLite + migrações (ALTER TABLE) + sementes (usuários, docs, atividades, feriados, funcionários, modelos)
   ├─ lib/zip.js, planilha.js → ler/escrever .xlsx e .csv sem bibliotecas
   ├─ lib/contrato.js         → contrato 2027 + utilitários de modelo (abrirModelo, definirCelula, linhaXml)
   ├─ lib/contrato-extra.js   → contrato de atividade extra
   ├─ lib/series.js           → séries (MAT, JD1, JD2, F1…F9, EM1…EM3), progressão, "DescClasse", extenso
   ├─ lib/prontuario.js       → varre Contratos\<turma>\<aluno>\*.pdf
   ├─ lib/fotos.js            → acha <mat>.jpg / AcaDescMySql.exe00<mat>.jpeg
   ├─ lib/demo.js             → dados FICTÍCIOS (Etapas 1 e 2)
   ├─ lib/boletim.js          → importar boletim: lê qualquer formato e propõe as notas (5.6.0)
   ├─ lib/pdf-texto.js        → texto e posição de cada pedaço de um PDF, sem bibliotecas (5.6.0)
   ├─ lib/ler-boletim.ps1     → OCR do Windows (foto/escaneado/PDF sem texto) e conversão .doc/.xls pelo Office (5.6.0)
   ├─ modelos/                → contrato-2027.xlsx e contrato-atividade-extra.xlsx (JÁ SANITIZADOS)
   └─ public/                 → index.html, app.css, app.js (Etapa 1), etapa2.js, etapa3.js, etapa4.js, telas5.js (5.1), ajuda.js,
                                historico.js, historico-doc.js (o papel do histórico), vivencias.js (4.9.0/4.10.0),
                                tema.js (claro/escuro antes de desenhar), doc.html/doc.css/doc.js
```

**Claro e escuro (regra importante ao mexer no visual):**
- Todas as cores moram nas variáveis do `:root` em `app.css`. O modo escuro (`:root[data-tema="escuro"]`) só troca os valores.
- **Nunca escrever cor fixa** (`#fff`, `#333`) no CSS nem em `style="..."` do JS: usar as variáveis
  (`--superficie`, `--superficie-2`, `--texto`, `--texto-2`, `--borda`, `--titulo`, `--pri`, `--realce`, `--aviso-txt`, `--roxo`…).
  As únicas exceções são o **papel** dos documentos (`.folha` em `doc.css`, sempre branco) e o logo.
- O tema é aplicado por um `<script>` no `<head>` de `index.html` e de `doc.html`, antes de a tela aparecer (evita piscar).
  Guardado em `localStorage['iel-tema']`, só quando a pessoa clica no botão; quem nunca escolheu segue o Windows.
- No bloco `@media print` as variáveis voltam ao claro com o seletor **`:root, :root[data-tema="escuro"]`** — sem o segundo
  seletor, as cores escuras venceriam por especificidade e a impressão sairia com fundo escuro.
- O botão fica na barra lateral (`#tema`, classe `.tema-btn`) e a tecla `/` leva o foco para a busca.

**Versão (armadilha que já mordeu):** o navegador lê `public/*.js` do disco a cada carregamento, mas o servidor é o
processo aberto na janela preta. Depois de um `git pull`, as telas ficam novas e o servidor velho — e as rotas novas
respondem **404 "Rota não encontrada"**. Por isso existe `lib/versao.js` com a constante `VERSAO`, repetida em
`public/app.js`: quando as duas diferem, o app mostra uma faixa vermelha mandando reabrir o "Iniciar Secretaria".
**Ao mudar uma, mude a outra** — o teste de versão compara as duas.

**Convenções do código:**
- Tudo em português (nomes de funções, variáveis e mensagens).
- `rota(metodo, padrao, fn)`: rotas novas entram como módulo em `rotas/*.js` recebendo `ctx`.
- Toda alteração chama `registrar(usuario, acao, detalhe)`, que alimenta a auditoria. Com `{aluno_id}` no detalhe, a ação aparece no histórico da ficha.
- Front-end: `TELAS.<rota> = async (c, arg) => {...}`, rota por hash `#/rota/arg`. Helpers globais: `api`, `esc`, `modal`, `confirmar`, `toast`, `tentar`, `titulo`, `dataBR`, `alunosBusca`, `abrirDoc`, `baixar`, `seletorAluno`.
- Sempre escapar HTML com `esc()`.
- Não usar `alert`/`confirm`. Usar `confirmar()`.
- Colunas novas no banco: adicionar a migração em `lib/db.js`, no bloco "Colunas novas".

## 5. Formatos de importação (ACADESC e planilhas)

- **Alunos (ACADESC):** cabeçalho com `Mat, Nome, Telefone, AnoLetivo, Descricao, Serie, Turma, Turno, FilhoFuncionario, NomeMae, NomePai, NomeResp, Email, Emailmae, EmailPai, TelefoneMae, CelularMae, TelefonePai, CelularPai, DtNascimento, NIS, CPF`. É o mesmo formato da aba Planilha1 do contrato.
  - Séries: `Ens. Fund. 9 anos | 1º | A | T`, `Ensino Médio | 2º`, `Jardim II`, `Maternal`.
- **Responsáveis (ACADESC):** `Mat, Nome, DescClasse, NomeResp, TelefoneResp, cpfresp, RGResp, Endereco, Bairro, Cidade, Estado, CEP, DATA NASC`.
  - DescClasse vem como `E.F. 9 1ª A`, `JD II 1ª B`, `E.M 1° A`, `MT II 1ª A`.
- **Consulta Pagamentos (ACADESC):** `Mat, Nome, Parcela, Descricao, DtVenc, DtPagto, Valor, Juros, Desconto, ValorRecebido, DescClasse, NomeResp, cpfresp, AnoLetivo…`
- **SIG:** `Data, Tipo Contato, Aluno, Data Nascimento, Responsável, Contato, Endereço…, E-mail, Escola Atual, Turma, Observação, Último Contato, Matriculado?`
- **Planilha Bolsas:** abas "Processos (Renovação)" e "Processos 2º fase", com cabeçalho na linha 8.
- Datas do Excel chegam como número serial (`serialParaIso`). CEP chega como número (8530210 vira "08530-210").

## 6. Como rodar e testar

1. `git clone https://github.com/kevinhsdev/secretaria-iel.git` (repositório **privado** da conta `kevinhsdev`; o clone exige login no GitHub) e duplo clique em **`Iniciar Secretaria.bat`**. Na 1ª vez ele baixa o Node sozinho.
2. Entrar como `kevin` com a senha `luterano`. É obrigatório criar uma senha nova no primeiro acesso.
3. **Configurações › Importar dados › Carregar demonstração** (alunos, atividades, ingressos, bolsas, autorizações de saída,
   fotos, conferência e entrega de boletos, tarefas e atendimentos fictícios).
4. Em Configurações › Geral, **ajustar as pastas** (prontuários e fotos) para os caminhos do PC atual.
5. Em Configurações › Cópias de segurança, **apontar a pasta para um pen drive ou o OneDrive** e definir a senha do backup.
   Antes de importar alunos reais, fazer uma restauração de teste — backup que nunca foi restaurado não é backup.

**Como validar mudanças (método usado até aqui):**
- `node --check arquivo.js` para a sintaxe.
- Subir um servidor de teste com outro banco e outra porta: `$env:IEL_DADOS='<pasta temporária>'; $env:IEL_PORTA='3999'`. Testar com scripts Node usando `fetch`, passando o header `X-IEL: 1` e o cookie da sessão.
- Contratos: abrir o `.xlsx` gerado pelo **Excel via COM** (`New-Object -ComObject Excel.Application`) e ler as células, por exemplo `B21`, `C10`, `M10`.
- Telas: Edge headless com `--remote-debugging-port` e o protocolo DevTools via `WebSocket` do Node 24 para tirar prints. Fazer o login preenchendo o formulário.
- **Nunca** deixar cópias de dados reais em pastas temporárias. Apague ao terminar.
- Os testes ficam numa pasta temporária, fora do Git, e são a rede de proteção do projeto. Ao fim da Etapa 4 eram:
  um **cliente** de API com login e contador de ok/falha; **Etapas 1 e 2** (20); **Etapa 3** (70); **perfil aprendiz** (25,
  inclusive o que precisa dar 403); **segurança e LGPD** (28); **backup** (34, com restauração de verdade e reinício do servidor);
  **migração** (derruba as tabelas novas e confere que o app as recria sem perder dados); **tema e atalho** (15, no navegador);
  **impressão no modo escuro** (5, conferindo as cores calculadas); **versão** (6, inclusive fingindo servidor velho);
  **atualização** (16, montando um "GitHub" local com `git init --bare` para não depender da internet) e
  **atualização de ponta a ponta** (12, subindo o app com `IEL_RAIZ` apontado para o repositório de teste);
  **página inicial** (`t-inicio`, 36 ok como admin e 33 como aprendiz, agora com a Lixeira no menu); **lixeira** (`t-lixeira`, 93 ok,
  e `t-lixeira-tela`, 12 ok por perfil); **busca** (`t-busca` 11, `t-busca-tela` 9); **servidor caindo** (`t-conexao`, 19, derruba
  e religa o servidor de verdade); **edição ao mesmo tempo** (`t-conflito`, 17); **ajuda** (`t-ajuda`, 45); **listas em partes**
  (`t-partes`, 18, com a demonstração no tamanho real) e **desempenho** (`t-desempenho`, mede); **histórico e vivências** (`t-hist` 57, `t-hist2` 18, `t-hist3` 12). Um `nav.mjs` reúne o Edge
  headless para os testes de tela; **todas as telas** (`t-rotas`, abre as 30 telas/abas e acusa 404); e os scripts de **print das telas** no Edge headless,
  que também acusam erro de JavaScript. Vale recriá-los no próximo chat.
- Para copiar o banco a fim de testar, copie só os **arquivos** da pasta de dados (hoje existe também a subpasta `backups`).
- Para copiar o banco a fim de testar, copie **também** `secretaria.db-wal` e `-shm`: no modo WAL boa parte dos dados ainda não está no arquivo principal.

**Armadilhas do ambiente (Windows 10 + PowerShell 5.1):**
- No PowerShell 5.1 não existe `&&`. Use `;` ou `if ($?)`.
- `rd` é um alias de **Remove-Item**. Não use como nome de função.
- O `Expand-Archive` recusa `.xlsx`. Use `[IO.Compression.ZipFile]::ExtractToDirectory`.
- Aspas duplas são removidas de argumentos passados a programas externos. Passe JSON por arquivo.
- `Select-Object -First N` num pipe **mata** o processo Node antes de ele terminar.
- Scripts `.ps1` com acentos precisam ser salvos em UTF-8 **com BOM**.
- No `.bat`, `set VAR=1 && ...` guarda o valor com espaço no final. Use `set "VAR=1"`.
- No Bash do Claude Code as **contrabarras somem** dentro de heredoc e de `-e`, e heredocs muito longos quebram:
  para criar ou alterar arquivos grandes (ou qualquer coisa com caminho do Windows), use a ferramenta de escrita de arquivo, não `cat <<EOF`.

## 7. Roteiro: o que falta para virar um sistema de verdade

> Avaliação feita em 24/09/2026, a pedido do Kevin ("o que falta para ser um app premium").
> A régua aqui não é "mais telas" — é o que faz uma escola poder **confiar** o dia a dia dela ao sistema.

### 7.1 Já resolvido na Etapa 4
| O que | Como ficou |
|---|---|
| **Perder tudo num HD queimado** | Backup automático, cifrado, com pasta externa, aviso de atraso e restauração testada |
| **Dado sensível sem controle** | Registro de quem consultou cada ficha, exportação dos dados ao titular e descarte de ex-alunos |
| **Balcão sem ninguém por perto** | Bloqueio de tela com senha, validado no servidor |
| **Senha fraca / script estranho na página** | Mínimo de 8 caracteres, recusa de senhas óbvias, cabeçalho CSP |
| **"Quantos alunos temos?" para a Diretoria** | Tela de Relatórios + uma folha timbrada de fechamento |
| **Cara de protótipo** | Ícones SVG, esqueleto de carregamento, telas vazias que ensinam, modo compacto, claro/escuro; acabamento premium com profundidade, vidro e movimento (4.13.0) |
| **Depender do Kevin para atualizar** | Botão "Verificar atualizações": mostra o que mudou, faz backup, aplica e reinicia sozinho |
| **Excluir era para sempre** (4.3.0) | Lixeira de 30 dias, botão Desfazer logo depois de excluir e tela para restaurar |
| **Achar as coisas** (4.4.0) | Busca global agrupada por tipo, que abre a tela já filtrada |
| **Servidor cai e some o que foi digitado** (4.5.0) | Sessões no banco, faixa "sem conexão", janela preservada e rascunho recuperável |
| **Um passa por cima do outro** (4.6.0) | Aviso com nome e hora; grava só os campos que a pessoa mudou |
| **Aprendiz novo não sabe usar** (4.7.0) | "? Ajuda" em cada tela |
| **Tela de 30 metros com 535 alunos** (4.8.0) | Listas em partes de 100, turmas que abrem e fecham, impressão sempre completa |
| **Histórico feito à mão** (4.9.0) | Notas por aluno ou por turma (colar do Excel), resultado sugerido e histórico impresso sozinho |
| **Vivências numa planilha solta** (4.9.0) | Tela com registro, contato depois, % de efetivação e painel; importa a planilha do Google |

### 7.2 Próximos passos, na ordem que eu faria
1. **Piloto de verdade, com dado real, de um módulo só** — sugestão: *Atendimentos* ou *Portão*, por duas semanas.
   Risco baixo, valor visível no primeiro dia, e é o que ganha a Samara. **Sem isso, o resto é só código.**
2. ~~**Histórico escolar**~~ — **feito na 4.9.0**, com digitação por aluno ou por turma e colar do Excel. **Importar boletim** (PDF, Word, Excel,
   foto) feito na 5.6.0 — falta testar com um boletim de verdade do ACADESC. Falta também conferir o modelo com a Samara.
3. ~~**Busca global**~~ — **feito na 4.4.0**.
4. ~~**Conflito entre duas pessoas**~~ — **feito na 4.6.0**.
5. ~~**Quando o PC servidor cai**~~ — **feito na 4.5.0**.
6. ~~**Lixeira de 30 dias e desfazer**~~ — **feito na 4.3.0**.
7. **Uso real nos 3 PCs** — `IEL_REDE=1`, firewall e atalho nas outras máquinas, testado no local. **Só dá para fazer na escola.**
   Com as sessões no banco (4.5.0) e o aviso de conflito (4.6.0), o sistema já está preparado para várias pessoas ao mesmo tempo.
8. ~~**Ajuda dentro da tela**~~ — **feito na 4.7.0**. Quando a escola tiver os POPs numerados, vale citar o número em cada ajuda.
9. ~~**Desempenho com 535 alunos**~~ — **feito na 4.8.0**, medido com a demonstração no tamanho real.

Tudo o que dependia só de código no §7.2 está feito. O que falta agora depende da escola: **piloto** (item 1 — Vivências também
é um bom candidato: é pequeno e hoje vive numa planilha), **conferir o histórico com a Samara** (item 2) e **testar nos 3 PCs** (item 7). Ideias para depois, se o piloto aprovar: busca que acha também dentro das
observações, e ajuda com prints das telas.

### 7.3 O que eu recomendo **não** fazer
- **Reescrever em React/Vue:** perderia meses e ganharia dependências e build. Rodar com um duplo clique, sem npm
  e sem internet, é uma **qualidade** do projeto.
- **Colocar na nuvem:** dado de menor na internet multiplica exigência de LGPD, custo e responsabilidade.
- **WhatsApp automático em massa:** a API oficial é paga e burocrática; a não oficial derruba o número da escola.
- **Novos módulos antes do piloto:** já são 4 etapas prontas e nenhuma rodando com dado real.

### 7.4 Padrões escolhidos na Etapa 3 (todos configuráveis em Configurações › Geral)
| Tema | Padrão adotado | Chave |
|---|---|---|
| Isenção de filho de funcionário | **100%** | `desconto_funcionario` |
| Isenção + bolsa no mesmo aluno | **Não somam: vale o maior**, com aviso na linha | — |
| % da bolsa usado na conferência | `aprovado`, e na falta dele `ofertado`; só bolsas `ofertada`/`concedida` | — |
| Bolsa ainda só ofertada | Entra na conta, mas com aviso "confirme antes de lançar" | — |
| Atividades extras do ano seguinte | Como ainda não existem em novembro, o app mostra as do ano anterior como **"confirme se continua"** | — |
| Vencimento das mensalidades | dia **10** | `boletos_dia_venc` |
| Mês da massa de boletos | **novembro** | `boletos_mes_massa` |
| Sistemas do mutirão de fotos | ACADESC; SED; Lanche Card | `fotos_sistemas` |
| Aviso de saída só por telefone | **Recusado** (regra do termo), com confirmação explícita para exceções | `saida_aviso_telefone` |
| Dias da semana no cronograma | 1 = segunda … 5 = sexta (sábado e domingo não têm tarefa fixa) | — |
| Calendário | A marcação de "feito" vale **por ano**; item sem dia vale "durante o mês" | — |

### 7.5 Padrões escolhidos na Etapa 4
| Tema | Padrão adotado | Chave |
|---|---|---|
| Backup automático | ao abrir e a cada **6 horas**, guardando as **30** últimas | `backup_horas`, `backup_manter` |
| Aviso de backup atrasado | depois de **2 dias** sem cópia | `backup_avisar_dias` |
| Pasta das cópias | `<dados>\backups` até alguém apontar para o pen drive | `backup_pasta` |
| Senha do backup | opcional; fica guardada no banco para as cópias automáticas saírem cifradas — protege o **arquivo que sai do PC**, não o banco | `backup_senha` |
| Bloqueio de tela | **20 minutos** parado (0 desliga) | `bloqueio_minutos` |
| Descarte de ex-alunos | sugerido a partir de **5 anos** sem matrícula; nunca automático, sempre escolhido na tela | `lgpd_anos_descarte` |
| Lixeira (4.3.0) | o excluído fica **30 dias** e depois some de vez; a aprendiz vê só o que ela excluiu | `lixeira_dias` |

### 7.5.1 Padrões escolhidos na 4.9.0 (histórico e vivências)
| Tema | Padrão adotado | Onde muda |
|---|---|---|
| Disciplinas | As dos modelos Word da escola (Fund.: 10 da Base Nacional Comum + 13 da Parte Diversificada; Médio: 12 + 17 do Itinerário Formativo) | Histórico › Disciplinas e regras |
| Média para aprovação | **7,0** (modelo da escola; era 5,0 na 4.9.0) | `hist_media` |
| Frequência mínima | **75%** (LDB) | `hist_frequencia` |
| Carga anual sugerida | **1000 h** (Fund.) / **1600 h** (Médio) | `hist_carga_fund`, `hist_carga_medio` |
| Quem assina | Carina Buller (meio) e Samara Pereira da Silva (direita) | `hist_diretor`, `hist_secretario` |
| Média do ano (4 bimestres) | média simples, arredondada para **0,5 mais próximo** (7,25 → 7,5) | `hist_arredonda` (0.5 ou 0.1) |
| Nota | 0 a 10 com vírgula, ou conceito curto (A, B, MB…) | — |
| Tipo de histórico | Conclusão se todos os anos do curso estão aprovados; senão transferência/parcial | escolha no documento |
| % de efetivação da vivência | matrículas ÷ vivências **realizadas** | — |

### 7.6 Pendências e perguntas para o Kevin
- Histórico escolar: já segue os modelos Word (4.10.0). **Mostrar à Samara** mesmo assim — nos modelos o fundo da página é azul
  (deixamos branco: parece ser só a cor do Word) e a Samara assina ora "Pereira Silva", ora "Pereira da Silva". Em qual formato dá para exportar as notas (SED ou ACADESC), para importar em vez de digitar?
- **Importar boletim (5.6.0): testar na escola com 2 ou 3 boletins de verdade do ACADESC** (PDF do sistema e uma foto do papel),
  sem copiar nada para o Git. Se alguma coluna ou disciplina vier errada, ajustar `papelDaColuna`/`APELIDOS` em `lib/boletim.js`.
  Conferir também se os PCs da escola têm o OCR do Windows em português (vem com o Windows em pt-BR) e o Word/Excel para .doc/.xls.
- Histórico: confirmar com a Samara a **regra de arredondamento** da média dos bimestres (hoje 0,5 mais próximo).
- Vivências: confirmar se o "% de efetivação" deve ser sobre as realizadas (como está) ou sobre o total, e se a escola quer
  sair de vez da planilha do Google (baixar como .xlsx e importar).
- Modelo da **carta de concessão** da bolsa: ainda não foi enviado.
- Valor da **Recreação** (está vazio) e as **atividades e valores de 2027**.
- Regra da **categoria** da carteirinha olímpica (A, B, C).
- **Feriados municipais** de Ferraz de Vasconcelos.
- Lista oficial de documentos obrigatórios da matrícula.
- Capacidade das turmas 2027 (planilha do Google que não foi achada).
- Acesso de leitura ao MySQL do ACADESC: perguntar à TI ou ao fornecedor.
- **Confirmar com a Samara** os padrões de §7.4 e §7.5 — principalmente a isenção de 100% e a regra de "não somam".
- **Ligar o BitLocker** no PC da secretaria: é o que protege o banco em si (o app protege as cópias).
## 8. Regras de ouro para quem continuar
1. Responder em **pt-BR**, com linguagem simples: o usuário é aprendiz, não programador.
2. **LGPD:** nunca commitar `dados/`, planilhas reais ou modelos sem passar por `ferramentas/sanitizar-modelos.js`. Testar com a demonstração.
3. Não quebrar o que já funciona. Antes de entregar, rodar `node --check` em tudo e testar as rotas mexidas.
4. Manter o padrão: sem dependências npm, código em português, auditoria em toda alteração, `esc()` em todo HTML.
5. Ao terminar cada etapa: atualizar este HANDOFF, fazer commit e push, e explicar ao Kevin o que mudou e como testar.

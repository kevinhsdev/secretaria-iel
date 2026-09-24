# HANDOFF — Secretaria IEL

> Documento de passagem para continuar o projeto em outro computador ou em outro chat.
> Última atualização: **24/09/2026**, versão **4.8.0** (Etapa 4 + início, lixeira, busca global, queda do servidor, edição simultânea, ajuda e desempenho). O que vem a seguir está em §7.

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
  - **Conferência de descontos** (POP 5.3): cruza **filhos de funcionários** (isentos, % configurável), **bolsas CEBAS**
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
   ├─ modelos/                → contrato-2027.xlsx e contrato-atividade-extra.xlsx (JÁ SANITIZADOS)
   └─ public/                 → index.html, app.css, app.js (Etapa 1), etapa2.js, etapa3.js, etapa4.js, lixeira.js, ajuda.js,
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
  (`t-partes`, 18, com a demonstração no tamanho real) e **desempenho** (`t-desempenho`, mede). Um `nav.mjs` reúne o Edge
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
| **Cara de protótipo** | Ícones SVG, esqueleto de carregamento, telas vazias que ensinam, modo compacto, claro/escuro |
| **Depender do Kevin para atualizar** | Botão "Verificar atualizações": mostra o que mudou, faz backup, aplica e reinicia sozinho |
| **Excluir era para sempre** (4.3.0) | Lixeira de 30 dias, botão Desfazer logo depois de excluir e tela para restaurar |
| **Achar as coisas** (4.4.0) | Busca global agrupada por tipo, que abre a tela já filtrada |
| **Servidor cai e some o que foi digitado** (4.5.0) | Sessões no banco, faixa "sem conexão", janela preservada e rascunho recuperável |
| **Um passa por cima do outro** (4.6.0) | Aviso com nome e hora; grava só os campos que a pessoa mudou |
| **Aprendiz novo não sabe usar** (4.7.0) | "? Ajuda" em cada tela |
| **Tela de 30 metros com 535 alunos** (4.8.0) | Listas em partes de 100, turmas que abrem e fecham, impressão sempre completa |

### 7.2 Próximos passos, na ordem que eu faria
1. **Piloto de verdade, com dado real, de um módulo só** — sugestão: *Atendimentos* ou *Portão*, por duas semanas.
   Risco baixo, valor visível no primeiro dia, e é o que ganha a Samara. **Sem isso, o resto é só código.**
2. **Histórico escolar** — maior buraco funcional. Depende de conseguir as notas (SED ou ACADESC): é a pergunta
   que mais vale a pena responder na escola.
3. ~~**Busca global**~~ — **feito na 4.4.0**.
4. ~~**Conflito entre duas pessoas**~~ — **feito na 4.6.0**.
5. ~~**Quando o PC servidor cai**~~ — **feito na 4.5.0**.
6. ~~**Lixeira de 30 dias e desfazer**~~ — **feito na 4.3.0**.
7. **Uso real nos 3 PCs** — `IEL_REDE=1`, firewall e atalho nas outras máquinas, testado no local. **Só dá para fazer na escola.**
   Com as sessões no banco (4.5.0) e o aviso de conflito (4.6.0), o sistema já está preparado para várias pessoas ao mesmo tempo.
8. ~~**Ajuda dentro da tela**~~ — **feito na 4.7.0**. Quando a escola tiver os POPs numerados, vale citar o número em cada ajuda.
9. ~~**Desempenho com 535 alunos**~~ — **feito na 4.8.0**, medido com a demonstração no tamanho real.

Tudo o que dependia só de código no §7.2 está feito. O que falta agora depende da escola: **piloto** (item 1), **notas para o
histórico** (item 2) e **testar nos 3 PCs** (item 7). Ideias para depois, se o piloto aprovar: busca que acha também dentro das
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

### 7.6 Pendências e perguntas para o Kevin
- Histórico escolar: em qual formato dá para exportar as notas (SED ou ACADESC)?
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

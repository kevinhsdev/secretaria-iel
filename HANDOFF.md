# HANDOFF — Secretaria IEL

> Documento de passagem para continuar o projeto em outro computador ou em outro chat.
> Última atualização: **24/09/2026**, ao fim da **Etapa 4**. A próxima é a **Etapa 5** (ver §7).

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
- **Acabamento:** ícones **SVG desenhados no próprio código** (`ICONES` em `app.js`) no lugar dos emojis do menu,
  esqueleto cinza no carregamento, telas vazias que explicam o próximo passo, **modo compacto** (mais linhas na tela),
  layout de celular para o portão e atalho `/` para a busca.

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
   └─ public/                 → index.html, app.css, app.js (Etapa 1), etapa2.js, etapa3.js, etapa4.js,
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
  **impressão no modo escuro** (5, conferindo as cores calculadas); e os scripts de **print das telas** no Edge headless,
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

### 7.2 Próximos passos, na ordem que eu faria
1. **Piloto de verdade, com dado real, de um módulo só** — sugestão: *Atendimentos* ou *Portão*, por duas semanas.
   Risco baixo, valor visível no primeiro dia, e é o que ganha a Samara. **Sem isso, o resto é só código.**
2. **Histórico escolar** — maior buraco funcional. Depende de conseguir as notas (SED ou ACADESC): é a pergunta
   que mais vale a pena responder na escola.
3. **Atualizar sem depender do Kevin** — hoje é `git pull` no terminal. Um botão "Verificar atualizações" que faz
   backup, baixa e reinicia. Enquanto não existir, **o sistema depende de uma pessoa só**, que um dia sai da escola.
4. **Busca global** — um campo que ache aluno, atendimento, bolsa, documento emitido e aviso, agrupado por tipo.
   É o recurso que mais dá sensação de "sistema profissional" pelo esforço que custa.
5. **Conflito entre duas pessoas** — hoje, se o Kevin e a Duda editarem a mesma ficha, a última gravação vence em
   silêncio. Avisar "a Duda alterou esta ficha há 2 minutos" antes de salvar.
6. **Quando o PC servidor cai** — os outros não podem perder o que já foi digitado; hoje some. Guardar o formulário
   e avisar em português, em vez de mostrar erro técnico.
7. **Lixeira de 30 dias e desfazer** — excluir hoje é para sempre.
8. **Uso real nos 3 PCs** — `IEL_REDE=1`, firewall e atalho nas outras máquinas, testado no local.
9. **Ajuda dentro da tela** — um "?" por tela explicando o POP correspondente. Importa porque a secretaria tem
   rotatividade de aprendizes: o próximo precisa conseguir usar sozinho.
10. **Desempenho com 535 alunos reais** — a conferência de boletos e o mutirão viram páginas longas; paginar ou
    virtualizar quando incomodar (com a demonstração de 160 ainda está tranquilo).

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

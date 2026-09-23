# HANDOFF — Secretaria IEL

> Documento de passagem para continuar o projeto em outro computador ou em outro chat.
> Última atualização: **23/09/2026**, ao fim da **Etapa 2**. A próxima é a **Etapa 3**.

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
| Visual | **Menu lateral azul** (#0e3d7a) com detalhes **amarelos** (#f5c21b); logo em `app/public/logo.png`. |
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

### Estado dos dados no PC de origem (23/09)
- O banco real (`dados/secretaria.db`, **fora do Git**) tinha **0 alunos** e **519 interessados reais do SIG**.
- Kevin **achava** que tinha carregado a demonstração, mas não tinha.
- "Capa financeiro" e "Atestado de inaptidão para Ed. Física" foram marcados como **obrigatórios**. O atestado não deveria ser, pois gera pendência para todos. **Avisar o Kevin.**
- Num PC novo o banco começa **vazio**, e é preciso **Carregar demonstração** para testar.

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
   ├─ lib/db.js               → schema SQLite + migrações (ALTER TABLE) + sementes (usuários, docs, atividades, feriados, funcionários, modelos)
   ├─ lib/zip.js, planilha.js → ler/escrever .xlsx e .csv sem bibliotecas
   ├─ lib/contrato.js         → contrato 2027 + utilitários de modelo (abrirModelo, definirCelula, linhaXml)
   ├─ lib/contrato-extra.js   → contrato de atividade extra
   ├─ lib/series.js           → séries (MAT, JD1, JD2, F1…F9, EM1…EM3), progressão, "DescClasse", extenso
   ├─ lib/prontuario.js       → varre Contratos\<turma>\<aluno>\*.pdf
   ├─ lib/fotos.js            → acha <mat>.jpg / AcaDescMySql.exe00<mat>.jpeg
   ├─ lib/demo.js             → dados FICTÍCIOS (Etapas 1 e 2)
   ├─ modelos/                → contrato-2027.xlsx e contrato-atividade-extra.xlsx (JÁ SANITIZADOS)
   └─ public/                 → index.html, app.css, app.js (Etapa 1), etapa2.js, doc.html/doc.css/doc.js
```

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
3. **Configurações › Importar dados › Carregar demonstração** (alunos, atividades, ingressos e bolsas fictícios).
4. Em Configurações › Geral, **ajustar as pastas** (prontuários e fotos) para os caminhos do PC atual.

**Como validar mudanças (método usado até aqui):**
- `node --check arquivo.js` para a sintaxe.
- Subir um servidor de teste com outro banco e outra porta: `$env:IEL_DADOS='<pasta temporária>'; $env:IEL_PORTA='3999'`. Testar com scripts Node usando `fetch`, passando o header `X-IEL: 1` e o cookie da sessão.
- Contratos: abrir o `.xlsx` gerado pelo **Excel via COM** (`New-Object -ComObject Excel.Application`) e ler as células, por exemplo `B21`, `C10`, `M10`.
- Telas: Edge headless com `--remote-debugging-port` e o protocolo DevTools via `WebSocket` do Node 24 para tirar prints. Fazer o login preenchendo o formulário.
- **Nunca** deixar cópias de dados reais em pastas temporárias. Apague ao terminar.

**Armadilhas do ambiente (Windows 10 + PowerShell 5.1):**
- No PowerShell 5.1 não existe `&&`. Use `;` ou `if ($?)`.
- `rd` é um alias de **Remove-Item**. Não use como nome de função.
- O `Expand-Archive` recusa `.xlsx`. Use `[IO.Compression.ZipFile]::ExtractToDirectory`.
- Aspas duplas são removidas de argumentos passados a programas externos. Passe JSON por arquivo.
- `Select-Object -First N` num pipe **mata** o processo Node antes de ele terminar.
- Scripts `.ps1` com acentos precisam ser salvos em UTF-8 **com BOM**.
- No `.bat`, `set VAR=1 && ...` guarda o valor com espaço no final. Use `set "VAR=1"`.

## 7. Etapa 3 (a fazer)

Escopo escolhido pelo Kevin (ainda não implementado):
1. **Boletos:**
   - **Conferência de descontos antes da massa de boletos** (POP 5.3): cruzar alunos com filhos de funcionários (isentos, 100%), bolsas CEBAS concedidas e atividades extras e recreação, gerando a lista de conferência.
   - **Protocolo de entrega dos boletos físicos** por turma: quem recebeu e quando.
2. **Mutirão de fotos** (POP 5.2): lista de alunos sem foto e checklist dos 3 sistemas (ACADESC, SED, Lanche Card), marcando em quais a foto já foi inserida. O app já acha fotos pela matrícula (`lib/fotos.js`).
3. **Autorização de saída**: quem sai sozinho e quem pode buscar cada aluno (nome, parentesco, documento), com consulta rápida no portão. Quando a família avisa por WhatsApp, telefone ou presencialmente que alguém diferente vai buscar, registrar o aviso do dia. Já existe o termo imprimível (`termo_saida`).
4. **Tarefas do dia por pessoa**, seguindo o cronograma da secretaria:
   - seg–qua: Samara com históricos e ACADESC; Duda (manhã) com baixas, planilhas, Lanche Card e fotos; Kevin (tarde) com portão, Lanche Card, digitalização e fotos
   - quinta: foco SED, e Kevin sozinho no balcão
   - sexta: fechamento, e Duda sozinha
5. **Calendário anual/sazonal com lembretes:**
   - jan/fev: boletos, SED, SPTRANS/EMTU
   - mar/abr: prestação de contas CEBAS até 30/04 e mutirão de fotos
   - mai–ago: edital de bolsas, festa junina e vouchers
   - set/out: matrículas e rematrículas
   - nov/dez: fechamento na SED, certificados e massa de boletos
6. **Registro de atendimentos** (balcão, telefone e WhatsApp): quem atendeu, aluno, assunto e se foi resolvido.

**Fora do escopo por decisão do Kevin:** Lanche Card (estoque), SPTRANS e NFS.

**Pendências abertas e perguntas para o Kevin:**
- Histórico escolar: depende das notas da SED ou do ACADESC. Em qual formato dá para exportar?
- Modelo da **carta de concessão** da bolsa: ainda não foi enviado.
- Valor da **Recreação** (está vazio) e as **atividades e valores de 2027**.
- Regra da **categoria** da carteirinha olímpica (A, B, C).
- **Feriados municipais** de Ferraz de Vasconcelos.
- Lista oficial de documentos obrigatórios da matrícula: a escola ainda vai decidir.
- Capacidade das turmas 2027: está numa **planilha do Google** que não foi achada no Drive conectado (provavelmente outra conta). Hoje é digitada em Configurações › Vagas.
- Descobrir com a TI ou o fornecedor se há acesso de leitura ao MySQL do ACADESC.

## 8. Regras de ouro para quem continuar
1. Responder em **pt-BR**, com linguagem simples: o usuário é aprendiz, não programador.
2. **LGPD:** nunca commitar `dados/`, planilhas reais ou modelos sem passar por `ferramentas/sanitizar-modelos.js`. Testar com a demonstração.
3. Não quebrar o que já funciona. Antes de entregar, rodar `node --check` em tudo e testar as rotas mexidas.
4. Manter o padrão: sem dependências npm, código em português, auditoria em toda alteração, `esc()` em todo HTML.
5. Ao terminar cada etapa: atualizar este HANDOFF, fazer commit e push, e explicar ao Kevin o que mudou e como testar.

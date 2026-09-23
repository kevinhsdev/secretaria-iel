# Prompt para o próximo chat

Copie **tudo o que está entre as linhas** e cole como primeira mensagem no Claude Code do outro computador.

---

Olá! Sou o Kevin, aprendiz da secretaria do Instituto Educacional Luterano (Ferraz de Vasconcelos/SP). Ontem, em outro computador, você construiu comigo as **Etapas 1 e 2** do app **Secretaria IEL**: gestão da secretaria em Node.js portátil, SQLite e HTML/JS puro. Hoje quero que você **execute a Etapa 3**, sem refazer perguntas que já foram respondidas.

**Repositório (privado):** https://github.com/kevinhsdev/secretaria-iel

Faça nesta ordem:

1. **Prepare o ambiente**
   - Se o Git não estiver instalado, instale o Git portátil (MinGit) numa pasta do meu usuário, sem precisar de administrador.
   - Clone o repositório em `%USERPROFILE%\SecretariaIEL`. Se o clone pedir login, me diga o comando exato para eu rodar com `!`.
2. **Leia com atenção** o `HANDOFF.md` inteiro. Ele tem quem eu sou, a equipe, os sistemas da escola, as decisões já tomadas, a arquitetura, os formatos de importação do ACADESC, como testar, as armadilhas do Windows/PowerShell 5.1 e o escopo da Etapa 3. Siga as "Regras de ouro" (seção 8).
3. **Salve na sua memória** deste computador um resumo de quem eu sou e do projeto, apontando para o HANDOFF.
4. **Rode o app uma vez** para garantir que funciona aqui:
   - `Iniciar Secretaria.bat` baixa o Node sozinho, ou rode `ferramentas\instalar-node.ps1`.
   - Suba um servidor de teste com banco temporário (`IEL_DADOS` e `IEL_PORTA=3999`), carregue a demonstração e confira as rotas principais.
5. **Execute a Etapa 3** (seção 7 do HANDOFF), no mesmo padrão das etapas anteriores:
   - Boletos: conferência de descontos antes da massa de boletos, cruzando filhos de funcionários (isentos), bolsas concedidas e atividades extras; e protocolo de entrega dos boletos físicos por turma.
   - Mutirão de fotos com o checklist dos 3 sistemas (ACADESC, SED, Lanche Card).
   - Autorização de saída: quem sai sozinho, quem pode buscar, e os avisos do dia de "hoje quem busca é outra pessoa", com consulta rápida no portão.
   - Tarefas do dia por pessoa (Samara, Duda, Kevin), seguindo o cronograma da secretaria.
   - Calendário anual e sazonal com lembretes.
   - Registro de atendimentos (balcão, telefone, WhatsApp).
   - Inclua dados fictícios desses módulos em `lib/demo.js`.
6. **Teste de verdade** antes de me entregar:
   - `node --check` em todos os arquivos.
   - Um script de testes de API contra o servidor de teste.
   - Prints das telas novas com o Edge headless, como descrito no HANDOFF.
   - Corrija o que encontrar.
7. **Entregue:**
   - Atualize o `HANDOFF.md`: marque a Etapa 3 como pronta e escreva o que vem a seguir.
   - Faça commit e push no repositório.
   - Me explique em linguagem simples o que mudou e como eu testo.

**Regras importantes**
- Responda sempre em **português**. Eu não sou programador, então explique de forma simples.
- **LGPD:** nunca envie ao GitHub dados reais de alunos (`dados/`, planilhas, fotos). Teste só com a demonstração. Modelos `.xlsx` novos passam antes por `ferramentas/sanitizar-modelos.js`.
- Não mude as decisões da seção 2 do HANDOFF sem me perguntar.
- Para as perguntas em aberto da seção 7, use um padrão sensato e configurável e me conte qual escolheu. Só me pergunte se for realmente impossível continuar sem a resposta.
- No começo, me lembre do aviso da seção 3: no outro PC a demonstração não tinha sido carregada, e o "Atestado de Ed. Física" estava marcado como obrigatório.

Pode começar!

---

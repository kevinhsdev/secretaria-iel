# Secretaria IEL

Sistema de gestão da secretaria do **Instituto Educacional Luterano** (OASE, Ferraz de Vasconcelos/SP).

- **Etapa 1:** matrícula e rematrícula 2027, pendências de documentos, contrato automático, interessados (SIG), WhatsApp.
- **Etapa 2:** documentos com 1 clique (declarações, termos, carteirinhas, livro ponto), atividades extras e ingressos, bolsas CEBAS.
- **Etapa 3:** conferência de descontos e protocolo de entrega dos boletos, mutirão de fotos nos 3 sistemas, autorização de saída com consulta no portão, tarefas do dia por pessoa, calendário anual e registro de atendimentos.
- **Etapa 4:** cópias de segurança automáticas e cifradas (com restauração), bloqueio de tela, LGPD (registro de consultas, exportação dos dados do aluno e descarte de ex-alunos) e relatórios de fechamento para a Direção.
- **Atualização:** botão "Verificar atualizações" que mostra o que mudou, faz cópia de segurança, aplica e reinicia sozinho.
- **Visual:** modo claro e escuro (botão na barra lateral), ícones SVG, modo compacto e impressão sempre em branco e preto.

## Como usar
1. Dê dois cliques em `Iniciar Secretaria.bat`. Na primeira vez ele baixa o Node.js portátil sozinho.
2. Acesse http://localhost:3000. O usuário inicial é `kevin`, `samara` ou `duda`, com a senha `luterano` (troca obrigatória no 1º acesso).
3. Para testar sem dados reais: **Configurações › Importar dados › Carregar demonstração**.

Leia o **[HANDOFF.md](HANDOFF.md)** para o contexto completo e o **[PROMPT-PROXIMO-CHAT.md](PROMPT-PROXIMO-CHAT.md)** para continuar com o Claude.

> ⚠️ **LGPD:** o banco (`dados/`) e as planilhas reais **nunca** entram no repositório. Os modelos em `app/modelos` foram limpos com `ferramentas/sanitizar-modelos.js`.

# 🤖 Bot de Engajamento & Acompanhamento de Bolsistas — CIIA/DF

Bot desenvolvido para o **Centro Integrado de Inteligência Artificial do DF (CIIA/DF)**, combinando acompanhamento de produtividade de bolsistas (standup diário, meta de 20h/semana em dias úteis) e engajamento da comunidade de IA.

---

## 🚀 Funcionalidades Principais

### 📋 Fora e Dentro do Expediente de Bolsistas
- **`/daily` (Standup Diário em Modal)**: Formulário interativo para registrar horas trabalhadas no dia, atividades realizadas, metas para o próximo dia útil e bloqueios/impedimentos.
- **Frequência em Dias Úteis**: O contador de dias seguidos (*streak*) opera de **segunda a sexta-feira**. Finais de semana não quebram a sequência do bolsista.
- **Meta de 20 Horas Semanais**: Barra de progresso visual em tempo real no perfil e na daily (`X / 20.0h`).

### 👤 Perfil & Gamificação
- **`/perfil`**: Exibe a foto, nível de contribuição (XP), horas acumuladas na semana, sequência de dailies e badges desbloqueadas.
- **`/ranking`**: Leaderboard com os membros mais ativos do servidor.
- **Badges Iniciais**:
  - 🚀 **Primeiros Passos**: Registrou a 1ª daily.
  - 🔥 **Imparável**: 5 dias úteis seguidos de daily (uma semana completa).
  - ⏱️ **Meta 20h Concluída**: Cumpriu as 20 horas na semana.
  - 🧠 **Contribuidor IA**: Compartilhou conteúdo relevante com a comunidade.

### 💬 Comunidade & IA
- **`/projetos`**: Apresenta as frentes de atuação e projetos ativos do CIIA/DF.
- **`/compartilhar`**: Compartilha artigos, benchmarks, notícias e ferramentas de IA com a comunidade.
- **`/ajuda`**: Guia interativo para novos membros e bolsistas.

---

## 🛠️ Passo a Passo para Colocar o Bot Online

### 1. Criar o Bot no Discord Developer Portal
1. Acesse o [Discord Developer Portal](https://discord.com/developers/applications).
2. Clique em **New Application**, dê o nome de `CIIA Bot` e clique em **Create**.
3. No menu lateral esquerdo, vá em **Bot**:
   - Clique em **Reset Token** e **Copie o Token** gerado (guarde com segurança!).
   - Em **Privileged Gateway Intents**, ative as opções:
     - ✅ **PRESENCE INTENT**
     - ✅ **SERVER MEMBERS INTENT**
     - ✅ **MESSAGE CONTENT INTENT**
4. No menu lateral esquerdo, vá em **OAuth2 -> URL Generator**:
   - Marque a checkbox **`bot`** e **`applications.commands`**.
   - Em *Bot Permissions*, marque **Administrator** (ou *Send Messages*, *Embed Links*, *Use Slash Commands*).
   - Copie o URL gerado na parte inferior e abra no seu navegador para **adicionar o Bot ao servidor do CIIA/DF**.

---

### 2. Configurar o Arquivo `.env`
No diretório do projeto (`/Users/gustavo/Documents/disc_bots`), crie ou edite o arquivo `.env` copiando o modelo `.env.example`:

```env
# Token do Bot (obtido no menu Bot)
DISCORD_TOKEN=seu_token_aqui

# Client ID da Aplicação (obtido no menu General Information)
CLIENT_ID=seu_client_id_aqui

# (Opcional) ID do servidor de testes para registro instantâneo dos comandos slash
GUILD_ID=seu_guild_id_aqui

# (Opcional) ID do canal do Discord onde as dailies públicas serão postadas (ex: #standup-bolsistas)
DAILY_CHANNEL_ID=seu_canal_id_aqui
```

---

### 3. Registrar os Comandos Slash no Discord
Execute o comando de deploy para registrar os comandos `/daily`, `/perfil`, etc. no Discord:

```bash
npm run deploy
```

---

### 4. Iniciar o Bot
Para rodar o bot:

```bash
npm start
```

Você verá a mensagem:
`🤖 Bot CIIA/DF online como CIIA Bot#1234!`

---

## 🧪 Comandos Úteis de Desenvolvimento

```bash
# Executar a suíte de testes de validação completa (banco + comandos + embeds)
npm run test-bot

# Testar apenas a lógica do banco de dados SQLite
npm run test-db
```

---

## 📁 Estrutura do Código

- `src/index.js`: Ponto de entrada do bot, manipulador de eventos e modais.
- `src/database.js`: Banco SQLite com suporte a dias úteis, cálculo de streak, horas semanais e XP.
- `src/utils/embeds.js`: Construtores de Modals e Embeds estilizados com o tema do CIIA/DF.
- `src/commands/`: Módulos de comandos Slash (`/daily`, `/perfil`, `/projetos`, `/ranking`, `/compartilhar`, `/ajuda`).

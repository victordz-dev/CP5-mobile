# CP5 - Chat Mobile com Push Notifications

**Integrantes (Grupo):**
- Guilherme Oliveira - 558797
- Matheus Dantas - 558804
- Rafael Panhoca - 555014
- Silas Alves - 555020
- Victor Rodriguez - 559094

---

## 📱 Sobre o Projeto

Este aplicativo é um chat multiplataforma (iOS/Android) desenvolvido com **React Native (Expo)**, **Firebase** e um backend em **Node.js (Express)**.
- **Backend:** A API valida a pertença aos grupos, assegurando que usuários mal intencionados não disparem push notifications indesejadas.
- **Autenticação & Tempo Real:** Usa Auth, Firestore e RTDB com regras estritas.
- **Segurança e Privacidade:** Mantém e salva dados sensíveis como celular e data de nascimento no cadastro, porém protege a leitura desses campos de forma nativa e rigorosa via **Firestore Rules**, onde somente o próprio usuário pode lê-los diretamente. Perfis são lidos por outros usuários de forma seletiva apenas através de rotas seguras de Backend (onde conexões são verificadas).
- **Gerenciamento de Mídia:** Armazenamento seguro de fotos de perfil e avatares de grupo, utilizando regras no Firebase Storage que permitem leitura irrestrita porém upload estrito autenticado.
- **Notificações Flexíveis:** Diferentes políticas (`all_group_messages`, `mentioned_members`, `direct_messages_only`, `disabled`) mapeiam e poupam infraestrutura determinando quem recebe o envio no servidor.

---

## 🛠 Como Executar o App (Client)

1. Entre na pasta raiz do projeto.
2. Instale as dependências: `npm install` (ou `bun install` se aplicável).
3. Configure as variáveis de ambiente em um arquivo `.env` na raiz:
   ```env
   EXPO_PUBLIC_API_URL="https://cp5-mobile.onrender.com"
   ```
4. Inicie o Expo: `npx expo start`

---

## 🚀 Como Executar a API Localmente

1. Navegue até a pasta `server/`: `cd server`
2. Instale as dependências: `npm install`
3. Crie um arquivo `server/.env` contendo suas variáveis do Firebase (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`).
4. Compile o TypeScript: `npx tsc`
5. Inicie o servidor: `npm start`
6. A API responde no endpoint de health check: `GET /`

---

## 🌐 API Publicada (Render)

A API oficial já se encontra publicada no Render (produção) e com HTTPS.
- **URL Base:** `https://cp5-mobile.onrender.com`
- **Health check:** Acesse `https://cp5-mobile.onrender.com/` para verificar se o servidor está no ar.

Basta colocar a URL pública acima no `.env` do Expo (`EXPO_PUBLIC_API_URL`) para o app usá-la, dispensando a necessidade de iniciar o servidor localmente para testar.

---

## 🔒 Regras de Segurança e Arquitetura

**Firestore:**
Apenas usuários autenticados têm acesso. A coleção principal de usuários protege informações sensíveis por default. As criações, edições e exclusões de Grupos são estritamente travadas (`ownerId`, limite e tamanho mínimo de grupo ≥ 2). A edição por parte dos membros ocorre unicamente no momento de sair do grupo, de forma segura.

**Realtime Database:**
Apenas membros reais do chat podem ler ou escrever as mensagens, graças à verificação em espelho no RTDB e Firestore. Apenas o backend tem acesso Admin absoluto e serve de ponte segura para inserção via `/sync-members`.

**Notificações Push e Idempotência:**
O backend verifica a flag `pushSent`. Para garantir a concorrência, é usada uma transação atômica do RTDB na flag: a operação a tranca no status `pending`, dispara a solicitação ao `exp.host` e caso falhe na validação/integração com a Expo, dá um **rollback imediato e limpo** para permitir uma tentativa subsequente.

**Receipts da Expo e Limpeza Contínua:**
1. Erros Imediatos: Ao disparar a notificação (`/push/send`), a API extrai os tickets e exclui silenciosamente os tokens inválidos ou desregistrados em tempo real.
2. Erros Assíncronos: Tickets válidos são armazenados no Firestore (`pushTickets`). O processamento de Receipts mapeia o status assíncrono (rejeições póstumas por Google/Apple) pelo endpoint mapeador de tickets `POST /notifications/receipts`, deletando perfeitamente do cache as informações de devices que efetuaram desinstalação.

---

**Evidência de Funcionamento (Push):**
*(O arquivo da print final da avaliação será colocado aqui)*
![Push Notification Evidence](https://via.placeholder.com/400x200?text=Evidencia+de+Push+Aqui)

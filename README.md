# CP5 - Aplicativo de Chat com Grupos e Notificações Push

**Integrantes (Grupo):**
- Guilherme Oliveira - 558797
- Matheus Dantas - 558804
- Rafael Panhoca - 555014
- Silas Alves - 555020
- Victor Rodriguez - 559094

---

## 📱 Sobre o Projeto

Este aplicativo é um chat multiplataforma (iOS/Android) desenvolvido com **React Native (Expo)**, **Firebase** e um backend em **Node.js (Express)**. Ele suporta:
- Chat em Tempo Real com Realtime Database.
- Gerenciamento e Perfis no Firestore.
- Upload de Fotos (Perfil e Grupo) via Firebase Storage.
- Autenticação por E-mail/Senha.
- Criação e Moderação de Grupos de Chat, com limite de usuários protegido contra concorrência (transações).
- Regras de segurança rigorosas para leitura/escrita.
- Push Notifications enviadas por API Rest Node.js com proteção de idempotência e tipagem segura.

---

## 🛠 Como Executar o App (Client)

1. Entre na pasta raiz do projeto.
2. Instale as dependências: `npm install`
3. Configure as variáveis de ambiente em um arquivo `.env` na raiz:
   ```env
   EXPO_PUBLIC_API_URL="http://localhost:3000" # Ou a URL do Render após o deploy
   ```
4. Inicie o Expo: `npx expo start`
5. Pressione `a` para abrir no emulador Android, `i` para iOS, ou escaneie o QR Code no Expo Go.

---

## 🚀 Como Executar a API (Server)

A API é construída em Express com TypeScript. Ela faz as validações críticas de banco de dados cruzadas (verificar membros do Firestore antes de enviar push de uma mensagem do RTDB).

1. Navegue até a pasta `server/`: `cd server`
2. Instale as dependências: `npm install`
3. Crie um arquivo `server/.env` contendo suas variáveis do Firebase (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`).
4. Compile o TypeScript: `npx tsc`
5. Inicie o servidor: `npm start` (ou `npm run dev` para nodemon).
6. A API também conta com health check no endpoint `/`.

---

A API já foi publicada no Render!
- URL Base HTTPS: **https://cp5-mobile.onrender.com**
- Health check (GET `/`): Verifica se o servidor está no ar e respondendo.

Para testar localmente, o processo de deploy foi realizado usando `render.yaml`. Basta colocar a URL pública acima no `.env` do Expo.
---

## 🔒 Regras de Segurança e Decisões Arquiteturais

**Firestore:**
Apenas usuários autenticados têm acesso. A escrita e edição de Grupos são fortemente travadas pela regra: `allow update: if isAuthenticated() && request.auth.uid == resource.data.ownerId`, impedindo que qualquer membro burle os limites, altere fotos ou nomes se não for o dono. Uma exceção segura foi implementada no Backend para manter as validações consistentes.

**Realtime Database:**
Apenas membros reais do chat podem ler ou escrever as mensagens, através da restrição combinada: `.read: root.child('chat_members').child($conversationId).child(auth.uid).val() === true`. Além disso, a regra `.validate` garante que `senderId` é o dono da mensagem e que não há textos vazios.

**Armazenamento de Estado de Concorrência:**
A atualização do limite de grupos é executada no cliente usando `runTransaction` no Firestore, impedindo que acessos simultâneos causem Race Conditions e deixem um grupo com 11/10 usuários.

**Notificações Push (Idempotência e Segurança):**
O servidor verifica no Realtime Database se a notificação para a referida mensagem já foi enviada (`pushSent: true`). Se o cliente fizer múltiplas chamadas, o servidor bloqueia as subsequentes. O token do remetente é atestado validando o JWT com o Firebase Admin Auth (`Authorization: Bearer <ID_TOKEN>`).

---

**Evidência de Funcionamento (Push):**
*(Substitua por um print da tela do celular recebendo a notificação)*
![Push Notification Evidence](https://via.placeholder.com/400x200?text=Evidencia+de+Push+Aqui)

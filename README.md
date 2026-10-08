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
- **Backend:** A API valida a pertencao aos grupos, assegurando que usuarios mal intencionados nao disparem push notifications indesejadas.
- **Autenticacao & Tempo Real:** Usa Auth, Firestore e RTDB com regras estritas.
- **Seguranca de Dados:** Não salva dados sensíveis de celular ou nascimento, protegendo a privacidade. 

---

## 🛠 Como Executar o App (Client)

1. Entre na pasta raiz do projeto.
2. Instale as dependencias: `npm install`
3. Configure as variaveis de ambiente em um arquivo `.env` na raiz:
   ```env
   EXPO_PUBLIC_API_URL="https://cp5-mobile.onrender.com"
   ```
4. Inicie o Expo: `npx expo start`

---

## 🚀 Como Executar a API Localmente

1. Navegue ate a pasta `server/`: `cd server`
2. Instale as dependencias: `npm install`
3. Crie um arquivo `server/.env` contendo suas variaveis do Firebase (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`).
4. Compile o TypeScript: `npx tsc`
5. Inicie o servidor: `npm start`
6. A API responde no endpoint de health check: `GET /`

---

## 🌐 API Publicada (Render)

A API oficial ja se encontra publicada no Render (producao) e com HTTPS.
- **URL Base:** `https://cp5-mobile.onrender.com`
- **Health check:** Acesse `https://cp5-mobile.onrender.com/` para verificar se o servidor esta no ar.

Basta colocar a URL publica acima no `.env` do Expo (`EXPO_PUBLIC_API_URL`) para o app usa-la, dispensando a necessidade de iniciar o servidor localmente para testar.

---

## 🔒 Regras de Seguranca e Arquitetura

**Firestore:**
Apenas usuarios autenticados tem acesso. As criacoes, edicoes e exclusoes de Grupos sao estritamente travadas (`ownerId`, tamanho do grupo). A edicao por parte dos membros ocorre unicamente no momento de sair do grupo, de forma atletica.

**Realtime Database:**
Apenas membros reais do chat podem ler ou escrever as mensagens, gracas a verificacao em espelho no RTDB e Firestore. Apenas o backend tem acesso Admin absoluto e serve de ponte segura para insercao via `/sync-members`.

**Notificacoes Push e Idempotencia:**
O backend verifica a flag `pushSent`. Para garantir a concorrencia, e usada uma transacao atomica do RTDB na flag: a operacao a tranca no status `true`, dispara a solicitacao ao `exp.host` e caso falhe na integracao com a Expo, da um rollback automatico.

**Receipts da Expo:**
Ao disparar a notificacao (`/push/send`), a API extrai os tickets contendo possiveis erros de Devices Desregistrados ou Inativos, limpando silenciosamente o Firebase de tokens irrelevantes.

---

**Evidencia de Funcionamento (Push):**
*(O arquivo da print final da avaliacao sera colocado aqui)*
![Push Notification Evidence](https://via.placeholder.com/400x200?text=Evidencia+de+Push+Aqui)

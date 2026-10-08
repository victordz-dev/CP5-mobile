# CP5 - Chat Mobile com Push Notifications

**Integrantes (Grupo):**
- Guilherme Oliveira - 558797
- Matheus Dantas - 558804
- Rafael Panhoca - 555014
- Silas Alves - 555020
- Victor Rodriguez - 559094

---

## 📱 Sobre o Projeto

Este aplicativo é um chat multiplataforma desenhado para suportar Android e iOS, construído utilizando **Expo SDK 57**, **React Native**, **Firebase** e backend em **Node.js (Express)** hospedado no Render.

### Estrutura do Projeto
- `src/app`: Rotas de interface construídas com `expo-router` (ex: `chat.tsx`, `users.tsx`, `group-form.tsx`).
- `src/components`: Componentes visuais reutilizáveis (ex: `Loading`, `ErrorMessage`).
- `src/services`: Camada de comunicação com Firebase e API Rest (`authService`, `chatService`, `notificationService`).
- `src/types`: Interfaces TypeScript rigorosas para garantir tipagem em toda a aplicação.
- `server/`: Backend em Express.js responsável por validar regras atômicas, lidar com integrações Push da Expo e sincronizar permissões sensíveis (Firestore -> RTDB) sem expor as chaves Admin.

---

## 🛠 Como Executar o App (Client - Android / iOS)

1. Entre na pasta raiz do projeto.
2. Instale as dependências: `npm install`.
3. Configure a variável de ambiente criando um `.env` a partir do `.env.example`:
   ```env
   EXPO_PUBLIC_API_URL="https://cp5-mobile.onrender.com"
   ```
4. Para rodar em desenvolvimento com FCM no Android ou APNs no iOS via build nativa (Development Build):
   ```bash
   npx expo run:android
   # ou
   npx expo run:ios
   ```
   **Nota:** Se utilizar o Expo Go, os Push Notifications estarão atrelados ao projeto do Expo Go.

---

## 🚀 Como Executar a API Localmente

1. Navegue até a pasta `server/`: `cd server`
2. Instale as dependências: `npm install`
3. Crie um arquivo `.env` contendo suas chaves baseando-se no `server/.env.example` (incluindo `CRON_SECRET`).
4. Inicie o servidor: `npm run dev` ou `npm start` após transpilado.

A API no Render foi configurada em conjunto com o `render.yaml` contendo a especificação do Cron Job periódico para limpar tokens inválidos e tickets rejeitados.

---

## 🌐 API Publicada (Render)

A API oficial já se encontra publicada no Render (produção) e com HTTPS.
- **URL Base / Endpoint Público:** `https://cp5-mobile.onrender.com`
- **Health check:** Acesse `https://cp5-mobile.onrender.com/` para receber o JSON de status: `{"status":"ok","service":"CP5 API",...}` e verificar se o servidor está no ar.

Basta colocar a URL pública acima no `.env` do Expo (`EXPO_PUBLIC_API_URL`) para o app usá-la, dispensando a necessidade de iniciar o servidor localmente para testar.

---

### 📡 Endpoints da API

A API centraliza as operações sensíveis, evitando que o cliente (App) atue diretamente em regras complexas do banco de dados:

- **`POST /groups`**: Criação do grupo. Valida limites numéricos, políticas estritas de push e garante que o usuário que criou o grupo esteja entre os membros iniciais e seja o `ownerId`.
- **`POST /groups/:id/join`**: Adição de novos membros. Autorizada apenas para o proprietário, verificando o `memberLimit` dinamicamente com trava de transação (`runTransaction`) para evitar ultrapassar as vagas caso 2 donos loguem simultaneamente.
- **`POST /groups/:id/leave`**: Remoção voluntária ou expulsão. O `ownerId` não pode sair do grupo sem transferir a propriedade, e o grupo impede a descida do número de membros para `< 2`.
- **`PUT /groups/:id`**: Edição. Restrito a nome, limite (nunca menor que os membros atuais) e foto.

---

## 🔒 Regras de Segurança e Arquitetura

**Firestore:**
Apenas usuários autenticados têm acesso. A coleção principal de usuários protege informações sensíveis por default. As criações, edições e exclusões de Grupos são estritamente travadas (`ownerId`, limite e tamanho mínimo de grupo ≥ 2).

**Realtime Database (Sincronização Sequencial e Rollback Automático):**
Apenas membros reais do chat podem ler ou escrever mensagens. Para mitigar o problema do "2-phase commit" entre 2 bancos não-relacionais diferentes do Google (Firestore e RTDB), o servidor atua como ponte. A rota executa as alterações de participantes primeiramente no **Firestore**, garantindo a concorrência (`runTransaction`); na mesma esteira, chama o **Realtime Database** para espelhar a lista de `chat_members`.
**Proteção contra falha:** Se o RTDB der timeout ou erro de rede, o catch intercepta o erro no Node.js e dispara um **Rollback Manual atômico**, removendo ou devolvendo o usuário afetado de volta ao Firestore e repassando o erro limpo ao cliente (App). Isso elimina a chance de vazamento de acesso.

**Armazenamento de Fotos (Firebase Storage):**
- As regras (`storage.rules`) exigem tipagem restrita: apenas arquivos cujo `content-type` corresponda a imagens (`image/*`) e cujo tamanho seja inferior a `5MB` são permitidos.
- As imagens são armazenadas em `/profiles/{userId}` ou `/groups/`.
- O lado do cliente implementa o fluxo formal de requisição e tratativa de permissão negativa usando `expo-image-picker` e `expo-image-manipulator` (limitando qualidade a 0.5 para economizar rede).

**Notificações Push (Firebase Cloud Messaging - FCM) e Expo:**
- O projeto usa `expo-notifications` para se comunicar diretamente com a APNs (Apple) e FCM (Google Android).
- A configuração dos pacotes nativos para Android reside no arquivo `app.json` (credencial e chave via `google-services.json`). Para iOS reside em `GoogleService-Info.plist` atrelado ao `bundleIdentifier`.
- A geração das notificações é roteada pelo servidor que processa o token único FCM/Expo salvo por dispositivo em `users/{userId}/devices/{deviceId}`.
- O backend verifica a flag `pushSent`. Para garantir a concorrência, é usada uma transação atômica do RTDB na flag: a operação a tranca no status `pending`, dispara a solicitação ao `exp.host` e caso falhe na validação/integração com a Expo, dá um **rollback imediato e limpo** para permitir uma tentativa subsequente.

---

## 📸 Evidências Reais de Funcionamento

*(O arquivo da print final da avaliação será colocado abaixo para demonstração física no dispositivo).*
![Push Notification Evidence](https://via.placeholder.com/400x200?text=Evidencia+de+Push+Aqui)

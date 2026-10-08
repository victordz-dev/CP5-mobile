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

## 🔒 Regras de Segurança e Arquitetura

**Firestore:**
Apenas usuários autenticados têm acesso. A coleção principal de usuários protege informações sensíveis por default. As criações, edições e exclusões de Grupos são estritamente travadas (`ownerId`, limite e tamanho mínimo de grupo ≥ 2). A edição por parte dos membros ocorre unicamente no momento de sair do grupo, de forma segura, com endpoints dedicados validando as permissões de `ownerId`.

**Realtime Database (Sincronização Sequencial):**
Apenas membros reais do chat podem ler ou escrever as mensagens, graças à verificação em espelho no RTDB. Apenas o backend tem acesso Admin absoluto e serve de ponte segura para inserção via rotas HTTPS. Operações de Grupo (criação, entrada e saída) primeiro comutam os arrays no `Firestore` via `runTransaction` e logo em sequência replicam o estado em `chat_members` do RTDB. Em caso de falha transitória de comunicação com o RTDB, a operação reverte manualmente garantindo consistência sem precisar de 2-phase commit nativo.

**Notificações Push e Idempotência:**
O backend verifica a flag `pushSent`. Para garantir a concorrência, é usada uma transação atômica do RTDB na flag: a operação a tranca no status `pending`, dispara a solicitação ao `exp.host` e caso falhe na validação/integração com a Expo, dá um **rollback imediato e limpo** para permitir uma tentativa subsequente.

---

## 📸 Evidências Reais de Funcionamento

*(O arquivo da print final da avaliação será colocado abaixo para demonstração física no dispositivo).*
![Push Notification Evidence](https://via.placeholder.com/400x200?text=Evidencia+de+Push+Aqui)

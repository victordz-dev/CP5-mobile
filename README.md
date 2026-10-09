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
3. Crie um arquivo `.env` baseado em `server/.env.example`. Configure `FIREBASE_PROJECT_ID`, `FIREBASE_DATABASE_URL`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` e `CRON_SECRET`. `EXPO_ACCESS_TOKEN` só é necessário quando a segurança aprimorada do Expo Push estiver habilitada.
4. Valide e execute:
   ```bash
   npm run typecheck
   npm test
   npm run build
   npm start
   ```

A chave privada deve ser armazenada somente como variável secreta no Render, preservando as quebras de linha como `\n`. Nenhum arquivo de conta de serviço deve ser enviado ao repositório.

### Publicação no Render

O `render.yaml` define o serviço web, o health check e o cron de recibos. Para publicar, conecte o repositório como um Blueprint no Render, preencha todas as variáveis marcadas com `sync: false` no painel e aplique o Blueprint. O deploy executa `npm install && npm run build` e inicia `npm start`. O cron consulta os recibos a cada 15 minutos, conforme a janela recomendada pelo Expo Push Service.

Use uma conta de serviço dedicada à API. No IAM, conceda somente as permissões necessárias para leitura/escrita de Firestore, leitura/escrita do Realtime Database e consulta de usuários revogados no Authentication; não use papéis genéricos de Owner/Editor. Uma composição mínima típica é `roles/datastore.user`, `roles/firebasedatabase.admin` e `roles/firebaseauth.viewer`, revisada no IAM do projeto conforme os recursos efetivamente utilizados. A API não usa credencial administrativa de FCM, pois envia ao Expo Push Service.

---

## 🌐 API Publicada (Render)

A API oficial já se encontra publicada no Render (produção) e com HTTPS.
- **URL Base / Endpoint Público:** `https://cp5-mobile.onrender.com`
- **Health check:** `GET https://cp5-mobile.onrender.com/health` (a raiz `/` também responde por compatibilidade) retorna `{"status":"ok","service":"CP5 API"}`.

Basta colocar a URL pública acima no `.env` do Expo (`EXPO_PUBLIC_API_URL`) para o app usá-la, dispensando a necessidade de iniciar o servidor localmente para testar.

---

### 📡 Endpoints da API

A API centraliza as operações sensíveis, evitando que o cliente (App) atue diretamente em regras complexas do banco de dados:

- **`POST /groups`**: Criação do grupo. Valida limites numéricos, políticas estritas de push e garante que o usuário que criou o grupo esteja entre os membros iniciais e seja o `ownerId`.
- **`POST /groups/:id/join`**: Adição de novos membros. Autorizada apenas para o proprietário, verificando o `memberLimit` dentro de uma transação do Firestore para serializar tentativas simultâneas sobre a última vaga.
- **`POST /groups/:id/leave`**: Remoção voluntária ou expulsão. O `ownerId` não pode sair do grupo sem transferir a propriedade, e o grupo impede a descida do número de membros para `< 2`.
- **`PUT /groups/:id`**: Edição. Restrito a nome, limite (nunca menor que os membros atuais) e foto.

**Sincronização e Notificações:**
- **`POST /sync-members`**: Re-espelha no Realtime Database somente uma conversa da qual o solicitante participa. A versão de integrantes impede que uma sincronização antiga sobrescreva uma alteração mais nova.
- **`POST /notifications/messages`**: Recebe exclusivamente `conversationId` e `messageId`, valida o Firebase ID Token, relê a mensagem no Realtime Database, confirma o remetente, consulta participantes/política/tokens no Firestore e calcula os destinatários no servidor. Uma transação em `pushSent` adquire o processamento uma única vez; reenvios não disparam outro push. Os envios são divididos em lotes de até 100 e o texto da mensagem não é exposto na notificação.
- **`POST /notifications/receipts`**: Processador cron para ler os Push Tickets aguardando recibo e varrer da base devices desabilitados ou revogados (DeviceNotRegistered).

Todas as rotas operacionais, exceto health check e o endpoint protegido pelo segredo do cron, exigem `Authorization: Bearer <Firebase ID Token>`. Erros retornados ao app são mensagens controladas e não incluem tokens, credenciais ou detalhes internos.

## ⚙️ Configuração do Firebase (Out of the box)

O projeto lê nativamente as chaves do Firebase do arquivo JSON centralizado `firebaseConfig.json`. Diferente das práticas que escondem o identificador público do projeto no `.env`, **este repositório contém o arquivo `firebaseConfig.json` versionado** intencionalmente, para atender ao requisito de facilidade de execução ("clone, instale, rode"). Ele está abastecido apenas com **chaves públicas do cliente** (sem `serviceAccountKey`).

Para que o ambiente funcione corretamente, certifique-se de habilitar os seguintes serviços no Firebase Console do seu projeto correspondente às chaves:
- **Authentication:** Provedor E-mail/Senha obrigatoriamente habilitado.
- **Firestore Database:** Para armazenar os Perfis e Configurações de Grupos.
- **Realtime Database (RTDB):** Para persistir o Chat em Tempo Real.
- **Cloud Messaging (FCM):** Para gerenciar os tokens e disparos de Push Notification.

Nenhuma credencial administrativa está exposta. Os segredos administrativos do Firebase-Admin devem viver exclusivamente nas variáveis de ambiente seguras do servidor NodeJS (`server/.env`).

---

## 🔒 Regras de Segurança e Arquitetura

**Firestore:**
Apenas usuários autenticados têm acesso. A coleção principal de usuários protege informações sensíveis por default. As criações, edições e exclusões de Grupos são estritamente travadas (`ownerId`, limite e tamanho mínimo de grupo ≥ 2).

**Realtime Database (Sincronização Versionada e Compensação):**
Apenas membros reais do chat podem ler ou escrever mensagens. O Firestore é a fonte de verdade dos participantes. Cada alteração feita pela API incrementa `membershipVersion` dentro da mesma transação que valida proprietário, quantidade atual e `memberLimit`. O espelho `chat_members` do Realtime Database também guarda `_version`; uma transação no RTDB ignora estados antigos, impedindo que respostas concorrentes restaurem uma lista ultrapassada.
**Proteção contra falha:** a API só responde sucesso depois de atualizar o espelho. Se a sincronização falhar, uma transação compensatória restaura o estado anterior quando nenhuma operação posterior ocorreu e tenta sincronizá-lo novamente. Em remoções, isso evita declarar o usuário removido enquanto o acesso no RTDB ainda não foi revogado.

**Armazenamento de Fotos (Supabase Storage):**
- O aplicativo envia fotos de perfil e grupo para o bucket público `cp5-images` do Supabase e salva apenas a URL HTTPS retornada no Firebase. Nenhum Base64 é gravado no Firestore ou no Realtime Database.
- O lado do cliente implementa o fluxo formal de requisição e tratativa de permissão negativa usando `expo-image-picker`.

## 🖼️ Fotos no Supabase Storage (sem Firebase Storage)

O Firebase Storage exige uma conta de faturamento no plano Blaze. Para não depender dele, as imagens deste projeto usam o Supabase Storage; Firebase continua responsável por Authentication, Firestore, RTDB e notificações.

1. Crie um projeto no [Supabase](https://supabase.com/dashboard/projects) e, em **Storage**, crie o bucket `cp5-images` como **Public**. Defina `5 MB` como tamanho máximo e permita apenas `image/jpeg`, `image/png` e `image/webp`.
2. Em **Settings > API**, copie a **Project URL** e a **Publishable key**. Nunca utilize nem exponha a `service_role`/secret key no aplicativo.
3. Crie o `.env` a partir de `.env.example` e preencha:
   ```env
   EXPO_PUBLIC_SUPABASE_URL="https://SEU-PROJETO.supabase.co"
   EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY="sb_publishable_SUA_CHAVE_PUBLICA"
   ```
4. Em **Storage > Policies**, aplique uma política de `INSERT` para o bucket. O app utiliza Firebase Auth, e não Supabase Auth; por isso a regra abaixo permite upload com a chave pública, mas limita o destino e as extensões. Não adicione permissões de `UPDATE`, `DELETE` ou listagem ao cliente.
   ```sql
   create policy "CP5 allows image inserts"
   on storage.objects for insert
   to anon, authenticated
   with check (
     bucket_id = 'cp5-images'
     and (storage.foldername(name))[1] in ('profiles', 'groups')
     and storage.extension(name) in ('jpg', 'png', 'webp')
   );
   ```

O bucket é público somente para leitura por URL, o que permite que avatares e fotos de grupo sejam exibidos por qualquer participante. Como a chave publicada no Expo é inevitavelmente visível, esta configuração deve ser usada apenas para imagens não sensíveis. Para controlar uploads por identidade Firebase de forma mais forte, a próxima evolução é gerar URLs de upload assinadas em uma rota autenticada da API, mantendo a chave secreta exclusivamente no servidor.

**Notificações Push (Firebase Cloud Messaging - FCM) e Expo:**
- O projeto usa `expo-notifications` para se comunicar com APNs (Apple) e FCM (Google Android).
- A API calcula dinamicamente os destinatários e adquire a mensagem por uma transação atômica em `pushSent`. Estados finais não podem ser readquiridos por uma chamada duplicada.
- O payload contém `conversationId` e `conversationType`, mas usa corpo genérico para não mostrar o conteúdo privado da mensagem na tela bloqueada.
- Tickets são persistidos sem expor tokens ao cliente. O cron mantém tickets ainda sem recibo e remove o dispositivo somente quando o Expo retorna `DeviceNotRegistered`.

**Política de Notificações (Notification Policy):**
Cada grupo suporta as seguintes políticas de notificação, processadas inteiramente pelo servidor Node.js de acordo com as regras:
- `all_group_messages`: Todos os membros (exceto o remetente) recebem a notificação.
- `mentioned_members`: Somente membros marcados na mensagem (`@membro`) recebem a notificação push.
- `direct_messages_only`: O grupo fica silenciado, apenas conversas diretas continuam gerando notificações para o usuário.
- `disabled`: Nenhuma mensagem deste grupo irá acionar uma notificação push para nenhum membro.

**Configuração Operacional FCM / EAS (Android & iOS):**
Para compilação nativa com Push Notifications funcionando fora do Expo Go, o projeto utiliza Continuous Native Generation (CNG) através do **EAS Build**:
1. O repositório já contém arquivos-base (`google-services.json` e `GoogleService-Info.plist`). Para testes reais, faça o download das chaves oficias no Console do Firebase e os substitua.
2. O `app.json` já está configurado apontando para esses arquivos nativos.
3. Para Android, configure a Cloud Messaging Server Key (Legacy ou API V1) no painel do Expo utilizando `eas credentials`.
4. Para iOS, configure a APNs Key (.p8) no portal do Apple Developer e envie para o Expo via `eas credentials`.
5. Execute `eas build --profile development --platform android` para obter um APK / AAB funcional que possua os módulos nativos requeridos pelo push.

---

## ✅ Validações automatizadas

- App: `npx expo lint` e `npx tsc --noEmit`.
- API: `cd server && npm test` e `npm run typecheck`.
- Os testes da API cobrem as quatro políticas, a exclusão do remetente, filtragem de não integrantes e seleção explícita/menções.
- O limite concorrente é protegido por `runTransaction` do Firestore. O teste de concorrência com duas sessões reais na última vaga ainda deve ser executado no projeto Firebase entregue antes da apresentação; ele não é substituído pelo teste unitário de políticas.

---

## 📸 Evidências Reais de Funcionamento

*(Pendente substituir o marcador abaixo por uma captura real feita em dispositivo físico antes da entrega.)*
![Push Notification Evidence](https://via.placeholder.com/400x200?text=Evidencia+de+Push+Aqui)

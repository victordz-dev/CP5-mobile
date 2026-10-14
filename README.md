# CP5 — Chat Mobile com Firebase e Push Notifications

Aplicativo de chat individual e em grupo para Android e iOS. O projeto usa Expo SDK 57, React Native 0.86, TypeScript, Firebase e uma API Express publicada para enviar notificações sem expor credenciais administrativas no app.

Repositório: `https://github.com/victordz-dev/CP5-mobile`

## Integrantes

- Guilherme Oliveira — RM 558797
- Matheus Dantas — RM 558804
- Rafael Panhoca — RM 555014
- Silas Alves — RM 555020
- Victor Rodriguez — RM 559094

## Tecnologias e responsabilidades

- **Expo SDK 57 / React Native 0.86 / Expo Router:** aplicativo multiplataforma e navegação baseada em arquivos.
- **TypeScript:** tipagem estrita de telas, serviços, modelos e navegação.
- **Firebase Authentication:** cadastro e login exclusivamente por e-mail e senha, restauração da sessão e logout.
- **Cloud Firestore:** perfis, metadados de conversas e grupos, integrantes, limites, políticas e dispositivos.
- **Realtime Database:** mensagens e sincronização em tempo real; os listeners são removidos ao trocar de conversa ou sair.
- **Firebase Cloud Messaging (FCM) e APNs via Expo Push Service:** entrega nativa dos pushes; a API calcula os destinatários e envia ao serviço da Expo.
- **Supabase Storage:** upload das fotos; somente a URL HTTPS final é persistida no Firebase.
- **Node.js, Express e Firebase Admin:** API autenticada, sincronização de integrantes, concorrência e envio idempotente de push.

## Estrutura

```text
assets/              ícones e identidade visual
src/app/             rotas Expo Router e telas
src/components/      componentes reutilizáveis
src/contexts/        sessão e estado global
src/hooks/           hooks da aplicação
src/services/        Firebase, API, notificações e armazenamento
src/types/           modelos TypeScript
src/utils/           formatadores e utilitários
server/src/          API Express e regras de integração
firestore.rules      regras versionadas do Firestore
database.rules.json  regras versionadas do Realtime Database
firebase.json        manifesto de deploy das regras Firebase
supabase-storage-policy.sql  política mínima de upload das fotos
app.json             configuração nativa declarativa (CNG)
eas.json             perfis de development, preview e production
```

As pastas `android/` e `ios/` são geradas por Continuous Native Generation e não são versionadas. Alterações nativas devem ser feitas em `app.json` ou por config plugins e aplicadas em um novo prebuild/build.

## Instalação e execução do app

Requisitos: Node.js 22.13 ou superior e npm. Este projeto não possui `bun.lock`, portanto os comandos usam `npx`.

```bash
npm install
cp .env.example .env
npx expo start
```

Depois de copiar `.env.example` para `.env`, preencha as variáveis `EXPO_PUBLIC_FIREBASE_*` com os valores públicos correspondentes de `firebaseConfig.json`, configure `EXPO_PUBLIC_API_URL` com `https://cp5-mobile.onrender.com` e informe os dados públicos do Supabase Storage nas variáveis `EXPO_PUBLIC_SUPABASE_*`.

O `firebaseConfig.json`, `google-services.json` e `GoogleService-Info.plist` contêm apenas configurações públicas obrigatórias para avaliação e para os SDKs cliente e nativos. Os três arquivos correspondem ao mesmo projeto Firebase. O aplicativo JavaScript lê as configurações do `.env`; não há fallback de URL, projeto ou bucket no código, e URLs de serviços sem HTTPS são rejeitadas. Nunca coloque conta de serviço, chave privada, `service_role`, senha ou token administrativo no aplicativo.

O acesso às rotas principais só é liberado depois que `users/{uid}` contém o perfil completo. Se o app for fechado durante o cadastro, o próximo login oferece a retomada do perfil; listeners de conversa e registro de push não são iniciados durante esse provisionamento.

Validações locais:

```bash
npm run lint
npm run typecheck
npm run check
```

## APK Android para avaliação

O APK final está disponível na página de [Releases do projeto](https://github.com/victordz-dev/CP5-mobile/releases/latest). Baixe o arquivo `.apk` anexado à versão mais recente e instale-o em um dispositivo Android físico. Caso o Android bloqueie a instalação, autorize temporariamente a instalação de aplicativos provenientes do navegador ou gerenciador de arquivos utilizado no download.

O APK é gerado com o perfil `preview` de `eas.json` e já contém as configurações públicas incorporadas durante o EAS Build. Não é necessário instalar Node.js, executar o Metro ou iniciar a API localmente para avaliar essa versão. A API de notificações utilizada pelo APK permanece publicada em `https://cp5-mobile.onrender.com`.

Para validar push em primeiro plano, segundo plano e com o aplicativo fechado, conceda a permissão de notificações solicitada no primeiro acesso e utilize duas contas em dispositivos compatíveis.

## Configuração do Firebase

No Firebase Console do projeto entregue:

1. habilite Authentication > Sign-in method > Email/Password;
2. crie o Cloud Firestore e o Realtime Database;
3. publique `firestore.rules` e `database.rules.json`;
4. registre os apps Android `com.victordz.cp5` e iOS `com.victordz.cp5`;
5. confirme que os arquivos `google-services.json` e `GoogleService-Info.plist` são dos apps registrados;
6. habilite a API do Firebase Cloud Messaging e configure a credencial FCM V1 no projeto EAS.

O projeto e os caminhos das regras estão declarados em `.firebaserc` e `firebase.json`. Depois de autenticar o Firebase CLI, publique somente os produtos usados pelo app:

```bash
npx firebase-tools@latest login
npx firebase-tools@latest deploy --only firestore:rules,database --project cp05-d6f00
```

O Firebase Storage não é utilizado por este projeto e, por isso, não existe configuração de Storage em `firebase.json`. As imagens são armazenadas exclusivamente no Supabase Storage; o Firebase mantém apenas suas URLs HTTPS.

Para testar as regras com os emuladores:

```bash
npm run test:firebase-rules
```

## Fotos no Supabase Storage

1. Crie um projeto no Supabase e um bucket público; o nome usado deve ser o mesmo de `EXPO_PUBLIC_SUPABASE_BUCKET` e da política SQL.
2. Limite os MIME types a `image/jpeg`, `image/png` e `image/webp` e o tamanho a 10 MB.
3. Copie a Project URL, a chave **publishable** e o nome do bucket para as três variáveis `EXPO_PUBLIC_SUPABASE_*` do `.env`.
4. Nunca use a chave `service_role` no aplicativo.
5. Execute `supabase-storage-policy.sql` no SQL Editor. A política concede apenas `INSERT` ao papel `anon`, limitado ao bucket, às pastas `profiles`/`groups` e às extensões aceitas; não conceda `UPDATE`, `DELETE` ou `SELECT` ao cliente.

O papel `anon` é necessário porque o login do produto é feito no Firebase, e uma sessão Firebase não se transforma em uma sessão Supabase. A chave publicável pode ficar no app; a chave `service_role` não pode. O bucket público libera a leitura pela URL, mas uploads continuam sujeitos à política. O app usa caminhos aleatórios e `upsert: false`, então não precisa de políticas de `SELECT` ou `UPDATE`.

Como qualquer chave publicável pode ser extraída do binário, essa política é apropriada somente para avatares públicos e ainda permite que quem possua a chave envie arquivos dentro das restrições do bucket. Monitore a cota; para endurecer uma implantação de produção, mova o upload para uma rota da API autenticada pelo Firebase e mantenha a chave secreta apenas no servidor.

O app solicita acesso à galeria, trata a recusa, valida tipo/tamanho e grava somente a URL pública HTTPS. Permissões de câmera e microfone são bloqueadas porque o fluxo atual escolhe imagens apenas da galeria.

## Development build, Android, iOS e push

Notificações remotas não devem ser validadas no Expo Go. O projeto inclui `expo-dev-client`, `expo-notifications`, `expo-constants`, o plugin de notificações, `projectId` EAS e perfis no `eas.json`.

O `.env` local não é enviado ao EAS Build. Cadastre todas as variáveis abaixo nos ambientes `development`, `preview` e `production` do projeto EAS, pela dashboard ou por `npx eas-cli@latest env:set`:

```text
EXPO_PUBLIC_API_URL
EXPO_PUBLIC_FIREBASE_API_KEY
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN
EXPO_PUBLIC_FIREBASE_DATABASE_URL
EXPO_PUBLIC_FIREBASE_PROJECT_ID
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
EXPO_PUBLIC_FIREBASE_APP_ID
EXPO_PUBLIC_SUPABASE_URL
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
EXPO_PUBLIC_SUPABASE_BUCKET
```

Copie os valores Firebase de `firebaseConfig.json`; use `https://cp5-mobile.onrender.com` em `EXPO_PUBLIC_API_URL`; e obtenha URL, chave **publishable** e nome do bucket no projeto Supabase. Os perfis de `eas.json` já selecionam o ambiente correspondente. Essas variáveis são incorporadas ao aplicativo e devem conter somente valores públicos. Nunca configure `FIREBASE_PRIVATE_KEY`, uma chave `service_role` ou qualquer outro segredo como variável `EXPO_PUBLIC_*`.

```bash
# autenticar e conferir credenciais
npx eas-cli@latest login
npx eas-cli@latest credentials

# APK Android autônomo para avaliação
npx eas-cli@latest build --profile preview --platform android

# development builds para depuração com o Metro
npx eas-cli@latest build --profile development --platform android
npx eas-cli@latest build --profile development --platform ios
```

No Android, envie uma conta de serviço FCM V1 ao EAS e instale o APK `preview` ou o development build em um aparelho físico. O APK `preview` é autônomo; somente o development build exige `npx expo start`. No iOS, registre um aparelho físico, use uma conta Apple Developer paga e configure a chave APNs solicitada pelo EAS.

É obrigatório reconstruir o app depois de alterar `app.json`, instalar/atualizar um módulo nativo ou atualizar o SDK. Push em segundo plano/fechado, FCM/APNs e a abertura da conversa ao tocar na notificação precisam ser comprovados em ambiente compatível antes da entrega.

## API de notificações

- URL pública: `https://cp5-mobile.onrender.com`
- Health check: `GET /health`
- Envio de push: `POST /notifications/messages`
- Processamento de recibos: `POST /notifications/receipts`
- Sincronização: `POST /sync-members`
- Grupos: `POST /groups`, `POST /groups/:id/join`, `POST /groups/:id/leave` e `PUT /groups/:id`

O app envia `Authorization: Bearer <Firebase ID Token>` e, após persistir a mensagem, somente `conversationId` e `messageId`. A API relê a mensagem no RTDB, confirma o remetente, consulta Firestore, calcula destinatários ativos e usa uma transação em `pushSent` para impedir duplicidade.

Para executar localmente:

```bash
cd server
npm install
cp .env.example .env
npm run typecheck
npm test
npm run build
npm start
```

No Render, configure manualmente o serviço com raiz `server`, build `npm ci && npm run build`, start `npm start`, Node 22.13 e health check `/health`. Cadastre `FIREBASE_PROJECT_ID`, `FIREBASE_DATABASE_URL`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` e `CRON_SECRET` exclusivamente como segredos. `EXPO_ACCESS_TOKEN` é opcional e só é necessário se a segurança aprimorada do Expo Push estiver habilitada. Agende uma chamada autenticada a `POST /notifications/receipts`, enviando `CRON_SECRET` no cabeçalho `x-cron-secret`, para processar tickets e desativar tokens inválidos.

No logout, o app desativa primeiro o token Expo Push do aparelho e só então encerra a sessão. Se essa desassociação falhar, o logout é interrompido e a interface pede nova tentativa, evitando que um aparelho compartilhado continue recebendo mensagens da conta anterior. Uma rotação de token também desativa o documento antigo antes de registrar o novo.

Use uma conta de serviço dedicada e conceda apenas as permissões necessárias para Authentication, Firestore e Realtime Database; não use Owner/Editor. Nenhum arquivo de conta de serviço deve ser versionado.

## Políticas e concorrência

- `all_group_messages`: notifica integrantes ativos, exceto o remetente.
- `mentioned_members`: notifica apenas integrantes mencionados ou selecionados.
- `direct_messages_only`: grupos não geram push; conversas diretas continuam habilitadas.
- `disabled`: a conversa não gera push.

O proprietário é o único que altera a política do grupo. Adições de integrantes usam transação do Firestore: a API relê proprietário, integrantes e `memberLimit`, valida a última vaga e grava o novo estado atomicamente. `membershipVersion` e uma transação no espelho `chat_members` do RTDB impedem sincronizações antigas de restaurarem acesso removido.

## Evidências e validação final

As verificações automatizadas disponíveis são:

```bash
npm run check
npm run test:firebase-rules
npm run test:api
cd server && npm run typecheck && npm test
```

### Galeria de evidências

<p align="center">
  <img src="docs/evidencias/WhatsApp%20Image%202026-10-13%20at%2021.39.01.jpeg" width="30%" />
  <img src="docs/evidencias/WhatsApp%20Image%202026-10-13%20at%2021.41.16.jpeg" width="30%" />
  <img src="docs/evidencias/WhatsApp%20Image%202026-10-13%20at%2021.41.46.jpeg" width="30%" />
  <img src="docs/evidencias/WhatsApp%20Image%202026-10-13%20at%2021.42.02.jpeg" width="30%" />
  <img src="docs/evidencias/WhatsApp%20Image%202026-10-13%20at%2021.42.42.jpeg" width="30%" />
  <img src="docs/evidencias/WhatsApp%20Image%202026-10-13%20at%2021.46.13.jpeg" width="30%" />
  <img src="docs/evidencias/WhatsApp%20Image%202026-10-13%20at%2021.46.41.jpeg" width="30%" />
  <img src="docs/evidencias/WhatsApp%20Image%202026-10-13%20at%2021.48.16.jpeg" width="30%" />
  <img src="docs/evidencias/WhatsApp%20Image%202026-10-13%20at%2021.48.38.jpeg" width="30%" />
  <img src="docs/evidencias/WhatsApp%20Image%202026-10-13%20at%2021.50.12.jpeg" width="30%" />
  <img src="docs/evidencias/WhatsApp%20Image%202026-10-13%20at%2021.51.28.jpeg" width="30%" />
  <img src="docs/evidencias/WhatsApp%20Image%202026-10-13%20at%2021.52.06.jpeg" width="30%" />
  <img src="docs/evidencias/WhatsApp%20Image%202026-10-13%20at%2021.52.47.jpeg" width="30%" />
</p>

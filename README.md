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

## 🔒 Regras de Segurança, Infraestrutura e Transações (Firebase)

**Firestore (Perfis e Grupos):**
- As regras de `firestore.rules` validam tipos intrínsecos e impõem políticas estruturais. O limite de grupo (`memberLimit`) é checado rigidamente como `int >= 2` durante a criação.
- Vagas Concorrentes: A entrada/saída de grupos é operada transacionalmente pelo Backend (Express + `adminFirestore.runTransaction`). O backend verifica o limite e o número de vagas restantes e aplica simultaneamente no Firestore e RTDB (`chat_members`), fechando qualquer janela de vulnerabilidade de concorrência ou escuta indevida de dados.
- Privacidade de Perfis: Telefones e Datas de nascimento são processados na raiz `users/{uid}`, porém as regras Firestore impedem qualquer leitura direta externa. Os dados de terceiros só trafegam quando o Backend detecta que você compartilha conversas com eles.

**Configuração de Fotos (Storage):**
- As fotos de perfil e grupo são subidas no Firebase Storage com o prefixo `/users/` ou `/groups/`.
- O arquivo `storage.rules` restringe uploads exclusivamente a usuários autenticados cujos arquivos passem na restrição de `content-type` (`image/*`) e limite de tamanho (`< 5MB`). O App solicita explicitamente a Permissão de Galeria via `expo-image-picker`.

**Políticas de Notificação e Receipt Cleanup:**
- `all_group_messages`: Envia push a todos exceto ao remetente.
- `mentioned_members`: Filtra e notifica exclusivamente quem foi mencionado por `@` na mensagem (verificado via Firebase).
- `direct_messages_only`: Silencia pushes ativamente para os grupos que a adotam.
- `disabled`: Desativa o processamento de Push, mas retém logs de tentativa.
- Processamento de Receipts: O Endpoint `POST /notifications/receipts` protegido por `x-cron-secret` roda periodicamente para consultar `getReceipts` do Expo Push Service e invalidar devices desregistrados assíncronamente.

---

## 📸 Evidências Reais de Funcionamento

*(O arquivo da print final da avaliação será colocado abaixo para demonstração física no dispositivo).*
![Push Notification Evidence](https://via.placeholder.com/400x200?text=Evidencia+de+Push+Aqui)

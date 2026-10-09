# Checklist para nota máxima — Chat React Native com Firebase

> Objetivo: acompanhar a implementação e a entrega de todos os requisitos avaliados (10,00 pontos).
>
> Marque um item somente depois de implementá-lo e testá-lo. Os itens marcados como **CRÍTICO** podem zerar uma parte importante da nota ou todo o trabalho.

## 0. Bloqueadores e requisitos gerais

- [x] Aplicativo feito em React Native, Expo SDK 55 ou superior e TypeScript.
- [ ] Aplicativo funcionando corretamente no Android.
- [ ] Aplicativo funcionando corretamente no iOS.
- [ ] Push testado em dispositivo físico ou ambiente compatível.
- [ ] Development build/build nativo configurado quando o Expo Go não for suficiente.
- [ ] Firebase Authentication, Realtime Database, Cloud Firestore e FCM usados de forma realmente funcional.
- [ ] Nenhuma funcionalidade obrigatória é apenas simulada ou mantida somente no estado local.
- [x] Nenhum `any` é usado no projeto.
- [x] Não são usadas Cloud Functions para enviar notificações.
- [x] **CRÍTICO:** nome completo e RM de todos os integrantes estão no README (máximo de cinco integrantes; a ausência resulta em nota zero).

## 1. Autenticação por e-mail e senha — 0,75

- [ ] Cadastro usa exclusivamente e-mail e senha.
- [ ] Cadastro solicita nome, e-mail, senha, confirmação de senha, celular, data de nascimento e foto.
- [ ] Conta é criada no Firebase Authentication.
- [ ] Perfil completo é salvo no Firestore e associado ao `uid` real.
- [ ] Login com e-mail e senha funciona.
- [ ] Sessão autenticada é recuperada ao reabrir o app.
- [ ] Credenciais inválidas e sessão expirada recebem tratamento e mensagem compreensível.
- [ ] Logout encerra a sessão, limpa o usuário do estado, remove listeners e volta à autenticação.
- [ ] Depois do logout, o usuário anterior não acessa rotas nem conversas protegidas.
- [ ] Não existem login Google/Apple, usuário anônimo ou usuário hardcoded.

## 2. Conversa individual — 0,75

- [ ] Toda conversa individual possui exatamente dois usuários autenticados.
- [ ] O usuário não consegue iniciar conversa consigo mesmo.
- [ ] Existe apenas uma conversa para cada par de usuários.
- [ ] O identificador da conversa é determinístico (por exemplo, `uid`s ordenados).
- [ ] A tela de usuários lista e permite buscar/filtrar usuários cadastrados.
- [ ] É possível iniciar a conversa pela tela de usuários.
- [ ] O chat mostra nome e foto do outro participante.
- [ ] Tocar na foto abre o perfil permitido do participante.
- [ ] Mensagens individuais são persistidas no Realtime Database.
- [ ] Mensagem individual gera push ao destinatário, conforme as regras aplicáveis.

## 3. Criação e gerenciamento de grupos — 1,25

- [x] Um grupo possui nome, foto, proprietário e no mínimo dois integrantes.
- [x] Proprietário e integrantes são identificados por `uid`.
- [x] É possível criar e editar o grupo.
- [x] O proprietário consegue adicionar e remover integrantes.
- [x] Somente o proprietário consegue gerenciar integrantes e configurações.
- [x] Somente integrantes ativos conseguem ler e enviar mensagens.
- [x] Usuário removido deixa de enviar e receber novas mensagens imediatamente.
- [ ] Tela do grupo mostra quantidade atual de integrantes e vagas disponíveis.
- [ ] Tocar na foto do grupo abre a lista completa de integrantes.
- [ ] Selecionar um integrante abre seu perfil permitido.
- [ ] Mensagens gerais do grupo ficam visíveis no histórico.
- [ ] É possível mencionar ou selecionar explicitamente um integrante como destinatário.
- [ ] Mensagem direcionada continua pertencendo ao histórico do grupo.

## 4. Limite configurável e concorrência — 1,00

- [x] `memberLimit` é definido na criação do grupo.
- [x] O limite aceita somente número inteiro válido.
- [x] O proprietário consegue alterar o limite.
- [x] O limite não pode ficar abaixo da quantidade atual de integrantes.
- [x] Ninguém pode ser adicionado quando o limite é atingido.
- [x] A interface informa claramente o total atual e as vagas restantes.
- [x] A interface valida o limite antes da operação.
- [x] O banco ou a API também valida o limite; não depende apenas do botão desabilitado.
- [x] Operação atômica, transação ou mecanismo equivalente impede que entradas simultâneas ultrapassem o limite.
- [ ] Concorrência foi testada com duas ou mais tentativas simultâneas na última vaga.
- [x] A estratégia contra concorrência está explicada no README.

## 5. Realtime Database e sincronização — 1,25

- [ ] Todas as mensagens individuais e de grupo são persistidas no Realtime Database.
- [ ] Cada mensagem possui ID, conversa, tipo, remetente, texto, alvo, menções e data/hora.
- [ ] A mensagem usa o `senderId` do usuário autenticado.
- [ ] A conversa aberta recebe novas mensagens automaticamente, sem atualização manual.
- [ ] Listeners acompanham corretamente a conversa atual.
- [ ] Listeners são removidos ao desmontar a tela, trocar de conversa e fazer logout.
- [ ] Falhas de leitura, escrita e conectividade são tratadas.
- [ ] Não existem mensagens simuladas ou mantidas apenas no estado local.

## 6. Uso funcional do Cloud Firestore — 1,00

- [ ] Perfis de usuários são armazenados no Firestore.
- [ ] Conversas individuais e seus participantes/metadados são armazenados no Firestore.
- [x] Grupos e seus metadados são armazenados no Firestore.
- [x] Integrantes, proprietário e limite do grupo são armazenados no Firestore.
- [x] Política de notificação da conversa é armazenada no Firestore.
- [ ] Tokens dos dispositivos, plataforma, estado e preferências são armazenados com segurança.
- [x] Fotos são enviadas a um serviço próprio para armazenamento de arquivos.
- [x] Apenas a URL final da foto é armazenada no Firestore.
- [x] Nenhuma imagem Base64 é armazenada no Firestore ou Realtime Database.
- [x] Permissões de acesso à galeria/câmera são solicitadas e tratadas.
- [ ] Existe imagem padrão quando a foto não existe ou falha ao carregar.

## 7. Push notifications e destinatários — 1,50

- [ ] Firebase Cloud Messaging está configurado e funcional.
- [ ] Permissão de notificações é solicitada e a recusa é tratada.
- [ ] Token do dispositivo é registrado, atualizado e associado ao usuário.
- [x] Tokens inválidos são desativados ou removidos.
- [ ] Push funciona com o app em segundo plano ou fechado.
- [x] Payload contém, no mínimo, `conversationId` e `conversationType`.
- [ ] Tocar na notificação abre/direciona à conversa correta.
- [x] O remetente nunca recebe push da própria mensagem.
- [x] Apenas participantes ativos podem receber push.
- [x] O texto da notificação não expõe dados sensíveis desnecessários.

### Políticas obrigatórias

- [x] `all_group_messages`: mensagem geral notifica todos os integrantes, exceto o remetente.
- [x] `mentioned_members`: somente integrantes mencionados/selecionados recebem push.
- [x] `direct_messages_only`: grupos não geram push; somente conversas individuais geram.
- [x] `disabled`: nenhuma mensagem daquela conversa gera push.
- [x] Somente o proprietário consegue alterar a política do grupo.

### API online obrigatória

- [x] Existe API própria separada do aplicativo mobile.
- [x] API está publicada em URL pública com HTTPS.
- [ ] **CRÍTICO:** API permanece online durante toda a correção e não depende de `localhost`, computador ligado ou inicialização manual; caso contrário, os 1,50 pontos deste critério são zerados.
- [x] App envia Firebase ID Token no `Authorization: Bearer`.
- [x] App envia somente `conversationId` e `messageId` após persistir a mensagem.
- [x] API valida o ID Token com Firebase Admin SDK.
- [x] API confirma no Realtime Database que a mensagem existe.
- [x] API confirma que o remetente da mensagem é o usuário autenticado.
- [x] API consulta no Firestore participantes, tokens e política.
- [x] API calcula os destinatários no servidor e não confia em uma lista enviada pelo app.
- [x] API envia o push via FCM ou Expo Push Service.
- [x] Endpoint possui idempotência/proteção contra chamadas duplicadas.
- [x] Reenvio da mesma solicitação não produz notificações repetidas.
- [x] Existe endpoint de health check para verificar disponibilidade.

## 8. Segurança do Firebase e backend — 0,75

- [x] Regras do Firestore estão implementadas e versionadas.
- [x] Regras do Realtime Database estão implementadas e versionadas.
- [x] Regras não ficam permanentemente abertas para leitura ou escrita pública.
- [x] Somente usuários autenticados acessam dados protegidos.
- [x] Somente participantes leem e enviam mensagens na conversa.
- [x] Regras validam que `senderId` corresponde ao usuário autenticado.
- [x] Somente o proprietário gerencia o grupo.
- [x] Limite de integrantes é protegido no banco ou na API.
- [x] Tokens de dispositivos não são públicos.
- [x] Perfil só é acessível a usuário autenticado com conversa ou grupo em comum.
- [x] Usuário removido não acessa novas mensagens.
- [x] Validações que cruzam Firestore e Realtime Database são feitas pela API e documentadas.
- [ ] Credenciais administrativas existem somente nas variáveis secretas da hospedagem.
- [ ] Credenciais administrativas têm apenas as permissões mínimas necessárias.
- [x] Nenhuma chave privada, conta de serviço ou credencial administrativa está no app/GitHub.
- [x] O cliente nunca dispara FCM usando credenciais administrativas.

## 9. TypeScript, hooks, services e componentes — 1,00

- [ ] Componentes, props, estados e funções estão tipados.
- [ ] Usuários, conversas, grupos, mensagens e notificações estão tipados.
- [ ] Leituras e escritas no Firebase estão tipadas.
- [ ] Parâmetros de navegação estão tipados.
- [x] Não existe `any`, nem para Firebase ou navegação.
- [ ] Estado é atualizado de forma imutável, sem mutação direta de arrays/objetos.
- [ ] Estados derivados são calculados adequadamente.
- [ ] `useState` é usado com finalidade real.
- [ ] `useEffect` é usado com finalidade real e possui limpeza quando necessária.
- [ ] `useMemo` é usado com finalidade real.
- [ ] `useCallback` é usado com finalidade real.
- [x] Autenticação, usuários, grupos, chat e notificações possuem responsabilidades separadas.
- [x] Services concentram acesso ao Firebase/API e regras de integração.
- [ ] Componentes reutilizáveis separam mensagens, entrada, itens, loading e erros.
- [ ] Código não relacionado a rotas fica fora do diretório de rotas.

## 10. Interface, loading e erros — 0,75

### Login e cadastro

- [ ] Todos os campos obrigatórios e confirmação de senha estão presentes.
- [ ] Existem loading e mensagens de erro compreensíveis.

### Conversas e usuários

- [ ] Lista reúne conversas individuais e grupos com identificação visual do tipo.
- [ ] Existem acessos para criar conversa individual e grupo.
- [ ] Existe estado vazio e opção de logout.
- [ ] Lista de usuários possui busca/filtro e impede selecionar o próprio usuário.

### Criação/edição de grupo

- [ ] Tela permite editar nome, foto, integrantes, limite e política.
- [ ] Tela apresenta validações, mensagens de erro, total atual e vagas.

### Chat e perfil

- [ ] Chat diferencia mensagens enviadas e recebidas.
- [ ] Mensagens de grupo identificam o autor.
- [ ] Chat possui campo, envio, rolagem, menção/seleção de membro e estado vazio.
- [ ] Falha no envio apresenta feedback compreensível.
- [ ] Perfil mostra foto, nome, e-mail, celular e nascimento.
- [ ] Perfil trata campos indisponíveis.

### Estados e falhas

- [ ] Há feedback para loading, erro e usuário não autenticado.
- [ ] Há estados para nenhuma conversa, nenhum usuário, grupo sem vagas e chat vazio.
- [ ] Há tratamento para falha de envio, permissão negada, ausência de token e conectividade.
- [ ] Erros não expõem detalhes internos, tokens ou credenciais.

## 11. README e evidências da entrega

- [ ] README contém nome e descrição do projeto.
- [ ] README lista tecnologias e versão do Expo.
- [ ] README explica a função de Authentication, Realtime Database, Firestore e FCM.
- [ ] README contém instruções de instalação e execução.
- [ ] README documenta a configuração do Firebase.
- [ ] README documenta o serviço de armazenamento das fotos e sua configuração.
- [ ] README explica a configuração de notificações no Android e iOS.
- [ ] README explica quando e como usar development build/build nativo.
- [x] README documenta tecnologia, configuração, execução e publicação da API.
- [x] README informa URL pública, endpoints e health check da API.
- [ ] README apresenta a estrutura do projeto.
- [x] README explica as quatro políticas de notificação.
- [x] README explica a proteção do limite contra concorrência.
- [x] README documenta as regras do Firestore e Realtime Database.
- [ ] README contém prints das telas.
- [ ] README contém evidência de notificação recebida.
- [x] **CRÍTICO:** README contém nome completo e RM de todos os integrantes.

## 12. Arquivos e segredos no repositório

- [ ] Existe `firebaseConfig.json` na raiz/posição documentada, com esse nome exato.
- [ ] `firebaseConfig.json` corresponde ao projeto Firebase entregue.
- [ ] Arquivo contém `apiKey`, `authDomain`, `databaseURL`, `projectId`, `storageBucket`, `messagingSenderId` e `appId`.
- [ ] `firebaseConfig.json` está versionado no GitHub.
- [ ] `firebaseConfig.json` contém somente configuração pública do SDK cliente.
- [x] Existem `.env.example` para app e API, quando aplicável.
- [x] `.env.example` lista somente nomes e valores fictícios/marcadores.
- [x] `.gitignore` impede versionamento de segredos e credenciais administrativas.
- [x] Não há `serviceAccountKey.json`, credencial Admin, senha, token ou chave privada no histórico/repositório.

## 13. Validação final e envio

- [ ] Fluxo completo foi testado com pelo menos dois usuários reais autenticados.
- [ ] Grupo, remoção de membro, limite e concorrência foram testados.
- [ ] As quatro políticas de push foram testadas com destinatários diferentes.
- [ ] Push foi testado com app aberto, em segundo plano e fechado, conforme suporte esperado.
- [ ] Android e iOS foram testados e diferenças estão documentadas.
- [ ] Regras de segurança foram testadas também com operações que devem ser negadas.
- [x] API pública e health check estão acessíveis externamente.
- [ ] Repositório GitHub permanece acessível durante a correção.
- [ ] Link do repositório GitHub foi enviado no Microsoft Teams.
- [ ] URL pública da API foi enviada no Microsoft Teams.

## Controle da pontuação

| Critério | Valor | Concluído |
|---|---:|:---:|
| Autenticação por e-mail e senha | 0,75 | [ ] |
| Conversa individual | 0,75 | [ ] |
| Criação e gerenciamento de grupos | 1,25 | [ ] |
| Limite configurável e proteção contra concorrência | 1,00 | [ ] |
| Realtime Database e sincronização em tempo real | 1,25 | [ ] |
| Uso funcional do Cloud Firestore | 1,00 | [ ] |
| Push notifications e políticas de destinatários | 1,50 | [ ] |
| Segurança do Firebase e envio pelo backend | 0,75 | [ ] |
| TypeScript, hooks, services e componentização | 1,00 | [ ] |
| Interface, loading e tratamento de erros | 0,75 | [ ] |
| **Total** | **10,00** | [ ] |

# Plano de Implementação — ShortLink

**Versão:** 0.1  
**Status:** Aguardando aprovação  
**Data:** 2026-10-30  
**Referências:** `docs/PRD.md`, `AGENTS.md`

> Este documento é uma proposta de planejamento técnico. Nenhuma tarefa deve ser iniciada antes da aprovação explícita. Decisões marcadas como **[Proposto]** ou **[Pendente]** não são definitivas até aprovação.

## Legenda

- **[Aprovado]** — já estabelecido no PRD ou no `AGENTS.md`.
- **[Proposto]** — recomendação deste plano; precisa de aprovação.
- **[Pendente]** — decisão em aberto; não implementar como se estivesse definida.

## Estado atual verificado

- A Fase 0 foi implementada: workspace pnpm, esqueletos de `apps/api`, `apps/web` e `packages/contracts`, TypeScript estrito, ESLint, Prettier, Husky, README, `.env.example`, `firebase.json` e `firestore.rules`.
- O repositório Git possui remote `origin` para `github.com/davi1985/shortlink.git` e o commit inicial `8d9b778` com a documentação. As alterações da Fase 0 permanecem no working tree até revisão.
- A plataforma de CI definida é **GitHub Actions**.
- Ambiente local disponível: Node `v24.19.0`, pnpm `10.1.0`, npm `11.17.0`, Java `21.0.7`.
- O PRD foi ajustado para usar **Vitest** no backend e no frontend. Não restam referências a Jest.
- Não há regras de negócio, testes de negócio, backend executável nem frontend funcional nesta etapa.

---

# 1. Objetivo e escopo do MVP

## 1.1 Objetivo

Entregar uma aplicação web full-stack que permita criar URLs curtas, opcionalmente com alias personalizado e expiração configurável (padrão de 24 horas), e redirecionar o navegador para o destino original. A aplicação deve ser testável, segura para o escopo anônimo do MVP e organizada para evolução futura.

## 1.2 Escopo incluído

- Criação anônima de URLs curtas.
- Geração automática de códigos Base62 com unicidade garantida pelo armazenamento.
- Aliases personalizados, incluindo detecção de conflito e lista de reservados.
- Expiração lógica obrigatória, com padrão de 24 horas e validação no backend.
- Redirecionamento HTTP 302 com `Cache-Control: no-store`.
- Página de erro HTML para o endpoint de redirecionamento.
- Health check sem dependência do Firestore.
- Rate limit em memória por IP na criação.
- Interface responsiva, acessível e com estados de carregamento, erro, sucesso e cópia.
- Contratos e validações compartilhados no pacote `contracts`.
- Testes unitários, de integração, de frontend e E2E.
- Documentação de execução, arquitetura e decisões.

## 1.3 Fora do escopo

Tudo o que o PRD lista como não objetivo do MVP, incluindo autenticação, analytics, contagem de cliques, QR Codes, edição de destino, CDN dedicada, Redis, filas, microsserviços, aplicativo mobile e API pública com chaves.

## 1.4 Premissas

- O produto será público e anônimo no MVP.
- O Firestore será acessado somente pelo backend.
- O backend servirá API e redirecionamento no mesmo serviço.
- O frontend será estático na Vercel e consumirá a API por HTTPS.
- Nenhuma funcionalidade será considerada concluída sem as verificações da seção 8.

---

# 2. Arquitetura proposta

## 2.1 Visão de contexto

```text
Navegador
  |
  | HTTPS
  +--> Vercel (React + Vite, estático)
  |       |
  |       | fetch JSON em /api/v1
  |       v
  +--> Render (NestJS + Fastify)
          |-- POST /api/v1/urls
          |-- GET  /api/v1/health
          |-- GET  /api/docs          (documentação, conforme configuração)
          |-- GET  /:code             (redirecionamento)
          |
          v
    Firebase Admin SDK
          |
          v
    Cloud Firestore (coleção "urls")
          ^
          |
    Regras negando acesso direto de clientes
```

**Decisões associadas:**

- **[Aprovado]** Backend no Render; frontend na Vercel; Firestore como persistência.
- **[Aprovado]** Firestore acessado exclusivamente pelo backend.
- **[Proposto]** Prefixos de rota declarados explicitamente nos controllers (`api/v1/...`), sem depender de `setGlobalPrefix`, para evitar conflito entre `/api/v1/*` e `GET /:code`.
- **[Proposto]** Documentação Swagger em `/api/docs`, reduzindo risco de conflito com aliases reservados.

## 2.2 Fluxo de criação

1. O usuário preenche URL, alias opcional e expiração.
2. O frontend valida com os esquemas de `contracts` e envia `POST /api/v1/urls`.
3. O Fastify aplica o limite de corpo de 16 KB.
4. O rate limit por IP é verificado.
5. O pipe de Zod valida o corpo com o contrato compartilhado.
6. O serviço de aplicação valida regras de domínio:
   - URL HTTP/HTTPS, sem credenciais embutidas e dentro do limite.
   - Expiração válida, futura e dentro do máximo configurado.
   - Alias válido e não reservado, quando informado.
7. O serviço tenta persistir com criação atômica sem sobrescrita.
8. Para alias personalizado, conflito retorna erro de negócio.
9. Para código gerado, colisões são tratadas com novas tentativas até o limite configurado.
10. Somente após persistência bem-sucedida a API responde `201 Created`.
11. O frontend exibe código, URL curta, URL original, expiração e ações de copiar/nova criação.

## 2.3 Fluxo de redirecionamento

1. O navegador acessa `GET /:code` no domínio público do backend.
2. O backend valida o formato do código.
3. O backend consulta o documento pelo ID exato, preservando case.
4. Código inexistente, inválido ou expirado retorna `404` em HTML.
5. Código válido e não expirado retorna `302` com `Location` e `Cache-Control: no-store`.
6. Falha inesperada retorna `500` em HTML, sem detalhes internos.
7. O destino vem exclusivamente do registro persistido, nunca da requisição.

## 2.4 Camadas do backend

| Camada | Responsabilidade | Exemplos |
| --- | --- | --- |
| Transporte HTTP | Rotas, DTOs, pipes, guards, filtros, status e headers | Controllers, Zod pipe, filtro global, rate limit guard |
| Aplicação | Orquestração de casos de uso | Criar URL, resolver URL |
| Domínio | Regras que não dependem de Firestore ou Nest | Políticas de URL, alias, expiração, geração de código, entidade |
| Infraestrutura | Implementações concretas | Repositório Firestore, gerador criptográfico, relógio, configuração |

**Direção de dependência:** transporte e infraestrutura dependem do domínio/aplicação; o domínio não conhece Firestore, NestJS ou Fastify.

**Portas propostas:**

- `UrlRepository`: criar sem sobrescrever e buscar por código.
- `CodeGenerator`: gerar código compatível com Base62 e comprimento configurado.
- `Clock`: fornecer o instante atual para testes determinísticos.

**Decisões associadas:**

- **[Aprovado]** Lógica de negócio separada de controllers e do SDK do Firestore.
- **[Proposto]** Uma única `createIfAbsent` no repositório, mapeando conflito do armazenamento para resultado de domínio, sem transação (a criação de um único documento já é atômica no Firestore).
- **[Proposto]** Relógio injetável para testar expiração sem depender do tempo real.

## 2.5 Frontend

Separação proposta:

- `pages/`: composição da página.
- `components/`: formulário, seletor de expiração, resultado, botão de cópia e mensagens.
- `hooks/`: estado da criação (`idle`, `submitting`, `success`, `error`).
- `services/`: cliente HTTP tipado, normalização de erros de rede e da API.
- `test/`: setup do Vitest e utilitários de teste.
- `e2e/`: testes Playwright.

**Decisões associadas:**

- **[Aprovado]** Componentes, páginas e acesso à API separados.
- **[Proposto]** Sem biblioteca de formulários ou de estado global no MVP; estado local com React e validação por Zod.
- **[Proposto]** Sem `axios`; usar `fetch` nativo com um wrapper pequeno.
- **[Proposto]** Tipos da API vêm de `contracts`; tipos exclusivos de UI ficam no frontend.

## 2.6 Contratos compartilhados

O pacote `contracts` deve conter:

- Esquemas Zod de requisição, resposta, health e erro.
- Tipos inferidos dos esquemas.
- Códigos de erro estáveis do PRD.
- Constantes e regras compartilháveis: regex de alias, limites padrão de URL/alias, opções de expiração e expiração padrão.
- Testes unitários dos esquemas.

**Decisões associadas:**

- **[Aprovado]** `contracts` é a fonte única de validação e tipos da API.
- **[Aprovado]** Ordem de build `contracts` → `api`/`web`.
- **[Proposto]** O backend continua sendo a autoridade final; limites configuráveis no backend podem divergir dos padrões usados pelo frontend, e isso deve ser aceito e documentado.

## 2.7 Persistência, unicidade e concorrência

Modelo aprovado:

- Coleção `urls`.
- ID do documento = código curto exatamente como informado/gerado, preservando maiúsculas e minúsculas.
- Campos: `originalUrl`, `createdAt`, `expiresAt`, `isCustomAlias`.
- Sem contador de cliques.

Estratégia:

- Usar criação de documento que falha se o ID já existir.
- Nunca usar operação que sobrescreva documento existente.
- Alias personalizado: uma tentativa atômica; conflito vira `ALIAS_TAKEN`.
- Código gerado: gerar e tentar criar; em conflito, repetir até `MAX_GENERATION_ATTEMPTS`.
- Esgotar tentativas de geração vira erro controlado, sem registro parcial.
- Consulta prévia é opcional e apenas para UX; não garante unicidade.
- Não há necessidade de transação multi-documento no MVP.

## 2.8 Expiração

- `expiresAt` é sempre persistido, em UTC.
- Sem `expiresAt` na requisição, o backend aplica `agora + 24h` (configurável).
- Datas iguais ou anteriores ao instante de criação são rejeitadas.
- Datas acima de `MAX_EXPIRATION_HOURS` a partir da criação são rejeitadas.
- Expiração lógica é verificada em toda resolução: `agora >= expiresAt` significa expirado.
- Registros expirados podem permanecer no banco; não há remoção física nem reutilização de código no MVP.
- O frontend pode omitir `expiresAt` na opção de 24h para evitar diferença de relógio/latência.
- O backend valida a expiração independentemente da UI.

## 2.9 Tratamento de erros

- Endpoints sob `/api/v1` retornam JSON no formato:

```json
{
  "error": {
    "code": "ALIAS_TAKEN",
    "message": "O alias informado já está em uso.",
    "fields": {
      "customAlias": "Alias indisponível."
    }
  }
}
```

- `fields` é opcional e usado apenas em validação por campo.
- Códigos estáveis: `INVALID_URL`, `INVALID_ALIAS`, `ALIAS_TAKEN`, `INVALID_EXPIRATION`, `PAYLOAD_TOO_LARGE`, `RATE_LIMITED`, `INTERNAL_ERROR`.
- `GET /:code` retorna HTML simples para erros, com status apropriado.
- O erro de redirecionamento e o sucesso usam `Cache-Control: no-store`.
- Stack traces e detalhes internos nunca vão para a resposta.
- Erros desconhecidos são registrados no servidor com informação suficiente para diagnóstico, sem persistir IP ou URL original por padrão.

Mapeamento proposto:

| Código | HTTP | Situação |
| --- | --- | --- |
| `INVALID_URL` | 400 | URL ausente, inválida, protocolo não permitido, credenciais embutidas ou acima do limite |
| `INVALID_ALIAS` | 400 | Alias com formato inválido, tamanho inválido ou reservado |
| `ALIAS_TAKEN` | 409 | Alias já ocupado |
| `INVALID_EXPIRATION` | 400 | Data inválida, passada, igual ao instante atual ou acima do máximo |
| `PAYLOAD_TOO_LARGE` | 413 | Corpo acima do limite |
| `RATE_LIMITED` | 429 | Limite por IP excedido, com `Retry-After` |
| `INTERNAL_ERROR` | 500 | Falha inesperada ou esgotamento controlado de geração |

## 2.10 Rate limit

- Em memória, por IP, somente na criação.
- Padrão: 10 requisições por minuto por IP.
- Resposta `429` com `Retry-After` em segundos.
- `trust proxy` configurado para o Render, sem confiar cegamente em cabeçalhos do cliente.
- Limitações documentadas: não é compartilhado entre instâncias e reinicia com o processo.
- Limpeza de entradas expiradas para evitar crescimento indefinido da memória.

## 2.11 Segurança e privacidade

- Validação no backend mesmo com validação no frontend.
- Somente HTTP/HTTPS; rejeitar credenciais embutidas.
- O servidor não busca a URL de destino na criação.
- O redirecionamento usa apenas o destino persistido.
- Firestore Admin SDK somente no backend; regras negam clientes.
- Segredos apenas em variáveis de ambiente/secrets.
- CORS restritivo em produção.
- Limite de corpo e de entrada aplicados no backend.
- Não persistir IPs; o rate limit mantém IPs apenas em memória e por tempo limitado.
- Não logar URL original, IP ou credenciais por padrão.
- Documentação Swagger sem segredos.

## 2.12 Hospedagem

- Backend: um web service no Render (plano gratuito).
- Frontend: aplicação estática na Vercel.
- Firestore: projeto Firebase acessado apenas pelo backend.
- HTTPS fornecido pelas plataformas.
- Credenciais do Firebase Admin via secret file/variável de ambiente no Render.
- Health check do Render apontando para `GET /api/v1/health`.
- Cold start do Render não entra nas metas de desempenho.

---

# 3. Stack tecnológica e justificativas

## 3.1 Stack aprovada

| Camada | Tecnologia | Status | Justificativa |
| --- | --- | --- | --- |
| Monorepo | pnpm + workspaces | Aprovado | Simples, sem necessidade de orquestrador adicional no MVP |
| Frontend | React + Vite + TypeScript | Aprovado | Stack definida no PRD |
| Estilo | Tailwind CSS | Aprovado | Definido no PRD; produtividade e consistência visual |
| Validação | Zod | Aprovado | Contratos compartilhados entre frontend e backend |
| Backend | NestJS + Fastify | Aprovado | Estrutura modular e HTTP de baixo overhead |
| Persistência | Firebase Admin SDK + Firestore | Aprovado | Escolha inicial do PRD, com avaliação de custos |
| Testes backend | Vitest | Aprovado | Correção explícita do projeto: frontend e backend usam Vitest |
| Testes frontend | Vitest + React Testing Library | Aprovado | Comportamento observável e integração com Vite |
| E2E | Playwright | Aprovado | Fluxos completos no navegador |
| Qualidade | ESLint + Prettier + TypeScript estrito | Aprovado | Padronização e segurança de tipos |
| Git hooks | Husky | Aprovado (solicitado) | Validação de pre-commit antes de cada commit |
| API docs | `@nestjs/swagger` | Aprovado | Documentação OpenAPI exigida pelo PRD |

## 3.2 Dependências adicionais propostas

| Dependência | Status | Motivo | Alternativa |
| --- | --- | --- | --- |
| `unplugin-swc` | Proposto | Vitest usa esbuild; NestJS depende de metadados de decorators para injeção. SWC emite `emitDecoratorMetadata`. | Evitar dependência usando `@Inject` explícito em todos os pontos; mais verboso e menos idiomático |
| `firebase-tools` (dev) | Proposto | Executar Firestore Emulator nos testes de integração e E2E | Testar contra Firestore real; rejeitado por isolamento e segurança |
| `tsup` (dev) | Proposto | Build dual ESM+CJS + tipos para `contracts`, consumido por Vite e Nest | Dois builds com `tsc`; mais configuração manual |
| `jsdom` (dev) | Proposto | Ambiente DOM para testes do frontend | Nenhuma alternativa prática no MVP |
| `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom` (dev) | Proposto | Testes de comportamento e acessibilidade | Testes manuais de DOM; menos produtivos |
| `@playwright/test` (dev) | Aprovado pelo PRD | E2E | — |
| `@fastify/cors` (ou plugin compatível) | Proposto | CORS no adaptador Fastify | Middleware manual; menos seguro e mais código |
| `swagger-ui` via `@nestjs/swagger` | Aprovado pelo PRD | UI de documentação | Documento OpenAPI sem UI; não atende ao PRD |

## 3.3 Dependências deliberadamente evitadas no MVP

| Item | Motivo |
| --- | --- |
| Redis | Fora do escopo aprovado; sem requisito de cache/fila |
| Turborepo/Nx | pnpm workspace é suficiente para três pacotes |
| Biblioteca de formulário | Estado local + Zod atende ao formulário simples |
| `axios` | `fetch` nativo é suficiente |
| `date-fns`/`dayjs` | `Date` e `Intl` nativos atendem ao MVP |
| `@nestjs/throttler` | Rate limit customizado é pequeno e permite controlar `Retry-After` |
| Sentry/APM | Fora do escopo; Nest Logger é suficiente no MVP |
| Axe | Testes de acessibilidade básicos com Testing Library; evitar dependência extra |
| `nestjs-zod` | O PRD exige pipe customizado; DTOs de documentação podem ser manuais |

## 3.4 Política de versões

- **[Proposto]** Usar versões estáveis e compatíveis, fixadas no `package.json`/lockfile na Fase 0.
- **[Proposto]** Node 24 LTS e pnpm 10 como base local; confirmar suporte no Render antes do deploy.
- **[Proposto]** Tailwind CSS estável (v4 se compatível com o ecossistema; caso contrário, v3).
- **[Aprovado]** Nada experimental sem justificativa documentada.

---

# 4. Estrutura de diretórios sugerida

```text
shortlink/
├── AGENTS.md
├── README.md
├── package.json
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── tsconfig.base.json
├── eslint.config.js
├── .prettierrc
├── .gitignore
├── .env.example
├── firebase.json
├── firestore.rules
├── .github/
│   └── workflows/ci.yml
├── .husky/
│   └── pre-commit
├── docs/
│   ├── IMPLEMENTATION_PLAN.md
│   ├── PRD.md
│   └── architecture.md
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   ├── config/
│   │   │   │   ├── env.schema.ts
│   │   │   │   └── config.module.ts
│   │   │   ├── common/
│   │   │   │   ├── filters/http-exception.filter.ts
│   │   │   │   ├── pipes/zod-validation.pipe.ts
│   │   │   │   ├── guards/rate-limit.guard.ts
│   │   │   │   └── errors/api-error.ts
│   │   │   └── modules/
│   │   │       ├── urls/
│   │   │       │   ├── urls.module.ts
│   │   │       │   ├── urls.controller.ts
│   │   │       │   ├── redirect.controller.ts
│   │   │       │   ├── urls.service.ts
│   │   │       │   ├── dto/
│   │   │       │   ├── domain/
│   │   │       │   │   ├── short-url.ts
│   │   │       │   │   ├── code-generator.ts
│   │   │       │   │   ├── alias.policy.ts
│   │   │       │   │   └── expiration.policy.ts
│   │   │       │   ├── ports/url-repository.port.ts
│   │   │       │   └── infrastructure/firestore-url.repository.ts
│   │   │       └── health/
│   │   │           ├── health.module.ts
│   │   │           └── health.controller.ts
│   │   ├── test/
│   │   │   ├── integration/
│   │   │   └── setup/
│   │   ├── vitest.config.ts
│   │   ├── tsconfig.json
│   │   └── package.json
│   └── web/
│       ├── src/
│       │   ├── main.tsx
│       │   ├── App.tsx
│       │   ├── components/
│       │   │   ├── ShortenForm.tsx
│       │   │   ├── ExpirationSelect.tsx
│       │   │   ├── ResultCard.tsx
│       │   │   ├── CopyButton.tsx
│       │   │   └── ErrorMessage.tsx
│       │   ├── pages/HomePage.tsx
│       │   ├── hooks/useCreateShortUrl.ts
│       │   ├── services/api.ts
│       │   ├── types/
│       │   └── test/
│       ├── e2e/
│       │   └── shortlink.spec.ts
│       ├── vitest.config.ts
│       ├── playwright.config.ts
│       ├── tsconfig.json
│       └── package.json
└── packages/
    └── contracts/
        ├── src/
        │   ├── index.ts
        │   ├── url.ts
        │   ├── alias.ts
        │   ├── expiration.ts
        │   ├── errors.ts
        │   └── constants.ts
        ├── test/
        ├── vitest.config.ts
        ├── tsup.config.ts
        ├── tsconfig.json
        └── package.json
```

**Observações:**

- **[Aprovado]** O PRD está em `docs/PRD.md`; as referências do `AGENTS.md` foram atualizadas. Não há duplicação do PRD.
- A árvore acima é uma proposta; nomes de arquivos podem mudar na implementação desde que a separação de responsabilidades seja preservada.
- `firebase.json` e `firestore.rules` são necessários para emulador e regras de segurança.
- Não serão criados outros documentos além do `IMPLEMENTATION_PLAN.md` nesta etapa.

---

# 5. Fases de implementação

## Fase 0 — Fundação do monorepo e tooling

**Objetivo:** criar a base do monorepo, scripts e padrões de qualidade sem implementar regras de negócio.

**Entregáveis:**
- Repositório Git configurado (já inicializado com remote `origin`).
- `pnpm-workspace.yaml`, `package.json` raiz e pacotes vazios.
- `tsconfig.base.json` estrito, ESLint, Prettier, `.gitignore` e `.env.example`.
- Scripts raiz para lint, formatação, typecheck, build e testes.
- Husky configurado com hook `pre-commit` executando validações rápidas.
- README inicial com instalação e comandos.
- `firebase.json` e `firestore.rules` iniciais (regras negando acesso).

**Dependências:** nenhuma.

**Critérios de aceitação:**
- `pnpm install` funciona em clone limpo.
- Workspace reconhece `@shortlink/contracts`, `@shortlink/api` e `@shortlink/web`.
- `pnpm lint`, `pnpm format:check` e `pnpm typecheck` executam sem erros no esqueleto.
- O hook `pre-commit` bloqueia commits quando a validação configurada falha.
- Nenhum segredo, credencial ou arquivo `.env` real é versionado.
- README descreve pré-requisitos e comandos.

**Testes:** nenhum teste de negócio nesta fase; validar scripts, build do esqueleto e bloqueio do hook `pre-commit`.

## Fase 1 — Pacote `contracts`

**Objetivo:** centralizar contratos, validações e constantes compartilhadas.

**Entregáveis:**
- Esquemas Zod de criação, resposta, health e erro.
- Tipos inferidos e código de erro tipado.
- Constantes de limites, regex de alias e expiração.
- Build ESM+CJS com tipos.
- Testes unitários dos esquemas.

**Dependências:** Fase 0.

**Critérios de aceitação:**
- Esquemas aceitam entradas válidas e rejeitam inválidas conforme PRD.
- Códigos de erro são exatamente os do PRD.
- Build de `contracts` conclui e gera artefatos importáveis por API e web.
- Nenhuma regra de negócio de persistência ou HTTP no pacote.

**Testes:** Vitest no `contracts`, cobrindo URL, alias, expiração, payload e erros.

## Fase 2 — Bootstrap do backend e infraestrutura transversal

**Objetivo:** ter uma API NestJS/Fastify executável com configuração validada, health check, erros padronizados e documentação.

**Entregáveis:**
- `main.ts` e `app.module.ts` com Fastify.
- Configuração carregada e validada por Zod.
- Filtro global de exceções e pipe Zod customizado.
- Limite de corpo, CORS e health check.
- Swagger/OpenAPI.
- Harness de testes do backend com Vitest + SWC.

**Dependências:** Fase 1.

**Critérios de aceitação:**
- `GET /api/v1/health` responde `200 {"status":"ok"}` sem acessar Firestore.
- Configuração inválida impede o startup com mensagem clara e sem segredos.
- Corpo acima do limite retorna `413` no formato de erro.
- Erro inesperado retorna `INTERNAL_ERROR` sem stack trace.
- CORS permite apenas as origens configuradas.
- Swagger lista os endpoints implementados.
- Testes de fumaça passam.

**Testes:** unitários de configuração, pipe e filtro; integração de health, 404, 413 e formato de erro.

## Fase 3 — Domínio de URLs e persistência Firestore

**Objetivo:** implementar as regras centrais e a persistência sem expor HTTP de criação ainda.

**Entregáveis:**
- Entidade/modelo de URL curta e relógio injetável.
- Políticas de URL, alias (incluindo reservados) e expiração.
- Gerador criptográfico Base62.
- Porta de repositório e adaptador Firestore.
- Serviço de criação com criação atômica, retry de colisão e tratamento de conflito.
- Emulador Firestore configurado para testes.

**Dependências:** Fase 2.

**Critérios de aceitação:**
- URL inválida, protocolo não permitido e credenciais embutidas são rejeitados.
- Alias inválido/reservado é rejeitado; alias ocupado não sobrescreve.
- Códigos gerados têm comprimento e alfabeto corretos.
- Colisões são tratadas até o limite; esgotamento não cria registro parcial.
- Expiração padrão e validações de intervalo funcionam.
- Testes de concorrência garantem um único vencedor para o mesmo alias.
- Nenhum teste usa Firestore de produção.

**Testes:** unitários com mocks e integração com Firestore Emulator.

## Fase 4 — Endpoint de criação

**Objetivo:** expor `POST /api/v1/urls` com rate limit, erros e documentação.

**Entregáveis:**
- Controller e DTOs de criação.
- Rate limit em memória por IP.
- Construção da URL curta a partir de `PUBLIC_BASE_URL`.
- Mapeamento completo de erros e status.
- OpenAPI atualizado.

**Dependências:** Fase 3.

**Critérios de aceitação:**
- Criação válida retorna `201` com `code`, `shortUrl`, `originalUrl`, `createdAt` e `expiresAt`.
- Erros retornam os códigos e status da seção 2.9.
- `429` inclui `Retry-After`.
- Falha de persistência não retorna sucesso.
- Alias duplicado retorna `409`.
- Rate limit é por IP e não afeta health/redirect.
- OpenAPI reflete o contrato real.

**Testes:** integração de criação, validação, conflito, 413, 429, 500, concorrência, não sobrescrita e formato de erro; unitários do rate limit.

## Fase 5 — Endpoint de redirecionamento

**Objetivo:** implementar `GET /:code` com resolução, expiração e páginas HTML de erro.

**Entregáveis:**
- Controller de redirecionamento.
- Validação de formato do código.
- Consulta por ID exato e verificação de expiração.
- Resposta `302` com `Cache-Control: no-store`.
- Páginas HTML para 404 e 500.
- Testes de integração.

**Dependências:** Fase 3.

**Critérios de aceitação:**
- Código existente e não expirado retorna `302` com `Location` correto.
- Código inexistente, expirado ou com formato inválido retorna `404` HTML.
- Falha inesperada retorna `500` HTML sem detalhes internos.
- Busca é case-sensitive.
- Destino nunca vem de parâmetro da requisição.
- `Cache-Control: no-store` está presente nas respostas de redirect e erro.
- A resolução faz uma leitura por código.

**Testes:** integração de sucesso, 404, expirado via seed, case sensitivity, headers e HTML seguro.

## Fase 6 — Fundação do frontend

**Objetivo:** criar a aplicação React/Vite com Tailwind, estrutura e cliente de API.

**Entregáveis:**
- App Vite + React + TypeScript.
- Tailwind configurado.
- Estrutura de páginas, componentes, hooks e serviços.
- Cliente HTTP tipado com `fetch` e normalização de erros.
- Configuração de `VITE_API_BASE_URL`.
- Setup de testes com Vitest, jsdom e Testing Library.

**Dependências:** Fase 1.

**Critérios de aceitação:**
- `pnpm --filter @shortlink/web build` funciona.
- Tailwind é aplicado corretamente.
- Cliente de API usa contratos e distingue erro de rede de erro HTTP.
- Testes de fumaça renderizam a página inicial.
- Nenhum código do frontend importa Firebase Admin ou APIs exclusivas do Node.

**Testes:** unitários do cliente de API e smoke test de renderização.

## Fase 7 — Interface de criação, resultado e cópia

**Objetivo:** entregar a experiência completa do MVP no frontend.

**Entregáveis:**
- Formulário com URL, alias opcional e expiração.
- Validação com `contracts` e mensagens por campo.
- Estado de carregamento com bloqueio de envio duplicado.
- Resultado com todos os dados exigidos.
- Botão de cópia com Clipboard API, confirmação e fallback.
- Ação de nova criação.
- Estados de erro de validação, alias, rate limit, comunicação e inesperado.
- Responsividade e acessibilidade básica.

**Dependências:** Fase 6 (e contrato estável da Fase 1).

**Critérios de aceitação:**
- Expiração padrão é 24h e a opção de 24h omite `expiresAt`.
- Payload enviado corresponde ao contrato.
- Erros não apagam dados já preenchidos.
- Botão não permite envio duplicado durante a requisição.
- Resultado permanece visível até nova operação.
- Cópia bem-sucedida e falha são comunicadas de forma acessível.
- Formulário e resultado são utilizáveis em telas estreitas e por teclado.
- Testes de comportamento cobrem todos os estados.

**Testes:** Vitest + React Testing Library para validação, estados, payload, cópia, erros, nova criação e acessibilidade básica.

## Fase 8 — E2E e CI

**Objetivo:** validar os fluxos completos no navegador e automatizar as verificações.

**Entregáveis:**
- Configuração do Playwright com API, web e emulador.
- Fixtures de seed/cleanup no Firestore Emulator.
- Cenários 1 a 8 do PRD.
- Workflow de CI no GitHub Actions com todas as verificações obrigatórias.
- Setup de Node, pnpm, Java e browsers do Playwright no CI.
- Documentação de execução dos testes.

**Dependências:** Fases 4, 5 e 7.

**Critérios de aceitação:**
- Todos os cenários E2E passam de forma determinística, sem esperas arbitrárias.
- Nenhum teste depende de produção.
- Dados de teste são isolados e limpos.
- Workflow do GitHub Actions falha em lint, tipos, testes ou build com erro.
- E2E roda em ambiente controlado.

**Testes:** Playwright para criação, alias, alias duplicado, redirecionamento, 404, expirado via seed, erro de comunicação e responsividade.

## Fase 9 — Hardening, documentação e prontidão de deploy

**Objetivo:** fechar o MVP com segurança, documentação e verificação completa.

**Entregáveis:**
- Revisão de segurança e privacidade.
- Regras do Firestore validadas como negativas para clientes.
- README completo.
- `docs/architecture.md` com decisões e trade-offs.
- Swagger sincronizado.
- Instruções de deploy no Render/Vercel e configuração de secrets.
- Checklist de aceite do PRD preenchido.
- Plano de implementação atualizado com progresso.

**Dependências:** todas as fases anteriores.

**Critérios de aceitação:**
- Lint, formatação, typecheck, testes e builds passam.
- Suíte E2E dos fluxos críticos passa.
- Nenhuma credencial versionada.
- Critérios de aceite do PRD verificados.
- Documentação permite que outra sessão continue sem o histórico da conversa.

**Testes:** execução completa da suíte e revisão manual dos critérios de aceite.

---

# 6. Tarefas detalhadas de cada fase

## Fase 0

| ID | Tarefa | Depende de | Saída |
| --- | --- | --- | --- |
| F0-T1 | Confirmar repositório Git e criar arquivos base | — | `.git/`, `.gitignore` |
| F0-T2 | Criar workspace pnpm com três pacotes | F0-T1 | `pnpm-workspace.yaml`, `package.json` |
| F0-T3 | Configurar TypeScript estrito compartilhado | F0-T2 | `tsconfig.base.json`, tsconfigs dos pacotes |
| F0-T4 | Configurar ESLint e Prettier | F0-T3 | `eslint.config.js`, `.prettierrc` |
| F0-T5 | Criar scripts raiz de lint, tipo, build e testes | F0-T2 | `package.json` raiz |
| F0-T6 | Criar `.env.example` e documentar variáveis | F0-T2 | `.env.example` |
| F0-T7 | Criar README inicial | F0-T5 | `README.md` |
| F0-T8 | Criar `firebase.json` e regras iniciais negando acesso | F0-T1 | `firebase.json`, `firestore.rules` |
| F0-T9 | Configurar Husky e hook `pre-commit` | F0-T4, F0-T5 | `.husky/pre-commit` |

## Fase 1

| ID | Tarefa | Depende de | Saída |
| --- | --- | --- | --- |
| F1-T1 | Definir códigos de erro e tipos base | F0 | `errors.ts` |
| F1-T2 | Definir esquema e constantes de URL | F1-T1 | `url.ts` |
| F1-T3 | Definir regex, limites e reservados de alias | F1-T1 | `alias.ts` |
| F1-T4 | Definir esquema e regras de expiração | F1-T1 | `expiration.ts` |
| F1-T5 | Definir schemas de request, response e health | F1-T2, F1-T3, F1-T4 | schemas exportados |
| F1-T6 | Configurar build do pacote | F1-T5 | `tsup.config.ts`, exports |
| F1-T7 | Escrever testes dos contratos | F1-T5 | testes Vitest |
| F1-T8 | Validar importação por API e web | F1-T6 | smoke de build/typecheck |

## Fase 2

| ID | Tarefa | Depende de | Saída |
| --- | --- | --- | --- |
| F2-T1 | Criar aplicação Nest com Fastify | F1 | `main.ts`, `app.module.ts` |
| F2-T2 | Implementar configuração validada por Zod | F2-T1 | `env.schema.ts`, provider global |
| F2-T3 | Implementar filtro global de erros | F2-T2 | `http-exception.filter.ts` |
| F2-T4 | Implementar pipe customizado de Zod | F2-T3 | `zod-validation.pipe.ts` |
| F2-T5 | Configurar limite de corpo e trust proxy | F2-T2 | adaptador Fastify configurado |
| F2-T6 | Configurar CORS restritivo | F2-T2 | opções de CORS |
| F2-T7 | Implementar health check | F2-T1 | `health.controller.ts` |
| F2-T8 | Configurar Swagger/OpenAPI | F2-T3 | `/api/docs` |
| F2-T9 | Configurar Vitest + SWC para Nest | F2-T1 | `vitest.config.ts`, setup |
| F2-T10 | Criar fábrica de app para testes de integração | F2-T9 | helper de teste |
| F2-T11 | Escrever testes de fumaça e transversais | F2-T10 | testes |

## Fase 3

| ID | Tarefa | Depende de | Saída |
| --- | --- | --- | --- |
| F3-T1 | Modelar entidade e relógio injetável | F2 | tipos de domínio |
| F3-T2 | Implementar política de URL | F3-T1 | `url policy` |
| F3-T3 | Implementar política de alias e reservados | F3-T1 | `alias.policy.ts` |
| F3-T4 | Implementar política de expiração | F3-T1 | `expiration.policy.ts` |
| F3-T5 | Implementar gerador criptográfico Base62 | F3-T1 | `code-generator.ts` |
| F3-T6 | Definir porta de repositório | F3-T1 | `url-repository.port.ts` |
| F3-T7 | Inicializar Firebase Admin e adaptador Firestore | F2-T2, F3-T6 | `firestore-url.repository.ts` |
| F3-T8 | Implementar serviço de criação com retry | F3-T2..F3-T7 | `urls.service.ts` |
| F3-T9 | Configurar Firestore Emulator | F0-T8 | scripts e configuração |
| F3-T10 | Escrever testes unitários do domínio/serviço | F3-T2..F3-T8 | testes Vitest |
| F3-T11 | Escrever testes de integração do repositório | F3-T7, F3-T9 | testes com emulador |

## Fase 4

| ID | Tarefa | Depende de | Saída |
| --- | --- | --- | --- |
| F4-T1 | Implementar rate limit em memória | F2-T2 | `rate-limit.guard.ts` |
| F4-T2 | Criar controller e DTO de criação | F3-T8, F2-T4 | `urls.controller.ts`, `dto/` |
| F4-T3 | Construir URL curta a partir de `PUBLIC_BASE_URL` | F2-T2 | helper de resposta |
| F4-T4 | Mapear erros de domínio para HTTP | F2-T3, F3-T8 | mapeamento |
| F4-T5 | Documentar endpoint no Swagger | F2-T8, F4-T2 | OpenAPI atualizado |
| F4-T6 | Testes unitários do rate limit | F4-T1 | testes |
| F4-T7 | Testes de integração do endpoint | F4-T2..F4-T5 | testes |

## Fase 5

| ID | Tarefa | Depende de | Saída |
| --- | --- | --- | --- |
| F5-T1 | Validar formato do código na rota | F3-T3 | regra de rota |
| F5-T2 | Implementar controller de redirect | F3-T7, F3-T8 | `redirect.controller.ts` |
| F5-T3 | Implementar verificação de expiração na resolução | F3-T4, F3-T8 | fluxo de resolução |
| F5-T4 | Criar páginas HTML de erro | F2-T3 | templates simples |
| F5-T5 | Aplicar `Cache-Control: no-store` | F5-T2 | headers |
| F5-T6 | Escrever testes de integração do redirect | F5-T1..F5-T5 | testes |

## Fase 6

| ID | Tarefa | Depende de | Saída |
| --- | --- | --- | --- |
| F6-T1 | Criar app Vite + React + TypeScript | F1 | `apps/web` |
| F6-T2 | Configurar Tailwind | F6-T1 | estilos base |
| F6-T3 | Criar estrutura de páginas, componentes, hooks e services | F6-T1 | pastas e arquivos base |
| F6-T4 | Implementar cliente de API tipado | F1, F6-T3 | `services/api.ts` |
| F6-T5 | Configurar variável `VITE_API_BASE_URL` | F6-T4 | `.env.example` |
| F6-T6 | Configurar Vitest + jsdom + Testing Library | F6-T1 | setup de testes |
| F6-T7 | Escrever testes de cliente e smoke | F6-T4, F6-T6 | testes |

## Fase 7

| ID | Tarefa | Depende de | Saída |
| --- | --- | --- | --- |
| F7-T1 | Implementar formulário e campos acessíveis | F6-T3 | `ShortenForm` |
| F7-T2 | Implementar seletor de expiração com padrão 24h | F7-T1 | `ExpirationSelect` |
| F7-T3 | Implementar validação e mensagens por campo | F7-T1, F1 | validação de UI |
| F7-T4 | Implementar estados de envio e bloqueio de duplicidade | F6-T4, F7-T1 | hook de criação |
| F7-T5 | Implementar cartão de resultado | F6-T3 | `ResultCard` |
| F7-T6 | Implementar cópia com fallback | F7-T5 | `CopyButton` |
| F7-T7 | Implementar ação de nova criação | F7-T4, F7-T5 | fluxo de reset |
| F7-T8 | Implementar responsividade e acessibilidade | F7-T1..F7-T7 | ajustes de UI |
| F7-T9 | Escrever testes de comportamento | F7-T1..F7-T8 | testes Vitest/RTL |

## Fase 8

| ID | Tarefa | Depende de | Saída |
| --- | --- | --- | --- |
| F8-T1 | Configurar Playwright e múltiplos `webServer` | F4, F5, F7 | `playwright.config.ts` |
| F8-T2 | Criar fixtures de seed/cleanup no emulador | F3-T9, F8-T1 | helpers E2E |
| F8-T3 | Implementar cenários 1–4 do PRD | F8-T1, F8-T2 | testes E2E |
| F8-T4 | Implementar cenários 5–8 do PRD | F8-T1, F8-T2 | testes E2E |
| F8-T5 | Criar workflow de CI no GitHub Actions | F8-T1..F8-T4 | `.github/workflows/ci.yml` |
| F8-T6 | Documentar execução dos testes | F8-T5 | README/docs |

## Fase 9

| ID | Tarefa | Depende de | Saída |
| --- | --- | --- | --- |
| F9-T1 | Revisar segurança, privacidade e logs | Fases 0–8 | checklist |
| F9-T2 | Validar regras do Firestore | F9-T1 | regras confirmadas |
| F9-T3 | Finalizar README e `docs/architecture.md` | F9-T1 | documentação |
| F9-T4 | Sincronizar Swagger/OpenAPI | F9-T1 | docs atualizadas |
| F9-T5 | Documentar deploy Render/Vercel e secrets | F9-T1 | guia |
| F9-T6 | Executar verificação completa e checklist do PRD | F9-T1..F9-T5 | evidências |
| F9-T7 | Atualizar este plano com progresso | F9-T6 | plano atualizado |

---

# 7. Dependências entre tarefas

## 7.1 Grafo de fases

```text
F0
 └── F1
      ├── F2
      │    └── F3
      │         ├── F4
      │         └── F5
      └── F6
           └── F7

F4 ─┐
F5 ─┼── F8 ── F9
F7 ─┘
```

## 7.2 Caminho crítico

`F0 → F1 → F2 → F3 → F4 → F8 → F9`

`F5` pode avançar em paralelo com `F4` após `F3`. `F6`/`F7` podem avançar em paralelo com `F4`/`F5` após `F1`, mas a integração real só é validada em `F8`.

## 7.3 Dependências transversais

- `contracts` precisa estar construído antes de API e web consumirem os tipos.
- Configuração validada precisa existir antes de Firestore, rate limit e CORS.
- Filtro de erros e pipe Zod precisam existir antes dos endpoints.
- Emulador precisa estar disponível antes dos testes de integração e E2E.
- CI depende de scripts estáveis criados na Fase 0 e dos testes das fases anteriores.

---

# 8. Critérios de aceitação

## 8.1 Portões por fase

Cada fase só é considerada concluída quando:

1. Lint e formatação passam.
2. Typecheck passa sem erros.
3. Testes da fase passam.
4. Build dos pacotes afetados passa.
5. Critérios de aceitação específicos da fase são verificados.
6. Documentação afetada é atualizada.
7. O diff foi revisado e não contém segredos.

## 8.2 Critérios do MVP

### Criação

- [ ] Criar URL curta a partir de URL HTTP/HTTPS válida.
- [ ] Gerar códigos exclusivos com alfabeto Base62.
- [ ] Aceitar alias personalizado válido.
- [ ] Rejeitar alias duplicado com `409`.
- [ ] Rejeitar alias reservado.
- [ ] Preservar case em códigos e aliases.
- [ ] Aplicar expiração padrão de 24h.
- [ ] Rejeitar expiração inválida, passada ou acima do máximo.
- [ ] Rejeitar URL acima de 2048 caracteres.
- [ ] Rejeitar corpo acima de 16 KB com `413`.
- [ ] Persistir antes de responder sucesso.
- [ ] Não retornar sucesso em falha de persistência.

### Redirecionamento

- [ ] Código existente retorna `302`.
- [ ] `Location` contém o destino persistido.
- [ ] Código inexistente retorna `404`.
- [ ] Link expirado não redireciona.
- [ ] Respostas usam `Cache-Control: no-store`.
- [ ] Busca é case-sensitive.
- [ ] Cliente não escolhe o destino.
- [ ] Erros são HTML, sem detalhes internos.

### Interface

- [ ] Formulário funciona em desktop, tablet e smartphone.
- [ ] Feedback de carregamento e bloqueio de envio duplicado.
- [ ] Erros claros e associados aos campos.
- [ ] Expiração com opções predefinidas e padrão de 24h.
- [ ] Cópia do link com confirmação e fallback.
- [ ] Resultado permanece visível.
- [ ] É possível iniciar nova criação.

### Arquitetura e segurança

- [ ] Frontend usa React, Vite, TypeScript, Tailwind e Zod.
- [ ] Backend usa NestJS, Fastify e Zod.
- [ ] `contracts` centraliza os schemas.
- [ ] Firestore acessado apenas pelo backend.
- [ ] Regras do Firestore negam clientes.
- [ ] Sem Redis.
- [ ] Lógica de negócio separada de persistência e HTTP.
- [ ] Unicidade segura sob concorrência.
- [ ] CORS restritivo em produção.
- [ ] Rate limit retorna `429` com `Retry-After`.

### Testes e documentação

- [ ] Testes unitários de backend passam.
- [ ] Testes de integração passam.
- [ ] Testes de frontend passam.
- [ ] E2E dos fluxos críticos passam.
- [ ] Builds passam.
- [ ] CI no GitHub Actions executa lint, typecheck, testes, builds e E2E.
- [ ] Husky executa validação de pre-commit e bloqueia commit com erro.
- [ ] README documenta instalação, execução e testes.
- [ ] Swagger/OpenAPI está atualizado.
- [ ] Nenhuma credencial versionada.

## 8.3 Rastreabilidade PRD → fases

| Requisito do PRD | Fases principais |
| --- | --- |
| Criação de URL curta (3.1) | F3, F4, F7 |
| Geração de códigos (3.2) | F1, F3 |
| Aliases (3.3) | F1, F3, F4, F7 |
| Redirecionamento (3.4) | F3, F5 |
| Expiração (3.5) | F1, F3, F4, F7 |
| Cópia e resultado (3.6, 3.7) | F7 |
| Interface e acessibilidade (4) | F6, F7 |
| Segurança e abuso (5.3) | F2, F3, F4, F9 |
| Arquitetura e contratos (6) | F0, F1, F2 |
| Firestore (7) | F3, F9 |
| Contrato da API (8) | F1, F2, F4, F5 |
| Regras de negócio (9) | F3, F4, F5 |
| Testes (10) | F1–F8 |
| Configuração e ambientes (11) | F0, F2, F9 |
| CI e qualidade (12) | F8 |
| Critérios de aceite (13) | F9 |

---

# 9. Estratégia de testes

## 9.1 Backend — unitários (Vitest)

Cobrir com dependências simuladas:

- Validação de URL: protocolo, estrutura, credenciais, tamanho.
- Alias: regex, limites, reservados, case sensitivity.
- Expiração: padrão, datas inválidas, passadas, acima do máximo, limite exato.
- Geração de código: alfabeto, comprimento, distribuição básica, colisão.
- Serviço de criação: retry, esgotamento, conflito de alias, falha de persistência.
- Políticas de domínio puras.
- Rate limit: janela, contagem, reset, `Retry-After`, limpeza.
- Configuração: valores padrão, inválidos e obrigatórios.
- Filtro de erros, pipe Zod e mapeamento de status/códigos.

Não exigir Firebase real. Usar relógio falso para expiração e rate limit.

## 9.2 Backend — integração (Vitest + Firestore Emulator)

- Health check sem Firestore.
- Criação `201` com todos os campos.
- Persistência e recuperação.
- Expiração padrão de 24h.
- Redirecionamento `302` e `Location`.
- `404` para inexistente, expirado e formato inválido.
- Conflito de alias `409`.
- Alias reservado.
- Case sensitivity.
- Entradas inválidas e formato de erro.
- `413` para corpo acima de 16 KB.
- `429` com `Retry-After`.
- `Cache-Control: no-store`.
- Não sobrescrita.
- Concorrência: várias criações simultâneas do mesmo alias; apenas uma vence.
- Falha de persistência não gera sucesso.
- `500` controlado.

Ambiente:

- Firestore Emulator com project ID de teste.
- `FIRESTORE_EMULATOR_HOST` explícito.
- Nenhuma credencial de produção.
- Limpeza de dados entre testes.
- Java disponível no ambiente de CI para o emulador.

## 9.3 Frontend (Vitest + React Testing Library)

- Renderização do formulário e labels acessíveis.
- Validação de URL, alias e expiração.
- Mensagens de erro por campo.
- Expiração padrão de 24h.
- Omissão de `expiresAt` na opção de 24h.
- Payload correto para a API.
- Estado de carregamento e bloqueio de envio duplicado.
- Exibição do resultado.
- Cópia com sucesso e falha (mock de Clipboard API).
- Erro de comunicação.
- Erro `ALIAS_TAKEN`.
- Erro `RATE_LIMITED`.
- Nova criação.
- Preservação dos dados em erro.
- Acessibilidade básica: roles, labels, foco, `aria-live`.

Priorizar comportamento observável, sem snapshots frágeis ou dependência de estrutura interna.

## 9.4 E2E (Playwright)

Cenários obrigatórios:

1. Criar URL e ver a URL curta.
2. Criar com alias e verificar o alias na URL.
3. Alias duplicado com mensagem de conflito.
4. Redirecionamento para o destino.
5. URL inexistente retorna 404.
6. URL expirada via seed controlado no emulador.
7. Erro de comunicação com dados preservados.
8. Responsividade em viewport de smartphone.

Regras:

- Setup/teardown controlados.
- Sem esperas arbitrárias; usar assertions do Playwright.
- Aliases únicos por teste e limpeza de coleção.
- Não depender de produção.
- Rodar contra API, web e emulador locais.

## 9.5 Comandos previstos

```text
pnpm lint
pnpm format:check
pnpm typecheck
pnpm build
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm emulators:start
```

Os nomes finais serão fixados na Fase 0.

## 9.6 CI — GitHub Actions

**Plataforma aprovada:** GitHub Actions, com workflow em `.github/workflows/ci.yml`.

O workflow deve usar `pnpm/action-setup`, `actions/setup-node` com cache de pnpm, `actions/setup-java` (necessário ao Firestore Emulator) e instalação dos browsers do Playwright. Credenciais de produção não devem ser usadas; o ambiente de CI deve apontar para o emulador e para dados de teste isolados.

O Husky fornece validação local no `pre-commit`; o CI é a autoridade final e não depende do hook para bloquear alterações inválidas.

Ordem mínima proposta:

1. Checkout do repositório.
2. Configurar pnpm, Node e cache.
3. Instalar dependências com lockfile.
4. Lint e verificação de formatação.
5. Typecheck.
6. Build de `contracts`.
7. Testes unitários.
8. Testes de integração com emulador.
9. Testes de frontend.
10. Build de API e web.
11. E2E em ambiente controlado.

O pipeline deve falhar em qualquer etapa obrigatória. Não reduzir cobertura de comportamento para fazer o build passar.

---

# 10. Riscos técnicos e pontos pendentes

## 10.1 Decisões pendentes de aprovação

| ID | Questão | Recomendação | Por que precisa de aprovação |
| --- | --- | --- | --- |
| P1 | Hífen/underscore nas extremidades do alias | Aceitar `^[A-Za-z0-9_-]{3,32}$`, permitindo início/fim com `-` ou `_` | O PRD não proíbe; restringir é uma decisão de produto |
| P2 | Normalização da URL original | Aplicar `trim` externo, validar e persistir a string sem canonicalização | Alterar a URL armazenada afeta o contrato e a expectativa do usuário |
| P3 | Precisão e tolerância de `expiresAt` | Exigir ISO 8601 com timezone; aceitar qualquer instante futuro até o máximo, sem tolerância; 24h é omitido pelo frontend | O PRD exige rejeitar acima do máximo, mas não define tolerância |
| P4 | Erro para alias reservado | `400 INVALID_ALIAS` (não `409`) | O PRD não define o código exato para reservados |
| P5 | Erro ao esgotar tentativas de geração | `500 INTERNAL_ERROR` | O PRD exige erro controlado, mas não define um código novo |
| P6 | Ordem e escopo do rate limit | Aplicar somente em `POST /api/v1/urls`, após o limite de corpo; requisições parseadas contam; `413` tem precedência; `Retry-After` em segundos | A ordem altera qual erro o usuário recebe |
| P7 | Lista canônica de aliases reservados | Usar a lista do PRD (`api`, `health`, `docs`, `admin`, `assets`, `favicon.ico`), em configuração estática do backend, case-sensitive | A lista pode crescer com novas rotas |
| P8 | Formato de módulos e build de `contracts` | API em CommonJS, web em ESM, `contracts` com build dual ESM+CJS via `tsup` | Introduz dependência de build e afeta consumo nos dois lados |
| P9 | Vitest com NestJS | Usar `unplugin-swc` para emitir metadados de decorators | Sem isso, a injeção de dependências pode falhar em testes |
| P10 | Implementação do rate limit | Guard/serviço customizado em memória, sem `@nestjs/throttler` | Evita dependência e permite controlar `Retry-After`, mas é código próprio |
| P11 | Swagger + Zod | DTOs manuais com decorators de Swagger + pipe Zod customizado | Pode haver divergência entre schema Zod e documentação |
| P12 | Credenciais do Firebase Admin | Local via emulador; produção via `GOOGLE_APPLICATION_CREDENTIALS` apontando para secret file no Render | Afeta deploy e segurança; o PRD permite "credencial equivalente" |
| P15 | Versões exatas | Node 24 LTS, pnpm 10, Tailwind estável (v4 se compatível), demais dependências estáveis | O PRD deixa versões para a implementação |
| P16 | Exposição do Swagger em produção | Habilitar em desenvolvimento; em produção somente com `SWAGGER_ENABLED=true` | O PRD diz "se habilitada", sem definir o padrão |
| P17 | Contrato para rotas `/api/v1` inexistentes | Fora do escopo do MVP; apenas endpoints definidos seguem o contrato | Adicionar um código novo mudaria o contrato estável |
| P18 | Comportamento de "nova criação" | Limpar formulário e ocultar resultado ao iniciar nova criação | Decisão de UX não detalhada no PRD |
| P19 | Testes de integração com emulador | Tornar o Firestore Emulator obrigatório para integração e E2E | O PRD diz "preferencialmente"; tornar obrigatório aumenta isolamento |
| P20 | Previews da Vercel e CORS | Permitir apenas origens configuradas; previews exigem configuração explícita | CORS restritivo pode bloquear previews |

> **P13 aprovado:** PRD movido para `docs/PRD.md`; referências do `AGENTS.md` atualizadas.
>
> **P14 aprovado:** CI será executado no GitHub Actions. A numeração foi mantida para preservar referências às demais decisões.
>
> **P15 parcialmente aprovado na Fase 0:** Node 24, pnpm 10.1.0, TypeScript 6.0.3, ESLint 10, Prettier 3, Husky 9 e `@types/node` 24 foram fixados. Tailwind e demais dependências serão fixadas nas fases correspondentes.
>
> **P21 aprovado na Fase 0:** o hook executa `pnpm lint && pnpm typecheck`.

## 10.2 Riscos técnicos

| ID | Risco | Impacto | Mitigação |
| --- | --- | --- | --- |
| R1 | Vitest + NestJS sem metadados de decorators | Testes de integração falham na injeção de dependências | Configurar SWC cedo na Fase 2; validar com um teste mínimo antes de avançar |
| R2 | Interoperabilidade ESM/CJS entre `contracts`, Vite e Nest | Builds ou imports quebram em um dos lados | Build dual com `tsup`; smoke de importação em API e web na Fase 1 |
| R3 | Mapeamento do erro de corpo grande do Fastify | Resposta fora do contrato `PAYLOAD_TOO_LARGE` | Teste de integração específico para `413` na Fase 2/4 |
| R4 | Rate limit em memória | Não compartilha entre instâncias e reinicia com o processo | Documentar limitação; manter uma instância no MVP; testar janela/reset |
| R5 | `trust proxy` mal configurado | IP errado ou spoofável; rate limit ineficaz | Configurar valor específico do Render; testar extração de IP; nunca confiar em cabeçalho manual |
| R6 | Credenciais do Firebase no Render | Deploy falha ou segredo vaza | Secret file + `GOOGLE_APPLICATION_CREDENTIALS`; nunca versionar; validar no startup |
| R7 | Firestore Emulator no CI | Testes de integração/E2E instáveis ou indisponíveis | Fixar `firebase-tools`; prover Java no CI; health check do emulador |
| R8 | Divergência Swagger ↔ Zod | Documentação enganosa | DTOs manuais revisados; testes de contrato; revisão na Fase 9 |
| R9 | Conflito entre `/api/v1/*` e `GET /:code` | Rotas sombreadas ou redirect quebrado | Prefixos explícitos nos controllers; testes de rota |
| R10 | Diferença de relógio na expiração | Criação rejeitada indevidamente | Frontend omite `expiresAt` em 24h; backend é autoridade; relógio injetável nos testes |
| R11 | Cold start do Render | Latência alta na primeira requisição | Documentar que metas não consideram cold start; não prometer p95 em produção free |
| R12 | Tailwind v4 e ecossistema | Configuração ou build quebrado | Fixar versão estável; fallback para v3 se necessário |
| R13 | E2E instável | Falsos negativos no CI | `webServer` com readiness; seed/cleanup; aliases únicos; sem waits arbitrários |
| R14 | Case sensitivity de reservados | Alias `API` é permitido, embora `api` seja reservado | Documentar comportamento aprovado no PRD; não “corrigir” silenciosamente |
| R15 | Custos e limites do Firestore | Surpresa de custo ou cota | Uma leitura/escrita por operação; IDs aleatórios; monitorar uso; sem índices desnecessários |
| R16 | Workflow de CI ainda não configurado | Verificações automatizadas indisponíveis | Criar `.github/workflows/ci.yml` na Fase 8 com Node, pnpm, Java e Playwright |
| R17 | Hook `pre-commit` lento ou contornado | Commits travados ou uso frequente de `--no-verify` | Manter validação rápida no hook; CI continua sendo a autoridade final; bypass apenas em exceção justificada |

## 10.3 Decisões já aprovadas

- Backend e frontend usam Vitest, não Jest.
- CI será executado no **GitHub Actions**.
- O PRD está em `docs/PRD.md`; o `AGENTS.md` foi atualizado e não há duplicação.
- **Husky** será usado para validação de pre-commit.
- O hook `pre-commit` executa `pnpm lint && pnpm typecheck` (P21).
- Fase 0 fixou Node 24, pnpm 10.1.0, TypeScript 6.0.3, ESLint 10, Prettier 3, Husky 9 e `@types/node` 24.
- Firestore será acessado apenas pelo backend.
- Redis, filas e microsserviços ficam fora do MVP.

---

# 11. Documentação e continuidade entre sessões

## 11.1 Documentos propostos

| Documento | Status | Conteúdo |
| --- | --- | --- |
| `README.md` | A criar na Fase 0 | Instalação, configuração, execução local, emulador, testes, build e deploy |
| `docs/IMPLEMENTATION_PLAN.md` | Criado nesta etapa | Este plano, progresso e decisões pendentes |
| `docs/architecture.md` | A criar na Fase 9 (ou antes, se necessário) | Visão de arquitetura, camadas, fluxos, decisões, alternativas e consequências |
| `docs/adr/` | Opcional | ADRs curtas para decisões que mereçam registro individual |
| Swagger/OpenAPI | Gerado pela API | Contrato HTTP vivo, mantido sincronizado |
| `.env.example` | A criar na Fase 0 | Variáveis fictícias e instruções |

## 11.2 Regras de continuidade

Antes de retomar o trabalho:

1. Ler `AGENTS.md`, `docs/PRD.md` e este plano.
2. Verificar o estado real do código e os scripts existentes.
3. Conferir `git status` e commits recentes.
4. Identificar a última fase concluída na seção 12.
5. Confirmar decisões pendentes com o responsável antes de implementar.

Ao concluir uma fase:

1. Marcar as tarefas concluídas.
2. Registrar decisões novas em `docs/architecture.md` ou ADR.
3. Atualizar README e Swagger quando o comportamento mudar.
4. Registrar evidências das verificações executadas.
5. Não declarar conclusão com falhas conhecidas.

---

# 12. Registro de progresso

> Atualizar esta seção a cada sessão. Não marcar uma fase como concluída sem executar as verificações da seção 8.

## Fases

- [x] Fase 0 — Fundação do monorepo e tooling
- [ ] Fase 1 — Pacote `contracts`
- [ ] Fase 2 — Bootstrap do backend e infraestrutura transversal
- [ ] Fase 3 — Domínio de URLs e persistência Firestore
- [ ] Fase 4 — Endpoint de criação
- [ ] Fase 5 — Endpoint de redirecionamento
- [ ] Fase 6 — Fundação do frontend
- [ ] Fase 7 — Interface de criação, resultado e cópia
- [ ] Fase 8 — E2E e CI
- [ ] Fase 9 — Hardening, documentação e prontidão de deploy

## Decisões aprovadas

| Data | Decisão | Registro |
| --- | --- | --- |
| 2026-10-30 | Backend e frontend usam Vitest | Ajuste aplicado em `docs/PRD.md` e `AGENTS.md` |
| 2026-10-30 | CI no GitHub Actions | Definido pelo solicitante; plano atualizado |
| 2026-10-30 | PRD movido para `docs/PRD.md` | Referências do `AGENTS.md` atualizadas |
| 2026-10-30 | Husky para validação de pre-commit | Definido pelo solicitante; hook configurado na Fase 0 |
| 2026-10-30 | Fase 0 concluída | Workspace pnpm, tooling, configuração do Firestore e Husky implementados e verificados |
| 2026-10-30 | Node 24 e pnpm 10.1.0 fixados | `package.json` e `pnpm-lock.yaml` |
| 2026-10-30 | TypeScript 6.0.3 e toolchain de lint | TypeScript 7 não é compatível com `typescript-eslint` 8.72 |
| 2026-10-30 | Hook `pre-commit` executa `pnpm lint && pnpm typecheck` (P21) | `.husky/pre-commit` |
| 2026-10-30 | Build da Fase 0 via `tsc` | `contracts` usa build ESM provisório; build dual permanece para a Fase 1 (P8) |
| 2026-10-30 | API em CommonJS e web em ESM no esqueleto | `apps/api/package.json` e `apps/web/package.json`; decisão final de P8 na Fase 1 |
| 2026-10-30 | Prettier ignora `docs/` e `AGENTS.md` | Evita reformatação de documentos aprovados |
| 2026-10-30 | Firestore nega leitura e escrita de clientes | `firestore.rules` |
| — | Demais decisões deste plano | Aguardando aprovação |

## Evidências da Fase 0

| Verificação | Resultado |
| --- | --- |
| `pnpm install --frozen-lockfile` | Passou; lockfile consistente |
| Clone limpo simulado | Passou; instalação, lint, formatação, typecheck e build sem `node_modules` ou `dist` prévios |
| `pnpm lint` | Passou sem erros |
| `pnpm format:check` | Passou |
| `pnpm typecheck` | Passou nos três pacotes |
| `pnpm build` | Passou em `contracts`, `api` e `web`, nesta ordem |
| `pnpm test` | Passou; não há testes de negócio nesta fase, conforme o plano |
| Hook `pre-commit` com erro proposital | Bloqueou o commit |
| Hook `pre-commit` sem erro | Passou |
| Credenciais versionadas | Nenhuma |

## Próxima ação

Aguardar revisão da Fase 0 e orientação para iniciar a Fase 1 — Pacote `contracts`.

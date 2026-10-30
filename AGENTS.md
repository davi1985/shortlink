# AGENTS.md — ShortLink

Instruções permanentes para agentes de IA que trabalham neste repositório, em qualquer sessão.

## 1. Fonte de verdade

- `docs/PRD.md` é a referência funcional do produto. Leia-o antes de implementar mudanças relevantes.
- Este arquivo define **como** trabalhar; o PRD define **o que** construir. Em caso de conflito, o PRD prevalece, mas registre a divergência.
- Não duplique regras do PRD no código sem extrair para o pacote `contracts` (esquemas Zod e tipos compartilhados).

## 2. Continuidade entre sessões

Antes de agir:

1. Leia este `AGENTS.md` e consulte `docs/PRD.md` e a documentação em `docs/` (ex.: `docs/architecture.md`, quando existir).
2. Verifique o **estado real do código** (estrutura de diretórios, scripts, testes existentes). Não presuma que algo descrito já foi implementado.
3. Confira `git status` e os commits recentes para entender o trabalho em andamento.

Ao encerrar um incremento relevante, atualize a documentação afetada e registre decisões arquiteturais (seção 8). Deixe o repositório em estado compreensível para a próxima sessão.

## 3. Decisões já tomadas (não reabrir sem justificativa)

- Monorepo com `pnpm` + workspaces: `apps/web`, `apps/api`, `packages/contracts`.
- Frontend: React, Vite, TypeScript, Tailwind CSS, Zod, Vitest, React Testing Library, Playwright.
- Backend: Node.js, NestJS, Fastify, TypeScript, Firebase Admin SDK, Cloud Firestore, Vitest, Zod via pipe customizado.
- TypeScript em modo estrito no projeto inteiro; ESLint + Prettier.
- `contracts` é a fonte única de validação e tipos da API; ordem de build `contracts` → `api`/`web`.
- API sob `/api/v1`, contrato de erro estável (`error.code`, `error.message`, `error.fields` opcional) com os códigos definidos no PRD.
- Códigos e aliases são **case-sensitive** e preservam o case.
- Expiração padrão de 24h; `expiresAt` sempre persistido em UTC; validação lógica de expiração obrigatória.
- Firestore acessado **exclusivamente** pelo backend, com regras que negam acesso direto de clientes.
- Rede de segurança: rate limit em memória por IP, `trust proxy` no Render, CORS restritivo em produção.
- Redirecionamento com HTTP 302 e `Cache-Control: no-store`; erros do `GET /:code` são HTML, não JSON.
- Health check `GET /api/v1/health` não depende do Firestore.
- Hospedagem: backend no Render (free), frontend na Vercel.
- **Redis não faz parte desta versão** (ver seção 6).

## 4. Pontos ainda pendentes

Trate como decisões a validar, não como fatos:

- Ajustes finos da estrutura de diretórios (preservando separação de responsabilidades).
- Escolha das versões exatas de dependências (usar estáveis e compatíveis; nada experimental sem justificativa).
- Detalhes de modelagem e custos do Firestore, incluindo estratégia de expiração física (fora do MVP, mas pode ser avaliada).
- Estratégia de CI (ordem/paralelismo das etapas).
- Quaisquer itens marcados como "a avaliar" no PRD.

Se precisar decidir algo novo e relevante, proponha a opção mais simples que atenda ao PRD e documente a escolha antes de implementar.

## 5. Arquitetura e padrões de código

- Separe domínio, aplicação, infraestrutura e transporte HTTP. A lógica de negócio **não** deve depender do SDK do Firestore nem de detalhes do NestJS/Fastify.
- Controllers finos: validação e mapeamento HTTP apenas; regras de negócio em serviços/domínio.
- Persistência atrás de uma interface/porta; a implementação Firestore fica na camada de infraestrutura.
- Unicidade garantida pelo armazenamento com criação atômica sem sobrescrita; consulta prévia é apenas otimização de UX.
- Frontend separa componentes, páginas, hooks e serviços de API. Sem importar código que dependa do Firebase Admin ou de APIs exclusivas do Node.
- Siga convenções existentes do repositório; antes de criar algo novo, procure um padrão equivalente.
- Comece simples. Evite abstrações, camadas e generalizações sem necessidade concreta.
- Não adicione comentários ao código, salvo quando o projeto já adotar esse padrão para trechos não óbvios.
- Configuração sempre via variáveis de ambiente; nunca hardcode segredos, URLs públicas ou limites.
- Mantenha `.env.example` atualizado com valores fictícios.

## 6. Dependências e infraestrutura

- Não adicione bibliotecas, serviços, bancos, caches ou infraestrutura sem justificar a necessidade no PRD ou em uma decisão registrada.
- **Não introduza Redis** na versão inicial. Cache, filas ou processamento assíncrono também não fazem parte do MVP.
- Antes de adicionar uma dependência, verifique se o próprio projeto ou a stack já oferece o recurso e registre o motivo no PR ou na documentação.
- Prefira soluções nativas da stack acessíveis sem nova infraestrutura.

## 7. Validação, erros e segurança

- Valide entradas **no backend**, mesmo que o frontend já valide, usando os esquemas de `contracts`.
- Aplique os limites do PRD (tamanho de URL, alias, corpo de 16 KB, tentativas de geração, rate limit) no backend, com valores configuráveis.
- Use o formato de erro padronizado da API. Mantenha os códigos estáveis; mensagens podem mudar.
- Não exponha stack traces, detalhes internos ou credenciais em respostas.
- Falhas de persistência nunca podem resultar em resposta de sucesso.
- Aceite apenas HTTP/HTTPS; rejeite credenciais embutidas na URL.
- Nunca faça o servidor buscar a URL de destino na criação nem redirecione para dados vindos da requisição.
- Nunca versione segredos. Use variáveis de ambiente/secrets.
- Preserve privacidade: não persista IPs ou dados pessoais sem necessidade documentada.
- Trate erros de forma consistente e não silencie exceções relevantes.

## 8. Documentação de decisões

- Decisões arquiteturais importantes (novas dependências, mudanças de contrato, estratégia de persistência, trade-offs de custo/complexidade) devem ser registradas em `docs/architecture.md` ou em um ADR curto em `docs/`.
- Inclua contexto, decisão, alternativas consideradas e consequências.
- Mantenha o README e a documentação Swagger/OpenAPI sincronizados com a implementação.
- Não altere o PRD sem solicitação explícita.

## 9. Testes (obrigatórios)

- **Backend unitário (Vitest):** validação de URL, protocolos, credenciais, limites, geração e colisão de códigos, case sensitivity, aliases e reservados, expiração (padrão e inválidas), erros de persistência e de dependências. Use mocks; não exija Firebase real.
- **Backend integração:** criação, persistência/recuperação, expiração padrão e expirada, redirecionamento, 404, conflitos de alias, entradas inválidas, 413, 429, `Cache-Control`, formato de erro, não sobrescrita e concorrência. Prefira o Firebase Emulator Suite e garanta isolamento de dados reais.
- **Frontend (Vitest + React Testing Library):** renderização, validação, estados de erro/carregamento/sucesso, expiração padrão, envio correto à API, cópia, falhas de comunicação/alias/rate limit, nova criação e acessibilidade básica. Teste comportamento observável, não implementação interna.
- **E2E (Playwright):** fluxos críticos do PRD (criar, alias, alias duplicado, redirecionar, 404, expirado via seed controlado, erro de comunicação, responsividade). Determinísticos, com setup/teardown e sem esperas arbitrárias; não depender de produção.
- Testes são parte do fluxo, não etapa opcional. Não reduza cobertura de comportamento para "fazer passar".

## 10. Definição de concluído

Uma funcionalidade **não está concluída** até que as verificações pertinentes tenham sido executadas com sucesso:

1. Lint e formatação.
2. Verificação de tipos (`tsc`) sem erros — não ignore erros de TypeScript.
3. Testes unitários, de integração e de frontend afetados.
4. Build de `contracts`, `api` e `web`, na ordem correta.
5. E2E dos fluxos impactados, quando aplicável.
6. Revisão do diff e conferência contra os critérios de aceite do PRD.
7. Documentação atualizada e ausência de credenciais versionadas.

Se uma verificação falhar, investigue e corrija. Não declare conclusão com falhas conhecidas em requisitos obrigatórios. Relate o que foi executado e o que permanece pendente.

# PRD — ShortLink

**Versão:** 1.1  
**Status:** Proposta ajustada para implementação do MVP  
**Tipo:** Aplicação web full-stack  
**Objetivo:** Construir um encurtador de URLs funcional, testável e evolutivo, utilizando TypeScript no frontend e no backend.

---

# 1. Visão do produto

## 1.1. Descrição

O ShortLink é uma aplicação web que permite transformar URLs longas em links curtos, facilitando seu compartilhamento e acesso.

O usuário informa uma URL original, solicita o encurtamento e recebe um link curto que redireciona para o destino original.

O projeto começa como um MVP, mas deve ser estruturado para permitir a evolução futura para funcionalidades como analytics, gerenciamento de links, autenticação e escalabilidade.

## 1.2. Problema que o produto resolve

URLs longas são inconvenientes para compartilhar, visualizar e utilizar em determinados contextos.

O ShortLink oferece uma maneira simples de gerar endereços curtos, mantendo a associação entre o identificador e o destino original.

## 1.3. Objetivos

- Permitir a criação de URLs curtas.
- Redirecionar corretamente para os destinos originais.
- Garantir a unicidade dos códigos gerados.
- Permitir aliases personalizados.
- Permitir a definição de expiração para os links, com padrão de 24 horas.
- Oferecer uma interface simples e responsiva.
- Manter o backend organizado e testável.
- Garantir cobertura dos principais comportamentos por testes automatizados.
- Estabelecer uma base arquitetural que permita evoluções sem reescrever o sistema.

## 1.4. Não objetivos do MVP

As seguintes funcionalidades não fazem parte da primeira versão:

- Autenticação e gerenciamento de usuários.
- Dashboard de analytics.
- Geolocalização dos acessos.
- Rastreamento de dispositivos e navegadores.
- API pública com chaves de acesso.
- Planos pagos e limites comerciais.
- QR Codes.
- Edição do destino após a criação.
- Links com múltiplos destinos.
- CDN configurada especificamente para cache de redirecionamentos.
- Redis.
- Arquitetura de microsserviços.
- Filas e processamento assíncrono de eventos.
- Aplicativo mobile nativo.

Essas funcionalidades poderão ser avaliadas em versões futuras.

---

# 2. Público-alvo

A primeira versão é destinada a usuários que precisam criar e compartilhar links curtos.

Os principais casos de uso são:

- Compartilhar artigos e páginas web.
- Compartilhar links em redes sociais e aplicativos de mensagens.
- Criar links mais simples para apresentações e documentos.
- Utilizar aliases personalizados para facilitar a identificação dos destinos.

O produto será desenvolvido inicialmente para uso público, sem necessidade de criação de conta.

Como a criação será anônima, mecanismos básicos de proteção contra abuso serão necessários.

---

# 3. Escopo funcional

## 3.1. Criar uma URL curta

O usuário deve conseguir informar uma URL e gerar uma versão curta.

### Fluxo esperado

1. O usuário acessa a página inicial.
2. Informa a URL original.
3. Opcionalmente, informa um alias personalizado.
4. Define a expiração (opcional; padrão de 24 horas).
5. Solicita a criação.
6. O frontend envia os dados para a API.
7. O backend valida os dados.
8. O backend gera ou reserva um código exclusivo.
9. O backend persiste o registro.
10. A API retorna a URL curta.
11. O frontend apresenta o resultado e permite copiar o link.

### Exemplo

URL original:

`https://example.com/articles/software-engineering/system-design`

URL curta:

`https://short.example/aZ3kP9q`

O domínio apresentado é ilustrativo. O domínio real deverá ser configurado no ambiente de execução.

### Regras

- A URL original é obrigatória.
- A URL deve possuir uma estrutura válida.
- Somente os protocolos HTTP e HTTPS são aceitos.
- O código gerado deve ser exclusivo.
- A criação deve ser persistida antes de a API confirmar sucesso.
- Falhas de persistência não podem resultar em uma resposta de sucesso.
- O frontend deve impedir envios acidentais repetidos enquanto uma criação estiver em andamento.
- A interface deve apresentar mensagens claras para erros de validação e falhas inesperadas.

### Limites de entrada

Os limites abaixo deverão ser aplicados pelo backend e possuir valores padrão configuráveis:

- URL original: no máximo 2048 caracteres.
- Alias personalizado: entre 3 e 32 caracteres.
- Corpo da requisição: no máximo 16 KB.
- Tentativas de geração de código: no máximo 5.
- Criação de URLs: no máximo 10 requisições por minuto por IP.

Requisições acima do limite de corpo deverão resultar em HTTP 413.

## 3.2. Gerar códigos automaticamente

Quando o usuário não informar um alias, o backend deve gerar um código curto automaticamente.

### Requisitos

- Utilizar um gerador de identificadores baseado em aleatoriedade criptograficamente segura.
- Utilizar um alfabeto Base62: `a-z`, `A-Z` e `0-9`.
- Começar com um comprimento configurável de sete caracteres.
- Verificar a disponibilidade do código antes de concluir a criação.
- Tratar colisões sem sobrescrever registros existentes.
- Permitir que o comprimento seja alterado posteriormente por configuração.
- Não gerar códigos que coincidam com aliases reservados pelo sistema.
- Não depender de um contador global centralizado.

O sistema não precisa implementar um Key Generation Service no MVP.

### Tratamento de colisões

Se um código já existir, o backend deverá gerar outro e repetir a tentativa dentro de um limite configurável, com padrão de 5 tentativas.

A persistência deve utilizar uma operação que não sobrescreva um documento existente.

Se todas as tentativas falharem, a API deverá retornar um erro controlado, sem criar registros inconsistentes.

## 3.3. Aliases personalizados

O usuário poderá solicitar um código específico.

Exemplo:

`https://short.example/lancamento`

### Regras

- O alias é opcional.
- Deve possuir entre 3 e 32 caracteres.
- Deve aceitar somente letras ASCII, números, hífens e underscores.
- Não deve permitir espaços.
- A unicidade e a busca serão case-sensitive.
- O alias será armazenado exatamente como informado, preservando maiúsculas e minúsculas.
- O alias não pode ser reutilizado enquanto estiver reservado por um registro existente.
- A reserva deve ser segura sob requisições concorrentes.
- Aliases reservados pelo sistema não poderão ser utilizados.

Exemplos de aliases reservados:

- `api`
- `health`
- `docs`
- `admin`
- `assets`
- `favicon.ico`

`favicon.ico` não é um alias válido pelo regex, mas permanece na lista para documentar a rota estática reservada.

A lista deverá ser centralizada em uma configuração do backend e poderá crescer conforme as rotas da aplicação forem definidas.

A comparação com a lista de aliases reservados será case-sensitive, assim como a unicidade dos aliases.

### Conflito

Se o alias já estiver ocupado, a API deverá retornar HTTP 409.

O frontend deverá identificar o conflito pelo código `ALIAS_TAKEN`, informar que o alias está indisponível e permitir que o usuário escolha outro.

## 3.4. Redirecionar para a URL original

Ao acessar uma URL curta, o sistema deve localizar o registro e redirecionar o navegador.

### Exemplo

Requisição:

`GET /aZ3kP9q`

Resposta esperada:

- Status HTTP 302.
- Cabeçalho `Location` contendo a URL original.

### Regras

- O código deve ser validado antes da consulta.
- A busca pelo código será case-sensitive.
- O backend deve consultar o armazenamento persistente.
- Links inexistentes devem retornar HTTP 404.
- Links expirados devem retornar HTTP 404.
- O sistema não deve redirecionar para destinos inválidos.
- O redirecionamento não deve depender de uma chamada externa adicional para localizar a URL.
- O caminho de redirecionamento deve realizar o mínimo de trabalho necessário.
- O destino deve ser obtido do registro persistido, nunca de um parâmetro arbitrário fornecido na requisição de redirecionamento.

O MVP utilizará HTTP 302 para manter o comportamento de redirecionamento sob controle do serviço.

As respostas de redirecionamento e de erro do endpoint `GET /:code` deverão utilizar `Cache-Control: no-store` para evitar que navegadores ou intermediários armazenem redirecionamentos incompatíveis com a expiração.

## 3.5. Expiração de URLs

Toda URL curta terá expiração. O usuário poderá escolher uma das opções predefinidas; caso não informe um valor, o backend aplicará 24 horas (valor padrão configurável).

### Comportamento

- A expiração é opcional na requisição, mas o registro persistido sempre possuirá `expiresAt`.
- Quando não informada, o backend definirá o instante de criação mais 24 horas.
- A data deverá ser convertida para um instante inequívoco, armazenado em UTC.
- A API deverá rejeitar datas inválidas.
- A API deverá rejeitar datas iguais ou anteriores ao momento da criação.
- A API deverá rejeitar datas superiores ao limite máximo configurado (padrão de 24 horas) a partir do momento da criação.
- Uma URL será considerada expirada quando o instante atual for maior ou igual ao seu instante de expiração.
- Links expirados não poderão redirecionar.
- O registro expirado poderá continuar armazenado até que seja removido por um processo de limpeza.
- O MVP não implementará remoção física nem reutilização de códigos expirados.

A verificação lógica da expiração é obrigatória e não poderá depender da remoção física do documento no banco.

A interface oferecerá as seguintes opções:

- 30 minutos.
- 1 hora.
- 8 horas.
- 12 horas.
- 24 horas.

A opção de 24 horas será o padrão da interface e também o padrão do backend quando `expiresAt` não for enviado.

Quando a opção de 24 horas for selecionada, o frontend poderá omitir `expiresAt` e deixar o backend aplicar o padrão, evitando rejeição por diferença de relógio ou latência.

O backend deverá validar o instante de expiração independentemente das opções apresentadas no frontend.

## 3.6. Copiar URL curta

Após uma criação bem-sucedida, o usuário deverá conseguir copiar o link.

### Requisitos

- Exibir a URL curta completa.
- Disponibilizar um botão de cópia.
- Utilizar a Clipboard API do navegador.
- Exibir confirmação visual após uma cópia bem-sucedida.
- Informar quando a cópia falhar e oferecer uma alternativa para selecionar o texto.
- Não depender exclusivamente de mudanças de cor para indicar sucesso.

## 3.7. Visualizar o resultado da criação

Após criar uma URL, o frontend deverá apresentar:

- URL original.
- URL curta.
- Código gerado ou alias.
- Data de expiração.
- Ação para copiar o link.
- Ação para criar outra URL.

A interface deverá manter o resultado visível até que o usuário inicie uma nova operação ou saia da página.

O MVP não exige persistência do histórico de links no navegador.

---

# 4. Requisitos de interface

## 4.1. Página inicial

A página inicial deverá apresentar:

- Nome do produto.
- Título explicando sua finalidade.
- Campo para a URL original.
- Campo opcional para alias personalizado.
- Controle de expiração com opções de 30 minutos, 1 hora, 8 horas, 12 horas e 24 horas, com 24 horas como padrão.
- Botão para criar a URL curta.
- Área para exibir o resultado.
- Área para mensagens de erro e validação.

## 4.2. Estados da interface

A interface deverá contemplar:

1. Estado inicial.
2. URL inválida.
3. Formulário incompleto.
4. Criação em andamento.
5. Criação concluída.
6. Alias indisponível.
7. Erro de comunicação com a API.
8. Falha inesperada.
9. Falha ao copiar.
10. Limite de criação excedido.
11. Nova criação após uma criação bem-sucedida.

Durante uma requisição, o botão de criação deverá indicar o carregamento e impedir envios repetidos.

Erros não poderão apagar desnecessariamente os dados já preenchidos.

## 4.3. Responsividade

A aplicação deverá funcionar em:

- Desktop.
- Tablet.
- Smartphones.

O formulário e o resultado deverão permanecer utilizáveis em telas estreitas.

## 4.4. Acessibilidade

Requisitos mínimos:

- Campos com labels acessíveis.
- Navegação por teclado.
- Estados de foco visíveis.
- Contraste adequado.
- Mensagens de erro associadas aos campos correspondentes.
- Feedback de sucesso anunciado por tecnologias assistivas quando apropriado.
- Botões com nomes acessíveis.

## 4.5. Design

O produto deverá ter uma interface limpa, moderna e objetiva.

Tailwind CSS será utilizado para a estilização.

A implementação deverá priorizar consistência visual, componentes reutilizáveis e simplicidade.

Não é necessário criar um design system complexo para o MVP.

---

# 5. Requisitos não funcionais

## 5.1. Desempenho

O sistema deverá minimizar o número de operações realizadas durante a criação e o redirecionamento.

Como metas iniciais de validação, propõem-se:

- A API deverá ter p95 inferior a 300 ms em operações de leitura e criação, excluindo redirecionamentos externos, em um ambiente de teste controlado.
- A API deverá ter p99 inferior a 1 segundo nas mesmas condições.
- O redirecionamento deverá evitar consultas ou serviços desnecessários.
- A interface deverá apresentar feedback imediato durante operações assíncronas.

Esses valores são metas iniciais para o MVP, não garantias de produção. Deverão ser revisados após medições com o Firestore e o ambiente de hospedagem escolhidos.

As metas não consideram o cold start do plano gratuito do Render.

Não é necessário implementar infraestrutura específica para atingir 100 mil redirecionamentos por segundo na primeira versão.

## 5.2. Disponibilidade

- Erros no armazenamento devem produzir respostas controladas.
- Falhas no backend não devem expor stack traces ao usuário.
- O backend deve disponibilizar um endpoint de health check.
- A aplicação deverá distinguir erros de validação de erros internos.

## 5.3. Segurança

- Somente URLs HTTP e HTTPS serão aceitas.
- A aplicação deverá rejeitar URLs com credenciais embutidas, como `https://user:password@example.com`.
- Os destinos não deverão ser consultados pelo servidor durante a criação.
- O backend não deverá executar requisições arbitrárias aos destinos informados.
- O SDK administrativo do Firebase deverá ser utilizado somente no backend.
- As regras de segurança do Firestore deverão negar leitura e escrita diretas de clientes.
- Credenciais e segredos não poderão ser versionados.
- As mensagens de erro não deverão revelar detalhes internos.
- A criação pública deverá possuir proteção básica contra abuso.
- A API deverá impor os limites de tamanho de entrada definidos na seção 3.1.
- O sistema deverá utilizar HTTPS no ambiente de produção.
- A aplicação deverá definir uma política de CORS restritiva no ambiente de produção, permitindo apenas a origem do frontend na Vercel.
- O backend deverá validar os dados mesmo quando o frontend já tiver realizado validações.

### Proteção contra abuso

Como não haverá autenticação no MVP, o projeto deverá incluir rate limiting para a criação de URLs.

A implementação inicial utilizará limites por IP no backend, com padrão de 10 criações por minuto por IP e resposta HTTP 429 com `Retry-After` quando o limite for excedido.

No Render, o backend deverá configurar corretamente o `trust proxy` para utilizar o IP encaminhado pelo proxy da plataforma, sem confiar cegamente em cabeçalhos enviados pelo cliente.

O rate limiting em memória será aceitável no MVP, desde que sua limitação seja documentada: ele não é compartilhado entre instâncias e é reiniciado quando o processo reinicia.

A implementação deverá evitar armazenar dados pessoais desnecessários.

## 5.4. Privacidade

O MVP não terá contas de usuário.

Não será necessário coletar nome, e-mail ou outros dados pessoais para criar uma URL.

Endereços IP não deverão ser persistidos por padrão, salvo necessidade técnica documentada para proteção contra abuso.

Os registros de URL deverão conter somente os dados necessários ao funcionamento do serviço.

## 5.5. Manutenibilidade

- TypeScript deverá ser utilizado no frontend e no backend.
- O domínio não deverá depender diretamente do SDK do Firestore.
- A lógica de negócio deverá ficar separada dos controllers HTTP.
- O frontend deverá separar componentes, páginas e acesso à API.
- Os testes deverão fazer parte do fluxo de desenvolvimento.
- O projeto deverá possuir instruções de instalação e execução.
- A configuração deverá utilizar variáveis de ambiente.
- Os erros deverão ser tratados de maneira consistente.

---

# 6. Arquitetura proposta

## 6.1. Visão geral

A aplicação será dividida em frontend e backend.

O frontend será responsável pela experiência do usuário.

O backend será responsável pelas regras de negócio, validação, geração de códigos, persistência e redirecionamentos.

O backend será hospedado no Render, no plano gratuito, e o frontend na Vercel. O backend servirá tanto a API quanto o redirecionamento; o frontend consumirá a API por HTTPS.

O Firestore será o armazenamento persistente.

Redis não fará parte da arquitetura inicial.

## 6.2. Stack tecnológica

### Frontend

- React.
- Vite.
- TypeScript.
- Tailwind CSS.
- Zod para validação compartilhada de formulários.
- React Testing Library.
- Vitest.
- Playwright para testes E2E.

### Backend

- Node.js.
- TypeScript.
- NestJS.
- Fastify como adaptador HTTP.
- Firebase Admin SDK.
- Cloud Firestore.
- Vitest para testes.
- Zod para validação dos dados de entrada, integrado ao NestJS por meio de um pipe customizado.

O uso de Zod será obrigatório no frontend e no backend, com os esquemas centralizados no pacote `contracts`, evitando duplicação de regras de validação.

### Ferramentas compartilhadas

- pnpm.
- ESLint.
- Prettier.
- TypeScript em modo estrito.
- Git.

As versões deverão ser escolhidas durante a implementação com base em versões estáveis e compatíveis entre si.

Não utilizar versões experimentais sem justificativa documentada.

## 6.3. Estrutura de diretórios sugerida

O projeto deverá utilizar um monorepo.

Estrutura inicial:

    shortlink/
    ├── apps/
    │   ├── web/
    │   │   ├── src/
    │   │   │   ├── components/
    │   │   │   ├── pages/
    │   │   │   ├── services/
    │   │   │   ├── hooks/
    │   │   │   ├── types/
    │   │   │   └── test/
    │   │   └── package.json
    │   │
    │   └── api/
    │       ├── src/
    │       │   ├── modules/
    │       │   │   └── urls/
    │       │   ├── common/
    │       │   ├── config/
    │       │   └── main.ts
    │       └── package.json
    │
    ├── packages/
    │   └── contracts/
    │
    ├── docs/
    │   ├── PRD.md
    │   └── architecture.md
    │
    ├── package.json
    ├── pnpm-workspace.yaml
    ├── tsconfig.base.json
    └── README.md

Essa estrutura é uma proposta inicial. O OpenCode poderá sugerir ajustes antes da implementação, desde que preserve a separação de responsabilidades e evite abstrações desnecessárias.

O pacote `contracts` deverá conter os tipos e os esquemas Zod compartilhados entre frontend e backend, servindo como fonte única de verdade para os contratos da API.

O build do monorepo deverá respeitar a ordem `contracts` → `api`/`web`, usando os scripts do pnpm workspace.

O frontend não deverá importar código que dependa do Firebase Admin SDK ou de APIs exclusivas do Node.js.

---

# 7. Persistência com Cloud Firestore

## 7.1. Decisão inicial

O MVP utilizará Cloud Firestore como banco de dados.

A escolha será validada durante a fase de planejamento técnico, principalmente em relação a custos, unicidade, concorrência e estratégia de expiração.

O Firestore será acessado exclusivamente pelo backend. As regras de segurança do Firestore deverão negar leitura e escrita diretas de clientes.

## 7.2. Modelo de dados

Coleção:

`urls`

Cada documento será identificado pelo código curto.

Exemplo conceitual:

    urls/
      aZ3kP9q
        originalUrl: "https://example.com/article"
        createdAt: timestamp
        expiresAt: timestamp
        isCustomAlias: false

Campos:

| Campo           | Tipo              | Obrigatório | Descrição                                      |
| --------------- | ----------------- | ----------- | ---------------------------------------------- |
| `originalUrl`   | string            | Sim         | URL original validada                          |
| `createdAt`     | timestamp         | Sim         | Instante de criação                            |
| `expiresAt`     | timestamp         | Sim         | Instante de expiração; padrão de 24 horas após a criação |
| `isCustomAlias` | boolean           | Sim         | Indica se o código foi escolhido pelo usuário  |

O ID do documento será o código curto exatamente como gerado ou informado, preservando maiúsculas e minúsculas.

Não haverá campo de contador de cliques no MVP.

## 7.3. Unicidade e concorrência

O sistema deverá garantir que um código nunca sobrescreva outro registro existente.

O espaço de identificadores é único: códigos gerados e aliases personalizados não podem colidir entre si, pois ambos são usados como ID do documento.

Para códigos gerados automaticamente, a aplicação deverá:

1. Gerar um código.
2. Tentar criar o documento sem permitir sobrescrita.
3. Detectar conflito de identificador.
4. Gerar outro código quando necessário.
5. Encerrar a operação após um número limitado de tentativas.

Para aliases personalizados, a aplicação deverá tentar reservar o identificador por meio de uma operação atômica de criação.

Uma consulta prévia poderá ser utilizada para melhorar a experiência do usuário, mas não será suficiente para garantir unicidade.

O armazenamento deverá ser a autoridade final em caso de concorrência.

## 7.4. Expiração

O backend verificará o campo `expiresAt` durante cada resolução.

A remoção física de registros expirados não será implementada no MVP.

O Firestore poderá oferecer mecanismos de expiração automática para limpeza posterior, mas essa configuração deverá ser avaliada separadamente.

A expiração física poderá ocorrer com atraso e não deverá ser confundida com a expiração lógica.

## 7.5. Custos e limites

Durante a fase de planejamento, deverão ser avaliados:

- Número de leituras e escritas.
- Custos de armazenamento.
- Limites e cotas do Firestore.
- Custos de ambientes de desenvolvimento e produção.
- Comportamento sob criação concorrente.
- Estratégia de exportação e recuperação dos dados.

O projeto não deverá presumir que a adoção de um banco gerenciado elimina a necessidade de planejamento de custos.

---

# 8. Contrato da API

A API deverá utilizar o prefixo:

`/api/v1`

As respostas de erro da API deverão possuir uma estrutura consistente.

## 8.1. Formato das respostas de erro

Erros dos endpoints sob `/api/v1` deverão retornar JSON no seguinte formato:

    {
      "error": {
        "code": "ALIAS_TAKEN",
        "message": "O alias informado já está em uso.",
        "fields": {
          "customAlias": "Alias indisponível."
        }
      }
    }

`fields` é opcional e presente apenas em erros de validação por campo.

Códigos estáveis previstos para o MVP:

- `INVALID_URL`
- `INVALID_ALIAS`
- `ALIAS_TAKEN`
- `INVALID_EXPIRATION`
- `PAYLOAD_TOO_LARGE`
- `RATE_LIMITED`
- `INTERNAL_ERROR`

As mensagens poderão ser alteradas, mas os códigos acima deverão permanecer estáveis para uso pelo frontend.

Erros do endpoint de redirecionamento `GET /:code` deverão ser apresentados como uma página HTML simples e amigável, com o status HTTP apropriado, sem detalhes internos. Não é necessário retornar JSON nesse endpoint.

## 8.2. Criar uma URL curta

**Endpoint**

`POST /api/v1/urls`

**Request**

    {
      "originalUrl": "https://example.com/articles/system-design",
      "customAlias": "system-design",
      "expiresAt": "2026-10-31T12:00:00.000Z"
    }

`customAlias` e `expiresAt` são opcionais. Quando `expiresAt` não for enviado, o backend aplicará 24 horas a partir do momento da criação.

**Response — 201 Created**

    {
      "code": "system-design",
      "shortUrl": "https://short.example/system-design",
      "originalUrl": "https://example.com/articles/system-design",
      "createdAt": "2026-10-30T12:00:00.000Z",
      "expiresAt": "2026-10-31T12:00:00.000Z"
    }

Os valores de data são exemplos.

A URL curta deverá ser construída utilizando uma configuração explícita para a URL pública do serviço, sem depender do host arbitrário enviado pelo cliente.

### Possíveis erros

Todos os erros deverão seguir o formato definido na seção 8.1.

- `400 Bad Request`: entrada inválida, incluindo expiração inválida ou fora do intervalo permitido (`INVALID_URL`, `INVALID_ALIAS`, `INVALID_EXPIRATION`).
- `409 Conflict`: alias já utilizado (`ALIAS_TAKEN`).
- `413 Payload Too Large`: corpo da requisição acima de 16 KB (`PAYLOAD_TOO_LARGE`).
- `429 Too Many Requests`: limite de criação excedido (`RATE_LIMITED`), com cabeçalho `Retry-After`.
- `500 Internal Server Error`: falha inesperada (`INTERNAL_ERROR`).

## 8.3. Resolver uma URL curta

**Endpoint**

`GET /:code`

Este endpoint será responsável pelo redirecionamento.

### Sucesso

- `302 Found`.
- Cabeçalho `Location` com a URL original.
- Cabeçalho `Cache-Control: no-store`.

### Erros

- `404 Not Found`: código inexistente, expirado ou com formato inválido.
- `500 Internal Server Error`: falha inesperada no processamento.

As respostas de erro deverão ser páginas HTML simples, apropriadas para a navegação no navegador, e não deverão revelar detalhes internos.

## 8.4. Health check

**Endpoint**

`GET /api/v1/health`

**Response — 200 OK**

    {
      "status": "ok"
    }

Este endpoint verificará apenas se o processo está em execução e não dependerá do Firestore, evitando que uma falha temporária de dependência gere um diagnóstico incorreto sobre o estado do processo. Uma verificação de readiness com o Firestore poderá ser adicionada em versão futura.

O Render deverá utilizar este endpoint como health check do serviço.

## 8.5. Documentação

A API deverá possuir documentação OpenAPI gerada com Swagger por meio de `@nestjs/swagger`, disponível no ambiente de desenvolvimento e, se habilitada, em produção.

A documentação deverá descrever:

- Endpoints.
- Campos obrigatórios e opcionais.
- Formatos de entrada e saída.
- Códigos HTTP.
- Regras de validação.
- Exemplos de requisição e resposta.

A documentação deverá permanecer sincronizada com a implementação.

---

# 9. Regras de negócio

As seguintes regras são obrigatórias.

**RN-01 — URL válida**

Somente URLs HTTP e HTTPS estruturalmente válidas poderão ser encurtadas.

**RN-02 — Código exclusivo**

Cada código deverá identificar no máximo uma URL.

**RN-03 — Alias exclusivo**

Um alias não poderá ser associado a dois destinos diferentes.

**RN-04 — Case sensitivity**

Códigos e aliases serão case-sensitive. Maiúsculas e minúsculas serão preservadas tanto no armazenamento quanto na busca.

**RN-05 — Expiração**

Uma URL expirada não poderá ser utilizada para redirecionamento. Toda URL terá um instante de expiração, com padrão de 24 horas.

**RN-06 — Persistência**

A API somente confirmará a criação após a persistência bem-sucedida.

**RN-07 — Falha segura**

Uma falha inesperada não poderá resultar em redirecionamento para um destino arbitrário.

**RN-08 — Código não encontrado**

Um código inexistente deverá resultar em HTTP 404.

**RN-09 — Expiração padrão**

Quando o usuário não informar expiração, o backend aplicará 24 horas a partir da criação.

**RN-10 — Criação anônima**

O usuário não precisará criar uma conta para utilizar o MVP.

**RN-11 — Proteção contra abuso**

A API deverá aplicar limites de criação de acordo com a estratégia definida para o ambiente de hospedagem, com padrão de 10 criações por minuto por IP.

**RN-12 — Sem analytics no MVP**

A criação e o redirecionamento não deverão atualizar contadores de cliques.

---

# 10. Estratégia de testes

Os testes são parte obrigatória do desenvolvimento.

Não serão considerados uma etapa opcional de finalização.

## 10.1. Testes unitários de backend

Utilizar Vitest.

Cobrir pelo menos:

- Validação de URLs.
- Rejeição de protocolos não permitidos.
- Rejeição de URLs com credenciais embutidas.
- Rejeição de URLs acima do limite de tamanho.
- Geração de códigos.
- Tratamento de colisões.
- Comportamento case-sensitive de códigos e aliases.
- Validação de aliases.
- Rejeição de aliases reservados.
- Verificação de expiração.
- Aplicação da expiração padrão de 24 horas.
- Rejeição de expiração inválida, passada ou acima de 24 horas.
- Tratamento de URLs inexistentes.
- Tratamento de erros de persistência.
- Limites de tentativas de geração.
- Comportamento do serviço diante de falhas de dependências.

Os testes unitários deverão utilizar dependências simuladas quando apropriado.

A lógica de negócio não deverá exigir uma conexão real com o Firebase para ser testada.

## 10.2. Testes de integração de backend

Os testes de integração deverão verificar:

- Criação de URLs pela API.
- Persistência e recuperação dos dados.
- Aplicação da expiração padrão de 24 horas.
- Redirecionamento para destinos existentes.
- Respostas para códigos inexistentes.
- Respostas para links expirados.
- Conflitos de aliases.
- Rejeição de aliases reservados.
- Comportamento case-sensitive de códigos e aliases.
- Tratamento de entradas inválidas.
- Respostas 413 para payload acima de 16 KB.
- Respostas 429 para rate limit excedido.
- Cabeçalho `Cache-Control: no-store` no redirecionamento.
- Formato das respostas de erro.
- Garantias de não sobrescrita.
- Comportamento sob solicitações concorrentes de criação.

Preferencialmente, utilizar o Firebase Emulator Suite para executar testes de integração sem depender do projeto de produção.

Os testes deverão garantir que a configuração de teste não permita operações acidentais sobre dados reais.

## 10.3. Testes de frontend

Utilizar Vitest e React Testing Library.

Cobrir pelo menos:

- Renderização do formulário.
- Validação de campos.
- Exibição de erros.
- Seleção de expiração e aplicação do padrão de 24 horas.
- Estado de carregamento.
- Envio dos dados corretos para a API.
- Exibição do resultado.
- Comportamento do botão de cópia.
- Tratamento de falhas de comunicação.
- Tratamento de erro de alias indisponível e de rate limit.
- Possibilidade de iniciar uma nova criação.
- Acessibilidade básica dos controles.

Os testes deverão priorizar comportamentos observáveis pelo usuário, evitando dependência excessiva da estrutura interna dos componentes.

## 10.4. Testes E2E

Utilizar Playwright.

Os testes deverão validar fluxos completos no navegador.

### Cenário 1 — Criar uma URL

1. Abrir a página inicial.
2. Informar uma URL válida.
3. Solicitar a criação.
4. Aguardar a resposta.
5. Verificar a exibição da URL curta.

### Cenário 2 — Criar com alias

1. Abrir a página inicial.
2. Informar uma URL válida.
3. Informar um alias disponível.
4. Criar o link.
5. Verificar se o alias aparece na URL curta.

### Cenário 3 — Alias duplicado

1. Criar uma URL utilizando um alias.
2. Tentar criar outra URL utilizando o mesmo alias.
3. Verificar se a interface apresenta uma mensagem de conflito.

### Cenário 4 — Redirecionamento

1. Criar uma URL curta.
2. Abrir o link criado.
3. Verificar se o navegador é redirecionado para o destino esperado.

### Cenário 5 — URL inexistente

1. Abrir uma URL curta inexistente.
2. Verificar a resposta 404.

### Cenário 6 — URL expirada

1. Criar um link com expiração no passado por meio de preparação controlada dos dados de teste (seed direto no Firestore), já que a API rejeita datas passadas.
2. Abrir o link.
3. Verificar que o redirecionamento não ocorre e que a resposta é 404.

Os testes não deverão depender de atrasos arbitrários ou de esperar vários minutos pela expiração.

Os testes E2E serão implementados e executados na etapa final da implementação.

### Cenário 7 — Erro de comunicação

1. Simular uma falha na API.
2. Tentar criar uma URL.
3. Verificar se a interface informa o problema.
4. Verificar se os dados preenchidos continuam disponíveis.

### Cenário 8 — Responsividade

1. Abrir a aplicação em um viewport de smartphone.
2. Verificar se os campos, botões e resultados continuam acessíveis e utilizáveis.

## 10.5. Critérios de qualidade dos testes

- Testes unitários não deverão depender de serviços externos.
- Testes de integração deverão utilizar um ambiente isolado.
- Testes E2E deverão possuir preparação e limpeza controladas dos dados.
- Os testes deverão ser determinísticos.
- Falhas deverão fornecer informações úteis para diagnóstico.
- O CI deverá executar os testes antes de permitir a integração de alterações.
- Não deverá ser necessário utilizar o banco de produção para executar a suíte automatizada.

A cobertura de código poderá ser medida, mas o objetivo principal será garantir os comportamentos críticos, não atingir um percentual arbitrário.

---

# 11. Configuração e ambientes

O projeto deverá contemplar, no mínimo:

- Desenvolvimento local.
- Testes automatizados.
- Produção.

## 11.1. Variáveis de ambiente

A configuração deverá incluir, conforme necessário:

- `NODE_ENV`
- `PORT`
- `PUBLIC_BASE_URL`
- `CORS_ORIGIN`
- `VITE_API_BASE_URL` (frontend)
- `FIREBASE_PROJECT_ID`
- `GOOGLE_APPLICATION_CREDENTIALS` ou credencial equivalente do Firebase Admin.
- `CODE_LENGTH` (padrão: 7)
- `MAX_GENERATION_ATTEMPTS` (padrão: 5)
- `MAX_URL_LENGTH` (padrão: 2048)
- `MAX_BODY_SIZE` (padrão: 16 KB)
- `RATE_LIMIT_MAX` (padrão: 10)
- `RATE_LIMIT_WINDOW` (padrão: 1 minuto)
- `TRUST_PROXY` (configuração de proxy do Render)
- `MAX_EXPIRATION_HOURS` (padrão: 24)

As credenciais do Firebase Admin deverão utilizar o mecanismo de autenticação apropriado para o ambiente de execução.

Chaves privadas não deverão ser incluídas no repositório.

O projeto deverá disponibilizar um arquivo `.env.example` com valores fictícios e instruções de configuração.

## 11.2. Desenvolvimento local

O README deverá explicar como:

1. Instalar as dependências.
2. Configurar as variáveis de ambiente.
3. Iniciar o emulador do Firebase.
4. Executar o backend.
5. Executar o frontend.
6. Rodar os testes.
7. Executar os testes E2E.

O projeto deverá permitir que um desenvolvedor inicie o ambiente local sem precisar utilizar dados de produção.

## 11.3. Hospedagem

- Backend: Render, no plano gratuito, como um único web service.
- Frontend: Vercel, como aplicação estática.
- Firestore: projeto Firebase acessado apenas pelo backend.
- HTTPS: fornecido pelo Render e pela Vercel.
- `PUBLIC_BASE_URL`: URL pública do backend no Render ou domínio customizado.
- `CORS_ORIGIN`: origem do frontend na Vercel em produção.
- Credenciais do Firebase Admin: configuradas como variáveis de ambiente ou secrets no Render, nunca versionadas.
- Rate limiting: em memória, por instância; aceitável no MVP, documentando que reinícios e múltiplas instâncias afetam o limite.
- Health check do Render: apontando para `GET /api/v1/health`.
- O plano gratuito do Render pode suspender o serviço por inatividade; as metas de desempenho não consideram cold starts.

---

# 12. CI e qualidade

O repositório deverá possuir um fluxo automatizado de verificação.

As verificações mínimas serão:

1. Instalação das dependências.
2. Formatação e lint.
3. Verificação de tipos TypeScript.
4. Testes unitários.
5. Testes de integração.
6. Build do pacote `contracts`.
7. Build do frontend.
8. Build do backend.
9. Testes E2E em um ambiente de teste apropriado.

A ordem e a execução paralela das etapas poderão ser definidas durante a implementação.

O pipeline deverá falhar quando uma verificação obrigatória falhar.

Não será permitido ignorar erros de TypeScript ou testes falhando apenas para concluir o build.

---

# 13. Critérios de aceite do MVP

O MVP será considerado funcional quando os seguintes critérios forem atendidos.

### Criação

- [ ] O usuário consegue criar uma URL curta a partir de uma URL válida.
- [ ] O sistema gera códigos exclusivos.
- [ ] O usuário consegue solicitar um alias personalizado.
- [ ] Aliases duplicados são rejeitados.
- [ ] Aliases reservados são rejeitados.
- [ ] A unicidade e a busca de códigos e aliases são case-sensitive.
- [ ] A expiração padrão de 24 horas é aplicada quando não informada.
- [ ] Expirações inválidas, passadas ou acima do limite configurado (padrão de 24 horas) são rejeitadas.
- [ ] URLs acima de 2048 caracteres e corpos acima de 16 KB são rejeitados.
- [ ] A URL criada é persistida no Firestore.
- [ ] Falhas de persistência não resultam em sucesso falso.

### Redirecionamento

- [ ] O acesso ao código existente resulta em HTTP 302.
- [ ] O cabeçalho `Location` contém o destino esperado.
- [ ] Códigos inexistentes resultam em HTTP 404.
- [ ] Links expirados não redirecionam.
- [ ] O redirecionamento retorna `Cache-Control: no-store`.
- [ ] A busca do código é case-sensitive.
- [ ] O sistema não permite que o cliente escolha arbitrariamente o destino durante o redirecionamento.

### Interface

- [ ] O formulário funciona em desktop e smartphone.
- [ ] O usuário recebe feedback durante as requisições.
- [ ] Erros são apresentados de forma clara.
- [ ] O usuário consegue selecionar a expiração entre as opções predefinidas, com padrão de 24 horas.
- [ ] O usuário consegue copiar o link.
- [ ] O resultado permanece visível após a criação.
- [ ] É possível iniciar uma nova criação.

### Arquitetura

- [ ] O frontend utiliza React, Vite, TypeScript, Tailwind CSS e Zod.
- [ ] O backend utiliza NestJS com Fastify e Zod.
- [ ] Os esquemas Zod são compartilhados pelo pacote `contracts`.
- [ ] O Firestore é acessado exclusivamente pelo backend.
- [ ] As regras de segurança do Firestore negam acesso direto de clientes.
- [ ] Não há dependência de Redis.
- [ ] A lógica de negócio está separada dos detalhes de persistência e HTTP.
- [ ] As regras de unicidade são seguras sob concorrência.
- [ ] O backend está configurado para o Render e o frontend para a Vercel.
- [ ] O CORS permite apenas a origem do frontend em produção.
- [ ] O rate limiting responde com HTTP 429 e `Retry-After`.

### Testes e documentação

- [ ] Os testes unitários de backend passam.
- [ ] Os testes de integração passam.
- [ ] Os testes de frontend passam.
- [ ] Os testes E2E dos fluxos críticos passam ao final da implementação.
- [ ] Os comandos de build passam.
- [ ] O README documenta a configuração e execução.
- [ ] A API possui documentação Swagger/OpenAPI atualizada.
- [ ] As credenciais não estão versionadas.

---

# 14. Evolução futura

A arquitetura deverá permitir a evolução gradual do produto.

Possíveis etapas:

## Fase 2 — Gerenciamento de links

- Autenticação.
- Histórico de URLs.
- Exclusão de links.
- Gerenciamento de links pelo proprietário.

## Fase 3 — Analytics

- Contagem de cliques.
- Relatórios por URL.
- Eventos de acesso.
- Processamento assíncrono.
- Armazenamento analítico separado, caso necessário.

## Fase 4 — Desempenho

- Introdução de Redis quando houver justificativa.
- Cache controlado de URLs populares.
- Avaliação de CDN.
- Testes de carga.
- Otimização de consultas e custos.

## Fase 5 — Escalabilidade

- Avaliação de padrões de acesso.
- Revisão do modelo de persistência.
- Estratégias de particionamento.
- Métricas e alertas operacionais.
- Recuperação de falhas e políticas de disponibilidade.

Essas fases não fazem parte dos critérios de aceite do MVP.

A adoção de novas tecnologias deverá ser justificada por requisitos mensuráveis.

---

# 15. Orientações para a implementação assistida por IA

O desenvolvimento será conduzido com o auxílio do OpenCode.

A IA deverá utilizar este PRD como referência funcional, mas não deverá começar implementando todo o sistema de uma só vez.

O processo recomendado é:

### Etapa 1 — Análise

- Analisar o PRD.
- Identificar ambiguidades e inconsistências.
- Validar a compatibilidade da stack.
- Avaliar os riscos do Firestore.
- Identificar as decisões técnicas que precisam ser tomadas antes da implementação.

As decisões de case sensitivity, contrato de erro, expiração padrão, limites, hospedagem e validação com Zod já estão definidas neste PRD.

### Etapa 2 — Planejamento técnico

- Propor a arquitetura detalhada.
- Definir os módulos e suas responsabilidades.
- Definir os contratos da API.
- Definir o modelo de persistência.
- Definir a estratégia de testes.
- Identificar as dependências e os riscos.
- Propor uma sequência de implementação incremental.

### Etapa 3 — Implementação incremental

- Criar a estrutura do monorepo.
- Configurar as ferramentas.
- Implementar os contratos.
- Implementar o backend.
- Implementar a persistência.
- Implementar o frontend.
- Criar os testes.
- Validar os fluxos E2E.

A implementação deverá avançar em incrementos pequenos e verificáveis.

### Etapa 4 — Revisão

Após cada incremento:

- Executar as verificações pertinentes.
- Revisar os diffs.
- Verificar se os critérios de aceite foram atendidos.
- Investigar falhas.
- Atualizar a documentação quando necessário.

A IA deverá explicar decisões arquiteturais relevantes, especialmente quando houver alternativas com diferentes custos ou níveis de complexidade.

### Etapa 5 — Finalização

Antes de considerar o MVP concluído:

- Executar a suíte de testes.
- Executar os builds.
- Verificar a configuração dos ambientes.
- Confirmar a ausência de credenciais versionadas.
- Validar os fluxos críticos.
- Atualizar a documentação.

A conclusão não deverá ser declarada enquanto houver falhas conhecidas nos critérios obrigatórios de aceite.

---

# 16. Princípios arquiteturais

O projeto deverá seguir estes princípios:

1. Começar simples.
2. Evitar abstrações sem necessidade concreta.
3. Separar domínio, aplicação, infraestrutura e transporte HTTP.
4. Manter a lógica de negócio independente do Firestore.
5. Garantir integridade dos dados sob concorrência.
6. Validar entradas no backend.
7. Testar comportamentos observáveis.
8. Evitar duplicação desnecessária de regras.
9. Introduzir complexidade somente quando houver justificativa.
10. Documentar decisões arquiteturais importantes.
11. Não adicionar Redis, filas ou microsserviços sem requisitos que justifiquem sua adoção.
12. Priorizar legibilidade, manutenção e comportamento correto.

---

# 17. Resultado esperado

Ao final do MVP, deverá existir uma aplicação web funcional que permita criar URLs curtas, utilizar aliases personalizados, configurar a expiração com padrão de 24 horas e redirecionar usuários para os destinos originais.

A aplicação deverá possuir testes automatizados, documentação e uma arquitetura preparada para evoluir.

O resultado não será apenas um encurtador de URLs: será uma base de estudo e desenvolvimento para explorar arquitetura de backend, persistência, testes, concorrência, contratos de API e evolução de sistemas com assistência de IA.

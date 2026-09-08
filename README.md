# TravelCash — Dashboard Financeiro para Viagens

Aplicação full-stack de controle financeiro de viagens: um **dashboard** que reproduz a
tela de referência do projeto e um **backend REST** completo com CRUD para todos os
recursos. Frontend em HTML/CSS/JS puro (sem framework), backend em Node.js + Express e
persistência local em arquivo JSON.

## Stack

- Node.js 18+
- Express 4
- CORS
- Persistência local em `data/db.json` (sem banco externo)
- Frontend em HTML + CSS + JavaScript puro (SPA leve, sem framework)

## Como executar

```bash
npm install
npm start
```

Depois abra no navegador:

```text
http://localhost:3000
```

Para desenvolvimento com reload automático:

```bash
npm run dev
```

O dashboard consome o backend em `GET /api/dashboard?tripId=1`.

## Organização do projeto

```text
travelcash-dashboard/
├── data/
│   └── db.json           # "banco de dados" em arquivo (estado inicial + dados gravados)
├── public/               # frontend servido como estático pelo Express
│   ├── index.html        # dashboard + seções (abas) + modais de cadastro
│   ├── styles.css        # identidade visual
│   └── app.js            # SPA: navegação, render das telas e chamadas à API
├── src/
│   └── store.js          # camada de acesso ao db.json (list/get/create/update/remove)
├── server.js             # servidor Express + rotas REST + regra do dashboard
├── package.json
└── README.md
```

A separação é intencional: **rota** (server.js), **armazenamento** (store.js),
**regra do dashboard** (endpoint `/api/dashboard`) e **interface** (public/) ficam
isolados. Trocar o `store.js` por um banco relacional (PostgreSQL/MySQL) no futuro não
exige mudar as rotas nem o frontend — o contrato REST permanece o mesmo.

## Entidades

| Recurso        | Rota base           | Campos obrigatórios (POST)                             |
|----------------|---------------------|--------------------------------------------------------|
| Usuários       | `/api/users`        | `name`, `email`                                        |
| Viagens        | `/api/trips`        | `name`, `startDate`, `endDate`                         |
| Orçamentos     | `/api/budgets`      | `tripId`, `totalBudget`                                |
| Despesas       | `/api/expenses`     | `tripId`, `category`, `description`, `amount`, `date`  |
| Roteiro        | `/api/itinerary`    | `tripId`, `date`, `title`                              |
| Transportes    | `/api/transports`   | `tripId`, `type`, `description`, `amount`              |
| Seguros        | `/api/insurances`   | `tripId`, `provider`, `coverage`                       |
| Metas          | `/api/goals`        | `name`, `targetAmount`, `currentAmount`                |
| Alertas        | `/api/alerts`       | `tripId`, `type`, `title`, `message`                   |

> `transports` e `insurances` existem no backend e são consumidos pelo dashboard,
> mas ainda não têm aba própria no frontend.

## API REST

Todas as respostas seguem um formato padronizado.

**Sucesso:**

```json
{
  "success": true,
  "data": {}
}
```

**Erro:**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Campos obrigatórios ausentes."
  }
}
```

### CRUD (para cada recurso da tabela acima)

- `GET    /api/{recurso}`          — lista todos (aceita `?tripId=` como filtro)
- `GET    /api/{recurso}/:id`      — busca por id
- `POST   /api/{recurso}`          — cria (valida os campos obrigatórios)
- `PUT    /api/{recurso}/:id`      — atualiza
- `DELETE /api/{recurso}/:id`      — remove

### Rotas especiais

- `GET /api/health` — status do servidor.
- `GET /api/dashboard?tripId=1` — agrega os dados de uma viagem e devolve os
  indicadores prontos: totais, saldo, % de utilização, média diária, gastos por
  categoria, roteiro, alertas, despesas recentes e metas.

### Exemplos

Criar uma despesa:

```http
POST /api/expenses
Content-Type: application/json

{
  "tripId": 1,
  "category": "Alimentação",
  "description": "Jantar",
  "amount": 120,
  "date": "2025-06-05"
}
```

Atualizar:

```http
PUT /api/expenses/1
Content-Type: application/json

{ "amount": 250 }
```

Excluir:

```http
DELETE /api/expenses/1
```

## Frontend — navegação por abas

A barra lateral é uma SPA simples. Cada aba abre uma área funcional reaproveitando
cores, cartões, tipografia e espaçamento do dashboard:

- **Dashboard** — visão geral com indicadores, gráfico de categorias, alertas, roteiro,
  metas e últimas despesas (dados vindos de `/api/dashboard`).
- **Minhas Viagens** — cadastro, pesquisa por nome/destino, filtro por status,
  indicadores (quantidade, viajantes, próxima viagem) e exclusão.
- **Orçamentos** — orçamento da viagem atual, barra de utilização, saldo, recomendação
  e tabela por viagem.
- **Despesas** — cadastro, indicadores financeiros, pesquisa, filtro por
  categoria/viagem e exclusão.
- **Roteiro** — cadastro de atividades, contagem, custo previsto, filtro por viagem e
  linha do tempo.
- **Metas de Economia** — cadastro, progresso total, metas individuais e contribuição
  a uma meta.
- **Relatórios** — resumo, análise por categoria, comparação por viagem, impressão e
  exportação CSV.
- **Alertas** — cadastro, contadores por tipo, filtros e limpeza dos avisos informativos.
- **Configurações** — perfil (via API), preferências de notificações e regras
  financeiras (persistidas no navegador via `localStorage`).

Cada aba com botão **"+ Novo(a)…"** abre um modal de cadastro que envia um `POST` para a
API correspondente e atualiza a tela ao salvar.

## Observação acadêmica

A persistência em JSON foi escolhida para o projeto rodar sem configuração de banco e
deixar clara a separação entre rota, armazenamento, regra de negócio e frontend. O mesmo
contrato REST pode ser migrado para um banco relacional em uma etapa posterior sem alterar
a interface.

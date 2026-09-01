# ✈️ Controle Financeiro para Viagens

API REST para planejamento e controle financeiro de viagens: cadastre viagens com orçamento definido, registre despesas por categoria e acompanhe em tempo real quanto do orçamento já foi utilizado.

## 📌 Problema escolhido

Quem viaja costuma perder o controle dos gastos: as despesas acontecem em momentos e lugares diferentes (alimentação, transporte, hospedagem, passeios) e, sem um registro centralizado, o viajante só percebe que estourou o orçamento quando já é tarde. Planilhas manuais são trabalhosas e não dão visibilidade imediata do saldo disponível.

## 💡 Solução proposta

Uma API de controle financeiro focada em viagens. O usuário cadastra uma viagem com destino, período e orçamento total; ao longo da viagem registra cada despesa com valor, data e categoria. A API consolida tudo automaticamente e expõe um resumo financeiro com total gasto, saldo disponível, percentual do orçamento utilizado e gastos agrupados por categoria — permitindo decisões rápidas ("ainda posso fazer aquele passeio?") com base em dados reais.

## 👥 Integrantes

| Nome | Responsabilidade |
|------|------------------|
| Gustavo Paiva | Documentação Swagger, GitHub e README |
| Arthur | Coparticipação no back-end (deploy) |
| Pereira | GitHub e README |
| *(completar com os demais integrantes e RMs)* | |

## 🛠️ Tecnologias utilizadas

- **Python 3.11+**
- **FastAPI** — framework web com geração automática de documentação OpenAPI/Swagger
- **SQLAlchemy 2.0** — ORM
- **SQLite** — banco de dados relacional (arquivo local, sem instalação)
- **Pydantic v2** — validação de dados e schemas
- **Uvicorn** — servidor ASGI

## 🏗️ Arquitetura inicial

Arquitetura em camadas, com separação entre rotas, schemas (validação) e modelos (persistência):

```
trip-budget-api/
├── app/
│   ├── main.py            # Ponto de entrada — cria a aplicação e registra as rotas
│   ├── database.py        # Conexão com o banco (SQLAlchemy + SQLite)
│   ├── models.py          # Modelos ORM (tabelas: usuarios, viagens, despesas)
│   ├── schemas.py         # Schemas Pydantic (requisições/respostas + exemplos)
│   └── routers/
│       ├── usuarios.py    # Endpoints de usuários
│       ├── viagens.py     # Endpoints de viagens + resumo financeiro
│       └── despesas.py    # Endpoints de despesas (aninhados em viagens)
├── requirements.txt
├── .env.example
└── README.md
```

Modelo de dados: **Usuário** (1) → (N) **Viagem** (1) → (N) **Despesa**.

## ⚙️ Instalação

Pré-requisito: Python 3.11 ou superior.

```bash
# 1. Clonar o repositório
git clone https://github.com/gustafpsdev/trip-budget-api.git
cd trip-budget-api

# 2. Criar e ativar o ambiente virtual
python -m venv .venv
source .venv/bin/activate        # Linux/macOS
.venv\Scripts\activate           # Windows

# 3. Instalar as dependências
pip install -r requirements.txt
```

## 🔐 Configuração das variáveis de ambiente

Copie o arquivo de exemplo e ajuste se necessário:

```bash
cp .env.example .env
```

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `DATABASE_URL` | String de conexão do banco | `sqlite:///./viagens.db` |

> Com o padrão SQLite, nenhuma configuração extra é necessária — o banco é criado automaticamente na primeira execução.

## ▶️ Execução

```bash
uvicorn app.main:app --reload
```

A API sobe em `http://localhost:8000`. As tabelas do banco são criadas automaticamente na inicialização.

## 🗄️ Banco de dados

**SQLite** — banco relacional em arquivo (`viagens.db`), criado automaticamente pelo SQLAlchemy na primeira execução. Foi escolhido pela simplicidade de setup em ambiente acadêmico; a string de conexão em `DATABASE_URL` permite trocar por PostgreSQL/MySQL sem alterar o código.

Tabelas: `usuarios`, `viagens`, `despesas` (com chaves estrangeiras e exclusão em cascata).

## 🔗 Principais endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| `POST` | `/usuarios` | Cadastrar usuário |
| `GET` | `/usuarios` | Listar usuários |
| `GET` | `/usuarios/{id}` | Buscar usuário por ID |
| `POST` | `/viagens` | Criar viagem (destino, período, orçamento) |
| `GET` | `/viagens` | Listar viagens (filtro opcional `?usuario_id=`) |
| `GET` | `/viagens/{id}` | Buscar viagem por ID |
| `PUT` | `/viagens/{id}` | Atualizar viagem |
| `DELETE` | `/viagens/{id}` | Excluir viagem (e suas despesas) |
| `POST` | `/viagens/{id}/despesas` | Registrar despesa |
| `GET` | `/viagens/{id}/despesas` | Listar despesas (filtro opcional `?categoria=`) |
| `PUT` | `/viagens/{id}/despesas/{despesa_id}` | Atualizar despesa |
| `DELETE` | `/viagens/{id}/despesas/{despesa_id}` | Excluir despesa |
| `GET` | `/viagens/{id}/resumo` | Resumo financeiro (total gasto, saldo, % utilizado, gastos por categoria) |

Categorias de despesa aceitas: `alimentacao`, `transporte`, `hospedagem`, `passeios`, `compras`, `outros`.

### Exemplo de uso

```bash
# Criar usuário
curl -X POST http://localhost:8000/usuarios \
  -H "Content-Type: application/json" \
  -d '{"nome": "Gustavo Paiva", "email": "gustavo@email.com"}'

# Criar viagem
curl -X POST http://localhost:8000/viagens \
  -H "Content-Type: application/json" \
  -d '{"usuario_id": 1, "destino": "Rio de Janeiro", "data_inicio": "2026-10-10", "data_fim": "2026-10-17", "orcamento": 3500}'

# Registrar despesa
curl -X POST http://localhost:8000/viagens/1/despesas \
  -H "Content-Type: application/json" \
  -d '{"descricao": "Jantar", "categoria": "alimentacao", "valor": 180.50, "data": "2026-10-11"}'

# Consultar resumo financeiro
curl http://localhost:8000/viagens/1/resumo
```

## 📖 Documentação Swagger

Com a API em execução:

- **Swagger UI:** [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc:** [http://localhost:8000/redoc](http://localhost:8000/redoc)
- **Especificação OpenAPI (JSON):** [http://localhost:8000/openapi.json](http://localhost:8000/openapi.json)

A documentação apresenta todos os endpoints, métodos HTTP, parâmetros, corpos de requisição, respostas possíveis, códigos HTTP e exemplos — e permite testar as requisições diretamente pelo navegador.

## 📋 Gestão do projeto

- **Trello/Notion:** *(inserir o link do board da equipe aqui)*


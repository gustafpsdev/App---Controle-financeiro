# 💰 API de Controle Financeiro

> API REST para controle financeiro pessoal — cadastro de contas, lançamentos, categorias e cálculo de saldo.
> Projeto desenvolvido para o Checkpoint 1 (CP1) da FIAP.

---

## 📋 Sobre o projeto

Esta API permite gerenciar as finanças pessoais de um usuário, oferecendo funcionalidades para:

- Cadastrar e consultar **contas** (ex: carteira, banco, poupança)
- Registrar **lançamentos** de receita e despesa
- Organizar lançamentos por **categorias** (ex: alimentação, transporte, salário)
- Calcular o **saldo** atual e o resumo por período

---

## 🛠️ Tecnologias utilizadas

- **Python 3.11+**
- **FastAPI** — framework para construção da API
- **Uvicorn** — servidor de execução
- **SQLAlchemy** — comunicação com o banco de dados
- **SQLite / PostgreSQL** — banco de dados
- **Swagger (OpenAPI)** — documentação interativa

---

## 👥 Integrantes do grupo

| Nome | RM | Responsabilidade |
|------|----|----|
| NOME_1 | RM_1 | Regras de negócio |
| NOME_2 | RM_2 | Formato da API |
| NOME_3 | RM_3 | Backend |
| Gustavo Paiva | RM_4 | Documentação (GitHub + Swagger) |
| NOME_5 | RM_5 | Conexão com banco |

---

## ▶️ Como rodar o projeto

### 1. Clonar o repositório
```bash
git clone https://github.com/USUARIO/NOME_DO_REPOSITORIO.git
cd NOME_DO_REPOSITORIO
```

### 2. Criar e ativar o ambiente virtual
```bash
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate
```

### 3. Instalar as dependências
```bash
pip install -r requirements.txt
```

### 4. Rodar a aplicação
```bash
uvicorn main:app --reload
```

A API estará disponível em: `http://localhost:8000`

---

## 📖 Documentação da API (Swagger)

Com o projeto rodando, a documentação interativa fica disponível automaticamente em:

- **Swagger UI:** `http://localhost:8000/docs`
- **ReDoc:** `http://localhost:8000/redoc`

---

## 🔗 Principais endpoints

> ⚠️ Preencher conforme o formato definido pelo responsável pela API.

| Método | Rota | Descrição |
|--------|------|-----------|
| GET    | `/contas` | Lista todas as contas |
| POST   | `/contas` | Cadastra uma nova conta |
| GET    | `/lancamentos` | Lista os lançamentos |
| POST   | `/lancamentos` | Registra um novo lançamento |
| GET    | `/categorias` | Lista as categorias |
| GET    | `/saldo` | Retorna o saldo atual |

---

## 📁 Estrutura de pastas

```
NOME_DO_REPOSITORIO/
├── main.py            # Ponto de entrada da aplicação
├── models/            # Modelos de dados
├── routes/            # Rotas/endpoints da API
├── database.py        # Conexão com o banco
├── requirements.txt   # Dependências do projeto
└── README.md          # Este arquivo
```

---

## 📅 Entrega

Projeto referente ao **CP1 — entrega em 01/09**.

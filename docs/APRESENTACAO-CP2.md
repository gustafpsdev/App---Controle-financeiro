# CP2 — Roteiro de apresentação e organização ágil

## Roteiro sugerido (≈ 10 min)

| # | Tempo | O que mostrar | Critério do barema |
|---|---|---|---|
| 1 | 1 min | Problema e solução; o que mudou desde o CP1 (tabela "Evolução CP1 → CP2" do README) | Evolução |
| 2 | 2 min | **Dashboard**: trocar de viagem no seletor; indicadores, gráfico de categorias, evolução (alternar Acumulado/Por dia), alertas automáticos (tag *AUTOMÁTICO*) | Dashboard (2,0) |
| 3 | 2 min | **Frontend + API**: cadastrar despesa com categoria *Automática (IA)* → toast confirma a categoria; editar a despesa; tentar valor negativo → erro destacado no campo; abrir DevTools › Network para mostrar `POST /api/expenses` e a resposta JSON | Frontend/integração (2,0) |
| 4 | 1,5 min | **IA**: botão *Gerar análise* → resumo, pontos de atenção, recomendações; abrir *Dados enviados ao modelo* e explicar que não há dados pessoais; citar modelo, fallback e limitações | LLM (1,0) |
| 5 | 1 min | **Banco**: abrir `docs/MODELAGEM.md` (diagrama ER) e explicar categoria normalizada, `progress` removido, `UNIQUE` do orçamento, FKs e índices | Banco (1,0) |
| 6 | 1 min | **Otimizações**: tabela do README + mostrar `GET /api/expenses?category=Transporte&sort=-amount&limit=3` no Swagger com `meta` | Otimização (0,5) |
| 7 | 1 min | **Testes**: rodar `npm test` ao vivo (44 ✔) | Testes (1,0) |
| 8 | 0,5 min | **Swagger** em `/api/docs` + README; **Trello** atualizado | Docs (0,5) + Ágil (0,5) |

### Perguntas prováveis do professor (e respostas curtas)

- **Por que SQLite?** Relacional de verdade (FK, CHECK, índices, GROUP BY) e roda sem instalar servidor. Trocar por PostgreSQL só exige mudar `src/db/` e o SQL do repositório.
- **E se a LLM cair ou não houver chave?** Há *timeout* de 15 s e fallback por regras; a resposta indica `source: "regras"`. Os testes cobrem esse cenário.
- **Como evitam que a LLM invente categoria?** A resposta é validada contra as categorias do banco; se não existir, é descartada.
- **Prompt injection?** A descrição é limpa, truncada e enviada entre `<despesa>` como dado, com instrução explícita para não seguir comandos contidos nela.
- **Dados sensíveis?** A análise recebe apenas números agregados; nome/e-mail nunca saem do servidor. A chave da API fica no `.env`, fora do Git.
- **Por que alertas automáticos não são gravados no banco?** São dados derivados; recalculá-los garante que nunca fiquem desatualizados (mesmo motivo de remover `goals.progress`).

### Antes de apresentar

1. `npm install` e `npm run db:reset` para começar com os dados de exemplo.
2. Colocar `GEMINI_API_KEY` no `.env` para demonstrar a LLM real (chave gratuita em https://aistudio.google.com/apikey). Sem chave, a demo funciona com regras locais.
3. Deixar abertos: aplicação, `/api/docs`, terminal na pasta do projeto e o Trello.

## Cartões sugeridos para o Trello / Notion

**Concluído**
- [Banco] Migrar `db.json` para SQLite com FKs, CHECKs e índices
- [Banco] Normalizar categorias (tabela `categories`) e remover `goals.progress`
- [Backend] Camadas routes / services / repository / validation
- [Backend] Validação de tipos, datas, e-mail, enums e referências
- [Backend] Regras de negócio: datas da viagem, 1 orçamento por viagem, categoria em uso
- [Backend] Paginação, filtros, busca e ordenação no servidor
- [Backend] Alertas automáticos (80%, estouro, média diária, projeção, concentração)
- [Backend] Segurança: helmet, rate limit, limite de payload, tratamento central de erros
- [IA] Classificação automática de despesas (Gemini/Claude + fallback)
- [IA] Análise financeira da viagem com cache e sem dados pessoais
- [Frontend] Dashboard 100% com dados da API + seletor de viagem
- [Frontend] Gráfico de evolução (acumulado/diário) com linha de orçamento
- [Frontend] Edição de despesas, paginação, debounce na busca, feedback de erros por campo
- [Frontend] Escape de HTML (proteção XSS)
- [Docs] Swagger gerado a partir das validações (`/api/docs`)
- [Docs] README completo + MODELAGEM.md
- [Testes] 44 testes unitários e de integração (`npm test`)

**Próximos passos (CP3)**
- Autenticação (JWT) e múltiplos usuários
- Conversão de moedas para viagens internacionais
- Deploy (Render/Railway) e CI rodando `npm test` a cada push
- Testes de frontend (Playwright)

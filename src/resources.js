/**
 * Configuração declarativa dos recursos da API.
 * A partir dela são gerados: validação, SQL do repositório, filtros e ordenação.
 *
 * Tipos de campo: string | number | integer | date | email | enum | ref | category
 */
const TRIP_STATUS = ["Planejamento", "Em andamento", "Concluída"];
const ALERT_TYPES = ["info", "warning", "danger"];

const tripRef = { col: "trip_id", type: "ref", ref: "trips", required: true };

const resources = {
  users: {
    table: "users",
    label: "Usuário",
    fields: {
      name: { col: "name", type: "string", required: true, maxLength: 120 },
      email: { col: "email", type: "email", required: true, maxLength: 160, unique: true },
      avatar: { col: "avatar", type: "string", maxLength: 4 }
    },
    search: ["name", "email"],
    sortable: ["name", "createdAt"],
    defaultSort: "name"
  },

  trips: {
    table: "trips",
    label: "Viagem",
    fields: {
      userId: { col: "user_id", type: "ref", ref: "users", default: 1 },
      name: { col: "name", type: "string", required: true, maxLength: 120 },
      destination: { col: "destination", type: "string", maxLength: 120 },
      startDate: { col: "start_date", type: "date", required: true },
      endDate: { col: "end_date", type: "date", required: true },
      travelers: { col: "travelers", type: "integer", min: 1, max: 50, default: 1 },
      status: { col: "status", type: "enum", values: TRIP_STATUS, default: "Planejamento" }
    },
    filters: { status: "status", userId: "user_id" },
    search: ["name", "destination"],
    sortable: ["name", "startDate", "endDate", "createdAt"],
    defaultSort: "startDate",
    rules: [
      (row) => row.endDate < row.startDate && {
        field: "endDate",
        message: "A data de término deve ser igual ou posterior à data de início."
      }
    ]
  },

  budgets: {
    table: "budgets",
    label: "Orçamento",
    fields: {
      tripId: { ...tripRef, unique: true },
      totalBudget: { col: "total_budget", type: "number", required: true, min: 0 },
      dailyBudget: { col: "daily_budget", type: "number", min: 0 }
    },
    sortable: ["totalBudget", "createdAt"],
    defaultSort: "tripId",
    sortExtra: { tripId: "t.trip_id" }
  },

  categories: {
    table: "categories",
    label: "Categoria",
    timestamps: false,
    fields: {
      name: { col: "name", type: "string", required: true, maxLength: 40, unique: true },
      color: { col: "color", type: "string", maxLength: 9, pattern: /^#[0-9a-fA-F]{6}$/ }
    },
    search: ["name"],
    sortable: ["name"],
    defaultSort: "name"
  },

  expenses: {
    table: "expenses",
    label: "Despesa",
    fields: {
      tripId: tripRef,
      // Na API a categoria é enviada pelo nome; no banco vira category_id (FK)
      category: { col: "category_id", type: "category", required: true },
      description: { col: "description", type: "string", required: true, maxLength: 200 },
      amount: { col: "amount", type: "number", required: true, min: 0.01, max: 1_000_000 },
      date: { col: "date", type: "date", required: true }
    },
    // Colunas extras vindas do JOIN com categories
    extraSelect: "c.name AS category, c.id AS categoryId, c.color AS categoryColor",
    join: "JOIN categories c ON c.id = t.category_id",
    filters: { category: "c.name", categoryId: "t.category_id" },
    dateFilter: "t.date",
    amountFilter: "t.amount",
    search: ["description"],
    sortable: ["date", "amount", "description", "createdAt"],
    defaultSort: "-date"
  },

  itinerary: {
    table: "itinerary",
    label: "Atividade do roteiro",
    fields: {
      tripId: tripRef,
      date: { col: "date", type: "date", required: true },
      title: { col: "title", type: "string", required: true, maxLength: 160 },
      location: { col: "location", type: "string", maxLength: 160 },
      estimatedCost: { col: "estimated_cost", type: "number", min: 0, default: 0 }
    },
    dateFilter: "t.date",
    search: ["title", "location"],
    sortable: ["date", "estimatedCost", "title"],
    defaultSort: "date"
  },

  transports: {
    table: "transports",
    label: "Transporte",
    fields: {
      tripId: tripRef,
      type: { col: "type", type: "string", required: true, maxLength: 60 },
      description: { col: "description", type: "string", required: true, maxLength: 200 },
      amount: { col: "amount", type: "number", required: true, min: 0 }
    },
    search: ["type", "description"],
    sortable: ["amount", "type"],
    defaultSort: "type"
  },

  insurances: {
    table: "insurances",
    label: "Seguro",
    fields: {
      tripId: tripRef,
      provider: { col: "provider", type: "string", required: true, maxLength: 120 },
      coverage: { col: "coverage", type: "string", required: true, maxLength: 200 },
      amount: { col: "amount", type: "number", min: 0, default: 0 }
    },
    search: ["provider", "coverage"],
    sortable: ["amount", "provider"],
    defaultSort: "provider"
  },

  goals: {
    table: "goals",
    label: "Meta",
    fields: {
      userId: { col: "user_id", type: "ref", ref: "users", default: 1 },
      name: { col: "name", type: "string", required: true, maxLength: 120 },
      targetAmount: { col: "target_amount", type: "number", required: true, min: 0.01 },
      currentAmount: { col: "current_amount", type: "number", min: 0, default: 0 }
    },
    // progress é derivado (não é mais armazenado — normalização)
    extraSelect:
      "ROUND(CASE WHEN t.target_amount > 0 THEN t.current_amount * 100.0 / t.target_amount ELSE 0 END, 1) AS progress",
    search: ["name"],
    sortable: ["name", "targetAmount", "currentAmount"],
    defaultSort: "name"
  },

  alerts: {
    table: "alerts",
    label: "Alerta",
    fields: {
      tripId: tripRef,
      type: { col: "type", type: "enum", values: ALERT_TYPES, required: true },
      title: { col: "title", type: "string", required: true, maxLength: 160 },
      message: { col: "message", type: "string", required: true, maxLength: 300 }
    },
    filters: { type: "t.type" },
    search: ["title", "message"],
    sortable: ["createdAt", "type"],
    defaultSort: "-createdAt"
  }
};

module.exports = { resources, TRIP_STATUS, ALERT_TYPES };

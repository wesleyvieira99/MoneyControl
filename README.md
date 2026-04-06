# 💰 MoneyControl

Sistema completo de organização financeira e controle.

## Stack
- **Backend**: Spring Boot 3.2 + Java 17 + H2 Database
- **Frontend**: Angular 17 + glass-morphism design + ngx-echarts
- **IA**: OpenAI gpt-4o (chat sobre IR)
- **ML**: Regressão linear para previsões financeiras

## Como Executar

### Backend
```bash
cd backend
# Configure a chave OpenAI (opcional, para o chat de IR):
export OPENAI_API_KEY=sua_chave_aqui
mvn spring-boot:run
# Acesse: http://localhost:8080
# H2 Console: http://localhost:8080/h2-console
```

### Frontend
```bash
cd frontend
npm install
ng serve
# Acesse: http://localhost:4200
```

## Funcionalidades
- 📊 Dashboard com KPIs, gráficos e heatmap de gastos
- 💳 Gerenciamento de transações com filtros avançados
- 💳 Cartões de crédito com visualização de faturas
- 🏦 Contas bancárias com histórico
- 📈 Investimentos (ações, cripto, renda fixa, apostas)
- 🔴 Dívidas e parcelas com progresso
- ⚖️ Distribuição de lucros configurável
- 🤖 Previsões com Machine Learning (regressão linear)
- 🧑‍⚖️ Chat com IA para dúvidas sobre IR
- ⚙️ Configurações e categorias

## Segurança
⚠️ **Nunca commite sua chave OpenAI**. Use variável de ambiente `OPENAI_API_KEY`.

package com.moneycontrol.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.*;

@Service
public class InsightService {

    @Value("${openai.api.key}")
    private String openaiApiKey;

    @Value("${openai.model:gpt-4o}")
    private String model;

    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();

    public List<Map<String, String>> generateInsights(Map<String, Object> financialData) {
        try {
            String prompt = buildPrompt(financialData);
            String gptResponse = callOpenAI(prompt);
            return parseInsights(gptResponse);
        } catch (Exception e) {
            e.printStackTrace();
            return getDefaultInsights();
        }
    }

    @SuppressWarnings("unchecked")
    private String buildPrompt(Map<String, Object> data) {
        StringBuilder sb = new StringBuilder();
        sb.append("Voce e um consultor financeiro pessoal EXPERT e especialista em investimentos e planejamento financeiro brasileiro. ");
        sb.append("Analise TODOS os dados reais abaixo e gere insights PROFUNDOS, ESPECIFICOS e ACIONAVEIS — como um advisor de alto nivel.\n\n");
        sb.append("=== DADOS FINANCEIROS COMPLETOS ===\n");
        sb.append("- Saldo Contas: R$ ").append(data.getOrDefault("totalBalance", 0)).append("\n");
        sb.append("- Receita Mensal: R$ ").append(data.getOrDefault("monthlyIncome", 0)).append("\n");
        sb.append("- Despesas Mensais: R$ ").append(data.getOrDefault("monthlyExpense", 0)).append("\n");
        sb.append("- Patrimonio Liquido: R$ ").append(data.getOrDefault("netWorth", 0)).append("\n");
        sb.append("- Total Investido: R$ ").append(data.getOrDefault("totalInvested", 0)).append("\n");
        sb.append("- Total em Dividas: R$ ").append(data.getOrDefault("totalDebt", 0)).append("\n");
        sb.append("- Dividas Atrasadas: ").append(data.getOrDefault("overdueDebts", 0)).append("\n");
        sb.append("- Saldo Liquido do Mes: R$ ").append(data.getOrDefault("netMonth", 0)).append("\n");
        
        List<Map<String, Object>> topCategories = (List<Map<String, Object>>) data.get("topCategories");
        if (topCategories != null && !topCategories.isEmpty()) {
            sb.append("\nTOP CATEGORIAS DE GASTOS:\n");
            for (int i = 0; i < Math.min(5, topCategories.size()); i++) {
                Map<String, Object> cat = topCategories.get(i);
                sb.append("  ").append(i+1).append(". ").append(cat.get("name")).append(": R$ ").append(cat.get("total")).append("\n");
            }
        }

        Object investsObj = data.get("investments");
        if (investsObj instanceof List) {
            List<?> invests = (List<?>) investsObj;
            if (!invests.isEmpty()) {
                sb.append("\nINVESTIMENTOS (").append(invests.size()).append(" ativos):\n");
                invests.forEach(inv -> {
                    if (inv != null) sb.append("  - ").append(inv.toString(), 0, Math.min(120, inv.toString().length())).append("\n");
                });
            }
        }

        Object debtsObj = data.get("debts");
        if (debtsObj instanceof List) {
            List<?> debts = (List<?>) debtsObj;
            if (!debts.isEmpty()) {
                sb.append("\nDIVIDAS (").append(debts.size()).append("):\n");
                debts.forEach(d -> {
                    if (d != null) sb.append("  - ").append(d.toString(), 0, Math.min(120, d.toString().length())).append("\n");
                });
            }
        }

        Object goalsObj = data.get("goals");
        if (goalsObj instanceof List) {
            List<?> goals = (List<?>) goalsObj;
            if (!goals.isEmpty()) {
                sb.append("\nMETAS FINANCEIRAS (").append(goals.size()).append("):\n");
                goals.forEach(g -> {
                    if (g != null) sb.append("  - ").append(g.toString(), 0, Math.min(120, g.toString().length())).append("\n");
                });
            }
        }

        sb.append("\n=== INSTRUCOES ===\n");
        sb.append("Gere EXATAMENTE 8 insights PROFUNDOS no formato JSON puro:\n");
        sb.append("[\n  {\"icon\": \"emoji\", \"title\": \"titulo impactante (max 45 chars)\", \"desc\": \"dica ESPECIFICA e ACIONAVEL com numeros reais (max 140 chars)\", \"color\": \"green|blue|gold|red|purple\", \"detail\": \"analise aprofundada de 2-3 frases com estrategia concreta\"},\n  ...\n]\n\n");
        sb.append("REGRAS OBRIGATORIAS:\n");
        sb.append("- Cite valores REAIS dos dados acima\n");
        sb.append("- Insights sobre: saude financeira, dividas, investimentos, metas, IR, reserva emergencia, diversificacao\n");
        sb.append("- Seja como um COACH financeiro: direto, motivador, pratico\n");
        sb.append("- Use emojis relevantes: 💰📈📉🎯⚠️✅💡🔥🏆🛡️💎🚀\n");
        sb.append("- Cores: green=positivo/conquista, red=urgente/alerta, gold=oportunidade, blue=neutro/info, purple=estrategia\n");
        sb.append("- RETORNE APENAS JSON, SEM MARKDOWN, SEM EXPLICACOES\n");

        return sb.toString();
    }

    private String callOpenAI(String prompt) throws Exception {
        String url = "https://api.openai.com/v1/chat/completions";
        
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(openaiApiKey);

        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("model", model);
        requestBody.put("messages", List.of(
            Map.of("role", "system", "content", "Você é um analista financeiro especializado. Retorne APENAS JSON puro, sem markdown."),
            Map.of("role", "user", "content", prompt)
        ));
        requestBody.put("temperature", 0.8);
        requestBody.put("max_tokens", 2000);

        HttpEntity<Map<String, Object>> request = new HttpEntity<>(requestBody, headers);
        
        ResponseEntity<String> response = restTemplate.exchange(url, HttpMethod.POST, request, String.class);
        
        JsonNode root = objectMapper.readTree(response.getBody());
        String content = root.path("choices").get(0).path("message").path("content").asText();
        
        // Remove markdown se houver
        content = content.replaceAll("```json\\s*", "").replaceAll("```\\s*", "").trim();
        
        return content;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, String>> parseInsights(String jsonResponse) {
        try {
            Object parsed = objectMapper.readValue(jsonResponse, Object.class);
            
            if (parsed instanceof List) {
                return (List<Map<String, String>>) parsed;
            } else if (parsed instanceof Map) {
                // Se retornou um objeto, tenta extrair array
                Map<String, Object> map = (Map<String, Object>) parsed;
                if (map.containsKey("insights")) {
                    return (List<Map<String, String>>) map.get("insights");
                }
            }
            
            return getDefaultInsights();
        } catch (Exception e) {
            e.printStackTrace();
            return getDefaultInsights();
        }
    }

    private List<Map<String, String>> getDefaultInsights() {
        List<Map<String, String>> insights = new ArrayList<>();
        
        insights.add(Map.of(
            "icon", "💰",
            "title", "Análise Financeira Disponível",
            "desc", "Configure seus dados para receber insights personalizados do GPT",
            "color", "blue"
        ));
        
        insights.add(Map.of(
            "icon", "📊",
            "title", "Insights Inteligentes",
            "desc", "Atualize a página para gerar análises com IA baseadas nos seus dados",
            "color", "purple"
        ));
        
        insights.add(Map.of(
            "icon", "🎯",
            "title", "Recomendações Personalizadas",
            "desc", "Em breve você verá sugestões específicas para otimizar suas finanças",
            "color", "gold"
        ));

        return insights;
    }
}

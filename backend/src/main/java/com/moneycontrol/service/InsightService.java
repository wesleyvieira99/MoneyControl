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

    private String buildPrompt(Map<String, Object> data) {
        StringBuilder sb = new StringBuilder();
        sb.append("Você é um analista financeiro expert. Analise os dados abaixo e gere insights PRÁTICOS e ACIONÁVEIS:\n\n");
        sb.append("DADOS FINANCEIROS:\n");
        sb.append("- Saldo Total: R$ ").append(data.getOrDefault("totalBalance", 0)).append("\n");
        sb.append("- Receita Mensal: R$ ").append(data.getOrDefault("monthlyIncome", 0)).append("\n");
        sb.append("- Despesas Mensais: R$ ").append(data.getOrDefault("monthlyExpense", 0)).append("\n");
        sb.append("- Patrimônio Líquido: R$ ").append(data.getOrDefault("netWorth", 0)).append("\n");
        sb.append("- Total Investido: R$ ").append(data.getOrDefault("totalInvested", 0)).append("\n");
        sb.append("- Saldo do Mês: R$ ").append(data.getOrDefault("netMonth", 0)).append("\n");
        
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> topCategories = (List<Map<String, Object>>) data.get("topCategories");
        if (topCategories != null && !topCategories.isEmpty()) {
            sb.append("\nTOP 3 CATEGORIAS DE GASTOS:\n");
            for (int i = 0; i < Math.min(3, topCategories.size()); i++) {
                Map<String, Object> cat = topCategories.get(i);
                sb.append((i+1)).append(". ").append(cat.get("name")).append(": R$ ").append(cat.get("total")).append("\n");
            }
        }

        sb.append("\nGERE EXATAMENTE 5 INSIGHTS no formato JSON:\n");
        sb.append("[\n");
        sb.append("  {\"icon\": \"emoji\", \"title\": \"título curto\", \"desc\": \"descrição prática\", \"color\": \"green|blue|gold|red|purple\"},\n");
        sb.append("  ...\n");
        sb.append("]\n\n");
        sb.append("REGRAS:\n");
        sb.append("- Seja ESPECÍFICO com números dos dados fornecidos\n");
        sb.append("- Use emojis relevantes (💰, 📈, 📉, 🎯, ⚠️, ✅, 💡, 🔥, etc)\n");
        sb.append("- Título: máx 40 caracteres, impactante\n");
        sb.append("- Descrição: máx 100 caracteres, acionável\n");
        sb.append("- Cores: green=positivo, red=alerta, blue=neutro, gold=oportunidade, purple=estratégia\n");
        sb.append("- RETORNE APENAS O JSON, SEM MARKDOWN\n");

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
        requestBody.put("max_tokens", 1000);

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

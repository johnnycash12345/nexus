// services/newsService.ts
/**
 * Módulo de percepção externa do Nexus.
 * Responsável por buscar, filtrar e classificar informações do mundo real (notícias).
 */

import { NewsArticle } from '../types';

// FIX: Renamed internal type to avoid conflict and updated properties to match global type.
export interface NewsApiArticle extends NewsArticle {
  relevance: number;
  sentiment?: "positive" | "negative" | "neutral";
}

/** 
 * Função principal para buscar notícias em tempo real 
 */
// FIX: Refactored fetchNews to accept apiKey and an optional query, removing the need for fetchNewsByTopic and fixing import.meta.env errors.
export async function fetchNews(apiKey: string, query?: string): Promise<NewsApiArticle[]> {
  if (!apiKey) {
    console.warn("NewsAPI key is missing, skipping news fetch.");
    return [];
  }
  
  const baseUrl = `https://newsapi.org/v2/`;
  const params = new URLSearchParams({ apiKey, language: 'pt' });

  let endpoint: string;
  if (query) {
    endpoint = `everything?q=${encodeURIComponent(query)}&sortBy=relevance`;
  } else {
    endpoint = `top-headlines?country=br`;
  }
  
  const url = `${baseUrl}${endpoint}&${params.toString()}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (!data.articles) return [];

    // Normaliza e enriquece os artigos
    const enriched = data.articles
      .filter((a: any) => a.title && a.description)
      .map((article: any): NewsApiArticle => ({
        title: article.title,
        description: article.description,
        url: article.url,
        // FIX: Correctly map source.name to sourceName to match the global NewsArticle type.
        sourceName: article.source?.name || "Desconhecida",
        relevance: estimateRelevance(article.title, article.description),
        sentiment: analyzeSentiment(article.title + " " + article.description),
      }))
      .sort((a: NewsApiArticle, b: NewsApiArticle) => b.relevance - a.relevance);

    console.log(`[NewsService] ${enriched.length} artigos processados.`);
    return enriched;
  } catch (error) {
    console.error("⚠️ Erro ao buscar notícias:", error);
    return [];
  }
}

/**
 * Estima a relevância de um artigo com base em palavras-chave e tamanho do texto.
 */
function estimateRelevance(title: string, description: string): number {
  const text = `${title} ${description}`.toLowerCase();
  let score = 0;

  // Palavras-chave que aumentam relevância
  const importantTopics = [
    "tecnologia",
    "inteligência artificial",
    "ciência",
    "energia",
    "inovação",
    "mudança climática",
    "economia",
    "segurança",
  ];

  for (const word of importantTopics) {
    if (text.includes(word)) score += 2;
  }

  // Penaliza descrições muito curtas
  if (description.length < 60) score -= 1;

  return Math.max(1, score);
}

/**
 * Análise de sentimento simplificada.
 * Ajuda o Nexus a entender o "tom emocional" das notícias.
 */
function analyzeSentiment(text: string): "positive" | "negative" | "neutral" {
  const lower = text.toLowerCase();
  const positiveWords = ["avanço", "crescimento", "sucesso", "descoberta", "melhoria"];
  const negativeWords = ["crise", "queda", "morte", "ameaça", "ataque", "colapso"];

  let score = 0;
  for (const w of positiveWords) if (lower.includes(w)) score++;
  for (const w of negativeWords) if (lower.includes(w)) score--;

  if (score > 1) return "positive";
  if (score < -1) return "negative";
  return "neutral";
}

import { NewsArticle } from '../types';

const API_URL = 'https://newsapi.org/v2/top-headlines';

export const fetchNews = async (apiKey: string, query: string): Promise<NewsArticle[] | null> => {
    try {
        const params = new URLSearchParams({
            q: query,
            apiKey: apiKey,
            language: 'pt',
            pageSize: '3' // Limit to 3 articles for a concise summary
        });
        const response = await fetch(`${API_URL}?${params}`);

        if (!response.ok) {
            const errorData = await response.json();
            console.error('NewsAPI Error:', errorData);
            return null;
        }

        const data = await response.json();
        if (data.articles && data.articles.length > 0) {
            return data.articles.map((article: any) => ({
                title: article.title,
                description: article.description,
                url: article.url,
                sourceName: article.source.name,
            }));
        }
        return [];
    } catch (error) {
        console.error('Failed to fetch from NewsAPI:', error);
        return null;
    }
};

import { db } from './indexedDBService';
import { analyzeAndStoreConcepts } from './conceptEngine';

interface TestResult {
    success: boolean;
    message: string;
    details: {
        initialConceptCount: number;
        finalConceptCount: number;
        learnedConcepts: string[];
    };
}

class CognitiveTestService {
    public async runTest(userId: string): Promise<TestResult> {
        // A specific, niche topic unlikely to be in memory.
        const testTopic = "fotossíntese anoxigênica";
        const simulatedResponse = `A fotossíntese anoxigênica é um processo metabólico em que a luz é usada para criar energia, mas sem produzir oxigênio. Diferente da fotossíntese oxigênica, ela usa substâncias como sulfeto de hidrogênio em vez de água como doador de elétrons. Isso é comum em certas bactérias, como as bactérias púrpuras sulfurosas e não sulfurosas.`;
        const expectedConcepts = ["fotossíntese anoxigênica", "bactérias púrpuras", "sulfeto de hidrogênio"];

        try {
            // 1. Get initial state
            const initialConcepts = await db.getAllConcepts(userId);

            // 2. Simulate learning from a text block
            await analyzeAndStoreConcepts(userId, simulatedResponse, "Simulação de Teste Cognitivo");

            // 3. Get final state and verify
            const finalConcepts = await db.getAllConcepts(userId);
            const learnedConceptObjects = await db.getConceptsByNames(userId, expectedConcepts);

            const successfullyLearned = learnedConceptObjects
                .filter((c): c is NonNullable<typeof c> => c !== undefined)
                .map(c => c.name);

            const success = successfullyLearned.length > 0 && finalConcepts.length > initialConcepts.length;

            return {
                success,
                message: success
                    ? `Teste bem-sucedido. ${successfullyLearned.length} conceito(s) chave assimilado(s) a partir do cenário.`
                    : "Falha no teste. Nexus não demonstrou aprendizado de novos conceitos durante o teste.",
                details: {
                    initialConceptCount: initialConcepts.length,
                    finalConceptCount: finalConcepts.length,
                    learnedConcepts: successfullyLearned,
                },
            };
        } catch (error: any) {
            console.error("Cognitive Test Failed:", error);
            return {
                success: false,
                message: `Ocorreu um erro durante o teste: ${error.message}`,
                details: { initialConceptCount: 0, finalConceptCount: 0, learnedConcepts: [] },
            };
        }
    }
}

export const cognitiveTestService = new CognitiveTestService();
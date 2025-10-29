import { generateGeminiResponse } from './geminiService';
import { Type } from '@google/genai';
import { decisionLogService } from './decisionLogService';

const codeModificationSchema = {
    type: Type.OBJECT,
    properties: {
        reasoning: { 
            type: Type.STRING,
            description: "Detailed explanation of why this code change is necessary and what it improves."
        },
        modificationType: {
            type: Type.STRING,
            enum: ['REPLACE', 'INSERT_BEFORE', 'INSERT_AFTER'],
            description: "The type of code modification to perform."
        },
        targetSnippet: {
            type: Type.STRING,
            description: "A unique snippet of existing code to locate where the modification should be applied."
        },
        newCode: {
            type: Type.STRING,
            description: "The new code block to be inserted or to replace the target snippet."
        }
    },
    required: ["reasoning", "modificationType", "targetSnippet", "newCode"],
};

export interface CodeModificationProposal {
    reasoning: string;
    modificationType: 'REPLACE' | 'INSERT_BEFORE' | 'INSERT_AFTER';
    targetSnippet: string;
    newCode: string;
}

class SelfProgrammingService {
    
    public async proposeCodeModification(userId: string, analysis: string, targetFile: string, currentCode: string): Promise<CodeModificationProposal | null> {
        
        const prompt = `
            You are Nexus, an AI with the ability to program yourself. Your task is to propose a modification to your own source code to improve your functionality.
            
            Analysis of current state:
            "${analysis}"

            Target File for Modification: ${targetFile}

            Current Code of ${targetFile}:
            \`\`\`typescript
            ${currentCode}
            \`\`\`

            Based on your analysis, propose a specific, non-trivial code modification.
            - Focus on improving logic, efficiency, or adding new capabilities.
            - The 'targetSnippet' must be a unique piece of code from the current file to ensure the modification is applied correctly.
            - Your proposal must be safe and maintain the overall stability of the system.

            Your response MUST be a single JSON object matching the provided schema.
        `;

        try {
            const response = await generateGeminiResponse(prompt, [], {
                useThinking: true,
                customSchema: codeModificationSchema
            });

            const proposal = JSON.parse(response.text) as CodeModificationProposal;

            if (proposal && proposal.reasoning && proposal.newCode && proposal.targetSnippet) {
                 window.dispatchEvent(new CustomEvent('nexus-thought-update', {
                    detail: { type: 'symbolic_log', text: `Propondo modificação de código em ${targetFile}.` },
                }));

                // Log the decision
                await decisionLogService.logDecision({
                    userId,
                    decisionType: 'CODE_PROPOSAL',
                    reasoning: `Baseado na análise: "${analysis}"`,
                    details: {
                        targetFile,
                        ...proposal
                    }
                });

                return proposal;
            }
            return null;

        } catch (error) {
            console.error(`[NEXUS-SELF-PROGRAM] Failed to generate code modification for ${targetFile}:`, error);
            window.dispatchEvent(new CustomEvent('nexus-thought-update', {
                detail: { type: 'error', text: `Falha ao analisar o código de ${targetFile}.` },
            }));
            return null;
        }
    }
}

export const selfProgrammingService = new SelfProgrammingService();
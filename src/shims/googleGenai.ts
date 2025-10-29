export const Type = {
  OBJECT: 'object',
  ARRAY: 'array',
  STRING: 'string',
  NUMBER: 'number',
  BOOLEAN: 'boolean',
} as const;
export type Type = typeof Type;
export type LiveServerMessage = unknown;
export type FunctionDeclaration = unknown;
export const Modality = {
  AUDIO: 'audio',
  TEXT: 'text',
} as const;
export type Modality = typeof Modality;
export type Blob = unknown;

export interface GoogleGenAIOptions {
  apiKey?: string;
}

export class GoogleGenAI {
  constructor(_options: GoogleGenAIOptions) {}

  responses = {
    async *stream(_model: string, _options: unknown): AsyncIterable<unknown> {
      // No-op stream placeholder for build-time safety.
    },
  };

  live = {
    connect: async (_options: unknown) => ({
      sendRealtimeInput: (_payload: unknown) => {},
      sendToolResponse: (_payload: unknown) => {},
      close: () => {},
    }),
  };

  files = {
    async upload(_options: unknown): Promise<unknown> {
      return {};
    },
  };

  models = {
    async generateContent(_options: unknown): Promise<any> {
      return {};
    },
  };
}

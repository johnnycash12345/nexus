// --- Simulação do conteúdo do arquivo audio-processor.js ---

// Define o processador que irá buscar e enviar dados do buffer de áudio
class PCMRecorderProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [];
  }

  constructor() {
    super();
    // buffer para acumular dados de áudio antes de enviar
    this.bufferSize = 4096;
    this.buffer = new Float32Array(this.bufferSize);
    this.offset = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0]; // Assume 1 canal de entrada
    if (!input || input.length === 0) return true;

    const inputData = input[0]; // Dados do primeiro canal

    for (let i = 0; i < inputData.length; i++) {
      this.buffer[this.offset++] = inputData[i];

      if (this.offset >= this.bufferSize) {
        // Envia o bloco completo para o thread principal
        this.port.postMessage(this.buffer);
        // Reseta o buffer e o offset
        this.buffer = new Float32Array(this.bufferSize);
        this.offset = 0;
      }
    }
    return true; // Continua processando
  }
}

registerProcessor('pcm-recorder-processor', PCMRecorderProcessor);
// Fim da simulação do arquivo audio-processor.js
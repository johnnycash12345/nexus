// services/memoryService.ts

// Salva uma lembrança (qualquer dado)
export function saveMemory(key: string, value: any) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error("⚠️ Erro ao salvar memória:", error);
  }
}

// Lê uma lembrança armazenada
export function loadMemory(key: string) {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error("⚠️ Erro ao carregar memória:", error);
    return null;
  }
}

// Apaga uma lembrança específica
export function deleteMemory(key: string) {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error("⚠️ Erro ao apagar memória:", error);
  }
}

// Apaga todas as lembranças
export function clearAllMemory() {
  try {
    localStorage.clear();
  } catch (error) {
    console.error("⚠️ Erro ao limpar todas as memórias:", error);
  }
}

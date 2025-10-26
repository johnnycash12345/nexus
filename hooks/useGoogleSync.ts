// hooks/useGoogleSync.ts
import { useEffect, useState, useCallback } from "react";
import { googleAuth } from "../services/googleAuth";
import { driveSyncService } from "../services/driveSyncService";

export function useGoogleSync() {
  const [token, setToken] = useState<string | null>(() => googleAuth.getToken());
  const [status, setStatus] = useState("Verificando autenticação...");

  const syncBrain = useCallback(async (tk: string) => {
    try {
      setStatus('Sincronizando com Google Drive...');
      const restored = await driveSyncService.restoreBrain(tk);
      if (restored) {
        setStatus("🧠 Memória restaurada com sucesso!");
      } else {
        setStatus('Nenhum backup encontrado. Salvando memória atual...');
        await driveSyncService.uploadBrain(tk);
        setStatus("💾 Cérebro salvo no Drive com sucesso!");
      }
    } catch (err: any) {
      console.error(err);
      setStatus("Erro na sincronização com o Drive.");
      if (err.status === 401) { // Handle expired token
          googleAuth.logout();
          setToken(null);
          setStatus("Sessão expirada. Por favor, faça login novamente.");
      }
    }
  }, []);

  useEffect(() => {
    // This runs once on mount to handle the redirect from Google
    const tkFromRedirect = googleAuth.handleRedirect();
    if (tkFromRedirect) {
      setToken(tkFromRedirect);
      syncBrain(tkFromRedirect);
    } else if (token) {
      // If token was already in localStorage, sync on startup
      syncBrain(token);
    } else {
      setStatus("Faça login para sincronizar sua memória com o Google Drive.");
    }
  }, [syncBrain]);


  const login = () => {
      googleAuth.login();
  };

  const logout = () => {
    googleAuth.logout();
    setToken(null);
    setStatus("Você foi desconectado. Faça login para sincronizar.");
  };

  return { token, status, login, logout };
}

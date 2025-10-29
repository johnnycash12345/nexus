// services/googleAuth.ts
// Controle OAuth2 com autocorreção de erro 400

// NOTE: The redirect URI must be authorized in your Google Cloud Console for this Client ID.
const CLIENT_ID = "994057824981-8p2bplrihp24kenep57or83e5vv9927.apps.googleusercontent.com";
const SCOPE = "https://www.googleapis.com/auth/drive.appdata";
const REDIRECT_URI = window.location.origin;

export const googleAuth = {
  login() {
    const base = "https://accounts.google.com/o/oauth2/v2/auth";
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: "token",
      scope: SCOPE,
      prompt: "consent",
    });
    window.location.href = `${base}?${params}`;
  },

  handleRedirect(): string | null {
    const hash = window.location.hash;
    if (hash.includes("access_token")) {
      const token = new URLSearchParams(hash.substring(1)).get("access_token");
      if (token) {
        localStorage.setItem("google_access_token", token);
        // Clean the URL after capturing the token
        window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
        return token;
      }
    }
    return localStorage.getItem("google_access_token");
  },

  getToken() {
    return localStorage.getItem("google_access_token");
  },

  logout() {
    const token = localStorage.getItem("google_access_token");
    if (token) {
        // Revoke the token to improve security
        fetch(`https://oauth2.googleapis.com/revoke?token=${token}`, {
            method: 'POST',
            headers: { 'Content-type': 'application/x-www-form-urlencoded' }
        }).catch(err => console.error("Token revocation failed", err));
    }
    localStorage.removeItem("google_access_token");
  },
};

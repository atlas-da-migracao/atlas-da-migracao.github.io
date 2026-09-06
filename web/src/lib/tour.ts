/** F6 leva 2: extraído de components/Tour.tsx para que App.tsx possa checar
 *  "o tour já foi visto?" sem puxar o componente inteiro (e sua árvore) para o chunk
 *  inicial -- um import estático de Tour.tsx anularia o React.lazy(). */
const CHAVE_VISTO = "tour_visto";

export function tourJaVisto(): boolean {
  try { return localStorage.getItem(CHAVE_VISTO) === "1"; } catch { return true; }
}

export function marcarTourVisto() {
  try { localStorage.setItem(CHAVE_VISTO, "1"); } catch { /* localStorage indisponível: tudo bem */ }
}

/** Seletor de região metropolitana: agrupado por tipo (RM, RIDE), ordenado por população. */
import type { ResumoRM } from "../db/queries";

export function SeletorRM({ rms, ativa, aoEscolher }: {
  rms: ResumoRM[]; ativa: string | null; aoEscolher: (cd_rm: string) => void;
}) {
  const tipos = [...new Set(rms.map((r) => r.tipo))];
  return (
    <select className="seletor-rm" value={ativa ?? ""} aria-label="Escolher região metropolitana"
            onChange={(e) => { if (e.target.value) aoEscolher(e.target.value); }}>
      <option value="" disabled>Escolha uma RM…</option>
      {tipos.map((tipo) => (
        <optgroup key={tipo} label={tipo === "RIDE" ? "RIDEs" : "Regiões metropolitanas"}>
          {rms.filter((r) => r.tipo === tipo).sort((a, b) => b.pop - a.pop).map((r) => (
            <option key={r.cd_rm} value={r.cd_rm}>
              {r.nm_rm} ({r.nm_nucleo}{r.nucleo_uf ? `/${r.nucleo_uf}` : ""} · {r.n_municipios} mun.)
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

/** Seletor de região metropolitana: agrupado por tipo (RM, RIDE), ordenado por população. */
import type { ResumoRM } from "../db/queries";
import { useT } from "../i18n";

export function SeletorRM({ rms, ativa, aoEscolher }: {
  rms: ResumoRM[]; ativa: string | null; aoEscolher: (cd_rm: string) => void;
}) {
  const d = useT();
  const tipos = [...new Set(rms.map((r) => r.tipo))];
  // F9.7-b: `ativa` pode vir de uma RM que não existe nesta edição (ex.: ?rm=901, RM de Palmas,
  // que só existe a partir de 2010 -- ver PainelRM.tsx). Sem esta checagem, o <select> nativo,
  // ao não achar nenhuma <option> com esse value, cai no algoritmo de reset do HTML (nenhuma
  // opção com `selected` -> seleciona a primeira habilitada), mostrando uma RM errada em vez de
  // indicar que nada está selecionado -- por isso só passamos `ativa` adiante quando ela
  // corresponde a uma das RMs de fato carregadas.
  const valor = ativa && rms.some((r) => r.cd_rm === ativa) ? ativa : "";
  return (
    <select className="seletor-rm" value={valor} aria-label={d.controles.seletorRM.aria}
            onChange={(e) => { if (e.target.value) aoEscolher(e.target.value); }}>
      <option value="" disabled>{d.controles.seletorRM.escolha}</option>
      {tipos.map((tipo) => (
        <optgroup key={tipo} label={tipo === "RIDE" ? d.controles.seletorRM.grupoRIDE : d.controles.seletorRM.grupoRM}>
          {rms.filter((r) => r.tipo === tipo).sort((a, b) => b.pop - a.pop).map((r) => (
            <option key={r.cd_rm} value={r.cd_rm}>
              {r.nm_rm} ({r.nm_nucleo}{r.nucleo_uf ? `/${r.nucleo_uf}` : ""} · {d.controles.seletorRM.municipios(r.n_municipios)})
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

/** Selo/aviso "proxy de data fixa": mostrado na capa e nos painéis de município/unidade e de
 *  fluxo sempre que a edição ativa não mede migração por um quesito de data fixa direto, e sim
 *  por um proxy calibrado (hoje só o Censo 1980 -- `Edicao.proxyDataFixa`, ver lib/edicoes.ts).
 *  Componente único e genérico: não depende do nome da edição, só do campo `proxyDataFixa`.
 *  O texto vem de `meta.aviso_proxy`/`meta.aviso_proxy_resumo` (pipeline/build_meta.py) --
 *  nunca hardcoded aqui, para que a calibração e a ressalva metodológica tenham uma única fonte
 *  (ver docs/METODOLOGIA.md, "Edição Censo 1980 e comparabilidade").
 *
 *  Duas camadas (achado do auditor em F9.7-b: o texto completo, ~106 palavras, tomava ~40% da
 *  altura visível do painel na capa): o resumo de uma linha fica sempre visível; o texto
 *  completo -- com a ressalva de calibração, que é a parte que não pode ser cortada -- abre sob
 *  demanda em <details>, mesmo padrão de disclosure já usado em PainelRM.tsx
 *  (.comparativo-toggle). Antes do `meta.json` chegar, mostra um aviso genérico em vez de
 *  reproduzir o texto substantivo por conta própria. */
import { edicao } from "../lib/edicoes";
import { useT } from "../i18n";
import type { Meta } from "../lib/types";
import { useStore } from "../state/store";
import { textoDado } from "../i18n/dados";

export function AvisoProxy({ meta }: { meta: Meta | null }) {
  const d = useT();
  const ed = edicao(useStore((s) => s.censo));
  if (!ed.proxyDataFixa) return null;
  const resumo = textoDado(`aviso_proxy_resumo.${meta?.edicao}`, meta?.aviso_proxy_resumo) ?? d.avisos.proxy.resumoPadrao;
  const completo = textoDado(`aviso_proxy.${meta?.edicao}`, meta?.aviso_proxy);
  return (
    <div className="aviso aviso-proxy" role="note">
      <p className="aviso-proxy-resumo">
        <strong>{d.avisos.proxy.selo}</strong> {resumo}
      </p>
      {completo && (
        <details className="aviso-proxy-detalhe">
          <summary>{d.avisos.proxy.saibaMais}</summary>
          <p>{completo}</p>
        </details>
      )}
    </div>
  );
}

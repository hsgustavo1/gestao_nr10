import { ATVOS_LOGO_BASE64 } from "@/assets/atvosLogo";

export type EtiquetaCor = "azul" | "amarelo" | "vermelho" | "latao";

export interface EtiquetaLOTOProps {
  cadeado: {
    numero: number;
    cor: EtiquetaCor;
    setor: string;
    donoAtual?: {
      nome?: string;
      matricula?: string;
      telefone?: string;
      funcao?: string;
      setor?: string;
    };
  };
  fotoSrc?: string | null;
  scale: number;
}

const px = (n: number, scale: number) => `${Math.round(n * scale)}px`;

const COR_LABEL: Record<EtiquetaCor, string> = {
  azul: "Azul",
  amarelo: "Amarelo",
  vermelho: "Vermelho",
  latao: "Latão",
};

function formatTelefone(tel?: string): string {
  if (!tel) return "—";
  const d = tel.replace(/\D/g, "");
  if (d.length === 0) return "—";
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return tel;
}

function ouTraco(v?: string): string {
  return v && v.trim() ? v : "—";
}

export function EtiquetaLOTO({ cadeado, fotoSrc, scale }: EtiquetaLOTOProps) {
  const dono = cadeado.donoAtual ?? {};
  const corLabel = COR_LABEL[cadeado.cor];
  const setorExibido = ouTraco(dono.setor || cadeado.setor);
  const telefoneFormatado = formatTelefone(dono.telefone);

  const halfStyle: React.CSSProperties = {
    width: px(227, scale),
    height: px(265, scale),
    border: "1.5px solid #333",
    fontFamily: "Arial, sans-serif",
    background: "#fff",
    display: "flex",
    flexDirection: "column",
    flexShrink: 0,
    overflow: "hidden",
    boxSizing: "border-box",
  };

  const headerStyle: React.CSSProperties = {
    borderBottom: "1.5px solid #333",
    padding: `${px(3, scale)} ${px(6, scale)} ${px(3, scale)}`,
    textAlign: "center",
    flexShrink: 0,
  };

  const circuloStyle: React.CSSProperties = {
    width: px(18, scale),
    height: px(18, scale),
    border: "1.5px solid #333",
    borderRadius: "50%",
    margin: `0 auto ${px(2, scale)}`,
  };

  const tituloHeaderStyle: React.CSSProperties = {
    fontSize: px(7, scale),
    fontWeight: 700,
    letterSpacing: "0.04em",
    marginTop: px(2, scale),
  };

  return (
    <div style={{ display: "flex", gap: 0 }}>
      {/* ============== FRENTE ============== */}
      <div style={halfStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <div style={circuloStyle} />
          <div style={tituloHeaderStyle}>IDENTIFICAÇÃO DE ISOLAMENTO</div>
        </div>

        {/* Faixa logo */}
        <div
          style={{
            borderBottom: "1.5px solid #333",
            padding: `${px(5, scale)} ${px(8, scale)}`,
            textAlign: "center",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <img
            src={ATVOS_LOGO_BASE64}
            alt="Atvos"
            style={{
              height: px(26, scale),
              maxWidth: px(110, scale),
              objectFit: "contain",
              display: "block",
            }}
          />
        </div>

        {/* Área principal */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          {/* Foto */}
          <div
            style={{
              width: px(75, scale),
              borderRight: "1.5px solid #333",
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            {fotoSrc ? (
              <img
                src={fotoSrc}
                alt="Foto"
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  background: "#ddd",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: px(9, scale),
                  color: "#999",
                  fontWeight: 700,
                }}
              >
                FOTO
              </div>
            )}
          </div>

          {/* Dados */}
          <div
            style={{
              flex: 1,
              padding: `${px(6, scale)} ${px(7, scale)}`,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: px(5, scale),
              overflow: "hidden",
            }}
          >
            <div
              style={{
                fontSize: px(9, scale),
                fontWeight: 700,
                textTransform: "uppercase",
                lineHeight: 1.2,
              }}
            >
              {ouTraco(dono.nome)}
            </div>
            <div style={{ fontSize: px(7.5, scale), fontWeight: 600, color: "#222" }}>
              {ouTraco(dono.funcao)}
            </div>
            <div style={{ fontSize: px(7.5, scale), color: "#222" }}>
              Matrícula: {ouTraco(dono.matricula)}
            </div>
            <div style={{ fontSize: px(7.5, scale), color: "#222" }}>
              Setor: {setorExibido}
            </div>
            <div style={{ fontSize: px(7.5, scale), color: "#222" }}>
              Tel: {telefoneFormatado}
            </div>
          </div>
        </div>

        {/* Rodapé */}
        <div
          style={{
            borderTop: "1.5px solid #333",
            padding: `${px(5, scale)} ${px(6, scale)}`,
            textAlign: "center",
            background: "#f0f0f0",
            flexShrink: 0,
            fontSize: px(9, scale),
            fontWeight: 700,
          }}
        >
          Cadeado Nº {cadeado.numero} / {corLabel}
        </div>
      </div>

      {/* ============== VERSO ============== */}
      <div style={{ ...halfStyle, borderLeft: "none" }}>
        {/* Header */}
        <div style={headerStyle}>
          <div style={circuloStyle} />
          <div style={tituloHeaderStyle}>PROCEDIMENTO DE BLOQUEIO</div>
        </div>

        {/* Corpo */}
        <div
          style={{
            flex: 1,
            padding: `${px(8, scale)} ${px(10, scale)}`,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: px(10, scale),
          }}
        >
          {[
            "CONFIRA AS ENERGIAS A SEREM ISOLADAS ATRAVÉS DA MATRIZ DE ISOLAMENTO.",
            "CERTIFIQUE-SE QUE O EQUIPAMENTO ESTÁ ISOLADO NO COFRE DE SEGURANÇA.",
            "NÃO É PERMITIDA A RETIRADA DO CADEADO DE ISOLAMENTO DE OUTRO COLABORADOR.",
          ].map((txt, i) => (
            <p
              key={i}
              style={{
                fontSize: px(8, scale),
                fontWeight: 700,
                lineHeight: 1.5,
                textAlign: "center",
                margin: 0,
              }}
            >
              {txt}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
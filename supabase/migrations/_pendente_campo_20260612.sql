-- ============================================================================
-- COLETA EM CAMPO (RTI) — o engenheiro consultor realiza a inspeção em campo
-- (fotos + modos de falha pré-mapeados), e o sistema compõe o RTI a partir
-- da coleta (relatório, áreas, NCs e evidências de constatação).
--
-- A base de modos de falha foi minerada das 731 NCs reais do RTI atual
-- (temas mais frequentes: documentação/PIE, aterramento, LOTO, iluminação,
-- sinalização/identificação, SPDA, salas elétricas, proteção) + referências
-- NBR 5410 / NBR 14039 / NBR 5419 / NR-10.
-- ============================================================================

-- ════════════════════════════════════════════════════════════════════════════
-- 1) BASE DE MODOS DE FALHA (editável no app, suporte do engenheiro)
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.rti_modos_falha (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo                 text NOT NULL UNIQUE,    -- slug estável (ex.: sala-sinalizacao)
  label                  text NOT NULL,           -- o que o engenheiro vê na lista
  categoria              text NOT NULL,           -- agrupamento da lista
  descricao_padrao       text NOT NULL,           -- texto-modelo da NC (editável na coleta)
  recomendacao_padrao    text,                    -- texto-modelo da recomendação
  prioridade_sugerida    smallint NOT NULL DEFAULT 3 CHECK (prioridade_sugerida BETWEEN 1 AND 4),
  tipo_execucao_sugerido text NOT NULL DEFAULT 'os' CHECK (tipo_execucao_sugerido IN ('os','investimento')),
  normas                 jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{norma, item}]
  ativo                  boolean NOT NULL DEFAULT true,
  ordem                  integer NOT NULL DEFAULT 0,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.rti_modos_falha ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_modos_falha_categoria ON public.rti_modos_falha(categoria);

DROP TRIGGER IF EXISTS modos_falha_touch ON public.rti_modos_falha;
CREATE TRIGGER modos_falha_touch
  BEFORE UPDATE ON public.rti_modos_falha
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP POLICY IF EXISTS "modos_read_all"     ON public.rti_modos_falha;
DROP POLICY IF EXISTS "modos_staff_insert" ON public.rti_modos_falha;
DROP POLICY IF EXISTS "modos_staff_update" ON public.rti_modos_falha;
DROP POLICY IF EXISTS "modos_admin_delete" ON public.rti_modos_falha;
CREATE POLICY "modos_read_all"     ON public.rti_modos_falha FOR SELECT USING (true);
CREATE POLICY "modos_staff_insert" ON public.rti_modos_falha FOR INSERT WITH CHECK (public.is_staff(auth.uid()));
CREATE POLICY "modos_staff_update" ON public.rti_modos_falha FOR UPDATE USING (public.is_staff(auth.uid()));
CREATE POLICY "modos_admin_delete" ON public.rti_modos_falha FOR DELETE USING (public.has_role(auth.uid(),'admin'));

-- ════════════════════════════════════════════════════════════════════════════
-- 2) COLETAS DE CAMPO
-- ════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.field_inspections (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo          text NOT NULL,
  cliente         text,
  local           text,
  engenheiro      text,                          -- consultor responsável pela coleta
  data_inspecao   date NOT NULL DEFAULT CURRENT_DATE,
  status          text NOT NULL DEFAULT 'em_andamento'
                  CHECK (status IN ('em_andamento','finalizada','importada')),
  report_id       uuid REFERENCES public.rti_reports(id) ON DELETE SET NULL,  -- preenchido após compor o RTI
  notes           text,
  created_by_name text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.field_inspections ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_field_inspections_status ON public.field_inspections(status);

CREATE TABLE IF NOT EXISTS public.field_points (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id uuid NOT NULL REFERENCES public.field_inspections(id) ON DELETE CASCADE,
  area_nome     text NOT NULL,                   -- vira rti_areas na composição
  nome          text NOT NULL,                   -- ponto/equipamento (ex.: QGBT Sala 2)
  ordem         integer NOT NULL DEFAULT 0,
  observacoes   text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.field_points ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_field_points_inspection ON public.field_points(inspection_id);

CREATE TABLE IF NOT EXISTS public.field_findings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  point_id      uuid NOT NULL REFERENCES public.field_points(id) ON DELETE CASCADE,
  modo_falha_id uuid REFERENCES public.rti_modos_falha(id) ON DELETE SET NULL,  -- NULL = entrada manual
  descricao     text NOT NULL,                   -- vira a descrição da NC
  recomendacao  text,
  prioridade    smallint NOT NULL DEFAULT 3 CHECK (prioridade BETWEEN 1 AND 4),
  tipo_execucao text NOT NULL DEFAULT 'os' CHECK (tipo_execucao IN ('os','investimento')),
  observacao    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.field_findings ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_field_findings_point ON public.field_findings(point_id);

CREATE TABLE IF NOT EXISTS public.field_photos (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  finding_id uuid NOT NULL REFERENCES public.field_findings(id) ON DELETE CASCADE,
  file_path  text NOT NULL,                      -- bucket rti-evidencias, prefixo campo/
  file_name  text NOT NULL,
  legenda    text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.field_photos ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_field_photos_finding ON public.field_photos(finding_id);

DROP TRIGGER IF EXISTS field_inspections_touch ON public.field_inspections;
CREATE TRIGGER field_inspections_touch
  BEFORE UPDATE ON public.field_inspections
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS field_points_touch ON public.field_points;
CREATE TRIGGER field_points_touch
  BEFORE UPDATE ON public.field_points
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS field_findings_touch ON public.field_findings;
CREATE TRIGGER field_findings_touch
  BEFORE UPDATE ON public.field_findings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- RLS padrão: leitura geral, escrita staff, exclusão staff (coleta é material de
-- trabalho do consultor; admin não precisa ser gargalo no campo)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['field_inspections','field_points','field_findings','field_photos'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%s_read_all" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_staff_insert" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_staff_update" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_staff_delete" ON public.%I', t, t);
    EXECUTE format('CREATE POLICY "%s_read_all"     ON public.%I FOR SELECT USING (true)', t, t);
    EXECUTE format('CREATE POLICY "%s_staff_insert" ON public.%I FOR INSERT WITH CHECK (public.is_staff(auth.uid()))', t, t);
    EXECUTE format('CREATE POLICY "%s_staff_update" ON public.%I FOR UPDATE USING (public.is_staff(auth.uid()))', t, t);
    EXECUTE format('CREATE POLICY "%s_staff_delete" ON public.%I FOR DELETE USING (public.is_staff(auth.uid()))', t, t);
  END LOOP;
END $$;

-- ════════════════════════════════════════════════════════════════════════════
-- 3) SEED — modos de falha minerados das NCs reais + NBR 5410/14039/5419/NR-10
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO public.rti_modos_falha
  (codigo, label, categoria, descricao_padrao, recomendacao_padrao, prioridade_sugerida, tipo_execucao_sugerido, normas, ordem)
VALUES
-- ── Documentação e projetos (PIE) ─────────────────────────────────────────────
('doc-projeto-incompleto', 'Documentação de projeto incompleta/desatualizada', 'Documentação e projetos (PIE)',
 'A documentação dos projetos elétricos está incompleta ou desatualizada (diagramas unifilares, memoriais de cálculo, relatórios de comissionamento, ART não apresentadas).',
 'Atualizar e completar a documentação do prontuário (PIE): diagramas unifilares conforme construído, memoriais, relatórios de comissionamento e respectivas ART.',
 4, 'investimento', '[{"norma":"NR-10","item":"10.2.3 / 10.2.4"}]', 10),
('doc-estudo-seletividade', 'Estudo de curto-circuito/seletividade ausente ou desatualizado', 'Documentação e projetos (PIE)',
 'O estudo de curto-circuito e seletividade não foi apresentado ou não contempla todo o sistema da unidade (primário e painéis do secundário).',
 'Elaborar/revisar o estudo contemplando todo o sistema primário e secundário, ajustando os dispositivos de proteção conforme as curvas características e registrando em relatório com ART.',
 4, 'investimento', '[{"norma":"NBR 5410","item":"5.3"},{"norma":"NR-10","item":"10.2.4"}]', 11),
('doc-arc-flash', 'Estudo de energia incidente (arc flash/ATPV) não realizado', 'Documentação e projetos (PIE)',
 'Não foi apresentado estudo de energia incidente (arc flash) com definição do ATPV para as atividades em painéis energizados.',
 'Realizar o estudo de energia incidente, etiquetar os painéis com a categoria de risco/ATPV e adequar as vestimentas dos trabalhadores autorizados.',
 4, 'investimento', '[{"norma":"NR-10","item":"10.2.4"}]', 12),

-- ── Salas elétricas e subestação ──────────────────────────────────────────────
('sala-sinalizacao', 'Sala elétrica/painéis sem sinalização externa e interna', 'Salas elétricas e subestação',
 'Sala elétrica e painéis elétricos sem sinalização externa e interna; sinalizações apagadas ou improvisadas.',
 'Instalar placas de sinalização contendo identificação, alerta de perigo com classe de tensão, corrente de curto-circuito, ATPV e restrição de acesso a pessoas não autorizadas.',
 3, 'os', '[{"norma":"NR-10","item":"10.10.1"}]', 20),
('sala-limpeza', 'Sala elétrica com sujidade ou materiais estranhos', 'Salas elétricas e subestação',
 'Sala elétrica com sujidade, materiais estranhos depositados e/ou objetos obstruindo o acesso aos painéis.',
 'Remover os materiais estranhos, implantar rotina de limpeza e proibir o uso da sala elétrica como depósito.',
 2, 'os', '[{"norma":"NR-10","item":"10.4.4"}]', 21),
('sala-acesso', 'Acesso à sala elétrica/subestação não controlado', 'Salas elétricas e subestação',
 'O acesso à sala elétrica/subestação não é controlado, permitindo a entrada de pessoas não autorizadas.',
 'Manter portas trancadas com controle de chaves e sinalizar a restrição de acesso a trabalhadores autorizados.',
 3, 'os', '[{"norma":"NR-10","item":"10.10.1"}]', 22),

-- ── Quadros e painéis ─────────────────────────────────────────────────────────
('painel-sem-aterramento', 'Painéis/portas metálicas sem conexão à terra', 'Quadros e painéis',
 'Painéis elétricos com portas metálicas e/ou placas de montagem sem condutor de aterramento conectado.',
 'Inspecionar os painéis realizando a conexão à terra das placas de montagem, caixas e portas.',
 3, 'os', '[{"norma":"NBR 5410","item":"6.4"},{"norma":"NBR 14039","item":"6.4"}]', 30),
('painel-sem-tampa', 'Quadro sem porta, tampa ou espelho de proteção', 'Quadros e painéis',
 'Quadro elétrico sem porta, tampa ou espelho, expondo partes energizadas.',
 'Instalar/restituir portas, tampas e espelhos de proteção, restabelecendo a condição segura de operação.',
 4, 'os', '[{"norma":"NR-10","item":"10.4.4"}]', 31),
('partes-vivas-expostas', 'Partes vivas expostas / ausência de barreiras', 'Quadros e painéis',
 'Partes vivas acessíveis sem isolação, barreiras ou invólucros que impeçam o contato acidental.',
 'Instalar barreiras, invólucros ou isolação adequada, eliminando o risco de contato acidental com partes energizadas.',
 4, 'os', '[{"norma":"NBR 5410","item":"5.1.2.2"},{"norma":"NR-10","item":"10.2.8"}]', 32),
('painel-identificacao', 'Ausência de identificação de circuitos/componentes', 'Quadros e painéis',
 'Componentes e circuitos do quadro sem identificação legível e indelével.',
 'Identificar todos os circuitos e componentes com etiquetas legíveis e indeléveis, correspondentes ao diagrama do quadro.',
 2, 'os', '[{"norma":"NBR 5410","item":"6.5.4.10"}]', 33),
('painel-danificado', 'Componentes danificados, obsoletos ou oxidados', 'Quadros e painéis',
 'Componentes danificados, obsoletos ou com oxidação comprometendo a condição segura de funcionamento.',
 'Substituir os componentes danificados/obsoletos e tratar os pontos de oxidação, registrando na manutenção.',
 3, 'os', '[{"norma":"NR-10","item":"10.4.4"}]', 34),
('painel-ip-inadequado', 'Grau de proteção (IP) inadequado para o ambiente', 'Quadros e painéis',
 'Invólucros com grau de proteção (IP) incompatível com as influências externas do local (poeira, umidade, jato d''água).',
 'Substituir/adequar os invólucros ao grau de proteção exigido pelo ambiente de instalação.',
 3, 'investimento', '[{"norma":"NBR 5410","item":"5.1.2.2"}]', 35),

-- ── Proteção e aterramento ────────────────────────────────────────────────────
('aterramento-inadequado', 'Aterramento ausente, inadequado ou sem medição', 'Proteção e aterramento',
 'Sistema de aterramento ausente, inadequado ou sem registros de inspeção e medição da malha.',
 'Realizar inspeção e medição da malha de aterramento, corrigir as não conformidades e registrar os valores em laudo com ART.',
 4, 'os', '[{"norma":"NBR 5410","item":"6.4"}]', 40),
('ausencia-dr', 'Ausência de proteção DR onde exigida', 'Proteção e aterramento',
 'Ausência de proteção adicional por dispositivo DR de alta sensibilidade (≤ 30 mA) em circuitos que a exigem (áreas molhadas, externas, tomadas de uso geral).',
 'Instalar proteção DR nos circuitos exigidos pela norma, com teste periódico do dispositivo.',
 3, 'os', '[{"norma":"NBR 5410","item":"5.1.3.2.2"}]', 41),
('ausencia-dps', 'Ausência de DPS onde exigido', 'Proteção e aterramento',
 'Ausência de proteção contra sobretensões transitórias (DPS) onde requerida.',
 'Instalar DPS conforme projeto, coordenando os estágios de proteção e registrando a instalação.',
 3, 'investimento', '[{"norma":"NBR 5410","item":"6.3.5.2"}]', 42),
('protecao-incompativel', 'Proteção incompatível com a seção do condutor', 'Proteção e aterramento',
 'Dispositivo de proteção não coordenado com a capacidade de condução do condutor (condições In ≥ Ib e In ≤ Iz não atendidas).',
 'Adequar os dispositivos de proteção à seção dos condutores conforme o estudo de proteção do circuito.',
 4, 'os', '[{"norma":"NBR 5410","item":"5.3.4"}]', 43),

-- ── SPDA ──────────────────────────────────────────────────────────────────────
('spda-desatualizado', 'Projeto/laudo de SPDA desatualizado (NBR 5419:2015)', 'SPDA',
 'O projeto/laudo do SPDA e aterramento está incompleto ou não atende à revisão da NBR 5419 de 2015, incluindo a interligação das malhas de aterramento.',
 'Atualizar o projeto de SPDA e aterramento e implantar conforme a NBR 5419:2015, incluindo a interligação das malhas e a emissão de ART.',
 3, 'investimento', '[{"norma":"NBR 5419","item":"—"}]', 50),
('spda-inspecao', 'Inspeção periódica do SPDA não realizada', 'SPDA',
 'Não há registros de inspeção e medição periódica do SPDA (continuidade, resistência de aterramento, integridade dos captores e descidas).',
 'Implantar inspeção periódica do SPDA com emissão de laudo e ART, corrigindo as não conformidades apontadas.',
 3, 'os', '[{"norma":"NBR 5419-4","item":"—"}]', 51),

-- ── Iluminação ────────────────────────────────────────────────────────────────
('iluminacao-deficiente', 'Iluminação deficiente / luminárias inoperantes', 'Iluminação',
 'Pontos de iluminação inoperantes ou iluminância abaixo do requerido nas salas elétricas, áreas industriais e pátios.',
 'Implantar rotina de inspeção do sistema de iluminação, manter conforme o projeto luminotécnico e medir a iluminância das áreas.',
 2, 'os', '[{"norma":"NBR 8995-1","item":"—"},{"norma":"NR-10","item":"10.4.4"}]', 60),
('iluminacao-emergencia', 'Iluminação de emergência ausente ou inoperante', 'Iluminação',
 'Pontos sem luminárias de emergência, luminárias desconectadas da rede elétrica ou sem teste periódico.',
 'Instalar/restabelecer a iluminação de emergência conforme projeto e implantar teste periódico com registro.',
 3, 'os', '[{"norma":"NBR 10898","item":"—"}]', 61),

-- ── Condutores e conexões ─────────────────────────────────────────────────────
('fiacao-exposta', 'Fiação exposta / fora de eletroduto ou eletrocalha', 'Condutores e conexões',
 'Condutores instalados sem método normalizado de linha elétrica e sem proteção mecânica adequada.',
 'Reinstalar os condutores em eletroduto/eletrocalha ou outro método normalizado, com proteção mecânica adequada.',
 3, 'os', '[{"norma":"NBR 5410","item":"6.2"}]', 70),
('conexoes-frouxas', 'Emendas inadequadas / conexões frouxas', 'Condutores e conexões',
 'Conexões sem garantia de continuidade elétrica durável e suportabilidade mecânica (emendas inadequadas, terminais frouxos).',
 'Refazer as conexões com terminais adequados e reaperto conforme torque especificado, incluindo o ponto na rotina de manutenção.',
 3, 'os', '[{"norma":"NBR 5410","item":"6.2.8"}]', 71),
('sobreaquecimento', 'Sinais de sobreaquecimento / ponto quente', 'Condutores e conexões',
 'Indícios de sobreaquecimento (derretimento, escurecimento) ou ponto quente identificado, sugerindo sobrecarga ou falha de conexão.',
 'Investigar a causa (termografia, medição de corrente), corrigir a conexão/dimensionamento e reinspecioná-lo após a correção.',
 4, 'os', '[{"norma":"NBR 5410","item":"5.3"}]', 72),
('tomada-sem-pe', 'Tomadas sem condutor de proteção (PE) / fora do padrão', 'Condutores e conexões',
 'Tomadas sem contato de aterramento (PE) conectado ou em desacordo com o padrão vigente.',
 'Adequar as tomadas ao padrão NBR 14136 com condutor PE conectado, verificando a polaridade.',
 2, 'os', '[{"norma":"NBR 5410","item":"6.5.3"}]', 73),

-- ── Bloqueio e procedimentos (LOTO) ───────────────────────────────────────────
('loto-matriz', 'Matrizes de bloqueio ausentes / bloqueio em desacordo', 'Bloqueio e procedimentos',
 'Não foram apresentadas as matrizes de bloqueio da área e/ou foram constatados bloqueios em desacordo com o procedimento de controle de fontes de energia.',
 'Elaborar as matrizes de bloqueio por equipamento, treinar os executantes e auditar periodicamente a aplicação do procedimento.',
 4, 'os', '[{"norma":"NR-10","item":"10.5"}]', 80),
('procedimento-trabalho', 'Procedimento de trabalho ausente ou não seguido', 'Bloqueio e procedimentos',
 'Atividade realizada sem procedimento de trabalho específico ou em desacordo com o procedimento existente.',
 'Elaborar/revisar o procedimento de trabalho, treinar os envolvidos e registrar as liberações de serviço.',
 3, 'os', '[{"norma":"NR-10","item":"10.11"}]', 81),

-- ── EPI / EPC ─────────────────────────────────────────────────────────────────
('epi-alta-tensao', 'EPI/EPC para média/alta tensão insuficientes ou sem ensaio', 'EPI / EPC',
 'EPI/EPC para trabalhos em tensão acima de 1.000 V insuficientes, sem organização por área ou sem ensaios periódicos evidenciados.',
 'Disponibilizar o conjunto mínimo de EPI/EPC por sala elétrica (luvas isolantes, bastão, detector, tapete), com ensaios periódicos registrados.',
 4, 'os', '[{"norma":"NBR 14039","item":"5.7"},{"norma":"NR-10","item":"10.7"}]', 90),

-- ── Manutenção e inspeção ─────────────────────────────────────────────────────
('manutencao-periodica', 'Plano/roteiro de manutenção periódica inexistente', 'Manutenção e inspeção',
 'Não foi apresentado plano/roteiro de inspeção e manutenção periódica das instalações elétricas com registros.',
 'Implantar plano de manutenção preventiva com periodicidade definida, roteiros por área e registro das execuções.',
 3, 'os', '[{"norma":"NR-10","item":"10.4.4"}]', 100),
('termografia-periodica', 'Termografia periódica não realizada / sem laudo', 'Manutenção e inspeção',
 'Não há registros de inspeção termográfica periódica dos painéis e conexões com laudo e tratamento dos pontos identificados.',
 'Implantar termografia periódica com emissão de laudo, classificação dos pontos e plano de correção.',
 3, 'os', '[{"norma":"NBR 15572","item":"—"}]', 101)
ON CONFLICT (codigo) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════
-- 4) AUDITORIA — inclui as novas tabelas na trilha (se a função existir)
-- ════════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'fn_audit') THEN
    DROP TRIGGER IF EXISTS audit_rti_modos_falha   ON public.rti_modos_falha;
    DROP TRIGGER IF EXISTS audit_field_inspections ON public.field_inspections;
    CREATE TRIGGER audit_rti_modos_falha   AFTER INSERT OR UPDATE OR DELETE ON public.rti_modos_falha   FOR EACH ROW EXECUTE FUNCTION public.fn_audit();
    CREATE TRIGGER audit_field_inspections AFTER INSERT OR UPDATE OR DELETE ON public.field_inspections FOR EACH ROW EXECUTE FUNCTION public.fn_audit();
  END IF;
END $$;

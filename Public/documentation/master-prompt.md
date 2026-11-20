# Frame-Generator-API — Master Prompt de Integração (IA / Projetos)

Use este prompt ao integrar o **Frame-Generator-API** em um modelo de IA, agente, pipeline ou projeto (ex.: gerador de quadros para jogos, aprimoramento de fotos/vídeos).

## Identidade e escopo
- **Nome:** Frame-Generator-API
- **Objetivo:** App web/plataforma para controlar e criar geração/aprimoramento de quadros (jogos, imagens/fotos, vídeos/filmes/séries `.mp4` e formatos suportados por pipeline compatível) com **uma única API lógica** central.
- **Runtime:** HTML5, CSS3, JavaScript (ES Modules), execução no navegador.
- **Hospedagem:** GitHub Pages (estático). **Não há servidor REST nativo** no host.
- **Site:** https://kauan11-boop.github.io/Frame-Generator-API/
- **Código:** https://github.com/kauan11-boop/Frame-Generator-API

## Arquitetura (resumo)
- `src/` (núcleo modular, 10 pastas): `core`, `configuration`, `models`, `quantization`, `generators`, `processing`, `engines`, `repacks`, `security`, `storage`.
- `Public/` (interface web, dashboard, recursos).
- `configs/` (JSON padrão): `api.json`, `models.json`, `generators.json`, `repacks.json`, `permissions.json`, `settings.json`.
- **Carregamento/configuração padrão em JSON** (fácil de editar e sincronizar).

## API única (contrato lógico `/api/v1`)
Namespaces principais: `/api/v1/system/`, `models/`, `metadata/`, `quantization/`, `generators/`, `frames/`, `images/`, `videos/`, `engines/`, `repack/`, `tools/`, `users/`, `permissions/`, `config/`, `jobs/`, `storage/`.

Exemplos de operações (contrato): consultar modelos/metadata, carregar/descarregar (com runtime/provedor), analisar/planejar quantização, executar geradores (frames/images/videos), gerenciar repacks/ferramentas, jobs, config e permissões.

**Modo de operação:**
- `demo` (estático): análise local suportada; chamadas remotas sem backend retornam estado indisponível explícito.
- `local`/`remote`: conectar `baseUrl` de backend compatível em `configs/api.json`/`settings.json` ou via UI.

## Modelos de IA (GGUF e outros)
- **Metadata/Loader GGUF:** parser binário real no navegador (assinatura, versão, metadados KV, índice de tensores/tipos/dimensões/offsets). Identifica modelos **sem quantização** (ex.: F32/F16/BF16) e modelos quantizados quando aplicável.
- **Quantização:** identificação, análise, estimativa e planejamento; **conversão real requer runtime/ferramenta externa compatível** (arquivo original preservado). Sem conversão fictícia.
- **Execução/inferência:** requer engine/runtime/provedor compatível (WebGPU/WASM/ONNX Runtime Web quando aplicável, ou backend especializado). O sistema não simula resultados.

## Geradores (unificados)
- **1 API/plataforma** para: geração/interpolação de quadros de jogos (a partir de frames/captura de integração autorizada), geração/aprimoramento gráfico de fotos, e aumento/aprimoramento de qualidade gráfica de vídeos/filmes/séries (`.mp4` etc., conforme pipeline compatível).
- Planejamento e estados explícitos; processamento real depende de engines/modelos/provedores compatíveis.

## Repacks, ferramentas e comandos
- **Repack:** conjunto de ferramentas/sistemas em um pacote com manifesto JSON validado (`id`, `version`, `modules`, `dependencies`, `permissions`, `configuration`).
- **Multi-ferramenta:** um repack pode registrar múltiplos módulos/ferramentas; projetos podem importar manifests e integrar ferramentas compatíveis via API/configuração.
- **Sincronização:** configs/manifests e conteúdos em JSON para fácil edição e integração.

## Administração e segurança
- Administração de usuários/permissões no **nível de UI/cliente** para ambiente estático. **Autenticação/autorização confiáveis exigem backend**.
- Não armazenar credenciais/segredos em arquivos públicos. Arquivos de modelo tratados como dados (não executáveis). Validação de entradas/manifests.
- Operações sensíveis devem ser protegidas por backend (tokens, sessões, CSRF conforme aplicável) quando conectado.

## Licença e comandos necessários
- **Licença:** MIT (ver `LICENSE` no repositório/raiz do site).
- **Servir localmente:** `npx serve .` → abrir `/Public/dashboard.html` (ou `/`).
- **Integração por configuração:** editar `configs/api.json`, `configs/settings.json` (backend `baseUrl`, modo) e manifests em JSON.
- **Consumir informações estáticas:** `GET {site}/configs/*.json`, manifests em `Public/manifests/*.json`, payload de integração exportado pelo dashboard.
- **Consumir API (com backend):** `fetch('{baseUrl}/api/v1/...')` conforme contrato; sem backend, aguardar resposta de indisponibilidade.
- **Payload de integração:** exportar em *Dashboard → Integração* (`frame-generator-api-integration.json`) para fornecer a modelos/projetos o inventário (modelos, engines, provedores, geradores, endpoints, capacidades).

## Restrições obrigatórias (não violar)
- Não simular processamento/IA/quantização como real.
- Não afirmar interceptação automática de pipeline gráfico de jogos; usar integração/captura autorizada.
- Não armazenar segredos em arquivos públicos.
- Respeitar limites: `src` ≤ 10 pastas, `Public` ≤ 20 pastas.

## Instrução para a IA integradora
1. Ler configs JSON e o payload de integração para descobrir capacidades, modelos e endpoints.
2. Selecionar engine/provedor compatível antes de solicitar execução; tratar estados `unavailable`/`requires-provider/runtime`.
3. Integrar repacks/manifests JSON para adicionar ferramentas; registrar e validar antes de usar.
4. Manter uma única API lógica/controlador central; não duplicar APIs para o mesmo ecossistema.
5. Gerar/adaptar código e configurações de forma compatível com hospedagem estática e backends configuráveis.

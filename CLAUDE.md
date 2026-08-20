# BioTechSafe — Site

Site institucional estático (HTML + CSS + JS puro, sem build/framework) para a BioTechSafe, empresa de biossensores para detecção de frescor de carnes/alimentos.

## Estrutura

- `index.html`, `sobre.html`, `negocio.html`, `como-funciona.html` — páginas do site
- `styles.css` — todo o design system e estilos
- `script.js` — interações (scroll, reveal, nav, etc.)
- `assets/` — imagens, vídeo do sensor, texturas

Todas as variáveis de design (cores, fontes, espaçamentos) ficam centralizadas em `:root` no topo de `styles.css`. Sempre reutilize essas variáveis em vez de valores soltos.

## Tipografia

Fontes carregadas via Google Fonts no topo de `styles.css`:

```css
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Sora:wght@400;500;600;700&display=swap');
```

- **Sora** (`--font-display`, `--font-body`) — usada em títulos, corpo de texto e UI em geral. Pesos usados: 400, 500, 600, 700.
- **IBM Plex Mono** (`--font-mono`) — usada em elementos técnicos/rótulos: eyebrows, tags, breadcrumbs, legendas de imagem, captions.

Não introduzir novas famílias tipográficas sem necessidade explícita.

## Paleta de cores

Definida em `:root` em `styles.css:9-26`. É um gradiente de "frescor" amostrado da escala de cor real do sensor.

| Variável | Hex | Uso |
|---|---|---|
| `--c-plum` | `#241335` | tom mais escuro do gradiente de frescor |
| `--c-purple` | `#4E2E86` | cor de marca principal — CTAs, links, destaques |
| `--c-blue` | `#2E6FB0` | gradiente de frescor |
| `--c-teal` | `#17A398` | estado "bom/fresco", sucessos, destaques secundários |
| `--c-green` | `#4FAE6D` | estado positivo (prova social, indicadores "ok") |
| `--c-yellow` | `#C7CE3E` | fim do gradiente de frescor (alerta leve) |
| `--c-alert` | `#E0483A` | erro/alerta — carne estragada, problemas |
| `--paper` | `#F8F6F1` | fundo padrão (bege claro) |
| `--paper-dim` | `#F0ECE3` | fundo levemente mais escuro (seções alternadas) |
| `--ink` | `#1B1523` | texto principal |
| `--ink-soft` | `#59526A` | texto secundário |
| `--line` | `rgba(27,21,35,0.12)` | bordas e divisórias sutis |
| `--night` | `#120B1B` | fundo escuro (seções dark, footer) |
| `--night-2` | `#1B1130` | variação do fundo escuro (gradientes) |

`--gradient-fresh` é o gradiente linear roxo → azul → teal → verde → amarelo (`--c-purple` a `--c-yellow`), usado como assinatura visual recorrente (barra de progresso, linha do eyebrow, barra de escala de frescor, CTAs).

Sempre usar as variáveis CSS existentes ao invés de hex hardcoded. Não adicionar cores novas fora dessa paleta sem confirmar com o usuário.

## Bordas — SEM cantos arredondados

**Regra obrigatória: nenhum elemento deve ter cantos arredondados (`border-radius: 0` em todo o site).** Essa é uma decisão de design explícita e não deve ser revertida.

- Ao escrever ou editar CSS, sempre usar `border-radius: 0` (ou omitir a propriedade) em botões, cards, containers, imagens, inputs etc.
- Todo `border-radius` retangular em `styles.css` já foi zerado (cards, CTAs, pills, imagens). Não reintroduzir valores como `16px`, `18px`, `20px`, `100px` etc. em componentes novos ou editados.
- Elementos circulares (`border-radius: 50%`) foram mantidos de propósito: dot do eyebrow, dots de navegação de capítulo, dot de prova social do B2B, ícone circular do `.info-card .mark`, e o avatar circular em `sobre.html`. São indicadores redondos intencionais, não "cantos arredondados" de retângulos — na dúvida, perguntar ao usuário antes de manter ou remover formas circulares.
- **Exceções confirmadas pelo usuário** (mantêm curvatura do design original, não zerar):
  - Contorno do sensor na página inicial (`.sensor-float__card` em `styles.css`) — `clip-path: inset(6.25% 8.6% 8.15% 8.6% round 5%)`.
  - Quadrado central do sensor que troca de cor (`.sensor-float__color` e `.sensor-float__color::after` em `styles.css`) — `border-radius: 6%` (o `::after` usa `border-radius: inherit`).

## Sem travessões

**Proibido usar travessões (—, en dash –) no texto do site (títulos, parágrafos, textos alternativos, comentários de código).** Reescreva a frase usando vírgula, ponto, dois-pontos ou ponto e vírgula, ou divida em duas frases, conforme o que soar mais natural. Em `<title>`, usar `|` como separador entre o nome da página e "BioTechSafe".

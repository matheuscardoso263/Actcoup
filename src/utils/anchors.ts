/**
 * Âncoras de layout.
 *
 * Animações que atravessam a tela (moedas em voo, cartas sendo distribuídas)
 * precisam saber onde estão origem e destino, e essas posições dependem do
 * número de jogadores, do tamanho da janela e da escala fluida das cartas.
 * Em vez de calcular isso em JS, o layout se marca com um data-attribute e a
 * animação lê a geometria real na hora de disparar.
 */

export interface Point {
  x: number;
  y: number;
}

/** Centro do elemento marcado, em coordenadas de viewport. */
export function anchorCenter(attribute: string, id: string): Point | null {
  const el = document.querySelector<HTMLElement>(`[${attribute}="${CSS.escape(id)}"]`);
  if (!el) return null;
  const rect = el.getBoundingClientRect();
  // Elemento ainda sem layout (escondido, ou o frame antes da montagem):
  // devolve null pra quem chamou descartar a animação em silêncio.
  if (rect.width === 0 && rect.height === 0) return null;
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/** Contador de moedas de um jogador — ou a tesouraria da mesa. */
export const coinAnchor = (id: string) => anchorCenter('data-coin-anchor', id);

/** Área onde as cartas de um jogador ficam apoiadas. */
export const handAnchor = (id: string) => anchorCenter('data-hand-anchor', id);

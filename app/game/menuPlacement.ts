type Anchor = { left: number; top: number; bottom: number; width: number };
type Viewport = { width: number; height: number; left?: number; top?: number };

export function placeSelectMenu(anchor: Anchor, viewport: Viewport, contentHeight: number) {
  const margin = 8, gap = 5;
  const leftEdge = (viewport.left ?? 0) + margin;
  const rightEdge = (viewport.left ?? 0) + viewport.width - margin;
  const topEdge = (viewport.top ?? 0) + margin;
  const bottomEdge = (viewport.top ?? 0) + viewport.height - margin;
  const below = Math.max(0, bottomEdge - anchor.bottom - gap);
  const above = Math.max(0, anchor.top - gap - topEdge);
  const upwards = below < contentHeight && above > below;
  const maxHeight = upwards ? above : below;
  const width = Math.max(0, Math.min(Math.max(112, anchor.width), rightEdge - leftEdge));
  return {
    width,
    left: Math.min(Math.max(leftEdge, anchor.left), rightEdge - width),
    top: upwards ? anchor.top - gap - Math.min(contentHeight, maxHeight) : anchor.bottom + gap,
    maxHeight,
  };
}

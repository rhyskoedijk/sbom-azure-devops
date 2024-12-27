const font = "14px 'Segoe UI'";

let ctx: CanvasRenderingContext2D | null = null;

const measureTextWidth = (text: string) => {
  if (!ctx) {
    ctx = document.createElement('canvas').getContext('2d');
    if (ctx) {
      ctx.font = font;
    }
  }
  return ctx?.measureText(text)?.width || undefined;
};

export function calculateMaxTextWidth(text: string[]): number {
  return text.reduce((acc, cur) => {
    const value = cur;
    const width = measureTextWidth(value.toLocaleString());
    if (width !== undefined && width > acc) {
      return width;
    }
    return acc;
  }, 0);
}

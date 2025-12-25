/**
 * Helper to get computed CSS color values and convert oklch to hex
 */
export const getCSSColor = (variable: string): string => {
  if (typeof window === "undefined") return "#3b82f6";
  const root = document.documentElement;
  const value = getComputedStyle(root).getPropertyValue(variable).trim();
  if (!value) return "#3b82f6";

  // If it's an oklch value, convert it to hex
  if (value.startsWith("oklch(")) {
    const match = value.match(
      /oklch\(([0-9.]+%?)\s+([0-9.]+)\s+([0-9.]+)(deg)?\)/
    );
    if (match) {
      const [, l, c, h] = match;
      const L = parseFloat(l) / (l.includes("%") ? 100 : 1);
      const C = parseFloat(c);
      const H = parseFloat(h);
      const a = C * Math.cos((H * Math.PI) / 180);
      const b = C * Math.sin((H * Math.PI) / 180);
      const fy = (L + 0.16) / 1.16;
      const fx = fy + a / 5;
      const fz = fy - b / 2;
      const xr = fx ** 3 > 0.008856 ? fx ** 3 : (fx - 16 / 116) / 7.787;
      const yr = L > 0.008856 * 903.3 ? ((L + 0.16) / 1.16) ** 3 : L / 903.3;
      const zr = fz ** 3 > 0.008856 ? fz ** 3 : (fz - 16 / 116) / 7.787;
      let r = xr * 3.2406 + yr * -1.5372 + zr * -0.4986;
      let g = xr * -0.9689 + yr * 1.8758 + zr * 0.0415;
      let bl = xr * 0.0557 + yr * -0.204 + zr * 1.057;
      r = r > 0.0031308 ? 1.055 * r ** (1 / 2.4) - 0.055 : 12.92 * r;
      g = g > 0.0031308 ? 1.055 * g ** (1 / 2.4) - 0.055 : 12.92 * g;
      bl = bl > 0.0031308 ? 1.055 * bl ** (1 / 2.4) - 0.055 : 12.92 * bl;
      const toHex = (n: number) =>
        Math.max(0, Math.min(255, Math.round(n * 255)))
          .toString(16)
          .padStart(2, "0");
      return `#${toHex(r)}${toHex(g)}${toHex(bl)}`;
    }
  }
  return value;
};

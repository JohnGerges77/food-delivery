/** Presentation-only normalization; stored customer and restaurant data stays intact. */
export function westernDigits(value: string): string {
  return value.replace(/[٠-٩۰-۹]/g, (digit) => {
    const point = digit.codePointAt(0)!;
    return String(point >= 0x6f0 ? point - 0x6f0 : point - 0x660);
  });
}

export function safePublicImage(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\") &&
      !/[\u0000-\u001f]/.test(value)) return value;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export function publicMoney(amount: number, currency: string, locale: string) {
  try {
    return new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US",
      { style: "currency", currency }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

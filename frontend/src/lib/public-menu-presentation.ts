export function safePublicImage(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.startsWith("/") && !value.startsWith("//") && !value.includes("\\") &&
      !/[\u0000-\u001f]/.test(value)) return value;
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null;
    if (/^lh[0-9]+\.googleusercontent\.com$/.test(url.hostname) && url.pathname === "/proxy") return null;
    if (/^(?:encrypted-)?tbn[0-9]*\.gstatic\.com$/.test(url.hostname)) {
      const directThumbnail = url.protocol === "https:" && !url.port &&
        /^encrypted-tbn[0-9]+\.gstatic\.com$/.test(url.hostname) &&
        url.pathname === "/images" && /^tbn:[A-Za-z0-9_-]+$/.test(url.searchParams.get("q") ?? "");
      if (!directThumbnail) return null;
    }
    return url.href;
  } catch { return null; }
}

export function publicMoney(amount: number, currency: string, locale: string) {
  try {
    return new Intl.NumberFormat(locale === "ar" ? "ar-EG-u-nu-latn" : "en-US",
      { style: "currency", currency }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

export function productDisplayPrice(product: { price: number; variants?: { price: number; isAvailable: boolean }[] }, currency: string, locale: string) {
  if (!product.variants?.length) return publicMoney(product.price, currency, locale);
  const available = product.variants.filter((v) => v.isAvailable);
  if (!available.length) return locale === 'ar' ? 'غير متاح' : 'Unavailable';
  return `${locale === 'ar' ? 'ابتداءً من' : 'Starting from'} ${publicMoney(Math.min(...available.map((v) => v.price)), currency, locale)}`;
}

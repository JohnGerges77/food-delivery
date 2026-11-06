"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { ArrowUpRight, ShoppingBag, Plus } from "lucide-react";
import { MenuOrderingPage } from "@/components/features/menu/MenuOrderingPage";
import { publicMoney, safePublicImage } from "@/lib/public-menu-presentation";
import { useCartStore } from "@/store/cart-store";
import { CartAttention } from "../CartAttention";
import type { PublicPage, PublicProduct, PublicRestaurant } from "@/services/public-menu";
import { PublicProductImage } from "../PublicProductImage";
import { ProductImageGallery } from "../ProductImageGallery";
import { useStorefront } from "../StorefrontContext";
import styles from "./LuxuryStorefront.module.css";

function ProductImage({ product, sizes }: { product: PublicProduct; sizes: string }) {
  return <PublicProductImage alt={product.name} src={product.imageUrl || product.images[0]} sizes={sizes} className={styles.image} />;
}

function hasImage(product: PublicProduct) {
  return Boolean(safePublicImage(product.imageUrl || product.images[0]));
}

export function LuxuryNavbar() {
  const { restaurant, href } = useStorefront();
  const locale = useLocale();
  const t = useTranslations("navigation");
  const pathname = usePathname();
  const tenantSlug = useCartStore((state) => state.tenantSlug);
  const count = useCartStore((state) => state.items.reduce((sum, item) => sum + item.quantity, 0));
  const links = [
    { path: "/", label: t("home") }, { path: "/menu", label: t("menu") },
    { path: "/about", label: t("about") }, { path: "/#contact", label: t("contact") },
  ];
  return <header className={styles.header}>
    {(restaurant.address || restaurant.openingHours || restaurant.phone) && <div className={styles.infoBar}>
      <div>{restaurant.address && <span>{restaurant.address}</span>}{restaurant.openingHours && <span>{restaurant.openingHours}</span>}{restaurant.phone && <a href={`tel:${restaurant.phone.replace(/[^+\d]/g, "")}`}>{restaurant.phone}</a>}</div>
    </div>}
    <div className={styles.navInner}>
      <Link href={href("/")} className={styles.wordmark} aria-label={restaurant.name}>{restaurant.logoUrl && <span className="relative me-2 inline-block size-8 align-middle"><PublicProductImage src={restaurant.logoUrl} alt={restaurant.name} className="object-contain" sizes="32px" /></span>}{restaurant.name}</Link>
      <nav className={styles.navLinks} aria-label={locale === "ar" ? "التنقل الرئيسي" : "Main navigation"}>{links.map(({ path, label }) => {
        const active = path === "/" ? pathname === href("/") : path.includes("#") ? false : pathname === href(path) || pathname.startsWith(`${href(path)}/`);
        return <Link key={path} href={href(path)} aria-current={active ? "page" : undefined}>{label}</Link>;
      })}</nav>
      <div className={styles.navActions}>
        <Link href={pathname} locale={locale === "ar" ? "en" : "ar"} aria-label={t("switchLanguage", { language: t(`languages.${locale === "ar" ? "en" : "ar"}`) })}>{locale === "ar" ? "EN" : "عربي"}</Link>
        <Link href={href("/cart")} className={styles.cartLink} aria-label={`${t("viewCart")}: ${tenantSlug === restaurant.slug ? count : 0}`} aria-current={pathname === href("/cart") || pathname === href("/checkout") ? "page" : undefined}><CartAttention><ShoppingBag size={19} aria-hidden="true" /><span>{tenantSlug === restaurant.slug ? count : 0}</span></CartAttention></Link>
      </div>
    </div>
  </header>;
}

function FeaturedCard({ product, restaurant, locale }: { product: PublicProduct; restaurant: PublicRestaurant; locale: string }) {
  const { href } = useStorefront();
  const add = useCartStore((state) => state.addPublicItem);
  const ar = locale === "ar";
  return <article className={`${styles.featuredCard} relative`}>
    <Link href={href(`/menu/${product.id}`)} className="absolute inset-0 z-10" aria-label={ar ? `تفاصيل ${product.name}` : `Details for ${product.name}`} />
    <div className={styles.cardVisual}>{hasImage(product) ? <ProductImage product={product} sizes="(min-width: 900px) 28vw, 100vw" /> : <span className={styles.cardNoImage}>{product.name}</span>}</div>
    <div className={styles.cardDetails}><div><h3>{product.name}</h3>{product.description && <p>{product.description}</p>}</div><strong>{publicMoney(product.price, restaurant.currency, locale)}</strong></div>
    <button type="button" onClick={() => add(restaurant.slug, product)} className={`${styles.cardAdd} relative z-20`}><Plus size={17} aria-hidden="true" />{ar ? "أضف إلى السلة" : "Add to cart"}</button>
  </article>;
}

export function LuxuryHome({ restaurant, initialProducts }: { restaurant: PublicRestaurant; initialProducts: PublicProduct[] }) {
  const locale = useLocale();
  const ar = locale === "ar";
  const { categories, href } = useStorefront();
  const ordered = [...initialProducts.filter((item) => item.isFeatured), ...initialProducts.filter((item) => !item.isFeatured)];
  const heroProduct = restaurant.heroProductSelected ? restaurant.heroProduct ?? undefined : ordered.find(hasImage) || ordered[0];
  const featured = ordered.filter((item) => item.id !== heroProduct?.id).slice(0, 3);
  return <main className={styles.home}>
    <section className={styles.hero}>
      <div className={styles.heroCopy}><h1>{restaurant.name}</h1><p>{restaurant.description || (ar ? "اكتشف أطباق المطعم واطلب ما يعجبك." : "Discover the menu and choose a dish to enjoy.")}</p><Link href={href("/menu")} className={styles.mainAction}>{ar ? "تصفح القائمة" : "Explore the menu"}<ArrowUpRight size={19} aria-hidden="true" /></Link></div>
      <div className={styles.heroVisual}>{heroProduct && hasImage(heroProduct) ? <Link href={href(`/menu/${heroProduct.id}`)} className={styles.heroPhoto}><ProductImage product={heroProduct} sizes="(min-width: 900px) 50vw, 100vw" /><span><strong>{heroProduct.name}</strong><small>{publicMoney(heroProduct.price, restaurant.currency, locale)}</small></span></Link> : <div className={styles.heroNoPhoto}><span>{restaurant.name}</span>{heroProduct && <strong>{heroProduct.name}</strong>}<Link href={href("/menu")}>{ar ? "القائمة كاملة" : "See the menu"}<ArrowUpRight size={18} aria-hidden="true" /></Link></div>}</div>
    </section>
    <section className={styles.story}><div className={styles.storyCopy}><h2>{ar ? "عن المطعم" : "At the table"}</h2><p>{restaurant.description || (ar ? "تعرّف على المطعم واستكشف قائمته." : "Get to know the restaurant and explore its menu.")}</p><Link href={href("/about")}>{ar ? "معلومات المطعم" : "About the restaurant"}<ArrowUpRight size={18} aria-hidden="true" /></Link></div><div className={styles.storyVisual}>{ordered.find((item) => item.id !== heroProduct?.id && hasImage(item)) ? <ProductImage product={ordered.find((item) => item.id !== heroProduct?.id && hasImage(item))!} sizes="(min-width: 900px) 40vw, 100vw" /> : <div className={styles.storyText}><span>{restaurant.name}</span><span>{ar ? "القائمة" : "The menu"}</span></div>}</div></section>
    {featured.length > 0 && <section className={styles.featured}><div className={styles.sectionHeading}><h2>{ar ? "من قائمتنا" : "From the menu"}</h2><Link href={href("/menu")}>{ar ? "جميع الأطباق" : "View all dishes"}<ArrowUpRight size={18} aria-hidden="true" /></Link></div><div className={styles.featuredGrid}>{featured.map((item) => <FeaturedCard key={item.id} product={item} restaurant={restaurant} locale={locale} />)}</div></section>}
    {categories.length > 0 && <section className={styles.categories}><div className={styles.sectionHeading}><h2>{ar ? "استكشف القائمة" : "Find your course"}</h2><Link href={href("/menu")}>{ar ? "القائمة كاملة" : "Full menu"}<ArrowUpRight size={18} aria-hidden="true" /></Link></div><div className={styles.categoryList}>{categories.map((item) => <Link key={item.id} href={href("/menu")}>{item.name}<ArrowUpRight size={22} aria-hidden="true" /></Link>)}</div></section>}
    <LuxuryContact restaurant={restaurant} />
  </main>;
}

function LuxuryContact({ restaurant }: { restaurant: PublicRestaurant }) {
  const ar = useLocale() === "ar";
  const { href } = useStorefront();
  return <section className={styles.contact} id="contact"><div><h2>{ar ? "جاهز تختار طلبك؟" : "Make it yours"}</h2><p>{restaurant.description || (ar ? "تصفح القائمة واختر ما يناسبك." : "Browse the menu and choose what suits you.")}</p><Link className={styles.mainAction} href={href("/menu")}>{ar ? "تصفح القائمة" : "Browse the menu"}<ArrowUpRight size={18} aria-hidden="true" /></Link></div><dl>{restaurant.openingHours && <div><dt>{ar ? "ساعات العمل" : "Opening hours"}</dt><dd>{restaurant.openingHours}</dd></div>}{restaurant.address && <div><dt>{ar ? "العنوان" : "Address"}</dt><dd>{restaurant.address}</dd></div>}{restaurant.phone && <div><dt>{ar ? "الهاتف" : "Phone"}</dt><dd><a href={`tel:${restaurant.phone.replace(/[^+\d]/g, "")}`}>{restaurant.phone}</a></dd></div>}{restaurant.contactEmail && <div><dt>{ar ? "البريد الإلكتروني" : "Email"}</dt><dd><a href={`mailto:${restaurant.contactEmail}`}>{restaurant.contactEmail}</a></dd></div>}</dl></section>;
}

export function LuxuryMenu({ initialProducts, initialPagination }: { initialProducts: PublicProduct[]; initialPagination: PublicPage | null }) {
  const ar = useLocale() === "ar";
  const { restaurant } = useStorefront();
  return <div className={styles.menu}><header className={styles.pageIntro}><span>{restaurant.name}</span><h1>{ar ? "القائمة" : "The menu"}</h1><p>{restaurant.description || (ar ? "اختر ما يعجبك من القائمة." : "Choose from the menu.")}</p></header><MenuOrderingPage initialProducts={initialProducts} initialPagination={initialPagination} /></div>;
}

export function LuxuryProduct({ product }: { product: PublicProduct }) {
  const locale = useLocale(); const ar = locale === "ar";
  const { restaurant, categories, href } = useStorefront();
  const add = useCartStore((state) => state.addPublicItem);
  const category = categories.find((item) => item.id === product.categoryId);
  return <main className={styles.product}><Link href={href("/menu")} className={styles.back}>{ar ? "العودة للقائمة" : "Back to menu"}</Link><article className={styles.productLayout}><div className={styles.productVisual}>{hasImage(product) ? <ProductImageGallery product={product} sizes="(min-width: 900px) 50vw, 100vw" className={styles.image} /> : <div className={styles.productNoImage}><span>{restaurant.name}</span><strong>{product.name}</strong></div>}</div><div className={styles.productCopy}>{category && <span>{category.name}</span>}<h1>{product.name}</h1>{product.description && <p>{product.description}</p>}<strong>{publicMoney(product.price, restaurant.currency, locale)}</strong>{product.oldPrice !== null && product.oldPrice > product.price && <del>{publicMoney(product.oldPrice, restaurant.currency, locale)}</del>}{product.preparationTime !== null && <small>{ar ? "وقت التحضير" : "Preparation time"}: {product.preparationTime} {ar ? "دقيقة" : "min"}</small>}<button type="button" className={styles.mainAction} onClick={() => add(restaurant.slug, product)}>{ar ? "أضف إلى السلة" : "Add to cart"}<Plus size={18} aria-hidden="true" /></button></div></article></main>;
}

export function LuxuryAbout() {
  const { restaurant, href } = useStorefront();
  const ar = useLocale() === "ar";
  return <main className={styles.about}><div className={styles.aboutIntro}><h1>{restaurant.name}</h1><p>{restaurant.description || (ar ? "تعرّف على المطعم وقائمته." : "Explore the restaurant and its menu.")}</p><Link href={href("/menu")} className={styles.mainAction}>{ar ? "تصفح القائمة" : "Explore the menu"}<ArrowUpRight size={18} aria-hidden="true" /></Link></div><LuxuryContact restaurant={restaurant} /></main>;
}

export function LuxuryFooter() {
  const { restaurant, href } = useStorefront();
  const ar = useLocale() === "ar";
  return <footer className={styles.footer}><div className={styles.footerTop}><strong>{restaurant.name}</strong><nav aria-label={ar ? "روابط التذييل" : "Footer navigation"}><Link href={href("/")}>{ar ? "الرئيسية" : "Home"}</Link><Link href={href("/menu")}>{ar ? "القائمة" : "Menu"}</Link><Link href={href("/about")}>{ar ? "عن المطعم" : "About"}</Link><Link href={href("/cart")}>{ar ? "السلة" : "Cart"}</Link></nav></div><div className={styles.footerBottom}><span>© {new Date().getFullYear()} {restaurant.name}</span>{restaurant.address && <span>{restaurant.address}</span>}</div></footer>;
}

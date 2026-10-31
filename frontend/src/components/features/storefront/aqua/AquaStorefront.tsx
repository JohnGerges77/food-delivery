"use client";

import { useLocale, useTranslations } from "next-intl";
import { ArrowUpRight, Languages, ShoppingBag, Plus } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { MenuOrderingPage } from "@/components/features/menu/MenuOrderingPage";
import { PublicProductImage } from "../PublicProductImage";
import { useStorefront } from "../StorefrontContext";
import { publicMoney, safePublicImage } from "@/lib/public-menu-presentation";
import { useCartStore } from "@/store/cart-store";
import type { PublicPage, PublicProduct, PublicRestaurant } from "@/services/public-menu";
import styles from "./AquaStorefront.module.css";

export function AquaNavbar() {
  const { restaurant, href } = useStorefront();
  const locale = useLocale();
  const t = useTranslations("navigation");
  const pathname = usePathname();
  const nextLocale = locale === "ar" ? "en" : "ar";
  const tenantSlug = useCartStore((state) => state.tenantSlug);
  const count = useCartStore((state) => state.items.reduce((sum, item) => sum + item.quantity, 0));
  const links = [
    { path: "/", label: t("home") }, { path: "/menu", label: t("menu") },
    { path: "/about", label: t("about") }, { path: "/#contact", label: t("contact") },
  ];
  return <nav className={styles.nav} aria-label={locale === "ar" ? "التنقل الرئيسي" : "Main navigation"}>
    <div className={styles.navInner}>
      <Link href={href("/")} className={styles.wordmark} aria-label={restaurant.name}>{restaurant.name}</Link>
      <div className={styles.navLinks}>{links.map(({ path, label }) => {
        const active = path === "/" ? pathname === href("/") : path.includes("#") ? false : pathname === href(path) || pathname.startsWith(`${href(path)}/`);
        return <Link key={path} href={href(path)} aria-current={active ? "page" : undefined} className={styles.navLink}>{label}</Link>;
      })}</div>
      <div className={styles.navActions}>
        <Link className={styles.language} href={pathname} locale={nextLocale} aria-label={t("switchLanguage", { language: t(`languages.${nextLocale}`) })}><Languages size={18} aria-hidden="true" /><span>{nextLocale === "ar" ? "العربية" : "EN"}</span></Link>
        <Link className={styles.cartLink} href={href("/cart")} aria-label={t("viewCart")} aria-current={pathname === href("/cart") || pathname === href("/checkout") ? "page" : undefined}><ShoppingBag size={19} aria-hidden="true" /><span>{tenantSlug === restaurant.slug ? count : 0}</span></Link>
      </div>
    </div>
  </nav>;
}

function FoodImage({ product, sizes }: { product: PublicProduct; sizes: string }) {
  return <PublicProductImage src={product.imageUrl || product.images[0]} alt={product.name} sizes={sizes} className={styles.foodImage} />;
}

export function AquaHome({ restaurant, initialProducts }: { restaurant: PublicRestaurant; initialProducts: PublicProduct[] }) {
  const locale = useLocale();
  const ar = locale === "ar";
  const { categories, href } = useStorefront();
  const pictured = initialProducts.filter((product) => safePublicImage(product.imageUrl || product.images[0]));
  const heroProduct = pictured[0];
  const secondProduct = pictured[1];
  const showcase = [...initialProducts.filter((product) => product.isFeatured),
    ...initialProducts.filter((product) => !product.isFeatured)]
    .filter((product) => product.id !== heroProduct?.id).slice(0, 3);
  return <main className={styles.home}>
    <section className={styles.hero}>
      <div className={styles.heroInner}>
        <h1>{restaurant.name}</h1>
        <div className={styles.heroBody}>
          <div className={styles.heroCopy}>
            <p>{restaurant.description || (ar ? "اكتشف قائمة المطعم واختر ما يعجبك." : "Discover the menu and choose what you love.")}</p>
            <Link className={styles.primaryAction} href={href("/menu")}>{ar ? "تصفح القائمة" : "Explore the menu"}<ArrowUpRight aria-hidden="true" size={20} /></Link>
          </div>
          <div className={styles.heroGallery}>
            {heroProduct ? <Link href={href(`/menu/${heroProduct.id}`)} className={styles.heroTile} aria-label={heroProduct.name}><FoodImage product={heroProduct} sizes="(min-width: 900px) 58vw, 100vw" /><span><strong>{heroProduct.name}</strong><small>{publicMoney(heroProduct.price, restaurant.currency, locale)}</small></span></Link> : <div className={styles.heroEmpty}><span>{ar ? "القائمة في انتظار أطباقها" : "The menu is on its way"}</span><Link href={href("/menu")}>{ar ? "اذهب إلى القائمة" : "Go to the menu"}<ArrowUpRight size={17} aria-hidden="true" /></Link></div>}
            {secondProduct && <Link href={href(`/menu/${secondProduct.id}`)} className={styles.heroSecondary} aria-label={secondProduct.name}><FoodImage product={secondProduct} sizes="(min-width: 900px) 18vw, 36vw" /><span>{secondProduct.name}</span></Link>}
          </div>
        </div>
      </div>
    </section>
    {categories.length > 0 && <section className={styles.categories} aria-label={ar ? "أقسام القائمة" : "Menu categories"}>
      <div className={styles.categoryIntro}><h2>{ar ? "على القائمة" : "On the menu"}</h2><Link href={href("/menu")}>{ar ? "استكشف القائمة كاملة" : "Explore the full menu"}<ArrowUpRight aria-hidden="true" size={18} /></Link></div>
      <div className={styles.categoryList}>{categories.map((category) => <Link href={href("/menu")} key={category.id}><span>{category.name}</span><ArrowUpRight aria-hidden="true" size={25} /></Link>)}</div>
    </section>}
    {showcase.length > 0 && <section className={styles.showcase} id="featured">
      <div className={styles.sectionHead}><h2>{ar ? "أطباق من قائمتنا" : "From our kitchen"}</h2><Link href={href("/menu")}>{ar ? "كل الأطباق" : "Full menu"}<ArrowUpRight size={17} aria-hidden="true" /></Link></div>
      <div className={styles.showcaseGrid}>{showcase.map((product) => <article key={product.id} className={styles.showcaseItem}>
        <Link href={href(`/menu/${product.id}`)} className={styles.showcasePhoto}><FoodImage product={product} sizes="(min-width: 768px) 50vw, 100vw" /></Link>
        <div className={styles.showcaseCaption}><div><h3><Link href={href(`/menu/${product.id}`)}>{product.name}</Link></h3>{product.description && <p>{product.description}</p>}</div><strong>{publicMoney(product.price, restaurant.currency, locale)}</strong></div>
      </article>)}</div>
    </section>}
    <section className={styles.information} id="contact">
      <div><h2>{ar ? "عن المطعم" : "A place to return to"}</h2><p>{restaurant.description || (ar ? "تعرّف على معلومات المطعم وتصفح القائمة." : "Discover the restaurant and browse its menu.")}</p><Link href={href("/about")}>{ar ? "معلومات المطعم" : "Restaurant details"}<ArrowUpRight size={17} aria-hidden="true" /></Link></div>
      <dl>{restaurant.openingHours && <div><dt>{ar ? "ساعات العمل" : "Opening hours"}</dt><dd>{restaurant.openingHours}</dd></div>}{restaurant.address && <div><dt>{ar ? "العنوان" : "Address"}</dt><dd>{restaurant.address}</dd></div>}{restaurant.phone && <div><dt>{ar ? "الهاتف" : "Phone"}</dt><dd><a href={`tel:${restaurant.phone.replace(/[^+\d]/g, "")}`}>{restaurant.phone}</a></dd></div>}{!restaurant.openingHours && !restaurant.address && !restaurant.phone && <div><dt>{ar ? "القائمة" : "Menu"}</dt><dd><Link href={href("/menu")}>{ar ? "تصفح الأطباق المتاحة" : "Browse available dishes"}</Link></dd></div>}</dl>
    </section>
  </main>;
}

// Keep the existing menu's fetching, filtering, previews, and cart actions in one place.
export function AquaMenu({ initialProducts, initialPagination }: { initialProducts: PublicProduct[]; initialPagination: PublicPage | null }) {
  const ar = useLocale() === "ar";
  const { restaurant } = useStorefront();
  return <div className={styles.aquaMenu}><header className={styles.pageIntro}><div className={styles.pageIntroInner}><span>{restaurant.name}</span><h1>{ar ? "القائمة" : "The menu"}</h1><p>{restaurant.description || (ar ? "اختر طبقك المفضل." : "Find your next favorite dish.")}</p></div></header><MenuOrderingPage initialProducts={initialProducts} initialPagination={initialPagination} /></div>;
}

export function AquaProduct({ product }: { product: PublicProduct }) {
  const locale = useLocale(); const ar = locale === "ar";
  const { restaurant, categories, href } = useStorefront();
  const add = useCartStore((state) => state.addPublicItem);
  const category = categories.find((item) => item.id === product.categoryId);
  return <main className={styles.productPage}><Link className={styles.backLink} href={href("/menu")}>{ar ? "العودة للقائمة" : "Back to menu"}</Link><article className={styles.productLayout}><div className={styles.productPhoto}><FoodImage product={product} sizes="(min-width: 800px) 50vw, 100vw" /></div><div className={styles.productCopy}>{category && <p className={styles.categoryName}>{category.name}</p>}<h1>{product.name}</h1>{product.description && <p>{product.description}</p>}<strong>{publicMoney(product.price, restaurant.currency, locale)}</strong>{product.preparationTime !== null && <span>{ar ? "وقت التحضير" : "Preparation time"}: {product.preparationTime} {ar ? "دقيقة" : "min"}</span>}<button type="button" className={styles.primaryAction} onClick={() => add(restaurant.slug, product)}>{ar ? "أضف إلى السلة" : "Add to cart"}<Plus size={19} aria-hidden="true" /></button></div></article></main>;
}

export function AquaAbout() {
  const ar = useLocale() === "ar";
  const { restaurant, href } = useStorefront();
  return <main className={styles.aboutPage}><div className={styles.aboutIntro}><h1>{restaurant.name}</h1><p>{restaurant.description || (ar ? "تعرف على المطعم وقائمته." : "Explore the restaurant and its menu.")}</p><Link className={styles.primaryAction} href={href("/menu")}>{ar ? "تصفح القائمة" : "Browse menu"}<ArrowUpRight size={19} aria-hidden="true" /></Link></div><div className={styles.aboutFacts}>{restaurant.address && <div><span>{ar ? "العنوان" : "Address"}</span><strong>{restaurant.address}</strong></div>}{restaurant.openingHours && <div><span>{ar ? "ساعات العمل" : "Opening hours"}</span><strong>{restaurant.openingHours}</strong></div>}{restaurant.phone && <div><span>{ar ? "الهاتف" : "Phone"}</span><strong>{restaurant.phone}</strong></div>}{restaurant.contactEmail && <div><span>{ar ? "البريد الإلكتروني" : "Email"}</span><strong>{restaurant.contactEmail}</strong></div>}</div></main>;
}

export function AquaFooter() {
  const ar = useLocale() === "ar";
  const { restaurant, href } = useStorefront();
  return <footer className={styles.footer}><div className={styles.footerTop}><div><p>{restaurant.name}</p><span>{restaurant.description}</span></div><div><Link href={href("/menu")}>{ar ? "القائمة" : "Menu"}</Link><Link href={href("/about")}>{ar ? "عن المطعم" : "About"}</Link><Link href={href("/cart")}>{ar ? "السلة" : "Cart"}</Link></div></div><div className={styles.footerBottom}><span>{restaurant.name}</span><span>Powered by Savora</span></div></footer>;
}


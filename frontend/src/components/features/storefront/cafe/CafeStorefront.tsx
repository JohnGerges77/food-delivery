"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { MenuOrderingPage } from "@/components/features/menu/MenuOrderingPage";
import { publicMoney, safePublicImage } from "@/lib/public-menu-presentation";
import { useCartStore } from "@/store/cart-store";
import { CartAttention } from "../CartAttention";
import type { PublicPage, PublicProduct, PublicRestaurant } from "@/services/public-menu";
import { PublicProductImage } from "../PublicProductImage";
import { ProductImageGallery } from "../ProductImageGallery";
import { useStorefront } from "../StorefrontContext";
import styles from "./CafeStorefront.module.css";

function ProductPhoto({ product, sizes }: { product: PublicProduct; sizes: string }) {
  return <PublicProductImage src={product.imageUrl || product.images[0]} alt={product.name} sizes={sizes} className={styles.photo} />;
}

export function CafeNavbar() {
  const locale = useLocale();
  const t = useTranslations("navigation");
  const pathname = usePathname();
  const { restaurant, href } = useStorefront();
  const tenantSlug = useCartStore((state) => state.tenantSlug);
  const count = useCartStore((state) => state.items.reduce((sum, item) => sum + item.quantity, 0));
  const links = [{ path: "/menu", label: t("menu") }, { path: "/about", label: t("about") }, { path: "/#contact", label: t("contact") }];
  return <header className={styles.nav}>
    <div className={styles.navInner}>
      <Link href={href("/")} className={styles.brand} aria-label={restaurant.name}>{restaurant.logoUrl && <span className="relative me-2 inline-block size-8 align-middle"><PublicProductImage src={restaurant.logoUrl} alt={restaurant.name} className="object-contain" sizes="32px" /></span>}{restaurant.name}</Link>
      <nav aria-label={locale === "ar" ? "التنقل الرئيسي" : "Main navigation"} className={styles.navLinks}>
        {links.map(({ path, label }) => <Link href={href(path)} key={path} aria-current={path.includes("#") ? undefined : pathname === href(path) || pathname.startsWith(`${href(path)}/`) ? "page" : undefined}>{label}</Link>)}
      </nav>
      <div className={styles.navActions}>
        <Link className={styles.locale} href={pathname} locale={locale === "ar" ? "en" : "ar"} aria-label={t("switchLanguage", { language: t(`languages.${locale === "ar" ? "en" : "ar"}`) })}>{locale === "ar" ? "EN" : "عربي"}</Link>
        <Link className={styles.cart} href={href("/cart")} aria-label={`${t("viewCart")}: ${tenantSlug === restaurant.slug ? count : 0}`} aria-current={pathname === href("/cart") || pathname === href("/checkout") ? "page" : undefined}><span>{locale === "ar" ? "السلة" : "Cart"}</span><CartAttention><strong>{tenantSlug === restaurant.slug ? count : 0}</strong></CartAttention></Link>
      </div>
    </div>
  </header>;
}

export function CafeHome({ restaurant, initialProducts }: { restaurant: PublicRestaurant; initialProducts: PublicProduct[] }) {
  const locale = useLocale();
  const ar = locale === "ar";
  const reduced = useReducedMotion();
  const { categories, href } = useStorefront();
  const ordered = [...initialProducts.filter((product) => product.isFeatured), ...initialProducts.filter((product) => !product.isFeatured)];
  const heroProduct = restaurant.heroProductSelected ? restaurant.heroProduct ?? undefined : ordered[0];
  const heroImage = heroProduct && safePublicImage(heroProduct.imageUrl || heroProduct.images[0]);
  const menuPreview = ordered.filter((product) => product.id !== heroProduct?.id).slice(0, 4);
  const heroCategory = categories.find((category) => category.id === heroProduct?.categoryId);
  return <main className={styles.home}>
    <div className={styles.stage}>
      <section className={styles.hero}>
        <motion.div className={styles.heroCopy} initial={reduced ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .55 }}>
        <h1>{restaurant.name}</h1>
        <p>{restaurant.description || (ar ? "تصفّح القائمة واختر ما يناسبك." : "Explore the menu and find something to enjoy.")}</p>
        <Link href={href("/menu")} className={styles.action}>{ar ? "تصفح القائمة" : "Browse menu"}<span aria-hidden="true">↗</span></Link>
        </motion.div>
      </section>
      <div className={styles.stageVisual}>
        <div className={styles.menuSheet}>
          <div className={styles.sheetTop}><span>{restaurant.name}</span><span>{ar ? "القائمة" : "Menu"}</span></div>
          {heroProduct ? <Link href={href(`/menu/${heroProduct.id}`)} className={styles.sheetFeature}>
            {heroImage && <div className={styles.sheetPhoto}><ProductPhoto product={heroProduct} sizes="(min-width: 900px) 38vw, 85vw" /></div>}
            <div className={styles.sheetDetails}>{heroCategory && <span>{heroCategory.name}</span>}<strong>{heroProduct.name}</strong>{heroProduct.description && <p>{heroProduct.description}</p>}<b>{publicMoney(heroProduct.price, restaurant.currency, locale)}</b></div>
          </Link> : <div className={styles.sheetEmpty}>{ar ? "اكتشف القائمة" : "Explore the menu"}</div>}
          <Link href={href("/menu")} className={styles.sheetBottom}>{ar ? "القائمة كاملة" : "View the full menu"}<span aria-hidden="true">↗</span></Link>
        </div>
      </div>
      <div className={styles.stageContent}>
        {categories.length > 0 && <section className={styles.categories}><div className={styles.sectionHeading}><h2>{ar ? "أقسام القائمة" : "Explore the menu"}</h2><Link href={href("/menu")}>{ar ? "القائمة كاملة" : "Full menu"}</Link></div><div className={styles.categoryList}>{categories.map((category) => <Link href={href("/menu")} key={category.id}>{category.name}<span aria-hidden="true">↗</span></Link>)}</div></section>}
        {menuPreview.length > 0 && <section className={styles.menuPreview}><div className={styles.sectionHeading}><h2>{ar ? "من قائمتنا" : "From the menu"}</h2><Link href={href("/menu")}>{ar ? "تصفح كل المنتجات" : "Browse all products"}</Link></div>
          <div className={styles.previewList}>{menuPreview.map((product) => <article className={`${styles.previewItem} relative`} key={product.id}>
            <Link href={href(`/menu/${product.id}`)} className="absolute inset-0 z-10" aria-label={ar ? `تفاصيل ${product.name}` : `Details for ${product.name}`} />
            {safePublicImage(product.imageUrl || product.images[0]) && <div className={styles.previewPhoto}><ProductPhoto product={product} sizes="(min-width: 900px) 8vw, 22vw" /></div>}
            <div className={styles.previewText}><h3>{product.name}</h3>{product.description && <p>{product.description}</p>}</div><strong>{publicMoney(product.price, restaurant.currency, locale)}</strong>
          </article>)}</div>
        </section>}
      </div>
    </div>
    <CafeInfo restaurant={restaurant} />
  </main>;
}

function CafeInfo({ restaurant }: { restaurant: PublicRestaurant }) {
  const ar = useLocale() === "ar";
  const { href } = useStorefront();
  return <section className={styles.info} id="contact"><div><h2>{ar ? "زورنا أو تواصل معنا" : "Visit or get in touch"}</h2><p>{restaurant.description || (ar ? "تعرّف على معلومات المطعم." : "Find the restaurant details here.")}</p><Link href={href("/about")}>{ar ? "عن المطعم" : "About the restaurant"}</Link></div><dl>
    {restaurant.openingHours && <div><dt>{ar ? "ساعات العمل" : "Opening hours"}</dt><dd>{restaurant.openingHours}</dd></div>}
    {restaurant.address && <div><dt>{ar ? "العنوان" : "Address"}</dt><dd>{restaurant.address}</dd></div>}
    {restaurant.phone && <div><dt>{ar ? "الهاتف" : "Phone"}</dt><dd><a href={`tel:${restaurant.phone.replace(/[^+\d]/g, "")}`}>{restaurant.phone}</a></dd></div>}
    {restaurant.contactEmail && <div><dt>{ar ? "البريد الإلكتروني" : "Email"}</dt><dd><a href={`mailto:${restaurant.contactEmail}`}>{restaurant.contactEmail}</a></dd></div>}
    {!restaurant.openingHours && !restaurant.address && !restaurant.phone && !restaurant.contactEmail && <div><dt>{ar ? "التفاصيل" : "Details"}</dt><dd>{ar ? "تفاصيل التواصل غير متاحة حاليًا." : "Contact details are not available yet."}</dd></div>}
  </dl></section>;
}

export function CafeMenu({ initialProducts, initialPagination }: { initialProducts: PublicProduct[]; initialPagination: PublicPage | null }) {
  const ar = useLocale() === "ar";
  const { restaurant } = useStorefront();
  return <div className={styles.menu}><div className={styles.menuIntro}><h1>{ar ? "القائمة" : "The menu"}</h1><p>{restaurant.description || (ar ? "اختر ما يعجبك من القائمة." : "Choose from the menu.")}</p></div><MenuOrderingPage initialProducts={initialProducts} initialPagination={initialPagination} /></div>;
}

export function CafeProduct({ product }: { product: PublicProduct }) {
  const locale = useLocale(); const ar = locale === "ar";
  const { restaurant, categories, href } = useStorefront();
  const add = useCartStore((state) => state.addPublicItem);
  const category = categories.find((entry) => entry.id === product.categoryId);
  return <main className={styles.product}><Link href={href("/menu")} className={styles.back}>{ar ? "العودة للقائمة" : "Back to menu"}</Link><article className={styles.productLayout}><div className={styles.productPhoto}>{safePublicImage(product.imageUrl || product.images[0]) ? <ProductImageGallery product={product} sizes="(min-width: 800px) 50vw, 100vw" className={styles.photo} /> : <div className={styles.productWithoutPhoto}><span>{category?.name || (ar ? "القائمة" : "Menu")}</span><strong>{product.name}</strong><span>{restaurant.name}</span></div>}</div><div className={styles.productCopy}>{category && <p className={styles.categoryName}>{category.name}</p>}<h1>{product.name}</h1>{product.description && <p>{product.description}</p>}<strong>{publicMoney(product.price, restaurant.currency, locale)}</strong>{product.oldPrice !== null && product.oldPrice > product.price && <del>{publicMoney(product.oldPrice, restaurant.currency, locale)}</del>}{product.preparationTime !== null && <span>{ar ? "وقت التحضير" : "Preparation time"}: {product.preparationTime} {ar ? "دقيقة" : "min"}</span>}<button type="button" onClick={() => add(restaurant.slug, product)} className={styles.action}>{ar ? "أضف إلى السلة" : "Add to cart"}</button></div></article></main>;
}

export function CafeAbout() {
  const { restaurant } = useStorefront();
  const ar = useLocale() === "ar";
  return <main className={styles.about}><div className={styles.aboutIntro}><h1>{restaurant.name}</h1><p>{restaurant.description || (ar ? "تعرّف على المطعم وقائمته." : "Explore the restaurant and its menu.")}</p></div><CafeInfo restaurant={restaurant} /></main>;
}

export function CafeFooter() {
  const { restaurant, href } = useStorefront();
  const ar = useLocale() === "ar";
  return <footer className={styles.footer}><div className={styles.footerTop}><strong>{restaurant.name}</strong><nav aria-label={ar ? "روابط التذييل" : "Footer navigation"}><Link href={href("/menu")}>{ar ? "القائمة" : "Menu"}</Link><Link href={href("/about")}>{ar ? "عن المطعم" : "About"}</Link><Link href={href("/#contact")}>{ar ? "تواصل معنا" : "Contact"}</Link></nav></div><div className={styles.footerBottom}><span>© {new Date().getFullYear()} {restaurant.name}</span>{restaurant.address && <span>{restaurant.address}</span>}</div></footer>;
}

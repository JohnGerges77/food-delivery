"use client";
import { ProductPurchase } from "../ProductPurchase";
import { useCartStore } from "@/store/cart-store";


import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { ArrowUpRight, ShoppingBag, Plus } from "lucide-react";
import { MenuOrderingPage } from "@/components/features/menu/MenuOrderingPage";
import { productDisplayPrice, publicMoney, safePublicImage } from "@/lib/public-menu-presentation";
import { CartAttention } from "../CartAttention";
import type { PublicPage, PublicProduct, PublicRestaurant } from "@/services/public-menu";
import { PublicProductImage } from "../PublicProductImage";
import { ProductImageGallery } from "../ProductImageGallery";
import { ProductMetadata } from "../ProductMetadata";
import { useStorefront } from "../StorefrontContext";
import styles from "./LuxuryStorefront.module.css";

function ProductImage({ product, sizes }: { product: PublicProduct; sizes: string }) {
  return <PublicProductImage alt={product.name} src={product.imageUrl || product.images[0]} sizes={sizes} className={styles.image} />;
}

function hasImage(product: PublicProduct) {
  return Boolean(safePublicImage(product.imageUrl || product.images[0]));
}

export function LuxuryNavbar() {
  const { restaurant, href, orderingEnabled } = useStorefront();
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
        {orderingEnabled && <Link href={href("/cart")} className={styles.cartLink} aria-label={`${t("viewCart")}: ${tenantSlug === restaurant.slug ? count : 0}`} aria-current={pathname === href("/cart") || pathname === href("/checkout") ? "page" : undefined}><CartAttention><ShoppingBag size={19} aria-hidden="true" /><span>{tenantSlug === restaurant.slug ? count : 0}</span></CartAttention></Link>}
      </div>
    </div>
  </header>;
}

function FeaturedCard({ product, restaurant, locale }: { product: PublicProduct; restaurant: PublicRestaurant; locale: string }) {
  const { href, categories, orderingEnabled } = useStorefront();
  const router = useRouter();
  const add = useCartStore((state) => state.addPublicItem);
  const ar = locale === "ar";
  return <article className={`${styles.featuredCard} relative`}>
    <Link href={href(`/menu/${product.id}`)} className="absolute inset-0 z-10" aria-label={ar ? `تفاصيل ${product.name}` : `Details for ${product.name}`} />
    <div className={styles.cardVisual}>{hasImage(product) ? <ProductImage product={product} sizes="(min-width: 900px) 28vw, 100vw" /> : <span className={styles.cardNoImage}>{product.name}</span>}</div>
    <div className={styles.cardDetails}><div><h3>{product.name}</h3><p>{categories.find((category) => category.id === product.categoryId)?.name}</p>{product.description && <p>{product.description}</p>}</div><strong>{productDisplayPrice(product, restaurant.currency, locale)}</strong></div>
    {orderingEnabled ? <button type="button" onClick={() => product.variants?.length ? router.push(href(`/menu/${product.id}`)) : add(restaurant.slug, product)} className={`${styles.cardAdd} relative z-20`}><Plus size={17} aria-hidden="true" />{ar ? "أضف إلى السلة" : "Add to cart"}</button> : <Link href={href(`/menu/${product.id}`)} className={`${styles.cardAdd} relative z-20`}>{ar ? "عرض التفاصيل" : "View details"}</Link>}
  </article>;
}

export function LuxuryHome({ restaurant, initialProducts, offers }: { restaurant: PublicRestaurant; initialProducts: PublicProduct[]; offers: PublicProduct[] }) {
  const locale = useLocale();
  const ar = locale === "ar";
  const { categories, href, orderingEnabled } = useStorefront();
  const ordered = [...initialProducts.filter((item) => item.isFeatured), ...initialProducts.filter((item) => !item.isFeatured)];
  const heroProduct = restaurant.heroProductSelected ? restaurant.heroProduct ?? undefined : ordered.find(hasImage) || ordered[0];
  const tenantHeroImage = safePublicImage(restaurant.heroImageUrl);
  const featured = offers.filter((item) => item.isFeatured).slice(0, 5);
  return <main className={styles.home}>
    <section className={styles.hero}>
      <div className={styles.heroCopy}><h1>{restaurant.name}</h1><p>{restaurant.description || (ar ? (orderingEnabled ? "اكتشف أطباق المطعم واطلب ما يعجبك." : "تصفّح قائمة المطعم.") : (orderingEnabled ? "Discover the menu and choose a dish to enjoy." : "Explore the restaurant menu."))}</p><Link href={href("/menu")} className={styles.mainAction}>{ar ? "تصفح المنيو" : "Explore the menu"}<ArrowUpRight size={19} aria-hidden="true" /></Link></div>
      <div className={styles.heroVisual}>
        {tenantHeroImage ? <div className={styles.heroPhoto} data-tenant-hero>
          <PublicProductImage src={tenantHeroImage} alt={restaurant.name} className={styles.image} sizes="(min-width: 900px) 50vw, 100vw" />
        </div> : heroProduct && hasImage(heroProduct) ? <Link href={href(`/menu/${heroProduct.id}`)} className={styles.heroPhoto}><ProductImage product={heroProduct} sizes="(min-width: 900px) 50vw, 100vw" /><span><strong>{heroProduct.name}</strong><small>{productDisplayPrice(heroProduct, restaurant.currency, locale)}</small></span></Link> : <div className={styles.heroNoPhoto}><span>{restaurant.name}</span>{heroProduct && <strong>{heroProduct.name}</strong>}<Link href={href("/menu")}>{ar ? "المنيو كاملة" : "See the menu"}<ArrowUpRight size={18} aria-hidden="true" /></Link></div>}
      </div>
    </section>
    <section className={styles.story}><div className={styles.storyCopy}><h2>{ar ? "عن المطعم" : "At the table"}</h2><p>{restaurant.description || (ar ? "تعرّف على المطعم واستكشف قائمته." : "Get to know the restaurant and explore its menu.")}</p><Link href={href("/about")}>{ar ? "معلومات المطعم" : "About the restaurant"}<ArrowUpRight size={18} aria-hidden="true" /></Link></div><div className={styles.storyVisual}>{ordered.find((item) => item.id !== heroProduct?.id && hasImage(item)) ? <ProductImage product={ordered.find((item) => item.id !== heroProduct?.id && hasImage(item))!} sizes="(min-width: 900px) 40vw, 100vw" /> : <div className={styles.storyText}><span>{restaurant.name}</span><span>{ar ? "المنيو" : "The menu"}</span></div>}</div></section>
    {featured.length > 0 && <section className={styles.featured}><div className={styles.sectionHeading}><h2>{ar ? "العروض" : "Offers"}</h2><Link href={href("/menu")}>{ar ? "جميع الأطباق" : "View all dishes"}<ArrowUpRight size={18} aria-hidden="true" /></Link></div><div className={styles.featuredGrid}>{featured.map((item) => <FeaturedCard key={item.id} product={item} restaurant={restaurant} locale={locale} />)}</div></section>}
    {categories.length > 0 && <section className={styles.categories}><div className={styles.sectionHeading}><h2>{ar ? "استكشف المنيو" : "Find your course"}</h2><Link href={href("/menu")}>{ar ? "المنيو كاملة" : "Full menu"}<ArrowUpRight size={18} aria-hidden="true" /></Link></div><div className={styles.categoryList}>{categories.map((item) => <Link key={item.id} href={href("/menu")}>{item.name}<ArrowUpRight size={22} aria-hidden="true" /></Link>)}</div></section>}
    <LuxuryContact restaurant={restaurant} />
  </main>;
}

function LuxuryContact({ restaurant }: { restaurant: PublicRestaurant }) {
  const ar = useLocale() === "ar";
  const { href, orderingEnabled } = useStorefront();
  return <section className={styles.contact} id="contact"><div><h2>{orderingEnabled ? (ar ? "جاهز تختار طلبك؟" : "Make it yours") : (ar ? "عن المطعم" : "Restaurant information")}</h2><p>{restaurant.description || (ar ? "تصفح المنيو واختر ما يناسبك." : "Browse the menu and choose what suits you.")}</p><Link className={styles.mainAction} href={href("/menu")}>{ar ? "تصفح المنيو" : "Browse the menu"}<ArrowUpRight size={18} aria-hidden="true" /></Link></div><dl>{restaurant.openingHours && <div><dt>{ar ? "ساعات العمل" : "Opening hours"}</dt><dd>{restaurant.openingHours}</dd></div>}{restaurant.address && <div><dt>{ar ? "العنوان" : "Address"}</dt><dd>{restaurant.address}</dd></div>}{restaurant.phone && <div><dt>{ar ? "الهاتف" : "Phone"}</dt><dd><a href={`tel:${restaurant.phone.replace(/[^+\d]/g, "")}`}>{restaurant.phone}</a></dd></div>}{restaurant.contactEmail && <div><dt>{ar ? "البريد الإلكتروني" : "Email"}</dt><dd><a href={`mailto:${restaurant.contactEmail}`}>{restaurant.contactEmail}</a></dd></div>}</dl></section>;
}

export function LuxuryMenu({ initialProducts, initialPagination }: { initialProducts: PublicProduct[]; initialPagination: PublicPage | null }) {
  const ar = useLocale() === "ar";
  const { restaurant } = useStorefront();
  return <div className={styles.menu}><header className={styles.pageIntro}><span>{restaurant.name}</span><h1>{ar ? "المنيو" : "The menu"}</h1><p>{restaurant.description || (ar ? "اختر ما يعجبك من المنيو." : "Choose from the menu.")}</p></header><MenuOrderingPage initialProducts={initialProducts} initialPagination={initialPagination} /></div>;
}

export function LuxuryProduct({ product }: { product: PublicProduct }) {
  const locale = useLocale(); const ar = locale === "ar";
  const { restaurant, categories, href } = useStorefront();
  const category = categories.find((item) => item.id === product.categoryId);
  return <main className={styles.product}><Link href={href("/menu")} className={styles.back}>{ar ? "العودة للمنيو" : "Back to menu"}</Link><article className={styles.productLayout}><div className={styles.productVisual}>{hasImage(product) ? <ProductImageGallery product={product} sizes="(min-width: 900px) 50vw, 100vw" className={styles.image} /> : <div className={styles.productNoImage}><span>{restaurant.name}</span><strong>{product.name}</strong></div>}</div><div className={styles.productCopy}>{category && <span>{category.name}</span>}<h1>{product.name}</h1>{product.description && <p className="whitespace-pre-line">{product.description}</p>}<strong>{productDisplayPrice(product, restaurant.currency, locale)}</strong>{!product.variants?.length && product.oldPrice != null && product.oldPrice > product.price && <del>{publicMoney(product.oldPrice, restaurant.currency, locale)}</del>}<ProductMetadata product={product} locale={locale} /><ProductPurchase product={product} buttonClassName={styles.mainAction} /></div></article></main>;
}

export function LuxuryAbout() {
  const { restaurant } = useStorefront();
  return <main className={styles.about}><LuxuryContact restaurant={restaurant} /></main>;
}

export function LuxuryFooter() {
  const { restaurant, href, orderingEnabled } = useStorefront();
  const ar = useLocale() === "ar";
  return <footer className={styles.footer}><div className={styles.footerTop}><strong>{restaurant.name}</strong><nav aria-label={ar ? "روابط التذييل" : "Footer navigation"}><Link href={href("/")}>{ar ? "الرئيسية" : "Home"}</Link><Link href={href("/menu")}>{ar ? "المنيو" : "Menu"}</Link><Link href={href("/about")}>{ar ? "عن المطعم" : "About"}</Link>{orderingEnabled && <Link href={href("/cart")}>{ar ? "السلة" : "Cart"}</Link>}</nav></div><div className={styles.footerBottom}><span>© {new Date().getFullYear()} {restaurant.name}</span>{restaurant.address && <span>{restaurant.address}</span>}</div></footer>;
}

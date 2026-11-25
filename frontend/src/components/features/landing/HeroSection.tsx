"use client";

import Image from "next/image";
import { useLocale } from "next-intl";
import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { routes } from "@/lib/routes";
import { safePublicImage } from "@/lib/public-menu-presentation";
import type { PublicRestaurant } from "@/services/public-menu";
import { useStorefront } from "@/components/features/storefront/StorefrontContext";
import styles from "./HeroSection.module.css";

const demoPhoto = "/savora-hero-wide.webp";

export function HeroSection({ restaurant }: { restaurant: PublicRestaurant }) {
  const { href } = useStorefront();
  const ar = useLocale() === "ar";
  const [failedPhotos, setFailedPhotos] = useState<string[]>([]);
  const photo = [
    safePublicImage(restaurant.heroImageUrl),
    restaurant.slug === "savora-beta-demo" ? demoPhoto : null,
    safePublicImage(restaurant.heroProduct?.imageUrl || restaurant.heroProduct?.images[0]),
  ].find((url) => url && !failedPhotos.includes(url));
  const delivery = restaurant.deliverySettings.deliveryAvailable;

  return (
    <section className={styles.hero} data-classic-hero data-photo={photo === demoPhoto ? "demo" : photo ? "tenant" : undefined}>
      {photo && <div className={styles.visual} aria-hidden="true">
        <Image key={photo} src={photo} alt="" fill sizes="100vw"
          unoptimized={!photo.startsWith("/") || photo.startsWith("/api/")}
          preload={photo === demoPhoto} onError={() => setFailedPhotos((current) => [...current, photo])}
          loading={photo === demoPhoto ? undefined : "eager"} />
      </div>}
      <div className={styles.inner}>
        <div className={styles.copy}>
          <h1 dir="auto">{restaurant.name}</h1>
          <p className={styles.headline}>{ar ? "من مطبخنا" : "From our kitchen"}</p>
          {restaurant.description?.trim() && <p className={styles.description} dir="auto">{restaurant.description}</p>}
          <div className={styles.actions}>
            <Link className={styles.menu} href={href(routes.menu)}>{ar ? "استعرض المنيو" : "Explore Menu"}</Link>
            <Link className={styles.about} href={href(routes.about)}>{ar ? "من نحن" : "About Us"}</Link>
          </div>
          <dl className={styles.details}>
            <div><dt>{ar ? "العملة" : "Currency"}</dt><dd>{restaurant.currency}</dd></div>
            {restaurant.openingHours?.trim() && <div>
              <dt>{ar ? "ساعات العمل" : "Opening hours"}</dt><dd><bdi>{restaurant.openingHours}</bdi></dd>
            </div>}
            <div><dt>{ar ? "التوصيل" : "Delivery"}</dt><dd>{ar
              ? (delivery ? "متاح" : "غير متاح") : (delivery ? "Available" : "Unavailable")}</dd></div>
          </dl>
        </div>
      </div>
    </section>
  );
}

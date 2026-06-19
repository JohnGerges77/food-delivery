"use client";

import { CheckCircle2, ImageIcon, Save } from "lucide-react";
import { useState } from "react";
import type { Restaurant } from "@/types";
import {
  ActionButton,
  DashboardCard,
  DashboardPageHeader,
  inputClass,
  textareaClass,
} from "./DashboardUI";

export function DashboardSettingsPage({ restaurant }: { restaurant: Restaurant }) {
  const [saved, setSaved] = useState(false);
  const [deliveryAvailable, setDeliveryAvailable] = useState(true);

  function saveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2600);
  }

  return (
    <section>
      <DashboardPageHeader
        eyebrow="Restaurant Control"
        title="Settings"
        description="Maintain storefront profile, delivery rules, hours, social links, and appearance settings locally."
        action={
          saved ? (
            <div className="inline-flex min-h-11 items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-5 text-sm font-semibold text-emerald-200">
              <CheckCircle2 aria-hidden="true" size={16} />
              Settings saved locally
            </div>
          ) : null
        }
      />

      <form className="grid gap-6 xl:grid-cols-[1fr_0.85fr]" onSubmit={saveSettings}>
        <div className="grid gap-6">
          <DashboardCard className="p-5 sm:p-6">
            <h3 className="text-2xl font-semibold">Restaurant Profile</h3>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label>
                <span className="mb-2 block text-xs font-semibold tracking-[0.18em] text-[color:var(--gold)] uppercase">
                  Restaurant Name
                </span>
                <input className={inputClass} defaultValue="Savora" />
              </label>
              <label>
                <span className="mb-2 block text-xs font-semibold tracking-[0.18em] text-[color:var(--gold)] uppercase">
                  Phone
                </span>
                <input className={inputClass} defaultValue="+20 123 456 7890" />
              </label>
              <label>
                <span className="mb-2 block text-xs font-semibold tracking-[0.18em] text-[color:var(--gold)] uppercase">
                  Email
                </span>
                <input className={inputClass} defaultValue="hello@savora.com" type="email" />
              </label>
              <label>
                <span className="mb-2 block text-xs font-semibold tracking-[0.18em] text-[color:var(--gold)] uppercase">
                  Address
                </span>
                <input className={inputClass} defaultValue="Downtown, Cairo, Egypt" />
              </label>
              <label className="sm:col-span-2">
                <span className="mb-2 block text-xs font-semibold tracking-[0.18em] text-[color:var(--gold)] uppercase">
                  Description
                </span>
                <textarea
                  className={textareaClass}
                  defaultValue="A premium restaurant experience built around handcrafted dishes, warm hospitality, and unforgettable flavors."
                />
              </label>
            </div>
          </DashboardCard>

          <DashboardCard className="p-5 sm:p-6">
            <h3 className="text-2xl font-semibold">Opening Hours</h3>
            <div className="mt-5 grid gap-4">
              {[
                ["Monday - Thursday", "10:00 AM - 11:00 PM"],
                ["Friday - Saturday", "10:00 AM - 12:00 AM"],
                ["Sunday", "12:00 PM - 10:00 PM"],
              ].map(([label, value]) => (
                <label className="grid gap-3 sm:grid-cols-[12rem_1fr] sm:items-center" key={label}>
                  <span className="text-sm font-semibold text-[color:var(--text-muted)]">
                    {label}
                  </span>
                  <input className={inputClass} defaultValue={value} />
                </label>
              ))}
            </div>
          </DashboardCard>

          <DashboardCard className="p-5 sm:p-6">
            <h3 className="text-2xl font-semibold">Social Links</h3>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              <label>
                <span className="mb-2 block text-xs font-semibold tracking-[0.18em] text-[color:var(--gold)] uppercase">
                  Facebook
                </span>
                <input
                  className={inputClass}
                  defaultValue={restaurant.socialLinks.facebook ?? "https://facebook.com/savora"}
                />
              </label>
              <label>
                <span className="mb-2 block text-xs font-semibold tracking-[0.18em] text-[color:var(--gold)] uppercase">
                  Instagram
                </span>
                <input
                  className={inputClass}
                  defaultValue={restaurant.socialLinks.instagram ?? "https://instagram.com/savora"}
                />
              </label>
              <label>
                <span className="mb-2 block text-xs font-semibold tracking-[0.18em] text-[color:var(--gold)] uppercase">
                  WhatsApp
                </span>
                <input
                  className={inputClass}
                  defaultValue={restaurant.socialLinks.whatsapp ?? "https://wa.me/201234567890"}
                />
              </label>
            </div>
          </DashboardCard>
        </div>

        <div className="grid gap-6">
          <DashboardCard className="p-5 sm:p-6">
            <h3 className="text-2xl font-semibold">Delivery Settings</h3>
            <div className="mt-5 grid gap-4">
              <label>
                <span className="mb-2 block text-xs font-semibold tracking-[0.18em] text-[color:var(--gold)] uppercase">
                  Delivery Fee
                </span>
                <input className={inputClass} defaultValue={restaurant.deliveryFee} type="number" />
              </label>
              <label>
                <span className="mb-2 block text-xs font-semibold tracking-[0.18em] text-[color:var(--gold)] uppercase">
                  Minimum Order
                </span>
                <input className={inputClass} defaultValue={restaurant.minimumOrder} type="number" />
              </label>
              <label>
                <span className="mb-2 block text-xs font-semibold tracking-[0.18em] text-[color:var(--gold)] uppercase">
                  Estimated Delivery Time
                </span>
                <input className={inputClass} defaultValue="35 - 45 minutes" />
              </label>
              <label className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                <span>
                  <span className="block font-semibold">Delivery Available</span>
                  <span className="text-sm text-[color:var(--text-muted)]">
                    Toggle visual state only.
                  </span>
                </span>
                <button
                  className={`relative h-8 w-14 rounded-full transition-colors ${
                    deliveryAvailable ? "bg-[color:var(--primary)]" : "bg-white/15"
                  }`}
                  onClick={() => setDeliveryAvailable((value) => !value)}
                  type="button"
                >
                  <span
                    className={`absolute top-1 size-6 rounded-full bg-[color:var(--background)] transition-transform ${
                      deliveryAvailable ? "translate-x-7" : "translate-x-1"
                    }`}
                  />
                </button>
              </label>
            </div>
          </DashboardCard>

          <DashboardCard className="p-5 sm:p-6">
            <h3 className="text-2xl font-semibold">Appearance</h3>
            <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.035] p-5 text-center">
              <div className="mx-auto flex size-20 items-center justify-center rounded-3xl border border-[color:var(--primary)]/30 bg-[color:var(--primary)]/12 text-[color:var(--primary-light)]">
                <ImageIcon aria-hidden="true" size={30} />
              </div>
              <div className="mt-4 text-2xl font-semibold tracking-[0.16em]">SAVORA</div>
              <p className="mt-2 text-sm text-[color:var(--text-muted)]">
                Logo preview and brand signal.
              </p>
            </div>
            <div className="mt-5 grid gap-4">
              <label>
                <span className="mb-2 block text-xs font-semibold tracking-[0.18em] text-[color:var(--gold)] uppercase">
                  Brand Name
                </span>
                <input className={inputClass} defaultValue="Savora" />
              </label>
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                <div className="text-xs font-semibold tracking-[0.18em] text-[color:var(--gold)] uppercase">
                  Primary Color Preview
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <span className="size-10 rounded-full bg-[color:var(--primary)] shadow-[0_0_28px_rgba(255,122,0,0.36)]" />
                  <span className="text-sm text-[color:var(--text-muted)]">
                    var(--primary)
                  </span>
                </div>
              </div>
            </div>
          </DashboardCard>

          <ActionButton className="min-h-14 w-full" type="submit">
            <Save aria-hidden="true" size={17} />
            Save Settings
          </ActionButton>
        </div>
      </form>
    </section>
  );
}

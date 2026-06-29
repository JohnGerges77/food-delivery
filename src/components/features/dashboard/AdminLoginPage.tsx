"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  Activity,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  MenuSquare,
  ShieldCheck,
  ShoppingBag,
} from "lucide-react";
import Image from "next/image";
import { FormEvent, useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { routes } from "@/lib/routes";
import { ThemeToggle } from "@/components/common/ThemeToggle";

const features = [
  { label: "Manage Orders", icon: ShoppingBag },
  { label: "Update Menu Items", icon: MenuSquare },
  { label: "Track Restaurant Activity", icon: Activity },
];

const stats = [
  { value: "5000+", label: "Orders Processed" },
  { value: "50+", label: "Menu Items" },
  { value: "4.9★", label: "Restaurant Rating" },
];

const particles = [
  "left-[8%] top-[14%] size-1.5",
  "left-[18%] top-[73%] size-1",
  "right-[13%] top-[21%] size-2",
  "right-[24%] bottom-[17%] size-1.5",
  "left-[46%] top-[10%] size-1",
  "right-[43%] bottom-[8%] size-1",
];

const formItem = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

export function AdminLoginPage() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [showPassword, setShowPassword] = useState(false);

  function enterDashboard(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    router.push(routes.dashboard);
  }

  return (
    <motion.main
      animate={{ opacity: 1 }}
      className="relative isolate min-h-screen overflow-hidden bg-[color:var(--background)] text-[color:var(--text)]"
      initial={reduceMotion ? false : { opacity: 0 }}
      transition={{ duration: 0.7 }}
    >
      <ThemeToggle className="absolute right-4 top-4 z-40 sm:right-6 sm:top-6" />
      <div className="absolute inset-0 -z-30 bg-[radial-gradient(circle_at_18%_22%,rgba(255,122,0,0.17),transparent_28%),radial-gradient(circle_at_88%_78%,rgba(212,160,23,0.1),transparent_28%),var(--page-gradient)]" />
      <div className="absolute inset-0 -z-20 opacity-[0.035] [background-image:linear-gradient(rgba(255,255,255,.8)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.8)_1px,transparent_1px)] [background-size:56px_56px]" />
      <motion.div
        animate={reduceMotion ? undefined : { opacity: [0.2, 0.5, 0.2], scale: [0.9, 1.12, 0.9] }}
        className="absolute -left-40 top-[-8rem] -z-10 size-[34rem] rounded-full bg-[color:var(--primary)]/15 blur-[110px]"
        transition={reduceMotion ? undefined : { duration: 6, ease: "easeInOut", repeat: Infinity }}
      />
      <div className="absolute -bottom-64 -right-52 -z-10 size-[38rem] rounded-full bg-[color:var(--gold)]/10 blur-[130px]" />

      {particles.map((className, index) => (
        <motion.span
          animate={reduceMotion ? undefined : { opacity: [0.15, 0.8, 0.15], y: [0, -24, 0] }}
          className={`absolute hidden rounded-full bg-[color:var(--primary-light)] shadow-[0_0_18px_rgba(255,157,51,0.9)] lg:block ${className}`}
          key={className}
          transition={reduceMotion ? undefined : { delay: index * 0.45, duration: 3.6 + index * 0.25, repeat: Infinity }}
        />
      ))}

      <div className="mx-auto grid min-h-screen w-full max-w-[1600px] lg:grid-cols-[1.08fr_0.92fr]">
        <motion.section
          animate={{ opacity: 1, x: 0 }}
          className="relative hidden min-h-screen flex-col justify-between overflow-hidden border-r border-white/10 px-10 py-12 lg:flex xl:px-20 xl:py-16"
          initial={reduceMotion ? false : { opacity: 0, x: -44 }}
          transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(145deg,rgba(255,122,0,0.08),transparent_42%),linear-gradient(180deg,rgba(255,255,255,0.025),transparent)]" />
          <div className="absolute -right-36 top-[18%] -z-10 size-80 rounded-full border border-[color:var(--primary)]/15 shadow-[0_0_100px_rgba(255,122,0,0.12)]" />
          <div className="absolute -right-20 top-[23%] -z-10 size-52 rounded-full border border-dashed border-[color:var(--gold)]/20" />

          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[color:var(--primary)]/30 bg-[color:var(--primary)]/10 px-4 py-2 text-[0.68rem] font-bold tracking-[0.24em] text-[color:var(--primary-light)] uppercase shadow-[0_0_32px_rgba(255,122,0,0.12)]">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-[color:var(--primary-light)] opacity-70" />
              <span className="relative inline-flex size-2 rounded-full bg-[color:var(--primary)]" />
            </span>
            Savora Admin Portal
          </div>

          <div className="my-auto max-w-2xl py-14">
            <p className="mb-5 text-xs font-semibold tracking-[0.28em] text-[color:var(--gold)] uppercase">
              Restaurant operations, refined
            </p>
            <h1 className="max-w-xl text-5xl leading-[1.02] font-semibold tracking-[-0.04em] text-balance xl:text-7xl">
              Manage Your Restaurant
              <span className="mt-2 block bg-gradient-to-r from-[color:var(--primary-light)] via-[#ffc06f] to-[color:var(--gold)] bg-clip-text text-transparent">
                With Confidence
              </span>
            </h1>
            <p className="mt-7 max-w-xl text-base leading-8 text-[color:var(--text-muted)] xl:text-lg">
              Monitor orders, manage products, update menus, and keep your restaurant running smoothly from one powerful dashboard.
            </p>

            <div className="mt-9 grid gap-3">
              {features.map(({ label, icon: Icon }, index) => (
                <motion.div
                  animate={{ opacity: 1, x: 0 }}
                  className="group flex w-fit items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.035] px-4 py-3 text-sm font-medium backdrop-blur-sm transition-colors hover:border-[color:var(--primary)]/30 hover:bg-[color:var(--primary)]/[0.07]"
                  initial={reduceMotion ? false : { opacity: 0, x: -20 }}
                  key={label}
                  transition={{ delay: 0.35 + index * 0.1, duration: 0.55 }}
                >
                  <span className="grid size-8 place-items-center rounded-xl bg-[color:var(--primary)]/12 text-[color:var(--primary-light)]">
                    <Icon aria-hidden="true" size={16} />
                  </span>
                  {label}
                  <Check aria-hidden="true" className="ml-2 text-[color:var(--primary)]" size={15} />
                </motion.div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035] backdrop-blur-xl">
            {stats.map((stat) => (
              <div className="border-r border-white/10 px-4 py-5 last:border-0 xl:px-6" key={stat.label}>
                <div className="text-2xl font-semibold text-[color:var(--text)] xl:text-3xl">{stat.value}</div>
                <div className="mt-1.5 text-[0.62rem] font-semibold tracking-[0.13em] text-[color:var(--text-muted)] uppercase xl:text-[0.68rem]">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        <section className="flex min-h-screen items-center justify-center px-4 py-8 sm:px-8 lg:px-10 xl:px-16">
          <motion.div
            animate={{ opacity: 1, x: 0, y: 0 }}
            className="relative w-full max-w-[34rem] overflow-hidden rounded-[2rem] border border-white/[0.12] bg-[linear-gradient(145deg,rgba(255,255,255,0.085),rgba(255,255,255,0.025))] p-6 shadow-[0_34px_100px_rgba(0,0,0,0.58),0_0_70px_rgba(255,122,0,0.10)] backdrop-blur-2xl sm:p-9 xl:p-11"
            initial={reduceMotion ? false : { opacity: 0, x: 46, y: 10 }}
            transition={{ delay: 0.12, duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-[color:var(--primary-light)]/70 to-transparent" />
            <div className="pointer-events-none absolute -right-16 -top-20 size-48 rounded-full bg-[color:var(--primary)]/12 blur-3xl" />

            <motion.form
              animate="visible"
              className="relative"
              initial="hidden"
              onSubmit={enterDashboard}
              transition={{ staggerChildren: 0.08, delayChildren: 0.28 }}
              variants={{ hidden: {}, visible: {} }}
            >
              <motion.div className="flex items-start justify-between gap-4" variants={formItem}>
                <div className="relative h-20 w-36 overflow-hidden rounded-xl bg-black/30">
                  <Image alt="Savora" className="scale-[1.72] object-cover object-[50%_46%]" fill sizes="144px" src="/logo.webp" />
                </div>
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/[0.07] px-3 py-2 text-[0.62rem] font-bold tracking-[0.16em] text-emerald-300 uppercase">
                  <ShieldCheck aria-hidden="true" size={13} />
                  Secure Access
                </span>
              </motion.div>

              <motion.div className="mt-7" variants={formItem}>
                <h2 className="text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">Welcome Back</h2>
                <p className="mt-3 text-sm leading-6 text-[color:var(--text-muted)] sm:text-base">
                  Sign in to access your restaurant dashboard.
                </p>
              </motion.div>

              <motion.div className="mt-8" variants={formItem}>
                <label className="mb-2.5 block text-xs font-semibold tracking-[0.14em] text-[color:var(--text-muted)] uppercase" htmlFor="admin-email">Email</label>
                <div className="group relative">
                  <Mail aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 text-[color:var(--text-muted)] transition-colors group-focus-within:text-[color:var(--primary-light)]" size={18} />
                  <input className="h-14 w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--glass)] pl-12 pr-4 text-sm text-[color:var(--text)] outline-none transition-all placeholder:text-[color:var(--text-muted)]/50 hover:border-[color:var(--primary)]/30 focus:border-[color:var(--primary)]/55 focus:bg-[color:var(--glass-strong)] focus:shadow-[0_0_0_4px_rgba(255,122,0,0.08),0_10px_35px_rgba(0,0,0,0.12)]" id="admin-email" name="email" placeholder="admin@savora.com" type="email" autoComplete="email" required />
                </div>
              </motion.div>

              <motion.div className="mt-5" variants={formItem}>
                <label className="mb-2.5 block text-xs font-semibold tracking-[0.14em] text-[color:var(--text-muted)] uppercase" htmlFor="admin-password">Password</label>
                <div className="group relative">
                  <LockKeyhole aria-hidden="true" className="absolute left-4 top-1/2 -translate-y-1/2 text-[color:var(--text-muted)] transition-colors group-focus-within:text-[color:var(--primary-light)]" size={18} />
                  <input className="h-14 w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--glass)] pl-12 pr-12 text-sm text-[color:var(--text)] outline-none transition-all placeholder:text-[color:var(--text-muted)]/50 hover:border-[color:var(--primary)]/30 focus:border-[color:var(--primary)]/55 focus:bg-[color:var(--glass-strong)] focus:shadow-[0_0_0_4px_rgba(255,122,0,0.08),0_10px_35px_rgba(0,0,0,0.12)]" id="admin-password" name="password" placeholder="Enter your password" type={showPassword ? "text" : "password"} autoComplete="current-password" required />
                  <button aria-label={showPassword ? "Hide password" : "Show password"} className="absolute right-3 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-xl text-[color:var(--text-muted)] transition-colors hover:bg-white/[0.06] hover:text-white" onClick={() => setShowPassword((visible) => !visible)} type="button">
                    {showPassword ? <EyeOff aria-hidden="true" size={17} /> : <Eye aria-hidden="true" size={17} />}
                  </button>
                </div>
              </motion.div>

              <motion.div className="mt-5 flex items-center justify-between gap-4 text-sm" variants={formItem}>
                <label className="group flex cursor-pointer items-center gap-2.5 text-[color:var(--text-muted)] transition-colors hover:text-white">
                  <input className="size-4 accent-[color:var(--primary)]" name="remember" type="checkbox" />
                  Remember me
                </label>
                <Link className="font-semibold text-[color:var(--primary-light)] transition-all hover:text-white hover:underline hover:underline-offset-4" href="#">Forgot Password?</Link>
              </motion.div>

              <motion.button className="group mt-7 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[color:var(--primary)] to-[color:var(--primary-light)] text-sm font-bold tracking-[0.04em] text-[color:var(--background)] shadow-[0_18px_46px_rgba(255,122,0,0.3)] transition-shadow hover:shadow-[0_22px_58px_rgba(255,122,0,0.48)]" type="submit" variants={formItem} whileHover={reduceMotion ? undefined : { y: -3, scale: 1.01 }} whileTap={reduceMotion ? undefined : { scale: 0.985 }}>
                Login
                <ArrowRight aria-hidden="true" className="transition-transform group-hover:translate-x-1" size={18} />
              </motion.button>

              <motion.div className="my-7 flex items-center gap-4" variants={formItem}>
                <span className="h-px flex-1 bg-gradient-to-r from-transparent to-white/15" />
                <span className="text-[0.65rem] font-bold tracking-[0.22em] text-white/35">OR</span>
                <span className="h-px flex-1 bg-gradient-to-l from-transparent to-white/15" />
              </motion.div>

              <motion.button className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-white/12 bg-white/[0.04] text-sm font-semibold text-[color:var(--text)] transition-colors hover:border-[color:var(--primary)]/35 hover:bg-[color:var(--primary)]/[0.07]" onClick={() => router.push(routes.dashboard)} type="button" variants={formItem} whileHover={reduceMotion ? undefined : { y: -2 }} whileTap={reduceMotion ? undefined : { scale: 0.99 }}>
                <ShieldCheck aria-hidden="true" className="text-[color:var(--primary-light)]" size={18} />
                Login as Demo Admin
              </motion.button>

              <motion.p className="mt-7 text-center text-xs leading-5 text-[color:var(--text-muted)]/60" variants={formItem}>
                Protected by Savora secure administration services.
              </motion.p>
            </motion.form>
          </motion.div>
        </section>
      </div>
    </motion.main>
  );
}

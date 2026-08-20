"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAVIGATION_ITEMS = [
  { href: "/", label: "Descubrir", icon: DiscoverIcon },
  { href: "/liked", label: "Me gusta", icon: HeartIcon },
  { href: "/ai", label: "IA", icon: SparkIcon },
  { href: "/profile", label: "Perfil", icon: ProfileIcon },
] as const;

interface NavigationIconProps {
  className?: string;
}

function DiscoverIcon({ className }: NavigationIconProps) {
  return (
    <svg
      className={className}
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle cx="12" cy="12" r="7.5" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="m14.8 9.2-1.7 3.9-3.9 1.7 1.7-3.9 3.9-1.7Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HeartIcon({ className }: NavigationIconProps) {
  return (
    <svg
      className={className}
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d="M20.4 8.8c0 4.6-8.4 9.2-8.4 9.2S3.6 13.4 3.6 8.8A4.3 4.3 0 0 1 12 6.6a4.3 4.3 0 0 1 8.4 2.2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SparkIcon({ className }: NavigationIconProps) {
  return (
    <svg
      className={className}
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d="m12 3 1.3 5.7L19 10l-5.7 1.3L12 17l-1.3-5.7L5 10l5.7-1.3L12 3Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="m18.5 16 .5 2.1 2.1.5-2.1.5-.5 2.1-.5-2.1-2.1-.5 2.1-.5.5-2.1Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ProfileIcon({ className }: NavigationIconProps) {
  return (
    <svg
      className={className}
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M5.5 20c.7-3.1 3.1-5 6.5-5s5.8 1.9 6.5 5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function isActivePath(pathname: string, href: string) {
  return href === "/"
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}

function NavigationItem({
  href,
  label,
  icon: Icon,
  pathname,
}: (typeof NAVIGATION_ITEMS)[number] & { pathname: string }) {
  const active = isActivePath(pathname, href);
  const itemClasses = [
    "desktop-navigation-item group relative flex min-h-11 min-w-11 items-center justify-center rounded-full px-3 text-muted transition-[background-color,color,transform] duration-ui ease-ui focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-safe:active:scale-[0.97]",
    active
      ? "bg-primary text-primary-foreground ring-2 ring-primary/40"
      : "hover:bg-primary hover:text-primary-foreground hover:ring-2 hover:ring-primary/40 focus-visible:bg-primary focus-visible:text-primary-foreground",
  ].join(" ");

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      data-active={active ? "true" : undefined}
      className={itemClasses}
    >
      <span className="desktop-navigation-label pointer-events-none absolute inset-y-0 left-0 z-0 flex items-center whitespace-nowrap rounded-full bg-primary pl-12 pr-3 text-sm font-medium text-primary-foreground shadow-primary">
        {label}
      </span>
      <Icon className="relative z-10 size-5 shrink-0" />
    </Link>
  );
}

export function FloatingNavigation() {
  const pathname = usePathname();

  return (
    <nav aria-label="Navegación principal">
      <div className="fixed left-6 top-1/2 z-20 hidden -translate-y-1/2 md:block">
        <div className="flex w-14 flex-col items-center gap-1 rounded-full border border-border bg-surface/95 p-1.5 shadow-floating">
          {NAVIGATION_ITEMS.map((item) => (
            <NavigationItem key={item.href} {...item} pathname={pathname} />
          ))}
        </div>
      </div>
      <div className="fixed inset-x-3 bottom-3 z-20 flex items-center justify-around gap-1 rounded-xl border border-border bg-surface/95 px-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))] pt-1.5 shadow-floating md:hidden">
        {NAVIGATION_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActivePath(pathname, href);

          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              data-active={active ? "true" : undefined}
              className={`flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-1 rounded-full px-1 text-[0.6875rem] font-medium leading-none transition-[background-color,color,box-shadow] duration-ui ease-ui focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${active ? "bg-primary text-primary-foreground ring-2 ring-primary/40" : "text-muted hover:bg-secondary hover:text-foreground focus-visible:bg-secondary focus-visible:text-foreground"}`}
            >
              <Icon className="size-5 shrink-0" />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

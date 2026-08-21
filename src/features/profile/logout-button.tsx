"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { BUTTON_VARIANT, Button } from "@/components/ui/button";
import { logoutRequest } from "@/features/auth/http-auth-service";

export function LogoutButton() {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogout(): Promise<void> {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);
    setError(null);

    try {
      await logoutRequest();
    } catch {
      setError("No pudimos cerrar tu sesión. Intenta de nuevo.");
      setIsSigningOut(false);
      return;
    }

    // refresh() drops the cached Server Component payload rendered for the
    // signed-in user; without it the profile would flash stale data on return.
    router.replace("/login");
    router.refresh();
  }

  return (
    <>
      <Button
        className="mt-4 min-h-[4.375rem] w-full justify-start rounded-lg bg-surface-elevated px-5 text-base"
        disabled={isSigningOut}
        onClick={handleLogout}
        type="button"
        variant={BUTTON_VARIANT.OUTLINE}
      >
        {isSigningOut ? "Cerrando sesión…" : "Cerrar sesión"}
      </Button>
      {error ? (
        <p className="mt-2 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}

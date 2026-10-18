"use client";
import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button onClick={() => signOut({ callbackUrl: "/" })} className="text-muted hover:text-fg">
      Sign out
    </button>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { TwoFactorSetup } from "@/components/auth/two-factor-setup";

export function SetupTwoFactorClient() {
  const router = useRouter();
  return (
    <TwoFactorSetup
      onDone={() => {
        router.replace("/admin");
        router.refresh();
      }}
    />
  );
}

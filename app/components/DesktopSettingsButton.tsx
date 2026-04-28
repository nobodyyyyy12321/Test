"use client";

import { useSession } from "next-auth/react";
import SettingsMenu from "./SettingsMenu";

export default function DesktopSettingsButton() {
  const { data: session } = useSession();
  if (!session?.user) return null;
  return (
    <div className="flex items-center justify-center w-12 h-12 rounded-xl transition-colors hover:bg-zinc-200 dark:hover:bg-zinc-700">
      <SettingsMenu />
    </div>
  );
}

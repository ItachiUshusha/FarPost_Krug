import type { Metadata } from "next";
import { Suspense } from "react";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import { KrugTheme } from "@/theme/provider";
import { KrugApplication } from "@/components/krug/application";
import "../styles/studio-scoped.css";
import "../styles/framework7-scoped.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Круг — вещи идут по кругу",
  description: "Обменивайтесь вещами во Владивостоке. Находим круги обмена для двух, трёх и четырёх участников.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru">
      <body><AppRouterCacheProvider><KrugTheme><Suspense fallback={<div className="app-loading">Круг · соединяем вещи и людей…</div>}><KrugApplication>{children}</KrugApplication></Suspense></KrugTheme></AppRouterCacheProvider></body>
    </html>
  );
}

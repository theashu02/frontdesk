import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/lib/Provider";

export const metadata: Metadata = {
  title: "Ai voice",
  description: "This is voice agent with the human intervention when ai agent not know the answer.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-background text-foreground antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}

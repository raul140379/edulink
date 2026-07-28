import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ConfirmProvider from "@/components/ui/ConfirmProvider";
import ToastProvider from "@/components/ui/ToastProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "EduLink — U.E. Naciones Unidas",
  description: "Sistema de Gestión para Junta Escolar — U.E. Naciones Unidas El Torno",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <meta name="application-name" content="EduLink NNUU" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="EduLink NNUU" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#0A5A45" />
        <link rel="manifest" href="/manifest.json" id="pwa-manifest" />
        <link rel="apple-touch-icon" href="/logo-nnuu.jpeg" />
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            var path = window.location.pathname;
            var manifest = '/manifest.json';
            if (path.startsWith('/dashboard/portero')) manifest = '/manifest-portero.json';
            else if (path.startsWith('/dashboard/plantel-docente')) manifest = '/manifest-teacher.json';
            else if (path.startsWith('/dashboard/padres')) manifest = '/manifest-parent.json';
            else if (path.startsWith('/dashboard/estudiantes')) manifest = '/manifest-student.json';
            var el = document.getElementById('pwa-manifest');
            if (el) el.setAttribute('href', manifest);
          })();
        `}} />
      </head>
      <body className="min-h-full flex flex-col">
        <ToastProvider>
          <ConfirmProvider>{children}</ConfirmProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
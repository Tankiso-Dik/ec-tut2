import "./globals.css";

export const metadata = {
  title: "Electronic Campus",
  description: "Next.js port of Electronic Campus snapshot"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PermitEarly — Get there first.",
  description:
    "Daily permit alerts for Orlando contractors. Know who just pulled a permit before anyone else does.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  ClerkProvider,
  OrganizationSwitcher,
  SignInButton,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";

export const metadata: Metadata = {
  title: "Prospector AI - Contact Assistant",
  description: "AI-powered contact prospecting and analysis for Wedi Pay",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>
          <TooltipProvider>
            <div className="min-h-screen flex flex-col">
              {/* Header with Auth Controls */}
              <header className="border-b bg-background">
                <div className="container mx-auto px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <h1 className="text-lg font-semibold">Prospector AI</h1>
                    {/* Organization Switcher - only show when signed in */}
                    <SignedIn>
                      <OrganizationSwitcher
                        appearance={{
                          elements: {
                            rootBox: "flex items-center",
                          },
                        }}
                      />
                    </SignedIn>
                  </div>

                  <div className="flex items-center gap-3">
                    <SignedOut>
                      <SignInButton mode="modal">
                        <button className="px-4 py-2 text-sm font-medium text-primary hover:bg-accent rounded-md transition-colors">
                          Sign In
                        </button>
                      </SignInButton>
                    </SignedOut>
                    <SignedIn>
                      <UserButton
                        appearance={{
                          elements: {
                            avatarBox: "w-9 h-9",
                          },
                        }}
                      />
                    </SignedIn>
                  </div>
                </div>
              </header>

              {/* Main Content */}
              <main className="flex-1">{children}</main>
            </div>
          </TooltipProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}

import { Assistant } from "./assistant";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function Home() {
  // 🔒 SECURITY: Verify authentication and organization context
  const { userId, orgId } = await auth();

  // Middleware already handles authentication, but double-check here
  if (!userId) {
    redirect("/sign-in");
  }

  // If user doesn't have an organization, show a message
  if (!orgId) {
    return (
      <main className="flex min-h-screen flex-col">
        <div className="bg-primary text-white py-6 px-8 shadow-md">
          <h1 className="text-3xl font-bold">Prospector AI</h1>
          <p className="text-sm mt-1 opacity-90">
            Your intelligent assistant for contact prospecting and analysis
          </p>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-md text-center space-y-4">
            <div className="text-6xl mb-4">🏢</div>
            <h2 className="text-2xl font-semibold">Organization Required</h2>
            <p className="text-muted-foreground">
              To use Prospector AI, you need to be part of an organization.
              Please create or join an organization using the organization
              switcher in the header.
            </p>
            <div className="pt-4">
              <div className="text-sm text-muted-foreground">
                Look for the organization switcher in the top navigation bar ↗️
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // User is authenticated and has organization context - show the assistant
  return (
    <main className="flex min-h-screen flex-col">
      <div className="bg-primary text-white py-6 px-8 shadow-md">
        <h1 className="text-3xl font-bold">Prospector AI</h1>
        <p className="text-sm mt-1 opacity-90">
          Your intelligent assistant for contact prospecting and analysis
        </p>
      </div>
      <Assistant />
    </main>
  );
}

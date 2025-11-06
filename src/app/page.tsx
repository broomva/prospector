import { Assistant } from "./assistant";

export default function Home() {
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

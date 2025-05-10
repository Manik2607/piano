import Piano from "@/components/Piano";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-100">
      <main className="container mx-auto py-12">
        <h1 className="text-4xl text-black font-bold text-center mb-8">
          Virtual Piano
        </h1>
        <div className="flex justify-center">
          <Piano />
        </div>
      </main>
    </div>
  );
}

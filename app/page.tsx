import { TopBar } from "@/components/TopBar";
import { RequestForm } from "@/components/RequestForm";

export const maxDuration = 60;

export default async function Home({ searchParams }: { searchParams: Promise<{ submitted?: string }> }) {
  const params = await searchParams;

  return (
    <>
      <TopBar />
      <main>
        <RequestForm submitted={params.submitted === "1"} />
      </main>
    </>
  );
}

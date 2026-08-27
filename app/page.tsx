import { TopBar } from "@/components/TopBar";
import { RequestForm } from "@/components/RequestForm";

export const maxDuration = 60;

export default async function Home({ searchParams }: { searchParams: Promise<{ submitted?: string; job?: string; token?: string; error?: string }> }) {
  const params = await searchParams;

  return (
    <>
      <TopBar />
      <main>
        <RequestForm submitted={params.submitted === "1"} jobId={params.job} token={params.token} error={params.error} />
      </main>
    </>
  );
}

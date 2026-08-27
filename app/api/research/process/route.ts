import { NextRequest, NextResponse } from "next/server";
import { claimNextResearchJob, completeResearchJob, failResearchJob } from "@/lib/db";
import { runResearchForSubmission } from "@/lib/research-job";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function isAuthorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();

  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }

  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function processResearchJob(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const job = await claimNextResearchJob();

  if (!job) {
    return NextResponse.json({ processed: false, reason: "No queued research jobs." });
  }

  try {
    await runResearchForSubmission(job.submission_id);
    await completeResearchJob(job.id);

    return NextResponse.json({
      processed: true,
      job_id: job.id,
      submission_id: job.submission_id,
      attempts: job.attempts
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Research job failed.";
    await failResearchJob(job.id, message);

    console.error(
      JSON.stringify({
        message: "research_worker_failed",
        job_id: job.id,
        submission_id: job.submission_id,
        error: message
      })
    );

    return NextResponse.json(
      {
        processed: false,
        job_id: job.id,
        submission_id: job.submission_id,
        error: message
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return processResearchJob(request);
}

export async function POST(request: NextRequest) {
  return processResearchJob(request);
}

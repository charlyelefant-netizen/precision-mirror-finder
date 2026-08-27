import { NextRequest, NextResponse } from "next/server";
import { hasAdminSession } from "@/lib/auth";
import { claimNextResearchJob, claimResearchJobForSubmission, completeResearchJob, failResearchJob } from "@/lib/db";
import { runResearchForSubmission } from "@/lib/research-job";
import { isValidResearchToken } from "@/lib/research-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function getAuthorizedSubmissionId(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  const jobId = Number(request.nextUrl.searchParams.get("job") || "");
  const token = request.nextUrl.searchParams.get("token") || "";

  if (Number.isInteger(jobId) && jobId > 0 && isValidResearchToken(jobId, token)) {
    return jobId;
  }

  if (secret && request.headers.get("authorization") === `Bearer ${secret}`) {
    return null;
  }

  if (await hasAdminSession()) {
    return null;
  }

  if (!secret && process.env.NODE_ENV !== "production") {
    return null;
  }

  return false;
}

async function processResearchJob(request: NextRequest) {
  const authorizedSubmissionId = await getAuthorizedSubmissionId(request);

  if (authorizedSubmissionId === false) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const job = authorizedSubmissionId
    ? await claimResearchJobForSubmission(authorizedSubmissionId)
    : await claimNextResearchJob();

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

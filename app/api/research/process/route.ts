import { NextRequest, NextResponse } from "next/server";
import { hasAdminSession } from "@/lib/auth";
import { claimNextResearchJob, claimResearchJobForSubmission, completeResearchJob, failResearchJob } from "@/lib/db";
import { runResearchForSubmission } from "@/lib/research-job";
import { isValidResearchToken } from "@/lib/research-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

async function getAuthorization(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  const jobId = Number(request.nextUrl.searchParams.get("job") || "");
  const token = request.nextUrl.searchParams.get("token") || "";
  const force = request.nextUrl.searchParams.get("force") === "1";

  if (Number.isInteger(jobId) && jobId > 0 && isValidResearchToken(jobId, token)) {
    return { authorized: true, submissionId: jobId, force: false };
  }

  if (secret && request.headers.get("authorization") === `Bearer ${secret}`) {
    return { authorized: true, submissionId: Number.isInteger(jobId) && jobId > 0 ? jobId : null, force };
  }

  if (await hasAdminSession()) {
    return { authorized: true, submissionId: Number.isInteger(jobId) && jobId > 0 ? jobId : null, force };
  }

  if (!secret && process.env.NODE_ENV !== "production") {
    return { authorized: true, submissionId: Number.isInteger(jobId) && jobId > 0 ? jobId : null, force };
  }

  return { authorized: false, submissionId: null, force: false };
}

async function processResearchJob(request: NextRequest) {
  const authorization = await getAuthorization(request);

  if (!authorization.authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const job = authorization.submissionId
    ? await claimResearchJobForSubmission(authorization.submissionId, authorization.force)
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

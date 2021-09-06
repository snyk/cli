import { Octokit } from '@octokit/rest';
import { IncomingWebhook } from '@slack/webhook';
import { IncomingWebhookDefaultArguments } from '@slack/webhook';
import { event } from '@pagerduty/pdjs';

if (
  !process.env.USER_GITHUB_TOKEN ||
  !process.env.SLACK_WEBHOOK_URL ||
  !process.env.PD_ROUTING_KEY
) {
  console.error(
    'Missing USER_GITHUB_TOKEN, SLACK_WEBHOOK_URL or PD_ROUTING_KEY',
  );
  process.exit(1);
}

const GITHUB_TOKEN = process.env.USER_GITHUB_TOKEN;
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
const PD_ROUTING_KEY = process.env.PD_ROUTING_KEY;

const octokit = new Octokit({
  auth: GITHUB_TOKEN,
});
const slackWebhook = new IncomingWebhook(SLACK_WEBHOOK_URL);

async function discoverConsecutiveFailures(
  firstWorkflowRun: number,
  secondWorkflowRun: number,
): Promise<string[]> {
  // Get all jobs of the latest 2 smoke tests
  const firstWorkflowRunJobs = (
    await octokit.actions.listJobsForWorkflowRun({
      owner: 'snyk',
      repo: 'snyk',
      run_id: firstWorkflowRun,
    })
  ).data.jobs;

  const secondWorkflowRunJobs = (
    await octokit.actions.listJobsForWorkflowRun({
      owner: 'snyk',
      repo: 'snyk',
      run_id: secondWorkflowRun,
    })
  ).data.jobs;

  const failedJobs: string[] = [];

  // If the same job failed in both smoke tests, it has been failing for 2 hours now. Save job to re-run later.
  for (const jobName of firstWorkflowRunJobs.map((j) => j.name)) {
    const firstJob = firstWorkflowRunJobs.find((j) => j.name === jobName);
    const secondJob = secondWorkflowRunJobs.find((j) => j.name === jobName);

    if (firstJob === undefined || secondJob === undefined) {
      console.error(
        `Could not find job ${jobName} in Smoke Tests ID: ${
          firstJob ? secondWorkflowRun : firstWorkflowRun
        }`,
      );
      process.exit(1);
    } else if (
      'failure' === firstJob.conclusion &&
      firstJob.conclusion === secondJob.conclusion
    ) {
      console.log(`Found a job that failed 2 times in a row: ${jobName}`);
      failedJobs.push(jobName);
    }
  }

  return failedJobs;
}

async function sendPagerDuty() {
  try {
    const res = await event({
      data: {
        routing_key: PD_ROUTING_KEY,
        event_action: 'trigger',
        payload: {
          summary: 'CLI Alert. Smoke tests failing',
          source: 'Snyk CLI Smoke tests',
          severity: 'warning',
        },
        dedup_key: 'b0209ed890d34eb787b3ed58f31553cc',
      },
    });
    console.log(res);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

async function sendSlackAlert(failedJobs: string[]) {
  console.log('Jobs failed again. Sending Slack alert...');
  const args: IncomingWebhookDefaultArguments = {
    username: 'Hammer Alerts',
    text: `A Smoke Tests Job failed more than 2 times in a row. \n <https://github.com/snyk/snyk/actions?query=workflow%3A%22Smoke+Tests%22|Smoke Tests Results>. \n Failed Job/s: ${failedJobs.join(
      ', ',
    )}`,
    icon_emoji: 'hammer',
  };
  await slackWebhook.send(args);
  console.log('Slack alert sent.');
}

async function waitForConclusion(runID: number) {
  let status: string | null = 'queued';
  const before = Date.now();
  console.log('Waiting for Smoke Test to finish running...');

  // Wait for run to finish
  while (status !== 'completed') {
    const smokeTest = (
      await octokit.actions.getWorkflowRun({
        owner: 'snyk',
        repo: 'snyk',
        run_id: runID,
      })
    ).data;

    // Wait 30 seconds
    await new Promise((r) => setTimeout(r, 30_000));
    status = smokeTest.status;
    const time = (Date.now() - before) / 1000;
    const minutes = Math.floor(time / 60);
    console.log(
      `Current smoke test status: "${status}". Elapsed: ${minutes} minute${
        minutes !== 1 ? 's' : ''
      }`,
    );
  }
  console.log('Finished run.');
}

async function checkJobConclusion(
  runID: number,
  failedJobs: string[],
): Promise<string[]> {
  // Get conclusions of the jobs that failed before
  const workflowRunJobs = (
    await octokit.actions.listJobsForWorkflowRun({
      owner: 'snyk',
      repo: 'snyk',
      run_id: runID,
    })
  ).data.jobs;

  // Return false if jobs that failed before failed again
  const rerunJobs = workflowRunJobs.filter((job) =>
    failedJobs.includes(job.name),
  );

  const failedAgainJobs: string[] = [];
  for (const job of rerunJobs) {
    if (job.conclusion === 'failure') {
      failedAgainJobs.push(job.name);
    }
  }

  return failedAgainJobs;
}

async function run() {
  try {
    // Get ID of smoke tests workflow
    const allWorkflows = (
      await octokit.actions.listRepoWorkflows({
        owner: 'snyk',
        repo: 'snyk',
      })
    ).data;

    const smokeTestsID = allWorkflows.workflows.find(
      (workflow) => workflow.name === 'Smoke Tests',
    )?.id;

    if (!smokeTestsID) {
      console.error('Error: Could not find Smoke Tests workflow ID');
      process.exit(1);
    }

    // Get latest smoke tests
    const workflowRuns = (
      await octokit.actions.listWorkflowRuns({
        owner: 'snyk',
        repo: 'snyk',
        branch: 'master',
        workflow_id: smokeTestsID,
      })
    ).data;
    console.log('Got latest smoke tests...');

    // Check the latest 2 smoke tests for tests that had the same job fail 2 times in a row.
    const latestWorkflowRuns = workflowRuns.workflow_runs.slice(0, 2);
    const id = latestWorkflowRuns[0].id;

    // Check current status of smoke test workflow and wait if it's still running
    const latestRun = (
      await octokit.actions.getWorkflowRun({
        owner: 'snyk',
        repo: 'snyk',
        run_id: id,
      })
    ).data;

    if (latestRun.status !== 'completed') {
      console.log('First wait for current run to finish...');
      await waitForConclusion(id);
    }

    console.log('Checking smoke tests jobs...');
    const failedWorkflows = await discoverConsecutiveFailures(
      latestWorkflowRuns[0].id,
      latestWorkflowRuns[1].id,
    );

    if (!failedWorkflows.length) {
      console.log(
        'There were no 2 consecutive fails on a job. No need to alert.',
      );
      return;
    }

    console.log('Trying to re-run smoke test...');

    // After making sure smoke test isn't currently running - try to re-run
    console.log(`Starting re-run of Smoke Test. ID number: ${id}...`);
    await octokit.actions.reRunWorkflow({
      owner: 'snyk',
      repo: 'snyk',
      run_id: id,
    });

    // Wait for run to finish
    await waitForConclusion(id);
    const failedAgainJobs = await checkJobConclusion(id, failedWorkflows);
    console.log('Re-run completed.');

    // If run failed again, send Slack alert and PagerDuty
    if (failedAgainJobs.length > 0) {
      await sendSlackAlert(failedAgainJobs);
      await sendPagerDuty();
    } else {
      console.log('Jobs succeeded after re-run. Do not alert.');
    }
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

process.on('uncaughtException', (err) => {
  console.error(err);
  process.exit(1);
});

// Exec
run();

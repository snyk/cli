import { Octokit } from '@octokit/rest';
import { IncomingWebhook } from '@slack/webhook';
import { IncomingWebhookDefaultArguments } from '@slack/webhook';

if (!process.env.USER_GITHUB_TOKEN || !process.env.SLACK_WEBHOOK_URL) {
  console.error('Missing USER_GITHUB_TOKEN or SLACK_WEBHOOK_URL');
  process.exit(1);
}

const GITHUB_TOKEN = process.env.USER_GITHUB_TOKEN;
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;

const octokit = new Octokit({
  auth: GITHUB_TOKEN,
});
const slackWebhook = new IncomingWebhook(SLACK_WEBHOOK_URL);

async function checkJobs(
  smokeTest1: number,
  smokeTest2: number,
): Promise<string[]> {
  // Get all jobs of the latest 2 smoke tests
  const jobs1 = (
    await octokit.actions.listJobsForWorkflowRun({
      owner: 'snyk',
      repo: 'snyk',
      // eslint-disable-next-line @typescript-eslint/camelcase
      run_id: smokeTest1,
    })
  ).data.jobs;

  const jobs2 = (
    await octokit.actions.listJobsForWorkflowRun({
      owner: 'snyk',
      repo: 'snyk',
      // eslint-disable-next-line @typescript-eslint/camelcase
      run_id: smokeTest2,
    })
  ).data.jobs;

  const failedJobs: string[] = [];

  // If the same job failed in both smoke tests, it has been failing for 2 hours now. Save job to re-run later.
  for (const jobName of jobs1.map((j) => j.name)) {
    const job1 = jobs1.find((j) => j.name === jobName);
    const job2 = jobs2.find((j) => j.name === jobName);

    if (job1 === undefined || job2 === undefined) {
      console.error(
        `Could not find job ${jobName} in Smoke Tests ID: ${
          job1 ? smokeTest2 : smokeTest1
        }`,
      );
      process.exit(1);
    } else if (
      'failure' === job1.conclusion &&
      job1?.conclusion === job2.conclusion
    ) {
      console.log(`Found a job that failed 2 times in a row: ${jobName}`);
      failedJobs.push(jobName);
    }
  }

  return failedJobs;
}

async function sendSlackAlert(failedJobs: string[]) {
  console.log('Jobs failed again. Sending Slack alert...');
  const args: IncomingWebhookDefaultArguments = {
    username: 'Hammer Alerts',
    text: `A Smoke Tests Job failed more than 2 times in a row. \n <https://github.com/snyk/snyk/actions?query=workflow%3A%22Smoke+Tests%22|Smoke Tests Results>. \n Failed Job/s: ${failedJobs.join(
      ', ',
    )}`,
    // eslint-disable-next-line @typescript-eslint/camelcase
    icon_emoji: 'hammer',
  };
  await slackWebhook.send(args);
  console.log('Slack alert sent.');
}

async function waitForConclusion(runID: number) {
  let status = 'queued';
  const before = Date.now();
  console.log('Waiting for Smoke Test to finish running...');

  // Wait for run to finish
  while (status !== 'completed') {
    const smokeTest = (
      await octokit.actions.getWorkflowRun({
        owner: 'snyk',
        repo: 'snyk',
        // eslint-disable-next-line @typescript-eslint/camelcase
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
  const smokeTestsJobs = (
    await octokit.actions.listJobsForWorkflowRun({
      owner: 'snyk',
      repo: 'snyk',
      // eslint-disable-next-line @typescript-eslint/camelcase
      run_id: runID,
    })
  ).data.jobs;

  // Return false if jobs that failed before failed again
  const rerunJobs = smokeTestsJobs.filter((job) =>
    failedJobs.includes(job.name),
  );

  const failedAgain: string[] = [];
  for (const job of rerunJobs) {
    if (job.conclusion === 'failure') {
      failedAgain.push(job.name);
    }
  }

  return failedAgain;
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

    let smokeTestsID = 0;
    for (const workflow of allWorkflows.workflows) {
      if (workflow.name === 'Smoke Tests') {
        smokeTestsID = workflow.id;
      }
    }

    // Get latest smoke tests
    const smokeTests = (
      await octokit.actions.listWorkflowRuns({
        owner: 'snyk',
        repo: 'snyk',
        branch: 'master',
        // eslint-disable-next-line @typescript-eslint/camelcase
        workflow_id: smokeTestsID,
      })
    ).data;
    console.log('Got latest smoke tests...');

    // Check the latest 2 smoke tests for tests that had the same job fail 2 times in a row.
    const latestSmokeTests = smokeTests.workflow_runs.slice(0, 2);

    console.log('Checking smoke tests jobs...');
    const failedJobs = await checkJobs(
      latestSmokeTests[0].id,
      latestSmokeTests[1].id,
    );

    if (!failedJobs.length || failedJobs.length < 1) {
      console.log(
        'There were no 2 consecutive fails on a job. No need to alert.',
      );
      return;
    }

    console.log('Trying to re-run smoke test...');
    const id = latestSmokeTests[0].id;

    // Check current status of smoke test and wait if it's still running
    const smokeTest = (
      await octokit.actions.getWorkflowRun({
        owner: 'snyk',
        repo: 'snyk',
        // eslint-disable-next-line @typescript-eslint/camelcase
        run_id: id,
      })
    ).data;

    if (smokeTest.status !== 'completed') {
      console.log('First wait for current run to finish...');
      await waitForConclusion(id);
    }

    // After making sure smoke test isn't currently running - try to re-run
    console.log(`Starting re-run of Smoke Test. ID number: ${id}...`);
    await octokit.actions.reRunWorkflow({
      owner: 'snyk',
      repo: 'snyk',
      // eslint-disable-next-line @typescript-eslint/camelcase
      run_id: id,
    });

    // Wait for run to finish
    await waitForConclusion(id);
    const failedAgain = await checkJobConclusion(id, failedJobs);
    console.log('Re-run completed.');

    // If run failed again, send Slack alert
    failedAgain.length > 0
      ? await sendSlackAlert(failedAgain)
      : console.log('Jobs succeeded after re-run. Do not alert.');
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

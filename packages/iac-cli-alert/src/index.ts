import { Octokit } from '@octokit/rest';
import { IncomingWebhook } from '@slack/webhook';
import { IncomingWebhookDefaultArguments } from '@slack/webhook';

if (!process.env.USER_GITHUB_TOKEN) {
  console.error('Missing USER_GITHUB_TOKEN');
  process.exit(1);
}

if (!process.env.IAC_SMOKE_TESTS_SLACK_WEBHOOK_URL) {
  console.error('Missing IAC_SMOKE_TESTS_SLACK_WEBHOOK_URL');
  process.exit(1);
}

const GITHUB_TOKEN = process.env.USER_GITHUB_TOKEN;
const SLACK_WEBHOOK_URL = process.env.IAC_SMOKE_TESTS_SLACK_WEBHOOK_URL;

const octokit = new Octokit({
  auth: GITHUB_TOKEN,
});
const slackWebhook = new IncomingWebhook(SLACK_WEBHOOK_URL);

async function discoverConsecutiveFailures(
  latestWorkflowRunIds: [number, number],
): Promise<boolean> {
  // Check current status of smoke test workflow and wait if it's still running
  const latestWorkflowRuns = await Promise.all(
    latestWorkflowRunIds.map(
      async (id) =>
        (
          await octokit.actions.getWorkflowRun({
            owner: 'snyk',
            repo: 'snyk',
            run_id: id,
          })
        ).data,
    ),
  );

  return latestWorkflowRuns.every((run) => run.conclusion === 'failure');
}

async function sendSlackAlert() {
  console.log('IaC smoke tests failed. Sending Slack alert...');
  const args: IncomingWebhookDefaultArguments = {
    text:
      'Infrastructure as Code Smoke Tests jobs failed. \n<https://github.com/snyk/cli/actions/workflows/iac-smoke-tests.yml?query=workflow%3A|Infrastructure as Code Smoke Tests Results>',
  };
  await slackWebhook.send(args);
  console.log('Slack alert sent.');
}

async function waitForConclusion(runID: number) {
  let status: string | null = 'queued';
  const before = Date.now();
  console.log(
    'Waiting for latest Infrastructure as Code Smoke Tests to finish running...',
  );

  // Wait for run to finish
  while (status !== 'completed') {
    const iacSmokeTest = (
      await octokit.actions.getWorkflowRun({
        owner: 'snyk',
        repo: 'snyk',
        run_id: runID,
      })
    ).data;

    // Wait 30 seconds
    await new Promise((r) => setTimeout(r, 30_000));
    status = iacSmokeTest.status;
    const time = (Date.now() - before) / 1000;
    const minutes = Math.floor(time / 60);
    console.log(
      `Current IaC smoke test status: "${status}". Elapsed: ${minutes} minute${
        minutes !== 1 ? 's' : ''
      }`,
    );
  }
  console.log('Finished run.');
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

    const iacSmokeTestsID = allWorkflows.workflows.find(
      (workflow) => workflow.name === 'Infrastructure as Code Smoke Tests',
    )?.id;

    if (!iacSmokeTestsID) {
      console.error(
        'Error: Could not find Infrastructure as Code Smoke Tests workflow ID',
      );
      process.exit(1);
    }

    // Get 2 latest smoke tests
    const latestWorkflowRuns = (
      await octokit.actions.listWorkflowRuns({
        owner: 'snyk',
        repo: 'snyk',
        branch: 'master',
        workflow_id: iacSmokeTestsID,
        per_page: 2,
      })
    ).data;

    if (latestWorkflowRuns.total_count < 2) {
      console.error('Error: Could not find 2 latest smoke tests');
      process.exit(1);
    }

    console.log('Got 2 latest IaC smoke tests...');

    // Check the latest 2 smoke tests for tests that had the same job fail 2 times in a row.
    const id = latestWorkflowRuns.workflow_runs[0].id;

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

    console.log('Checking IaC smoke tests jobs...');
    const hasConsecutiveFailures = await discoverConsecutiveFailures(
      latestWorkflowRuns.workflow_runs.map((run) => run.id) as [number, number],
    );

    if (!hasConsecutiveFailures) {
      console.log(
        'There were no 2 consecutive fails on a job. No need to alert.',
      );
      return;
    }

    // Send Slack alert
    await sendSlackAlert();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

process.on('uncaughtException', (err) => {
  console.error(err);
  process.exit(1);
});

// Exec
run();

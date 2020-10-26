import { Octokit } from '@octokit/rest';
import { IncomingWebhook } from '@slack/webhook';
import { IncomingWebhookDefaultArguments } from '@slack/webhook';

/*if (!process.env.USER_GITHUB_TOKEN || !process.env.SLACK_WEBHOOK_URL) {
  console.error('Missing USER_GITHUB_TOKEN or SLACK_WEBHOOK_URL');
  process.exit(1); TODO
}*/

const GITHUB_TOKEN = 'b1294d2f9c6c7b03920ba865c8d9cde9cabab4d4'; //process.env.USER_GITHUB_TOKEN;
const SLACK_WEBHOOK_URL =
  'https://hooks.slack.com/services/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'; //process.env.SLACK_WEBHOOK_URL;

const octokitInstance = new Octokit({
  auth: GITHUB_TOKEN,
});
const slackWebhook = new IncomingWebhook(SLACK_WEBHOOK_URL);

async function run(octokit: Octokit) {
  try {
    // Get ID of smoke tests workflow
    const all_workflows = (
      await octokit.actions.listRepoWorkflows({
        owner: 'snyk',
        repo: 'snyk',
      })
    ).data;

    let smokeTestsID = 0;
    for (let i = 0; i < all_workflows.workflows.length; i++) {
      let workflow = all_workflows.workflows[i];
      if (workflow.name == 'Smoke Tests') {
        smokeTestsID = workflow.id;
      }
    }

    // Get last 3 smoke tests workflows
    const workflows = (
      await octokit.actions.listWorkflowRuns({
        owner: 'snyk',
        repo: 'snyk',
        workflow_id: smokeTestsID,
        per_page: 3,
        page: 1,
      })
    ).data;

    // ID of the most recent smoke test run
    let runID = workflows.workflow_runs[0].id;

    // Check if last 3 smoke tests failed
    for (let i = 0; i < workflows.workflow_runs.length; i++) {
      let workflow = workflows.workflow_runs[i];
      if (workflow.conclusion !== 'failure') {
        return;
      }
    }

    // All 3 recent smoke tests failed - re-run!
    await octokit.actions.reRunWorkflow({
      owner: 'snyk',
      repo: 'snyk',
      run_id: runID,
    });

    // Wait for run to finish
    let conclusion = 'in_progress';
    let workflow: any; // IS THAT OKAY?
    while (conclusion !== 'failure' && conclusion !== 'success') {
      workflow = (
        await octokit.actions.getWorkflowRun({
          owner: 'snyk',
          repo: 'snyk',
          run_id: runID,
        })
      ).data;
      conclusion = <string>workflow.conclusion;
    }

    // If run failed again, send Slack alert
    if (workflow.conclusion === 'failure') {
      const args: IncomingWebhookDefaultArguments = {
        username: 'Hammer Alerts',
        text:
          'Smoke Tests failed more than 3 times in a row. \n <https://github.com/snyk/snyk/actions?query=workflow%3A%22Smoke+Tests%22|Click Here> for details!',
        icon_emoji: 'hammer',
      };
      await slackWebhook.send(args);
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
run(octokitInstance);

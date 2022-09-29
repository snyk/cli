import {
  IncomingWebhook,
  IncomingWebhookDefaultArguments,
} from '@slack/webhook';

if (!process.env.IAC_SMOKE_TESTS_SLACK_WEBHOOK_URL) {
  console.error(
    'Missing the IAC_SMOKE_TESTS_SLACK_WEBHOOK_URL environment variable',
  );
  process.exit(1);
}

const IAC_SMOKE_TESTS_SLACK_WEBHOOK_URL =
  process.env.IAC_SMOKE_TESTS_SLACK_WEBHOOK_URL;

const slackWebhook = new IncomingWebhook(IAC_SMOKE_TESTS_SLACK_WEBHOOK_URL);

async function sendSlackAlert() {
  console.log('IaC smoke tests failed. Sending Slack alert...');
  const args: IncomingWebhookDefaultArguments = {
    text:
      'An Infrastructure as Code Smoke Tests job failed. \n<https://github.com/snyk/cli/actions/workflows/iac-smoke-tests.yml?query=workflow%3A|Infrastructure as Code Smoke Tests Results>',
  };
  await slackWebhook.send(args);
  console.log('Slack alert sent.');
}

async function run() {
  try {
    await sendSlackAlert();
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

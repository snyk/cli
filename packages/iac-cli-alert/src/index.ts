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

if (!process.env.IAC_SMOKE_TESTS_OS) {
  console.error('Missing the IAC_SMOKE_TESTS_OS environment variable');
  process.exit(1);
}

const IAC_SMOKE_TESTS_SLACK_WEBHOOK_URL =
  process.env.IAC_SMOKE_TESTS_SLACK_WEBHOOK_URL;
const IAC_SMOKE_TESTS_OS = process.env.IAC_SMOKE_TESTS_OS;

const slackWebhook = new IncomingWebhook(IAC_SMOKE_TESTS_SLACK_WEBHOOK_URL);

async function sendSlackAlert() {
  console.log('IaC smoke tests failed. Sending Slack alert...');
  const args: IncomingWebhookDefaultArguments = {
    username: 'IaC CLI Alerts',
    text: `An Infrastructure as Code Smoke Tests job failed. \n Operating system - ${IAC_SMOKE_TESTS_OS} \n<https://github.com/snyk/cli/actions?query=workflow%3A+%22Infrastructure+as+Code+Smoke+Tests%22|Infrastructure as Code Smoke Tests Results>`,
    icon_emoji: 'snyk-iac',
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

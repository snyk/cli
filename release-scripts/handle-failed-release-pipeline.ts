import * as request from '../src/lib/request';
import { event } from '@pagerduty/pdjs';

console.log(
  'Something failed in the release pipeline, checking previous release',
);

if (
  !process.env.CLI_RELEASE_TESTS_TOKEN ||
  !process.env.PD_ROUTING_KEY_CLI_RELEASE_PIPELINES
) {
  console.error(
    'Missing CLI_RELEASE_TESTS_TOKEN or PD_ROUTING_KEY_CLI_RELEASE_PIPELINES',
  );
  process.exit(1);
}

const AUTHORIZATION_TOKEN = process.env.CLI_RELEASE_TESTS_TOKEN;
const PD_KEY = process.env.PD_ROUTING_KEY_CLI_RELEASE_PIPELINES;

const options = {
  method: 'GET',
  url:
    'https://circleci.com/api/v2/insights/gh/snyk/cli/workflows/test_and_release?branch=master',
  headers: { authorization: 'Basic ' },
};

let workflowId = null;

async function sendPagerDuty() {
  try {
    await event({
      data: {
        routing_key: PD_KEY,
        event_action: 'trigger',
        payload: {
          summary: 'Snyk CLI release failed on tests',
          source: 'CircleCI',
          severity: 'warning',
        },
      },
    });
  } catch (err) {
    console.error(
      `Handle failed release pipeline: couldn't make request to PagerDuty API to send alert.\nError:\n${err}\n`,
    );
    process.exit(1);
  }
}

async function alertOnFailedWorkflow() {
  const options = {
    method: 'GET',
    url: 'https://circleci.com/api/v2/workflow/' + workflowId,
    headers: { authorization: 'Basic ' + AUTHORIZATION_TOKEN },
  };

  await request.makeRequest(options, async function(err, res, body) {
    if (err) {
      console.error(
        `Handle failed release pipeline: couldn't make request to CircleCI API to get workflow details.\nError:\n${err}\n`,
      );
      process.exit(1);
    }

    const previousWorkflow = JSON.parse(body);
    if (previousWorkflow.status === 'failed') {
      console.log('Previous release failed. Sending alert');
      await sendPagerDuty();
    }
  });
}

request.makeRequest(options, function(err, res, body) {
  if (err) {
    console.error(
      `Handle failed release pipeline: couldn't make request to CircleCI API to get pipeline details.\nError:\n${err}\n`,
    );
    process.exit(1);
  }
  const pipelines = JSON.parse(body);
  workflowId = pipelines.items[0].id;

  if (workflowId !== null) {
    alertOnFailedWorkflow();
  } else {
    console.error(
      'Handle failed release pipeline: Got null as last workflow ID',
    );
  }
});

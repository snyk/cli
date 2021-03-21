import * as fs from 'fs';
import * as path from 'path';
import {
  IacFileData,
  TerraformPlanJson,
  TerraformScanInput,
} from '../../../../src/cli/commands/test/iac-local-execution/types';

const tfPlanFixture = fs.readFileSync(
  path.resolve(__dirname, '../../../fixtures/iac/terraform-plan/tf-plan.json'),
);

export const iacFileData: IacFileData = {
  fileContent: tfPlanFixture.toString(),
  filePath: 'dont-care',
  fileType: 'json',
};

const resource = {
  ingress: {
    cidr_blocks: ['0.0.0.0/0'],
    description: null,
    from_port: 0,
    ipv6_cidr_blocks: null,
    prefix_list_ids: null,
    protocol: 'tcp',
    self: false,
    to_port: 65535,
    type: 'ingress',
  },
};
export const expectedParsingResultFullScan: TerraformScanInput = {
  resource: {
    aws_security_group: {
      terra_ci_allow_outband: resource,
      CHILD_MODULE_terra_ci_allow_outband_0: resource,
    },
  },
  data: {},
};

export const expectedParsingResultDeltaScan: TerraformScanInput = {
  resource: {
    aws_security_group: {
      some_updated_resource: resource,
      some_created_resource: resource,
    },
  },
  data: {},
};

const withoutChildModules = (JSON.parse(
  tfPlanFixture.toString(),
) as unknown) as TerraformPlanJson;
delete withoutChildModules.planned_values.root_module.child_modules;
export const iacFileDataNoChildModules: IacFileData = {
  fileContent: JSON.stringify(withoutChildModules),
  filePath: 'dont-care',
  fileType: 'json',
};

export const invalidJsonIacFile = {
  ...iacFileData,
  fileContent: tfPlanFixture.toString().slice(1),
};

export const expectedParsingResultWithoutChildModules: TerraformScanInput = {
  resource: {
    aws_security_group: {
      terra_ci_allow_outband: resource,
    },
  },
  data: {},
};

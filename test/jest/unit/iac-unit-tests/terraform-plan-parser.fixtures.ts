/* eslint-disable @typescript-eslint/camelcase */
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

export const terraformPlanJson: TerraformPlanJson = JSON.parse(
  iacFileData.fileContent,
);

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
    // "delete" | "create"
    aws_iam_user_group_membership: {
      some_delete_create_resource: {
        groups: ['organization-administrators'],
        user: 'p0tr3c',
      },
    },
    // "create" | "delete"
    aws_instance: {
      some_create_delete_resource: {
        ami: 'ami-0831162e2eb204b16',
        associate_public_ip_address: true,
        credit_specification: [],
        disable_api_termination: null,
        ebs_optimized: null,
        get_password_data: false,
        hibernation: null,
        iam_instance_profile: null,
        instance_initiated_shutdown_behavior: null,
        instance_type: 't3.micro',
        key_name: 'terra-ci',
        monitoring: null,
        source_dest_check: true,
        subnet_id: 'subnet-050411f3bb5f9dbe4',
        tags: null,
        timeouts: null,
        user_data: null,
        user_data_base64: null,
        volume_tags: null,
        vpc_security_group_ids: ['sg-0455cfe38c670b7b3'],
      },
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

export const terraformPlanNoChildModulesJson = JSON.parse(
  iacFileDataNoChildModules.fileContent,
);

export const expectedParsingResultWithoutChildModules: TerraformScanInput = {
  resource: {
    aws_security_group: {
      terra_ci_allow_outband: resource,
    },
  },
  data: {},
};

const planWithoutRootModule = (JSON.parse(
  tfPlanFixture.toString(),
) as unknown) as TerraformPlanJson;
delete planWithoutRootModule.planned_values;
export const iacFileDataWithoutRootModule: IacFileData = {
  fileContent: JSON.stringify(planWithoutRootModule),
  filePath: 'dont-care',
  fileType: 'json',
};

const planWithoutResourceChanges = (JSON.parse(
  tfPlanFixture.toString(),
) as unknown) as TerraformPlanJson;
delete planWithoutResourceChanges.resource_changes;
export const iacFileDataWithoutResourceChanges: IacFileData = {
  fileContent: JSON.stringify(planWithoutResourceChanges),
  filePath: 'dont-care',
  fileType: 'json',
};

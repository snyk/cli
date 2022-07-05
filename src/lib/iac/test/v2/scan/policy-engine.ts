/* eslint-disable @typescript-eslint/no-namespace */

/**
 * This is the top-level output from the Unified Policy Engine.
 * @export
 * @interface Results
 */
export interface Results {
  /**
   *
   * @type {string}
   * @memberof Results
   */
  format: Results.FormatEnum;
  /**
   *
   * @type {string}
   * @memberof Results
   */
  formatVersion: Results.FormatVersionEnum;
  /**
   *
   * @type {Array<Result>}
   * @memberof Results
   */
  results: Array<Result>;
}

/**
 * @export
 * @namespace Results
 */
namespace Results {
  /**
   * @export
   * @enum {string}
   */
  export enum FormatEnum {
    Results = <any>'results',
  }
  /**
   * @export
   * @enum {string}
   */
  export enum FormatVersionEnum {
    _100 = <any>'1.0.0',
  }
}

/**
 * An object that relates an input with its rule results
 * @export
 * @interface Result
 */
interface Result {
  /**
   *
   * @type {State}
   * @memberof Result
   */
  input: State;
  /**
   * An array of rule results objects
   * @type {Array<RuleResults>}
   * @memberof Result
   */
  rule_results: Array<RuleResults>;
}

/**
 * The state format contains the state of all resources from some input. This format is intended to be used as both an input and output for the unified policy engine. It is also intended to support the visualizer and other downstream artifacts.
 * @export
 * @interface State
 */
interface State {
  /**
   *
   * @type {string}
   * @memberof State
   */
  format: State.FormatEnum;
  /**
   *
   * @type {string}
   * @memberof State
   */
  formatVersion: State.FormatVersionEnum;
  /**
   * The type of input that this state was generated from. This value factors into which rules are run for this input.
   * @type {string}
   * @memberof State
   */
  input_type: State.InputTypeEnum; // Yair - inputType => input_type
  /**
   * The type of environment that this state was generated from. This value factors into which rules are run for this input.
   * @type {string}
   * @memberof State
   */
  environmentProvider: State.EnvironmentProviderEnum;
  /**
   * This object is intended to hold any input type-specific or  environment-specific fields, e.g. account_id or filepath.
   * @type {{ [key: string]: ModelObject; }}
   * @memberof State
   */
  meta?: { [key: string]: any }; // Yair - ModelObject => any
  /**
   * Resources is a map of resource type to a map of a unique resource key to a resource object.
   * @type {{ [key: string]: { [key: string]: ResourceState; }; }}
   * @memberof State
   */
  resources: { [key: string]: { [key: string]: ResourceState } };
}

/**
 * @export
 * @namespace State
 */
export namespace State {
  /**
   * @export
   * @enum {string}
   */
  export enum FormatEnum {
    State = <any>'state',
  }
  /**
   * @export
   * @enum {string}
   */
  export enum FormatVersionEnum {
    _100 = <any>'1.0.0',
  }
  /**
   * @export
   * @enum {string}
   */
  export enum InputTypeEnum {
    TfHcl = <any>'tf_hcl',
    TfPlan = <any>'tf_plan',
    CloudScan = <any>'cloud_scan',
    Cfn = <any>'cfn',
    K8s = <any>'k8s',
    Arm = <any>'arm',
  }
  /**
   * @export
   * @enum {string}
   */
  export enum EnvironmentProviderEnum {
    Aws = <any>'aws',
    Azure = <any>'azure',
    Google = <any>'google',
    Iac = <any>'iac',
  }
}

/**
 * The state of a single resource
 * @export
 * @interface ResourceState
 */
interface ResourceState {
  /**
   * The identifier of the object. This can be a natural ID. It is assumed that this ID is unique within the namespace.
   * @type {string}
   * @memberof ResourceState
   */
  id: string;
  /**
   * The type of the resource.
   * @type {string}
   * @memberof ResourceState
   */
  resourceType: string;
  /**
   * This field is a component of uniquely identifying a resource. It will resolve to different values depending on the input type and environment provider. For example, in a runtime AWS environment, this will be the region. For an IaC Terraform resource, this will be the module path. Customers of the API can set this to something that makes sense for them and parse it back.
   * @type {string}
   * @memberof ResourceState
   */
  namespace: string;
  /**
   * Tags applied to the resource. Our goal is to extract tags into a uniform key->value format.
   * @type {{ [key: string]: string; }}
   * @memberof ResourceState
   */
  tags?: { [key: string]: string };
  /**
   * This object is intended to hold any input type-specific or  environment-specific fields, e.g. provider, region, or source location.
   * @type {{ [key: string]: ModelObject; }}
   * @memberof ResourceState
   */
  meta?: { [key: string]: any }; // Yair - ModelObject => any
  /**
   * A map of resource attributes.
   * @type {{ [key: string]: ModelObject; }}
   * @memberof ResourceState
   */
  attributes: { [key: string]: RuleResultResourceAttribute }; // Yair - ModelObject => RuleResultResourceAttribute
}

/**
 * Container for all results associated with a single rule
 * @export
 * @interface RuleResults
 */
export interface RuleResults {
  /**
   * The Rule ID, e.g. SNYK_00503 or 608f97c3-a11a-4154-a88e-a2fcd18c75b0
   * @type {string}
   * @memberof RuleResults
   */
  id?: string;
  /**
   * The rule title
   * @type {string}
   * @memberof RuleResults
   */
  title?: string;
  /**
   * The platform describes the CSPs or other technology platform (e.g. Docker) that the rule checks for
   * @type {Array<string>}
   * @memberof RuleResults
   */
  platform?: Array<string>;
  /**
   * The rule description
   * @type {string}
   * @memberof RuleResults
   */
  description?: string;
  /**
   * A markdown formatted string containing useful links
   * @type {string}
   * @memberof RuleResults
   */
  references?: string;
  /**
   * The category of the policy
   * @type {string}
   * @memberof RuleResults
   */
  category?: string;
  /**
   * An array of labels (value-less tags) associated with this policy
   * @type {Array<string>}
   * @memberof RuleResults
   */
  labels?: Array<string>;
  /**
   * The service group of the primary resource associated with this policy (e.g. \"EBS\", \"EC2\")
   * @type {string}
   * @memberof RuleResults
   */
  serviceGroup?: string;
  /**
   * A map of rule set ID to a map of versions to a list of control IDs
   * @type {{ [key: string]: { [key: string]: Array<string>; }; }}
   * @memberof RuleResults
   */
  controls?: { [key: string]: { [key: string]: Array<string> } };
  /**
   * A list of resource types that the rule uses.
   * @type {Array<string>}
   * @memberof RuleResults
   */
  resourceTypes?: Array<string>;
  /**
   *
   * @type {Array<RuleResult>}
   * @memberof RuleResults
   */
  results: Array<RuleResult>;
  /**
   * Any errors that occurred while evaluating this rule.
   * @type {Array<string>}
   * @memberof RuleResults
   */
  errors?: Array<string>;
  /**
   * The Rego package name that defines the rule, useful for debugging
   * @type {string}
   * @memberof RuleResults
   */
  _package?: string;
}

/**
 * A single rule result
 * @export
 * @interface RuleResult
 */
export interface RuleResult {
  /**
   * Whether or not this is a passing or failing result
   * @type {boolean}
   * @memberof RuleResult
   */
  passed: boolean;
  /**
   * Whether or not this result is ignored
   * @type {boolean}
   * @memberof RuleResult
   */
  ignored: boolean;
  /**
   * An optional message that can be returned by a rule
   * @type {string}
   * @memberof RuleResult
   */
  message?: string;
  /**
   * The ID of the primary resource (if any) associated with this result
   * @type {string}
   * @memberof RuleResult
   */
  resourceId?: string;
  /**
   * The namespace of the primary resource (if any) associated with this result
   * @type {string}
   * @memberof RuleResult
   */
  resourceNamespace?: string;
  /**
   * The type of resource (if any) associated with this result. This will typically be used with \"missing resource\" rules.
   * @type {string}
   * @memberof RuleResult
   */
  resourceType?: string;
  /**
   * A Markdown-formatted set of remediation steps to resolve the issue identified by the rule
   * @type {string}
   * @memberof RuleResult
   */
  remediation?: string;
  /**
   * The severity of this rule result
   * @type {string}
   * @memberof RuleResult
   */
  severity?: RuleResult.SeverityEnum;
  /**
   * An arbitrary key-value map that a rule can return in its result.
   * @type {{ [key: string]: ModelObject; }}
   * @memberof RuleResult
   */
  context?: { [key: string]: any }; // Yair - ModelObject => any
  /**
   * A resource objects associated with this result.
   * @type {Array<RuleResultResource>}
   * @memberof RuleResult
   */
  resources?: Array<RuleResultResource>;
}

/**
 * @export
 * @namespace RuleResult
 */
namespace RuleResult {
  /**
   * @export
   * @enum {string}
   */
  export enum SeverityEnum {
    Low = <any>'Low',
    Medium = <any>'Medium',
    High = <any>'High',
    Critical = <any>'Critical',
  }
}

/**
 * Identifying information for a resource and attributes associated with a rule result
 * @export
 * @interface RuleResultResource
 */
interface RuleResultResource {
  /**
   * The ID of this resource
   * @type {string}
   * @memberof RuleResultResource
   */
  id?: string;
  /**
   * The type of this resource
   * @type {string}
   * @memberof RuleResultResource
   */
  type?: string;
  /**
   * The namespace of this resource
   * @type {string}
   * @memberof RuleResultResource
   */
  namespace?: string;
  /**
   *
   * @type {SourceLocationStack}
   * @memberof RuleResultResource
   */
  location?: SourceLocationStack;
  /**
   * Attributes of the resource that were associated with a rule result.
   * @type {Array<RuleResultResourceAttribute>}
   * @memberof RuleResultResource
   */
  attributes?: Array<RuleResultResourceAttribute>;
}

/**
 * Points to a row and column within a source file
 * @export
 * @interface SourceLocation
 */
interface SourceLocation {
  /**
   *
   * @type {string}
   * @memberof SourceLocation
   */
  filepath?: string;
  /**
   *
   * @type {number}
   * @memberof SourceLocation
   */
  line?: number;
  /**
   *
   * @type {number}
   * @memberof SourceLocation
   */
  column?: number;
}
/**
 * A stack of source locations. It's useful to represent locations this way for IaC types that allow users to import modules or other groups of resources, because we can point to where a resource definition is as well as how it was imported into the top-level module.
 * @export
 */
type SourceLocationStack = Array<SourceLocation>;

/**
 *
 * @export
 * @interface RuleResultResourceAttribute
 */
interface RuleResultResourceAttribute {
  /**
   * The path to an attribute associated with this resource and rule result
   * @type {Array<string | number>}
   * @memberof RuleResultResourceAttribute
   */
  path?: Array<string | number>;
  /**
   *
   * @type {SourceLocation}
   * @memberof RuleResultResourceAttribute
   */
  location?: SourceLocation;
}

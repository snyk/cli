// taken from "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json"
module.exports = {
  $schema: 'http://json-schema.org/draft-04/schema#',
  title: 'Static Analysis Results Format (SARIF) Version 2.1.0 JSON Schema',
  id: 'https://docs.oasis-open.org/sarif/sarif/v2.1.0/errata01/os/schemas/sarif-schema-2.1.0.json',
  description:
    'Static Analysis Results Format (SARIF) Version 2.1.0 JSON Schema: a standard format for the output of static analysis tools.',
  additionalProperties: false,
  type: 'object',
  properties: {
    $schema: {
      description: 'The URI of the JSON schema corresponding to the version.',
      type: 'string',
      format: 'uri',
    },

    version: {
      description: 'The SARIF format version of this log file.',
      enum: ['2.1.0'],
      type: 'string',
    },

    runs: {
      description: 'The set of runs contained in this log file.',
      type: ['array', 'null'],
      minItems: 0,
      uniqueItems: false,
      items: {
        $ref: '#/definitions/run',
      },
    },

    inlineExternalProperties: {
      description:
        'References to external property files that share data between runs.',
      type: 'array',
      minItems: 0,
      uniqueItems: true,
      items: {
        $ref: '#/definitions/externalProperties',
      },
    },

    properties: {
      description:
        'Key/value pairs that provide additional information about the log file.',
      $ref: '#/definitions/propertyBag',
    },
  },

  required: ['version', 'runs'],

  definitions: {
    address: {
      description:
        "A physical or virtual address, or a range of addresses, in an 'addressable region' (memory or a binary file).",
      additionalProperties: false,
      type: 'object',
      properties: {
        absoluteAddress: {
          description:
            'The address expressed as a byte offset from the start of the addressable region.',
          type: 'integer',
          minimum: -1,
          default: -1,
        },

        relativeAddress: {
          description:
            'The address expressed as a byte offset from the absolute address of the top-most parent object.',
          type: 'integer',
        },

        length: {
          description: 'The number of bytes in this range of addresses.',
          type: 'integer',
        },

        kind: {
          description:
            "An open-ended string that identifies the address kind. 'data', 'function', 'header','instruction', 'module', 'page', 'section', 'segment', 'stack', 'stackFrame', 'table' are well-known values.",
          type: 'string',
        },

        name: {
          description:
            "A name that is associated with the address, e.g., '.text'.",
          type: 'string',
        },

        fullyQualifiedName: {
          description:
            'A human-readable fully qualified name that is associated with the address.',
          type: 'string',
        },

        offsetFromParent: {
          description:
            'The byte offset of this address from the absolute or relative address of the parent object.',
          type: 'integer',
        },

        index: {
          description:
            'The index within run.addresses of the cached object for this address.',
          type: 'integer',
          default: -1,
          minimum: -1,
        },

        parentIndex: {
          description: 'The index within run.addresses of the parent object.',
          type: 'integer',
          default: -1,
          minimum: -1,
        },

        properties: {
          description:
            'Key/value pairs that provide additional information about the address.',
          $ref: '#/definitions/propertyBag',
        },
      },
    },

    artifact: {
      description:
        'A single artifact. In some cases, this artifact might be nested within another artifact.',
      additionalProperties: false,
      type: 'object',
      properties: {
        description: {
          description: 'A short description of the artifact.',
          $ref: '#/definitions/message',
        },

        location: {
          description: 'The location of the artifact.',
          $ref: '#/definitions/artifactLocation',
        },

        parentIndex: {
          description:
            'Identifies the index of the immediate parent of the artifact, if this artifact is nested.',
          type: 'integer',
          default: -1,
          minimum: -1,
        },

        offset: {
          description:
            'The offset in bytes of the artifact within its containing artifact.',
          type: 'integer',
          minimum: 0,
        },

        length: {
          description: 'The length of the artifact in bytes.',
          type: 'integer',
          default: -1,
          minimum: -1,
        },

        roles: {
          description:
            'The role or roles played by the artifact in the analysis.',
          type: 'array',
          minItems: 0,
          uniqueItems: true,
          default: [],
          items: {
            enum: [
              'analysisTarget',
              'attachment',
              'responseFile',
              'resultFile',
              'standardStream',
              'tracedFile',
              'unmodified',
              'modified',
              'added',
              'deleted',
              'renamed',
              'uncontrolled',
              'driver',
              'extension',
              'translation',
              'taxonomy',
              'policy',
              'referencedOnCommandLine',
              'memoryContents',
              'directory',
              'userSpecifiedConfiguration',
              'toolSpecifiedConfiguration',
              'debugOutputFile',
            ],
            type: 'string',
          },
        },

        mimeType: {
          description: 'The MIME type (RFC 2045) of the artifact.',
          type: 'string',
          pattern: '[^/]+/.+',
        },

        contents: {
          description: 'The contents of the artifact.',
          $ref: '#/definitions/artifactContent',
        },

        encoding: {
          description:
            'Specifies the encoding for an artifact object that refers to a text file.',
          type: 'string',
        },

        sourceLanguage: {
          description:
            'Specifies the source language for any artifact object that refers to a text file that contains source code.',
          type: 'string',
        },

        hashes: {
          description:
            'A dictionary, each of whose keys is the name of a hash function and each of whose values is the hashed value of the artifact produced by the specified hash function.',
          type: 'object',
          additionalProperties: {
            type: 'string',
          },
        },

        lastModifiedTimeUtc: {
          description:
            'The Coordinated Universal Time (UTC) date and time at which the artifact was most recently modified. See "Date/time properties" in the SARIF spec for the required format.',
          type: 'string',
          format: 'date-time',
        },

        properties: {
          description:
            'Key/value pairs that provide additional information about the artifact.',
          $ref: '#/definitions/propertyBag',
        },
      },
    },

    artifactChange: {
      description: 'A change to a single artifact.',
      additionalProperties: false,
      type: 'object',
      properties: {
        artifactLocation: {
          description: 'The location of the artifact to change.',
          $ref: '#/definitions/artifactLocation',
        },

        replacements: {
          description:
            "An array of replacement objects, each of which represents the replacement of a single region in a single artifact specified by 'artifactLocation'.",
          type: 'array',
          minItems: 1,
          uniqueItems: false,
          items: {
            $ref: '#/definitions/replacement',
          },
        },

        properties: {
          description:
            'Key/value pairs that provide additional information about the change.',
          $ref: '#/definitions/propertyBag',
        },
      },

      required: ['artifactLocation', 'replacements'],
    },

    artifactContent: {
      description: 'Represents the contents of an artifact.',
      type: 'object',
      additionalProperties: false,
      properties: {
        text: {
          description: 'UTF-8-encoded content from a text artifact.',
          type: 'string',
        },

        binary: {
          description:
            'MIME Base64-encoded content from a binary artifact, or from a text artifact in its original encoding.',
          type: 'string',
        },

        rendered: {
          description:
            'An alternate rendered representation of the artifact (e.g., a decompiled representation of a binary region).',
          $ref: '#/definitions/multiformatMessageString',
        },

        properties: {
          description:
            'Key/value pairs that provide additional information about the artifact content.',
          $ref: '#/definitions/propertyBag',
        },
      },
    },

    artifactLocation: {
      description: 'Specifies the location of an artifact.',
      additionalProperties: false,
      type: 'object',
      properties: {
        uri: {
          description: 'A string containing a valid relative or absolute URI.',
          type: 'string',
          format: 'uri-reference',
        },

        uriBaseId: {
          description:
            'A string which indirectly specifies the absolute URI with respect to which a relative URI in the "uri" property is interpreted.',
          type: 'string',
        },

        index: {
          description:
            'The index within the run artifacts array of the artifact object associated with the artifact location.',
          type: 'integer',
          default: -1,
          minimum: -1,
        },

        description: {
          description: 'A short description of the artifact location.',
          $ref: '#/definitions/message',
        },

        properties: {
          description:
            'Key/value pairs that provide additional information about the artifact location.',
          $ref: '#/definitions/propertyBag',
        },
      },
    },

    attachment: {
      description: 'An artifact relevant to a result.',
      type: 'object',
      additionalProperties: false,
      properties: {
        description: {
          description:
            'A message describing the role played by the attachment.',
          $ref: '#/definitions/message',
        },

        artifactLocation: {
          description: 'The location of the attachment.',
          $ref: '#/definitions/artifactLocation',
        },

        regions: {
          description: 'An array of regions of interest within the attachment.',
          type: 'array',
          minItems: 0,
          uniqueItems: true,
          default: [],
          items: {
            $ref: '#/definitions/region',
          },
        },

        rectangles: {
          description:
            'An array of rectangles specifying areas of interest within the image.',
          type: 'array',
          minItems: 0,
          uniqueItems: true,
          default: [],
          items: {
            $ref: '#/definitions/rectangle',
          },
        },

        properties: {
          description:
            'Key/value pairs that provide additional information about the attachment.',
          $ref: '#/definitions/propertyBag',
        },
      },

      required: ['artifactLocation'],
    },

    codeFlow: {
      description:
        'A set of threadFlows which together describe a pattern of code execution relevant to detecting a result.',
      additionalProperties: false,
      type: 'object',
      properties: {
        message: {
          description: 'A message relevant to the code flow.',
          $ref: '#/definitions/message',
        },

        threadFlows: {
          description:
            'An array of one or more unique threadFlow objects, each of which describes the progress of a program through a thread of execution.',
          type: 'array',
          minItems: 1,
          uniqueItems: false,
          items: {
            $ref: '#/definitions/threadFlow',
          },
        },

        properties: {
          description:
            'Key/value pairs that provide additional information about the code flow.',
          $ref: '#/definitions/propertyBag',
        },
      },

      required: ['threadFlows'],
    },

    configurationOverride: {
      description:
        'Information about how a specific rule or notification was reconfigured at runtime.',
      type: 'object',
      additionalProperties: false,
      properties: {
        configuration: {
          description:
            'Specifies how the rule or notification was configured during the scan.',
          $ref: '#/definitions/reportingConfiguration',
        },

        descriptor: {
          description:
            'A reference used to locate the descriptor whose configuration was overridden.',
          $ref: '#/definitions/reportingDescriptorReference',
        },

        properties: {
          description:
            'Key/value pairs that provide additional information about the configuration override.',
          $ref: '#/definitions/propertyBag',
        },
      },
      required: ['configuration', 'descriptor'],
    },

    conversion: {
      description:
        "Describes how a converter transformed the output of a static analysis tool from the analysis tool's native output format into the SARIF format.",
      additionalProperties: false,
      type: 'object',
      properties: {
        tool: {
          description: 'A tool object that describes the converter.',
          $ref: '#/definitions/tool',
        },

        invocation: {
          description:
            'An invocation object that describes the invocation of the converter.',
          $ref: '#/definitions/invocation',
        },

        analysisToolLogFiles: {
          description:
            "The locations of the analysis tool's per-run log files.",
          type: 'array',
          minItems: 0,
          uniqueItems: true,
          default: [],
          items: {
            $ref: '#/definitions/artifactLocation',
          },
        },

        properties: {
          description:
            'Key/value pairs that provide additional information about the conversion.',
          $ref: '#/definitions/propertyBag',
        },
      },

      required: ['tool'],
    },

    edge: {
      description: 'Represents a directed edge in a graph.',
      type: 'object',
      additionalProperties: false,
      properties: {
        id: {
          description:
            'A string that uniquely identifies the edge within its graph.',
          type: 'string',
        },

        label: {
          description: 'A short description of the edge.',
          $ref: '#/definitions/message',
        },

        sourceNodeId: {
          description:
            'Identifies the source node (the node at which the edge starts).',
          type: 'string',
        },

        targetNodeId: {
          description:
            'Identifies the target node (the node at which the edge ends).',
          type: 'string',
        },

        properties: {
          description:
            'Key/value pairs that provide additional information about the edge.',
          $ref: '#/definitions/propertyBag',
        },
      },

      required: ['id', 'sourceNodeId', 'targetNodeId'],
    },

    edgeTraversal: {
      description:
        'Represents the traversal of a single edge during a graph traversal.',
      type: 'object',
      additionalProperties: false,
      properties: {
        edgeId: {
          description: 'Identifies the edge being traversed.',
          type: 'string',
        },

        message: {
          description:
            'A message to display to the user as the edge is traversed.',
          $ref: '#/definitions/message',
        },

        finalState: {
          description:
            'The values of relevant expressions after the edge has been traversed.',
          type: 'object',
          additionalProperties: {
            $ref: '#/definitions/multiformatMessageString',
          },
        },

        stepOverEdgeCount: {
          description:
            'The number of edge traversals necessary to return from a nested graph.',
          type: 'integer',
          minimum: 0,
        },

        properties: {
          description:
            'Key/value pairs that provide additional information about the edge traversal.',
          $ref: '#/definitions/propertyBag',
        },
      },

      required: ['edgeId'],
    },

    exception: {
      description:
        'Describes a runtime exception encountered during the execution of an analysis tool.',
      type: 'object',
      additionalProperties: false,
      properties: {
        kind: {
          type: 'string',
          description:
            'A string that identifies the kind of exception, for example, the fully qualified type name of an object that was thrown, or the symbolic name of a signal.',
        },

        message: {
          description: 'A message that describes the exception.',
          type: 'string',
        },

        stack: {
          description:
            'The sequence of function calls leading to the exception.',
          $ref: '#/definitions/stack',
        },

        innerExceptions: {
          description:
            'An array of exception objects each of which is considered a cause of this exception.',
          type: 'array',
          minItems: 0,
          uniqueItems: false,
          default: [],
          items: {
            $ref: '#/definitions/exception',
          },
        },

        properties: {
          description:
            'Key/value pairs that provide additional information about the exception.',
          $ref: '#/definitions/propertyBag',
        },
      },
    },

    externalProperties: {
      description: 'The top-level element of an external property file.',
      type: 'object',
      additionalProperties: false,
      properties: {
        schema: {
          description:
            'The URI of the JSON schema corresponding to the version of the external property file format.',
          type: 'string',
          format: 'uri',
        },

        version: {
          description:
            'The SARIF format version of this external properties object.',
          enum: ['2.1.0'],
          type: 'string',
        },

        guid: {
          description:
            'A stable, unique identifier for this external properties object, in the form of a GUID.',
          type: 'string',
          pattern:
            '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$',
        },

        runGuid: {
          description:
            'A stable, unique identifier for the run associated with this external properties object, in the form of a GUID.',
          type: 'string',
          pattern:
            '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$',
        },

        conversion: {
          description:
            'A conversion object that will be merged with a separate run.',
          $ref: '#/definitions/conversion',
        },

        graphs: {
          description:
            'An array of graph objects that will be merged with a separate run.',
          type: 'array',
          minItems: 0,
          default: [],
          uniqueItems: true,
          items: {
            $ref: '#/definitions/graph',
          },
        },

        externalizedProperties: {
          description:
            'Key/value pairs that provide additional information that will be merged with a separate run.',
          $ref: '#/definitions/propertyBag',
        },

        artifacts: {
          description:
            'An array of artifact objects that will be merged with a separate run.',
          type: 'array',
          minItems: 0,
          uniqueItems: true,
          items: {
            $ref: '#/definitions/artifact',
          },
        },

        invocations: {
          description:
            'Describes the invocation of the analysis tool that will be merged with a separate run.',
          type: 'array',
          minItems: 0,
          uniqueItems: false,
          default: [],
          items: {
            $ref: '#/definitions/invocation',
          },
        },

        logicalLocations: {
          description:
            'An array of logical locations such as namespaces, types or functions that will be merged with a separate run.',
          type: 'array',
          minItems: 0,
          uniqueItems: true,
          default: [],
          items: {
            $ref: '#/definitions/logicalLocation',
          },
        },

        threadFlowLocations: {
          description:
            'An array of threadFlowLocation objects that will be merged with a separate run.',
          type: 'array',
          minItems: 0,
          uniqueItems: true,
          default: [],
          items: {
            $ref: '#/definitions/threadFlowLocation',
          },
        },

        results: {
          description:
            'An array of result objects that will be merged with a separate run.',
          type: 'array',
          minItems: 0,
          uniqueItems: false,
          default: [],
          items: {
            $ref: '#/definitions/result',
          },
        },

        taxonomies: {
          description:
            'Tool taxonomies that will be merged with a separate run.',
          type: 'array',
          minItems: 0,
          uniqueItems: true,
          default: [],
          items: {
            $ref: '#/definitions/toolComponent',
          },
        },

        driver: {
          description:
            'The analysis tool object that will be merged with a separate run.',
          $ref: '#/definitions/toolComponent',
        },

        extensions: {
          description:
            'Tool extensions that will be merged with a separate run.',
          type: 'array',
          minItems: 0,
          uniqueItems: true,
          default: [],
          items: {
            $ref: '#/definitions/toolComponent',
          },
        },

        policies: {
          description: 'Tool policies that will be merged with a separate run.',
          type: 'array',
          minItems: 0,
          uniqueItems: true,
          default: [],
          items: {
            $ref: '#/definitions/toolComponent',
          },
        },

        translations: {
          description:
            'Tool translations that will be merged with a separate run.',
          type: 'array',
          minItems: 0,
          uniqueItems: true,
          default: [],
          items: {
            $ref: '#/definitions/toolComponent',
          },
        },

        addresses: {
          description: 'Addresses that will be merged with a separate run.',
          type: 'array',
          minItems: 0,
          uniqueItems: false,
          default: [],
          items: {
            $ref: '#/definitions/address',
          },
        },

        webRequests: {
          description: 'Requests that will be merged with a separate run.',
          type: 'array',
          minItems: 0,
          uniqueItems: true,
          default: [],
          items: {
            $ref: '#/definitions/webRequest',
          },
        },

        webResponses: {
          description: 'Responses that will be merged with a separate run.',
          type: 'array',
          minItems: 0,
          uniqueItems: true,
          default: [],
          items: {
            $ref: '#/definitions/webResponse',
          },
        },

        properties: {
          description:
            'Key/value pairs that provide additional information about the external properties.',
          $ref: '#/definitions/propertyBag',
        },
      },
    },

    externalPropertyFileReference: {
      description:
        'Contains information that enables a SARIF consumer to locate the external property file that contains the value of an externalized property associated with the run.',
      type: 'object',
      additionalProperties: false,
      properties: {
        location: {
          description: 'The location of the external property file.',
          $ref: '#/definitions/artifactLocation',
        },

        guid: {
          description:
            'A stable, unique identifier for the external property file in the form of a GUID.',
          type: 'string',
          pattern:
            '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$',
        },

        itemCount: {
          description:
            'A non-negative integer specifying the number of items contained in the external property file.',
          type: 'integer',
          default: -1,
          minimum: -1,
        },

        properties: {
          description:
            'Key/value pairs that provide additional information about the external property file.',
          $ref: '#/definitions/propertyBag',
        },
      },
      anyOf: [{ required: ['location'] }, { required: ['guid'] }],
    },

    externalPropertyFileReferences: {
      description:
        'References to external property files that should be inlined with the content of a root log file.',
      additionalProperties: false,
      type: 'object',
      properties: {
        conversion: {
          description:
            'An external property file containing a run.conversion object to be merged with the root log file.',
          $ref: '#/definitions/externalPropertyFileReference',
        },

        graphs: {
          description:
            'An array of external property files containing a run.graphs object to be merged with the root log file.',
          type: 'array',
          minItems: 0,
          uniqueItems: true,
          default: [],
          items: {
            $ref: '#/definitions/externalPropertyFileReference',
          },
        },

        externalizedProperties: {
          description:
            'An external property file containing a run.properties object to be merged with the root log file.',
          $ref: '#/definitions/externalPropertyFileReference',
        },

        artifacts: {
          description:
            'An array of external property files containing run.artifacts arrays to be merged with the root log file.',
          type: 'array',
          minItems: 0,
          uniqueItems: true,
          default: [],
          items: {
            $ref: '#/definitions/externalPropertyFileReference',
          },
        },

        invocations: {
          description:
            'An array of external property files containing run.invocations arrays to be merged with the root log file.',
          type: 'array',
          minItems: 0,
          uniqueItems: true,
          default: [],
          items: {
            $ref: '#/definitions/externalPropertyFileReference',
          },
        },

        logicalLocations: {
          description:
            'An array of external property files containing run.logicalLocations arrays to be merged with the root log file.',
          type: 'array',
          minItems: 0,
          uniqueItems: true,
          default: [],
          items: {
            $ref: '#/definitions/externalPropertyFileReference',
          },
        },

        threadFlowLocations: {
          description:
            'An array of external property files containing run.threadFlowLocations arrays to be merged with the root log file.',
          type: 'array',
          minItems: 0,
          uniqueItems: true,
          default: [],
          items: {
            $ref: '#/definitions/externalPropertyFileReference',
          },
        },

        results: {
          description:
            'An array of external property files containing run.results arrays to be merged with the root log file.',
          type: 'array',
          minItems: 0,
          uniqueItems: true,
          default: [],
          items: {
            $ref: '#/definitions/externalPropertyFileReference',
          },
        },

        taxonomies: {
          description:
            'An array of external property files containing run.taxonomies arrays to be merged with the root log file.',
          type: 'array',
          minItems: 0,
          uniqueItems: true,
          default: [],
          items: {
            $ref: '#/definitions/externalPropertyFileReference',
          },
        },

        addresses: {
          description:
            'An array of external property files containing run.addresses arrays to be merged with the root log file.',
          type: 'array',
          minItems: 0,
          uniqueItems: true,
          default: [],
          items: {
            $ref: '#/definitions/externalPropertyFileReference',
          },
        },

        driver: {
          description:
            'An external property file containing a run.driver object to be merged with the root log file.',
          $ref: '#/definitions/externalPropertyFileReference',
        },

        extensions: {
          description:
            'An array of external property files containing run.extensions arrays to be merged with the root log file.',
          type: 'array',
          minItems: 0,
          uniqueItems: true,
          default: [],
          items: {
            $ref: '#/definitions/externalPropertyFileReference',
          },
        },

        policies: {
          description:
            'An array of external property files containing run.policies arrays to be merged with the root log file.',
          type: 'array',
          minItems: 0,
          uniqueItems: true,
          default: [],
          items: {
            $ref: '#/definitions/externalPropertyFileReference',
          },
        },

        translations: {
          description:
            'An array of external property files containing run.translations arrays to be merged with the root log file.',
          type: 'array',
          minItems: 0,
          uniqueItems: true,
          default: [],
          items: {
            $ref: '#/definitions/externalPropertyFileReference',
          },
        },

        webRequests: {
          description:
            'An array of external property files containing run.requests arrays to be merged with the root log file.',
          type: 'array',
          minItems: 0,
          uniqueItems: true,
          default: [],
          items: {
            $ref: '#/definitions/externalPropertyFileReference',
          },
        },

        webResponses: {
          description:
            'An array of external property files containing run.responses arrays to be merged with the root log file.',
          type: 'array',
          minItems: 0,
          uniqueItems: true,
          default: [],
          items: {
            $ref: '#/definitions/externalPropertyFileReference',
          },
        },

        properties: {
          description:
            'Key/value pairs that provide additional information about the external property files.',
          $ref: '#/definitions/propertyBag',
        },
      },
    },

    fix: {
      description:
        'A proposed fix for the problem represented by a result object. A fix specifies a set of artifacts to modify. For each artifact, it specifies a set of bytes to remove, and provides a set of new bytes to replace them.',
      additionalProperties: false,
      type: 'object',
      properties: {
        description: {
          description:
            'A message that describes the proposed fix, enabling viewers to present the proposed change to an end user.',
          $ref: '#/definitions/message',
        },

        artifactChanges: {
          description:
            'One or more artifact changes that comprise a fix for a result.',
          type: 'array',
          minItems: 1,
          uniqueItems: true,
          items: {
            $ref: '#/definitions/artifactChange',
          },
        },

        properties: {
          description:
            'Key/value pairs that provide additional information about the fix.',
          $ref: '#/definitions/propertyBag',
        },
      },
      required: ['artifactChanges'],
    },

    graph: {
      description:
        'A network of nodes and directed edges that describes some aspect of the structure of the code (for example, a call graph).',
      type: 'object',
      additionalProperties: false,
      properties: {
        description: {
          description: 'A description of the graph.',
          $ref: '#/definitions/message',
        },

        nodes: {
          description:
            'An array of node objects representing the nodes of the graph.',
          type: 'array',
          minItems: 0,
          uniqueItems: true,
          default: [],
          items: {
            $ref: '#/definitions/node',
          },
        },

        edges: {
          description:
            'An array of edge objects representing the edges of the graph.',
          type: 'array',
          minItems: 0,
          uniqueItems: true,
          default: [],
          items: {
            $ref: '#/definitions/edge',
          },
        },

        properties: {
          description:
            'Key/value pairs that provide additional information about the graph.',
          $ref: '#/definitions/propertyBag',
        },
      },
    },

    graphTraversal: {
      description: 'Represents a path through a graph.',
      type: 'object',
      additionalProperties: false,
      properties: {
        runGraphIndex: {
          description:
            'The index within the run.graphs to be associated with the result.',
          type: 'integer',
          default: -1,
          minimum: -1,
        },

        resultGraphIndex: {
          description:
            'The index within the result.graphs to be associated with the result.',
          type: 'integer',
          default: -1,
          minimum: -1,
        },

        description: {
          description: 'A description of this graph traversal.',
          $ref: '#/definitions/message',
        },

        initialState: {
          description:
            'Values of relevant expressions at the start of the graph traversal that may change during graph traversal.',
          type: 'object',
          additionalProperties: {
            $ref: '#/definitions/multiformatMessageString',
          },
        },

        immutableState: {
          description:
            'Values of relevant expressions at the start of the graph traversal that remain constant for the graph traversal.',
          type: 'object',
          additionalProperties: {
            $ref: '#/definitions/multiformatMessageString',
          },
        },

        edgeTraversals: {
          description:
            'The sequences of edges traversed by this graph traversal.',
          type: 'array',
          minItems: 0,
          uniqueItems: false,
          default: [],
          items: {
            $ref: '#/definitions/edgeTraversal',
          },
        },

        properties: {
          description:
            'Key/value pairs that provide additional information about the graph traversal.',
          $ref: '#/definitions/propertyBag',
        },
      },
      oneOf: [
        { required: ['runGraphIndex'] },
        { required: ['resultGraphIndex'] },
      ],
    },

    invocation: {
      description: 'The runtime environment of the analysis tool run.',
      additionalProperties: false,
      type: 'object',
      properties: {
        commandLine: {
          description: 'The command line used to invoke the tool.',
          type: 'string',
        },

        arguments: {
          description:
            'An array of strings, containing in order the command line arguments passed to the tool from the operating system.',
          type: 'array',
          minItems: 0,
          uniqueItems: false,
          items: {
            type: 'string',
          },
        },

        responseFiles: {
          description:
            "The locations of any response files specified on the tool's command line.",
          type: 'array',
          minItems: 0,
          uniqueItems: true,
          items: {
            $ref: '#/definitions/artifactLocation',
          },
        },

        startTimeUtc: {
          description:
            'The Coordinated Universal Time (UTC) date and time at which the invocation started. See "Date/time properties" in the SARIF spec for the required format.',
          type: 'string',
          format: 'date-time',
        },

        endTimeUtc: {
          description:
            'The Coordinated Universal Time (UTC) date and time at which the invocation ended. See "Date/time properties" in the SARIF spec for the required format.',
          type: 'string',
          format: 'date-time',
        },

        exitCode: {
          description: 'The process exit code.',
          type: 'integer',
        },

        ruleConfigurationOverrides: {
          description:
            'An array of configurationOverride objects that describe rules related runtime overrides.',
          type: 'array',
          minItems: 0,
          default: [],
          uniqueItems: true,
          items: {
            $ref: '#/definitions/configurationOverride',
          },
        },

        notificationConfigurationOverrides: {
          description:
            'An array of configurationOverride objects that describe notifications related runtime overrides.',
          type: 'array',
          minItems: 0,
          default: [],
          uniqueItems: true,
          items: {
            $ref: '#/definitions/configurationOverride',
          },
        },

        toolExecutionNotifications: {
          description:
            'A list of runtime conditions detected by the tool during the analysis.',
          type: 'array',
          minItems: 0,
          uniqueItems: false,
          default: [],
          items: {
            $ref: '#/definitions/notification',
          },
        },

        toolConfigurationNotifications: {
          description:
            "A list of conditions detected by the tool that are relevant to the tool's configuration.",
          type: 'array',
          minItems: 0,
          uniqueItems: false,
          default: [],
          items: {
            $ref: '#/definitions/notification',
          },
        },

        exitCodeDescription: {
          description: 'The reason for the process exit.',
          type: 'string',
        },

        exitSignalName: {
          description:
            'The name of the signal that caused the process to exit.',
          type: 'string',
        },

        exitSignalNumber: {
          description:
            'The numeric value of the signal that caused the process to exit.',
          type: 'integer',
        },

        processStartFailureMessage: {
          description:
            'The reason given by the operating system that the process failed to start.',
          type: 'string',
        },

        executionSuccessful: {
          description:
            "Specifies whether the tool's execution completed successfully.",
          type: 'boolean',
        },

        machine: {
          description: 'The machine on which the invocation occurred.',
          type: 'string',
        },

        account: {
          description: 'The account under which the invocation occurred.',
          type: 'string',
        },

        processId: {
          description:
            'The id of the process in which the invocation occurred.',
          type: 'integer',
        },

        executableLocation: {
          description:
            'An absolute URI specifying the location of the executable that was invoked.',
          $ref: '#/definitions/artifactLocation',
        },

        workingDirectory: {
          description: 'The working directory for the invocation.',
          $ref: '#/definitions/artifactLocation',
        },

        environmentVariables: {
          description:
            'The environment variables associated with the analysis tool process, expressed as key/value pairs.',
          type: 'object',
          additionalProperties: {
            type: 'string',
          },
        },

        stdin: {
          description:
            'A file containing the standard input stream to the process that was invoked.',
          $ref: '#/definitions/artifactLocation',
        },

        stdout: {
          description:
            'A file containing the standard output stream from the process that was invoked.',
          $ref: '#/definitions/artifactLocation',
        },

        stderr: {
          description:
            'A file containing the standard error stream from the process that was invoked.',
          $ref: '#/definitions/artifactLocation',
        },

        stdoutStderr: {
          description:
            'A file containing the interleaved standard output and standard error stream from the process that was invoked.',
          $ref: '#/definitions/artifactLocation',
        },

        properties: {
          description:
            'Key/value pairs that provide additional information about the invocation.',
          $ref: '#/definitions/propertyBag',
        },
      },
      required: ['executionSuccessful'],
    },

    location: {
      description: 'A location within a programming artifact.',
      additionalProperties: false,
      type: 'object',
      properties: {
        id: {
          description:
            'Value that distinguishes this location from all other locations within a single result object.',
          type: 'integer',
          minimum: -1,
          default: -1,
        },

        physicalLocation: {
          description: 'Identifies the artifact and region.',
          $ref: '#/definitions/physicalLocation',
        },

        logicalLocations: {
          description: 'The logical locations associated with the result.',
          type: 'array',
          minItems: 0,
          uniqueItems: true,
          default: [],
          items: {
            $ref: '#/definitions/logicalLocation',
          },
        },

        message: {
          description: 'A message relevant to the location.',
          $ref: '#/definitions/message',
        },

        annotations: {
          description: 'A set of regions relevant to the location.',
          type: 'array',
          minItems: 0,
          uniqueItems: true,
          default: [],
          items: {
            $ref: '#/definitions/region',
          },
        },

        relationships: {
          description:
            'An array of objects that describe relationships between this location and others.',
          type: 'array',
          default: [],
          minItems: 0,
          uniqueItems: true,
          items: {
            $ref: '#/definitions/locationRelationship',
          },
        },

        properties: {
          description:
            'Key/value pairs that provide additional information about the location.',
          $ref: '#/definitions/propertyBag',
        },
      },
    },

    locationRelationship: {
      description: 'Information about the relation of one location to another.',
      type: 'object',
      additionalProperties: false,
      properties: {
        target: {
          description: 'A reference to the related location.',
          type: 'integer',
          minimum: 0,
        },

        kinds: {
          description:
            "A set of distinct strings that categorize the relationship. Well-known kinds include 'includes', 'isIncludedBy' and 'relevant'.",
          type: 'array',
          default: ['relevant'],
          uniqueItems: true,
          items: {
            type: 'string',
          },
        },

        description: {
          description: 'A description of the location relationship.',
          $ref: '#/definitions/message',
        },

        properties: {
          description:
            'Key/value pairs that provide additional information about the location relationship.',
          $ref: '#/definitions/propertyBag',
        },
      },
      required: ['target'],
    },

    logicalLocation: {
      description: 'A logical location of a construct that produced a result.',
      additionalProperties: false,
      type: 'object',
      properties: {
        name: {
          description:
            'Identifies the construct in which the result occurred. For example, this property might contain the name of a class or a method.',
          type: 'string',
        },

        index: {
          description: 'The index within the logical locations array.',
          type: 'integer',
          default: -1,
          minimum: -1,
        },

        fullyQualifiedName: {
          description:
            'The human-readable fully qualified name of the logical location.',
          type: 'string',
        },

        decoratedName: {
          description:
            'The machine-readable name for the logical location, such as a mangled function name provided by a C++ compiler that encodes calling convention, return type and other details along with the function name.',
          type: 'string',
        },

        parentIndex: {
          description:
            'Identifies the index of the immediate parent of the construct in which the result was detected. For example, this property might point to a logical location that represents the namespace that holds a type.',
          type: 'integer',
          default: -1,
          minimum: -1,
        },

        kind: {
          description:
            "The type of construct this logical location component refers to. Should be one of 'function', 'member', 'module', 'namespace', 'parameter', 'resource', 'returnType', 'type', 'variable', 'object', 'array', 'property', 'value', 'element', 'text', 'attribute', 'comment', 'declaration', 'dtd' or 'processingInstruction', if any of those accurately describe the construct.",
          type: 'string',
        },

        properties: {
          description:
            'Key/value pairs that provide additional information about the logical location.',
          $ref: '#/definitions/propertyBag',
        },
      },
    },

    message: {
      description:
        'Encapsulates a message intended to be read by the end user.',
      type: 'object',
      additionalProperties: false,

      properties: {
        text: {
          description: 'A plain text message string.',
          type: 'string',
        },

        markdown: {
          description: 'A Markdown message string.',
          type: 'string',
        },

        id: {
          description: 'The identifier for this message.',
          type: 'string',
        },

        arguments: {
          description:
            'An array of strings to substitute into the message string.',
          type: 'array',
          minItems: 0,
          uniqueItems: false,
          default: [],
          items: {
            type: 'string',
          },
        },

        properties: {
          description:
            'Key/value pairs that provide additional information about the message.',
          $ref: '#/definitions/propertyBag',
        },
      },
      anyOf: [{ required: ['text'] }, { required: ['id'] }],
    },

    multiformatMessageString: {
      description:
        'A message string or message format string rendered in multiple formats.',
      type: 'object',
      additionalProperties: false,

      properties: {
        text: {
          description: 'A plain text message string or format string.',
          type: 'string',
        },

        markdown: {
          description: 'A Markdown message string or format string.',
          type: 'string',
        },

        properties: {
          description:
            'Key/value pairs that provide additional information about the message.',
          $ref: '#/definitions/propertyBag',
        },
      },
      required: ['text'],
    },

    node: {
      description: 'Represents a node in a graph.',
      type: 'object',
      additionalProperties: false,

      properties: {
        id: {
          description:
            'A string that uniquely identifies the node within its graph.',
          type: 'string',
        },

        label: {
          description: 'A short description of the node.',
          $ref: '#/definitions/message',
        },

        location: {
          description: 'A code location associated with the node.',
          $ref: '#/definitions/location',
        },

        children: {
          description: 'Array of child nodes.',
          type: 'array',
          minItems: 0,
          uniqueItems: true,
          default: [],
          items: {
            $ref: '#/definitions/node',
          },
        },

        properties: {
          description:
            'Key/value pairs that provide additional information about the node.',
          $ref: '#/definitions/propertyBag',
        },
      },

      required: ['id'],
    },

    notification: {
      description:
        'Describes a condition relevant to the tool itself, as opposed to being relevant to a target being analyzed by the tool.',
      type: 'object',
      additionalProperties: false,
      properties: {
        locations: {
          description: 'The locations relevant to this notification.',
          type: 'array',
          minItems: 0,
          uniqueItems: true,
          default: [],
          items: {
            $ref: '#/definitions/location',
          },
        },

        message: {
          description:
            'A message that describes the condition that was encountered.',
          $ref: '#/definitions/message',
        },

        level: {
          description:
            'A value specifying the severity level of the notification.',
          default: 'warning',
          enum: ['none', 'note', 'warning', 'error'],
          type: 'string',
        },

        threadId: {
          description:
            'The thread identifier of the code that generated the notification.',
          type: 'integer',
        },

        timeUtc: {
          description:
            'The Coordinated Universal Time (UTC) date and time at which the analysis tool generated the notification.',
          type: 'string',
          format: 'date-time',
        },

        exception: {
          description:
            'The runtime exception, if any, relevant to this notification.',
          $ref: '#/definitions/exception',
        },

        descriptor: {
          description:
            'A reference used to locate the descriptor relevant to this notification.',
          $ref: '#/definitions/reportingDescriptorReference',
        },

        associatedRule: {
          description:
            'A reference used to locate the rule descriptor associated with this notification.',
          $ref: '#/definitions/reportingDescriptorReference',
        },

        properties: {
          description:
            'Key/value pairs that provide additional information about the notification.',
          $ref: '#/definitions/propertyBag',
        },
      },

      required: ['message'],
    },

    physicalLocation: {
      description:
        'A physical location relevant to a result. Specifies a reference to a programming artifact together with a range of bytes or characters within that artifact.',
      additionalProperties: false,
      type: 'object',
      properties: {
        address: {
          description: 'The address of the location.',
          $ref: '#/definitions/address',
        },

        artifactLocation: {
          description: 'The location of the artifact.',
          $ref: '#/definitions/artifactLocation',
        },

        region: {
          description: 'Specifies a portion of the artifact.',
          $ref: '#/definitions/region',
        },

        contextRegion: {
          description:
            'Specifies a portion of the artifact that encloses the region. Allows a viewer to display additional context around the region.',
          $ref: '#/definitions/region',
        },

        properties: {
          description:
            'Key/value pairs that provide additional information about the physical location.',
          $ref: '#/definitions/propertyBag',
        },
      },

      anyOf: [
        {
          required: ['address'],
        },
        {
          required: ['artifactLocation'],
        },
      ],
    },

    propertyBag: {
      description:
        'Key/value pairs that provide additional information about the object.',
      type: 'object',
      additionalProperties: true,
      properties: {
        tags: {
          description:
            'A set of distinct strings that provide additional information.',
          type: 'array',
          minItems: 0,
          uniqueItems: true,
          default: [],
          items: {
            type: 'string',
          },
        },
      },
    },

    rectangle: {
      description: 'An area within an image.',
      additionalProperties: false,
      type: 'object',
      properties: {
        top: {
          description:
            "The Y coordinate of the top edge of the rectangle, measured in the image's natural units.",
          type: 'number',
        },

        left: {
          description:
            "The X coordinate of the left edge of the rectangle, measured in the image's natural units.",
          type: 'number',
        },

        bottom: {
          description:
            "The Y coordinate of the bottom edge of the rectangle, measured in the image's natural units.",
          type: 'number',
        },

        right: {
          description:
            "The X coordinate of the right edge of the rectangle, measured in the image's natural units.",
          type: 'number',
        },

        message: {
          description: 'A message relevant to the rectangle.',
          $ref: '#/definitions/message',
        },

        properties: {
          description:
            'Key/value pairs that provide additional information about the rectangle.',
          $ref: '#/definitions/propertyBag',
        },
      },
    },

    region: {
      description: 'A region within an artifact where a result was detected.',
      additionalProperties: false,
      type: 'object',
      properties: {
        startLine: {
          description: 'The line number of the first character in the region.',
          type: 'integer',
          minimum: 1,
        },

        startColumn: {
          description:
            'The column number of the first character in the region.',
          type: 'integer',
          minimum: 1,
        },

        endLine: {
          description: 'The line number of the last character in the region.',
          type: 'integer',
          minimum: 1,
        },

        endColumn: {
          description:
            'The column number of the character following the end of the region.',
          type: 'integer',
          minimum: 1,
        },

        charOffset: {
          description:
            'The zero-based offset from the beginning of the artifact of the first character in the region.',
          type: 'integer',
          default: -1,
          minimum: -1,
        },

        charLength: {
          description: 'The length of the region in characters.',
          type: 'integer',
          minimum: 0,
        },

        byteOffset: {
          description:
            'The zero-based offset from the beginning of the artifact of the first byte in the region.',
          type: 'integer',
          default: -1,
          minimum: -1,
        },

        byteLength: {
          description: 'The length of the region in bytes.',
          type: 'integer',
          minimum: 0,
        },

        snippet: {
          description:
            'The portion of the artifact contents within the specified region.',
          $ref: '#/definitions/artifactContent',
        },

        message: {
          description: 'A message relevant to the region.',
          $ref: '#/definitions/message',
        },

        sourceLanguage: {
          description:
            'Specifies the source language, if any, of the portion of the artifact specified by the region object.',
          type: 'string',
        },

        properties: {
          description:
            'Key/value pairs that provide additional information about the region.',
          $ref: '#/definitions/propertyBag',
        },
      },

      anyOf: [
        { required: ['startLine'] },
        { required: ['charOffset'] },
        { required: ['byteOffset'] },
      ],
    },

    replacement: {
      description: 'The replacement of a single region of an artifact.',
      additionalProperties: false,
      type: 'object',
      properties: {
        deletedRegion: {
          description: 'The region of the artifact to delete.',
          $ref: '#/definitions/region',
        },

        insertedContent: {
          description:
            "The content to insert at the location specified by the 'deletedRegion' property.",
          $ref: '#/definitions/artifactContent',
        },

        properties: {
          description:
            'Key/value pairs that provide additional information about the replacement.',
          $ref: '#/definitions/propertyBag',
        },
      },

      required: ['deletedRegion'],
    },

    reportingDescriptor: {
      description:
        'Metadata that describes a specific report produced by the tool, as part of the analysis it provides or its runtime reporting.',
      additionalProperties: false,
      type: 'object',
      properties: {
        id: {
          description: 'A stable, opaque identifier for the report.',
          type: 'string',
        },

        deprecatedIds: {
          description:
            'An array of stable, opaque identifiers by which this report was known in some previous version of the analysis tool.',
          type: 'array',
          minItems: 0,
          uniqueItems: true,
          items: {
            type: 'string',
          },
        },

        guid: {
          description:
            'A unique identifier for the reporting descriptor in the form of a GUID.',
          type: 'string',
          pattern:
            '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$',
        },

        deprecatedGuids: {
          description:
            'An array of unique identifies in the form of a GUID by which this report was known in some previous version of the analysis tool.',
          type: 'array',
          minItems: 0,
          uniqueItems: true,
          items: {
            type: 'string',
            pattern:
              '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$',
          },
        },

        name: {
          description:
            'A report identifier that is understandable to an end user.',
          type: 'string',
        },

        deprecatedNames: {
          description:
            'An array of readable identifiers by which this report was known in some previous version of the analysis tool.',
          type: 'array',
          minItems: 0,
          uniqueItems: true,
          items: {
            type: 'string',
          },
        },

        shortDescription: {
          description:
            'A concise description of the report. Should be a single sentence that is understandable when visible space is limited to a single line of text.',
          $ref: '#/definitions/multiformatMessageString',
        },

        fullDescription: {
          description:
            'A description of the report. Should, as far as possible, provide details sufficient to enable resolution of any problem indicated by the result.',
          $ref: '#/definitions/multiformatMessageString',
        },

        messageStrings: {
          description:
            'A set of name/value pairs with arbitrary names. Each value is a multiformatMessageString object, which holds message strings in plain text and (optionally) Markdown format. The strings can include placeholders, which can be used to construct a message in combination with an arbitrary number of additional string arguments.',
          type: 'object',
          additionalProperties: {
            $ref: '#/definitions/multiformatMessageString',
          },
        },

        defaultConfiguration: {
          description: 'Default reporting configuration information.',
          $ref: '#/definitions/reportingConfiguration',
        },

        helpUri: {
          description:
            'A URI where the primary documentation for the report can be found.',
          type: 'string',
          format: 'uri',
        },

        help: {
          description:
            'Provides the primary documentation for the report, useful when there is no online documentation.',
          $ref: '#/definitions/multiformatMessageString',
        },

        relationships: {
          description:
            'An array of objects that describe relationships between this reporting descriptor and others.',
          type: 'array',
          default: [],
          minItems: 0,
          uniqueItems: true,
          items: {
            $ref: '#/definitions/reportingDescriptorRelationship',
          },
        },

        properties: {
          description:
            'Key/value pairs that provide additional information about the report.',
          $ref: '#/definitions/propertyBag',
        },
      },
      required: ['id'],
    },

    reportingConfiguration: {
      description:
        'Information about a rule or notification that can be configured at runtime.',
      type: 'object',
      additionalProperties: false,
      properties: {
        enabled: {
          description:
            'Specifies whether the report may be produced during the scan.',
          type: 'boolean',
          default: true,
        },

        level: {
          description: 'Specifies the failure level for the report.',
          default: 'warning',
          enum: ['none', 'note', 'warning', 'error'],
          type: 'string',
        },

        rank: {
          description:
            'Specifies the relative priority of the report. Used for analysis output only.',
          type: 'number',
          default: -1.0,
          minimum: -1.0,
          maximum: 100.0,
        },

        parameters: {
          description:
            'Contains configuration information specific to a report.',
          $ref: '#/definitions/propertyBag',
        },

        properties: {
          description:
            'Key/value pairs that provide additional information about the reporting configuration.',
          $ref: '#/definitions/propertyBag',
        },
      },
    },

    reportingDescriptorReference: {
      description:
        'Information about how to locate a relevant reporting descriptor.',
      type: 'object',
      additionalProperties: false,
      properties: {
        id: {
          description: 'The id of the descriptor.',
          type: 'string',
        },

        index: {
          description:
            'The index into an array of descriptors in toolComponent.ruleDescriptors, toolComponent.notificationDescriptors, or toolComponent.taxonomyDescriptors, depending on context.',
          type: 'integer',
          default: -1,
          minimum: -1,
        },

        guid: {
          description: 'A guid that uniquely identifies the descriptor.',
          type: 'string',
          pattern:
            '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$',
        },

        toolComponent: {
          description:
            'A reference used to locate the toolComponent associated with the descriptor.',
          $ref: '#/definitions/toolComponentReference',
        },

        properties: {
          description:
            'Key/value pairs that provide additional information about the reporting descriptor reference.',
          $ref: '#/definitions/propertyBag',
        },
      },
      anyOf: [
        { required: ['index'] },
        { required: ['guid'] },
        { required: ['id'] },
      ],
    },

    reportingDescriptorRelationship: {
      description:
        'Information about the relation of one reporting descriptor to another.',
      type: 'object',
      additionalProperties: false,
      properties: {
        target: {
          description: 'A reference to the related reporting descriptor.',
          $ref: '#/definitions/reportingDescriptorReference',
        },

        kinds: {
          description:
            "A set of distinct strings that categorize the relationship. Well-known kinds include 'canPrecede', 'canFollow', 'willPrecede', 'willFollow', 'superset', 'subset', 'equal', 'disjoint', 'relevant', and 'incomparable'.",
          type: 'array',
          default: ['relevant'],
          uniqueItems: true,
          items: {
            type: 'string',
          },
        },

        description: {
          description:
            'A description of the reporting descriptor relationship.',
          $ref: '#/definitions/message',
        },

        properties: {
          description:
            'Key/value pairs that provide additional information about the reporting descriptor reference.',
          $ref: '#/definitions/propertyBag',
        },
      },
      required: ['target'],
    },

    result: {
      description: 'A result produced by an analysis tool.',
      additionalProperties: false,
      type: 'object',
      properties: {
        ruleId: {
          description:
            'The stable, unique identifier of the rule, if any, to which this result is relevant.',
          type: 'string',
        },

        ruleIndex: {
          description:
            'The index within the tool component rules array of the rule object associated with this result.',
          type: 'integer',
          default: -1,
          minimum: -1,
        },

        rule: {
          description:
            'A reference used to locate the rule descriptor relevant to this result.',
          $ref: '#/definitions/reportingDescriptorReference',
        },

        kind: {
          description: 'A value that categorizes results by evaluation state.',
          default: 'fail',
          enum: [
            'notApplicable',
            'pass',
            'fail',
            'review',
            'open',
            'informational',
          ],
          type: 'string',
        },

        level: {
          description: 'A value specifying the severity level of the result.',
          default: 'warning',
          enum: ['none', 'note', 'warning', 'error'],
          type: 'string',
        },

        message: {
          description:
            'A message that describes the result. The first sentence of the message only will be displayed when visible space is limited.',
          $ref: '#/definitions/message',
        },

        analysisTarget: {
          description:
            'Identifies the artifact that the analysis tool was instructed to scan. This need not be the same as the artifact where the result actually occurred.',
          $ref: '#/definitions/artifactLocation',
        },

        locations: {
          description:
            'The set of locations where the result was detected. Specify only one location unless the problem indicated by the result can only be corrected by making a change at every specified location.',
          type: 'array',
          minItems: 0,
          uniqueItems: false,
          default: [],
          items: {
            $ref: '#/definitions/location',
          },
        },

        guid: {
          description:
            'A stable, unique identifier for the result in the form of a GUID.',
          type: 'string',
          pattern:
            '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$',
        },

        correlationGuid: {
          description:
            'A stable, unique identifier for the equivalence class of logically identical results to which this result belongs, in the form of a GUID.',
          type: 'string',
          pattern:
            '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$',
        },

        occurrenceCount: {
          description:
            'A positive integer specifying the number of times this logically unique result was observed in this run.',
          type: 'integer',
          minimum: 1,
        },

        partialFingerprints: {
          description:
            'A set of strings that contribute to the stable, unique identity of the result.',
          type: 'object',
          additionalProperties: {
            type: 'string',
          },
        },

        fingerprints: {
          description:
            'A set of strings each of which individually defines a stable, unique identity for the result.',
          type: 'object',
          additionalProperties: {
            type: 'string',
          },
        },

        stacks: {
          description: "An array of 'stack' objects relevant to the result.",
          type: 'array',
          minItems: 0,
          uniqueItems: true,
          default: [],
          items: {
            $ref: '#/definitions/stack',
          },
        },

        codeFlows: {
          description: "An array of 'codeFlow' objects relevant to the result.",
          type: 'array',
          minItems: 0,
          uniqueItems: false,
          default: [],
          items: {
            $ref: '#/definitions/codeFlow',
          },
        },

        graphs: {
          description:
            'An array of zero or more unique graph objects associated with the result.',
          type: 'array',
          minItems: 0,
          uniqueItems: true,
          default: [],
          items: {
            $ref: '#/definitions/graph',
          },
        },

        graphTraversals: {
          description:
            "An array of one or more unique 'graphTraversal' objects.",
          type: 'array',
          minItems: 0,
          uniqueItems: true,
          default: [],
          items: {
            $ref: '#/definitions/graphTraversal',
          },
        },

        relatedLocations: {
          description: 'A set of locations relevant to this result.',
          type: 'array',
          minItems: 0,
          uniqueItems: true,
          default: [],
          items: {
            $ref: '#/definitions/location',
          },
        },

        suppressions: {
          description: 'A set of suppressions relevant to this result.',
          type: 'array',
          minItems: 0,
          uniqueItems: true,
          items: {
            $ref: '#/definitions/suppression',
          },
        },

        baselineState: {
          description:
            'The state of a result relative to a baseline of a previous run.',
          enum: ['new', 'unchanged', 'updated', 'absent'],
          type: 'string',
        },

        rank: {
          description:
            'A number representing the priority or importance of the result.',
          type: 'number',
          default: -1.0,
          minimum: -1.0,
          maximum: 100.0,
        },

        attachments: {
          description: 'A set of artifacts relevant to the result.',
          type: 'array',
          minItems: 0,
          uniqueItems: true,
          default: [],
          items: {
            $ref: '#/definitions/attachment',
          },
        },

        hostedViewerUri: {
          description: 'An absolute URI at which the result can be viewed.',
          type: 'string',
          format: 'uri',
        },

        workItemUris: {
          description:
            'The URIs of the work items associated with this result.',
          type: 'array',
          minItems: 0,
          uniqueItems: true,
          items: {
            type: 'string',
            format: 'uri',
          },
        },

        provenance: {
          description:
            'Information about how and when the result was detected.',
          $ref: '#/definitions/resultProvenance',
        },

        fixes: {
          description:
            "An array of 'fix' objects, each of which represents a proposed fix to the problem indicated by the result.",
          type: 'array',
          minItems: 0,
          uniqueItems: true,
          default: [],
          items: {
            $ref: '#/definitions/fix',
          },
        },

        taxa: {
          description:
            'An array of references to taxonomy reporting descriptors that are applicable to the result.',
          type: 'array',
          default: [],
          minItems: 0,
          uniqueItems: true,
          items: {
            $ref: '#/definitions/reportingDescriptorReference',
          },
        },

        webRequest: {
          description: 'A web request associated with this result.',
          $ref: '#/definitions/webRequest',
        },

        webResponse: {
          description: 'A web response associated with this result.',
          $ref: '#/definitions/webResponse',
        },

        properties: {
          description:
            'Key/value pairs that provide additional information about the result.',
          $ref: '#/definitions/propertyBag',
        },
      },
      required: ['message'],
    },

    resultProvenance: {
      description:
        'Contains information about how and when a result was detected.',
      additionalProperties: false,
      type: 'object',
      properties: {
        firstDetectionTimeUtc: {
          description:
            'The Coordinated Universal Time (UTC) date and time at which the result was first detected. See "Date/time properties" in the SARIF spec for the required format.',
          type: 'string',
          format: 'date-time',
        },

        lastDetectionTimeUtc: {
          description:
            'The Coordinated Universal Time (UTC) date and time at which the result was most recently detected. See "Date/time properties" in the SARIF spec for the required format.',
          type: 'string',
          format: 'date-time',
        },

        firstDetectionRunGuid: {
          description:
            'A GUID-valued string equal to the automationDetails.guid property of the run in which the result was first detected.',
          type: 'string',
          pattern:
            '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$',
        },

        lastDetectionRunGuid: {
          description:
            'A GUID-valued string equal to the automationDetails.guid property of the run in which the result was most recently detected.',
          type: 'string',
          pattern:
            '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$',
        },

        invocationIndex: {
          description:
            'The index within the run.invocations array of the invocation object which describes the tool invocation that detected the result.',
          type: 'integer',
          default: -1,
          minimum: -1,
        },

        conversionSources: {
          description:
            "An array of physicalLocation objects which specify the portions of an analysis tool's output that a converter transformed into the result.",
          type: 'array',
          minItems: 0,
          uniqueItems: true,
          default: [],
          items: {
            $ref: '#/definitions/physicalLocation',
          },
        },

        properties: {
          description:
            'Key/value pairs that provide additional information about the result.',
          $ref: '#/definitions/propertyBag',
        },
      },
    },

    run: {
      description:
        'Describes a single run of an analysis tool, and contains the reported output of that run.',
      additionalProperties: false,
      type: 'object',
      properties: {
        tool: {
          description:
            'Information about the tool or tool pipeline that generated the results in this run. A run can only contain results produced by a single tool or tool pipeline. A run can aggregate results from multiple log files, as long as context around the tool run (tool command-line arguments and the like) is identical for all aggregated files.',
          $ref: '#/definitions/tool',
        },

        invocations: {
          description: 'Describes the invocation of the analysis tool.',
          type: 'array',
          minItems: 0,
          uniqueItems: false,
          default: [],
          items: {
            $ref: '#/definitions/invocation',
          },
        },

        conversion: {
          description:
            "A conversion object that describes how a converter transformed an analysis tool's native reporting format into the SARIF format.",
          $ref: '#/definitions/conversion',
        },

        language: {
          description:
            'The language of the messages emitted into the log file during this run (expressed as an ISO 639-1 two-letter lowercase culture code) and an optional region (expressed as an ISO 3166-1 two-letter uppercase subculture code associated with a country or region). The casing is recommended but not required (in order for this data to conform to RFC5646).',
          type: 'string',
          default: 'en-US',
          pattern: '^[a-zA-Z]{2}(-[a-zA-Z]{2})?$',
        },

        versionControlProvenance: {
          description:
            'Specifies the revision in version control of the artifacts that were scanned.',
          type: 'array',
          minItems: 0,
          uniqueItems: true,
          default: [],
          items: {
            $ref: '#/definitions/versionControlDetails',
          },
        },

        originalUriBaseIds: {
          description:
            'The artifact location specified by each uriBaseId symbol on the machine where the tool originally ran.',
          type: 'object',
          additionalProperties: {
            $ref: '#/definitions/artifactLocation',
          },
        },

        artifacts: {
          description: 'An array of artifact objects relevant to the run.',
          type: 'array',
          minItems: 0,
          uniqueItems: true,
          items: {
            $ref: '#/definitions/artifact',
          },
        },

        logicalLocations: {
          description:
            'An array of logical locations such as namespaces, types or functions.',
          type: 'array',
          minItems: 0,
          uniqueItems: true,
          default: [],
          items: {
            $ref: '#/definitions/logicalLocation',
          },
        },

        graphs: {
          description:
            'An array of zero or more unique graph objects associated with the run.',
          type: 'array',
          minItems: 0,
          uniqueItems: true,
          default: [],
          items: {
            $ref: '#/definitions/graph',
          },
        },

        results: {
          description:
            'The set of results contained in an SARIF log. The results array can be omitted when a run is solely exporting rules metadata. It must be present (but may be empty) if a log file represents an actual scan.',
          type: 'array',
          minItems: 0,
          uniqueItems: false,
          items: {
            $ref: '#/definitions/result',
          },
        },

        automationDetails: {
          description: 'Automation details that describe this run.',
          $ref: '#/definitions/runAutomationDetails',
        },

        runAggregates: {
          description:
            'Automation details that describe the aggregate of runs to which this run belongs.',
          type: 'array',
          minItems: 0,
          uniqueItems: true,
          default: [],
          items: {
            $ref: '#/definitions/runAutomationDetails',
          },
        },

        baselineGuid: {
          description:
            "The 'guid' property of a previous SARIF 'run' that comprises the baseline that was used to compute result 'baselineState' properties for the run.",
          type: 'string',
          pattern:
            '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$',
        },

        redactionTokens: {
          description:
            'An array of strings used to replace sensitive information in a redaction-aware property.',
          type: 'array',
          minItems: 0,
          uniqueItems: true,
          default: [],
          items: {
            type: 'string',
          },
        },

        defaultEncoding: {
          description:
            'Specifies the default encoding for any artifact object that refers to a text file.',
          type: 'string',
        },

        defaultSourceLanguage: {
          description:
            'Specifies the default source language for any artifact object that refers to a text file that contains source code.',
          type: 'string',
        },

        newlineSequences: {
          description:
            'An ordered list of character sequences that were treated as line breaks when computing region information for the run.',
          type: 'array',
          minItems: 1,
          uniqueItems: true,
          default: ['\r\n', '\n'],
          items: {
            type: 'string',
          },
        },

        columnKind: {
          description: 'Specifies the unit in which the tool measures columns.',
          enum: ['utf16CodeUnits', 'unicodeCodePoints'],
          type: 'string',
        },

        externalPropertyFileReferences: {
          description:
            'References to external property files that should be inlined with the content of a root log file.',
          $ref: '#/definitions/externalPropertyFileReferences',
        },

        threadFlowLocations: {
          description:
            'An array of threadFlowLocation objects cached at run level.',
          type: 'array',
          minItems: 0,
          uniqueItems: true,
          default: [],
          items: {
            $ref: '#/definitions/threadFlowLocation',
          },
        },

        taxonomies: {
          description:
            'An array of toolComponent objects relevant to a taxonomy in which results are categorized.',
          type: 'array',
          minItems: 0,
          uniqueItems: true,
          default: [],
          items: {
            $ref: '#/definitions/toolComponent',
          },
        },

        addresses: {
          description: 'Addresses associated with this run instance, if any.',
          type: 'array',
          minItems: 0,
          uniqueItems: false,
          default: [],
          items: {
            $ref: '#/definitions/address',
          },
        },

        translations: {
          description:
            'The set of available translations of the localized data provided by the tool.',
          type: 'array',
          minItems: 0,
          uniqueItems: true,
          default: [],
          items: {
            $ref: '#/definitions/toolComponent',
          },
        },

        policies: {
          description:
            "Contains configurations that may potentially override both reportingDescriptor.defaultConfiguration (the tool's default severities) and invocation.configurationOverrides (severities established at run-time from the command line).",
          type: 'array',
          minItems: 0,
          uniqueItems: true,
          default: [],
          items: {
            $ref: '#/definitions/toolComponent',
          },
        },

        webRequests: {
          description: 'An array of request objects cached at run level.',
          type: 'array',
          minItems: 0,
          uniqueItems: true,
          default: [],
          items: {
            $ref: '#/definitions/webRequest',
          },
        },

        webResponses: {
          description: 'An array of response objects cached at run level.',
          type: 'array',
          minItems: 0,
          uniqueItems: true,
          default: [],
          items: {
            $ref: '#/definitions/webResponse',
          },
        },

        specialLocations: {
          description:
            'A specialLocations object that defines locations of special significance to SARIF consumers.',
          $ref: '#/definitions/specialLocations',
        },

        properties: {
          description:
            'Key/value pairs that provide additional information about the run.',
          $ref: '#/definitions/propertyBag',
        },
      },

      required: ['tool'],
    },

    runAutomationDetails: {
      description:
        "Information that describes a run's identity and role within an engineering system process.",
      additionalProperties: false,
      type: 'object',
      properties: {
        description: {
          description:
            "A description of the identity and role played within the engineering system by this object's containing run object.",
          $ref: '#/definitions/message',
        },

        id: {
          description:
            "A hierarchical string that uniquely identifies this object's containing run object.",
          type: 'string',
        },

        guid: {
          description:
            "A stable, unique identifier for this object's containing run object in the form of a GUID.",
          type: 'string',
          pattern:
            '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$',
        },

        correlationGuid: {
          description:
            "A stable, unique identifier for the equivalence class of runs to which this object's containing run object belongs in the form of a GUID.",
          type: 'string',
          pattern:
            '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$',
        },

        properties: {
          description:
            'Key/value pairs that provide additional information about the run automation details.',
          $ref: '#/definitions/propertyBag',
        },
      },
    },

    specialLocations: {
      description:
        'Defines locations of special significance to SARIF consumers.',
      type: 'object',
      additionalProperties: false,
      properties: {
        displayBase: {
          description:
            'Provides a suggestion to SARIF consumers to display file paths relative to the specified location.',
          $ref: '#/definitions/artifactLocation',
        },

        properties: {
          description:
            'Key/value pairs that provide additional information about the special locations.',
          $ref: '#/definitions/propertyBag',
        },
      },
    },

    stack: {
      description: 'A call stack that is relevant to a result.',
      additionalProperties: false,
      type: 'object',
      properties: {
        message: {
          description: 'A message relevant to this call stack.',
          $ref: '#/definitions/message',
        },

        frames: {
          description:
            'An array of stack frames that represents a sequence of calls, rendered in reverse chronological order, that comprise the call stack.',
          type: 'array',
          minItems: 0,
          uniqueItems: false,
          items: {
            $ref: '#/definitions/stackFrame',
          },
        },

        properties: {
          description:
            'Key/value pairs that provide additional information about the stack.',
          $ref: '#/definitions/propertyBag',
        },
      },
      required: ['frames'],
    },

    stackFrame: {
      description: 'A function call within a stack trace.',
      additionalProperties: false,
      type: 'object',
      properties: {
        location: {
          description: 'The location to which this stack frame refers.',
          $ref: '#/definitions/location',
        },

        module: {
          description:
            'The name of the module that contains the code of this stack frame.',
          type: 'string',
        },

        threadId: {
          description: 'The thread identifier of the stack frame.',
          type: 'integer',
        },

        parameters: {
          description: 'The parameters of the call that is executing.',
          type: 'array',
          minItems: 0,
          uniqueItems: false,
          default: [],
          items: {
            type: 'string',
            default: [],
          },
        },

        properties: {
          description:
            'Key/value pairs that provide additional information about the stack frame.',
          $ref: '#/definitions/propertyBag',
        },
      },
    },

    suppression: {
      description: 'A suppression that is relevant to a result.',
      additionalProperties: false,
      type: 'object',
      properties: {
        guid: {
          description:
            'A stable, unique identifier for the suprression in the form of a GUID.',
          type: 'string',
          pattern:
            '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$',
        },

        kind: {
          description:
            'A string that indicates where the suppression is persisted.',
          enum: ['inSource', 'external'],
          type: 'string',
        },

        status: {
          description:
            'A string that indicates the review status of the suppression.',
          enum: ['accepted', 'underReview', 'rejected'],
          type: 'string',
        },

        justification: {
          description:
            'A string representing the justification for the suppression.',
          type: 'string',
        },

        location: {
          description:
            'Identifies the location associated with the suppression.',
          $ref: '#/definitions/location',
        },

        properties: {
          description:
            'Key/value pairs that provide additional information about the suppression.',
          $ref: '#/definitions/propertyBag',
        },
      },
      required: ['kind'],
    },

    threadFlow: {
      description:
        'Describes a sequence of code locations that specify a path through a single thread of execution such as an operating system or fiber.',
      type: 'object',
      additionalProperties: false,
      properties: {
        id: {
          description:
            'An string that uniquely identifies the threadFlow within the codeFlow in which it occurs.',
          type: 'string',
        },

        message: {
          description: 'A message relevant to the thread flow.',
          $ref: '#/definitions/message',
        },

        initialState: {
          description:
            'Values of relevant expressions at the start of the thread flow that may change during thread flow execution.',
          type: 'object',
          additionalProperties: {
            $ref: '#/definitions/multiformatMessageString',
          },
        },

        immutableState: {
          description:
            'Values of relevant expressions at the start of the thread flow that remain constant.',
          type: 'object',
          additionalProperties: {
            $ref: '#/definitions/multiformatMessageString',
          },
        },

        locations: {
          description:
            "A temporally ordered array of 'threadFlowLocation' objects, each of which describes a location visited by the tool while producing the result.",
          type: 'array',
          minItems: 1,
          uniqueItems: false,
          items: {
            $ref: '#/definitions/threadFlowLocation',
          },
        },

        properties: {
          description:
            'Key/value pairs that provide additional information about the thread flow.',
          $ref: '#/definitions/propertyBag',
        },
      },

      required: ['locations'],
    },

    threadFlowLocation: {
      description:
        'A location visited by an analysis tool while simulating or monitoring the execution of a program.',
      additionalProperties: false,
      type: 'object',
      properties: {
        index: {
          description: 'The index within the run threadFlowLocations array.',
          type: 'integer',
          default: -1,
          minimum: -1,
        },

        location: {
          description: 'The code location.',
          $ref: '#/definitions/location',
        },

        stack: {
          description: 'The call stack leading to this location.',
          $ref: '#/definitions/stack',
        },

        kinds: {
          description:
            "A set of distinct strings that categorize the thread flow location. Well-known kinds include 'acquire', 'release', 'enter', 'exit', 'call', 'return', 'branch', 'implicit', 'false', 'true', 'caution', 'danger', 'unknown', 'unreachable', 'taint', 'function', 'handler', 'lock', 'memory', 'resource', 'scope' and 'value'.",
          type: 'array',
          minItems: 0,
          uniqueItems: true,
          default: [],
          items: {
            type: 'string',
          },
        },

        taxa: {
          description:
            'An array of references to rule or taxonomy reporting descriptors that are applicable to the thread flow location.',
          type: 'array',
          default: [],
          minItems: 0,
          uniqueItems: true,
          items: {
            $ref: '#/definitions/reportingDescriptorReference',
          },
        },

        module: {
          description:
            'The name of the module that contains the code that is executing.',
          type: 'string',
        },

        state: {
          description:
            "A dictionary, each of whose keys specifies a variable or expression, the associated value of which represents the variable or expression value. For an annotation of kind 'continuation', for example, this dictionary might hold the current assumed values of a set of global variables.",
          type: 'object',
          additionalProperties: {
            $ref: '#/definitions/multiformatMessageString',
          },
        },

        nestingLevel: {
          description:
            'An integer representing a containment hierarchy within the thread flow.',
          type: 'integer',
          minimum: 0,
        },

        executionOrder: {
          description:
            'An integer representing the temporal order in which execution reached this location.',
          type: 'integer',
          default: -1,
          minimum: -1,
        },

        executionTimeUtc: {
          description:
            'The Coordinated Universal Time (UTC) date and time at which this location was executed.',
          type: 'string',
          format: 'date-time',
        },

        importance: {
          description:
            'Specifies the importance of this location in understanding the code flow in which it occurs. The order from most to least important is "essential", "important", "unimportant". Default: "important".',
          enum: ['important', 'essential', 'unimportant'],
          default: 'important',
          type: 'string',
        },

        webRequest: {
          description:
            'A web request associated with this thread flow location.',
          $ref: '#/definitions/webRequest',
        },

        webResponse: {
          description:
            'A web response associated with this thread flow location.',
          $ref: '#/definitions/webResponse',
        },

        properties: {
          description:
            'Key/value pairs that provide additional information about the threadflow location.',
          $ref: '#/definitions/propertyBag',
        },
      },
    },

    tool: {
      description: 'The analysis tool that was run.',
      additionalProperties: false,
      type: 'object',
      properties: {
        driver: {
          description: 'The analysis tool that was run.',
          $ref: '#/definitions/toolComponent',
        },

        extensions: {
          description:
            'Tool extensions that contributed to or reconfigured the analysis tool that was run.',
          type: 'array',
          minItems: 0,
          uniqueItems: true,
          default: [],
          items: {
            $ref: '#/definitions/toolComponent',
          },
        },

        properties: {
          description:
            'Key/value pairs that provide additional information about the tool.',
          $ref: '#/definitions/propertyBag',
        },
      },

      required: ['driver'],
    },

    toolComponent: {
      description:
        'A component, such as a plug-in or the driver, of the analysis tool that was run.',
      additionalProperties: false,
      type: 'object',
      properties: {
        guid: {
          description:
            'A unique identifier for the tool component in the form of a GUID.',
          type: 'string',
          pattern:
            '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$',
        },

        name: {
          description: 'The name of the tool component.',
          type: 'string',
        },

        organization: {
          description:
            'The organization or company that produced the tool component.',
          type: 'string',
        },

        product: {
          description: 'A product suite to which the tool component belongs.',
          type: 'string',
        },

        productSuite: {
          description:
            'A localizable string containing the name of the suite of products to which the tool component belongs.',
          type: 'string',
        },

        shortDescription: {
          description: 'A brief description of the tool component.',
          $ref: '#/definitions/multiformatMessageString',
        },

        fullDescription: {
          description: 'A comprehensive description of the tool component.',
          $ref: '#/definitions/multiformatMessageString',
        },

        fullName: {
          description:
            'The name of the tool component along with its version and any other useful identifying information, such as its locale.',
          type: 'string',
        },

        version: {
          description:
            'The tool component version, in whatever format the component natively provides.',
          type: 'string',
        },

        semanticVersion: {
          description:
            'The tool component version in the format specified by Semantic Versioning 2.0.',
          type: 'string',
        },

        dottedQuadFileVersion: {
          description:
            "The binary version of the tool component's primary executable file expressed as four non-negative integers separated by a period (for operating systems that express file versions in this way).",
          type: 'string',
          pattern: '[0-9]+(\\.[0-9]+){3}',
        },

        releaseDateUtc: {
          description:
            "A string specifying the UTC date (and optionally, the time) of the component's release.",
          type: 'string',
        },

        downloadUri: {
          description:
            'The absolute URI from which the tool component can be downloaded.',
          type: 'string',
          format: 'uri',
        },

        informationUri: {
          description:
            'The absolute URI at which information about this version of the tool component can be found.',
          type: 'string',
          format: 'uri',
        },

        globalMessageStrings: {
          description:
            'A dictionary, each of whose keys is a resource identifier and each of whose values is a multiformatMessageString object, which holds message strings in plain text and (optionally) Markdown format. The strings can include placeholders, which can be used to construct a message in combination with an arbitrary number of additional string arguments.',
          type: 'object',
          additionalProperties: {
            $ref: '#/definitions/multiformatMessageString',
          },
        },

        notifications: {
          description:
            'An array of reportingDescriptor objects relevant to the notifications related to the configuration and runtime execution of the tool component.',
          type: 'array',
          minItems: 0,
          uniqueItems: true,
          default: [],
          items: {
            $ref: '#/definitions/reportingDescriptor',
          },
        },

        rules: {
          description:
            'An array of reportingDescriptor objects relevant to the analysis performed by the tool component.',
          type: 'array',
          minItems: 0,
          uniqueItems: true,
          default: [],
          items: {
            $ref: '#/definitions/reportingDescriptor',
          },
        },

        taxa: {
          description:
            'An array of reportingDescriptor objects relevant to the definitions of both standalone and tool-defined taxonomies.',
          type: 'array',
          minItems: 0,
          uniqueItems: true,
          default: [],
          items: {
            $ref: '#/definitions/reportingDescriptor',
          },
        },

        locations: {
          description:
            'An array of the artifactLocation objects associated with the tool component.',
          type: 'array',
          minItems: 0,
          default: [],
          items: {
            $ref: '#/definitions/artifactLocation',
          },
        },

        language: {
          description:
            'The language of the messages emitted into the log file during this run (expressed as an ISO 639-1 two-letter lowercase language code) and an optional region (expressed as an ISO 3166-1 two-letter uppercase subculture code associated with a country or region). The casing is recommended but not required (in order for this data to conform to RFC5646).',
          type: 'string',
          default: 'en-US',
          pattern: '^[a-zA-Z]{2}(-[a-zA-Z]{2})?$',
        },

        contents: {
          description: 'The kinds of data contained in this object.',
          type: 'array',
          uniqueItems: true,
          default: ['localizedData', 'nonLocalizedData'],
          items: {
            enum: ['localizedData', 'nonLocalizedData'],
            type: 'string',
          },
        },

        isComprehensive: {
          description:
            'Specifies whether this object contains a complete definition of the localizable and/or non-localizable data for this component, as opposed to including only data that is relevant to the results persisted to this log file.',
          type: 'boolean',
          default: false,
        },

        localizedDataSemanticVersion: {
          description:
            'The semantic version of the localized strings defined in this component; maintained by components that provide translations.',
          type: 'string',
        },

        minimumRequiredLocalizedDataSemanticVersion: {
          description:
            'The minimum value of localizedDataSemanticVersion required in translations consumed by this component; used by components that consume translations.',
          type: 'string',
        },

        associatedComponent: {
          description:
            "The component which is strongly associated with this component. For a translation, this refers to the component which has been translated. For an extension, this is the driver that provides the extension's plugin model.",
          $ref: '#/definitions/toolComponentReference',
        },

        translationMetadata: {
          description:
            'Translation metadata, required for a translation, not populated by other component types.',
          $ref: '#/definitions/translationMetadata',
        },

        supportedTaxonomies: {
          description:
            'An array of toolComponentReference objects to declare the taxonomies supported by the tool component.',
          type: 'array',
          minItems: 0,
          uniqueItems: true,
          default: [],
          items: {
            $ref: '#/definitions/toolComponentReference',
          },
        },

        properties: {
          description:
            'Key/value pairs that provide additional information about the tool component.',
          $ref: '#/definitions/propertyBag',
        },
      },

      required: ['name'],
    },

    toolComponentReference: {
      description:
        'Identifies a particular toolComponent object, either the driver or an extension.',
      type: 'object',
      additionalProperties: false,
      properties: {
        name: {
          description: "The 'name' property of the referenced toolComponent.",
          type: 'string',
        },

        index: {
          description:
            'An index into the referenced toolComponent in tool.extensions.',
          type: 'integer',
          default: -1,
          minimum: -1,
        },

        guid: {
          description: "The 'guid' property of the referenced toolComponent.",
          type: 'string',
          pattern:
            '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$',
        },

        properties: {
          description:
            'Key/value pairs that provide additional information about the toolComponentReference.',
          $ref: '#/definitions/propertyBag',
        },
      },
    },

    translationMetadata: {
      description: 'Provides additional metadata related to translation.',
      type: 'object',
      additionalProperties: false,
      properties: {
        name: {
          description: 'The name associated with the translation metadata.',
          type: 'string',
        },

        fullName: {
          description:
            'The full name associated with the translation metadata.',
          type: 'string',
        },

        shortDescription: {
          description: 'A brief description of the translation metadata.',
          $ref: '#/definitions/multiformatMessageString',
        },

        fullDescription: {
          description:
            'A comprehensive description of the translation metadata.',
          $ref: '#/definitions/multiformatMessageString',
        },

        downloadUri: {
          description:
            'The absolute URI from which the translation metadata can be downloaded.',
          type: 'string',
          format: 'uri',
        },

        informationUri: {
          description:
            'The absolute URI from which information related to the translation metadata can be downloaded.',
          type: 'string',
          format: 'uri',
        },

        properties: {
          description:
            'Key/value pairs that provide additional information about the translation metadata.',
          $ref: '#/definitions/propertyBag',
        },
      },
      required: ['name'],
    },

    versionControlDetails: {
      description:
        'Specifies the information necessary to retrieve a desired revision from a version control system.',
      type: 'object',
      additionalProperties: false,
      properties: {
        repositoryUri: {
          description: 'The absolute URI of the repository.',
          type: 'string',
          format: 'uri',
        },

        revisionId: {
          description:
            'A string that uniquely and permanently identifies the revision within the repository.',
          type: 'string',
        },

        branch: {
          description: 'The name of a branch containing the revision.',
          type: 'string',
        },

        revisionTag: {
          description: 'A tag that has been applied to the revision.',
          type: 'string',
        },

        asOfTimeUtc: {
          description:
            'A Coordinated Universal Time (UTC) date and time that can be used to synchronize an enlistment to the state of the repository at that time.',
          type: 'string',
          format: 'date-time',
        },

        mappedTo: {
          description:
            'The location in the local file system to which the root of the repository was mapped at the time of the analysis.',
          $ref: '#/definitions/artifactLocation',
        },

        properties: {
          description:
            'Key/value pairs that provide additional information about the version control details.',
          $ref: '#/definitions/propertyBag',
        },
      },

      required: ['repositoryUri'],
    },

    webRequest: {
      description: 'Describes an HTTP request.',
      type: 'object',
      additionalProperties: false,
      properties: {
        index: {
          description:
            'The index within the run.webRequests array of the request object associated with this result.',
          type: 'integer',
          default: -1,
          minimum: -1,
        },

        protocol: {
          description: "The request protocol. Example: 'http'.",
          type: 'string',
        },

        version: {
          description: "The request version. Example: '1.1'.",
          type: 'string',
        },

        target: {
          description: 'The target of the request.',
          type: 'string',
        },

        method: {
          description:
            "The HTTP method. Well-known values are 'GET', 'PUT', 'POST', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS', 'TRACE', 'CONNECT'.",
          type: 'string',
        },

        headers: {
          description: 'The request headers.',
          type: 'object',
          additionalProperties: {
            type: 'string',
          },
        },

        parameters: {
          description: 'The request parameters.',
          type: 'object',
          additionalProperties: {
            type: 'string',
          },
        },

        body: {
          description: 'The body of the request.',
          $ref: '#/definitions/artifactContent',
        },

        properties: {
          description:
            'Key/value pairs that provide additional information about the request.',
          $ref: '#/definitions/propertyBag',
        },
      },
    },

    webResponse: {
      description: 'Describes the response to an HTTP request.',
      type: 'object',
      additionalProperties: false,
      properties: {
        index: {
          description:
            'The index within the run.webResponses array of the response object associated with this result.',
          type: 'integer',
          default: -1,
          minimum: -1,
        },

        protocol: {
          description: "The response protocol. Example: 'http'.",
          type: 'string',
        },

        version: {
          description: "The response version. Example: '1.1'.",
          type: 'string',
        },

        statusCode: {
          description: 'The response status code. Example: 451.',
          type: 'integer',
        },

        reasonPhrase: {
          description: "The response reason. Example: 'Not found'.",
          type: 'string',
        },

        headers: {
          description: 'The response headers.',
          type: 'object',
          additionalProperties: {
            type: 'string',
          },
        },

        body: {
          description: 'The body of the response.',
          $ref: '#/definitions/artifactContent',
        },

        noResponseReceived: {
          description:
            'Specifies whether a response was received from the server.',
          type: 'boolean',
          default: false,
        },

        properties: {
          description:
            'Key/value pairs that provide additional information about the response.',
          $ref: '#/definitions/propertyBag',
        },
      },
    },
  },
};

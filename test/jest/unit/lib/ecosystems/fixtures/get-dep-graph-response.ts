import {Attributes, ComponentDetailsOpenApi, Data} from "../../../../../../src/lib/ecosystems/unmanaged/types";
import {depGraphDataOpenAPI} from "./dep-graph-open-api";

const componentDetailsOpenApi: ComponentDetailsOpenApi = {};

const attributes: Attributes = {
    start_time: 1660137910316,
    dep_graph_data: depGraphDataOpenAPI,
    component_details: componentDetailsOpenApi,
};

export const getDepGraphResponse: Data = {
    id: '1234',
    type: 'depgraphs',
    attributes: attributes,
}

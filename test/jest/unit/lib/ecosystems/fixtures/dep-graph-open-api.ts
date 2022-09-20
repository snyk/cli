import {
    ComponentDetailsOpenApi,
    DepGraphDataOpenAPI,
    GraphOpenApi,
    PkgManager
} from "../../../../../../src/lib/ecosystems/unmanaged/types";

const componentDetails: ComponentDetailsOpenApi = {
    'http://cdn.kernel.org/pub/linux/utils/net/iproute2/iproute2-4.2.0.tar.gz@4.2.0': {
        artifact: 'iproute2',
        version: '4.2.0',
        author: 'iproute2_project',
        path: 'deps/iproute2-4.2.0',
        id: '15292136508eb4f383337eb200000000',
        url:
            'http://cdn.kernel.org/pub/linux/utils/net/iproute2/iproute2-4.2.0.tar.gz',
        score: 1,
        file_paths: [
            'deps/iproute2-4.2.0/COPYING',
            'deps/iproute2-4.2.0/Makefile',
            'deps/iproute2-4.2.0/README',
            'deps/iproute2-4.2.0/README.decnet',
        ],
    },
};

const graph: GraphOpenApi = {
    root_node_id: 'root-node@0.0.0',
    nodes: [
        {
            node_id: 'root-node',
            pkg_id: 'root-node@0.0.0',
            deps: [
                {
                    node_id: 'https://github.com|nih-at/libzip@1.8.0',
                },
            ],
        },
        {
            node_id: 'https://github.com|nih-at/libzip@1.8.0',
            pkg_id: 'https://github.com|nih-at/libzip@1.8.0',
            deps: [],
        },
    ],
};

const pkg_manager: PkgManager = { name: 'cpp' };

export const depGraphDataOpenAPI: DepGraphDataOpenAPI = {
    schema_version: '1.2.0',
    pkg_manager: pkg_manager,
    pkgs: [
        {
            id: 'root-node@0.0.0',
            info: {
                name: 'root-node',
                version: '0.0.0',
            },
        },
        {
            id: 'https://github.com|nih-at/libzip@1.8.0',
            info: {
                name: 'https://github.com|nih-at/libzip',
                version: '1.8.0',
            },
        },
    ],
    graph: graph,
};

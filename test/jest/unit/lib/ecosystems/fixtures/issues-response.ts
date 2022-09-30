import {
    FileSignaturesDetailsOpenApi, FixInfoOpenApi,
    IssueDataOpenApi, IssueOpenApi,
    IssuesDataOpenApi, IssuesResponseData, IssuesResponseDataResult
} from "../../../../../../src/lib/ecosystems/unmanaged/types";
import {DepsFilePaths} from "snyk-cpp-plugin/dist/types";
import {SEVERITY} from "../../../../../../src/lib/snyk-test/common";
import {depGraphDataOpenAPI} from "./dep-graph-open-api";

const fileSignaturesDetailsOpenApi: FileSignaturesDetailsOpenApi = {
    "https://thekelleys.org.uk|dnsmasq@2.80": {
        "confidence": 1,
        "file_paths": [
            "deps/dnsmasq-2.80/Android.mk",
            "deps/dnsmasq-2.80/CHANGELOG",
            "deps/dnsmasq-2.80/CHANGELOG.archive",
            "deps/dnsmasq-2.80/COPYING",
            "deps/dnsmasq-2.80/COPYING-v3",
            "deps/dnsmasq-2.80/FAQ",
            "deps/dnsmasq-2.80/Makefile",
            "deps/dnsmasq-2.80/VERSION",
        ]
    }
};

const depsFilePaths: DepsFilePaths = {
    "https://thekelleys.org.uk|dnsmasq@2.80": [
        "deps/dnsmasq-2.80/Android.mk",
        "deps/dnsmasq-2.80/CHANGELOG",
        "deps/dnsmasq-2.80/CHANGELOG.archive",
        "deps/dnsmasq-2.80/COPYING",
        "deps/dnsmasq-2.80/COPYING-v3",
        "deps/dnsmasq-2.80/FAQ",
        "deps/dnsmasq-2.80/Makefile",
        ],
    "http://github.com/nmoinvaz/minizip/archive/1.1.tar.gz@1.1": [
        "deps/zlib-1.2.11.1/contrib/minizip/Makefile.am",
        "deps/zlib-1.2.11.1/contrib/minizip/MiniZip64_Changes.txt",
        "deps/zlib-1.2.11.1/contrib/minizip/MiniZip64_info.txt",
        "deps/zlib-1.2.11.1/contrib/minizip/configure.ac",
        "deps/zlib-1.2.11.1/contrib/minizip/crypt.h",
        "deps/zlib-1.2.11.1/contrib/minizip/ioapi.c",
        "deps/zlib-1.2.11.1/contrib/minizip/ioapi.h",
        "deps/zlib-1.2.11.1/contrib/minizip/iowin32.c",
        "deps/zlib-1.2.11.1/contrib/minizip/iowin32.h",
        ]
};

const issueDataOpenApi: IssueDataOpenApi = {
    id: 'SNYK-UNMANAGED-CPIO-2319543',
    package_name: 'cpio',
    version: '',
    below: '',
    semver: {
        vulnerable: ['[0,]'],
    },
    patches: [],
    is_new: false,
    description:
        '## Overview\n\nAffected versions of this package are vulnerable to Symlink Attack cpio, as used in build 2007.05.10, 2010.07.28, and possibly other versions, allows remote attackers to overwrite arbitrary files via a symlink within an RPM package archive.\n## Remediation\nThere is no fixed version for `cpio`.\n## References\n- [Support.novell.com](http://support.novell.com/security/cve/CVE-2010-4226.html)\n',
    title: 'Symlink Attack',
    severity: SEVERITY.MEDIUM,
    fixed_in: [],
    package_manager: 'Unmanaged (C/C++)',
    from: [],
    name: '',
};

const issuesDataOpenApi: IssuesDataOpenApi = {
    'SNYK-UNMANAGED-CPIO-2319543': issueDataOpenApi,
};

const fixInfoOpenApi: FixInfoOpenApi = {
    upgrade_paths: [],
    nearest_fixed_in_version: '',
    is_patchable: false,
};
const issueOpenApi: IssueOpenApi = {
    pkg_name: 'https://ftp.gnu.org|cpio',
    issue_id: 'SNYK-UNMANAGED-CPIO-2319543',
    pkg_version: '2.12',
    fix_info: fixInfoOpenApi,
};
const issuesOpenApi: IssueOpenApi[] = [issueOpenApi];
const result: IssuesResponseDataResult = {
    start_time: '1659598771039',
    issues: issuesOpenApi,
    issues_data: issuesDataOpenApi,
    dep_graph: depGraphDataOpenAPI,
    deps_file_paths: depsFilePaths,
    file_signatures_details: fileSignaturesDetailsOpenApi,
    type: '',
};

export const issuesResponseData: IssuesResponseData = { id: '', result: result };

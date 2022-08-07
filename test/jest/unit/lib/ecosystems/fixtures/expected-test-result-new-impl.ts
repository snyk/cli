import { TestResult } from '../../../../../../src/lib/ecosystems/types';
import {SEVERITY} from "@snyk/fix/dist/types";

const expectedDescription = `## Overview

Affected versions of this package are vulnerable to Symlink Attack cpio, as used in build 2007.05.10, 2010.07.28, and possibly other versions, allows remote attackers to overwrite arbitrary files via a symlink within an RPM package archive.
## Remediation
There is no fixed version for \`cpio\`.
## References
- [Support.novell.com](http://support.novell.com/security/cve/CVE-2010-4226.html)
`;

export const expectedTestResult = [
    {
        depGraphData: {
            graph: {
                nodes: [
                    {
                        deps: [
                            {
                                nodeId: 'https://github.com|nih-at/libzip@1.8.0',
                            },
                        ],
                        nodeId: 'root-node',
                        pkgId: 'root-node@0.0.0',
                    },
                    {
                        deps: [],
                        nodeId: 'https://github.com|nih-at/libzip@1.8.0',
                        pkgId: 'https://github.com|nih-at/libzip@1.8.0',
                    },
                ],
                rootNodeId: 'root-node@0.0.0',
            },
            pkgManager: {
                name: 'cpp',
            },
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
            schemaVersion: '1.2.0',
        },
        dependencyCount: 1,
        depsFilePaths: {
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
            ],
        "https://thekelleys.org.uk|dnsmasq@2.80": [
        "deps/dnsmasq-2.80/Android.mk",
            "deps/dnsmasq-2.80/CHANGELOG",
            "deps/dnsmasq-2.80/CHANGELOG.archive",
            "deps/dnsmasq-2.80/COPYING",
            "deps/dnsmasq-2.80/COPYING-v3",
            "deps/dnsmasq-2.80/FAQ",
            "deps/dnsmasq-2.80/Makefile",
            ],
        },
        "fileSignaturesDetails": {
            "https://thekelleys.org.uk|dnsmasq@2.80": {
                "confidence": 1,
                    "filePaths": [
                        "deps/dnsmasq-2.80/Android.mk",
                          "deps/dnsmasq-2.80/CHANGELOG",
                          "deps/dnsmasq-2.80/CHANGELOG.archive",
                          "deps/dnsmasq-2.80/COPYING",
                          "deps/dnsmasq-2.80/COPYING-v3",
                          "deps/dnsmasq-2.80/FAQ",
                          "deps/dnsmasq-2.80/Makefile",
                          "deps/dnsmasq-2.80/VERSION",
                    ],
                },
            },
        issues: [
            {
                fixInfo: {
                    isPatchable: false,
                    nearestFixedInVersion: '',
                    upgradePaths: [],
                },
                issueId: 'SNYK-UNMANAGED-CPIO-2319543',
                pkgName: 'https://ftp.gnu.org|cpio',
                pkgVersion: '2.12',
            },
        ],
        issuesData: {
            'SNYK-UNMANAGED-CPIO-2319543': {
                id: 'SNYK-UNMANAGED-CPIO-2319543',
                packageName: 'cpio',
                version: '',
                below: '',
                semver: {
                    "vulnerable": [
                        "[0,]"
                    ]
                },
                patches: [],
                isNew: false,
                description: expectedDescription,
                title: 'Symlink Attack',
                severity: "medium",
                fixedIn: [],
                packageManager: "Unmanaged (C/C++)",
                from: ['https://ftp.gnu.org|cpio@2.12'],
                name: 'https://ftp.gnu.org|cpio@2.12',
            },
        },
        packageManager: 'Unmanaged (C/C++)',
        path: 'path',
        vulnerabilities: [
            {
                below: '',
                description: expectedDescription,
                fixedIn: [],
                from: ['https://ftp.gnu.org|cpio@2.12'],
                id: 'SNYK-UNMANAGED-CPIO-2319543',
                isNew: false,
                name: 'https://ftp.gnu.org|cpio@2.12',
                packageManager: 'Unmanaged (C/C++)',
                packageName: 'cpio',
                patches: [],
                severity: 'medium',
                title: 'Symlink Attack',
                version: '',
                semver: {
                    "vulnerable": [
                        "[0,]"
                    ]
                },
            },
        ],
    },
];
import { RemediationResult } from "../../lib/snyk-test/legacy";

const data: RemediationResult = {
    "unresolved": [],
    "upgrade": {
        "adm-zip@0.4.7": {
            "upgradeTo": "adm-zip@0.4.11",
            "upgrades": [
                "adm-zip@0.4.7"
            ],
            "vulns": [
                "npm:adm-zip:20180415"
            ]
        },
        "body-parser@1.9.0": {
            "upgradeTo": "body-parser@1.17.1",
            "upgrades": [
                "qs@2.2.4"
            ],
            "vulns": [
                "npm:qs:20170213"
            ]
        },
        "dustjs-linkedin@2.5.0": {
            "upgradeTo": "dustjs-linkedin@2.6.0",
            "upgrades": [
                "dustjs-linkedin@2.5.0"
            ],
            "vulns": [
                "npm:dustjs-linkedin:20160819"
            ]
        },
        "ejs@1.0.0": {
            "upgradeTo": "ejs@2.5.5",
            "upgrades": [
                "ejs@1.0.0",
                "ejs@1.0.0",
                "ejs@1.0.0"
            ],
            "vulns": [
                "npm:ejs:20161130",
                "npm:ejs:20161130-1",
                "npm:ejs:20161128"
            ]
        },
        "errorhandler@1.2.0": {
            "upgradeTo": "errorhandler@1.4.3",
            "upgrades": [
                "negotiator@0.4.9"
            ],
            "vulns": [
                "npm:negotiator:20160616"
            ]
        },
        "express@4.12.4": {
            "upgradeTo": "express@4.16.0",
            "upgrades": [
                "mime@1.3.4",
                "fresh@0.2.4",
                "debug@2.2.0",
                "ms@0.7.1",
                "qs@2.4.2",
                "negotiator@0.5.3"
            ],
            "vulns": [
                "npm:mime:20170907",
                "npm:fresh:20170908",
                "npm:debug:20170905",
                "npm:ms:20170412",
                "npm:qs:20170213",
                "npm:negotiator:20160616"
            ]
        },
        "jquery@2.2.4": {
            "upgradeTo": "jquery@3.4.0",
            "upgrades": [
                "jquery@2.2.4",
                "jquery@2.2.4"
            ],
            "vulns": [
                "SNYK-JS-JQUERY-174006",
                "npm:jquery:20150627"
            ]
        },
        "lodash@4.17.4": {
            "upgradeTo": "lodash@4.17.11",
            "upgrades": [
                "lodash@4.17.4",
                "lodash@4.17.4",
                "lodash@4.17.4"
            ],
            "vulns": [
                "SNYK-JS-LODASH-73639",
                "SNYK-JS-LODASH-73638",
                "npm:lodash:20180130"
            ]
        },
        "marked@0.3.5": {
            "upgradeTo": "marked@0.6.2",
            "upgrades": [
                "marked@0.3.5",
                "marked@0.3.5",
                "marked@0.3.5",
                "marked@0.3.5",
                "marked@0.3.5",
                "marked@0.3.5",
                "marked@0.3.5"
            ],
            "vulns": [
                "SNYK-JS-MARKED-174116",
                "npm:marked:20180225",
                "npm:marked:20170907",
                "npm:marked:20170815",
                "npm:marked:20170815-1",
                "npm:marked:20170112",
                "npm:marked:20150520"
            ]
        },
        "moment@2.15.1": {
            "upgradeTo": "moment@2.19.3",
            "upgrades": [
                "moment@2.15.1",
                "moment@2.15.1"
            ],
            "vulns": [
                "npm:moment:20170905",
                "npm:moment:20161019"
            ]
        },
        "mongoose@4.2.4": {
            "upgradeTo": "mongoose@4.11.14",
            "upgrades": ['debug@2.2.0',
                "ms@0.7.1",
                "mongoose@4.2.4"
            ],vulns: ['npm:debug: 20170905','npm:ms: 20170412','npm:mongoose: 20160116'
            ]
        },'ms@0.7.3': {upgradeTo:'ms@2.0.0',upgrades: ['ms@0.7.3'
            ],vulns: ['npm:ms: 20170412'
            ]
        },'npmconf@0.0.24': {upgradeTo: 'npmconf@2.1.3', upgrades: ['npmconf@0.0.24', 'semver@1.1.4'
            ], vulns: ['npm:npmconf: 20180512', 'npm:semver: 20150403'
            ]
        }, 'st@0.2.4': {upgradeTo: 'st@1.2.2', upgrades: ['st@0.2.4', 'mime@1.2.11', 'negotiator@0.2.8', 'st@0.2.4'
            ], vulns: ['npm:st: 20171013', 'npm:mime: 20170907', 'npm:negotiator: 20160616', 'npm:st: 20140206'
            ]
        }, 'tap@5.8.0': {upgradeTo: 'tap@11.1.3', upgrades: ['hoek@2.16.3', 'js-yaml@3.6.1', 'js-yaml@3.6.1', 'tunnel-agent@0.4.3', 'braces@1.8.5'
            ], vulns: ['npm:hoek: 20180212', 'SNYK-JS-JSYAML-173999', 'SNYK-JS-JSYAML-174129', 'npm:tunnel-agent: 20170305', 'npm:braces: 20180219'
            ]
        }
    }, patch: {'npm:hawk: 20160119': {package: 'hawk@1.0.0', paths: [
                {'tap > codecov.io > request > hawk': {patched: '2019-06-17T11: 47: 12.406Z'
                    }
                }
            ]
        }, 'npm:http-signature: 20150122': {paths: [
                {'tap > codecov.io > request > http-signature': {patched: '2019-06-17T11: 47: 12.406Z'
                    }
                }
            ]
        }, 'npm:mime: 20170907': {paths: [
                {'tap > codecov.io > request > form-data > mime': {patched: '2019-06-17T11: 47: 12.406Z'
                    }
                }
            ]
        }, 'npm:minimatch: 20160620': {paths: [
                {'tap > nyc > glob > minimatch': {patched: '2019-06-17T11: 47: 12.406Z'
                    }
                },
                {'tap > nyc > rimraf > glob > minimatch': {patched: '2019-06-17T11: 47: 12.406Z'
                    }
                },
                {'tap > nyc > spawn-wrap > rimraf > glob > minimatch': {patched: '2019-06-17T11: 47: 12.406Z'
                    }
                },
                {'tap > nyc > istanbul > fileset > minimatch': {patched: '2019-06-17T11: 47: 12.406Z'
                    }
                },
                {'tap > nyc > istanbul > fileset > glob > minimatch': {patched: '2019-06-17T11: 47: 12.406Z'
                    }
                }
            ]
        }, 'npm:ms: 20151024': {paths: [
                {'humanize-ms > ms': {patched: '2019-06-17T11: 47: 12.406Z'
                    }
                }
            ]
        }, 'npm:request: 20160119': {paths: [
                {'tap > codecov.io > request': {patched: '2019-06-17T11: 47: 12.406Z'
                    }
                }
            ]
        }, 'npm:tunnel-agent: 20170305': {paths: [
                {'tap > codecov.io > request > tunnel-agent': {patched: '2019-06-17T11: 47: 12.406Z'
                    }
                }
            ]
        }
    }, ignore: {}
}

export = data;
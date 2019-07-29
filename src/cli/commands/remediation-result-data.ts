import { RemediationResult, IssueData } from "../../lib/snyk-test/legacy";

const data: RemediationResult = {
    "unresolved": [
        {
            "CVSSv3": "CVSS:3.0/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:L/A:L",
            "alternativeIds": [],
            "creationTime": "2019-02-14T16:46:18.024227Z",
            "credit": [
                "Mahmoud Gamal",
                "Matias Lang"
            ],
            "cvssScore": 7.3,
            "description": "## Overview\n\n[handlebars](https://www.npmjs.com/package/handlebars) is a extension to the Mustache templating language.\n\n\nAffected versions of this package are vulnerable to Prototype Pollution.\nTemplates may alter an Objects' prototype, thus allowing an attacker to execute arbitrary code on the server.\n\n## Details\nPrototype Pollution is a vulnerability affecting JavaScript. Prototype Pollution refers to the ability to inject properties into existing JavaScript language construct prototypes, such as objects. JavaScript allows all Object attributes to be altered, including their magical attributes such as `_proto_`, `constructor` and `prototype`. An attacker manipulates these attributes to overwrite, or pollute, a JavaScript application object prototype of the base object by injecting other values.  Properties on the `Object.prototype` are then inherited by all the JavaScript objects through the prototype chain. When that happens, this leads to either denial of service by triggering JavaScript exceptions, or it tampers with the application source code to force the code path that the attacker injects, thereby leading to remote code execution.\r\n\r\nThere are two main ways in which the pollution of prototypes occurs:\r\n\r\n-   Unsafe `Object` recursive merge\r\n    \r\n-   Property definition by path\r\n    \r\n\r\n### Unsafe Object recursive merge\r\n\r\nThe logic of a vulnerable recursive merge function follows the following high-level model:\r\n```\r\nmerge (target, source)\r\n\r\nforeach property of source\r\n\r\nif property exists and is an object on both the target and the source\r\n\r\nmerge(target[property], source[property])\r\n\r\nelse\r\n\r\ntarget[property] = source[property]\r\n```\r\n<br>  \r\n\r\nWhen the source object contains a property named `_proto_` defined with `Object.defineProperty()` , the condition that checks if the property exists and is an object on both the target and the source passes and the merge recurses with the target, being the prototype of `Object` and the source of `Object` as defined by the attacker. Properties are then copied on the `Object` prototype.\r\n\r\nClone operations are a special sub-class of unsafe recursive merges, which occur when a recursive merge is conducted on an empty object: `merge({},source)`.\r\n\r\n`lodash` and `Hoek` are examples of libraries susceptible to recursive merge attacks.\r\n\r\n### Property definition by path\r\n\r\nThere are a few JavaScript libraries that use an API to define property values on an object based on a given path. The function that is generally affected contains this signature: `theFunction(object, path, value)`\r\n\r\nIf the attacker can control the value of “path”, they can set this value to `_proto_.myValue`. `myValue` is then assigned to the prototype of the class of the object.\r\n\r\n## Types of attacks\r\n\r\nThere are a few methods by which Prototype Pollution can be manipulated:\r\n\r\n| Type |Origin  |Short description |\r\n|--|--|--|\r\n| **Denial of service (DoS)**|Client  |This is the most likely attack. <br>DoS occurs when `Object` holds generic functions that are implicitly called for various operations (for example, `toString` and `valueOf`). <br> The attacker pollutes `Object.prototype.someattr` and alters its state to an unexpected value such as `Int` or `Object`. In this case, the code fails and is likely to cause a denial of service.  <br>**For example:** if an attacker pollutes `Object.prototype.toString` by defining it as an integer, if the codebase at any point was reliant on `someobject.toString()` it would fail. |\r\n |**Remote Code Execution**|Client|Remote code execution is generally only possible in cases where the codebase evaluates a specific attribute of an object, and then executes that evaluation.<br>**For example:** `eval(someobject.someattr)`. In this case, if the attacker pollutes `Object.prototype.someattr` they are likely to be able to leverage this in order to execute code.|\r\n|**Property Injection**|Client|The attacker pollutes properties that the codebase relies on for their informative value, including security properties such as cookies or tokens.<br>  **For example:** if a codebase checks privileges for `someuser.isAdmin`, then when the attacker pollutes `Object.prototype.isAdmin` and sets it to equal `true`, they can then achieve admin privileges.|\r\n\r\n## Affected environments\r\n\r\nThe following environments are susceptible to a Prototype Pollution attack:\r\n\r\n-   Application server\r\n    \r\n-   Web server\r\n    \r\n\r\n## How to prevent\r\n\r\n1.  Freeze the prototype— use `Object.freeze (Object.prototype)`.\r\n    \r\n2.  Require schema validation of JSON input.\r\n    \r\n3.  Avoid using unsafe recursive merge functions.\r\n    \r\n4.  Consider using objects without prototypes (for example, `Object.create(null)`), breaking the prototype chain and preventing pollution.\r\n    \r\n5.  As a best practice use `Map` instead of `Object`.\r\n\r\n### For more information on this vulnerability type:\r\n\r\n[Arteau, Oliver. “JavaScript prototype pollution attack in NodeJS application.” GitHub, 26 May 2018](https://github.com/HoLyVieR/prototype-pollution-nsec18/blob/master/paper/JavaScript_prototype_pollution_attack_in_NodeJS.pdf)\n\n## Remediation\n\nUpgrade `handlebars` to version 4.0.13 or higher.\n\n\n## References\n\n- [GitHub Commit](https://github.com/wycats/handlebars.js/commit/7372d4e9dffc9d70c09671aa28b9392a1577fd86)\n",
            "disclosureTime": "2018-12-28T20:34:57Z",
            "fixedIn": [
                "4.0.13"
            ],
            "functions": [
                {
                    "functionId": {
                        "className": null,
                        "filePath": "dist/amd/handlebars/compiler/javascript-compiler.js",
                        "functionName": "JavaScriptCompiler.prototype.nameLookup"
                    },
                    "version": [
                        ">1.0.12 <4.0.13"
                    ]
                },
                {
                    "functionId": {
                        "className": null,
                        "filePath": "dist/handlebars.js",
                        "functionName": "JavaScriptCompiler.Handlebars.JavaScriptCompiler"
                    },
                    "version": [
                        ">=1.0.6 <=1.0.12"
                    ]
                }
            ],
            "id": "SNYK-JS-HANDLEBARS-173692",
            "identifiers": {
                "CVE": [],
                "CWE": [
                    "CWE-471"
                ],
                "NSP": [
                    755
                ]
            },
            "language": "js",
            "modificationTime": "2019-04-14T11:09:52.197745Z",
            "moduleName": "handlebars",
            "packageManager": "npm",
            "packageName": "handlebars",
            "patches": [],
            "publicationTime": "2019-02-14T17:52:50Z",
            "references": [
                {
                    "title": "GitHub Commit",
                    "url": "https://github.com/wycats/handlebars.js/commit/7372d4e9dffc9d70c09671aa28b9392a1577fd86"
                }
            ],
            "semver": {
                "vulnerable": [
                    "<4.0.13"
                ]
            },
            "severity": "high",
            "title": "Prototype Pollution",
            "from": [
                "goof@1.0.1",
                "tap@5.8.0",
                "nyc@6.6.1",
                "istanbul@0.4.3",
                "handlebars@4.0.5"
            ],
            "upgradePath": [
                false,
                "tap@5.8.0",
                "nyc@6.6.1",
                "istanbul@0.4.3",
                "handlebars@4.0.13"
            ],
            "isUpgradable": true,
            "isPatchable": false,
            "name": "handlebars",
            "version": "4.0.5"
        },
        {
            "CVSSv3": "CVSS:3.0/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:L/A:L",
            "alternativeIds": [],
            "creationTime": "2019-04-14T11:55:45.212136Z",
            "credit": [
                "Nils Knappmeier"
            ],
            "cvssScore": 7.3,
            "description": "## Overview\n\n[handlebars](https://www.npmjs.com/package/handlebars) is a extension to the Mustache templating language.\n\n\nAffected versions of this package are vulnerable to Prototype Pollution.\nA Prototype Pollution allowing Remote Code Execution can be exploited using the constructor, via the 'lookup' helper.\r\nThis vulnerability is due to an incomplete fix for: `SNYK-JS-HANDLEBARS-173692`\n\n## Details\nPrototype Pollution is a vulnerability affecting JavaScript. Prototype Pollution refers to the ability to inject properties into existing JavaScript language construct prototypes, such as objects. JavaScript allows all Object attributes to be altered, including their magical attributes such as `_proto_`, `constructor` and `prototype`. An attacker manipulates these attributes to overwrite, or pollute, a JavaScript application object prototype of the base object by injecting other values.  Properties on the `Object.prototype` are then inherited by all the JavaScript objects through the prototype chain. When that happens, this leads to either denial of service by triggering JavaScript exceptions, or it tampers with the application source code to force the code path that the attacker injects, thereby leading to remote code execution.\r\n\r\nThere are two main ways in which the pollution of prototypes occurs:\r\n\r\n-   Unsafe `Object` recursive merge\r\n    \r\n-   Property definition by path\r\n    \r\n\r\n### Unsafe Object recursive merge\r\n\r\nThe logic of a vulnerable recursive merge function follows the following high-level model:\r\n```\r\nmerge (target, source)\r\n\r\nforeach property of source\r\n\r\nif property exists and is an object on both the target and the source\r\n\r\nmerge(target[property], source[property])\r\n\r\nelse\r\n\r\ntarget[property] = source[property]\r\n```\r\n<br>  \r\n\r\nWhen the source object contains a property named `_proto_` defined with `Object.defineProperty()` , the condition that checks if the property exists and is an object on both the target and the source passes and the merge recurses with the target, being the prototype of `Object` and the source of `Object` as defined by the attacker. Properties are then copied on the `Object` prototype.\r\n\r\nClone operations are a special sub-class of unsafe recursive merges, which occur when a recursive merge is conducted on an empty object: `merge({},source)`.\r\n\r\n`lodash` and `Hoek` are examples of libraries susceptible to recursive merge attacks.\r\n\r\n### Property definition by path\r\n\r\nThere are a few JavaScript libraries that use an API to define property values on an object based on a given path. The function that is generally affected contains this signature: `theFunction(object, path, value)`\r\n\r\nIf the attacker can control the value of “path”, they can set this value to `_proto_.myValue`. `myValue` is then assigned to the prototype of the class of the object.\r\n\r\n## Types of attacks\r\n\r\nThere are a few methods by which Prototype Pollution can be manipulated:\r\n\r\n| Type |Origin  |Short description |\r\n|--|--|--|\r\n| **Denial of service (DoS)**|Client  |This is the most likely attack. <br>DoS occurs when `Object` holds generic functions that are implicitly called for various operations (for example, `toString` and `valueOf`). <br> The attacker pollutes `Object.prototype.someattr` and alters its state to an unexpected value such as `Int` or `Object`. In this case, the code fails and is likely to cause a denial of service.  <br>**For example:** if an attacker pollutes `Object.prototype.toString` by defining it as an integer, if the codebase at any point was reliant on `someobject.toString()` it would fail. |\r\n |**Remote Code Execution**|Client|Remote code execution is generally only possible in cases where the codebase evaluates a specific attribute of an object, and then executes that evaluation.<br>**For example:** `eval(someobject.someattr)`. In this case, if the attacker pollutes `Object.prototype.someattr` they are likely to be able to leverage this in order to execute code.|\r\n|**Property Injection**|Client|The attacker pollutes properties that the codebase relies on for their informative value, including security properties such as cookies or tokens.<br>  **For example:** if a codebase checks privileges for `someuser.isAdmin`, then when the attacker pollutes `Object.prototype.isAdmin` and sets it to equal `true`, they can then achieve admin privileges.|\r\n\r\n## Affected environments\r\n\r\nThe following environments are susceptible to a Prototype Pollution attack:\r\n\r\n-   Application server\r\n    \r\n-   Web server\r\n    \r\n\r\n## How to prevent\r\n\r\n1.  Freeze the prototype— use `Object.freeze (Object.prototype)`.\r\n    \r\n2.  Require schema validation of JSON input.\r\n    \r\n3.  Avoid using unsafe recursive merge functions.\r\n    \r\n4.  Consider using objects without prototypes (for example, `Object.create(null)`), breaking the prototype chain and preventing pollution.\r\n    \r\n5.  As a best practice use `Map` instead of `Object`.\r\n\r\n### For more information on this vulnerability type:\r\n\r\n[Arteau, Oliver. “JavaScript prototype pollution attack in NodeJS application.” GitHub, 26 May 2018](https://github.com/HoLyVieR/prototype-pollution-nsec18/blob/master/paper/JavaScript_prototype_pollution_attack_in_NodeJS.pdf)\n\n## Remediation\n\nUpgrade `handlebars` to version 4.1.2, 4.0.14 or higher.\n\n\n## References\n\n- [GitHub Commit](https://github.com/wycats/handlebars.js/commit/cd38583216dce3252831916323202749431c773e)\n\n- [GitHub Issue](https://github.com/wycats/handlebars.js/issues/1495)\n\n- [SNYK-JS-HANDLEBARS-173692](https://snyk.io/vuln/SNYK-JS-HANDLEBARS-173692)\n",
            "disclosureTime": "2019-04-13T06:31:34Z",
            "fixedIn": [
                "4.1.2",
                "4.0.14"
            ],
            "functions": [
                {
                    "functionId": {
                        "className": null,
                        "filePath": "lib/handlebars/helpers/lookup.js",
                        "functionName": "module.exports"
                    },
                    "version": [
                        ">3.0.6 <4.1.2"
                    ]
                }
            ],
            "id": "SNYK-JS-HANDLEBARS-174183",
            "identifiers": {
                "CVE": [],
                "CWE": [
                    "CWE-471"
                ]
            },
            "language": "js",
            "modificationTime": "2019-05-21T10:24:23.975201Z",
            "moduleName": "handlebars",
            "packageManager": "npm",
            "packageName": "handlebars",
            "patches": [],
            "publicationTime": "2019-04-14T06:31:34Z",
            "references": [
                {
                    "title": "GitHub Commit",
                    "url": "https://github.com/wycats/handlebars.js/commit/cd38583216dce3252831916323202749431c773e"
                },
                {
                    "title": "GitHub Issue",
                    "url": "https://github.com/wycats/handlebars.js/issues/1495"
                },
                {
                    "title": "SNYK-JS-HANDLEBARS-173692",
                    "url": "https://snyk.io/vuln/SNYK-JS-HANDLEBARS-173692"
                }
            ],
            "semver": {
                "vulnerable": [
                    ">=4.1.0 <4.1.2",
                    "<4.0.14"
                ]
            },
            "severity": "high",
            "title": "Prototype Pollution",
            "from": [
                "goof@1.0.1",
                "tap@5.8.0",
                "nyc@6.6.1",
                "istanbul@0.4.3",
                "handlebars@4.0.5"
            ],
            "upgradePath": [
                false,
                "tap@5.8.0",
                "nyc@6.6.1",
                "istanbul@0.4.3",
                "handlebars@4.0.14"
            ],
            "isUpgradable": true,
            "isPatchable": false,
            "name": "handlebars",
            "version": "4.0.5"
        },
        {
            "CVSSv3": "CVSS:3.0/AV:N/AC:H/PR:N/UI:N/S:U/C:L/I:L/A:L",
            "alternativeIds": [],
            "creationTime": "2019-03-27T08:43:07.568451Z",
            "credit": [
                "Semmle Security Research Team"
            ],
            "cvssScore": 5.6,
            "description": "## Overview\n\n[jquery](https://www.npmjs.com/package/jquery) is a JavaScript library. It makes things like HTML document traversal and manipulation, event handling, animation, and Ajax much simpler with an easy-to-use API that works across a multitude of browsers.\n\n\nAffected versions of this package are vulnerable to Prototype Pollution.\nThe `extend` function can be tricked into modifying the prototype of `Object` when the attacker controls part of the structure passed to this function. This can let an attacker add or modify an existing property that will then exist on all objects.\n\n## Details\nPrototype Pollution is a vulnerability affecting JavaScript. Prototype Pollution refers to the ability to inject properties into existing JavaScript language construct prototypes, such as objects. JavaScript allows all Object attributes to be altered, including their magical attributes such as `_proto_`, `constructor` and `prototype`. An attacker manipulates these attributes to overwrite, or pollute, a JavaScript application object prototype of the base object by injecting other values.  Properties on the `Object.prototype` are then inherited by all the JavaScript objects through the prototype chain. When that happens, this leads to either denial of service by triggering JavaScript exceptions, or it tampers with the application source code to force the code path that the attacker injects, thereby leading to remote code execution.\r\n\r\nThere are two main ways in which the pollution of prototypes occurs:\r\n\r\n-   Unsafe `Object` recursive merge\r\n    \r\n-   Property definition by path\r\n    \r\n\r\n### Unsafe Object recursive merge\r\n\r\nThe logic of a vulnerable recursive merge function follows the following high-level model:\r\n```\r\nmerge (target, source)\r\n\r\nforeach property of source\r\n\r\nif property exists and is an object on both the target and the source\r\n\r\nmerge(target[property], source[property])\r\n\r\nelse\r\n\r\ntarget[property] = source[property]\r\n```\r\n<br>  \r\n\r\nWhen the source object contains a property named `_proto_` defined with `Object.defineProperty()` , the condition that checks if the property exists and is an object on both the target and the source passes and the merge recurses with the target, being the prototype of `Object` and the source of `Object` as defined by the attacker. Properties are then copied on the `Object` prototype.\r\n\r\nClone operations are a special sub-class of unsafe recursive merges, which occur when a recursive merge is conducted on an empty object: `merge({},source)`.\r\n\r\n`lodash` and `Hoek` are examples of libraries susceptible to recursive merge attacks.\r\n\r\n### Property definition by path\r\n\r\nThere are a few JavaScript libraries that use an API to define property values on an object based on a given path. The function that is generally affected contains this signature: `theFunction(object, path, value)`\r\n\r\nIf the attacker can control the value of “path”, they can set this value to `_proto_.myValue`. `myValue` is then assigned to the prototype of the class of the object.\r\n\r\n## Types of attacks\r\n\r\nThere are a few methods by which Prototype Pollution can be manipulated:\r\n\r\n| Type |Origin  |Short description |\r\n|--|--|--|\r\n| **Denial of service (DoS)**|Client  |This is the most likely attack. <br>DoS occurs when `Object` holds generic functions that are implicitly called for various operations (for example, `toString` and `valueOf`). <br> The attacker pollutes `Object.prototype.someattr` and alters its state to an unexpected value such as `Int` or `Object`. In this case, the code fails and is likely to cause a denial of service.  <br>**For example:** if an attacker pollutes `Object.prototype.toString` by defining it as an integer, if the codebase at any point was reliant on `someobject.toString()` it would fail. |\r\n |**Remote Code Execution**|Client|Remote code execution is generally only possible in cases where the codebase evaluates a specific attribute of an object, and then executes that evaluation.<br>**For example:** `eval(someobject.someattr)`. In this case, if the attacker pollutes `Object.prototype.someattr` they are likely to be able to leverage this in order to execute code.|\r\n|**Property Injection**|Client|The attacker pollutes properties that the codebase relies on for their informative value, including security properties such as cookies or tokens.<br>  **For example:** if a codebase checks privileges for `someuser.isAdmin`, then when the attacker pollutes `Object.prototype.isAdmin` and sets it to equal `true`, they can then achieve admin privileges.|\r\n\r\n## Affected environments\r\n\r\nThe following environments are susceptible to a Prototype Pollution attack:\r\n\r\n-   Application server\r\n    \r\n-   Web server\r\n    \r\n\r\n## How to prevent\r\n\r\n1.  Freeze the prototype— use `Object.freeze (Object.prototype)`.\r\n    \r\n2.  Require schema validation of JSON input.\r\n    \r\n3.  Avoid using unsafe recursive merge functions.\r\n    \r\n4.  Consider using objects without prototypes (for example, `Object.create(null)`), breaking the prototype chain and preventing pollution.\r\n    \r\n5.  As a best practice use `Map` instead of `Object`.\r\n\r\n### For more information on this vulnerability type:\r\n\r\n[Arteau, Oliver. “JavaScript prototype pollution attack in NodeJS application.” GitHub, 26 May 2018](https://github.com/HoLyVieR/prototype-pollution-nsec18/blob/master/paper/JavaScript_prototype_pollution_attack_in_NodeJS.pdf)\n\n## Remediation\n\nUpgrade `jquery` to version 3.4.0 or higher.\n\n\n## References\n\n- [GitHub Commit](https://github.com/jquery/jquery/commit/753d591aea698e57d6db58c9f722cd0808619b1b)\n\n- [GitHub PR](https://github.com/jquery/jquery/pull/4333)\n\n- [Snyk Blog](https://snyk.io/blog/after-three-years-of-silence-a-new-jquery-prototype-pollution-vulnerability-emerges-once-again/)\n",
            "disclosureTime": "2019-03-26T08:40:15Z",
            "fixedIn": [
                "3.4.0"
            ],
            "functions": [
                {
                    "functionId": {
                        "className": null,
                        "filePath": "test/core.js",
                        "functionName": "module.exports.jQuery.extend(Object, Object)"
                    },
                    "version": [
                        "<=1.8.3"
                    ]
                },
                {
                    "functionId": {
                        "className": null,
                        "filePath": "src/core.js",
                        "functionName": "jQuery.extend.jQuery.fn.extend"
                    },
                    "version": [
                        ">1.8.3 <=2.2.4"
                    ]
                },
                {
                    "functionId": {
                        "className": null,
                        "filePath": "dist/core.js",
                        "functionName": "jQuery.extend.jQuery.fn.extend"
                    },
                    "version": [
                        ">2.2.4 <=3.3.1"
                    ]
                }
            ],
            "id": "SNYK-JS-JQUERY-174006",
            "identifiers": {
                "CVE": [
                    "CVE-2019-11358",
                    "CVE-2019-5428"
                ],
                "CWE": [
                    "CWE-400"
                ]
            },
            "language": "js",
            "modificationTime": "2019-04-14T11:06:00.174270Z",
            "moduleName": "jquery",
            "packageManager": "npm",
            "packageName": "jquery",
            "patches": [],
            "publicationTime": "2019-03-27T08:40:08Z",
            "references": [
                {
                    "title": "GitHub Commit",
                    "url": "https://github.com/jquery/jquery/commit/753d591aea698e57d6db58c9f722cd0808619b1b"
                },
                {
                    "title": "GitHub PR",
                    "url": "https://github.com/jquery/jquery/pull/4333"
                },
                {
                    "title": "Snyk Blog",
                    "url": "https://snyk.io/blog/after-three-years-of-silence-a-new-jquery-prototype-pollution-vulnerability-emerges-once-again/"
                }
            ],
            "semver": {
                "vulnerable": [
                    "<3.4.0"
                ]
            },
            "severity": "medium",
            "title": "Prototype Pollution",
            "from": [
                "goof@1.0.1",
                "jquery@2.2.4"
            ],
            "upgradePath": [
                false,
                "jquery@3.4.0"
            ],
            "isUpgradable": true,
            "isPatchable": false,
            "name": "jquery",
            "version": "2.2.4"
        },
        {
            "CVSSv3": "CVSS:3.0/AV:N/AC:L/PR:N/UI:R/S:U/C:L/I:L/A:N",
            "alternativeIds": [
                "SNYK-JS-JQUERY-10186"
            ],
            "creationTime": "2016-11-06T15:12:44.538000Z",
            "credit": [
                "Egor Homakov"
            ],
            "cvssScore": 5.4,
            "description": "## Overview\r\n[`jquery`](https://www.npmjs.com/package/jquery) is JavaScript library for DOM operations.\r\n\r\nAffected versions of the package are vulnerable to Cross-site Scripting (XSS) attacks when a cross-domain ajax request is performed without the `dataType` option causing `text/javascript` responses to be executed.\r\n\r\n## Details\r\nA cross-site scripting attack occurs when the attacker tricks a legitimate web-based application or site to accept a request as originating from a trusted source.\r\n\r\nThis is done by escaping the context of the web application; the web application then delivers that data to its users along with other trusted dynamic content, without validating it. The browser unknowingly executes malicious script on the client side (through client-side languages; usually JavaScript or HTML)  in order to perform actions that are otherwise typically blocked by the browser’s Same Origin Policy.\r\n\r\nֿInjecting malicious code is the most prevalent manner by which XSS is exploited; for this reason, escaping characters in order to prevent this manipulation is the top method for securing code against this vulnerability.\r\n\r\nEscaping means that the application is coded to mark key characters, and particularly key characters included in user input, to prevent those characters from being interpreted in a dangerous context. For example, in HTML, `<` can be coded as  `&lt`; and `>` can be coded as `&gt`; in order to be interpreted and displayed as themselves in text, while within the code itself, they are used for HTML tags. If malicious content is injected into an application that escapes special characters and that malicious content uses `<` and `>` as HTML tags, those characters are nonetheless not interpreted as HTML tags by the browser if they’ve been correctly escaped in the application code and in this way the attempted attack is diverted.\r\n \r\nThe most prominent use of XSS is to steal cookies (source: OWASP HttpOnly) and hijack user sessions, but XSS exploits have been used to expose sensitive information, enable access to privileged services and functionality and deliver malware. \r\n\r\n### Types of attacks\r\nThere are a few methods by which XSS can be manipulated:\r\n\r\n|Type|Origin|Description|\r\n|--|--|--|\r\n|**Stored**|Server|The malicious code is inserted in the application (usually as a link) by the attacker. The code is activated every time a user clicks the link.|\r\n|**Reflected**|Server|The attacker delivers a malicious link externally from the vulnerable web site application to a user. When clicked, malicious code is sent to the vulnerable web site, which reflects the attack back to the user’s browser.| \r\n|**DOM-based**|Client|The attacker forces the user’s browser to render a malicious page. The data in the page itself delivers the cross-site scripting data.|\r\n|**Mutated**| |The attacker injects code that appears safe, but is then rewritten and modified by the browser, while parsing the markup. An example is rebalancing unclosed quotation marks or even adding quotation marks to unquoted parameters.|\r\n\r\n### Affected environments\r\nThe following environments are susceptible to an XSS attack:\r\n\r\n* Web servers\r\n* Application servers\r\n* Web application environments\r\n\r\n### How to prevent\r\nThis section describes the top best practices designed to specifically protect your code: \r\n\r\n* Sanitize data input in an HTTP request before reflecting it back, ensuring all data is validated, filtered or escaped before echoing anything back to the user, such as the values of query parameters during searches. \r\n* Convert special characters such as `?`, `&`, `/`, `<`, `>` and spaces to their respective HTML or URL encoded equivalents. \r\n* Give users the option to disable client-side scripts.\r\n* Redirect invalid requests.\r\n* Detect simultaneous logins, including those from two separate IP addresses, and invalidate those sessions.\r\n* Use and enforce a Content Security Policy (source: Wikipedia) to disable any features that might be manipulated for an XSS attack.\r\n* Read the documentation for any of the libraries referenced in your code to understand which elements allow for embedded HTML.\r\n\r\n\r\n## Remediation\r\nUpgrade `jquery` to version `3.0.0` or higher.\r\n\r\n## References\r\n- [GitHub Issue](https://github.com/jquery/jquery/issues/2432)\r\n- [GitHub PR](https://github.com/jquery/jquery/pull/2588)\r\n- [GitHub Commit 3.0.0](https://github.com/jquery/jquery/pull/2588/commits/c254d308a7d3f1eac4d0b42837804cfffcba4bb2)\r\n- [GitHub Commit 1.12](https://github.com/jquery/jquery/commit/f60729f3903d17917dc351f3ac87794de379b0cc)",
            "disclosureTime": "2015-06-26T21:00:00Z",
            "fixedIn": [
                "1.12.2",
                "2.2.2",
                "3.0.0"
            ],
            "functions": [],
            "id": "npm:jquery:20150627",
            "identifiers": {
                "ALTERNATIVE": [
                    "SNYK-JS-JQUERY-10186"
                ],
                "CVE": [
                    "CVE-2015-9251",
                    "CVE-2017-16012"
                ],
                "CWE": [
                    "CWE-79"
                ],
                "NSP": [
                    328
                ]
            },
            "language": "js",
            "modificationTime": "2019-03-04T17:01:12.343571Z",
            "moduleName": "jquery",
            "packageManager": "npm",
            "packageName": "jquery",
            "patches": [],
            "publicationTime": "2016-11-27T00:00:00Z",
            "references": [
                {
                    "title": "GitHub Commit 1.12",
                    "url": "https://github.com/jquery/jquery/commit/f60729f3903d17917dc351f3ac87794de379b0cc"
                },
                {
                    "title": "GitHub Commit 3.0.0",
                    "url": "https://github.com/jquery/jquery/pull/2588/commits/c254d308a7d3f1eac4d0b42837804cfffcba4bb2"
                },
                {
                    "title": "GitHub Issue",
                    "url": "https://github.com/jquery/jquery/issues/2432"
                },
                {
                    "title": "GitHub PR",
                    "url": "https://github.com/jquery/jquery/pull/2588"
                }
            ],
            "semver": {
                "vulnerable": [
                    "<1.12.2",
                    ">=1.12.3 <2.2.2",
                    ">=2.2.3 <3.0.0"
                ]
            },
            "severity": "medium",
            "title": "Cross-site Scripting (XSS)",
            "from": [
                "goof@1.0.1",
                "jquery@2.2.4"
            ],
            "upgradePath": [
                false,
                "jquery@3.0.0"
            ],
            "isUpgradable": true,
            "isPatchable": false,
            "name": "jquery",
            "version": "2.2.4"
        },
        {
            "CVSSv3": "CVSS:3.0/AV:N/AC:H/PR:N/UI:N/S:U/C:N/I:N/A:H/RL:O",
            "alternativeIds": [],
            "creationTime": "2019-03-24T09:59:28.172265Z",
            "credit": [
                "Shawn Rasheed",
                "Jens DIetrich"
            ],
            "cvssScore": 5.9,
            "description": "## Overview\n\n[js-yaml](https://www.npmjs.com/package/js-yaml) is a human-friendly data serialization language.\n\n\nAffected versions of this package are vulnerable to Denial of Service (DoS).\nThe parsing of a specially crafted YAML file may exhaust the system resources.\n\n## Details\nDenial of Service (DoS) describes a family of attacks, all aimed at making a system inaccessible to its intended and legitimate users.\r\n\r\nUnlike other vulnerabilities, DoS attacks usually do not aim at breaching security. Rather, they are focused on making websites and services unavailable to genuine users resulting in downtime.\r\n\r\nOne popular Denial of Service vulnerability is DDoS (a Distributed Denial of Service), an attack that attempts to clog network pipes to the system by generating a large volume of traffic from many machines.\r\n\r\nWhen it comes to open source libraries, DoS vulnerabilities allow attackers to trigger such a crash or crippling of the service by using a flaw either in the application code or from the use of open source libraries.\r\n\r\nTwo common types of DoS vulnerabilities:\r\n\r\n* High CPU/Memory Consumption- An attacker sending crafted requests that could cause the system to take a disproportionate amount of time to process. For example, [commons-fileupload:commons-fileupload](SNYK-JAVA-COMMONSFILEUPLOAD-30082).\r\n\r\n* Crash - An attacker sending crafted requests that could cause the system to crash. For Example,  [npm `ws` package](npm:ws:20171108)\n\n## Remediation\n\nUpgrade `js-yaml` to version 3.13.0 or higher.\n\n\n## References\n\n- [NPM Security Advisory](https://www.npmjs.com/advisories/788)\n",
            "disclosureTime": "2019-03-18T21:29:08Z",
            "fixedIn": [
                "3.13.0"
            ],
            "functions": [],
            "id": "SNYK-JS-JSYAML-173999",
            "identifiers": {
                "CVE": [],
                "CWE": [
                    "CWE-400"
                ],
                "NSP": [
                    788
                ]
            },
            "language": "js",
            "modificationTime": "2019-03-29T12:50:07.686043Z",
            "moduleName": "js-yaml",
            "packageManager": "npm",
            "packageName": "js-yaml",
            "patches": [],
            "publicationTime": "2019-03-24T10:00:08Z",
            "references": [
                {
                    "title": "NPM Security Advisory",
                    "url": "https://www.npmjs.com/advisories/788"
                }
            ],
            "semver": {
                "vulnerable": [
                    "<3.13.0"
                ]
            },
            "severity": "medium",
            "title": "Denial of Service (DoS)",
            "from": [
                "goof@1.0.1",
                "tap@5.8.0",
                "coveralls@2.13.3",
                "js-yaml@3.6.1"
            ],
            "upgradePath": [
                false,
                "tap@11.1.3",
                "coveralls@3.0.0",
                "js-yaml@3.13.0"
            ],
            "isUpgradable": true,
            "isPatchable": false,
            "name": "js-yaml",
            "version": "3.6.1"
        },
        {
            "CVSSv3": "CVSS:3.0/AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:H/A:H",
            "alternativeIds": [],
            "creationTime": "2019-04-07T11:15:19.826828Z",
            "credit": [
                "Alex Kocharin"
            ],
            "cvssScore": 8.1,
            "description": "## Overview\n\n[js-yaml](https://www.npmjs.com/package/js-yaml) is a human-friendly data serialization language.\n\n\nAffected versions of this package are vulnerable to Arbitrary Code Execution.\nWhen an object with an executable `toString()` property used as a map key, it will execute that function. This happens only for `load()`, which should not be used with untrusted data anyway. `safeLoad()` is not affected because it can't parse functions.\n\n## Remediation\n\nUpgrade `js-yaml` to version 3.13.1 or higher.\n\n\n## References\n\n- [GitHub Commit](https://github.com/nodeca/js-yaml/pull/480/commits/e18afbf1edcafb7add2c4c7b22abc8d6ebc2fa61)\n\n- [GitHub PR](https://github.com/nodeca/js-yaml/pull/480)\n",
            "disclosureTime": "2019-04-05T15:54:43Z",
            "fixedIn": [
                "3.13.1"
            ],
            "functions": [
                {
                    "functionId": {
                        "className": null,
                        "filePath": "lib/js-yaml/loader.js",
                        "functionName": "loadAll.storeMappingPair"
                    },
                    "version": [
                        ">1.0.3 <=2.1.3"
                    ]
                },
                {
                    "functionId": {
                        "className": null,
                        "filePath": "lib/js-yaml/loader.js",
                        "functionName": "storeMappingPair"
                    },
                    "version": [
                        ">2.1.3 <3.13.1"
                    ]
                }
            ],
            "id": "SNYK-JS-JSYAML-174129",
            "identifiers": {
                "CVE": [],
                "CWE": [
                    "CWE-94"
                ],
                "NSP": [
                    813
                ]
            },
            "language": "js",
            "modificationTime": "2019-05-21T08:04:29.444139Z",
            "moduleName": "js-yaml",
            "packageManager": "npm",
            "packageName": "js-yaml",
            "patches": [],
            "publicationTime": "2019-04-07T15:54:43Z",
            "references": [
                {
                    "title": "GitHub Commit",
                    "url": "https://github.com/nodeca/js-yaml/pull/480/commits/e18afbf1edcafb7add2c4c7b22abc8d6ebc2fa61"
                },
                {
                    "title": "GitHub PR",
                    "url": "https://github.com/nodeca/js-yaml/pull/480"
                }
            ],
            "semver": {
                "vulnerable": [
                    "<3.13.1"
                ]
            },
            "severity": "high",
            "title": "Arbitrary Code Execution",
            "from": [
                "goof@1.0.1",
                "tap@5.8.0",
                "coveralls@2.13.3",
                "js-yaml@3.6.1"
            ],
            "upgradePath": [
                false,
                "tap@11.1.3",
                "coveralls@3.0.0",
                "js-yaml@3.13.1"
            ],
            "isUpgradable": true,
            "isPatchable": false,
            "name": "js-yaml",
            "version": "3.6.1"
        },
        {
            "CVSSv3": "CVSS:3.0/AV:N/AC:H/PR:N/UI:N/S:U/C:N/I:N/A:H/RL:O",
            "alternativeIds": [],
            "creationTime": "2019-03-24T09:59:28.172265Z",
            "credit": [
                "Shawn Rasheed",
                "Jens DIetrich"
            ],
            "cvssScore": 5.9,
            "description": "## Overview\n\n[js-yaml](https://www.npmjs.com/package/js-yaml) is a human-friendly data serialization language.\n\n\nAffected versions of this package are vulnerable to Denial of Service (DoS).\nThe parsing of a specially crafted YAML file may exhaust the system resources.\n\n## Details\nDenial of Service (DoS) describes a family of attacks, all aimed at making a system inaccessible to its intended and legitimate users.\r\n\r\nUnlike other vulnerabilities, DoS attacks usually do not aim at breaching security. Rather, they are focused on making websites and services unavailable to genuine users resulting in downtime.\r\n\r\nOne popular Denial of Service vulnerability is DDoS (a Distributed Denial of Service), an attack that attempts to clog network pipes to the system by generating a large volume of traffic from many machines.\r\n\r\nWhen it comes to open source libraries, DoS vulnerabilities allow attackers to trigger such a crash or crippling of the service by using a flaw either in the application code or from the use of open source libraries.\r\n\r\nTwo common types of DoS vulnerabilities:\r\n\r\n* High CPU/Memory Consumption- An attacker sending crafted requests that could cause the system to take a disproportionate amount of time to process. For example, [commons-fileupload:commons-fileupload](SNYK-JAVA-COMMONSFILEUPLOAD-30082).\r\n\r\n* Crash - An attacker sending crafted requests that could cause the system to crash. For Example,  [npm `ws` package](npm:ws:20171108)\n\n## Remediation\n\nUpgrade `js-yaml` to version 3.13.0 or higher.\n\n\n## References\n\n- [NPM Security Advisory](https://www.npmjs.com/advisories/788)\n",
            "disclosureTime": "2019-03-18T21:29:08Z",
            "fixedIn": [
                "3.13.0"
            ],
            "functions": [],
            "id": "SNYK-JS-JSYAML-173999",
            "identifiers": {
                "CVE": [],
                "CWE": [
                    "CWE-400"
                ],
                "NSP": [
                    788
                ]
            },
            "language": "js",
            "modificationTime": "2019-03-29T12:50:07.686043Z",
            "moduleName": "js-yaml",
            "packageManager": "npm",
            "packageName": "js-yaml",
            "patches": [],
            "publicationTime": "2019-03-24T10:00:08Z",
            "references": [
                {
                    "title": "NPM Security Advisory",
                    "url": "https://www.npmjs.com/advisories/788"
                }
            ],
            "semver": {
                "vulnerable": [
                    "<3.13.0"
                ]
            },
            "severity": "medium",
            "title": "Denial of Service (DoS)",
            "from": [
                "goof@1.0.1",
                "tap@5.8.0",
                "nyc@6.6.1",
                "istanbul@0.4.3",
                "js-yaml@3.6.1"
            ],
            "upgradePath": [
                false,
                "tap@5.8.0",
                "nyc@6.6.1",
                "istanbul@0.4.3",
                "js-yaml@3.13.0"
            ],
            "isUpgradable": true,
            "isPatchable": false,
            "name": "js-yaml",
            "version": "3.6.1"
        },
        {
            "CVSSv3": "CVSS:3.0/AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:H/A:H",
            "alternativeIds": [],
            "creationTime": "2019-04-07T11:15:19.826828Z",
            "credit": [
                "Alex Kocharin"
            ],
            "cvssScore": 8.1,
            "description": "## Overview\n\n[js-yaml](https://www.npmjs.com/package/js-yaml) is a human-friendly data serialization language.\n\n\nAffected versions of this package are vulnerable to Arbitrary Code Execution.\nWhen an object with an executable `toString()` property used as a map key, it will execute that function. This happens only for `load()`, which should not be used with untrusted data anyway. `safeLoad()` is not affected because it can't parse functions.\n\n## Remediation\n\nUpgrade `js-yaml` to version 3.13.1 or higher.\n\n\n## References\n\n- [GitHub Commit](https://github.com/nodeca/js-yaml/pull/480/commits/e18afbf1edcafb7add2c4c7b22abc8d6ebc2fa61)\n\n- [GitHub PR](https://github.com/nodeca/js-yaml/pull/480)\n",
            "disclosureTime": "2019-04-05T15:54:43Z",
            "fixedIn": [
                "3.13.1"
            ],
            "functions": [
                {
                    "functionId": {
                        "className": null,
                        "filePath": "lib/js-yaml/loader.js",
                        "functionName": "loadAll.storeMappingPair"
                    },
                    "version": [
                        ">1.0.3 <=2.1.3"
                    ]
                },
                {
                    "functionId": {
                        "className": null,
                        "filePath": "lib/js-yaml/loader.js",
                        "functionName": "storeMappingPair"
                    },
                    "version": [
                        ">2.1.3 <3.13.1"
                    ]
                }
            ],
            "id": "SNYK-JS-JSYAML-174129",
            "identifiers": {
                "CVE": [],
                "CWE": [
                    "CWE-94"
                ],
                "NSP": [
                    813
                ]
            },
            "language": "js",
            "modificationTime": "2019-05-21T08:04:29.444139Z",
            "moduleName": "js-yaml",
            "packageManager": "npm",
            "packageName": "js-yaml",
            "patches": [],
            "publicationTime": "2019-04-07T15:54:43Z",
            "references": [
                {
                    "title": "GitHub Commit",
                    "url": "https://github.com/nodeca/js-yaml/pull/480/commits/e18afbf1edcafb7add2c4c7b22abc8d6ebc2fa61"
                },
                {
                    "title": "GitHub PR",
                    "url": "https://github.com/nodeca/js-yaml/pull/480"
                }
            ],
            "semver": {
                "vulnerable": [
                    "<3.13.1"
                ]
            },
            "severity": "high",
            "title": "Arbitrary Code Execution",
            "from": [
                "goof@1.0.1",
                "tap@5.8.0",
                "nyc@6.6.1",
                "istanbul@0.4.3",
                "js-yaml@3.6.1"
            ],
            "upgradePath": [
                false,
                "tap@5.8.0",
                "nyc@6.6.1",
                "istanbul@0.4.3",
                "js-yaml@3.13.1"
            ],
            "isUpgradable": true,
            "isPatchable": false,
            "name": "js-yaml",
            "version": "3.6.1"
        },
        {
            "CVSSv3": "CVSS:3.0/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:L/A:L",
            "alternativeIds": [],
            "creationTime": "2019-02-03T09:06:37.726000Z",
            "credit": [
                "asgerf"
            ],
            "cvssScore": 7.3,
            "description": "## Overview\n\n[lodash](https://www.npmjs.com/package/lodash) is a modern JavaScript utility library delivering modularity, performance, & extras.\n\n\nAffected versions of this package are vulnerable to Prototype Pollution.\nThe functions `merge`, `mergeWith`, and `defaultsDeep` could be tricked into adding or modifying properties of `Object.prototype`. This is due to an incomplete fix to `CVE-2018-3721`.\n\n## Details\nPrototype Pollution is a vulnerability affecting JavaScript. Prototype Pollution refers to the ability to inject properties into existing JavaScript language construct prototypes, such as objects. JavaScript allows all Object attributes to be altered, including their magical attributes such as `_proto_`, `constructor` and `prototype`. An attacker manipulates these attributes to overwrite, or pollute, a JavaScript application object prototype of the base object by injecting other values.  Properties on the `Object.prototype` are then inherited by all the JavaScript objects through the prototype chain. When that happens, this leads to either denial of service by triggering JavaScript exceptions, or it tampers with the application source code to force the code path that the attacker injects, thereby leading to remote code execution.\r\n\r\nThere are two main ways in which the pollution of prototypes occurs:\r\n\r\n-   Unsafe `Object` recursive merge\r\n    \r\n-   Property definition by path\r\n    \r\n\r\n### Unsafe Object recursive merge\r\n\r\nThe logic of a vulnerable recursive merge function follows the following high-level model:\r\n```\r\nmerge (target, source)\r\n\r\nforeach property of source\r\n\r\nif property exists and is an object on both the target and the source\r\n\r\nmerge(target[property], source[property])\r\n\r\nelse\r\n\r\ntarget[property] = source[property]\r\n```\r\n<br>  \r\n\r\nWhen the source object contains a property named `_proto_` defined with `Object.defineProperty()` , the condition that checks if the property exists and is an object on both the target and the source passes and the merge recurses with the target, being the prototype of `Object` and the source of `Object` as defined by the attacker. Properties are then copied on the `Object` prototype.\r\n\r\nClone operations are a special sub-class of unsafe recursive merges, which occur when a recursive merge is conducted on an empty object: `merge({},source)`.\r\n\r\n`lodash` and `Hoek` are examples of libraries susceptible to recursive merge attacks.\r\n\r\n### Property definition by path\r\n\r\nThere are a few JavaScript libraries that use an API to define property values on an object based on a given path. The function that is generally affected contains this signature: `theFunction(object, path, value)`\r\n\r\nIf the attacker can control the value of “path”, they can set this value to `_proto_.myValue`. `myValue` is then assigned to the prototype of the class of the object.\r\n\r\n## Types of attacks\r\n\r\nThere are a few methods by which Prototype Pollution can be manipulated:\r\n\r\n| Type |Origin  |Short description |\r\n|--|--|--|\r\n| **Denial of service (DoS)**|Client  |This is the most likely attack. <br>DoS occurs when `Object` holds generic functions that are implicitly called for various operations (for example, `toString` and `valueOf`). <br> The attacker pollutes `Object.prototype.someattr` and alters its state to an unexpected value such as `Int` or `Object`. In this case, the code fails and is likely to cause a denial of service.  <br>**For example:** if an attacker pollutes `Object.prototype.toString` by defining it as an integer, if the codebase at any point was reliant on `someobject.toString()` it would fail. |\r\n |**Remote Code Execution**|Client|Remote code execution is generally only possible in cases where the codebase evaluates a specific attribute of an object, and then executes that evaluation.<br>**For example:** `eval(someobject.someattr)`. In this case, if the attacker pollutes `Object.prototype.someattr` they are likely to be able to leverage this in order to execute code.|\r\n|**Property Injection**|Client|The attacker pollutes properties that the codebase relies on for their informative value, including security properties such as cookies or tokens.<br>  **For example:** if a codebase checks privileges for `someuser.isAdmin`, then when the attacker pollutes `Object.prototype.isAdmin` and sets it to equal `true`, they can then achieve admin privileges.|\r\n\r\n## Affected environments\r\n\r\nThe following environments are susceptible to a Prototype Pollution attack:\r\n\r\n-   Application server\r\n    \r\n-   Web server\r\n    \r\n\r\n## How to prevent\r\n\r\n1.  Freeze the prototype— use `Object.freeze (Object.prototype)`.\r\n    \r\n2.  Require schema validation of JSON input.\r\n    \r\n3.  Avoid using unsafe recursive merge functions.\r\n    \r\n4.  Consider using objects without prototypes (for example, `Object.create(null)`), breaking the prototype chain and preventing pollution.\r\n    \r\n5.  As a best practice use `Map` instead of `Object`.\r\n\r\n### For more information on this vulnerability type:\r\n\r\n[Arteau, Oliver. “JavaScript prototype pollution attack in NodeJS application.” GitHub, 26 May 2018](https://github.com/HoLyVieR/prototype-pollution-nsec18/blob/master/paper/JavaScript_prototype_pollution_attack_in_NodeJS.pdf)\n\n## Remediation\n\nUpgrade `lodash` to version 4.17.11 or higher.\n\n\n## References\n\n- [GitHub Commit](https://github.com/lodash/lodash/commit/90e6199a161b6445b01454517b40ef65ebecd2ad)\n\n- [HackerOne Report](https://hackerone.com/reports/380873)\n",
            "disclosureTime": "2018-08-31T18:21:00Z",
            "fixedIn": [
                "4.17.11"
            ],
            "functions": [
                {
                    "functionId": {
                        "className": null,
                        "filePath": "lodash.js",
                        "functionName": "merge"
                    },
                    "version": [
                        ">=0.9.0 <1.0.0"
                    ]
                },
                {
                    "functionId": {
                        "className": null,
                        "filePath": "dist/lodash.js",
                        "functionName": "merge"
                    },
                    "version": [
                        ">=1.0.0 <1.0.3"
                    ]
                },
                {
                    "functionId": {
                        "className": null,
                        "filePath": "dist/lodash.js",
                        "functionName": "runInContext.merge"
                    },
                    "version": [
                        ">=1.1.0 <2.0.0"
                    ]
                },
                {
                    "functionId": {
                        "className": null,
                        "filePath": "lodash.js",
                        "functionName": "runInContext.merge"
                    },
                    "version": [
                        ">=2.0.0 <3.0.0"
                    ]
                },
                {
                    "functionId": {
                        "className": null,
                        "filePath": "index.js",
                        "functionName": "runInContext.baseMerge"
                    },
                    "version": [
                        ">=3.0.0 <4.0.0"
                    ]
                },
                {
                    "functionId": {
                        "className": null,
                        "filePath": "index.js",
                        "functionName": "runInContext.baseMergeDeep"
                    },
                    "version": [
                        ">=3.0.0 <4.0.0"
                    ]
                },
                {
                    "functionId": {
                        "className": null,
                        "filePath": "lodash.js",
                        "functionName": "runInContext.mergeDefaults"
                    },
                    "version": [
                        ">=4.0.0 <4.17.3"
                    ]
                },
                {
                    "functionId": {
                        "className": null,
                        "filePath": "lodash.js",
                        "functionName": "runInContext.assignMergeValue"
                    },
                    "version": [
                        ">=4.0.0 <4.17.5"
                    ]
                },
                {
                    "functionId": {
                        "className": null,
                        "filePath": "lodash.js",
                        "functionName": "runInContext.baseMerge"
                    },
                    "version": [
                        ">=4.0.0 <4.17.5"
                    ]
                },
                {
                    "functionId": {
                        "className": null,
                        "filePath": "lodash.js",
                        "functionName": "runInContext.baseMergeDeep"
                    },
                    "version": [
                        ">=4.0.0 <4.17.5"
                    ]
                },
                {
                    "functionId": {
                        "className": null,
                        "filePath": "lodash.js",
                        "functionName": "safeGet"
                    },
                    "version": [
                        ">=4.17.5 <4.17.11"
                    ]
                }
            ],
            "id": "SNYK-JS-LODASH-73638",
            "identifiers": {
                "CVE": [
                    "CVE-2018-16487"
                ],
                "CWE": [
                    "CWE-400"
                ],
                "NSP": [
                    782
                ]
            },
            "language": "js",
            "modificationTime": "2019-04-14T11:07:40.784452Z",
            "moduleName": "lodash",
            "packageManager": "npm",
            "packageName": "lodash",
            "patches": [],
            "publicationTime": "2019-02-01T18:21:00Z",
            "references": [
                {
                    "title": "GitHub Commit",
                    "url": "https://github.com/lodash/lodash/commit/90e6199a161b6445b01454517b40ef65ebecd2ad"
                },
                {
                    "title": "HackerOne Report",
                    "url": "https://hackerone.com/reports/380873"
                }
            ],
            "semver": {
                "vulnerable": [
                    "<4.17.11"
                ]
            },
            "severity": "high",
            "title": "Prototype Pollution",
            "from": [
                "goof@1.0.1",
                "lodash@4.17.4"
            ],
            "upgradePath": [
                false,
                "lodash@4.17.11"
            ],
            "isUpgradable": true,
            "isPatchable": false,
            "name": "lodash",
            "version": "4.17.4"
        }
    ] as unknown as IssueData[],
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
};

export = data;

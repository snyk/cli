// swift-tools-version:5.6
// SwiftPM fixture for the unified-test-api equivalence suite.
//
// Unlike most lockfile ecosystems, the snyk-swiftpm-plugin resolves by shelling
// out to `swift package show-dependencies`, which needs the dependencies on disk.
// To stay network-free and deterministic we depend on a sibling package by path
// (Deps/LocalDep) instead of a remote git URL — no fetch, no vendored checkout,
// only the `swift` toolchain itself (gated via requiresCmd in the spec).
import PackageDescription

let package = Package(
    name: "App",
    dependencies: [
        .package(path: "Deps/LocalDep"),
    ],
    targets: [
        .executableTarget(name: "App", dependencies: [
            .product(name: "LocalDep", package: "LocalDep"),
        ]),
    ]
)

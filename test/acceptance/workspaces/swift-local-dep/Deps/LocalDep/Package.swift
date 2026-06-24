// swift-tools-version:5.6
import PackageDescription

let package = Package(
    name: "LocalDep",
    products: [
        .library(name: "LocalDep", targets: ["LocalDep"]),
    ],
    targets: [
        .target(name: "LocalDep"),
    ]
)

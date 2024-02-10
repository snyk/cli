// swift-tools-version:5.6
// The swift-tools-version declares the minimum version of Swift required to build this package.

import PackageDescription

let package = Package(
    name: "swiftPM-spike",
    
    dependencies: [
        // Dependencies declare other packages that this package depends on.
        // .package(url: /* package url */, from: "1.0.0"),
        .package(url: "https://github.com/grpc/grpc-swift.git", from: "1.7.1"),
        .package(url: "https://github.com/apple/swift-nio-extras", exact: "1.10.3"),
        .package(url: "https://github.com/swift-server/async-http-client", exact: "1.4.1"),

    ]
)

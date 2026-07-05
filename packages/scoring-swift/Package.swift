// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "HolyPadelEngine",
    products: [
        .library(name: "HolyPadelEngine", targets: ["HolyPadelEngine"])
    ],
    targets: [
        .target(
            name: "HolyPadelEngine",
            path: "Sources/HolyPadelEngine"
        ),
        .testTarget(
            name: "HolyPadelEngineTests",
            dependencies: ["HolyPadelEngine"],
            path: "Tests/HolyPadelEngineTests"
        ),
    ]
)

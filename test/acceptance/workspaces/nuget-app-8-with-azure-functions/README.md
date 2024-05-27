# dotnet_8_functions_bin_folder

Including a `<PackageReference Include="Microsoft.NET.Sdk.Functions" Version="4.1.3"/>` above version 4.x will cause
a `dotnet publish` to add `/bin` to the publish dir, confusing this logic on where the `.deps` file, containing runtime
pack information, is located.

See [this thread for more](https://github.com/Azure/azure-functions-vs-build-sdk/issues/518).

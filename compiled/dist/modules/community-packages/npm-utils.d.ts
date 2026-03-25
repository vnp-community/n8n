export declare function verifyIntegrity(packageName: string, version: string, registryUrl: string, expectedIntegrity: string): Promise<void>;
export declare function checkIfVersionExistsOrThrow(packageName: string, version: string, registryUrl: string): Promise<true>;

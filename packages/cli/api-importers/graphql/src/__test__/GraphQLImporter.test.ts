import { AbsoluteFilePath } from "@fern-api/fs-utils";
import { createMockTaskContext } from "@fern-api/task-context";
import { mkdtemp, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { describe, expect, it, vi } from "vitest";

import { GraphQLImporter } from "../GraphQLImporter.js";

describe("GraphQLImporter", () => {
    it("imports a GraphQL SDL file into a single Fern definition file", async () => {
        const tempDir = await mkdtemp(path.join(os.tmpdir(), "graphql-importer-"));
        const schemaPath = path.join(tempDir, "schema.graphql");

        await writeFile(
            schemaPath,
            `
                scalar Date
                scalar JSON
                scalar UUID
                scalar Money

                enum Status {
                    ACTIVE
                    INACTIVE
                }

                type Profile {
                    bio: String
                }

                input FilterInput {
                    limit: Int
                    tags: [String!]!
                    metadata: JSON
                    custom: Money!
                }

                type User {
                    id: ID!
                    createdAt: Date
                    profile: Profile!
                    score: Float
                    rating: Money!
                    uuid: UUID!
                    data: JSON
                    status: Status!
                    maybeNames: [String]
                }

                type Query {
                    getUser(id: ID!, filter: FilterInput): User
                }

                type Mutation {
                    updateUser(id: ID!, input: FilterInput!): User
                }
            `
        );

        const logger = {
            disable: vi.fn(),
            enable: vi.fn(),
            trace: vi.fn(),
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            log: vi.fn()
        };
        const context = createMockTaskContext({ logger });

        const importer = new GraphQLImporter(context);
        const result = await importer.import({
            absolutePathToGraphQlFile: AbsoluteFilePath.of(schemaPath)
        });

        expect(result.rootApiFile).toEqual({
            name: "api",
            "error-discrimination": {
                strategy: "status-code"
            }
        });
        expect(result.packageMarkerFile).toEqual({});
        expect(result.definitionFiles).toEqual({
            "graphql/__package__.yml": {
                service: {
                    auth: false,
                    "base-path": "",
                    endpoints: {
                        getUser: {
                            auth: false,
                            method: "POST",
                            path: "",
                            request: {
                                body: "GetUserRequest"
                            },
                            response: "optional<User>"
                        },
                        updateUser: {
                            auth: false,
                            method: "POST",
                            path: "",
                            request: {
                                body: "UpdateUserRequest"
                            },
                            response: "optional<User>"
                        }
                    }
                },
                types: {
                    Profile: {
                        properties: {
                            bio: "optional<string>"
                        }
                    },
                    FilterInput: {
                        properties: {
                            limit: "optional<integer>",
                            tags: "list<string>",
                            metadata: "optional<unknown>",
                            custom: "string"
                        }
                    },
                    User: {
                        properties: {
                            id: "string",
                            createdAt: "optional<datetime>",
                            profile: "Profile",
                            score: "optional<double>",
                            rating: "string",
                            uuid: "string",
                            data: "optional<unknown>",
                            status: "Status",
                            maybeNames: "optional<list<optional<string>>>"
                        }
                    },
                    Status: {
                        enum: ["ACTIVE", "INACTIVE"]
                    },
                    GetUserRequest: {
                        properties: {
                            id: "string",
                            filter: "optional<FilterInput>"
                        }
                    },
                    UpdateUserRequest: {
                        properties: {
                            id: "string",
                            input: "FilterInput"
                        }
                    }
                }
            }
        });
        expect(logger.warn).toHaveBeenCalledWith("Unknown GraphQL scalar Money. Defaulting to string.");
    });
});

import { GraphQLSpec } from "@fern-api/api-workspace-commons";
import { AbsoluteFilePath, join, RelativeFilePath } from "@fern-api/fs-utils";

import { OSSWorkspace } from "../OSSWorkspace.js";
import { createMockTaskContext } from "./helpers/createMockTaskContext.js";

describe("GraphQL IR generation", () => {
    it("generates IR with services, endpoints, and types from a GraphQL schema", async () => {
        const fixtureRoot = join(
            AbsoluteFilePath.of(__dirname),
            RelativeFilePath.of("../../../../register/src/ir-to-fdr-converter/__test__/fixtures/graphql")
        );
        const graphQlSpec: GraphQLSpec = {
            type: "graphql",
            absoluteFilepath: join(fixtureRoot, RelativeFilePath.of("schema.graphql")),
            absoluteFilepathToOverrides: undefined,
            namespace: undefined
        };
        const workspace = new OSSWorkspace({
            absoluteFilePath: fixtureRoot,
            allSpecs: [graphQlSpec],
            specs: [],
            generatorsConfiguration: undefined,
            workspaceName: "graphql-fixture",
            cliVersion: "0.0.0"
        });
        const context = createMockTaskContext();

        const ir = await workspace.getIntermediateRepresentation({
            context,
            audiences: { type: "all" },
            enableUniqueErrorsPerEndpoint: true,
            generateV1Examples: false,
            logWarnings: false
        });

        expect(Object.keys(ir.services)).not.toHaveLength(0);
        expect(Object.values(ir.services).some((service) => service.endpoints.length > 0)).toBe(true);
        expect(Object.keys(ir.types)).not.toHaveLength(0);
        expect(
            Object.values(ir.types).some((type) => {
                const name = type.name.name;
                if (typeof name === "string") {
                    return name === "User";
                }
                return name.originalName === "User" || name.camelCase?.safeName === "user";
            })
        ).toBe(true);
    });
});

import type { AbstractAPIWorkspace } from "@fern-api/api-workspace-commons";
import { describe, expect, it, vi } from "vitest";
import { isGraphQlOssWorkspace } from "../isGraphQlOssWorkspace.js";

function createWorkspace(overrides: Record<string, unknown>): AbstractAPIWorkspace<unknown> {
    return {
        type: "fern",
        cliVersion: "0.0.0",
        workspaceName: undefined,
        absoluteFilePath: "/tmp/workspace",
        generatorsConfiguration: undefined,
        changelog: undefined,
        getAbsoluteFilePaths: () => [],
        getDefinition: vi.fn(),
        toFernWorkspace: vi.fn(),
        ...overrides
    } as unknown as AbstractAPIWorkspace<unknown>;
}

describe("isGraphQlOssWorkspace", () => {
    it("returns true for OSS workspaces with GraphQL specs and IR generation support", () => {
        const workspace = createWorkspace({
            type: "oss",
            allSpecs: [{ type: "graphql" }],
            getIntermediateRepresentation: vi.fn()
        });

        expect(isGraphQlOssWorkspace(workspace)).toBe(true);
    });

    it("returns false for OSS workspaces without GraphQL specs", () => {
        const workspace = createWorkspace({
            type: "oss",
            allSpecs: [{ type: "openapi" }],
            getIntermediateRepresentation: vi.fn()
        });

        expect(isGraphQlOssWorkspace(workspace)).toBe(false);
    });

    it("returns false for non-OSS workspaces even if they expose similar fields", () => {
        const workspace = createWorkspace({
            type: "fern",
            allSpecs: [{ type: "graphql" }],
            getIntermediateRepresentation: vi.fn()
        });

        expect(isGraphQlOssWorkspace(workspace)).toBe(false);
    });
});

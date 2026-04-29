import type { AbstractAPIWorkspace } from "@fern-api/api-workspace-commons";
import type { OSSWorkspace } from "@fern-api/lazy-fern-workspace";

export function isGraphQlOssWorkspace(
    workspace: AbstractAPIWorkspace<unknown>
): workspace is OSSWorkspace & {
    getIntermediateRepresentation: OSSWorkspace["getIntermediateRepresentation"];
} {
    return (
        workspace.type === "oss" &&
        "allSpecs" in workspace &&
        Array.isArray(workspace.allSpecs) &&
        workspace.allSpecs.some((spec) => spec.type === "graphql") &&
        "getIntermediateRepresentation" in workspace &&
        typeof workspace.getIntermediateRepresentation === "function"
    );
}

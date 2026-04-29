import { AbsoluteFilePath, RelativeFilePath } from "@fern-api/fs-utils";
import { APIDefinitionImporter, FernDefinitionBuilderImpl } from "@fern-api/importer-commons";
import { readFile } from "fs/promises";
import {
    buildSchema,
    GraphQLEnumType,
    GraphQLInputObjectType,
    GraphQLInputType,
    GraphQLList,
    GraphQLNamedType,
    GraphQLNonNull,
    GraphQLObjectType,
    GraphQLOutputType,
    GraphQLScalarType,
    GraphQLSchema,
    GraphQLUnionType
} from "graphql";

export declare namespace GraphQLImporter {
    interface Args {
        absolutePathToGraphQlFile: AbsoluteFilePath;
    }
}

const FERN_FILEPATH = RelativeFilePath.of("graphql/__package__.yml");

export class GraphQLImporter extends APIDefinitionImporter<GraphQLImporter.Args> {
    private fernDefinitionBuilder = new FernDefinitionBuilderImpl(false);
    private warnedUnknownScalars = new Set<string>();

    public async import({
        absolutePathToGraphQlFile
    }: GraphQLImporter.Args): Promise<APIDefinitionImporter.Return> {
        const sdlContent = await readFile(absolutePathToGraphQlFile, "utf-8");
        const schema = buildSchema(sdlContent);

        this.addTypes(schema);
        this.addEndpoints(schema.getQueryType(), "POST");
        this.addEndpoints(schema.getMutationType(), "POST");

        return this.fernDefinitionBuilder.build();
    }

    private addTypes(schema: GraphQLSchema): void {
        for (const [typeName, type] of Object.entries(schema.getTypeMap())) {
            if (typeName.startsWith("__")) {
                continue;
            }
            if (type === schema.getQueryType() || type === schema.getMutationType() || type === schema.getSubscriptionType()) {
                continue;
            }

            if (type instanceof GraphQLObjectType) {
                this.fernDefinitionBuilder.addType(FERN_FILEPATH, {
                    name: type.name,
                    schema: {
                        properties: Object.fromEntries(
                            Object.values(type.getFields()).map((field) => [field.name, this.convertOutputType(field.type)])
                        )
                    }
                });
            } else if (type instanceof GraphQLInputObjectType) {
                this.fernDefinitionBuilder.addType(FERN_FILEPATH, {
                    name: type.name,
                    schema: {
                        properties: Object.fromEntries(
                            Object.values(type.getFields()).map((field) => [field.name, this.convertInputType(field.type)])
                        )
                    }
                });
            } else if (type instanceof GraphQLEnumType) {
                this.fernDefinitionBuilder.addType(FERN_FILEPATH, {
                    name: type.name,
                    schema: {
                        enum: type.getValues().map((value) => value.name)
                    }
                });
            } else if (type instanceof GraphQLUnionType) {
                this.fernDefinitionBuilder.addType(FERN_FILEPATH, {
                    name: type.name,
                    schema: {
                        discriminated: false,
                        union: type.getTypes().map((t) => t.name)
                    }
                });
            }
        }
    }

    private addEndpoints(rootType: GraphQLObjectType | null | undefined, method: "POST"): void {
        if (rootType == null) {
            return;
        }

        for (const field of Object.values(rootType.getFields())) {
            if (field.args.length > 0) {
                const requestTypeName = this.getRequestTypeName(field.name);
                this.fernDefinitionBuilder.addType(FERN_FILEPATH, {
                    name: requestTypeName,
                    schema: {
                        properties: Object.fromEntries(
                            field.args.map((arg) => [arg.name, this.convertInputType(arg.type)])
                        )
                    }
                });
            }

            this.fernDefinitionBuilder.addEndpoint(FERN_FILEPATH, {
                name: field.name,
                schema: {
                    auth: false,
                    method,
                    path: "",
                    request:
                        field.args.length > 0
                            ? {
                                  body: this.getRequestTypeName(field.name)
                              }
                            : undefined,
                    response: this.convertOutputType(field.type)
                },
                source: undefined
            });
        }
    }

    private convertOutputType(type: GraphQLOutputType): string {
        if (type instanceof GraphQLNonNull) {
            return this.convertNonNullOutputType(type.ofType);
        }
        return `optional<${this.convertNonNullOutputType(type)}>`;
    }

    private convertNonNullOutputType(type: GraphQLOutputType): string {
        if (type instanceof GraphQLList) {
            return `list<${this.convertOutputType(type.ofType)}>`;
        }
        return this.convertNamedType(type as GraphQLNamedType);
    }

    private convertInputType(type: GraphQLInputType): string {
        if (type instanceof GraphQLNonNull) {
            return this.convertNonNullInputType(type.ofType);
        }
        return `optional<${this.convertNonNullInputType(type)}>`;
    }

    private convertNonNullInputType(type: GraphQLInputType): string {
        if (type instanceof GraphQLList) {
            return `list<${this.convertInputType(type.ofType)}>`;
        }
        return this.convertNamedType(type as GraphQLNamedType);
    }

    private convertNamedType(type: GraphQLNamedType): string {
        if (type instanceof GraphQLScalarType) {
            return this.convertScalar(type);
        }
        return type.name;
    }

    private convertScalar(type: GraphQLScalarType): string {
        switch (type.name) {
            case "String":
            case "ID":
            case "UUID":
                return "string";
            case "Int":
                return "integer";
            case "Float":
                return "double";
            case "Boolean":
                return "boolean";
            case "Date":
            case "DateTime":
                return "datetime";
            case "JSON":
                return "unknown";
            default:
                this.warnUnknownScalar(type.name);
                return "string";
        }
    }

    private warnUnknownScalar(scalarName: string): void {
        if (this.isBuiltInScalar(scalarName) || this.warnedUnknownScalars.has(scalarName)) {
            return;
        }
        this.warnedUnknownScalars.add(scalarName);
        this.context?.logger.warn(`Unknown GraphQL scalar ${scalarName}. Defaulting to string.`);
    }

    private isBuiltInScalar(scalarName: string): boolean {
        return ["String", "Int", "Float", "Boolean", "ID"].includes(scalarName);
    }

    private getRequestTypeName(fieldName: string): string {
        return `${toPascalCase(fieldName)}Request`;
    }
}

function toPascalCase(value: string): string {
    return value
        .split(/[^A-Za-z0-9]+/)
        .filter((part) => part.length > 0)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join("");
}

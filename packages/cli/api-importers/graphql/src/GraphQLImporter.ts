import { AbsoluteFilePath, RelativeFilePath } from "@fern-api/fs-utils";
import { APIDefinitionImporter, FernDefinitionBuilderImpl } from "@fern-api/importer-commons";
import { readFile } from "fs/promises";
import {
    buildSchema,
    GraphQLEnumType,
    GraphQLInputObjectType,
    GraphQLInputType,
    GraphQLInterfaceType,
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
        this.addEndpoints(schema, schema.getQueryType(), "POST");
        this.addEndpoints(schema, schema.getMutationType(), "POST");

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
                            Object.values(type.getFields()).map((field) => [
                                field.name,
                                this.convertOutputType(field.type, schema)
                            ])
                        )
                    }
                });
            } else if (type instanceof GraphQLInterfaceType) {
                this.fernDefinitionBuilder.addType(FERN_FILEPATH, {
                    name: type.name,
                    schema: {
                        properties: Object.fromEntries(
                            Object.values(type.getFields()).map((field) => [
                                field.name,
                                this.convertOutputType(field.type, schema)
                            ])
                        )
                    }
                });
            } else if (type instanceof GraphQLInputObjectType) {
                this.fernDefinitionBuilder.addType(FERN_FILEPATH, {
                    name: type.name,
                    schema: {
                        properties: Object.fromEntries(
                            Object.values(type.getFields()).map((field) => [
                                field.name,
                                this.convertInputType(field.type, schema)
                            ])
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
                        union: type.getTypes().map((t) => this.convertNamedType(t, schema))
                    }
                });
            }
        }
    }

    private addEndpoints(schema: GraphQLSchema, rootType: GraphQLObjectType | null | undefined, method: "POST"): void {
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
                            field.args.map((arg) => [arg.name, this.convertInputType(arg.type, schema)])
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
                    response: this.convertOutputType(field.type, schema)
                },
                source: undefined
            });
        }
    }

    private convertOutputType(type: GraphQLOutputType, schema?: GraphQLSchema): string {
        if (type instanceof GraphQLNonNull) {
            return this.convertNonNullOutputType(type.ofType, schema);
        }
        return `optional<${this.convertNonNullOutputType(type, schema)}>`;
    }

    private convertNonNullOutputType(type: GraphQLOutputType, schema?: GraphQLSchema): string {
        if (type instanceof GraphQLList) {
            return `list<${this.convertOutputType(type.ofType, schema)}>`;
        }
        return this.convertNamedType(type as GraphQLNamedType, schema);
    }

    private convertInputType(type: GraphQLInputType, schema?: GraphQLSchema): string {
        if (type instanceof GraphQLNonNull) {
            return this.convertNonNullInputType(type.ofType, schema);
        }
        return `optional<${this.convertNonNullInputType(type, schema)}>`;
    }

    private convertNonNullInputType(type: GraphQLInputType, schema?: GraphQLSchema): string {
        if (type instanceof GraphQLList) {
            return `list<${this.convertInputType(type.ofType, schema)}>`;
        }
        return this.convertNamedType(type as GraphQLNamedType, schema);
    }

    private convertNamedType(type: GraphQLNamedType, schema?: GraphQLSchema): string {
        if (type instanceof GraphQLScalarType) {
            return this.convertScalar(type);
        }
        if (
            schema != null &&
            (type === schema.getQueryType() ||
                type === schema.getMutationType() ||
                type === schema.getSubscriptionType())
        ) {
            return "unknown";
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

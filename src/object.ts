import { GraphQLNonNull, GraphQLObjectType, GraphQLFieldConfigMap, GraphQLFieldConfigArgumentMap } from 'graphql'
import { StrongGraphQLOutputType, StrongGraphQLInputType } from './type'

/**
 * Creates a strong GraphQL object type with a fluent builder interface.
 *
 * The type will be non-null, in order to get the nullable variant of the type
 * just call `.nullable()`.
 */
export function createObjectType <TValue>(config: StrongGraphQLObjectTypeConfig<TValue, {}>): StrongGraphQLObjectType<TValue, {}>
export function createObjectType <TValue, TContext>(config: StrongGraphQLObjectTypeConfig<TValue, TContext>): StrongGraphQLObjectType<TValue, TContext>
export function createObjectType <TValue, TContext>(config: StrongGraphQLObjectTypeConfig<TValue, TContext>): StrongGraphQLObjectType<TValue, TContext> {
  return new StrongGraphQLObjectType(new StrongGraphQLNullableObjectType(config, []))
}

/**
 * A configuration object to be used when creating object types. Any extra
 * options will go straight into the type config.
 */
export type StrongGraphQLObjectTypeConfig<TValue, TContext> = {
  readonly name: string,
  readonly description?: string | undefined,
  readonly isTypeOf?: (value: any, context: TContext) => value is TValue,
}

/**
 * The object returned by `createObjectType`. It is non-null, to get the
 * nullable variant just call `.nullable()`.
 */
// Developers could just instantiate this object directly instead of using
// `createObjectType`, but the function interface feels nicer and allows us to
// add extra features like function overloading.
export
class StrongGraphQLObjectType<TValue, TContext>
extends GraphQLNonNull<StrongGraphQLNullableObjectType<TValue, TContext>>
implements StrongGraphQLOutputType<TValue> {
  // The required type flags.
  readonly _strongType = true
  readonly _strongOutputType = true
  readonly _strongValue = null

  /**
   * The name of our object type.
   */
  public readonly name: string

  constructor (nullableType: StrongGraphQLNullableObjectType<TValue, TContext>) {
    super(nullableType)
    this.name = nullableType.name
  }

  // The required type conversion methods.
  public _weakType (): this { return this }
  public _weakOutputType (): this { return this }

  /**
   * Returns a new strong GraphQL object type with a new field. This function
   * does not mutate the type it was called on.
   *
   * The field created will have a nullable type. To get a non-null field type
   * use `fieldNonNull`.
   */
  public field <TFieldValue>(config: StrongGraphQLFieldConfigWithoutArgs<TValue, TContext, TFieldValue | null | undefined>): StrongGraphQLObjectType<TValue, TContext>
  public field <TFieldValue, TArgs>(config: StrongGraphQLFieldConfigWithArgs<TValue, TArgs, TContext, TFieldValue | null | undefined>): StrongGraphQLObjectType<TValue, TContext>
  public field <TFieldValue, TArgs>(config: StrongGraphQLFieldConfig<TValue, TArgs, TContext, TFieldValue | null | undefined>): StrongGraphQLObjectType<TValue, TContext> {
    return new StrongGraphQLObjectType(this.ofType._field(config))
  }

  /**
   * Returns a new strong GraphQL object type with a new field. This function
   * does not mutate the type it was called on.
   */
  public fieldNonNull <TFieldValue>(config: StrongGraphQLFieldConfigWithoutArgs<TValue, TContext, TFieldValue>): StrongGraphQLObjectType<TValue, TContext>
  public fieldNonNull <TFieldValue, TArgs>(config: StrongGraphQLFieldConfigWithArgs<TValue, TArgs, TContext, TFieldValue>): StrongGraphQLObjectType<TValue, TContext>
  public fieldNonNull <TFieldValue, TArgs>(config: StrongGraphQLFieldConfig<TValue, TArgs, TContext, TFieldValue>): StrongGraphQLObjectType<TValue, TContext> {
    return new StrongGraphQLObjectType(this.ofType._fieldNonNull(config))
  }

  /**
   * Returns the inner nullable version of this type without mutating anything.
   */
  public nullable (): StrongGraphQLOutputType<TValue | null | undefined> {
    return this.ofType
  }
}

/**
 * The private nullable implementation of `StrongGraphQLObjectType`. Because we
 * want types to be non-null by default, but in GraphQL types are nullable by
 * default this type is also the one that actually extends from
 * `GraphQLObjectType`.
 */
export
class StrongGraphQLNullableObjectType<TValue, TContext>
extends GraphQLObjectType
implements StrongGraphQLOutputType<TValue | null | undefined> {
  // The required type flags.
  readonly _strongType = true
  readonly _strongOutputType = true
  readonly _strongValue = null

  private readonly _strongConfig: StrongGraphQLObjectTypeConfig<TValue, TContext>
  private readonly _strongFieldConfigs: Array<StrongGraphQLFieldConfig<TValue, {}, TContext, any>>

  constructor (
    config: StrongGraphQLObjectTypeConfig<TValue, TContext>,
    fieldConfigs: Array<StrongGraphQLFieldConfig<TValue, {}, TContext, any>>,
  ) {
    super({
      name: config.name,
      description: config.description,
      isTypeOf: config.isTypeOf,

      // We define a thunk which computes our fields from the fields config
      // array we’ve built.
      fields: (): GraphQLFieldConfigMap<TValue, TContext> => {
        const fields: GraphQLFieldConfigMap<TValue, TContext> = {}

        for (const fieldConfig of fieldConfigs) {
          // Create an args object that we will give to our field config. This
          // arguments object will be mutated later and filled with argument
          // configs.
          const argsDefinition: GraphQLFieldConfigArgumentMap = {}

          fields[fieldConfig.name] = {
            description: fieldConfig.description,
            deprecationReason: fieldConfig.deprecationReason,
            type: typeof fieldConfig.type === 'function' ? fieldConfig.type()._weakOutputType() : fieldConfig.type._weakOutputType(),
            args: argsDefinition,
            resolve: (source, args, context) => fieldConfig.resolve(source, args, context),
          }

          // If the field has defined some arguments, loop through the arguments
          // that exist and add them to the `args` object.
          if (fieldConfig.args) {
            for (const argName in fieldConfig.args) {
              if (fieldConfig.args.hasOwnProperty(argName)) {
                const argConfig = (fieldConfig.args as { [key: string]: StrongGraphQLArgConfig<{}> })[argName]

                argsDefinition[argName] = {
                  type: argConfig.type._weakInputType(),
                  defaultValue: argConfig.defaultValue,
                  description: argConfig.description,
                }
              }
            }
          }
        }

        return fields
      },
    })
    this._strongConfig = config
    this._strongFieldConfigs = fieldConfigs
  }

  // The required type conversion methods.
  public _weakType (): this { return this }
  public _weakOutputType (): this { return this }

  /**
   * Returns true if we already have a field of this name.
   */
  private _hasField (fieldName: string): boolean {
    return Boolean(this._strongFieldConfigs.find(({ name }) => name === fieldName))
  }

  /**
   * Throws an error if we already have a field with the provided name,
   * otherwise the function does nothing.
   */
  private _assertUniqueFieldName (fieldName: string): void {
    if (this._hasField(fieldName))
      throw new Error(`Type '${this.name}' already has a field named '${fieldName}'.`)
  }

  /**
   * This field is a private implementation detail and should not be used
   * outside of `StrongGraphQLObjectType`!
   */
  public _field <TFieldValue, TArgs>(config: StrongGraphQLFieldConfig<TValue, TArgs, TContext, TFieldValue | null | undefined>): StrongGraphQLNullableObjectType<TValue, TContext> {
    this._assertUniqueFieldName(config.name)
    return new StrongGraphQLNullableObjectType(this._strongConfig, [...this._strongFieldConfigs, {
      ...config,
      type: () => typeof config.type === 'function' ? config.type().nullable() : config.type.nullable(),
    }])
  }

  /**
   * This field is a private implementation detail and should not be used
   * outside of `StrongGraphQLObjectType`!
   */
  public _fieldNonNull <TFieldValue, TArgs>(config: StrongGraphQLFieldConfig<TValue, TArgs, TContext, TFieldValue>): StrongGraphQLNullableObjectType<TValue, TContext> {
    this._assertUniqueFieldName(config.name)
    return new StrongGraphQLNullableObjectType(this._strongConfig, [...this._strongFieldConfigs, config])
  }

  /**
   * Returns self.
   */
  public nullable (): this {
    return this
  }
}

/**
 * A type which represents the GraphQL type definition of the argument
 * TypeScript type provided.
 */
export type StrongGraphQLArgsConfig<TArgs> = {
  [TArg in keyof TArgs]: StrongGraphQLArgConfig<TArgs[TArg]>
}

/**
 * A type which represents a single argument configuration.
 */
export type StrongGraphQLArgConfig<TValue> = {
  readonly type: StrongGraphQLInputType<TValue>,
  readonly defaultValue?: TValue,
  readonly description?: string | undefined,
}

/**
 * The configration object for a single field of a strong GraphQL object type.
 * Takes a lot of generic type parameters to make sure everything is super safe!
 *
 * Arguments are optional.
 */
export type StrongGraphQLFieldConfig<TSourceValue, TArgs, TContext, TValue> = {
  readonly name: string,
  readonly description?: string | undefined,
  readonly deprecationReason?: string | undefined,
  readonly type: StrongGraphQLOutputType<TValue> | (() => StrongGraphQLOutputType<TValue>),
  readonly args?: StrongGraphQLArgsConfig<TArgs>,
  readonly resolve: (source: TSourceValue, args: TArgs, context: TContext) => TValue | Promise<TValue>,
}

/**
 * A single field configuration except for you don’t need the arguments.
 */
export type StrongGraphQLFieldConfigWithoutArgs<TSourceValue, TContext, TValue> = StrongGraphQLFieldConfig<TSourceValue, {}, TContext, TValue>

/**
 * A single field configuration except the arguments are required.
 */
export type StrongGraphQLFieldConfigWithArgs<TSourceValue, TArgs, TContext, TValue> = StrongGraphQLFieldConfig<TSourceValue, TArgs, TContext, TValue> & {
  readonly args: StrongGraphQLArgsConfig<TArgs>,
}

import { z, ZodType, type ZodIssue } from "zod";
import type { Request, Response, NextFunction, RequestHandler } from "express";
import { ValidationError } from "../types/errors";
import { asyncHandler } from "../utils/asyncHandler";

// Structure represents all schemas

type RequestSchema = {
  body?: ZodType;
  params?: ZodType;
  query?: ZodType;
};

// conditionally map out the Typescript type for each schema if a zod schema is passed otherwise unknown
/* 
if a schema to validate the body is passed eg { body: z.object({ name: z.string() }) }, TypeScript knows validated.body is { name: string }. validated.query would be unknown since no query schema was given.
*/
type ValidatedRequestData<TSchema extends RequestSchema> = {
  body: TSchema["body"] extends ZodType ? z.infer<TSchema["body"]> : unknown;
  params: TSchema["params"] extends ZodType
    ? z.infer<TSchema["params"]>
    : unknown;
  query: TSchema["query"] extends ZodType ? z.infer<TSchema["query"]> : unknown;
};

// extend the Request object in express to contain validated property(that contains safe data)
type RequestWithValidation<TSchema extends RequestSchema> = Request & {
  validated?: ValidatedRequestData<TSchema>;
};

const formatError = (source: keyof RequestSchema, errors: ZodIssue[]) => {
  return errors.map((error: ZodIssue) => ({
    detail: error.message,
    field: [source, ...error.path],
  }));
};

/* 
Allows passing a schema in two ways :
   1. pass a plain zod schema( assumed to be body) eg validate(z.object({ name: z.string() }))
   2. pass a full schema object eg validate({ body: z.object({ name: z.string() }), params: z.object({ id: z.string() }) }
*/
const normalizeSchema = <TSchema extends RequestSchema | ZodType>(
  schema: TSchema,
): RequestSchema => {
  if (schema instanceof ZodType) {
    return { body: schema } as RequestSchema;
  }

  return schema;
};

/* Middleware factory that returns middleware protected from promise rejections */
export const validate = <TSchema extends RequestSchema | ZodType>(
  schema: TSchema,
) =>
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    // mirrors what NormalizedSchema does at runtime but at the type level so typescript can track the shape of validated
    type NormalizedSchema = TSchema extends ZodType
      ? { body: TSchema }
      : TSchema;
    // cast to augmented type so typescript allows writing req.validated
    const request = req as RequestWithValidation<NormalizedSchema>;
    // normalized schema
    const requestSchema = normalizeSchema(schema);
    // empty object that will be filled with parsed and safe data
    const validated = {} as ValidatedRequestData<NormalizedSchema>;
    // accumulates all validation failures across body/params/query
    const errors: ReturnType<typeof formatError> = [];

    // validation loop
    const sources = {
      body: req.body,
      params: req.params,
      query: req.query,
    } as const;
    /* 
Iterates over whichever keys exist in the schema (body, params, query). For each:

Skip if no validator defined for that key
Run safeParse — Zod validates without throwing; returns { success: true, data } or { success: false, error }
On failure — format the errors and add them to the accumulator, then continue — this is important: it keeps going so all three sources are checked in one pass, collecting all errors at once rather than stopping at the first failure
On success — store the parsed, coerced data in validated[source]

*/
    for (const source of Object.keys(requestSchema) as Array<
      keyof RequestSchema
    >) {
      const validator = requestSchema[source];
      if (!validator) continue;

      const result = validator.safeParse(sources[source]);

      if (!result.success) {
        errors.push(...formatError(source, result.error.issues));
        continue;
      }

      // 'as never' work around to TypeScript limitation with writing to a generic mapped type — it's safe because the type is correctly inferred from the outside.
      validated[source] = result.data as never;
    }

    if (errors.length > 0) {
      return next(new ValidationError("Request validation failed", errors));
    }

    request.validated = validated;

    // on successful validation proceed
    next();
  }) as RequestHandler;

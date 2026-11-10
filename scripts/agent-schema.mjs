export function resolveRef(rootSchema, ref) {
  if (!ref.startsWith("#/")) throw new Error(ref);
  let node = rootSchema;
  for (const part of ref.slice(2).split("/")) {
    node = node?.[part];
  }
  if (node === undefined) throw new Error(ref);
  return node;
}

export function schemaErrors(schema, data, pointer = "", rootSchema = schema) {
  if (schema.$ref) {
    return schemaErrors(resolveRef(rootSchema, schema.$ref), data, pointer, rootSchema);
  }
  const errors = [];
  if (schema.oneOf) {
    const matches = schema.oneOf.filter(
      (option) => schemaErrors(option, data, pointer, rootSchema).length === 0,
    );
    if (matches.length !== 1) {
      errors.push(`${pointer} matched ${matches.length} oneOf branches`);
    }
    return errors;
  }
  if (Object.hasOwn(schema, "const") && data !== schema.const) {
    errors.push(`${pointer} const`);
  }
  if (schema.type === "object") {
    if (data === null || typeof data !== "object" || Array.isArray(data)) {
      return [`${pointer} type`];
    }
    for (const key of schema.required ?? []) {
      if (!Object.hasOwn(data, key)) errors.push(`${pointer}.${key} required`);
    }
    for (const [key, value] of Object.entries(data)) {
      const property = schema.properties?.[key];
      if (property) {
        errors.push(
          ...schemaErrors(property, value, `${pointer}.${key}`, rootSchema),
        );
      } else if (schema.additionalProperties === false) {
        errors.push(`${pointer}.${key} additional`);
      } else if (
        schema.additionalProperties &&
        typeof schema.additionalProperties === "object"
      ) {
        errors.push(
          ...schemaErrors(
            schema.additionalProperties,
            value,
            `${pointer}.${key}`,
            rootSchema,
          ),
        );
      }
      const banned = schema.propertyNames?.not?.enum;
      if (banned?.includes(key)) errors.push(`${pointer} property ${key}`);
    }
    return errors;
  }
  if (schema.type === "string") {
    if (typeof data !== "string") return [`${pointer} type`];
    if (schema.minLength !== undefined && data.length < schema.minLength) {
      errors.push(`${pointer} minLength`);
    }
    if (schema.maxLength !== undefined && data.length > schema.maxLength) {
      errors.push(`${pointer} maxLength`);
    }
    if (schema.pattern && !new RegExp(schema.pattern).test(data)) {
      errors.push(`${pointer} pattern`);
    }
    return errors;
  }
  if (schema.type === "array") {
    if (!Array.isArray(data)) return [`${pointer} type`];
    if (schema.items) {
      data.forEach((item, index) => {
        errors.push(
          ...schemaErrors(schema.items, item, `${pointer}[${index}]`, rootSchema),
        );
      });
    }
  }
  return errors;
}

export async function fetchSchema(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error(`${url} ${response.status}`);
  const schema = await response.json();
  if (schema.$id !== url) throw new Error(`${url} schema id`);
  return schema;
}

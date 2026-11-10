const REVIEW_KEYS = new Set([
  "test_cases",
  "demo_recording_url",
  "commerce",
  "commerce_description",
]);

const PUBLICATION_KEYS = new Set(["countries", "release_notes", "translations"]);

const POSITIVE_KEYS = new Set([
  "description",
  "prompt",
  "tools_triggered",
  "expected_behavior",
  "file_attachment_urls",
  "expected_output_url",
]);

const NEGATIVE_KEYS = new Set([
  "description",
  "prompt",
  "file_attachment_urls",
  "expected_output_url",
]);

const FORBIDDEN_KEYS = new Set(["test_credentials", "reviewer_instructions"]);

export function forbiddenKeyErrors(value, pointer = "") {
  const errors = [];
  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      errors.push(...forbiddenKeyErrors(item, `${pointer}[${index}]`));
    });
    return errors;
  }
  if (!value || typeof value !== "object") return errors;
  for (const [key, item] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key)) errors.push(`${pointer}.${key} is not allowed in the package`);
    errors.push(...forbiddenKeyErrors(item, `${pointer}.${key}`));
  }
  return errors;
}

function unknownKeys(value, allowed, label) {
  return Object.keys(value)
    .filter((key) => !allowed.has(key))
    .map((key) => `${label}.${key} is not a listed field`);
}

function httpsUrl(value) {
  return typeof value === "string" && /^https:\/\/\S+$/.test(value);
}

function caseErrors(item, label, positive) {
  const allowed = positive ? POSITIVE_KEYS : NEGATIVE_KEYS;
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    return [`review.test_cases.${label} must be an object`];
  }
  const errors = unknownKeys(item, allowed, `review.test_cases.${label}`);
  for (const key of ["description", "prompt"]) {
    if (typeof item[key] !== "string" || item[key].trim() === "") {
      errors.push(`review.test_cases.${label}.${key} is required`);
    }
  }
  if (positive) {
    for (const key of ["tools_triggered", "expected_behavior"]) {
      if (typeof item[key] !== "string" || item[key].trim() === "") {
        errors.push(`review.test_cases.${label}.${key} is required`);
      }
    }
  }
  if (Object.hasOwn(item, "file_attachment_urls")) {
    if (
      !Array.isArray(item.file_attachment_urls)
      || item.file_attachment_urls.some((url) => !httpsUrl(url))
    ) {
      errors.push(`review.test_cases.${label}.file_attachment_urls must be https URLs`);
    }
  }
  if (Object.hasOwn(item, "expected_output_url") && !httpsUrl(item.expected_output_url)) {
    errors.push(`review.test_cases.${label}.expected_output_url must be an https URL`);
  }
  if (typeof item.description === "string" && positive && item.description.length > 4000) {
    errors.push(`review.test_cases.${label}.description exceeds 4000 characters`);
  }
  return errors;
}

export function reviewErrors(review) {
  if (!review || typeof review !== "object" || Array.isArray(review)) {
    return ["review must be an object"];
  }
  const errors = unknownKeys(review, REVIEW_KEYS, "review");
  if (Object.hasOwn(review, "commerce") && typeof review.commerce !== "boolean") {
    errors.push("review.commerce must be a boolean");
  }
  if (
    Object.hasOwn(review, "commerce_description")
    && typeof review.commerce_description !== "string"
  ) {
    errors.push("review.commerce_description must be a string");
  }
  if (Object.hasOwn(review, "demo_recording_url") && !httpsUrl(review.demo_recording_url)) {
    errors.push("review.demo_recording_url must be an https URL");
  }
  if (!Object.hasOwn(review, "test_cases")) return errors;
  const cases = review.test_cases;
  if (!cases || typeof cases !== "object" || Array.isArray(cases)) {
    errors.push("review.test_cases must be an object");
    return errors;
  }
  errors.push(...unknownKeys(cases, new Set(["positive", "negative"]), "review.test_cases"));
  if (!Array.isArray(cases.positive) || cases.positive.length !== 5) {
    errors.push("review.test_cases.positive must contain exactly 5 cases");
  } else {
    cases.positive.forEach((item, index) => {
      errors.push(...caseErrors(item, `positive[${index}]`, true));
    });
  }
  if (!Array.isArray(cases.negative) || cases.negative.length !== 3) {
    errors.push("review.test_cases.negative must contain exactly 3 cases");
  } else {
    cases.negative.forEach((item, index) => {
      errors.push(...caseErrors(item, `negative[${index}]`, false));
    });
  }
  return errors;
}

export function publicationErrors(publication) {
  if (!publication || typeof publication !== "object" || Array.isArray(publication)) {
    return ["publication must be an object"];
  }
  const errors = unknownKeys(publication, PUBLICATION_KEYS, "publication");
  if (
    Object.hasOwn(publication, "release_notes")
    && typeof publication.release_notes !== "string"
  ) {
    errors.push("publication.release_notes must be a string");
  }
  if (Object.hasOwn(publication, "countries")) {
    if (
      !Array.isArray(publication.countries)
      || publication.countries.some((code) => typeof code !== "string" || !/^[A-Z]{2}$/.test(code))
    ) {
      errors.push("publication.countries must be uppercase country codes");
    }
  }
  return errors;
}

export function listingLimitErrors(iface) {
  const errors = [];
  if (typeof iface?.displayName !== "string" || iface.displayName.length > 30) {
    errors.push("displayName must be at most 30 characters");
  }
  if (typeof iface?.shortDescription !== "string" || iface.shortDescription.length > 30) {
    errors.push("shortDescription must be at most 30 characters");
  }
  if (typeof iface?.longDescription !== "string" || iface.longDescription.length > 4000) {
    errors.push("longDescription must be at most 4000 characters");
  }
  const prompts = Array.isArray(iface?.defaultPrompt)
    ? iface.defaultPrompt
    : iface?.defaultPrompt === undefined
      ? []
      : [iface.defaultPrompt];
  if (prompts.length > 3) errors.push("defaultPrompt must contain at most 3 entries");
  prompts.forEach((prompt, index) => {
    if (typeof prompt !== "string" || prompt.length > 128) {
      errors.push(`defaultPrompt[${index}] must be at most 128 characters`);
    }
  });
  return errors;
}

export function openaiExtensionErrors(openai) {
  if (!openai || typeof openai !== "object" || Array.isArray(openai)) {
    return ["extensions.com.openai is missing"];
  }
  const errors = forbiddenKeyErrors(openai, "extensions.com.openai");
  if (openai.review !== undefined) errors.push(...reviewErrors(openai.review));
  if (openai.publication !== undefined) errors.push(...publicationErrors(openai.publication));
  if (openai.interface !== undefined) errors.push(...listingLimitErrors(openai.interface));
  return errors;
}

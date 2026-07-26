#!/usr/bin/env bun

import fs from "fs";

const [command, configPath] = process.argv.slice(2);

if (!command || !configPath) {
  console.error("Usage: config.ts <command> <configPath>");
  process.exit(1);
}

type JsonObject = Record<string, any>;

function stripComments(raw: string) {
  return raw.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
}

function parseConfig(raw: string) {
  return JSON.parse(stripComments(raw));
}

function skipWhitespace(raw: string, index: number) {
  while (index < raw.length && /\s/.test(raw[index])) index++;
  return index;
}

function findMatchingBrace(raw: string, openIndex: number) {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = openIndex; i < raw.length; i++) {
    const ch = raw[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") depth++;
    if (ch === "}") {
      depth--;
      if (depth === 0) return i;
    }
  }

  throw new Error(`Unmatched brace at index ${openIndex}`);
}

function findProperty(raw: string, key: string, searchStart = 0, searchEnd = raw.length) {
  const pattern = `"${key}"`;
  const keyIndex = raw.indexOf(pattern, searchStart);
  if (keyIndex === -1 || keyIndex >= searchEnd) {
    throw new Error(`Property '${key}' not found`);
  }

  const colonIndex = raw.indexOf(":", keyIndex + pattern.length);
  if (colonIndex === -1 || colonIndex >= searchEnd) {
    throw new Error(`Colon for property '${key}' not found`);
  }

  const valueStart = skipWhitespace(raw, colonIndex + 1);
  return { keyIndex, colonIndex, valueStart };
}

function findObjectRange(raw: string, key: string, searchStart = 0, searchEnd = raw.length) {
  const prop = findProperty(raw, key, searchStart, searchEnd);
  if (raw[prop.valueStart] !== "{") {
    throw new Error(`Property '${key}' is not an object`);
  }
  const valueEnd = findMatchingBrace(raw, prop.valueStart) + 1;
  return { ...prop, valueEnd };
}

function getIndentBefore(raw: string, index: number) {
  const lineStart = raw.lastIndexOf("\n", index - 1) + 1;
  const match = raw.slice(lineStart, index).match(/^[ \t]*/);
  return match?.[0] ?? "";
}

function formatPrimitive(value: any) {
  return JSON.stringify(value);
}

function formatObject(obj: JsonObject, indentLevel: number): string {
  const keys = Object.keys(obj);
  if (keys.length === 0) return "{}";

  const allPrimitive = keys.every((key) => {
    const value = obj[key];
    return value === null || ["string", "number", "boolean"].includes(typeof value);
  });

  if (allPrimitive) {
    return `{ ${keys.map((key) => `${JSON.stringify(key)}: ${formatPrimitive(obj[key])}`).join(", ")} }`;
  }

  const indent = "  ".repeat(indentLevel);
  const childIndent = "  ".repeat(indentLevel + 1);
  const lines = keys.map((key) => `${childIndent}${JSON.stringify(key)}: ${formatValue(obj[key], indentLevel + 1)}`);
  return `{"\n"${lines.join(",\n")}\n${indent}}`.replace('{"\n"', '{\n');
}

function formatValue(value: any, indentLevel: number): string {
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    const indent = "  ".repeat(indentLevel);
    const childIndent = "  ".repeat(indentLevel + 1);
    return `[
${value.map((item) => `${childIndent}${formatValue(item, indentLevel + 1)}`).join(",\n")}
${indent}]`;
  }

  if (value && typeof value === "object") {
    return formatObject(value, indentLevel);
  }

  return formatPrimitive(value);
}

function buildModelsBlock(models: JsonObject) {
  const entries = Object.entries(models);
  const groups = [
    { provider: "google-antigravity", comment: null as string | null },
    { provider: "ollama-cloud", comment: "// OLLAMA MODELS NEXUS" },
    { provider: "openai-codex", comment: "// OPENAI CODEX MODELS NEXUS" },
  ];

  const grouped = new Map<string, Array<[string, any]>>();
  for (const [key, value] of entries) {
    const provider = String(value?.id || "").split("/")[0] || "unknown";
    if (!grouped.has(provider)) grouped.set(provider, []);
    grouped.get(provider)!.push([key, value]);
  }

  const ordered: Array<[string, any, string | null]> = [];
  for (const group of groups) {
    const items = grouped.get(group.provider) || [];
    items.sort((a, b) => a[0].localeCompare(b[0]));
    items.forEach((item, index) => ordered.push([item[0], item[1], index === 0 ? group.comment : null]));
    grouped.delete(group.provider);
  }

  const remaining = [...grouped.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .flatMap(([provider, items]) =>
      items
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map((item, index) => [item[0], item[1], index === 0 ? `// ${provider.toUpperCase().replace(/-/g, " ")} MODELS NEXUS` : null] as [string, any, string | null]),
    );

  const finalEntries = [...ordered, ...remaining];
  const lines: string[] = ["{"];

  finalEntries.forEach(([key, value, comment], index) => {
    if (comment) lines.push(`        ${comment}`);
    const formatted = formatValue(value, 4).split("\n");
    lines.push(`        ${JSON.stringify(key)}: ${formatted[0]}`);
    for (let i = 1; i < formatted.length; i++) {
      lines.push(`        ${formatted[i]}`);
    }
    if (index < finalEntries.length - 1) {
      lines[lines.length - 1] += ",";
    }
  });

  lines.push("      }");
  return lines.join("\n");
}

function replaceModelsBlock(raw: string, models: JsonObject) {
  const providerRange = findObjectRange(raw, "provider");
  const nexusRange = findObjectRange(raw, "goblin-nexus", providerRange.valueStart, providerRange.valueEnd);
  const modelsRange = findObjectRange(raw, "models", nexusRange.valueStart, nexusRange.valueEnd);
  const block = buildModelsBlock(models);
  return raw.slice(0, modelsRange.valueStart) + block + raw.slice(modelsRange.valueEnd);
}

function replaceOrInsertAgentModel(raw: string, agentName: string, modelKey: string) {
  const agentRoot = findObjectRange(raw, "agent");
  const agentRange = findObjectRange(raw, agentName, agentRoot.valueStart, agentRoot.valueEnd);
  const agentRaw = raw.slice(agentRange.valueStart, agentRange.valueEnd);
  const modelMatch = agentRaw.match(/"model"\s*:\s*"[^"]*"/);

  if (modelMatch) {
    const absoluteStart = agentRange.valueStart + modelMatch.index!;
    const absoluteEnd = absoluteStart + modelMatch[0].length;
    return raw.slice(0, absoluteStart) + `"model": ${JSON.stringify(modelKey)}` + raw.slice(absoluteEnd);
  }

  const closingIndex = agentRange.valueEnd - 1;
  const inner = raw.slice(agentRange.valueStart + 1, closingIndex);
  const hasProps = inner.trim().length > 0;
  const baseIndent = getIndentBefore(raw, agentRange.keyIndex);
  const propertyIndent = `${baseIndent}  `;
  const insert = hasProps
    ? `${inner.endsWith("\n") ? "" : "\n"}${propertyIndent}"model": ${JSON.stringify(modelKey)}\n${baseIndent}`
    : `\n${propertyIndent}"model": ${JSON.stringify(modelKey)}\n${baseIndent}`;

  if (hasProps) {
    const trimmedInnerEnd = closingIndex;
    let commaIndex = trimmedInnerEnd - 1;
    while (commaIndex > agentRange.valueStart && /\s/.test(raw[commaIndex])) commaIndex--;
    const prefix = raw.slice(0, commaIndex + 1);
    const suffix = raw.slice(commaIndex + 1);
    return `${prefix},${insert}${suffix}`;
  }

  return raw.slice(0, agentRange.valueStart + 1) + insert + raw.slice(closingIndex);
}

function providerDefaults(modelId: string) {
  const provider = modelId.split("/")[0] || "unknown";
  if (provider === "google-antigravity") return { context: 1048576, output: 8192 };
  if (provider === "ollama-cloud") return { context: 128000, output: 4096 };
  if (provider === "openai-codex") return { context: 400000, output: 6000 };
  return { context: 128000, output: 4096 };
}

function commandUpsertModels(raw: string) {
  // MERGE selected models into existing catalog, NOT replace
  const selectedRaw = process.env.GN_SELECTED_LINES || "";
  const json = parseConfig(raw);
  const existing: JsonObject = json.provider["goblin-nexus"].models || {};
  const lines = selectedRaw.split("\n").filter((line) => line.trim());
  let addedCount = 0;
  let skippedCount = 0;

  for (const line of lines) {
    const parts = line.split("|").map((item) => item.trim());
    const modelId = parts[0];
    const modelName = parts[1] || modelId.split("/").pop() || modelId;
    const key = modelId.split("/").pop() || modelId;
    const limit = providerDefaults(modelId);

    // Skip if key already exists with same id (deduplicate, preserve existing variants)
    if (existing[key] && existing[key].id === modelId) {
      skippedCount++;
      continue;
    }

    existing[key] = {
      id: modelId,
      name: modelName.endsWith("(Nexus)") ? modelName : `${modelName} (Nexus)`,
      capabilities: { toolcall: true, reasoning: true },
      limit,
    };
    addedCount++;
  }

  json.provider["goblin-nexus"].models = existing;
  const updated = replaceModelsBlock(raw, existing);
  fs.writeFileSync(configPath, updated);
  console.log(`✅ opencode.jsonc updated — ${addedCount} model(s) ditambah, ${skippedCount} sudah ada (skipped).`);
}

function commandUpsertModel(raw: string) {
  const json = parseConfig(raw);
  const modelKey = process.env.GN_MODEL_KEY || "";
  const modelId = process.env.GN_CUSTOM_ID || "";
  const modelName = process.env.GN_CUSTOM_NAME || modelKey;
  if (!modelKey || !modelId) throw new Error("GN_MODEL_KEY and GN_CUSTOM_ID are required");
  const limit = providerDefaults(modelId);
  if (!json.provider["goblin-nexus"].models) json.provider["goblin-nexus"].models = {};
  json.provider["goblin-nexus"].models[modelKey] = {
    id: modelId,
    name: modelName,
    capabilities: { toolcall: true, reasoning: true },
    limit,
  };
  const updated = replaceModelsBlock(raw, json.provider["goblin-nexus"].models);
  fs.writeFileSync(configPath, updated);
  console.log("✅ Custom model added to config!");
}

function commandSetAgentModel(raw: string) {
  const agent = process.env.GN_SELECTED_AGENT || "";
  const modelKey = process.env.GN_MODEL_KEY || "";
  if (!agent || !modelKey) throw new Error("GN_SELECTED_AGENT and GN_MODEL_KEY are required");
  const updated = replaceOrInsertAgentModel(raw, agent, modelKey);
  fs.writeFileSync(configPath, updated);
  console.log(`✅ Agent \"${agent}\" model diubah -> ${modelKey}`);
}

const raw = fs.readFileSync(configPath, "utf8");

switch (command) {
  case "upsert-models":
    commandUpsertModels(raw);
    break;
  case "upsert-model":
    commandUpsertModel(raw);
    break;
  case "set-agent-model":
    commandSetAgentModel(raw);
    break;
  default:
    console.error(`Unknown command: ${command}`);
    process.exit(1);
}

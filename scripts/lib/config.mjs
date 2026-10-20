// Plugin configuration. Hooks receive userConfig values as
// CLAUDE_PLUGIN_OPTION_<KEY>; the CLI gets them as explicit overrides because
// commands Claude runs through the Bash tool do not inherit those variables.

export function parseList(value) {
  if (value === undefined || value === null) return [];
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  const text = String(value).trim();
  if (!text) return [];
  if (text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed.map((v) => String(v).trim()).filter(Boolean);
    } catch {
      // not JSON, fall through to separators
    }
  }
  return text.split(/[\r\n;]+/).map((v) => v.trim()).filter(Boolean);
}

function opt(env, key) {
  const value = env[`CLAUDE_PLUGIN_OPTION_${key}`];
  return value === undefined || value === '' ? undefined : value;
}

export function loadConfig(env = process.env, overrides = {}) {
  const pick = (name, key) => (overrides[name] !== undefined && overrides[name] !== null ? overrides[name] : opt(env, key));
  return {
    draftsDir: pick('draftsDir', 'DRAFTS_DIR') ?? null,
    styleSources: parseList(pick('styleSources', 'STYLE_SOURCES')),
    protectedPaths: parseList(pick('protectedPaths', 'PROTECTED_PATHS')),
    displayName: pick('displayName', 'DISPLAY_NAME') ?? '',
    headline: pick('headline', 'HEADLINE') ?? '',
    previewStyle: pick('previewStyle', 'PREVIEW_STYLE') ?? 'cards',
  };
}

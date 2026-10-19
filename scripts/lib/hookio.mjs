// Shared plumbing for hook scripts: read the JSON payload, print a result.

export async function readStdinJson() {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  try {
    const data = JSON.parse(raw);
    return data && typeof data === 'object' ? data : null;
  } catch {
    return null;
  }
}

export function emit(result) {
  process.stdout.write(JSON.stringify(result));
}

// Runs a hook body so that nothing it does can break the session:
// any error is swallowed and the process always exits 0.
export async function runSafely(body) {
  try {
    await body();
  } catch {
    // silent by design
  }
  process.exitCode = 0;
}

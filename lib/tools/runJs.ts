import vm from "node:vm";

/**
 * Deliberately minimal sandbox: no require/process/fetch exposed, so a
 * run_js call can't touch the filesystem, network, or environment. The vm
 * module is not a hard security boundary against a determined attacker, but
 * every call here is already approved by the CEO beforehand, so this is
 * meant to contain mistakes, not hostile code.
 */
export async function runJs(code: string): Promise<{ output: string }> {
  const logs: string[] = [];
  const sandbox = {
    console: {
      log: (...args: unknown[]) => logs.push(args.map(String).join(" ")),
    },
  };
  const context = vm.createContext(sandbox);

  try {
    const script = new vm.Script(code);
    const result = script.runInContext(context, { timeout: 3000 });
    if (result !== undefined) logs.push(String(result));
  } catch (err) {
    logs.push(`Error: ${err instanceof Error ? err.message : String(err)}`);
  }

  return { output: logs.join("\n") || "(no output)" };
}

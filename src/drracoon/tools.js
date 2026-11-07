function createToolRegistry(entries = []) {
  const tools = new Map();
  for (const tool of entries) {
    if (
      !/^[A-Za-z0-9_-]{1,64}$/.test(tool.name) ||
      tools.has(tool.name) ||
      typeof tool.validate !== 'function' ||
      typeof tool.execute !== 'function' ||
      typeof tool.allowed !== 'function' ||
      !tool.parameters
    ) {
      throw new Error('invalid_tool_registration');
    }
    tools.set(tool.name, tool);
  }
  function definitions(context) {
    return [...tools.values()]
      .filter((tool) => tool.allowed(context))
      .map((tool) => ({
        type: 'function',
        function: { name: tool.name, description: tool.description, parameters: tool.parameters }
      }));
  }
  async function execute(call, context, signal) {
    const tool = tools.get(call.function.name);
    if (!tool || !tool.allowed(context)) return JSON.stringify({ error: 'tool_not_allowed' });
    let args;
    try {
      args = JSON.parse(call.function.arguments);
      if (!args || typeof args !== 'object' || Array.isArray(args) || !tool.validate(args))
        throw new Error();
    } catch {
      return JSON.stringify({ error: 'invalid_tool_arguments' });
    }
    try {
      signal.throwIfAborted();
      const output = JSON.stringify(await tool.execute(args, { ...context, signal }));
      if (!output || Buffer.byteLength(output) > 16384)
        return JSON.stringify({ error: 'tool_output_limit' });
      return output;
    } catch {
      signal.throwIfAborted();
      return JSON.stringify({ error: 'tool_failed' });
    }
  }
  return { definitions, execute };
}

module.exports = { createToolRegistry };

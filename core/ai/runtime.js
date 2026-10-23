'use strict';

// Command-line construction and response parsing for local AI backends.

function buildLlamaServerArgs({ modelPath, contextTokens, maxTokens, threads, gpuLayers, host, port }) {
  if (!modelPath) throw new Error('A GGUF model path is required');
  const args = [
    '-m', String(modelPath),
    '-c', String(Math.max(512, Math.floor(contextTokens || 2048))),
    '-n', String(Math.max(32, Math.floor(maxTokens || 512))),
    '--host', String(host || '127.0.0.1'),
    '--port', String(Math.max(1, Math.floor(port || 18080))),
    '--parallel', '1',
    '--jinja',
  ];
  if (threads && threads !== 'auto') {
    const count = Math.max(1, Math.min(128, Math.floor(Number(threads) || 1)));
    args.push('-t', String(count));
  }
  if (gpuLayers !== undefined && gpuLayers !== null) {
    const layers = gpuLayers === 'auto' ? 999 : Math.max(0, Math.floor(Number(gpuLayers) || 0));
    args.push('-ngl', String(layers));
  }
  return args;
}

function parseSseLines(buffer, onEvent) {
  let rest = buffer;
  let index;
  while ((index = rest.indexOf('\n')) !== -1) {
    const line = rest.slice(0, index).replace(/\r$/, '');
    rest = rest.slice(index + 1);
    if (!line.startsWith('data:')) continue;
    const data = line.slice(5).trim();
    if (!data || data === '[DONE]') continue;
    try {
      onEvent(JSON.parse(data));
    } catch {
      // Ignore malformed stream fragments.
    }
  }
  return rest;
}

function parseJsonLines(buffer, onEvent) {
  let rest = buffer;
  let index;
  while ((index = rest.indexOf('\n')) !== -1) {
    const line = rest.slice(0, index).trim();
    rest = rest.slice(index + 1);
    if (!line) continue;
    try {
      onEvent(JSON.parse(line));
    } catch {
      // Ignore malformed stream fragments.
    }
  }
  return rest;
}

function extractionOfOpenAiChunk(chunk) {
  const choice = chunk && chunk.choices && chunk.choices[0];
  return (choice && (choice.delta && choice.delta.content || choice.message && choice.message.content)) || '';
}

function extractionOfOllamaChunk(chunk) {
  return (chunk && chunk.message && chunk.message.content) || '';
}

module.exports = {
  buildLlamaServerArgs,
  extractionOfOllamaChunk,
  extractionOfOpenAiChunk,
  parseJsonLines,
  parseSseLines,
};

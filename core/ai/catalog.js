'use strict';

// Curated GGUF models for the managed llama.cpp runtime.
//
// These entries are suggestions, not bundled assets. The application never
// downloads a model without an explicit user action. SHA-256 values are not
// pinned in this catalog yet; the downloader computes and displays the hash of
// every completed file so users can verify it against the upstream source.

const MODEL_CATALOG = Object.freeze([
  {
    id: 'qwen2.5-0.5b-instruct-q4km',
    name: 'Qwen2.5 0.5B Instruct (Q4_K_M)',
    paramsB: 0.5,
    quant: 'Q4_K_M',
    approxSizeMB: 398,
    contextDefault: 2048,
    contextMax: 8192,
    license: 'Apache-2.0',
    licenseUrl: 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF',
    source: 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF',
    url: 'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf',
    description: 'Smallest option. Good for short summaries and explanations on low-memory machines.',
    recommendedFor: 'machines with 2-3 GB free RAM',
  },
  {
    id: 'llama-3.2-1b-instruct-q4km',
    name: 'Llama 3.2 1B Instruct (Q4_K_M)',
    paramsB: 1.2,
    quant: 'Q4_K_M',
    approxSizeMB: 808,
    contextDefault: 4096,
    contextMax: 8192,
    license: 'Llama 3.2 Community License',
    licenseUrl: 'https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF',
    source: 'https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF',
    url: 'https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf',
    description: 'Balanced quality and size for article summaries and question answering.',
    recommendedFor: 'machines with 3-4 GB free RAM',
  },
  {
    id: 'qwen2.5-1.5b-instruct-q4km',
    name: 'Qwen2.5 1.5B Instruct (Q4_K_M)',
    paramsB: 1.5,
    quant: 'Q4_K_M',
    approxSizeMB: 1120,
    contextDefault: 4096,
    contextMax: 8192,
    license: 'Apache-2.0',
    licenseUrl: 'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF',
    source: 'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF',
    url: 'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf',
    description: 'Better reasoning and multilingual output while staying CPU-friendly.',
    recommendedFor: 'machines with 4-6 GB free RAM',
  },
  {
    id: 'phi-3.5-mini-instruct-q4km',
    name: 'Phi-3.5 Mini Instruct (Q4_K_M)',
    paramsB: 3.8,
    quant: 'Q4_K_M',
    approxSizeMB: 2250,
    contextDefault: 4096,
    contextMax: 8192,
    license: 'MIT',
    licenseUrl: 'https://huggingface.co/bartowski/Phi-3.5-mini-instruct-GGUF',
    source: 'https://huggingface.co/bartowski/Phi-3.5-mini-instruct-GGUF',
    url: 'https://huggingface.co/bartowski/Phi-3.5-mini-instruct-GGUF/resolve/main/Phi-3.5-mini-instruct-Q4_K_M.gguf',
    description: 'Higher quality technical explanations; needs a comparatively strong machine.',
    recommendedFor: 'machines with 8 GB+ free RAM',
  },
]);

function getCatalog() {
  return MODEL_CATALOG.map((model) => ({ ...model }));
}

function findModel(id) {
  return MODEL_CATALOG.find((model) => model.id === id) || null;
}

function validateCatalogUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

module.exports = {
  MODEL_CATALOG,
  findModel,
  getCatalog,
  validateCatalogUrl,
};

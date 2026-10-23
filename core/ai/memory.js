'use strict';

// Conservative memory estimators for local llama.cpp inference.
// The estimate is intentionally pessimistic: refusing to load is safer than
// letting the operating system kill the browser process.

const MB = 1024 * 1024;

function normalizeMemory(input) {
  const totalMB = Math.max(0, Number(input && input.totalMB) || 0);
  const freeMB = Math.max(0, Number(input && input.freeMB) || 0);
  const configuredBudgetMB = Math.max(0, Number(input && input.configuredBudgetMB) || 0);
  return { totalMB, freeMB, configuredBudgetMB };
}

function computeBudget(input) {
  const { totalMB, freeMB, configuredBudgetMB } = normalizeMemory(input);
  if (totalMB <= 0) return 0;
  const safetyMB = Math.max(256, Math.round(totalMB * 0.15));
  const availableMB = Math.max(0, Math.min(freeMB, totalMB) - safetyMB);
  const hardCapMB = Math.round(totalMB * 0.75);
  const requestedMB = configuredBudgetMB > 0 ? configuredBudgetMB : hardCapMB;
  return Math.max(0, Math.min(requestedMB, availableMB, hardCapMB));
}

function estimateModelMemoryMB({ fileSizeMB, paramsB, contextTokens }) {
  const weightsMB = Math.max(0, Number(fileSizeMB) || 0);
  const params = Math.max(0.1, Number(paramsB) || 1);
  const ctx = Math.max(512, Number(contextTokens) || 2048);
  const runtimeOverheadMB = 160;
  const kvCacheMB = Math.max(64, Math.round((ctx / 1024) * params * 12));
  // 15% headroom for graph buffers, tokenizer, and allocator fragmentation.
  return Math.round(weightsMB * 1.15 + kvCacheMB + runtimeOverheadMB);
}

function assessModelFit({ fileSizeMB, paramsB, contextTokens, memory }) {
  const estimatedMB = estimateModelMemoryMB({ fileSizeMB, paramsB, contextTokens });
  const budgetMB = computeBudget(memory);
  if (budgetMB <= 0) {
    return {
      fits: false,
      estimatedMB,
      budgetMB,
      reason: 'Available memory could not be measured. Refusing to load the model automatically.',
    };
  }
  if (estimatedMB > budgetMB) {
    return {
      fits: false,
      estimatedMB,
      budgetMB,
      reason: `Estimated need is ${estimatedMB} MB but the safe AI budget is ${budgetMB} MB. Lower the context size or choose a smaller model.`,
    };
  }
  return { fits: true, estimatedMB, budgetMB, reason: '' };
}

function recommendedContext(contextTokens, model, memory) {
  const requested = Math.max(512, Number(contextTokens) || 2048);
  const budgetMB = computeBudget(memory);
  if (budgetMB <= 0) return Math.min(requested, 1024);
  let candidate = Math.min(requested, model && model.contextMax ? model.contextMax : requested);
  while (candidate >= 512) {
    const estimate = estimateModelMemoryMB({
      fileSizeMB: model && model.approxSizeMB ? model.approxSizeMB : 800,
      paramsB: model && model.paramsB ? model.paramsB : 1,
      contextTokens: candidate,
    });
    if (estimate <= budgetMB) return candidate;
    candidate = Math.floor(candidate / 2);
  }
  return 512;
}

function recommendedContextTokens(settings, models = [], osModule) {
  const ai = (settings && settings.ai) || {};
  const model =
    models.find((entry) => entry.id === ai.modelId) ||
    {
      approxSizeMB: 800,
      paramsB: 1,
      contextMax: 8192,
    };
  return recommendedContext(ai.contextTokens, model, readSystemMemory(osModule));
}

function readSystemMemory(osModule) {
  const os = osModule || require('os');
  const totalMB = Math.round(os.totalmem() / MB);
  const freeMB = Math.round(os.freemem() / MB);
  return { totalMB, freeMB };
}

module.exports = {
  assessModelFit,
  computeBudget,
  estimateModelMemoryMB,
  readSystemMemory,
  recommendedContext,
  recommendedContextTokens,
};

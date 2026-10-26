# PiFlex Browser — AI Inference

On-device AI via managed llama.cpp runtime and curated GGUF models.

## Components

- `core/ai/` — memory, prompt redaction/truncation, runtime args, catalog
- `src/main/services/` — AI service, runtime provisioning, model download
- First-run setup runs automatically in background; nothing sent to cloud by default

## Safety

- Page and selection text redacted before being sent to a model
- Models/runtimes downloaded only on user action or first-run auto-provision with progress surfaced

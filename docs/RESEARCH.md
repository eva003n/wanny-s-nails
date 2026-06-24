## FSM Engine
- [XState Finite State Machines Guide](https://stately.ai/docs/machines)
- [Conversation State Machines Explained](https://www.freecodecamp.org/news/how-to-build-chatbots-with-state-machines)
- [Learn how WhatsApp conversations are structured](https://developers.facebook.com/docs/whatsapp/cloud-api)

- [Whatsapp flow](https://whatsappbusiness.com/blog/whatsapp-flows-101/)
- [Whats FSM](https://www.spiceworks.com/soft-tech/what-is-fsm/)
- [AIOgram documentation](https://docs.aiogram.dev/en/v3.20.0/dispatcher/finite_state_machine/)
- [Designing FSMS](https://arxiv.org/html/2603.29140v1)
- [FSM to the rescue](https://www.haptik.ai/tech/finite-state-machines-to-the-rescue/)
- https://findy-network.github.io/blog/2023/03/13/no-code-ssi-chatbots-fsm-part-i/
- https://solyarisoftware.medium.com/dialoghi-come-macchine-a-stati-41bb748fd5b0
- https://www.zoho.com/fsm/whatsapp.html


## LLM providers
Here's every legitimate free LLM option with no self-hosting as of June 2026.

### Tier 1 — Genuinely Free, No Credit Card
#### Google Gemini API
Models: Gemini 2.0 Flash, Gemini 2.0 Flash Lite
Limits: 1,500 req/day, 1M tokens/min (Flash Lite)
URL: [aistudio.google.com](https://aistudio.google.com/)

#### Groq
Models: Llama 3.3 70B, Llama 3.1 8B, Gemma 2 9B, Mixtral 8x7B
Limits: varies per model, ~14,400 req/day on most
URL: [console.groq.com](https://console.groq.com/)
Note: fastest inference of any free option by a large margin

#### Cloudflare Workers AI

Models: Llama 3, Mistral 7B, Phi, Gemma, many others
Limits: 10,000 neurons/day free forever on free Cloudflare plan
URL: [developers.cloudflare.com/workers-ai](https://developers.cloudflare.com/)
Note: runs at edge, lowest latency if you use Cloudflare anyway

#### Cerebras

Models: Llama 3.1 8B, Llama 3.3 70B
Limits: free tier available, very fast (wafer-scale chips)
URL: [cloud.cerebras.ai](https://cloud.cerebras.ai/)
Note: comparable speed to Groq, newer platform

#### SambaNova Cloud

Models: Llama 3.3 70B, Llama 3.1 405B, DeepSeek R1
Limits: free tier, generous for low volume
URL: [cloud.sambanova.ai](https://cloud.sambanova.ai)
Note: one of the few free options with 405B and DeepSeek R1


### Tier 2 — Free Tier With Credit Card 
Required (but $0 until you exceed limits)

#### OpenAI

Models: GPT-4o mini, GPT-4o, o1-mini
Free: $5 credit on signup, then pay-as-you-go
URL: [platform.openai.com](https://platform.openai.com/)
Note: not truly free, credit runs out

#### Anthropic
Models: Claude Haiku 4.5, Claude Sonnet 4.6
Free: limited free tier via API Console
URL: [console.anthropic.com](https://platform.claude.com/)

#### Mistral AI (La Plateforme)
Models: Mistral 7B, Mixtral, Mistral Small, Mistral Large
Free: free tier on smaller models
URL: [console.mistral.ai](https://v2.auth.mistral.ai/)

#### Cohere
Models: Command R, Command R+
Free: trial tier, good for production testing
URL: [dashboard.cohere.com](https://dashboard.cohere.com/)


#### Tier 3 — Free Via Aggregators (access multiple models, one API key)
#### OpenRouter
Free models: Llama 3.3 70B, Mistral 7B, Gemma 2, DeepSeek, Phi-3, many others
URL: [openrouter.ai](https://openrouter.ai/)
Note: free models are labelled :free — filter by price = $0
Best feature: swap models without changing your code

#### NVIDIA NIM (build.nvidia.com)
Models: Llama 3.1 405B, Mistral Large, Phi-3, Gemma, DeepSeek, many others
Free: credits on signup, then pay-as-you-go
URL: [build.nvidia.com](https://build.nvidia.com/)
Note: highest quality open models available here (405B class)

#### Hugging Face Inference API

Models: thousands of open-source models
Free: rate-limited free tier on popular models
URL: [huggingface.co/inference-api](https://huggingface.co/)
Note: inconsistent availability on free tier, better for experimentation

#### together.ai
Models: Llama, Mistral, FLUX (images), many others
Free: $1 credit on signup
URL: [api.together.ai](https://api.together.ai/)


#### Tier 4 — Free Chatbot Interfaces (no API, manual use only)
These are not usable programmatically but worth knowing:
PlatformModels Availablechat.deepseek.comDeepSeek V3, DeepSeek R1gemini.google.comGemini 2.0, 2.5 Procopilot.microsoft.comGPT-4ometa.aiLlama 3perplexity.aiMultiple modelspoe.comGPT-4o, Claude, Llama, many others

## Whatsapp cloud API integration flow
```
Facebook Account
   |
   |__Meta App
   |    |__Webhooks-------------------- Step 2
   |
   |__Business Portfolio
        |_Test WhatsApp Business     --- Step 1
        | account (WABA)
        |_Your WhatsApp Business account (WABA)
        |    |__Phone Number --------------- Step 2
        |    |__Message Templates ---------- Step 2
        |    |__Payment Method ------------- Step 2
        |
        |__System User --------------------- Step 2
        |__Business Verification ----------- Step 3
```
## Progressive web apps

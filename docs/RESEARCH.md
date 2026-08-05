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

## Chatbots
-[Whatsapp chatbot by infobip](https://www.infobip.com/blog/whatsapp-chatbot-quick-guide)

## Whatsapp automation
To automate WhatsApp for your business, you can either use the built-in features on the WhatsApp Business App for simple tasks, or integrate the WhatsApp Business API via Meta with third-party tools (like ManyChat, Zapier, or AI builders) or directly for full sales, booking, and support automation

### Method 1: Basic Automation (For Small Teams & Local Stores)
You can manage basic replies natively using the free WhatsApp Business App.
1. Download/Open the WhatsApp Business App.
2. Tap the three dots (top right) and go to Settings > Business Tools.
3. Set up a Greeting Message to automatically welcome new customers or people messaging you for the first time.
4. Set up an Away Message to let customers know your operating hours and when to expect a response.
5. Create Quick Replies (keyboard shortcuts like /thanks) to send standard product info, pricing, or locations instantly.

### Method 2: Advanced Automation (For Scaling and Sales)
For advanced 24/7 AI chatbots, order tracking, and CRM integration, you must use the WhatsApp Business API.Get API Access: Set up a Meta Business Portfolio and connect your WhatsApp number via the Meta for Developers WhatsApp Hub.Connect a Third-Party Tool: Choose an automation platform to build your conversational flows or connect with your tech stack:Chatbots & Flows.

Draft Pre-Approved Templates: For marketing or outbound messages, you will need to create and submit message templates (e.g., appointment reminders, shipping updates) for Meta's approval.Deploy: 

- [Conversational Integration with WhatsApp](https://www.servicenow.com/docs/r/conversational-interfaces/virtual-agent/messg-direct-whatsapp-setup.html)

## Conversation systems
### Dialogue understanding
- Performed for every incoming message 
- Intent detection using a language model, NLP model or keyword matching
- Generate a set of commands that dictate how the user wants to progress the conversation
- Commands are passed to dialogue manager

- [Extracting-user-intent-and-inputs-in-conversation](https://medium.com/@hemantkohli1612/extracting-user-intent-and-inputs-in-conversation-91c66b14740e)
- [Intent detenction wuthout ai](https://leadnotifi.com/articles/whatsapp-bot-keyword-intent-detection-without-ai)

### Dialogue manager
Receives the commands and decides how to execute them

Can decide to:
- Start, stop or resume a flow
- Answer a question with a knowledge base using RAG
- Leverage a conversation pattern to handle unexpected interactions automatically
- Activate a backend integration (custom action)

### Response rephraser
- Respond to a message using templated messages
- Use AI for contextual responses

### Reference
- [Conversational AI with language model](https://www.rasa.com/docs/learn/concepts/calm/)
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
- [Learn what PWA can do ](https://whatpwacando.today/offline-support)
- [PWA from mdn docs](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
- [PWA using vite](https://vite-pwa-org.netlify.app)
- [Chrome docs on workbox](https://developer.chrome.com/docs/workbox/)
- [Chrome docs on service workers](https://developer.chrome.com/docs/workbox/service-worker-overview)
- [PWA docs from Web.dev](https://web.dev/learn/pwa)
- [PWA docs from miscrosoft](https://learn.microsoft.com/en-us/microsoft-edge/progressive-web-apps/#progressive-web-apps-on-windows:%7E:text=PWAs%20are%20just%20websites)
## Testing
### Learn testing fundamentals first (most important)
- [The Art of Unit Testing]()
Great introduction to writing readable, maintainable unit tests.
Best if you're relatively new to testing.
- [Growing Object-Oriented Software, Guided by Tests]()
More advanced.
Shows how tests influence software design.
- [xUnit Test Patterns]()
Often considered the reference book on testing patterns.
Best once you've written a fair number of tests.


- [Testing course from testingjavascript.com](https://www.testingjavascript.com/)
- [Testing blog from kentcdodds](kentcdodds.com/blog)
- [JavaScript Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [Google testing blog](https://testing.googleblog.com/)
- [Martin flowler blog on testing](https://martinfowler.com/testing/)

### Testing tool usage
- [Jest documentation](https://jestjs.io)
- [Vitest documentation](https://testing-library.com)
- [Testing library docs](https://testing-library.com/docs/)
- [Mocking external services(Daraja API) with Nock](https://www.npmjs.com/package/nock#how-does-it-work)
- [Supertest, testing http(Express)](https://www.npmjs.com/package/supertest)

Topics to learn:

Test suites
Assertions
Mock functions
Spies
Setup/teardown
Fake timers
Async testing
Snapshot testing (know when not to use it)

Learn integration testing

Many backend bugs occur where components interact, so integration tests are extremely valuable.

For your stack, learn how to test:

Express routes
Prisma queries
PostgreSQL
Redis
BullMQ jobs
Authentication middleware

A common stack is:

Jest or Vitest
Supertest
PostgreSQL test database
Prisma migrations
Docker Compose for test services
4. Learn Test-Driven Development (TDD)

Whether or not you adopt TDD daily, practicing it helps you design code that's easier to test.

Watch:

Kent Beck talks on TDD
Uncle Bob demonstrations
James Shore videos
5. Learn how to test databases

For your Wanny's Nails backend, this is especially important.

Practice writing tests for:

Booking creation
Booking cancellation
Payment confirmation
Preventing double booking
Reminder scheduling
Transaction rollbacks

A good integration test should verify that the database state changes as expected, not just that a function returns the right value.

6. Learn mocking properly

Understand the trade-offs between real dependencies and mocks.

Know when to:

Mock external APIs (e.g., WhatsApp Cloud API, M-Pesa)
Mock email providers
Mock Redis (or use a real Redis instance in integration tests)
Avoid mocking your own business logic unnecessarily
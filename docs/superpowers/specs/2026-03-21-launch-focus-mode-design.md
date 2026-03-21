# Launch Focus Mode Design

**Goal:** Make `/app/chat` feel like a real product workspace instead of a wrapper around a runtime.

**Approach:** Keep the hybrid architecture, but introduce a chat-specific focus mode in the wrapper shell. The wrapper still owns auth, provisioning state, credits, and launch guidance, while the embedded Paperclip workspace gets more visual priority and less competing chrome.

**Decisions:**
- `/app/chat` gets a dedicated focus layout.
- The left sidebar stays, but becomes more compact in focus mode.
- The right rail switches from a long generic checklist to a compact operations panel with real German launch guidance.
- The top header becomes smaller and less dominant on chat.
- The embedded workspace receives a slim German launch strip above the iframe with the next meaningful actions.

**Non-goals:**
- No full native chat rebuild yet.
- No assumption that a dark UI converts better; current styling simply stays aligned with the embedded Paperclip runtime for launch cohesion.

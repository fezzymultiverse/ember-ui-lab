# Ember V1.9.54 — Knowledge Graph

Ember now includes a local Knowledge Graph view. Open it from the visible plus menu under **Knowledge Graph**. It maps shared topics across saved Documents, Notes, Core Memory, and recent chats. The graph is generated on the device; it sends no graph data to a server and does not invent edges beyond shared extracted topics.

The graph is also a real chat tool named `map_knowledge`. When Ember uses it, the Thinking timeline shows **Mapping connections** as an actual tool step, with the tool result marked complete or failed. The visual panel can be refreshed as local documents change.

This is a lightweight local topic graph, not an embedding/vector database. Documents/RAG retrieval remains the source used for evidence-based document answers; the graph is for navigation and connection discovery.

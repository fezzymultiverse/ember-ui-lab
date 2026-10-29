// Ember Add-On: Document Reading (www/ai_docs.js) - V1.8.0: long documents are handled by Local Context (ember_context.js): outline, search, read chunk.
// Defines tool schemas and stub handlers for reading documents from the vault.
// Connects to Conduint Files / Bojack Secures vault path via EmberDocs bridge,
// or falls back gracefully when the bridge is absent.
'use strict';
(() => {

// ---------- tool schema ----------
const DOCS_TOOLS = [
  {
    name: 'list_documents',
    description: 'Returns a list of all documents in the vault (name, fileId, type, size).',
    parameters: {}
  },
  {
    name: 'search_documents',
    description: 'Finds documents whose name or content matches the query string (one short snippet per document). To find passages inside a long document use search_in_document.',
    parameters: { query: 'string' }
  },
  {
    name: 'read_document',
    description: 'Returns the text of a document by fileId. Only the first 8000 characters come back; if the result says truncated, the document is long: use get_document_outline, search_in_document and read_document_chunk (or run_react with mode document) instead of guessing.',
    parameters: { fileId: 'string' }
  },
  {
    name: 'summarize_document',
    description: 'Reads the START of a document by fileId (first 6000 characters) so it can be summarised. If the result says partial, the summary covers only the beginning: say so, or use the Local Context tools to cover the rest.',
    parameters: { fileId: 'string' }
  }
];
// Local Context tools (ember_context.js loads first). Missing file = the three tools simply do not exist.
if (window.EmberContext && Array.isArray(window.EmberContext.TOOLS)) window.EmberContext.TOOLS.forEach(t => DOCS_TOOLS.push(t));

// ---------- handlers ----------

async function list_documents() {
  try {
    if (window.EmberDocs && typeof window.EmberDocs.listDocuments === 'function') {
      return await window.EmberDocs.listDocuments();
    }
    return { documents: [], note: 'Document bridge not connected.' };
  } catch (e) {
    return { error: e.message || 'Could not list documents.' };
  }
}

async function search_documents(query) {
  if (!query || !query.trim()) return { results: [] };
  try {
    if (window.EmberDocs && typeof window.EmberDocs.searchDocuments === 'function') {
      return await window.EmberDocs.searchDocuments({ query: query.trim() });
    }
    // Client-side fallback: list all and filter by name
    const { documents = [] } = await list_documents();
    const q = query.trim().toLowerCase();
    const results = documents.filter(d => d.name && d.name.toLowerCase().includes(q));
    return { results };
  } catch (e) {
    return { error: e.message || 'Document search failed.' };
  }
}

async function read_document(fileId) {
  if (!fileId) return { error: 'fileId is required.' };
  try {
    if (window.EmberDocs && typeof window.EmberDocs.readDocument === 'function') {
      const result = await window.EmberDocs.readDocument({ fileId });
      // Truncate to ~8000 chars to stay inside the context window
      if (result && result.content && result.content.length > 8000) {
        const total = result.content.length;
        result.content = result.content.slice(0, 8000) + '\n[...truncated for length]';
        result.truncated = true; result.total_chars = total; result.returned_chars = 8000;
        result.hint = 'Only the first 8000 of ' + total + ' characters are shown. Use get_document_outline, search_in_document and read_document_chunk for the rest.';
      }
      return result;
    }
    return { content: null, note: 'Document bridge not connected.' };
  } catch (e) {
    return { error: e.message || 'Could not read document.' };
  }
}

// summarize_document reads the file then asks the AI inline.
// We return the raw text + a flag so ai.js can decide whether to
// send it back to the model for summarisation (avoids a double round-trip
// if the caller is already inside an AI turn).
async function summarize_document(fileId) {
  if (!fileId) return { error: 'fileId is required.' };
  try {
    const doc = await read_document(fileId);
    if (doc.error) return doc;
    if (!doc.content) return { summary: null, note: 'Document has no readable text.' };
    // Return the raw text; ai.js will include it in the next AI reply as context.
    // The AI's system prompt already tells it to summarise when this tool is called.
    const cut = doc.truncated === true || doc.content.length > 6000, total = doc.total_chars || doc.content.length;
    return Object.assign({ fileId, rawText: doc.content.slice(0, 6000), needsSummary: true }, cut ? { partial: true, total_chars: total, covers: 'the first 6000 characters only', hint: 'Say the summary covers only the start, or use search_in_document and read_document_chunk for the rest.' } : {});
  } catch (e) {
    return { error: e.message || 'Could not summarise document.' };
  }
}

// ---------- dispatcher ----------
async function dispatch(name, args) {
  switch (name) {
    case 'list_documents':    return list_documents();
    case 'search_documents':  return search_documents(args.query);
    case 'read_document':     return read_document(args.fileId);
    case 'summarize_document': return summarize_document(args.fileId);
    default:
      if (window.EmberContext && window.EmberContext.NAMES.includes(name)) return window.EmberContext.dispatch(name, args);
      return { error: 'Unknown doc tool: ' + name };
  }
}

window.EmberDocsAddon = { TOOLS: DOCS_TOOLS, dispatch };
})();

import type { TVectorDB } from 'vector-db';

export function createVectorDbProxy(getVectorDb: () => Promise<TVectorDB>): TVectorDB {
  return {
    deleteDocument: async (id, tx) => (await getVectorDb()).deleteDocument(id, tx),
    getText: async (id, documentId) => (await getVectorDb()).getText(id, documentId),
    getVersion: async () => (await getVectorDb()).getVersion(),
    indexDocument: async (document, opts) => (await getVectorDb()).indexDocument(document, opts),
    query: async (text, opts) => (await getVectorDb()).query(text, opts),
    setVersion: async (version, tx) => (await getVectorDb()).setVersion(version, tx),
    updateDocument: async (id, document) => (await getVectorDb()).updateDocument(id, document)
  };
}

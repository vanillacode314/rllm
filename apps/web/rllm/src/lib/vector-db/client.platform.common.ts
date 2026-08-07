import { logger } from '~/db/client';
import { epubRAGAdapter } from '~/lib/rag/epub';
import { pdfRAGAdapter } from '~/lib/rag/pdf';
import { splitter } from '~/lib/rag/utils';
import { vectorDb } from '~/lib/vector-db/client';

export async function deleteDocument(id: string): Promise<void> {
  await vectorDb.deleteDocument(id);
  await logger.dispatch({
    data: { id },
    dontLog: true,
    type: 'deleteDocument'
  });
}

export async function indexFile(
  file: File,
  onProgress?: (progress: number) => void
): Promise<string> {
  const adapter = file.type === 'application/epub+zip' ? epubRAGAdapter : pdfRAGAdapter;
  const text = (await adapter.getText(file)).unwrap();
  const chunks = splitter.splitText(text);
  const documentId = await vectorDb.indexDocument(chunks.values(), {
    onProgress: onProgress ? (n) => onProgress(n / chunks.length) : undefined
  });
  await logger.dispatch({
    data: { id: documentId, name: file.name },
    dontLog: true,
    type: 'createDocument'
  });
  return documentId;
}

import { createDatabaseConstants } from '~/utils/constants';

export const [TRANSIENT_VECTOR_DATABASE_PATH, TRANSIENT_VECTOR_DATABASE_NAME] =
  createDatabaseConstants('rllm-vector-transient');

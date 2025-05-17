
import { Extension } from './types';

export function createFullTextSearchExtension(): Extension {
  return {
    name: 'FullTextSearchExtension',
    model: {
      $allModels: {
        async enableFullTextSearch(columns: string[]) {
          const adapter = this.$getAdapter();
          const tableName = this.$name;
          await adapter.enableFullTextSearch(tableName, columns);
        },

        async search(query: string) {
          const adapter = this.$getAdapter();
          const tableName = this.$name;
          return adapter.searchFullText(tableName, query);
        }
      }
    }
  };
}

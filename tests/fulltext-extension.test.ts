
import { test, expect, mock } from 'bun:test';
import { createFullTextSearchExtension } from '../src/extensions/fulltext';
import { MockAdapter } from './fixtures/mock-adapter';

test('fulltext search extension setup', async () => {
  const extension = createFullTextSearchExtension();
  expect(extension.name).toBe('FullTextSearchExtension');
  expect(extension.model?.$allModels?.enableFullTextSearch).toBeDefined();
  expect(extension.model?.$allModels?.search).toBeDefined();
});

test('enableFullTextSearch calls adapter correctly', async () => {
  const mockAdapter = new MockAdapter();
  const enableSpy = mock((tableName: string, columns: string[]) => Promise.resolve());
  mockAdapter.enableFullTextSearch = enableSpy;

  const model = {
    $name: 'Post',
    $getAdapter: () => mockAdapter
  };

  const extension = createFullTextSearchExtension();
  const enableFn = extension.model?.$allModels?.enableFullTextSearch?.bind(model);
  
  await enableFn(['title', 'content']);
  
  expect(enableSpy).toHaveBeenCalledWith('Post', ['title', 'content']);
});

test('search calls adapter correctly', async () => {
  const mockAdapter = new MockAdapter();
  const searchSpy = mock((tableName: string, query: string) => Promise.resolve([]));
  mockAdapter.searchFullText = searchSpy;

  const model = {
    $name: 'Post',
    $getAdapter: () => mockAdapter
  };

  const extension = createFullTextSearchExtension();
  const searchFn = extension.model?.$allModels?.search?.bind(model);
  
  await searchFn('test query');
  
  expect(searchSpy).toHaveBeenCalledWith('Post', 'test query');
});

import { defineConfig } from './src/index';

export default defineConfig({
  headers: {
    'Content-Type': 'application/json',
    'X-Powered-By': 'tressi',
  },
  requests: [
    {
      url: 'https://jsonplaceholder.typicode.com/posts/1',
      method: 'GET',
    },
    {
      url: 'https://jsonplaceholder.typicode.com/posts',
      method: 'POST',
      payload: {
        title: 'tressi_test',
        body: 'This is a test post from tressi.',
        userId: 1,
      },
    },
    {
      url: 'https://jsonplaceholder.typicode.com/posts/1',
      method: 'PUT',
      payload: {
        id: 1,
        title: 'tressi_update',
        body: 'This is an updated post from tressi.',
        userId: 1,
      },
    },
  ],
}); 
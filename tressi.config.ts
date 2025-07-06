import { defineConfig } from 'tressi';

export default defineConfig({
  // Common headers for all requests can be defined here
  // headers: {
  //   'Authorization': `Bearer ${process.env.API_TOKEN}`,
  // },
  requests: [
    {
      url: 'https://jsonplaceholder.typicode.com/posts/1',
      method: 'GET',
    },
    {
      url: 'https://jsonplaceholder.typicode.com/posts',
      method: 'POST',
      payload: {
        name: 'Tressi Post',
      },
    },
  ],
});

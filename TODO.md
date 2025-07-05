This file tracks potential new features and improvements for `tressi`

## Future Features

- [ ] **Request Scenarios**: Allow users to define an ordered sequence of requests to simulate realistic user journeys. This could include passing data from one response to subsequent requests (e.g., auth tokens).

- [ ] **Dynamic Payloads**: Integrate a library like `Faker.js` to allow for the generation of dynamic data (e.g., random usernames, emails) in request payloads.

- [ ] **Response Assertions**: Allow users to define custom assertions on responses, such as checking for specific body content or headers, to provide a more accurate measure of success.

- [ ] **HTML Reports**: Add a feature to generate a standalone HTML report with interactive charts and a detailed breakdown of test results.

- [ ] **Load Ramping**: Implement a "ramp-up" period where the number of concurrent workers gradually increases over time to better identify performance degradation points.

- [x] **`init` Command**: Create a new CLI command (`npx tressi init`) to generate a boilerplate `tressi.config.ts` file in the user's current directory, improving the initial setup experience.

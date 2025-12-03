export type TressiServerRoute = {
  route: string;
  method: 'get' | 'post' | 'delete';
};

export const serverRoutes = {
  health: {
    route: '/api/health',
    method: 'get',
  },
  metrics: {
    route: '/api/metrics/stream',
    method: 'get',
  },
  test: {
    route: '/api/test',
    method: 'post',
  },
  status: {
    route: '/api/load-test/status',
    method: 'get',
  },
  configs: {
    route: '/api/configs',
    method: 'get',
  },
  configById: {
    route: '/api/configs/:id',
    method: 'get',
  },
  saveConfig: {
    route: '/api/configs',
    method: 'post',
  },
  deleteConfig: {
    route: '/api/configs/:id',
    method: 'delete',
  },
} as const satisfies Record<string, TressiServerRoute>;

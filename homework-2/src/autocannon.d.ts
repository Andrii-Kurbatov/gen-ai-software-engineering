declare module 'autocannon' {
  interface AutocannonOptions {
    url: string;
    connections?: number;
    pipelining?: number;
    duration?: number;
    method?: string;
    setupClient?: (client: any) => void;
    setupRequest?: (req: any) => void;
    requests?: Array<{
      path?: string;
      method?: string;
      headers?: Record<string, string>;
      body?: string;
      setupRequest?: (req: any) => void;
    }>;
  }

  interface AutocannonResult {
    errors: number;
    timeouts: number;
  }

  function autocannon(options: AutocannonOptions): Promise<AutocannonResult>;

  export default autocannon;
}

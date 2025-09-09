// Minimal ambient declarations for Node 18+ global Web Fetch API in test envs
// Many runners already include these. This is safe to keep and avoids TS complaints.
interface HeadersInit { [key: string]: string | string[] | undefined; }
declare var Request: {
  prototype: Request;
  new(input: RequestInfo | URL | string, init?: RequestInit): Request;
};
declare var Response: {
  prototype: Response;
  new(body?: BodyInit | null, init?: ResponseInit): Response;
};
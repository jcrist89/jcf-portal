import { createHandler } from "./bridge.ts";

Deno.serve(createHandler((name) => Deno.env.get(name)));

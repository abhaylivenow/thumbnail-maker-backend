# thumbnail-backend

Express + TypeScript API that takes video frames, asks a model which frame makes the best
thumbnail, and returns that frame. Deployed on Railway. Postgres via Supabase.

Early-stage MVP. Prefer simple, direct code over abstraction; don't build for scale that
isn't here yet.

## Commands

```bash
npm run dev      # nodemon + tsx, watches src/
npm run build    # tsc -> dist/
npm start        # node dist/index.js
npx tsc --noEmit # typecheck only
```

Node 25, CommonJS (`"type": "commonjs"`), `strict: true`.

## Layout

| File | Role |
|---|---|
| `src/index.ts` | App setup, `/health`, `/test-db`, mounts `/jobs`, error handler |
| `src/routes/jobs.ts` | `POST /jobs` — the whole pipeline |
| `src/lib/supabase.ts` | Supabase client, service-role key, throws at import if env is missing |
| `src/lib/openai.ts` | `generateThumbnail(frames)` — Responses API + `image_generation` tool |
| `src/types.d.ts` | Augments `Express.Request` with optional `user` |

## POST /jobs

Multipart, field name `frames`, up to 10 images, 10MB each, images only.

1. 400 if no files.
2. `randomUUID()` for the job id, insert row as `processing`.
3. Frame buffers -> `data:` URLs -> `generateThumbnail`, which sends them to the Responses
   API as `input_image` references alongside the thumbnail prompt.
4. Pull the base64 image out of the `image_generation_call` output item.
5. Update row to `done`, respond `{ jobId, status, result }` where `result` is
   `{ thumbnailBase64, thumbnailMimeType, totalFramesReceived }`.
6. Any throw -> row set to `failed` with the message, respond 500.

Models live as constants at the top of `src/lib/openai.ts`: `gpt-5.5` drives the call,
`gpt-image-2.5-sunburst` renders, at `1024x1536` portrait with `input_fidelity: "high"`
so faces stay recognizable.

### jobs table

```sql
create table jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  status text default 'pending',   -- processing | done | failed
  result jsonb,
  error text,
  created_at timestamp default now(),
  completed_at timestamp
);
```

All job output goes inside the `result` jsonb. Don't add columns for it.

## Rules

### Secrets

Secret files are off-limits.

Never open, read, access, print, grep, search, edit, copy, move, summarize, or otherwise
inspect:

- `.env`
- `.env.*`
- `*.pem`
- `*.key`
- `credentials.json`
- `secrets.json`
- Any other file containing API keys, access tokens, passwords, private keys,
  service-role keys, or credentials.

Do not use `env`, `printenv`, `set`, `export`, `echo $SOME_KEY`, or other commands that
could reveal environment variable values.

Never put a secret value in source code, logs, commits, tests, documentation, tool
output, terminal output, or a reply.

Refer to secrets only by their environment variable name, for example:

```ts
process.env.OPENAI_API_KEY
process.env.SUPABASE_URL
process.env.SUPABASE_SERVICE_ROLE_KEY
```

Assume required secrets are already configured correctly.

When debugging configuration, you may only check whether an environment variable is
defined (`true` / `false`). Never inspect or output its value, partial value,
prefix/suffix, length, decoded contents, or any derived representation of the secret.

Do not modify `.env` or any other secret file.

If a task requires adding or changing an environment variable, provide the variable
name and expected format and ask me to make the change manually.

If completing a task would genuinely require reading, modifying, or exposing a secret,
stop and ask me to perform that step manually.

### Images are never persisted

Multer uses memory storage. Frames live in RAM for the request and that's it — no disk
writes, no Supabase Storage, no buckets.

Only job status/result metadata reaches Postgres.

### Service-role key bypasses RLS

The Supabase service-role key is server-side only.

It must never:

- Reach the client.
- Appear in an API response.
- Be logged.
- Be committed.
- Be included in error messages.

Access it only through `process.env.SUPABASE_SERVICE_ROLE_KEY`.

## Placeholders to replace

These are deliberate stand-ins, not bugs:

- `user_id` is hardcoded to `00000000-0000-0000-0000-000000000000`. Auth isn't wired
  up; `req.user?.id` is already read first, so middleware is the only thing missing.
- Job processing is inline. BullMQ/Redis workers are planned, not built.

## Gotchas

- `SUPABASE_URL` is the **Project URL** (`https://<ref>.supabase.co`) — no path, no
  trailing slash. Pasting the REST endpoint instead gives `/rest/v1/rest/v1/...` and
  the confusing error `Invalid path specified in request URL`.

- nodemon watches `.ts`, not `.env`. Env changes need a manual restart.

- Image `size` must have **both** width and height divisible by 16, with an aspect ratio
  between 1:3 and 3:1. The obvious Shorts size `1080x1920` is rejected (1080 ÷ 16 = 67.5).
  Use `1088x1920`, or `1152x2048` for exact 9:16.

- `gpt-image-2.5-sunburst` rejects `input_fidelity` with a 400. The SDK types accept it —
  the union is shared across all image models, so per-model support is only discoverable
  at runtime. Treat the live API as the source of truth for which params a model takes.

- `POST /jobs` is synchronous — the client waits for the whole model call. Fine against
  the stub, but a real 10–30s call will hit Railway's request timeout. The fix when
  that lands: return 202 with the `jobId`, process in the background, add
  `GET /jobs/:id` to poll.

- `result.thumbnailBase64` puts a whole image in the jsonb column, ~33% larger than the
  file. Acceptable now; revisit when real images and polling arrive.
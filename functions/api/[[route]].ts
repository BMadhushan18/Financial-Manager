// Cloudflare Pages Function: every /api/* request lands here and is routed
// by server/router.ts. Handlers register themselves on import.
import '../../server/handlers/core';
import '../../server/handlers/wishlist';
import '../../server/handlers/expenses';
import '../../server/handlers/cycle';
import '../../server/handlers/reports';
import '../../server/handlers/backup';
import type { Env } from '../../server/http';
import { dispatch } from '../../server/router';

export const onRequest: PagesFunction<Env> = ({ request, env }) => dispatch(request, env);

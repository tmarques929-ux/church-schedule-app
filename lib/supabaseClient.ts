'use client';

import { createBrowserSupabaseClient } from '@supabase/auth-helpers-nextjs';

/**
 * Browser Supabase client wired with Next.js auth helpers so that the session
 * is mirrored in cookies and reconhecida pelos componentes server.
 */
export const supabase = createBrowserSupabaseClient();

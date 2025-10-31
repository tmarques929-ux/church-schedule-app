import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@lib/supabaseServer';

const USERNAME_REGEX = /^[a-z0-9._-]+$/;

function isJsonRequest(req: Request) {
  const contentType = req.headers.get('content-type') || '';
  return contentType.includes('application/json');
}

type ResolveBody = {
  identifier?: unknown;
  username?: unknown;
  email?: unknown;
};

export async function POST(request: Request) {
  try {
    let payload: ResolveBody = {};
    if (isJsonRequest(request)) {
      payload = (await request.json().catch(() => ({}))) as ResolveBody;
    }

    const identifierSource = [payload.identifier, payload.username, payload.email].find(
      (value) => typeof value === 'string' && value.trim().length > 0
    );

    if (!identifierSource) {
      return NextResponse.json(
        { error: 'Informe username ou email para autenticar.' },
        { status: 400 }
      );
    }

    const rawIdentifier = identifierSource.trim();
    const normalizedIdentifier = rawIdentifier.toLowerCase();

    if (normalizedIdentifier.includes('@')) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({
        email: normalizedIdentifier,
        perPage: 1
      });
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      const user = data?.users?.[0];
      if (!user?.email) {
        return NextResponse.json({ error: 'Usuario nao encontrado.' }, { status: 404 });
      }
      return NextResponse.json({
        email: user.email,
        userId: user.id,
        username: (user.user_metadata as { username?: string } | null)?.username || null
      });
    }

    if (!USERNAME_REGEX.test(normalizedIdentifier)) {
      return NextResponse.json(
        { error: 'Usuario deve conter apenas letras, numeros e os caracteres ._-.' },
        { status: 400 }
      );
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('user_id, username')
      .eq('username', normalizedIdentifier)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }

    if (!profile) {
      return NextResponse.json({ error: 'Usuario nao encontrado.' }, { status: 404 });
    }

    const { data: userInfo, error: userInfoError } = await supabaseAdmin.auth.admin.getUserById(
      profile.user_id
    );

    if (userInfoError) {
      return NextResponse.json({ error: userInfoError.message }, { status: 400 });
    }

    const resolvedEmail = userInfo?.user?.email;

    if (!resolvedEmail) {
      return NextResponse.json(
        { error: 'Email nao cadastrado para este usuario.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      email: resolvedEmail,
      userId: profile.user_id,
      username: profile.username
    });
  } catch (error: any) {
    console.error('Erro em /api/auth/resolve:', error);
    return NextResponse.json(
      { error: error?.message || 'Erro interno no servidor.' },
      { status: 500 }
    );
  }
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}

export function GET() {
  return NextResponse.json({ error: 'Metodo nao permitido.' }, { status: 405 });
}

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@lib/supabaseServer';
import { ensureAdmin } from '../_utils/ensureAdmin';

const DEFAULT_PASSWORD = process.env.DEFAULT_USER_PASSWORD || 'MudarSenha123';
const DEFAULT_EMAIL_DOMAIN = (process.env.DEFAULT_USER_EMAIL_DOMAIN || 'voluntarios.icctremembe.local').toLowerCase();

export async function POST(request: Request) {
  const adminCheck = await ensureAdmin();
  if ('errorResponse' in adminCheck) {
    return adminCheck.errorResponse;
  }

  const body = await request.json();
  const action = body?.action ?? 'create';

  switch (action) {
    case 'create': {
      const { name, role, username, ministryIds } = body;
      if (!name || !username) {
        return NextResponse.json({ error: 'Nome e username sao obrigatorios' }, { status: 400 });
      }
      const normalizedUsername = String(username).trim().toLowerCase();
      if (!/^[a-z0-9._-]+$/.test(normalizedUsername)) {
        return NextResponse.json(
          { error: 'Username deve conter apenas letras, numeros e os caracteres ._- (sem espacos)' },
          { status: 400 }
        );
      }
      const generatedEmail = `${normalizedUsername}@${DEFAULT_EMAIL_DOMAIN}`;
      const { data: existingProfile, error: existingProfileError } = await supabaseAdmin
        .from('profiles')
        .select('user_id')
        .eq('username', normalizedUsername)
        .maybeSingle();
      if (existingProfileError) {
        return NextResponse.json({ error: existingProfileError.message }, { status: 400 });
      }
      if (existingProfile) {
        return NextResponse.json({ error: 'Username ja utilizado' }, { status: 409 });
      }
      const normalizedMinistryIds =
        Array.isArray(ministryIds) && ministryIds.length > 0
          ? ministryIds
              .map((value: unknown) => (typeof value === 'string' ? value.trim() : ''))
              .filter((value: string) => value.length > 0)
          : [];

      const { data: created, error: creationError } = await supabaseAdmin.auth.admin.createUser({
        email: generatedEmail,
        password: DEFAULT_PASSWORD,
        email_confirm: true,
        user_metadata: { name, username: normalizedUsername }
      });
      if (creationError || !created?.user) {
        return NextResponse.json({ error: creationError?.message || 'Nao foi possivel criar o usuario' }, { status: 400 });
      }
      const { error: profileInsertError } = await supabaseAdmin.from('profiles').insert({
        user_id: created.user.id,
        name,
        role: role === 'ADMIN' ? 'ADMIN' : 'MEMBER',
        username: normalizedUsername
      });
      if (profileInsertError) {
        await supabaseAdmin.auth.admin.deleteUser(created.user.id);
        return NextResponse.json({ error: profileInsertError.message }, { status: 400 });
      }

      if (normalizedMinistryIds.length > 0) {
        const insertRows = normalizedMinistryIds.map((ministryId: string) => ({
          member_id: created.user.id,
          ministry_id: ministryId
        }));
        const { error: ministriesInsertError } = await supabaseAdmin
          .from('member_ministries')
          .upsert(insertRows, { onConflict: 'member_id, ministry_id' });
        if (ministriesInsertError) {
          await supabaseAdmin.from('profiles').delete().eq('user_id', created.user.id);
          await supabaseAdmin.auth.admin.deleteUser(created.user.id);
          return NextResponse.json({ error: ministriesInsertError.message }, { status: 400 });
        }
      }
      return NextResponse.json({ success: true, defaultPassword: DEFAULT_PASSWORD });
    }

    case 'resetPassword': {
      const { userId, email, username, identifier, newPassword } = body;
      if (!newPassword || newPassword.length < 8) {
        return NextResponse.json({ error: 'Informe uma nova senha com pelo menos 8 caracteres' }, { status: 400 });
      }
      let targetUserId = typeof userId === 'string' ? userId : undefined;
      const lookupQueue: Array<{ kind: 'username' | 'email'; value: string }> = [];

      const pushUsername = (value: unknown) => {
        if (typeof value !== 'string') return;
        const normalized = value.trim().toLowerCase();
        if (!normalized) return;
        if (!lookupQueue.some((item) => item.kind === 'username' && item.value === normalized)) {
          lookupQueue.push({ kind: 'username', value: normalized });
        }
      };
      const pushEmail = (value: unknown) => {
        if (typeof value !== 'string') return;
        const normalized = value.trim().toLowerCase();
        if (!normalized) return;
        if (!lookupQueue.some((item) => item.kind === 'email' && item.value === normalized)) {
          lookupQueue.push({ kind: 'email', value: normalized });
        }
      };

      pushUsername(username);
      if (typeof identifier === 'string') {
        const trimmed = identifier.trim();
        if (trimmed.includes('@')) {
          pushEmail(trimmed);
        } else {
          pushUsername(trimmed);
        }
      }
      pushEmail(email);

      if (!targetUserId) {
        if (lookupQueue.length === 0) {
          return NextResponse.json({ error: 'Informe username, email ou ID do usuario para redefinir a senha' }, { status: 400 });
        }
        for (const item of lookupQueue) {
          if (item.kind === 'username') {
            if (!/^[a-z0-9._-]+$/.test(item.value)) {
              continue;
            }
            const { data, error } = await supabaseAdmin
              .from('profiles')
              .select('user_id')
              .eq('username', item.value)
              .maybeSingle();
            if (error) {
              return NextResponse.json({ error: error.message }, { status: 400 });
            }
            if (data?.user_id) {
              targetUserId = data.user_id;
              break;
            }
          } else {
            const { data, error } = await supabaseAdmin.auth.admin.listUsers({ email: item.value, perPage: 1 });
            if (error) {
              return NextResponse.json({ error: error.message }, { status: 400 });
            }
            const candidateId = data?.users?.[0]?.id;
            if (candidateId) {
              targetUserId = candidateId;
              break;
            }
          }
        }
      }
      if (!targetUserId) {
        return NextResponse.json({ error: 'Usuario nao encontrado. Informe username ou ID valido.' }, { status: 404 });
      }
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
        password: newPassword
      });
      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 400 });
      }
      return NextResponse.json({ success: true });
    }

    default:
      return NextResponse.json({ error: 'Acao nao suportada' }, { status: 400 });
  }
}

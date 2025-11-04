// app/api/auth/resolve/route.ts
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@lib/supabaseServer';
import { serverEnv } from '@lib/env';
import { ensureAdmin } from '../_utils/ensureAdmin';

const DEFAULT_PASSWORD = serverEnv.DEFAULT_USER_PASSWORD;
const DEFAULT_EMAIL_DOMAIN = serverEnv.DEFAULT_USER_EMAIL_DOMAIN;
const MIN_FAMILY_NAME_LENGTH = 3;
const ALLOWED_PROFILE_ROLES = ['ADMIN', 'LEADER', 'MEMBER'] as const;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isJsonRequest(req: Request) {
  const ct = req.headers.get('content-type') || '';
  return ct.includes('application/json');
}

function normalizeUuid(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!UUID_REGEX.test(trimmed)) return null;
  return trimmed;
}

export async function POST(request: Request) {
  try {
    // 1) Garante JSON no corpo sem quebrar se vier vazio/ruim
    let body: any = {};
    if (isJsonRequest(request)) {
      body = (await request.json().catch(() => ({}))) || {};
    }

    // 2) Autorização de admin
    const adminCheck = await ensureAdmin();
    if ('errorResponse' in adminCheck) {
      return adminCheck.errorResponse; // sempre é NextResponse.json(...)
    }

    const action = typeof body?.action === 'string' ? body.action : 'create';

    switch (action) {
      // ------------------------------------------------------
      case 'create': {
        const { name, role, username, ministryIds, leaderMinistryIds, family: rawFamily } = body;
        const normalizedRoleInput =
          typeof role === 'string' ? role.trim().toUpperCase() : 'MEMBER';
        const persistedRole = (ALLOWED_PROFILE_ROLES as readonly string[]).includes(
          normalizedRoleInput
        )
          ? normalizedRoleInput
          : 'MEMBER';

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
                .map((v: unknown) => (typeof v === 'string' ? v.trim() : ''))
                .filter((v: string) => v.length > 0)
            : [];
        const normalizedLeaderMinistryIds =
          Array.isArray(leaderMinistryIds) && leaderMinistryIds.length > 0
            ? Array.from(
                new Set(
                  leaderMinistryIds
                    .map((v: unknown) => (typeof v === 'string' ? v.trim() : ''))
                    .filter((v: string) => v.length > 0)
                )
              ).filter((id) => normalizedMinistryIds.includes(id))
            : [];

        const familyPayload = rawFamily && typeof rawFamily === 'object' ? rawFamily : null;
        const familyMemberIdsInput = Array.isArray(familyPayload?.memberIds) ? familyPayload.memberIds : [];
        const familyMemberIds = Array.from(
          new Set(
            familyMemberIdsInput
              .map((value: unknown) => normalizeUuid(value))
              .filter((value): value is string => Boolean(value))
          )
        );
        const newFamilyNameRaw =
          typeof familyPayload?.newFamilyName === 'string' ? familyPayload.newFamilyName.trim() : '';

        if (newFamilyNameRaw && newFamilyNameRaw.length > 0 && newFamilyNameRaw.length < MIN_FAMILY_NAME_LENGTH) {
          return NextResponse.json(
            { error: `Informe um nome de familia com pelo menos ${MIN_FAMILY_NAME_LENGTH} caracteres.` },
            { status: 400 }
          );
        }

        let familyProfiles: Array<{ user_id: string; family_id: string | null; name: string | null }> = [];
        let existingFamilyId: string | null = null;

        if (familyMemberIds.length > 0) {
          const { data: profiles, error: profilesError } = await supabaseAdmin
            .from('profiles')
            .select('user_id, family_id, name')
            .in('user_id', familyMemberIds);

          if (profilesError) {
            return NextResponse.json({ error: profilesError.message }, { status: 400 });
          }

          const fetchedProfiles = profiles ?? [];
          const foundIds = new Set(fetchedProfiles.map((profile) => profile.user_id));
          const missingIds = familyMemberIds.filter((id) => !foundIds.has(id));
          if (missingIds.length > 0) {
            return NextResponse.json(
              { error: 'Um ou mais voluntarios do vinculo familiar nao foram encontrados.', missingIds },
              { status: 400 }
            );
          }

          familyProfiles = fetchedProfiles;
          const familyIds = Array.from(
            new Set(
              familyProfiles
                .map((profile) => profile.family_id)
                .filter((value): value is string => Boolean(value))
            )
          );
          if (familyIds.length > 1) {
            return NextResponse.json(
              {
                error:
                  'Os voluntarios selecionados pertencem a familias diferentes. Ajuste o vinculo antes de continuar.'
              },
              { status: 400 }
            );
          }
          existingFamilyId = familyIds[0] ?? null;
        }

        const previousFamilyMap = new Map<string, string | null>(
          familyProfiles.map((profile) => [profile.user_id, profile.family_id])
        );
        let familyIdToUse: string | null = existingFamilyId;
        let newlyCreatedFamilyId: string | null = null;
        let updatedFamilyMemberIds: string[] = [];

        const { data: created, error: creationError } = await supabaseAdmin.auth.admin.createUser({
          email: generatedEmail,
          password: DEFAULT_PASSWORD,
          email_confirm: true,
          user_metadata: { name, username: normalizedUsername }
        });

        if (creationError || !created?.user) {
          return NextResponse.json(
            { error: creationError?.message || 'Nao foi possivel criar o usuario' },
            { status: 400 }
          );
        }

        const { error: profileInsertError } = await supabaseAdmin.from('profiles').insert({
          user_id: created.user.id,
          name,
          role: persistedRole,
          username: normalizedUsername
        });

        if (profileInsertError) {
          await supabaseAdmin.auth.admin.deleteUser(created.user.id);
          return NextResponse.json({ error: profileInsertError.message }, { status: 400 });
        }

        if (familyMemberIds.length > 0 || newFamilyNameRaw) {
          if (!familyIdToUse) {
            let finalFamilyName = newFamilyNameRaw;
            if (!finalFamilyName) {
              const referenceName =
                familyProfiles.find((profile) => profile.name)?.name?.trim() ?? String(name ?? '').trim();
              const base = referenceName.split(' ')[0] || referenceName || 'Nova';
              finalFamilyName = `Familia ${base}`.trim();
            }
            finalFamilyName = finalFamilyName.replace(/\s+/g, ' ').trim();
            if (finalFamilyName.length < MIN_FAMILY_NAME_LENGTH) {
              await supabaseAdmin.from('profiles').delete().eq('user_id', created.user.id);
              await supabaseAdmin.auth.admin.deleteUser(created.user.id);
              return NextResponse.json(
                { error: `Informe um nome de familia com pelo menos ${MIN_FAMILY_NAME_LENGTH} caracteres.` },
                { status: 400 }
              );
            }

            const { data: existingFamilyRow, error: existingFamilyLookupError } = await supabaseAdmin
              .from('families')
              .select('id')
              .eq('name', finalFamilyName)
              .maybeSingle();
            if (existingFamilyLookupError) {
              await supabaseAdmin.from('profiles').delete().eq('user_id', created.user.id);
              await supabaseAdmin.auth.admin.deleteUser(created.user.id);
              return NextResponse.json({ error: existingFamilyLookupError.message }, { status: 400 });
            }

            if (existingFamilyRow?.id) {
              familyIdToUse = existingFamilyRow.id;
            } else {
              const { data: newFamilyRow, error: familyInsertError } = await supabaseAdmin
                .from('families')
                .insert({ name: finalFamilyName })
                .select('id')
                .single();
              if (familyInsertError) {
                await supabaseAdmin.from('profiles').delete().eq('user_id', created.user.id);
                await supabaseAdmin.auth.admin.deleteUser(created.user.id);
                return NextResponse.json({ error: familyInsertError.message }, { status: 400 });
              }
              familyIdToUse = newFamilyRow?.id ?? null;
              newlyCreatedFamilyId = familyIdToUse;
            }
          }

          if (familyIdToUse) {
            const { error: profileFamilyUpdateError } = await supabaseAdmin
              .from('profiles')
              .update({ family_id: familyIdToUse })
              .eq('user_id', created.user.id);

            if (profileFamilyUpdateError) {
              if (newlyCreatedFamilyId) {
                await supabaseAdmin.from('families').delete().eq('id', newlyCreatedFamilyId);
              }
              await supabaseAdmin.auth.admin.deleteUser(created.user.id);
              return NextResponse.json({ error: profileFamilyUpdateError.message }, { status: 400 });
            }

            if (familyMemberIds.length > 0) {
              const membersToUpdate = familyProfiles
                .filter((profile) => profile.family_id !== familyIdToUse)
                .map((profile) => profile.user_id);

              if (membersToUpdate.length > 0) {
                const { error: existingMembersUpdateError } = await supabaseAdmin
                  .from('profiles')
                  .update({ family_id: familyIdToUse })
                  .in('user_id', membersToUpdate);

                if (existingMembersUpdateError) {
                  if (newlyCreatedFamilyId) {
                    await supabaseAdmin.from('families').delete().eq('id', newlyCreatedFamilyId);
                  }
                  await supabaseAdmin.from('profiles').delete().eq('user_id', created.user.id);
                  await supabaseAdmin.auth.admin.deleteUser(created.user.id);
                  return NextResponse.json({ error: existingMembersUpdateError.message }, { status: 400 });
                }
                updatedFamilyMemberIds = membersToUpdate;
              }
            }
          }
        }

        const effectiveLeaderIds =
          normalizedLeaderMinistryIds.length > 0
            ? normalizedLeaderMinistryIds
            : persistedRole === 'LEADER'
            ? normalizedMinistryIds
            : [];
        const leaderIdSet = new Set(effectiveLeaderIds);

        if (normalizedMinistryIds.length > 0) {
          const insertRows = normalizedMinistryIds.map((ministryId: string) => ({
            member_id: created.user.id,
            ministry_id: ministryId,
            is_leader: leaderIdSet.has(ministryId)
          }));
          const { error: ministriesInsertError } = await supabaseAdmin
            .from('member_ministries')
            .upsert(insertRows, { onConflict: 'member_id, ministry_id' });

          if (ministriesInsertError) {
            if (updatedFamilyMemberIds.length > 0) {
              await Promise.all(
                updatedFamilyMemberIds.map((memberId) => {
                  const previousFamilyId = previousFamilyMap.get(memberId) ?? null;
                  return supabaseAdmin
                    .from('profiles')
                    .update({ family_id: previousFamilyId })
                    .eq('user_id', memberId);
                })
              );
            }
            if (newlyCreatedFamilyId) {
              await supabaseAdmin.from('families').delete().eq('id', newlyCreatedFamilyId);
            }
            await supabaseAdmin.from('profiles').delete().eq('user_id', created.user.id);
            await supabaseAdmin.auth.admin.deleteUser(created.user.id);
            return NextResponse.json({ error: ministriesInsertError.message }, { status: 400 });
          }
        }

        return NextResponse.json({ success: true, defaultPassword: DEFAULT_PASSWORD });
      }

      // ------------------------------------------------------
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
          if (!lookupQueue.some((i) => i.kind === 'username' && i.value === normalized)) {
            lookupQueue.push({ kind: 'username', value: normalized });
          }
        };
        const pushEmail = (value: unknown) => {
          if (typeof value !== 'string') return;
          const normalized = value.trim().toLowerCase();
          if (!normalized) return;
          if (!lookupQueue.some((i) => i.kind === 'email' && i.value === normalized)) {
            lookupQueue.push({ kind: 'email', value: normalized });
          }
        };

        pushUsername(username);
        if (typeof identifier === 'string') {
          const trimmed = identifier.trim();
          trimmed.includes('@') ? pushEmail(trimmed) : pushUsername(trimmed);
        }
        pushEmail(email);

        if (!targetUserId) {
          if (lookupQueue.length === 0) {
            return NextResponse.json(
              { error: 'Informe username, email ou ID do usuario para redefinir a senha' },
              { status: 400 }
            );
          }
          for (const item of lookupQueue) {
            if (item.kind === 'username') {
              if (!/^[a-z0-9._-]+$/.test(item.value)) continue;
              const { data, error } = await supabaseAdmin
                .from('profiles')
                .select('user_id')
                .eq('username', item.value)
                .maybeSingle();
              if (error) return NextResponse.json({ error: error.message }, { status: 400 });
              if (data?.user_id) {
                targetUserId = data.user_id;
                break;
              }
            } else {
              const { data, error } = await supabaseAdmin.auth.admin.listUsers({ email: item.value, perPage: 1 });
              if (error) return NextResponse.json({ error: error.message }, { status: 400 });
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

      // ------------------------------------------------------
      case 'updateUsername': {
        const { userId, email, currentUsername, newUsername } = body;

        const normalizedNewUsername =
          typeof newUsername === 'string' ? newUsername.trim().toLowerCase() : '';
        if (!normalizedNewUsername) {
          return NextResponse.json({ error: 'Informe o novo username.' }, { status: 400 });
        }
        if (!/^[a-z0-9._-]+$/.test(normalizedNewUsername)) {
          return NextResponse.json(
            { error: 'Username deve conter apenas letras, numeros e os caracteres ._- (sem espacos)' },
            { status: 400 }
          );
        }

        let targetUserId =
          typeof userId === 'string' && userId.trim().length > 0 ? userId.trim() : undefined;

        const normalizedEmail =
          typeof email === 'string' ? email.trim().toLowerCase() : undefined;
        const normalizedCurrentUsername =
          typeof currentUsername === 'string' ? currentUsername.trim().toLowerCase() : undefined;

        if (!targetUserId && normalizedEmail) {
          const { data, error } = await supabaseAdmin.auth.admin.listUsers({
            email: normalizedEmail,
            perPage: 1
          });
          if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 });
          }
          targetUserId = data?.users?.[0]?.id || undefined;
        }

        if (!targetUserId && normalizedCurrentUsername) {
          if (!/^[a-z0-9._-]+$/.test(normalizedCurrentUsername)) {
            return NextResponse.json({ error: 'Username atual invalido.' }, { status: 400 });
          }
          const { data, error } = await supabaseAdmin
            .from('profiles')
            .select('user_id')
            .eq('username', normalizedCurrentUsername)
            .maybeSingle();
          if (error) {
            return NextResponse.json({ error: error.message }, { status: 400 });
          }
          targetUserId = data?.user_id || undefined;
        }

        if (!targetUserId) {
          return NextResponse.json(
            { error: 'Nao foi possivel localizar o usuario informado.' },
            { status: 404 }
          );
        }

        const { data: profileData, error: profileError } = await supabaseAdmin
          .from('profiles')
          .select('id, username')
          .eq('user_id', targetUserId)
          .maybeSingle();

        if (profileError) {
          return NextResponse.json({ error: profileError.message }, { status: 400 });
        }

        if (!profileData) {
          return NextResponse.json({ error: 'Perfil nao encontrado.' }, { status: 404 });
        }

        if (profileData.username === normalizedNewUsername) {
          return NextResponse.json({ success: true, userId: targetUserId });
        }

        const { data: conflict, error: conflictError } = await supabaseAdmin
          .from('profiles')
          .select('user_id')
          .eq('username', normalizedNewUsername)
          .maybeSingle();

        if (conflictError) {
          return NextResponse.json({ error: conflictError.message }, { status: 400 });
        }
        if (conflict && conflict.user_id !== targetUserId) {
          return NextResponse.json({ error: 'Username ja utilizado por outro usuario.' }, { status: 409 });
        }

        const { error: profileUpdateError } = await supabaseAdmin
          .from('profiles')
          .update({ username: normalizedNewUsername })
          .eq('user_id', targetUserId);

        if (profileUpdateError) {
          return NextResponse.json({ error: profileUpdateError.message }, { status: 400 });
        }

        const { data: userInfo, error: userInfoError } = await supabaseAdmin.auth.admin.getUserById(
          targetUserId
        );

        if (userInfoError) {
          return NextResponse.json({ error: userInfoError.message }, { status: 400 });
        }

        const existingMetadata =
          (userInfo?.user?.user_metadata as Record<string, unknown> | null) || {};

        const { error: metadataUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
          targetUserId,
          {
            user_metadata: { ...existingMetadata, username: normalizedNewUsername }
          }
        );

        if (metadataUpdateError) {
          return NextResponse.json({ error: metadataUpdateError.message }, { status: 400 });
      }

      return NextResponse.json({ success: true, userId: targetUserId });
    }

      // ------------------------------------------------------
      case 'updateRole': {
        const { userId, role } = body;
        const normalizedUserId = typeof userId === 'string' ? userId.trim() : '';
        const normalizedRole = typeof role === 'string' ? role.trim().toUpperCase() : '';

        if (!normalizedUserId || !UUID_REGEX.test(normalizedUserId)) {
          return NextResponse.json({ error: 'Informe um usuario valido.' }, { status: 400 });
        }

        if (!(ALLOWED_PROFILE_ROLES as readonly string[]).includes(normalizedRole)) {
          return NextResponse.json(
            { error: 'Informe um papel valido (ADMIN, LEADER ou MEMBER).' },
            { status: 400 }
          );
        }

        const { data: profile, error: profileError } = await supabaseAdmin
          .from('profiles')
          .select('user_id, role')
          .eq('user_id', normalizedUserId)
          .maybeSingle();

        if (profileError) {
          return NextResponse.json({ error: profileError.message }, { status: 400 });
        }

        if (!profile) {
          return NextResponse.json({ error: 'Usuario nao encontrado.' }, { status: 404 });
        }

        if (profile.role === normalizedRole) {
          return NextResponse.json({ success: true, role: normalizedRole });
        }

        const { error: updateError } = await supabaseAdmin
          .from('profiles')
          .update({ role: normalizedRole })
          .eq('user_id', normalizedUserId);

        if (updateError) {
          return NextResponse.json({ error: updateError.message }, { status: 400 });
        }

        return NextResponse.json({ success: true, role: normalizedRole });
      }

      // ------------------------------------------------------
      default:
        return NextResponse.json({ error: 'Acao nao suportada' }, { status: 400 });
    }
  } catch (err: any) {
    console.error('Erro em /api/auth/resolve:', err);
    return NextResponse.json(
      { error: err?.message || 'Erro interno no servidor' },
      { status: 500 }
    );
  }
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { supabase } from '@lib/supabaseClient';

type Factor = {
  id: string;
  friendly_name?: string | null;
  factor_type: string;
  status: 'verified' | 'unverified' | string;
};

type PendingEnrollment = {
  factorId: string;
  qrCode: string | null;
  secret: string | null;
};

export default function MfaEnrollmentCard() {
  const [loading, setLoading] = useState(true);
  const [factors, setFactors] = useState<Factor[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingEnrollment | null>(null);
  const [verificationCode, setVerificationCode] = useState('');

  const hasVerifiedFactor = factors.some((factor) => factor.status === 'verified');

  const loadFactors = useCallback(async () => {
    setError(null);
    const { data, error: listError } = await supabase.auth.mfa.listFactors();
    if (listError) {
      setError(listError.message ?? 'Nao foi possivel carregar fatores de MFA.');
      setFactors([]);
    } else {
      setFactors(data?.totp ?? data?.factors ?? []);
    }
    setLoading(false);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    loadFactors();
  }, [loadFactors]);

  async function startEnrollment() {
    setError(null);
    setInfo(null);
    setLoading(true);
    const { data, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'Authenticator App'
    });
    if (enrollError) {
      setError(enrollError.message ?? 'Nao foi possivel iniciar o processo de MFA.');
      setLoading(false);
      return;
    }
    setPending({
      factorId: data.id,
      qrCode: data.totp?.qr_code ?? null,
      secret: data.totp?.secret ?? null
    });
    setInfo(
      'Escaneie o QR Code em um aplicativo autenticador (Google Authenticator, 1Password, Authy, etc.) e informe o codigo abaixo.'
    );
    setLoading(false);
  }

  async function verifyEnrollment(event: React.FormEvent) {
    event.preventDefault();
    if (!pending) return;
    setError(null);
    setInfo(null);
    setLoading(true);
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: pending.factorId,
      code: verificationCode.trim()
    });
    if (verifyError) {
      setError(verifyError.message ?? 'Codigo invalido. Tente novamente.');
      setLoading(false);
      return;
    }
    setPending(null);
    setVerificationCode('');
    setInfo('MFA verificado com sucesso! Obrigado por reforcar a seguranca da lideranca.');
    await loadFactors();
    setLoading(false);
  }

  async function unenrollFactor(factorId: string) {
    setError(null);
    setInfo(null);
    setLoading(true);
    const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId });
    if (unenrollError) {
      setError(unenrollError.message ?? 'Nao foi possivel remover o autenticador.');
      setLoading(false);
      return;
    }
    setInfo(
      'Autenticador removido. Garanta que pelo menos um fator permaneça ativo para manter o acesso administrativo.'
    );
    await loadFactors();
    setLoading(false);
  }

  return (
    <section className="rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-6 shadow-inner shadow-emerald-900/30">
      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/40 bg-emerald-500/20 px-3 py-1 text-[11px] font-semibold tracking-widest text-emerald-100/80">
            MFA
          </div>
          <h3 className="mt-2 text-xl font-semibold text-white">Autenticacao multifator</h3>
          <p className="mt-1 text-sm text-emerald-100/80">
            Admins sao obrigados a manter pelo menos um autenticador TOTP ativo. Configure abaixo para evitar
            bloqueios de acesso.
          </p>
        </div>
        <span className="text-2xl">🔐</span>
      </header>

      {loading ? (
        <p className="mt-4 text-sm text-emerald-100/70">Carregando fatores habilitados…</p>
      ) : (
        <div className="mt-4 space-y-4">
          {factors.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold uppercase tracking-wide text-emerald-100/80">
                Autenticadores ativos
              </h4>
              <ul className="space-y-2 text-sm text-emerald-50/90">
                {factors.map((factor) => (
                  <li
                    key={factor.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3"
                  >
                    <div>
                      <p className="font-semibold">
                        {factor.friendly_name ?? 'Authenticator app'}
                        {factor.status === 'verified' ? ' (verificado)' : ' (pendente)'}
                      </p>
                      <p className="text-xs text-emerald-100/70">Tipo: {factor.factor_type}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => unenrollFactor(factor.id)}
                      className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-50 transition hover:bg-emerald-500/30"
                    >
                      Remover
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {pending ? (
            <form
              onSubmit={verifyEnrollment}
              className="space-y-3 rounded-2xl border border-emerald-300/30 bg-emerald-400/10 p-4"
            >
              <p className="text-sm text-emerald-100/80">
                Escaneie o QR Code a seguir no aplicativo autenticador de sua preferencia. Caso prefira, utilize
                o segredo manual abaixo:
              </p>
              {pending.qrCode ? (
                <div className="flex justify-center">
                  <Image
                    src={pending.qrCode}
                    alt="QR Code MFA"
                    width={160}
                    height={160}
                    className="rounded-2xl border border-white/10 bg-white/5 p-2"
                    unoptimized
                  />
                </div>
              ) : null}
              {pending.secret && (
                <code className="block rounded-xl border border-emerald-300/40 bg-emerald-500/10 px-3 py-2 text-center text-sm tracking-[0.3em] text-emerald-50">
                  {pending.secret}
                </code>
              )}
              <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-100/80">
                Codigo do autenticador
                <input
                  value={verificationCode}
                  onChange={(event) => setVerificationCode(event.target.value)}
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className="rounded-xl border border-emerald-400/30 bg-slate-900/60 px-4 py-3 text-sm text-white focus:border-emerald-300/60 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                  placeholder="000000"
                />
              </label>
              <button
                type="submit"
                className="w-full rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-900/40 transition hover:bg-emerald-400"
              >
                Confirmar codigo
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={startEnrollment}
              className="w-full rounded-full border border-emerald-400/40 bg-emerald-500/30 px-4 py-3 text-sm font-semibold text-emerald-50 transition hover:bg-emerald-500/50"
            >
              {hasVerifiedFactor ? 'Adicionar autenticador secundario' : 'Ativar autenticador MFA'}
            </button>
          )}
        </div>
      )}

      {info && <p className="mt-3 text-sm text-emerald-100/85">{info}</p>}
      {error && <p className="mt-3 text-sm text-rose-200">{error}</p>}
    </section>
  );
}

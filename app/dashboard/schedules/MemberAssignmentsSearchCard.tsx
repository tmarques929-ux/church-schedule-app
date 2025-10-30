'use client';

import React, { useState, useEffect } from 'react';

interface Member {
  id: string;
  nome: string;
  ministerio: string;
}

export default function MemberAssignmentsSearchCard() {
  const [search, setSearch] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [filtered, setFiltered] = useState<Member[]>([]);

  useEffect(() => {
    // Simulação de busca de membros — depois você pode integrar com Supabase
    const fakeMembers: Member[] = [
      { id: '1', nome: 'Thiago', ministerio: 'Áudio' },
      { id: '2', nome: 'Felipe', ministerio: 'Louvor' },
      { id: '3', nome: 'Alexandre', ministerio: 'Multimídia' },
      { id: '4', nome: 'Diogo', ministerio: 'Iluminação' },
    ];
    setMembers(fakeMembers);
    setFiltered(fakeMembers);
  }, []);

  useEffect(() => {
    const result = members.filter((m) =>
      m.nome.toLowerCase().includes(search.toLowerCase())
    );
    setFiltered(result);
  }, [search, members]);

  return (
    <div className="p-4 border rounded-lg shadow-sm bg-white">
      <h2 className="text-xl font-semibold mb-3">Buscar Membros</h2>
      <input
        type="text"
        placeholder="Digite o nome..."
        className="border px-3 py-2 rounded-md w-full mb-4"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <ul className="space-y-2">
        {filtered.map((member) => (
          <li key={member.id} className="border-b py-1">
            <strong>{member.nome}</strong> – {member.ministerio}
          </li>
        ))}
      </ul>
    </div>
  );
}

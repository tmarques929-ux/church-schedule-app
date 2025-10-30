const { createClient } = require('@supabase/supabase-js');

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.argv[2];

if (!url || !serviceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}
if (!email) {
  console.error('Usage: node checkRole.js <email>');
  process.exit(1);
}

async function main() {
  const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: listResult, error: listError } = await supabase.auth.admin.listUsers({ email, perPage: 1 });
  if (listError) {
    console.error('Erro ao buscar usuario:', listError.message);
    process.exit(1);
  }
  const user = listResult?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) {
    console.log('Usuario nao encontrado');
    return;
  }
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('user_id, name, role')
    .eq('user_id', user.id)
    .maybeSingle();
  if (profileError) {
    console.error('Erro ao buscar perfil:', profileError.message);
    process.exit(1);
  }
  console.log(JSON.stringify({
    email: user.email,
    user_id: user.id,
    profile
  }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

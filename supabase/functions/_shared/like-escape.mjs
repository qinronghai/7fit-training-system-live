// Pure helper shared by the Supabase edge functions.
// Postgres LIKE (and PostgREST ilike) treats % and _ as wildcards and
// \ as the default escape character. A member search term must therefore
// be escaped before it is wrapped in %...%, otherwise a search for e.g.
// "100%" would match every name containing "100" plus anything, and a
// search for "_" would match every single-character name.
export function escapeLikeTerm(term) {
  return String(term ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_');
}

export function likeContains(term) {
  return `%${escapeLikeTerm(term)}%`;
}
